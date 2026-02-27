import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import { safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';
import { activityService } from '../services/activityService';

const router = Router();

router.get('/', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { search, type, venue, status, page = 1, limit = 20 } = req.query;

  try {
    const userInfo = await safePrismaQuery(async (client) => {
      return await client.user.findUnique({
        where: { id: userId },
        select: { role: true, isActive: true }
      });
    });

    if (!userInfo || (userInfo.role !== 'business' && userInfo.role !== 'admin')) {
      throw new AppError('Business access required', 403, 'BUSINESS_ACCESS_REQUIRED');
    }

    const venues = await safePrismaQuery(async (client) => {
      return await client.venue.findMany({
        where: { ownerId: userId },
        select: { id: true, name: true }
      });
    });

    const venueIds = venues.map(v => v.id);

    const where: any = {
      venueId: { in: venueIds }
    };

    if (search) {
      where.title = { contains: search as string, mode: 'insensitive' };
    }
    if (type) {
      where.type = type;
    }
    if (venue) {
      where.venueId = venue;
    }
    if (status) {
      where.status = status;
    }

    const activities = await safePrismaQuery(async (client) => {
      return await client.activity.findMany({
        where,
        include: {
          venue: {
            select: { id: true, name: true, address: true }
          },
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
        } as any,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit)
      });
    });

    const totalCount = await safePrismaQuery(async (client) => {
      return await client.activity.count({ where });
    });

    const formattedActivities = activities.map((activity: any) => ({
      id: activity.id,
      name: activity.title,
      type: activity.type || 'After-School',
      venue: activity.venue?.name || 'Unknown Venue',
      venueId: activity.venue?.id,
      time: `${activity.startTime || '09:00'} - ${activity.endTime || '17:00'}`,
      capacity: activity.capacity || 20,
      booked: activity._count?.bookings || 0,
      status: activity.status || 'active',
      nextSession: activity.startDate.toISOString().split('T')[0],
      description: activity.description,
      price: activity.price,
      durationWeeks: activity.durationWeeks,
      regularDay: activity.regularDay,
      regularTime: activity.regularTime,
      createdAt: activity.createdAt,
      updatedAt: activity.updatedAt
    }));

    logger.info('Business activities fetched successfully', {
      userId,
      count: formattedActivities.length,
      totalCount
    });

    res.json({
      success: true,
      data: {
        activities: formattedActivities,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / Number(limit))
        },
        venues: venues
      }
    });
  } catch (error) {
    logger.error('Error fetching business activities:', error);
    throw new AppError('Failed to fetch activities', 500, 'ACTIVITIES_ERROR');
  }
}));

router.get('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const activityId = req.params['id'];

  try {
    const userInfo = await safePrismaQuery(async (client) => {
      return await client.user.findUnique({
        where: { id: userId },
        select: { role: true, isActive: true }
      });
    });

    if (!userInfo || (userInfo.role !== 'business' && userInfo.role !== 'admin')) {
      throw new AppError('Business access required', 403, 'BUSINESS_ACCESS_REQUIRED');
    }

    const venues = await safePrismaQuery(async (client) => {
      return await client.venue.findMany({
        where: { ownerId: userId },
        select: { id: true }
      });
    });

    const venueIds = venues.map(v => v.id);

    const activity = await safePrismaQuery(async (client) => {
      return await client.activity.findFirst({
        where: {
          id: activityId || '',
          venueId: { in: venueIds }
        },
        include: {
          venue: {
            select: { id: true, name: true, address: true }
          },
          bookings: {
            include: {
              child: {
                select: { firstName: true, lastName: true }
              },
              parent: {
                select: { firstName: true, lastName: true, email: true }
              }
            }
          },
          _count: {
            select: {
              bookings: {
                where: { status: 'confirmed' }
              }
            }
          }
        }
      });
    });

    if (!activity) {
      throw new AppError('Activity not found', 404, 'ACTIVITY_NOT_FOUND');
    }

    logger.info('Business activity fetched successfully', { userId, activityId });

    res.json({
      success: true,
      data: {
        id: activity.id,
        title: activity.title,
        type: activity.type || 'After-School',
        description: activity.description,
        startDate: activity.startDate,
        endDate: activity.endDate,
        startTime: activity.startTime,
        endTime: activity.endTime,
        price: activity.price,
        capacity: activity.capacity || 20,
        booked: (activity as any).bookings?.length || 0,
        status: activity.status || 'active',
        venue: (activity as any).venue,
        ageRange: (activity as any).ageRange,
        whatToBring: (activity as any).whatToBring,
        earlyDropoff: (activity as any).earlyDropoff,
        earlyDropoffPrice: (activity as any).earlyDropoffPrice,
        latePickup: (activity as any).latePickup,
        latePickupPrice: (activity as any).latePickupPrice,
        excludeDates: (activity as any).excludeDates,
        siblingDiscount: (activity as any).siblingDiscount,
        bulkDiscount: (activity as any).bulkDiscount,
        weeklyDiscount: (activity as any).weeklyDiscount,
        isWraparoundCare: (activity as any).isWraparoundCare,
        yearGroups: (activity as any).yearGroups,
        daysOfWeek: (activity as any).daysOfWeek,
        proRataBooking: (activity as any).proRataBooking,
        holidaySessions: (activity as any).holidaySessions,
        bookings: (activity as any).bookings.map((booking: any) => ({
          id: booking.id,
          childName: `${booking.child.firstName} ${booking.child.lastName}`,
          parentName: `${booking.parent.firstName} ${booking.parent.lastName}`,
          parentEmail: booking.parent.email,
          status: booking.status,
          createdAt: booking.createdAt
        })),
        createdAt: activity.createdAt,
        updatedAt: activity.updatedAt
      }
    });
  } catch (error) {
    logger.error('Error fetching business activity:', error);
    throw new AppError('Failed to fetch activity', 500, 'ACTIVITY_ERROR');
  }
}));

