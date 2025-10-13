import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticateToken, optionalAuth, requireRole } from '../middleware/auth';
import { prisma, safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';
import { activityService } from '../services/activityService';

const router = Router();

// Get all activities
router.get('/', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '20',
      search,
      // type, // Field doesn't exist in Activity model
      venueId,
      status,
      dateFrom,
      dateTo
    } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    
    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } }
      ];
    }
    
    // Note: type field doesn't exist in Activity model
    if (venueId) where.venueId = venueId;
    if (status) where.status = status;
    
    if (dateFrom || dateTo) {
      where.startDate = {};
      if (dateFrom) where.startDate.gte = new Date(dateFrom as string);
      if (dateTo) where.startDate.lte = new Date(dateTo as string);
    }

    const [activities, total] = await Promise.all([
      safePrismaQuery(async (client) => {
        return await client.activity.findMany({
          where,
          include: {
            venue: {
              select: { name: true, city: true, address: true }
            },
            holidayTimeSlots: true,
            sessionBlocks: true,
            bookings: {
              where: { status: 'confirmed' },
              select: { id: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum
        });
      }),
      safePrismaQuery(async (client) => {
        return await client.activity.count({ where });
      })
    ]);

    // Transform activities data to match frontend expectations
    const transformedActivities = activities.map((activity: any) => {
      // Calculate durationWeeks for Course/Program activities
      let calculatedDurationWeeks = activity.durationWeeks;
      
      if (activity.type === 'course/program' && !calculatedDurationWeeks && activity.startDate && activity.endDate) {
        const startDate = new Date(activity.startDate);
        const endDate = new Date(activity.endDate);
        let totalSessions = 0;
        
        if (activity.daysOfWeek && activity.daysOfWeek.length > 0) {
          // Calculate sessions based on selected days of week
          activity.daysOfWeek.forEach((dayName: string) => {
            const capitalizedDayName = dayName.charAt(0).toUpperCase() + dayName.slice(1);
            const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(capitalizedDayName);
            
            if (dayOfWeek !== -1) {
              const firstSessionDate = new Date(startDate);
              const daysUntilFirstSession = (dayOfWeek - startDate.getDay() + 7) % 7;
              firstSessionDate.setDate(startDate.getDate() + daysUntilFirstSession);
              
              if (firstSessionDate < startDate) {
                firstSessionDate.setDate(firstSessionDate.getDate() + 7);
              }
              
              let currentSessionDate = new Date(firstSessionDate);
              while (currentSessionDate <= endDate) {
                const dateString = currentSessionDate.toISOString().split('T')[0];
                if (!activity.courseExcludeDates || !activity.courseExcludeDates.includes(dateString)) {
                  totalSessions++;
                }
                currentSessionDate.setDate(currentSessionDate.getDate() + 7);
              }
            }
          });
        } else {
          // Fallback: calculate total weeks between start and end date
          const timeDiff = endDate.getTime() - startDate.getTime();
          const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
          totalSessions = Math.ceil(daysDiff / 7);
        }
        
        calculatedDurationWeeks = totalSessions;
      }

      return {
        id: activity.id,
        title: activity.title,
        description: activity.description,
        type: activity.type,
        venue_id: activity.venueId,
        venue_name: activity.venue.name,
        venue_city: activity.venue.city,
        venue_address: activity.venue.address,
        start_date: activity.startDate,
        end_date: activity.endDate,
        start_time: activity.startTime,
        end_time: activity.endTime,
        price: activity.price,
        max_capacity: activity.capacity,
        current_capacity: activity.bookings.length,
        is_active: activity.isActive,
        status: activity.status,
        // Course/Program specific fields
        durationWeeks: calculatedDurationWeeks,
        duration_weeks: calculatedDurationWeeks,
        regularDay: activity.regularDay,
        regular_day: activity.regularDay,
        regularTime: activity.regularTime,
        regular_time: activity.regularTime,
        daysOfWeek: activity.daysOfWeek,
        courseExcludeDates: activity.courseExcludeDates,
        // Holiday Club specific fields
        ageRange: activity.ageRange,
        whatToBring: activity.whatToBring,
        earlyDropoff: activity.earlyDropoff,
        earlyDropoffPrice: activity.earlyDropoffPrice,
        latePickup: activity.latePickup,
        latePickupPrice: activity.latePickupPrice,
        siblingDiscount: activity.siblingDiscount,
        bulkDiscount: activity.bulkDiscount,
        weeklyDiscount: activity.weeklyDiscount,
        holidayTimeSlots: activity.holidayTimeSlots,
        // Wraparound Care specific fields
        isWraparoundCare: activity.isWraparoundCare,
        yearGroups: activity.yearGroups,
        sessionBlocks: activity.sessionBlocks,
        // Other fields
        proRataBooking: activity.proRataBooking,
        holidaySessions: activity.holidaySessions,
        imageUrls: activity.imageUrls || [],
        createdAt: activity.createdAt,
        updatedAt: activity.updatedAt
      };
    });

    res.json({
      success: true,
      data: transformedActivities,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    logger.error('Error fetching activities:', error);
    throw new AppError('Failed to fetch activities', 500, 'ACTIVITIES_FETCH_ERROR');
  }
}));

// Get upcoming activities
router.get('/upcoming', authenticateToken, requireRole(['admin']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { limit = '5' } = req.query;
    const userId = req.user!.id;
    
    logger.info('Upcoming activities requested', { 
      user: req.user?.email,
      limit,
      userId 
    });

    const upcomingActivities = await safePrismaQuery(async () => {
      const now = new Date();
      
      const activities = await prisma.activity.findMany({
        where: {
          startDate: { gte: now },
          status: 'active'
        },
        include: {
          venue: {
            select: {
              id: true,
              name: true,
              address: true
            }
          },
          bookings: {
            select: {
              id: true,
              status: true
            }
          }
        },
        orderBy: {
          startDate: 'asc'
        },
        take: parseInt(limit as string) || 5
      });

      return activities.map(activity => ({
        id: activity.id,
        name: activity.title,
        description: activity.description,
        startTime: activity.startDate,
        endTime: activity.endDate,
        capacity: activity.capacity,
        currentBookings: activity.bookings.filter((b: any) => b.status === 'confirmed').length,
        venue: activity.venue,
        status: activity.status
      }));
    });

    logger.info('Upcoming activities data retrieved', { 
      count: upcomingActivities.length
    });

    res.json({
      success: true,
      data: upcomingActivities
    });
  } catch (error) {
    logger.error('Error fetching upcoming activities:', error);
    throw new AppError('Failed to fetch upcoming activities', 500, 'UPCOMING_ACTIVITIES_ERROR');
  }
}));

