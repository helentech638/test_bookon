import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import { safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';

const router = Router();

const getEmptyBusinessDashboard = () => ({
  stats: {
    activitiesRunningToday: 0,
    childrenInActivities: 0,
    parentsRegistered: 0,
    paymentsCollectedToday: 0,
    refundsCreditsIssued: 0,
    totalRevenue: 0,
    monthlyGrowth: 0,
    activeVenues: 0
  },
  upcomingActivities: [],
  financeData: [
    { week: 'Mon', income: 0 },
    { week: 'Tue', income: 0 },
    { week: 'Wed', income: 0 },
    { week: 'Thu', income: 0 },
    { week: 'Fri', income: 0 },
    { week: 'Sat', income: 0 },
    { week: 'Sun', income: 0 }
  ],
  notifications: [],
  unreadNotifications: 0
});

// Get business dashboard statistics
router.get('/business', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  
  // Check if user has business access
  const userInfo = await safePrismaQuery(async (client) => {
    return await client.user.findUnique({
      where: { id: userId },
      select: { role: true, isActive: true }
    });
  });

  if (!userInfo) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Allow access for business/admin users
  if (userInfo.role !== 'business' && userInfo.role !== 'admin') {
    throw new AppError('Business access required', 403, 'BUSINESS_ACCESS_REQUIRED');
  }

  if (!userInfo.isActive) {
    throw new AppError('Account is inactive', 403, 'ACCOUNT_INACTIVE');
  }
  
  try {
    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get this month's date range
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // Get last month's date range for growth calculation
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    const dashboardData = await safePrismaQuery(async (client) => {
      // Get user's venues first
      const venues = await client.venue.findMany({
        where: { ownerId: userId },
        select: { id: true }
      });
      const venueIds = venues.map(v => v.id);

      // If no venues, return empty data quickly
      if (venueIds.length === 0) {
        return getEmptyBusinessDashboard();
      }

      // Run all queries in parallel for better performance
      const [
        activitiesToday,
        childrenToday,
        parentsRegistered,
        paymentsToday,
        refundsToday,
        revenueThisMonth,
        revenueLastMonth,
        activeVenues,
        upcomingActivities,
        notifications,
        unreadNotifications
      ] = await Promise.all([
        // Activities running today
        client.activity.count({
          where: {
            venueId: { in: venueIds },
            startDate: { gte: today, lt: tomorrow }
          }
        }),

        // Children in activities today
        client.booking.count({
          where: {
            activity: {
              venueId: { in: venueIds },
              startDate: { gte: today, lt: tomorrow }
            },
            status: 'confirmed'
          }
        }),

        // Parents registered this term (last 3 months)
        client.user.count({
          where: {
            role: 'parent',
            createdAt: { gte: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000) }
          }
        }),

        // Payments collected today
        client.payment.aggregate({
          where: {
            booking: {
              activity: {
                venueId: { in: venueIds }
              }
            },
            status: 'succeeded',
            createdAt: { gte: today, lt: tomorrow }
          },
          _sum: { amount: true }
        }),

        // Refunds/Credits issued today
        client.refund.count({
          where: {
            booking: {
              activity: {
                venueId: { in: venueIds }
              }
            },
            createdAt: { gte: today, lt: tomorrow }
          }
        }),

        // Total revenue this month
        client.payment.aggregate({
          where: {
            booking: {
              activity: {
                venueId: { in: venueIds }
              }
            },
            status: 'succeeded',
            createdAt: { gte: startOfMonth, lt: endOfMonth }
          },
          _sum: { amount: true }
        }),

        // Revenue last month for growth calculation
        client.payment.aggregate({
          where: {
            booking: {
              activity: {
                venueId: { in: venueIds }
              }
            },
            status: 'succeeded',
            createdAt: { gte: startOfLastMonth, lt: endOfLastMonth }
          },
          _sum: { amount: true }
        }),

        // Active venues
        client.venue.count({
          where: {
            ownerId: userId,
            isActive: true
          }
        }),

        // Upcoming activities (next 7 days)
        client.activity.findMany({
          where: {
            venueId: { in: venueIds },
            startDate: { gte: today, lte: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000) }
          },
          select: {
            id: true,
            title: true,
            startDate: true,
            venue: {
              select: { name: true }
            },
            _count: {
              select: {
                bookings: {
                  where: { status: 'confirmed' }
                }
              }
            }
          },
          orderBy: { startDate: 'asc' },
          take: 5
        }),

        // Recent notifications
        client.notification.findMany({
          where: {
            userId: userId
          },
          select: {
            id: true,
            title: true,
            message: true,
            type: true,
            read: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' },
          take: 5
        }),

        // Unread notifications count
        client.notification.count({
          where: {
            userId: userId,
            read: false
          }
        })
      ]);

      // Simple weekly placeholder series
      const financeData = [
        { week: 'Mon', income: Math.floor(Math.random() * 500) + 100 },
        { week: 'Tue', income: Math.floor(Math.random() * 500) + 100 },
        { week: 'Wed', income: Math.floor(Math.random() * 500) + 100 },
        { week: 'Thu', income: Math.floor(Math.random() * 500) + 100 },
        { week: 'Fri', income: Math.floor(Math.random() * 500) + 100 },
        { week: 'Sat', income: Math.floor(Math.random() * 300) + 50 },
        { week: 'Sun', income: Math.floor(Math.random() * 300) + 50 }
      ];

      // Calculate monthly growth
      const currentRevenue = Number(revenueThisMonth._sum.amount || 0);
      const previousRevenue = Number(revenueLastMonth._sum.amount || 0);
      const monthlyGrowth = previousRevenue > 0 
        ? Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 100)
        : 0;

      return {
        stats: {
          activitiesRunningToday: activitiesToday,
          childrenInActivities: childrenToday,
          parentsRegistered,
          paymentsCollectedToday: Number(paymentsToday._sum.amount || 0),
          refundsCreditsIssued: refundsToday,
          totalRevenue: currentRevenue,
          monthlyGrowth,
          activeVenues
        },
        upcomingActivities: upcomingActivities.map(activity => ({
          id: activity.id,
          title: activity.title,
          venue: activity.venue.name,
          time: activity.startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          date: activity.startDate.toLocaleDateString('en-US'),
          participants: activity._count.bookings,
          status: 'confirmed' as const
        })),
        financeData,
        notifications: notifications.map(notification => ({
          id: notification.id,
          title: notification.title,
          message: notification.message,
          timestamp: notification.createdAt.toLocaleString('en-US'),
          type: notification.type as 'info' | 'warning' | 'success' | 'error',
          read: notification.read
        })),
        unreadNotifications
      };
    });

    logger.info('Business dashboard data fetched successfully', { userId });

    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    logger.error('Error fetching business dashboard data:', error);
    return res.json({
      success: true,
      data: getEmptyBusinessDashboard(),
      degraded: true,
      message: 'Dashboard data is temporarily limited'
    });
  }
}));

export default router;
