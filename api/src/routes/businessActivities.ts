import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import { safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';

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
          bookings: {
            where: {
              status: {
                in: ['confirmed', 'pending']
              }
            },
            select: { id: true }
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
      booked: activity.bookings?.length || 0,
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

export default router;
