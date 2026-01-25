import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticateToken, requireRole } from '../middleware/auth';
import { prisma, safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';
import { registerService } from '../services/registerService';
import { GDPRComplianceService } from '../services/gdprComplianceService';
import PDFDocument from 'pdfkit';

const router = Router();

// Get all registers with filters
router.get('/', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const {
      activityId,
      sessionId,
      dateFrom,
      dateTo,
      page = '1',
      limit = '20',
      fields = 'all' // New parameter for custom fields
    } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    // Parse fields parameter to determine which fields to include
    const requestedFields = fields === 'all' ? ['all'] : (fields as string).split(',');
    const includeMedicalInfo = requestedFields.includes('all') || requestedFields.includes('medical');
    const includePermissions = requestedFields.includes('all') || requestedFields.includes('permissions');
    const includeBookingOptions = requestedFields.includes('all') || requestedFields.includes('booking_options');
    const includeBasicInfo = requestedFields.includes('all') || requestedFields.includes('basic');

    const where: any = {};
    
    if (sessionId) where.sessionId = sessionId as string;
    
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom as string);
      if (dateTo) where.date.lte = new Date(dateTo as string);
    }

    // If activityId is provided, filter by session's activity
    if (activityId) {
      where.session = {
        activityId: activityId as string
      };
    }

    // ADMIN ACCESS: Admin users should see ALL registers regardless of venue ownership
    // Business users should only see registers from their owned venues
    const userRole = req.user!.role;
    logger.info('Register API access', {
      userId: req.user!.id,
      userRole: userRole,
      endpoint: 'admin-registers'
    });
    
    // Note: Admin users skip venue filtering entirely - they see ALL registers
    // Non-admin users will filter by venue ownership below
    if (userRole !== 'admin') {
      // For non-admin users, filter by venue ownership
      const userVenues = await safePrismaQuery(async (client) => {
        return await client.venue.findMany({
          where: { ownerId: req.user!.id },
          select: { id: true }
        });
      });
      
      const venueIds = userVenues.map(v => v.id);
      if (venueIds.length > 0) {
        // Build the session filter with venue filtering
        if (where.session) {
          // If session filter already exists (from activityId), combine it
          where.session = {
            ...where.session,
            activity: {
              ...where.session.activity,
              venueId: { in: venueIds }
            }
          };
        } else {
          // Create new session filter
          where.session = {
            activity: {
              venueId: { in: venueIds }
            }
          };
        }
      } else {
        // User has no venues, return empty result
        return res.json({
          success: true,
          data: [],
          pagination: {
            page: parseInt(page as string),
            limit: parseInt(limit as string),
            total: 0,
            totalPages: 0
          }
        });
      }
    }

    logger.info('Fetching registers', {
      userRole,
      whereClause: JSON.stringify(where),
      skip,
      take
    });

    const [registers, total] = await Promise.all([
      safePrismaQuery(async (client) => {
        return await client.register.findMany({
          where,
          skip,
          take,
          include: {
            session: {
              include: {
                activity: {
                  include: {
                    venue: {
                      select: {
                        id: true,
                        name: true,
                        address: true
                      }
                    }
                  }
                }
              }
            },
            attendance: {
              include: {
                child: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    ...(includeBasicInfo && {
                      dateOfBirth: true,
                      yearGroup: true,
                      school: true,
                      class: true
                    }),
                    ...(includeMedicalInfo && {
                      allergies: true,
                      medicalInfo: true
                    }),
                    ...(includePermissions && {
                      permissions: {
                        select: {
                          consentToWalkHome: true,
                          consentToPhotography: true,
                          consentToFirstAid: true,
                          consentToEmergencyContact: true
                        }
                      }
                    })
                  }
                },
                booking: {
                  select: {
                    id: true,
                    ...(includeBookingOptions && {
                      hasEarlyDropoff: true,
                      earlyDropoffAmount: true,
                      hasLatePickup: true,
                      latePickupAmount: true
                    }),
                    parent: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        phone: true
                      }
                    }
                  }
                }
              }
            }
          },
          orderBy: { date: 'desc' }
        } as any);
      }),
      safePrismaQuery(async (client) => {
        return await client.register.count({ where });
      })
    ]);

    // Transform the data to match the expected frontend format
    const transformedRegisters = await Promise.all(registers.map(async (register: any) => ({
      id: register.id,
      date: register.date,
      status: register.status,
      notes: register.notes,
      capacity: register.session?.activity?.capacity || 0,
      presentCount: register.attendance?.filter((a: any) => a.present).length || 0,
      totalCount: register.attendance?.length || 0,
      activity_id: register.session?.activity?.id,
      activity_title: register.session?.activity?.title,
      venue_name: register.session?.activity?.venue?.name || 'No venue',
      start_time: register.session?.startTime,
      end_time: register.session?.endTime,
      created_at: register.createdAt,
      updated_at: register.updatedAt,
      session: {
        id: register.session?.id,
        startTime: register.session?.startTime,
        endTime: register.session?.endTime,
        activity: {
          title: register.session?.activity?.title,
          type: register.session?.activity?.type || 'Other',
          venue: {
            name: register.session?.activity?.venue?.name || 'No venue',
            address: register.session?.activity?.venue?.address || ''
          }
        }
      },
      attendance: await Promise.all(register.attendance?.map(async (att: any) => {
        // Check GDPR compliance for sensitive data
        const userId = req.user!.id;
        const venueId = register.session?.activity?.venueId;
        const hasAdminAccess = await GDPRComplianceService.hasAdminAccess(userId, venueId);
        
        // Filter child data based on consent and admin access
        let filteredChildData = { ...att.child };
        if (!hasAdminAccess) {
          filteredChildData = await GDPRComplianceService.filterChildDataByConsent(
            att.child,
            'register_view'
          );
        }

        return {
          id: att.id,
          present: att.present,
          checkInTime: att.checkInTime,
          checkOutTime: att.checkOutTime,
          notes: att.notes,
          child: {
            id: filteredChildData?.id,
            firstName: filteredChildData?.firstName,
            lastName: filteredChildData?.lastName,
            ...(includeBasicInfo && {
              dateOfBirth: filteredChildData?.dateOfBirth,
              yearGroup: filteredChildData?.yearGroup,
              school: filteredChildData?.school,
              class: filteredChildData?.class
            }),
            ...(includeMedicalInfo && {
              allergies: filteredChildData?.allergies,
              medicalInfo: filteredChildData?.medicalInfo
            }),
            ...(includePermissions && {
              permissions: filteredChildData?.permissions ? {
                consentToWalkHome: filteredChildData.permissions.consentToWalkHome,
                consentToPhotography: filteredChildData.permissions.consentToPhotography,
                consentToFirstAid: filteredChildData.permissions.consentToFirstAid,
                consentToEmergencyContact: filteredChildData.permissions.consentToEmergencyContact
              } : null
            })
          },
          booking: {
            id: att.booking?.id,
            ...(includeBookingOptions && {
              hasEarlyDropoff: att.booking?.hasEarlyDropoff,
              earlyDropoffAmount: att.booking?.earlyDropoffAmount,
              hasLatePickup: att.booking?.hasLatePickup,
              latePickupAmount: att.booking?.latePickupAmount
            }),
            parent: {
              id: att.booking?.parent?.id,
              firstName: att.booking?.parent?.firstName,
              lastName: att.booking?.parent?.lastName,
              email: att.booking?.parent?.email,
              phone: att.booking?.parent?.phone
            }
          }
        };
      }) || [])
    })));

    res.json({
      success: true,
      data: transformedRegisters,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error) {
    logger.error('Error fetching registers:', error);
    throw new AppError('Failed to fetch registers', 500, 'REGISTERS_FETCH_ERROR');
  }
}));

