import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import { prisma, safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';

const router = Router();

// Get business registers
router.get('/', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { search, status, page = 1, limit = 20 } = req.query;
  
  try {
    // Check if user has business access
    const userInfo = await safePrismaQuery(async (client) => {
      return await client.user.findUnique({
        where: { id: userId },
        select: { role: true, businessName: true, isActive: true }
      });
    });

    if (!userInfo || (!userInfo.businessName && userInfo.role !== 'business' && userInfo.role !== 'admin')) {
      throw new AppError('Business access required', 403, 'BUSINESS_ACCESS_REQUIRED');
    }

    // Get user's venues
    const venues = await safePrismaQuery(async (client) => {
      return await client.venue.findMany({
        where: { ownerId: userId },
        select: { id: true }
      });
    });

    const venueIds = venues.map(v => v.id);

    // Build where clause for registers
    const where: any = {
      session: {
        activity: {
          venueId: { in: venueIds }
        }
      }
    };

    if (search) {
      where.OR = [
        { 
          session: {
            activity: {
              title: { contains: search as string, mode: 'insensitive' }
            }
          }
        },
        { 
          session: {
            activity: {
              venue: {
                name: { contains: search as string, mode: 'insensitive' }
              }
            }
          }
        }
      ];
    }

    if (status) {
      where.status = status;
    }

    // Get registers with pagination
    const skip = (Number(page) - 1) * Number(limit);
    
    const [registers, totalCount] = await safePrismaQuery(async (client) => {
      const result = await Promise.all([
        client.register.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { date: 'desc' },
          select: {
            id: true,
            date: true,
            status: true,
            notes: true,
            createdAt: true,
            updatedAt: true,
            session: {
              select: {
                id: true,
                date: true,
                startTime: true,
                endTime: true,
                capacity: true,
                bookingsCount: true,
                activity: {
                  select: {
                    id: true,
                    title: true,
                    type: true,
                    capacity: true,
                    venue: {
                      select: {
                        id: true,
                        name: true
                      }
                    }
                  }
                }
              }
            },
            attendance: {
              select: {
                id: true,
                present: true
              }
            },
            _count: {
              select: {
                attendance: true
              }
            }
          }
        }),
        client.register.count({ where })
      ]);
      
      logger.info(`Business registers query result: ${result[0].length} registers found for user ${userId}`, {
        userId,
        venueIds,
        whereClause: where,
        registersFound: result[0].length,
        totalCount: result[1]
      });
      
      return result;
    });

    // Get summary statistics
    const stats = await safePrismaQuery(async (client) => {
      const [totalRegisters, upcoming, inProgress, completed, cancelled] = await Promise.all([
        client.register.count({ where }),
        client.register.count({ 
          where: { 
            ...where,
            status: 'upcoming' 
          } 
        }),
        client.register.count({ 
          where: { 
            ...where,
            status: 'in-progress' 
          } 
        }),
        client.register.count({ 
          where: { 
            ...where,
            status: 'completed' 
          } 
        }),
        client.register.count({ 
          where: { 
            ...where,
            status: 'cancelled' 
          } 
        })
      ]);

      return { totalRegisters, upcoming, inProgress, completed, cancelled };
    });

    // Transform registers to include capacity and attendance count
    const transformedRegisters = registers.map(reg => ({
      ...reg,
      attendees: reg.attendance || [],
      totalCapacity: reg.session?.capacity || reg.session?.activity?.capacity || 0,
      registeredCount: reg.attendance?.length || 0,
      presentCount: reg.attendance?.filter((att: any) => att.present)?.length || 0
    }));

    res.json({
      success: true,
      data: {
        registers: transformedRegisters,
        stats,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / Number(limit))
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching business registers:', error);
    throw new AppError('Failed to fetch registers', 500, 'REGISTERS_FETCH_ERROR');
  }
}));