router.delete('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const activityId = req.params['id'];

  try {
    const userInfo = await safePrismaQuery(async (client) => {
      return await client.user.findUnique({
        where: { id: userId },
        select: { role: true }
      });
    });

    if (!userInfo || (userInfo.role !== 'business' && userInfo.role !== 'admin')) {
      throw new AppError('Business access required', 403, 'BUSINESS_ACCESS_REQUIRED');
    }

    // Admins can delete any activity
    if (userInfo.role === 'admin') {
      await activityService.deleteActivity(activityId);
      return res.json({ success: true, message: 'Activity deleted successfully' });
    }

    // Business users can only delete their own activities
    const venues = await safePrismaQuery(async (client) => {
      return await client.venue.findMany({
        where: { ownerId: userId },
        select: { id: true }
      });
    });

    const venueIds = venues.map(v => v.id);

    const activity = await safePrismaQuery(async (client) => {
      return await client.activity.findFirst({
        where: {
          id: activityId,
          venueId: { in: venueIds }
        }
      });
    });

    if (!activity) {
      throw new AppError('Activity not found or access denied', 404, 'ACTIVITY_NOT_FOUND');
    }

    await activityService.deleteActivity(activityId);

    res.json({
      success: true,
      message: 'Activity deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting business activity:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to delete activity', 500, 'ACTIVITY_DELETE_ERROR');
  }
}));