// Generate register template for activity
router.get('/template/:activityId', authenticateToken, requireRole(['admin', 'coordinator']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { activityId } = req.params;
    const { date } = req.query;

    if (!date) {
      throw new AppError('Date is required', 400, 'MISSING_DATE');
    }

    const sessionDate = new Date(date as string);

    // Find sessions for this activity on the specified date
    const sessions = await safePrismaQuery(async (client) => {
      return await client.session.findMany({
        where: {
          activityId: activityId,
          date: {
            gte: new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate()),
            lt: new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate() + 1)
          }
        },
        include: {
          activity: {
            select: {
              title: true,
              description: true,
              capacity: true,
              price: true,
              venue: {
                select: {
                  name: true,
                  address: true
                }
              }
            }
          }
        }
      } as any);
    });

    if (sessions.length === 0) {
      // Return empty template instead of 404
      const template = {
        activityId,
        date: sessionDate,
        activityTitle: 'Unknown Activity',
        venueName: 'Unknown Venue',
        startTime: '00:00',
        endTime: '00:00',
        sessions: [],
        children: [],
        message: 'No sessions found for this activity on the specified date'
      };

      res.json({
        success: true,
        data: template
      });
      return;
    }

    // Get all bookings for this activity and date
    const bookings = await safePrismaQuery(async (client) => {
      return await client.booking.findMany({
        where: {
          activityId: activityId!,
          activityDate: sessionDate,
          status: {
            in: ['confirmed']
          }
        },
        include: {
          child: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              dateOfBirth: true,
              yearGroup: true,
              allergies: true,
              medicalInfo: true
            }
          }
        }
      });
    });

    // Transform bookings into the expected format
    const children = bookings.map((booking: any) => ({
      childId: booking.child.id,
      firstName: booking.child.firstName,
      lastName: booking.child.lastName,
      dateOfBirth: booking.child.dateOfBirth,
      yearGroup: booking.child.yearGroup,
      allergies: booking.child.allergies,
      medicalInfo: booking.child.medicalInfo,
      bookingId: booking.id,
      status: 'present' as const,
      notes: ''
    }));

    // Generate template data
    const template = {
      activityId,
      date: sessionDate,
      activityTitle: (sessions[0] as any)?.activity?.title || 'Unknown Activity',
      venueName: (sessions[0] as any)?.activity?.venue?.name || 'Unknown Venue',
      startTime: sessions[0]?.startTime || '00:00',
      endTime: sessions[0]?.endTime || '00:00',
      sessions: (sessions as any[]).map((session: any) => ({
        id: session.id,
        startTime: session.startTime,
        endTime: session.endTime,
        activity: session.activity
      })),
      children: children
    };

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    logger.error('Error generating register template:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to generate register template', 500, 'TEMPLATE_GENERATE_ERROR');
  }
}));

