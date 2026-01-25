import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import { prisma, safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';

const router = Router();

// Get all bookings for business user
router.get('/', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { page = 1, limit = 20, status, activityId, search } = req.query;
  
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

    if (venueIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: 0,
          pages: 0
        }
      });
    }

    // Build where clause
    const where: any = {
      activity: {
        venueId: { in: venueIds }
      }
    };

    if (status) {
      where.status = status;
    }

    if (activityId) {
      where.activityId = activityId as string;
    }

    if (search) {
      where.OR = [
        {
          activity: {
            title: { contains: search as string, mode: 'insensitive' }
          }
        },
        {
          child: {
            OR: [
              { firstName: { contains: search as string, mode: 'insensitive' } },
              { lastName: { contains: search as string, mode: 'insensitive' } }
            ]
          }
        },
        {
          parent: {
            OR: [
              { firstName: { contains: search as string, mode: 'insensitive' } },
              { lastName: { contains: search as string, mode: 'insensitive' } },
              { email: { contains: search as string, mode: 'insensitive' } }
            ]
          }
        }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    // Get bookings with pagination
    const [bookings, totalCount] = await safePrismaQuery(async (client) => {
      const result = await Promise.all([
        client.booking.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: 'desc' },
          include: {
            activity: {
              select: {
                id: true,
                title: true,
                venue: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            },
            child: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            },
            parent: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        }),
        client.booking.count({ where })
      ]);

      return result;
    });

    // Transform bookings to match expected format
    const transformedBookings = bookings.map(booking => ({
      id: booking.id,
      status: booking.status,
      totalAmount: Number(booking.totalAmount || booking.amount || 0),
      bookingDate: booking.bookingDate ? booking.bookingDate.toISOString() : '',
      createdAt: booking.createdAt.toISOString(),
      paymentStatus: booking.paymentStatus,
      activity: {
        id: booking.activity.id,
        title: booking.activity.title,
        date: booking.activityDate ? booking.activityDate.toISOString() : '',
        time: booking.activityTime || ''
      },
      venue: {
        id: booking.activity.venue.id,
        name: booking.activity.venue.name
      },
      child: {
        id: booking.child.id,
        firstName: booking.child.firstName,
        lastName: booking.child.lastName
      },
      parent: {
        id: booking.parent.id,
        firstName: booking.parent.firstName,
        lastName: booking.parent.lastName,
        email: booking.parent.email
      }
    }));

    res.json({
      success: true,
      data: transformedBookings,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / Number(limit))
      }
    });

  } catch (error) {
    logger.error('Error fetching business bookings:', error);
    throw new AppError('Failed to fetch bookings', 500, 'BOOKINGS_FETCH_ERROR');
  }
}));

// Get single booking details
router.get('/:bookingId', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { bookingId } = req.params;
  
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

    // Get booking
    const booking = await safePrismaQuery(async (client) => {
      return await client.booking.findFirst({
        where: {
          id: bookingId,
          activity: {
            venueId: { in: venueIds }
          }
        },
        include: {
          activity: {
            include: {
              venue: true
            }
          },
          child: {
            include: {
              permissions: true
            }
          },
          parent: true,
          payments: true
        }
      });
    });

    if (!booking) {
      throw new AppError('Booking not found or access denied', 404, 'BOOKING_NOT_FOUND');
    }

    res.json({
      success: true,
      data: booking
    });

  } catch (error) {
    logger.error('Error fetching business booking:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch booking', 500, 'BOOKING_FETCH_ERROR');
  }
}));

export default router;