// Get single register
router.get('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  
  try {
    // Check if user has business access
    const userInfo = await safePrismaQuery(async (client) => {
      return await client.user.findUnique({
        where: { id: userId },
        select: { role: true, businessName: true, isActive: true }
      });
    });

    if (!userInfo || (!userInfo.businessName && userInfo.role !== 'business' && userInfo.role !== 'admin')) {
      throw new AppError('Business access required', 403, 'BUSINESS_ACCESS_REQUIRED');
    }

    // Get user's venues
    const venues = await safePrismaQuery(async (client) => {
      return await client.venue.findMany({
        where: { ownerId: userId },
        select: { id: true }
      });
    });

    const venueIds = venues.map(v => v.id);

    const register = await safePrismaQuery(async (client) => {
      return await client.register.findFirst({
        where: { 
          id,
          session: {
            activity: {
              venueId: { in: venueIds }
            }
          }
        },
        select: {
          id: true,
          date: true,
          status: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          session: {
            select: {
              id: true,
              date: true,
              startTime: true,
              endTime: true,
              capacity: true,
              bookingsCount: true,
              activity: {
                select: {
                  id: true,
                  title: true,
                  type: true,
                  description: true,
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
            select: {
              id: true,
              present: true,
              checkInTime: true,
              checkOutTime: true,
              notes: true,
              child: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  dateOfBirth: true
                }
              },
              booking: {
                select: {
                  id: true,
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
        }
      });
    });

    if (!register) {
      throw new AppError('Register not found', 404, 'REGISTER_NOT_FOUND');
    }

    res.json({
      success: true,
      data: register
    });

  } catch (error) {
    logger.error('Error fetching register:', error);
    throw new AppError('Failed to fetch register', 500, 'REGISTER_FETCH_ERROR');
  }
}));

// Create register
router.post('/', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { sessionId, date, status = 'upcoming', notes } = req.body;
  
  try {
    // Check if user has business access
    const userInfo = await safePrismaQuery(async (client) => {
      return await client.user.findUnique({
        where: { id: userId },
        select: { role: true, businessName: true, isActive: true }
      });
    });

    if (!userInfo || (!userInfo.businessName && userInfo.role !== 'business' && userInfo.role !== 'admin')) {
      throw new AppError('Business access required', 403, 'BUSINESS_ACCESS_REQUIRED');
    }

    // Validate required fields
    if (!sessionId || !date) {
      throw new AppError('Session ID and date are required', 400, 'VALIDATION_ERROR');
    }

    // Check if session exists and belongs to user's venue
    const session = await safePrismaQuery(async (client) => {
      return await client.session.findFirst({
        where: { 
          id: sessionId,
          activity: {
            venue: {
              ownerId: userId
            }
          }
        },
        select: {
          id: true,
          activity: {
            select: {
              title: true,
              venue: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      });
    });

    if (!session) {
      throw new AppError('Session not found or access denied', 404, 'SESSION_NOT_FOUND');
    }

    const register = await safePrismaQuery(async (client) => {
      return await client.register.create({
        data: {
          sessionId,
          date: new Date(date),
          status,
          notes
        },
        select: {
          id: true,
          date: true,
          status: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          session: {
            select: {
              id: true,
              date: true,
              startTime: true,
              endTime: true,
              capacity: true,
              bookingsCount: true,
              activity: {
                select: {
                  id: true,
                  title: true,
                  type: true,
                  venue: {
                    select: {
                      id: true,
                      name: true
                    }
                  }
                }
              }
            }
          }
        }
      });
    });

    res.status(201).json({
      success: true,
      data: register
    });

  } catch (error) {
    logger.error('Error creating register:', error);
    throw new AppError('Failed to create register', 500, 'REGISTER_CREATE_ERROR');
  }
}));

// Update register
router.put('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const { date, status, notes } = req.body;
  
  try {
    // Check if user has business access
    const userInfo = await safePrismaQuery(async (client) => {
      return await client.user.findUnique({
        where: { id: userId },
        select: { role: true, businessName: true, isActive: true }
      });
    });

    if (!userInfo || (!userInfo.businessName && userInfo.role !== 'business' && userInfo.role !== 'admin')) {
      throw new AppError('Business access required', 403, 'BUSINESS_ACCESS_REQUIRED');
    }

    // Get user's venues
    const venues = await safePrismaQuery(async (client) => {
      return await client.venue.findMany({
        where: { ownerId: userId },
        select: { id: true }
      });
    });

    const venueIds = venues.map(v => v.id);

    // Check if register exists and belongs to user's venue
    const existingRegister = await safePrismaQuery(async (client) => {
      return await client.register.findFirst({
        where: { 
          id,
          session: {
            activity: {
              venueId: { in: venueIds }
            }
          }
        }
      });
    });

    if (!existingRegister) {
      throw new AppError('Register not found', 404, 'REGISTER_NOT_FOUND');
    }

    const updateData: any = {};
    if (date !== undefined) updateData.date = new Date(date);
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

    const register = await safePrismaQuery(async (client) => {
      return await client.register.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          date: true,
          status: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          session: {
            select: {
              id: true,
              date: true,
              startTime: true,
              endTime: true,
              capacity: true,
              bookingsCount: true,
              activity: {
                select: {
                  id: true,
                  title: true,
                  type: true,
                  venue: {
                    select: {
                      id: true,
                      name: true
                    }
                  }
                }
              }
            }
          }
        }
      });
    });

    res.json({
      success: true,
      data: register
    });

  } catch (error) {
    logger.error('Error updating register:', error);
    throw new AppError('Failed to update register', 500, 'REGISTER_UPDATE_ERROR');
  }
}));