// Get single register
router.get('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      throw new AppError('Register ID is required', 400, 'MISSING_REGISTER_ID');
    }
    
    const register = await prisma.register.findUnique({
      where: { id: id as string },
      include: {
        session: {
          include: {
            activity: {
              include: {
                venue: true
              }
            }
          }
        },
        attendance: {
          include: {
            child: true,
            booking: true
          }
        }
      }
    });
    
    if (!register) {
      throw new AppError('Register not found', 404, 'REGISTER_NOT_FOUND');
    }

    // Transform the data to match frontend expectations
    const transformedRegister = {
      id: register.id,
      date: register.date,
      status: register.status,
      notes: register.notes,
      activity_id: (register as any).session?.activity?.id,
      activity_title: (register as any).session?.activity?.title,
      venue_name: (register as any).session?.activity?.venue?.name || 'No venue',
      start_time: (register as any).session?.startTime,
      end_time: (register as any).session?.endTime,
      created_at: register.createdAt,
      updated_at: register.updatedAt,
      attendance: (register as any).attendance?.map((att: any) => ({
        id: att.id,
        child_id: att.childId,
        first_name: att.child?.firstName,
        last_name: att.child?.lastName,
        date_of_birth: att.child?.dateOfBirth,
        year_group: att.child?.yearGroup,
        school: att.child?.school,
        class: att.child?.class,
        allergies: att.child?.allergies,
        medical_info: att.child?.medicalInfo,
        status: att.present ? 'present' : 'absent',
        notes: att.notes,
        checkInTime: att.checkInTime,
        checkOutTime: att.checkOutTime,
        permissions: att.child?.permissions,
        booking: att.booking
      })) || []
    };

    res.json({
      success: true,
      data: transformedRegister
    });
  } catch (error) {
    logger.error('Error fetching register:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch register', 500, 'REGISTER_FETCH_ERROR');
  }
}));

// Create register
router.post('/', authenticateToken, requireRole(['admin', 'coordinator']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { sessionId, notes } = req.body;

    if (!sessionId) {
      throw new AppError('Session ID is required', 400, 'MISSING_SESSION_ID');
    }

    const register = await registerService.createRegister(sessionId, notes);

    logger.info('Register created', {
      registerId: register.id,
      sessionId,
      createdBy: req.user!.id
    });

    res.status(201).json({
      success: true,
      message: 'Register created successfully',
      data: register
    });
  } catch (error) {
    logger.error('Error creating register:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to create register', 500, 'REGISTER_CREATE_ERROR');
  }
}));