// Get single activity (public - no auth required for viewing)
router.get('/:id', optionalAuth, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new AppError('Activity ID is required', 400, 'MISSING_ACTIVITY_ID');
    }

    const activity = await safePrismaQuery(async (client) => {
      return await client.activity.findUnique({
        where: { id },
        include: {
          venue: {
            select: { 
              name: true, 
              city: true, 
              address: true,
              capacity: true,
              phone: true,
              email: true
            }
          },
          holidayTimeSlots: true,
          sessionBlocks: true,
          sessions: {
            where: { status: 'scheduled' },
            orderBy: { date: 'asc' },
            include: {
              sessionBlocks: {
                where: { isActive: true },
                orderBy: { startTime: 'asc' },
                include: {
                  _count: {
                    select: {
                      bookings: {
                        where: {
                          status: {
                            in: ['confirmed', 'pending']
                          }
                        }
                      }
                    }
                  }
                }
              },
              holidayTimeSlots: {
                where: { isActive: true },
                orderBy: { startTime: 'asc' },
                include: {
                  _count: {
                    select: {
                      bookings: {
                        where: {
                          status: {
                            in: ['confirmed', 'pending']
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          } as any,
          bookings: {
            include: {
              child: {
                select: { firstName: true, lastName: true, yearGroup: true }
              },
              parent: {
                select: { firstName: true, lastName: true, email: true }
              }
            },
            orderBy: { createdAt: 'desc' }
          }
        } as any
      });
    });

    if (!activity) {
      throw new AppError('Activity not found', 404, 'ACTIVITY_NOT_FOUND');
    }

    // Transform sessions to include holiday time slots for holiday club activities
    const transformedSessions = (activity as any).sessions.map((session: any) => ({
      id: session.id,
      date: session.date.toISOString().split('T')[0],
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,
      capacity: session.capacity,
      bookingsCount: session.bookingsCount,
      sessionBlocks: session.sessionBlocks.map((block: any) => ({
        id: block.id,
        name: block.name,
        startTime: block.startTime,
        endTime: block.endTime,
        capacity: block.capacity,
        price: block.price,
        bookingsCount: block._count.bookings
      })),
      holidayTimeSlots: session.holidayTimeSlots.map((slot: any) => ({
        id: slot.id,
        name: slot.name,
        startTime: slot.startTime,
        endTime: slot.endTime,
        price: slot.price,
        capacity: slot.capacity,
        bookingsCount: slot._count.bookings
      }))
    }));

    // Calculate durationWeeks for Course/Program activities
    let calculatedDurationWeeks = (activity as any).durationWeeks;
    
    if ((activity as any).type === 'course/program' && !calculatedDurationWeeks && (activity as any).startDate && (activity as any).endDate) {
      const startDate = new Date((activity as any).startDate);
      const endDate = new Date((activity as any).endDate);
      let totalSessions = 0;
      
      if ((activity as any).daysOfWeek && (activity as any).daysOfWeek.length > 0) {
        // Calculate sessions based on selected days of week
        (activity as any).daysOfWeek.forEach((dayName: string) => {
          const capitalizedDayName = dayName.charAt(0).toUpperCase() + dayName.slice(1);
          const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(capitalizedDayName);
          
          if (dayOfWeek !== -1) {
            const firstSessionDate = new Date(startDate);
            const daysUntilFirstSession = (dayOfWeek - startDate.getDay() + 7) % 7;
            firstSessionDate.setDate(startDate.getDate() + daysUntilFirstSession);
            
            if (firstSessionDate < startDate) {
              firstSessionDate.setDate(firstSessionDate.getDate() + 7);
            }
            
            let currentSessionDate = new Date(firstSessionDate);
            while (currentSessionDate <= endDate) {
              const dateString = currentSessionDate.toISOString().split('T')[0];
              if (!(activity as any).courseExcludeDates || !(activity as any).courseExcludeDates.includes(dateString)) {
                totalSessions++;
              }
              currentSessionDate.setDate(currentSessionDate.getDate() + 7);
            }
          }
        });
      } else {
        // Fallback: calculate total weeks between start and end date
        const timeDiff = endDate.getTime() - startDate.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
        totalSessions = Math.ceil(daysDiff / 7);
      }
      
      calculatedDurationWeeks = totalSessions;
    }

    res.json({
      success: true,
      data: {
        ...activity,
        // Course/Program specific fields
        daysOfWeek: (activity as any).daysOfWeek || [],
        start_time: (activity as any).startTime || (activity as any).start_time,
        end_time: (activity as any).endTime || (activity as any).end_time,
        durationWeeks: calculatedDurationWeeks,
        duration_weeks: calculatedDurationWeeks,
        regularDay: (activity as any).regularDay,
        regular_day: (activity as any).regularDay,
        regularTime: (activity as any).regularTime,
        regular_time: (activity as any).regularTime,
        courseExcludeDates: (activity as any).courseExcludeDates || [],
        sessions: transformedSessions,
        currency: (activity as any).currency || 'GBP' // Add default currency if not present
      }
    });
  } catch (error) {
    logger.error('Error fetching activity:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch activity', 500, 'ACTIVITY_FETCH_ERROR');
  }
}));

// Create new activity
router.post('/', authenticateToken, requireRole(['admin', 'coordinator']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const {
      title,
      type,
      venueId,
      description,
      startDate,
      endDate,
      startTime,
      endTime,
      capacity,
      price,
      earlyDropoff,
      earlyDropoffPrice,
      latePickup,
      latePickupPrice,
      generateSessions,
      excludeDates,
      // Wraparound Care fields
      isWraparoundCare,
      yearGroups,
      sessionBlocks
    } = req.body;

    // Validate required fields
    if (!title || !type || !venueId || !startDate || !endDate || !startTime || !endTime) {
      throw new AppError('Missing required fields', 400, 'MISSING_REQUIRED_FIELDS');
    }

    // Validate venue exists
    const venue = await safePrismaQuery(async (client) => {
      return await client.venue.findUnique({
        where: { id: venueId }
      });
    });

    if (!venue) {
      throw new AppError('Venue not found', 404, 'VENUE_NOT_FOUND');
    }

    // Create activity with sessions using the service
    const activityData = {
      title,
      type,
      venueId,
      description,
      capacity: capacity ? parseInt(capacity) : null,
      price: price ? parseFloat(price) : 0,
      createdBy: req.user!.id,
      // Wraparound Care fields
      isWraparoundCare: isWraparoundCare || false,
      yearGroups: yearGroups || [],
      sessionBlocks: sessionBlocks || []
    };

    const sessionOptions = {
      activityId: '', // Will be set by service
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      startTime,
      endTime,
      excludeDates: excludeDates || [],
      generateSessions: generateSessions || false
    };

    const holidayOptions = type === 'holiday' ? {
      earlyDropoff: earlyDropoff || false,
      earlyDropoffPrice: earlyDropoffPrice ? parseFloat(earlyDropoffPrice) : 0,
      latePickup: latePickup || false,
      latePickupPrice: latePickupPrice ? parseFloat(latePickupPrice) : 0
    } : undefined;

    const activity = await activityService.createActivityWithSessions(
      activityData,
      sessionOptions,
      holidayOptions
    );

    logger.info('Activity created', {
      activityId: activity.id,
      title: activity.title,
      createdBy: req.user!.id
    });

    res.status(201).json({
      success: true,
      message: 'Activity created successfully',
      data: activity
    });
  } catch (error) {
    logger.error('Error creating activity:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to create activity', 500, 'ACTIVITY_CREATE_ERROR');
  }
}));

// Update activity
router.put('/:id', authenticateToken, requireRole(['admin', 'coordinator']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      title,
      type,
      venueId,
      description,
      startDate,
      endDate,
      startTime,
      endTime,
      capacity,
      price,
      earlyDropoff,
      earlyDropoffPrice,
      latePickup,
      latePickupPrice,
      status
    } = req.body;

    if (!id) {
      throw new AppError('Activity ID is required', 400, 'MISSING_ACTIVITY_ID');
    }

    const activity = await safePrismaQuery(async (client) => {
      return await client.activity.update({
        where: { id },
        data: {
          ...(title && { title }),
          ...(type && { type }),
          ...(venueId && { venueId }),
          ...(description !== undefined && { description }),
          ...(startDate && { startDate: new Date(startDate) }),
          ...(endDate && { endDate: new Date(endDate) }),
          ...(startTime && { startTime }),
          ...(endTime && { endTime }),
          ...(capacity !== undefined && { capacity: capacity ? parseInt(capacity) : null }),
          ...(price !== undefined && { price: parseFloat(price) }),
          ...(earlyDropoff !== undefined && { earlyDropoff }),
          ...(earlyDropoffPrice !== undefined && { earlyDropoffPrice: earlyDropoffPrice ? parseFloat(earlyDropoffPrice) : null }),
          ...(latePickup !== undefined && { latePickup }),
          ...(latePickupPrice !== undefined && { latePickupPrice: latePickupPrice ? parseFloat(latePickupPrice) : null }),
          ...(status && { status })
        },
        include: {
          venue: {
            select: { name: true, city: true, address: true }
          }
        }
      });
    });

    logger.info('Activity updated', {
      activityId: activity.id,
      title: activity.title,
      updatedBy: req.user!.id
    });

    res.json({
      success: true,
      message: 'Activity updated successfully',
      data: activity
    });
  } catch (error: any) {
    logger.error('Error updating activity:', error);
    if (error.code === 'P2025') {
      throw new AppError('Activity not found', 404, 'ACTIVITY_NOT_FOUND');
    }
    throw new AppError('Failed to update activity', 500, 'ACTIVITY_UPDATE_ERROR');
  }
}));

// Delete activity
router.delete('/:id', authenticateToken, requireRole(['admin']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new AppError('Activity ID is required', 400, 'MISSING_ACTIVITY_ID');
    }

    await safePrismaQuery(async (client) => {
      return await client.activity.delete({
        where: { id }
      });
    });

    logger.info('Activity deleted', {
      activityId: id,
      deletedBy: req.user!.id
    });

    res.json({
      success: true,
      message: 'Activity deleted successfully'
    });
  } catch (error: any) {
    logger.error('Error deleting activity:', error);
    if (error.code === 'P2025') {
      throw new AppError('Activity not found', 404, 'ACTIVITY_NOT_FOUND');
    }
    throw new AppError('Failed to delete activity', 500, 'ACTIVITY_DELETE_ERROR');
  }
}));

export default router;