router.post('/', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const activityData = req.body;

  logger.info('DEBUG: POST / received', {
    userId,
    body: activityData,
    typeOfVenueId: typeof activityData.venueId
  });

  try {
    const userInfo = await safePrismaQuery(async (client) => {
      return await client.user.findUnique({
        where: { id: userId },
        select: { role: true }
      });
    });

    if (!userInfo || (userInfo.role !== 'business' && userInfo.role !== 'admin')) {
      throw new AppError('Business access required', 403, 'BUSINESS_ACCESS_REQUIRED');
    }

    logger.info('DEBUG: Creating activity', { userId, venueId: activityData.venueId });

    // Verify venue ownership
    const venue = await safePrismaQuery(async (client) => {
      const v = await client.venue.findFirst({
        where: {
          id: activityData.venueId,
          ownerId: userId
        }
      });
      return v;
    });

    if (!venue && userInfo.role !== 'admin') {
      const allMyVenues = await safePrismaQuery(async (client) => {
        return await client.venue.findMany({
          where: { ownerId: userId },
          select: { id: true, name: true }
        });
      });

      logger.warn('DEBUG: Venue not found or access denied', {
        attemptedVenueId: activityData.venueId,
        userId,
        userRole: userInfo.role,
        myVenues: allMyVenues.map(v => v.id)
      });
      throw new AppError('Venue not found or access denied', 403, 'VENUE_OWNERSHIP_ERROR');
    }

    logger.info('DEBUG: Venue verified successfully', { venueId: venue?.id });

    const result = await safePrismaQuery(async (client) => {
      // Create activity
      const activity = await client.activity.create({
        data: {
          title: activityData.title,
          type: activityData.type,
          description: activityData.description,
          venue: { connect: { id: activityData.venueId } },
          owner: { connect: { id: userId } },
          createdBy: userId,
          startDate: new Date(activityData.startDate),
          endDate: new Date(activityData.endDate),
          startTime: activityData.startTime,
          endTime: activityData.endTime,
          capacity: parseInt(activityData.capacity) || 20,
          price: parseFloat(activityData.price) || 0,
          isActive: true,
          status: 'active',
          // New specialized fields
          isWraparoundCare: activityData.isWraparoundCare || false,
          yearGroups: activityData.yearGroups || [],
          ageRange: activityData.ageRange,
          whatToBring: activityData.whatToBring,
          siblingDiscount: activityData.siblingDiscount ? parseFloat(activityData.siblingDiscount) : null,
          bulkDiscount: activityData.bulkDiscount ? parseFloat(activityData.bulkDiscount) : null,
          weeklyDiscount: activityData.weeklyDiscount ? parseFloat(activityData.weeklyDiscount) : null,
          daysOfWeek: activityData.daysOfWeek || [],
          proRataBooking: activityData.proRataBooking || false,
          holidaySessions: activityData.holidaySessions !== undefined ? activityData.holidaySessions : true,
          earlyDropoff: activityData.earlyDropoff || false,
          earlyDropoffPrice: activityData.earlyDropoffPrice ? parseFloat(activityData.earlyDropoffPrice) : null,
          earlyDropoffStartTime: activityData.earlyDropoffStartTime,
          earlyDropoffEndTime: activityData.earlyDropoffEndTime,
          latePickup: activityData.latePickup || false,
          latePickupPrice: activityData.latePickupPrice ? parseFloat(activityData.latePickupPrice) : null,
          latePickupStartTime: activityData.latePickupStartTime,
          latePickupEndTime: activityData.latePickupEndTime,
          imageUrls: activityData.imageUrls || [],
          excludeDates: activityData.excludeDates || [],
          durationWeeks: activityData.durationWeeks ? parseInt(activityData.durationWeeks) : null,
        }
      });

      // Handle session blocks for wraparound care
      if (activityData.sessionBlocks && activityData.sessionBlocks.length > 0) {
        await client.session_blocks.createMany({
          data: activityData.sessionBlocks.map((block: any) => ({
            activityId: activity.id,
            name: block.name,
            startTime: block.startTime,
            endTime: block.endTime,
            capacity: parseInt(block.capacity) || activity.capacity,
            price: parseFloat(block.price) || activity.price,
          }))
        });
      }

      // Handle custom time slots for holiday club
      if (activityData.customTimeSlots && activityData.customTimeSlots.length > 0) {
        await client.holiday_time_slots.createMany({
          data: activityData.customTimeSlots.map((slot: any) => ({
            activityId: activity.id,
            name: slot.name,
            startTime: slot.startTime,
            endTime: slot.endTime,
            capacity: parseInt(slot.capacity) || activity.capacity,
            price: parseFloat(slot.price) || activity.price,
          }))
        });
      }

      // Generate initial sessions if requested
      if (activityData.generateSessions) {
        // We'll let the service handle session generation if needed, 
        // or just rely on the fact that we have the activity created.
        // For now, let's keep it simple.
      }

      return activity;
    });

    logger.info('Business activity created successfully', { userId, activityId: result.id });

    res.status(201).json({
      success: true,
      message: 'Activity created successfully',
      data: result
    });
  } catch (error) {
    logger.error('Error creating business activity:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to create activity', 500, 'ACTIVITY_CREATE_ERROR');
  }
}));

// Catch-all for debugging unmatched routes within this router
router.all('*', (req, res) => {
  logger.warn(`Unmatched route within businessActivities router: ${req.method} ${req.url}`);
  res.status(404).json({
    success: false,
    message: `Business Activities route not found: ${req.method} ${req.url}`
  });
});

export default router;