// Auto-create registers for activity
router.post('/auto-create', authenticateToken, requireRole(['admin', 'coordinator']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { activityId, startDate, endDate } = req.body;

    if (!activityId) {
      throw new AppError('Activity ID is required', 400, 'MISSING_ACTIVITY_ID');
    }

    const registers = await registerService.autoCreateRegistersForActivity(
      activityId,
      new Date(startDate),
      new Date(endDate)
    );

    logger.info('Registers auto-created', {
      activityId,
      registersCreated: registers.length,
      createdBy: req.user!.id
    });

    res.status(201).json({
      success: true,
      message: `${registers.length} registers created successfully`,
      data: registers
    });
  } catch (error) {
    logger.error('Error auto-creating registers:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to create registers', 500, 'REGISTERS_CREATE_ERROR');
  }
}));

// Update attendance
router.put('/:id/attendance', authenticateToken, requireRole(['admin', 'coordinator', 'coach']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { attendanceRecords } = req.body;

    if (!attendanceRecords || !Array.isArray(attendanceRecords)) {
      throw new AppError('Attendance records are required', 400, 'MISSING_ATTENDANCE_RECORDS');
    }

    const updatedRecords = await registerService.updateAttendance(id as string, attendanceRecords);

    logger.info('Attendance updated', {
      registerId: id,
      recordsUpdated: updatedRecords.length,
      updatedBy: req.user!.id
    });

    res.json({
      success: true,
      message: 'Attendance updated successfully',
      data: updatedRecords
    });
  } catch (error) {
    logger.error('Error updating attendance:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to update attendance', 500, 'ATTENDANCE_UPDATE_ERROR');
  }
}));

// Get attendance stats
router.get('/:id/stats', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const stats = await registerService.getAttendanceStats(id as string);
    
    if (!stats) {
      throw new AppError('Register not found', 404, 'REGISTER_NOT_FOUND');
    }

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error fetching attendance stats:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch attendance stats', 500, 'STATS_FETCH_ERROR');
  }
}));

// Generate attendance report
router.get('/:activityId/report', authenticateToken, requireRole(['admin', 'coordinator']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { activityId } = req.params;
    const { dateFrom, dateTo } = req.query;

    if (!dateFrom || !dateTo) {
      throw new AppError('Date range is required', 400, 'MISSING_DATE_RANGE');
    }

    const report = await registerService.generateAttendanceReport(
      activityId as string,
      new Date(dateFrom as string),
      new Date(dateTo as string)
    );

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    logger.error('Error generating attendance report:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to generate attendance report', 500, 'REPORT_GENERATE_ERROR');
  }
}));

// Delete register
router.delete('/:id', authenticateToken, requireRole(['admin']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    await registerService.deleteRegister(id as string);

    logger.info('Register deleted', {
      registerId: id,
      deletedBy: req.user!.id
    });

    res.json({
      success: true,
      message: 'Register deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting register:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to delete register', 500, 'REGISTER_DELETE_ERROR');
  }
}));

// Get registers by activity
router.get('/activity/:activityId', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { activityId } = req.params;
    const { dateFrom, dateTo } = req.query;

    const registers = await registerService.getRegistersByActivity(
      activityId as string,
      dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo ? new Date(dateTo as string) : undefined
    );

    res.json({
      success: true,
      data: registers
    });
  } catch (error) {
    logger.error('Error fetching registers by activity:', error);
    throw new AppError('Failed to fetch registers', 500, 'REGISTERS_FETCH_ERROR');
  }
}));

// Get registers by session
router.get('/session/:sessionId', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    const registers = await registerService.getRegistersBySession(sessionId as string);

    res.json({
      success: true,
      data: registers
    });
  } catch (error) {
    logger.error('Error fetching registers by session:', error);
    throw new AppError('Failed to fetch registers', 500, 'REGISTERS_FETCH_ERROR');
  }
}));

