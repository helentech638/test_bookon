import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticateToken, requireRole } from '../middleware/auth';
import { prisma, safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';

// Simple in-memory cache for dashboard data
const dashboardCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds cache

const router = Router();

// Get dashboard statistics - optimized with caching
router.get('/stats', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  const userId = req.user!.id;
  const cacheKey = `stats_${userId}`;
  
  // Check cache first
  const cached = dashboardCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    logger.info(`Dashboard stats served from cache in ${Date.now() - startTime}ms`, { userId });
    return res.json({
      success: true,
      data: cached.data
    });
  }
  
  try {
    // Use Prisma queries instead of raw SQL for better reliability
    const dashboardData = await safePrismaQuery(async (client) => {
      // Get user info
      const user = await client.user.findUnique({
        where: { id: userId },
        select: { createdAt: true, lastLoginAt: true }
      });

      // Get booking statistics - optimized with single query
      const bookingStats = await client.booking.groupBy({
        by: ['status'],
        where: { parentId: userId },
        _count: { id: true },
        _sum: { amount: true }
      });

      // Calculate totals from grouped results
      const totalBookings = bookingStats.reduce((sum, stat) => sum + stat._count.id, 0);
      const confirmedBookings = bookingStats.find(s => s.status === 'confirmed')?._count.id || 0;
      const upcomingBookings = bookingStats
        .filter(s => ['pending', 'confirmed'].includes(s.status))
        .reduce((sum, stat) => sum + stat._count.id, 0);
      const totalSpent = bookingStats
        .filter(s => s.status === 'confirmed')
        .reduce((sum, stat) => sum + Number(stat._sum.amount || 0), 0);

      // Calculate member since days
      const memberSince = user ? Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)) : 0;
      
      return {
        totalBookings: totalBookings || 0,
        confirmedBookings: confirmedBookings || 0,
        totalSpent: parseFloat(String(totalSpent || 0)),
        upcomingActivities: upcomingBookings || 0,
        memberSince: memberSince,
        lastLogin: user?.lastLoginAt?.toISOString() || new Date().toISOString()
      };
    });

    // Cache the result
    dashboardCache.set(cacheKey, {
      data: dashboardData,
      timestamp: Date.now()
    });

    const endTime = Date.now();
    logger.info(`Dashboard stats API completed in ${endTime - startTime}ms`, { userId });
    
    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    logger.error('Error fetching dashboard stats:', error);
    throw new AppError('Failed to fetch dashboard stats', 500, 'DASHBOARD_STATS_ERROR');
  }
}));

// Get user profile data for dashboard - optimized
router.get('/profile', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  
  try {
    // Fetch real user data from database
    const user = await safePrismaQuery(async (client) => {
      return await client.user.findUnique({
        where: { id: userId },
        select: { 
          id: true, 
          email: true, 
          firstName: true,
          lastName: true,
          role: true, 
          isActive: true,
          phone: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true
        }
      });
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Format the response to match frontend expectations
    const userData = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
      phone: user.phone,
      memberSince: user.createdAt.toISOString(),
      lastLogin: user.lastLoginAt?.toISOString() || user.updatedAt.toISOString()
    };

    res.json({
      success: true,
      data: userData
    });
  } catch (error) {
    logger.error('Error fetching user profile:', error);
    throw new AppError('Failed to fetch user profile', 500, 'USER_PROFILE_ERROR');
  }
}));

// Get user's activities
router.get('/activities', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  
  try {
    const activities = await safePrismaQuery(async (client) => {
      return await client.booking.findMany({
        where: { parentId: userId },
        include: {
          activity: {
            select: {
              title: true,
              description: true,
              status: true,
              venue: {
                select: {
                  name: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10 // Limit to 10 most recent activities
      });
    });

    res.json({
      success: true,
      data: activities.map(booking => ({
        id: booking.id,
        status: booking.status,
        created_at: booking.createdAt,
        title: booking.activity.title,
        description: booking.activity.description,
        venue_name: booking.activity.venue.name
      }))
    });
  } catch (error) {
    logger.error('Error fetching user activities:', error);
    throw new AppError('Failed to fetch user activities', 500, 'USER_ACTIVITIES_ERROR');
  }
}));

// Get user's children
router.get('/children', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  
  try {
    const children = await safePrismaQuery(async (client) => {
      return await client.child.findMany({
      where: { parentId: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true
      },
      orderBy: { firstName: 'asc' }
      });
    });

    res.json({
      success: true,
      data: children
    });
  } catch (error) {
    logger.error('Error fetching children:', error);
    throw new AppError('Failed to fetch children', 500, 'CHILDREN_FETCH_ERROR');
  }
}));

// Get recent activity
router.get('/recent-activity', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  
  try {
    // Get recent bookings with course and venue info
    const recentBookings = await safePrismaQuery(async (client) => {
      return await client.booking.findMany({
        where: { parentId: userId },
        select: {
          id: true,
          status: true,
          createdAt: true,
          amount: true,
          paymentStatus: true,
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
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      });
    });

    // Combine bookings and payments into activities
    const allActivities = recentBookings.map(booking => [
      {
        type: 'booking',
        id: booking.id,
        title: `Booked: ${booking.activity.title}`,
        subtitle: `at ${booking.activity.venue.name}`,
        status: booking.status,
        date: booking.createdAt
      },
      {
        type: 'payment',
        id: booking.id,
        title: `Payment: ${booking.activity.title}`,
        subtitle: `£${parseFloat(String(booking.amount || '0')).toFixed(2)}`,
        status: booking.paymentStatus,
        date: booking.createdAt
      }
    ]).flat().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

    res.json({
      success: true,
      data: allActivities
    });
  } catch (error) {
    logger.error('Error fetching recent activity:', error);
    throw new AppError('Failed to fetch recent activity', 500, 'RECENT_ACTIVITY_FETCH_ERROR');
  }
}));