// Save register attendance
router.post('/:id/save', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const { attendance } = req.body;
  
  try {
    // Check if user has business access
    const userInfo = await safePrismaQuery(async (client) => {
      return await client.user.findUnique({
        where: { id: userId },
        select: { role: true, businessName: true, isActive: true }
      });
    });

    if (!userInfo || (!userInfo.businessName && userInfo.role !== 'business' && userInfo.role !== 'admin')) {
      throw new AppError('Business access required', 403, 'BUSINESS_ACCESS_REQUIRED');
    }

    // Get user's venues
    const venues = await safePrismaQuery(async (client) => {
      return await client.venue.findMany({
        where: { ownerId: userId },
        select: { id: true }
      });
    });

    const venueIds = venues.map(v => v.id);

    // Check if register exists and belongs to user's venue
    const existingRegister = await safePrismaQuery(async (client) => {
      return await client.register.findFirst({
        where: { 
          id,
          session: {
            activity: {
              venueId: { in: venueIds }
            }
          }
        }
      });
    });

    if (!existingRegister) {
      throw new AppError('Register not found', 404, 'REGISTER_NOT_FOUND');
    }

    // Update attendance records
    if (attendance && Array.isArray(attendance)) {
      for (const att of attendance) {
        await safePrismaQuery(async (client) => {
          return await client.attendance.updateMany({
            where: {
              id: att.id,
              registerId: id
            },
            data: {
              present: att.present,
              updatedAt: new Date()
            }
          });
        });
      }
    }

    // Update register timestamp
    await safePrismaQuery(async (client) => {
      return await client.register.update({
        where: { id },
        data: {
          updatedAt: new Date()
        }
      });
    });

    logger.info(`Register ${id} attendance saved by user ${userId}`);

    res.json({
      success: true,
      message: 'Register saved successfully',
      data: {
        registerId: id,
        savedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error saving register:', error);
    throw new AppError('Failed to save register', 500, 'REGISTER_SAVE_ERROR');
  }
}));

// Delete register
router.delete('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  
  try {
    // Check if user has business access
    const userInfo = await safePrismaQuery(async (client) => {
      return await client.user.findUnique({
        where: { id: userId },
        select: { role: true, businessName: true, isActive: true }
      });
    });

    if (!userInfo || (!userInfo.businessName && userInfo.role !== 'business' && userInfo.role !== 'admin')) {
      throw new AppError('Business access required', 403, 'BUSINESS_ACCESS_REQUIRED');
    }

    // Get user's venues
    const venues = await safePrismaQuery(async (client) => {
      return await client.venue.findMany({
        where: { ownerId: userId },
        select: { id: true }
      });
    });

    const venueIds = venues.map(v => v.id);

    // Check if register exists and belongs to user's venue
    const existingRegister = await safePrismaQuery(async (client) => {
      return await client.register.findFirst({
        where: { 
          id,
          session: {
            activity: {
              venueId: { in: venueIds }
            }
          }
        },
        include: {
          _count: {
            select: {
              attendance: true
            }
          }
        }
      });
    });

    if (!existingRegister) {
      throw new AppError('Register not found', 404, 'REGISTER_NOT_FOUND');
    }

    // Check if register has attendance records
    if (existingRegister._count.attendance > 0) {
      throw new AppError('Cannot delete register with attendance records', 400, 'REGISTER_HAS_ATTENDANCE');
    }

    await safePrismaQuery(async (client) => {
      return await client.register.delete({
        where: { id }
      });
    });

    res.json({
      success: true,
      message: 'Register deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting register:', error);
    throw new AppError('Failed to delete register', 500, 'REGISTER_DELETE_ERROR');
  }
}));