// Export register data
router.get('/export/:registerId', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const { registerId } = req.params;
    const { format = 'csv', fields = 'all' } = req.query;

    if (!['csv', 'pdf'].includes(format as string)) {
      throw new AppError('Export format must be csv or pdf', 400, 'INVALID_FORMAT');
    }

    // Parse fields parameter
    const requestedFields = fields === 'all' ? ['all'] : (fields as string).split(',');
    const includeMedicalInfo = requestedFields.includes('all') || requestedFields.includes('medical');
    const includePermissions = requestedFields.includes('all') || requestedFields.includes('permissions');
    const includeBookingOptions = requestedFields.includes('all') || requestedFields.includes('booking_options');
    const includeBasicInfo = requestedFields.includes('all') || requestedFields.includes('basic');

    // Get register with all data
    const register = await safePrismaQuery(async (client) => {
      return await client.register.findUnique({
        where: { id: registerId as string },
        include: {
          session: {
            include: {
              activity: {
                select: {
                  title: true,
                  description: true,
                  venue: {
                    select: {
                      name: true,
                      address: true
                    }
                  }
                }
              }
            }
          },
          attendance: {
            include: {
              child: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  ...(includeBasicInfo && {
                    dateOfBirth: true,
                    yearGroup: true,
                    school: true,
                    class: true
                  }),
                  ...(includeMedicalInfo && {
                    allergies: true,
                    medicalInfo: true
                  }),
                  ...(includePermissions && {
                    permissions: {
                      select: {
                        consentToWalkHome: true,
                        consentToPhotography: true,
                        consentToFirstAid: true,
                        consentToEmergencyContact: true
                      }
                    }
                  })
                }
              },
              booking: {
                select: {
                  id: true,
                  ...(includeBookingOptions && {
                    hasEarlyDropoff: true,
                    earlyDropoffAmount: true,
                    hasLatePickup: true,
                    latePickupAmount: true
                  }),
                  parent: {
                    select: {
                      firstName: true,
                      lastName: true,
                      email: true,
                      phone: true
                    }
                  }
                }
              }
            }
          }
        }
      });
    });

    if (!register) {
      throw new AppError('Register not found', 404, 'REGISTER_NOT_FOUND');
    }

    if (format === 'csv') {
      // Generate CSV
      const csvHeaders = [
        'Child Name',
        'Parent Name',
        'Parent Email',
        'Parent Phone',
        'Present',
        'Check In Time',
        'Check Out Time',
        'Notes'
      ];

      // Add conditional headers based on requested fields
      if (includeBasicInfo) {
        csvHeaders.push('Date of Birth', 'Year Group', 'School', 'Class');
      }
      if (includeMedicalInfo) {
        csvHeaders.push('Allergies', 'Medical Info');
      }
      if (includePermissions) {
        csvHeaders.push('Walk Home Alone', 'Photo Permission', 'First Aid Consent', 'Emergency Contact Consent');
      }
      if (includeBookingOptions) {
        csvHeaders.push('Early Drop-off', 'Early Drop-off Amount', 'Late Pick-up', 'Late Pick-up Amount');
      }

      const csvData = register.attendance.map((att: any) => {
        const row = [
          `${att.child.firstName} ${att.child.lastName}`,
          `${att.booking.parent.firstName} ${att.booking.parent.lastName}`,
          att.booking.parent.email,
          att.booking.parent.phone,
          att.present ? 'Yes' : 'No',
          att.checkInTime ? new Date(att.checkInTime).toLocaleString() : '',
          att.checkOutTime ? new Date(att.checkOutTime).toLocaleString() : '',
          att.notes || ''
        ];

        // Add conditional data
        if (includeBasicInfo) {
          row.push(
            att.child.dateOfBirth ? new Date(att.child.dateOfBirth).toLocaleDateString() : '',
            att.child.yearGroup || '',
            att.child.school || '',
            att.child.class || ''
          );
        }
        if (includeMedicalInfo) {
          row.push(
            att.child.allergies || '',
            att.child.medicalInfo || ''
          );
        }
        if (includePermissions) {
          row.push(
            att.child.permissions?.consentToWalkHome ? 'Yes' : 'No',
            att.child.permissions?.consentToPhotography ? 'Yes' : 'No',
            att.child.permissions?.consentToFirstAid ? 'Yes' : 'No',
            att.child.permissions?.consentToEmergencyContact ? 'Yes' : 'No'
          );
        }
        if (includeBookingOptions) {
          row.push(
            att.booking.hasEarlyDropoff ? 'Yes' : 'No',
            att.booking.earlyDropoffAmount ? `£${att.booking.earlyDropoffAmount}` : '',
            att.booking.hasLatePickup ? 'Yes' : 'No',
            att.booking.latePickupAmount ? `£${att.booking.latePickupAmount}` : ''
          );
        }

        return row;
      });

      const csvContent = [csvHeaders, ...csvData]
        .map((row: any) => {
          return row.map((field: any) => {
            return `"${field}"`;
          }).join(',');
        })
        .join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="register_${registerId}_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);
    } else {
      // Generate PDF
      const doc = new PDFDocument({ margin: 50 });
      
      // Set response headers for PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="register_${registerId}_${new Date().toISOString().split('T')[0]}.pdf"`);
      
      // Pipe PDF to response
      doc.pipe(res);
      
      // Header
      doc.fontSize(20).text('Attendance Register', { align: 'center' });
      doc.moveDown();
      
      // Register Information
      doc.fontSize(14).text('Register Information', { underline: true });
      doc.moveDown(0.5);
      
      doc.fontSize(12)
        .text(`Activity: ${register.session?.activity?.title || 'Unknown'}`, { indent: 20 })
        .text(`Venue: ${register.session?.activity?.venue?.name || 'No venue'}`, { indent: 20 })
        .text(`Date: ${new Date(register.date).toLocaleDateString('en-GB')}`, { indent: 20 })
        .text(`Time: ${register.session?.startTime || 'Not specified'}`, { indent: 20 });
      
      if (register.session?.activity?.venue?.address) {
        doc.text(`Address: ${register.session.activity.venue.address}`, { indent: 20 });
      }
      
      doc.moveDown();
      
      // Attendance Summary
      const totalChildren = register.attendance.length;
      const presentCount = register.attendance.filter((att: any) => att.present).length;
      const absentCount = totalChildren - presentCount;
      
      doc.fontSize(14).text('Attendance Summary', { underline: true });
      doc.moveDown(0.5);
      
      doc.fontSize(12)
        .text(`Total Children: ${totalChildren}`, { indent: 20 })
        .text(`Present: ${presentCount}`, { indent: 20 })
        .text(`Absent: ${absentCount}`, { indent: 20 });
      
      doc.moveDown();
      
      // Children Details
      doc.fontSize(14).text('Children Details', { underline: true });
      doc.moveDown(0.5);
      
      register.attendance.forEach((att: any, index: number) => {
        const child = att.child;
        const booking = att.booking;
        
        // Child name and basic info
        doc.fontSize(12).text(`${index + 1}. ${child.firstName} ${child.lastName}`, { indent: 20 });
        
        // Attendance status
        const statusColor = att.present ? '#22c55e' : '#ef4444';
        doc.fillColor(statusColor)
          .text(`Status: ${att.present ? 'Present' : 'Absent'}`, { indent: 40 })
          .fillColor('black');
        
        // Parent information
        doc.text(`Parent: ${booking.parent.firstName} ${booking.parent.lastName}`, { indent: 40 });
        doc.text(`Email: ${booking.parent.email}`, { indent: 40 });
        doc.text(`Phone: ${booking.parent.phone}`, { indent: 40 });
        
        // Check-in/out times
        if (att.checkInTime) {
          doc.text(`Check-in: ${new Date(att.checkInTime).toLocaleString()}`, { indent: 40 });
        }
        if (att.checkOutTime) {
          doc.text(`Check-out: ${new Date(att.checkOutTime).toLocaleString()}`, { indent: 40 });
        }
        
        // Basic information
        if (includeBasicInfo) {
          if (child.dateOfBirth) {
            doc.text(`Date of Birth: ${new Date(child.dateOfBirth).toLocaleDateString()}`, { indent: 40 });
          }
          if (child.yearGroup) {
            doc.text(`Year Group: ${child.yearGroup}`, { indent: 40 });
          }
          if (child.school) {
            doc.text(`School: ${child.school}`, { indent: 40 });
          }
          if (child.class) {
            doc.text(`Class: ${child.class}`, { indent: 40 });
          }
        }
        
        // Medical information
        if (includeMedicalInfo) {
          if (child.allergies) {
            doc.text(`Allergies: ${child.allergies}`, { indent: 40 });
          }
          if (child.medicalInfo) {
            doc.text(`Medical Info: ${child.medicalInfo}`, { indent: 40 });
          }
        }
        
        // Permissions
        if (includePermissions && child.permissions) {
          doc.text('Permissions:', { indent: 40 });
          doc.text(`  • Walk Home Alone: ${child.permissions.consentToWalkHome ? 'Yes' : 'No'}`, { indent: 60 });
          doc.text(`  • Photo Permission: ${child.permissions.consentToPhotography ? 'Yes' : 'No'}`, { indent: 60 });
          doc.text(`  • First Aid Consent: ${child.permissions.consentToFirstAid ? 'Yes' : 'No'}`, { indent: 60 });
          doc.text(`  • Emergency Contact Consent: ${child.permissions.consentToEmergencyContact ? 'Yes' : 'No'}`, { indent: 60 });
        }
        
        // Booking options
        if (includeBookingOptions) {
          if (booking.hasEarlyDropoff) {
            doc.text(`Early Drop-off: Yes (${booking.earlyDropoffAmount ? `£${booking.earlyDropoffAmount}` : 'Amount not specified'})`, { indent: 40 });
          }
          if (booking.hasLatePickup) {
            doc.text(`Late Pick-up: Yes (${booking.latePickupAmount ? `£${booking.latePickupAmount}` : 'Amount not specified'})`, { indent: 40 });
          }
        }
        
        // Notes
        if (att.notes) {
          doc.text(`Notes: ${att.notes}`, { indent: 40 });
        }
        
        doc.moveDown(0.5);
        
        // Add page break if needed
        if (doc.y > 700) {
          doc.addPage();
        }
      });
      
      // Footer
      doc.moveDown(2);
      doc.fontSize(10)
        .text(`Generated on ${new Date().toLocaleString()}`, { align: 'center' })
        .text('BookOn System - Attendance Register', { align: 'center' });
      
      // Finalize PDF
      doc.end();
      
      // PDF is streamed directly to response, no need to return
    }

  } catch (error) {
    logger.error('Error exporting register:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to export register', 500, 'EXPORT_ERROR');
  }
}));