// Get recent activities for user - optimized
router.get('/recent-activities', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    // Optimized query with minimal data fetching
    const recentActivities = await safePrismaQuery(async (client) => {
      const bookings = await client.booking.findMany({
        where: { parentId: userId },
        select: {
          id: true,
          status: true,
          createdAt: true,
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
        },
        orderBy: { createdAt: 'desc' },
        take: 5 // Reduced from 10 to 5 for faster loading
      });

      return bookings.map((booking: any) => ({
        id: booking.id,
        type: 'booking',
        title: booking.activity.title,
        description: `${booking.status} activity`,
        venue: booking.activity.venue.name,
        status: booking.status,
        timestamp: booking.createdAt
      }));
    });

    res.json({
      success: true,
      data: recentActivities
    });
  } catch (error) {
    logger.error('Error fetching recent activities:', error);
    throw new AppError('Failed to fetch recent activities', 500, 'RECENT_ACTIVITIES_ERROR');
  }
}));

// Get user's bookings (redirect to main bookings endpoint)
router.get('/bookings', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    const bookings = await safePrismaQuery(async (client) => {
      return await client.booking.findMany({
        where: { 
          parentId: userId,
          status: { not: 'cancelled' }
        },
        include: {
          activity: {
            include: {
              venue: true
            }
          },
          child: true
        },
        orderBy: { createdAt: 'desc' }
      });
    });

    res.json({
      success: true,
      data: bookings
    });
  } catch (error) {
    logger.error('Error fetching user bookings:', error);
    throw new AppError('Failed to fetch user bookings', 500, 'USER_BOOKINGS_ERROR');
  }
}));

// Get admin dashboard snapshot data
router.get('/admin-snapshot', authenticateToken, requireRole(['admin']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { range = 'today' } = req.query;
    const userId = req.user!.id;
    
    logger.info('Admin dashboard snapshot requested', { 
      user: req.user?.email,
      range,
      userId 
    });

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (range) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default: // today
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
    }

    const snapshotData = await safePrismaQuery(async () => {
      // Get activities running today
      const activitiesRunning = await prisma.activity.count({
        where: {
          startDate: { lte: endDate },
          endDate: { gte: startDate },
          status: 'active'
        }
      });

      // Get attendees today (confirmed bookings for today's activities)
      const attendeesToday = await prisma.booking.count({
        where: {
          status: 'confirmed',
          activity: {
            startDate: { lte: endDate },
            endDate: { gte: startDate }
          }
        }
      });

      // Get total parents registered
      const parentsRegistered = await prisma.user.count({
        where: {
          role: 'parent'
        }
      });

      // Get payments total for the period
      const paymentsData = await prisma.booking.aggregate({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          status: 'confirmed'
        },
        _sum: { amount: true }
      });

      // Get refunds total for the period
      const refundsData = await prisma.booking.aggregate({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          status: 'cancelled'
        },
        _sum: { amount: true }
      });

      // Get credits total (mock for now - would need credits table)
      const creditsTotal = 0; // TODO: Implement credits system

      return {
        activities_running: activitiesRunning,
        attendees_today: attendeesToday,
        parents_registered: parentsRegistered,
        payments_total: paymentsData._sum.amount || 0,
        refunds_total: refundsData._sum.amount || 0,
        credits_total: creditsTotal
      };
    });

    logger.info('Admin dashboard snapshot data retrieved', { 
      activities_running: snapshotData.activities_running,
      attendees_today: snapshotData.attendees_today,
      parents_registered: snapshotData.parents_registered
    });

    res.json({
      success: true,
      data: snapshotData
    });
  } catch (error) {
    logger.error('Error fetching admin dashboard snapshot:', error);
    throw new AppError('Failed to fetch admin dashboard snapshot', 500, 'ADMIN_SNAPSHOT_ERROR');
  }
}));

export default router;