// Utility endpoint to fix existing course bookings without registers for business users
router.post('/fix-existing-registers', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  
  try {
    // Check if user has business access
    const userInfo = await safePrismaQuery(async (client) => {
      return await client.user.findUnique({
        where: { id: userId },
        select: { role: true, businessName: true, isActive: true }
      });
    });

    if (!userInfo || (!userInfo.businessName && userInfo.role !== 'business' && userInfo.role !== 'admin')) {
      throw new AppError('Business access required', 403, 'BUSINESS_ACCESS_REQUIRED');
    }

    // Get user's venues
    const venues = await safePrismaQuery(async (client) => {
      return await client.venue.findMany({
        where: { ownerId: userId },
        select: { id: true }
      });
    });

    const venueIds = venues.map(v => v.id);

    logger.info(`Starting business register fix for user: ${userId} with venues: ${venueIds.join(', ')}`);
    
    // Find all course bookings for activities owned by this business
    const courseBookings = await safePrismaQuery(async (client) => {
      return await client.booking.findMany({
        where: {
          notes: {
            contains: 'COURSE_BOOKING'
          },
          status: {
            in: ['confirmed', 'pending']
          },
          activity: {
            venueId: { in: venueIds }
          }
        },
        include: {
          activity: {
            select: {
              id: true,
              title: true,
              startDate: true,
              endDate: true,
              regularDay: true,
              regularTime: true,
              durationWeeks: true,
              capacity: true,
              venueId: true
            }
          },
          child: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });
    });

    if (courseBookings.length === 0) {
      return res.json({
        success: true,
        message: 'No course bookings found to fix',
        data: { fixed: 0 }
      });
    }

    let fixedCount = 0;
    const processedActivities = new Set();

    for (const booking of courseBookings) {
      const activity = booking.activity;
      
      // Skip if we've already processed this activity
      if (processedActivities.has(activity.id)) {
        continue;
      }
      
      // Check if registers already exist for this activity
      const existingRegisters = await safePrismaQuery(async (client) => {
        return await client.register.findMany({
          where: {
            session: {
              activityId: activity.id
            }
          }
        });
      });

      if (existingRegisters.length > 0) {
        logger.info(`Registers already exist for activity ${activity.id}, skipping`);
        processedActivities.add(activity.id);
        continue;
      }

      // Create registers for this course activity
      if (activity.regularDay && activity.regularTime && activity.durationWeeks) {
        const startDate = new Date(activity.startDate);
        const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(activity.regularDay);
        
        if (dayOfWeek === -1) {
          logger.warn(`Invalid day of week: ${activity.regularDay} for activity ${activity.id}`);
          continue;
        }

        // Get all children booked for this course
        const courseChildren = courseBookings
          .filter(b => b.activityId === activity.id)
          .map(b => ({
            id: b.childId,
            name: `${b.child.firstName} ${b.child.lastName}`
          }));

        for (let week = 0; week < activity.durationWeeks; week++) {
          const sessionDate = new Date(startDate);
          
          // Calculate the correct date for this week's session
          const daysToAdd = (week * 7) + (dayOfWeek - sessionDate.getDay());
          sessionDate.setDate(sessionDate.getDate() + daysToAdd);
          
          // Skip if this date is in the past
          if (sessionDate < new Date()) {
            continue;
          }

          // Check if session already exists
          let session = await safePrismaQuery(async (client) => {
            return await client.session.findFirst({
              where: {
                activityId: activity.id,
                date: sessionDate
              }
            });
          });

          if (!session) {
            // Create session
            session = await safePrismaQuery(async (client) => {
              return await client.session.create({
                data: {
                  activityId: activity.id,
                  date: sessionDate,
                  startTime: activity.regularTime,
                  endTime: activity.regularTime,
                  capacity: activity.capacity || 20,
                  status: 'scheduled'
                }
              });
            });
            logger.info(`Created session ${session.id} for activity ${activity.id} on ${sessionDate.toISOString().split('T')[0]}`);
          }

          // Check if register already exists for this session
          let register = await safePrismaQuery(async (client) => {
            return await client.register.findFirst({
              where: {
                sessionId: session.id
              }
            });
          });

          if (!register) {
            // Create register
            register = await safePrismaQuery(async (client) => {
              return await client.register.create({
                data: {
                  sessionId: session.id,
                  date: sessionDate,
                  status: 'upcoming',
                  notes: `Course session ${week + 1}/${activity.durationWeeks} - ${courseChildren.map(child => child.name).join(', ')}`
                }
              });
            });
            logger.info(`Created register ${register.id} for session ${session.id} on ${sessionDate.toISOString().split('T')[0]}`);
            fixedCount++;

            // Create attendance records for each child
            for (const child of courseChildren) {
              const childBooking = courseBookings.find(b => 
                b.activityId === activity.id && b.childId === child.id
              );
              
              if (childBooking) {
                await safePrismaQuery(async (client) => {
                  return await client.attendance.create({
                    data: {
                      registerId: register.id,
                      childId: child.id,
                      bookingId: childBooking.id,
                      present: true,
                      notes: `Auto-enrolled in course session ${week + 1}/${activity.durationWeeks} (${child.name})`
                    }
                  });
                });
              }
            }
          }
        }
      }
      
      processedActivities.add(activity.id);
    }

    logger.info(`Business register fix completed: ${fixedCount} registers created for user: ${userId}`);

    res.json({
      success: true,
      message: `Successfully created ${fixedCount} registers for existing course bookings`,
      data: { 
        fixed: fixedCount,
        processedActivities: processedActivities.size,
        totalBookings: courseBookings.length
      }
    });

  } catch (error) {
    logger.error('Error fixing business course registers:', error);
    throw new AppError('Failed to fix course registers', 500, 'REGISTER_FIX_ERROR');
  }
}));

export default router;