// Export all registers for a course (all dates)
router.get('/export-course/:activityId', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const { activityId } = req.params;
    const { format = 'csv' } = req.query;

    if (!['csv', 'excel', 'pdf'].includes(format as string)) {
      throw new AppError('Export format must be csv, excel, or pdf', 400, 'INVALID_FORMAT');
    }

    // Get all registers for this activity/course
    const registers = await safePrismaQuery(async (client) => {
      return await client.register.findMany({
        where: {
          session: {
            activityId: activityId as string
          }
        },
        include: {
          session: {
            include: {
              activity: {
                select: {
                  title: true,
                  description: true,
                  venue: {
                    select: {
                      name: true,
                      address: true
                    }
                  }
                }
              }
            }
          },
          attendance: {
            include: {
              child: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  dateOfBirth: true,
                  yearGroup: true,
                  school: true,
                  class: true,
                  allergies: true,
                  medicalInfo: true
                }
              },
              booking: {
                select: {
                  id: true,
                  parent: {
                    select: {
                      firstName: true,
                      lastName: true,
                      email: true,
                      phone: true
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'asc'
        }
      });
    });

    if (registers.length === 0) {
      throw new AppError('No registers found for this activity', 404, 'NO_REGISTERS_FOUND');
    }

    const activity = registers[0].session.activity;

    if (format === 'csv') {
      // Generate CSV with all dates
      const csvHeaders = [
        'Date',
        'Session Time',
        'Child Name',
        'Parent Name',
        'Parent Email',
        'Parent Phone',
        'Present',
        'Check In Time',
        'Check Out Time',
        'Date of Birth',
        'Year Group',
        'School',
        'Class',
        'Allergies',
        'Medical Info',
        'Notes'
      ];

      const csvData: any[] = [];
      
      registers.forEach(register => {
        const sessionTime = register.session.startTime || '';
        register.attendance.forEach((att: any) => {
          csvData.push([
            new Date(register.createdAt).toLocaleDateString(),
            sessionTime,
            `${att.child.firstName} ${att.child.lastName}`,
            `${att.booking.parent.firstName} ${att.booking.parent.lastName}`,
            att.booking.parent.email,
            att.booking.parent.phone || '',
            att.present ? 'Yes' : 'No',
            att.checkInTime ? new Date(att.checkInTime).toLocaleString() : '',
            att.checkOutTime ? new Date(att.checkOutTime).toLocaleString() : '',
            att.child.dateOfBirth ? new Date(att.child.dateOfBirth).toLocaleDateString() : '',
            att.child.yearGroup || '',
            att.child.school || '',
            att.child.class || '',
            att.child.allergies || '',
            att.child.medicalInfo || '',
            att.notes || ''
          ]);
        });
      });

      const csvContent = [csvHeaders, ...csvData]
        .map((row: any) => {
          return row.map((field: any) => `"${String(field)}"`).join(',');
        })
        .join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="course_registers_${activityId}_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);

    } else if (format === 'excel') {
      // For Excel format, we'll generate a CSV-like format that Excel can open
      // In production, you'd use a library like 'xlsx' to generate actual Excel files
      const csvHeaders = [
        'Date',
        'Session Time',
        'Child Name',
        'Parent Name',
        'Parent Email',
        'Parent Phone',
        'Present',
        'Check In Time',
        'Check Out Time',
        'Date of Birth',
        'Year Group',
        'School',
        'Class',
        'Allergies',
        'Medical Info',
        'Notes'
      ];

      const csvData: any[] = [];
      
      registers.forEach(register => {
        const sessionTime = register.session.startTime || '';
        register.attendance.forEach((att: any) => {
          csvData.push([
            new Date(register.createdAt).toLocaleDateString(),
            sessionTime,
            `${att.child.firstName} ${att.child.lastName}`,
            `${att.booking.parent.firstName} ${att.booking.parent.lastName}`,
            att.booking.parent.email,
            att.booking.parent.phone || '',
            att.present ? 'Yes' : 'No',
            att.checkInTime ? new Date(att.checkInTime).toLocaleString() : '',
            att.checkOutTime ? new Date(att.checkOutTime).toLocaleString() : '',
            att.child.dateOfBirth ? new Date(att.child.dateOfBirth).toLocaleDateString() : '',
            att.child.yearGroup || '',
            att.child.school || '',
            att.child.class || '',
            att.child.allergies || '',
            att.child.medicalInfo || '',
            att.notes || ''
          ]);
        });
      });

      const csvContent = [csvHeaders, ...csvData]
        .map((row: any) => {
          return row.map((field: any) => `"${String(field)}"`).join(',');
        })
        .join('\n');

      res.setHeader('Content-Type', 'application/vnd.ms-excel');
      res.setHeader('Content-Disposition', `attachment; filename="course_registers_${activityId}_${new Date().toISOString().split('T')[0]}.xls"`);
      res.send(csvContent);

    } else {
      // PDF format - basic implementation
      // In production, you'd use a library like 'pdfkit' for better formatting
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument({ margin: 50 });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="course_registers_${activityId}_${new Date().toISOString().split('T')[0]}.pdf"`);

      doc.pipe(res);

      // Add title
      doc.fontSize(18).text(`Course Attendance Register: ${activity.title}`, { align: 'center' });
      doc.moveDown(2);

      // Add course information
      doc.fontSize(12).text(`Activity: ${activity.title}`);
      doc.text(`Venue: ${activity.venue.name}`);
      doc.text(`Address: ${activity.venue.address || 'N/A'}`);
      doc.moveDown(2);

      // Add registers for each date
      registers.forEach((register, index) => {
        if (index > 0) doc.addPage();
        
        doc.fontSize(14).text(`Date: ${new Date(register.createdAt).toLocaleDateString()}`);
        doc.fontSize(10).text(`Session Time: ${register.session.startTime || 'N/A'}`);
        doc.moveDown();

        // Table header
        const tableTop = doc.y;
        doc.fontSize(10);
        doc.text('Child Name', 50, doc.y);
        doc.text('Parent Contact', 150, doc.y);
        doc.text('Present', 350, doc.y);
        doc.text('Check In', 420, doc.y);
        
        // Horizontal line
        doc.moveTo(50, doc.y + 5)
           .lineTo(550, doc.y + 5)
           .stroke();

        doc.y += 10;

        // Add attendance records
        register.attendance.forEach((att: any) => {
          doc.text(`${att.child.firstName} ${att.child.lastName}`, 50, doc.y);
          doc.text(`${att.booking.parent.email}`, 150, doc.y);
          doc.text(att.present ? 'Yes' : 'No', 350, doc.y);
          doc.text(att.checkInTime ? new Date(att.checkInTime).toLocaleTimeString() : '-', 420, doc.y);
          
          doc.y += 20;
          
          if (doc.y > 700) {
            doc.addPage();
          }
        });
      });

      doc.end();
    }

  } catch (error) {
    logger.error('Error exporting course registers:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to export course registers', 500, 'COURSE_EXPORT_ERROR');
  }
}));

export default router;