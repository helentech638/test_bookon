import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticateToken, requireRole } from '../middleware/auth';
import { safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';
import { registerService } from '../services/registerService';

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
      limit = '20'
    } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

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
            },
            attendance: {
              include: {
                child: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true
                  }
                },
                booking: {
                  select: {
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
          orderBy: { date: 'desc' }
        } as any);
      }),
      safePrismaQuery(async (client) => {
        return await client.register.count({ where });
      })
    ]);

    // Transform the data to match the expected frontend format
    const transformedRegisters = registers.map((register: any) => ({
      id: register.id,
      date: register.date,
      status: register.status,
      notes: register.notes,
      capacity: register.session?.activity?.capacity || 0,
      presentCount: register.attendance?.filter((a: any) => a.present).length || 0,
      totalCount: register.attendance?.length || 0,
      session: {
        id: register.session?.id,
        startTime: register.session?.startTime,
        endTime: register.session?.endTime,
        activity: {
          title: register.session?.activity?.title,
          type: register.session?.activity?.type || 'Other',
          venue: {
            name: register.session?.activity?.venue?.name,
            address: register.session?.activity?.venue?.address
          }
        }
      },
      attendance: register.attendance?.map((att: any) => ({
        id: att.id,
        present: att.present,
        checkInTime: att.checkInTime,
        checkOutTime: att.checkOutTime,
        notes: att.notes,
        child: {
          id: att.child?.id,
          firstName: att.child?.firstName,
          lastName: att.child?.lastName
        },
        booking: {
          parent: {
            firstName: att.booking?.parent?.firstName,
            lastName: att.booking?.parent?.lastName,
            email: att.booking?.parent?.email,
            phone: att.booking?.parent?.phone
          }
        }
      })) || []
    }));

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
    
    const register = await registerService.getRegister(id as string);
    
    if (!register) {
      throw new AppError('Register not found', 404, 'REGISTER_NOT_FOUND');
    }

    res.json({
      success: true,
      data: register
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

export default router;