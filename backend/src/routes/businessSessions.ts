import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import { prisma, safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';

const router = Router();

// Create new session for an activity
router.post('/', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { activityId, date, startTime, endTime, capacity, sessionBlocks } = req.body;
  
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
    if (!activityId || !date || !startTime || !endTime) {
      throw new AppError('Missing required fields: activityId, date, startTime, endTime', 400, 'MISSING_REQUIRED_FIELDS');
    }

    // Get user's venues
    const venues = await safePrismaQuery(async (client) => {
      return await client.venue.findMany({
        where: { ownerId: userId },
        select: { id: true }
      });
    });

    const venueIds = venues.map(v => v.id);

    // Verify activity belongs to user
    const activity = await safePrismaQuery(async (client) => {
      return await client.activity.findFirst({
        where: {
          id: activityId,
          venueId: { in: venueIds }
        },
        select: { id: true, title: true, capacity: true }
      });
    });

    if (!activity) {
      throw new AppError('Activity not found or access denied', 404, 'ACTIVITY_NOT_FOUND');
    }

    // Check if session already exists for this date
    const existingSession = await safePrismaQuery(async (client) => {
      return await client.session.findFirst({
        where: {
          activityId: activityId,
          date: new Date(date)
        }
      });
    });

    if (existingSession) {
      throw new AppError('Session already exists for this date', 400, 'SESSION_ALREADY_EXISTS');
    }

    // Create the session
    const session = await safePrismaQuery(async (client) => {
      return await client.session.create({
        data: {
          activityId: activityId,
          date: new Date(date),
          startTime: startTime,
          endTime: endTime,
          status: 'scheduled',
          capacity: capacity || activity.capacity,
          bookingsCount: 0
        }
      });
    });

    // Create session blocks if provided
    if (sessionBlocks && sessionBlocks.length > 0) {
      const sessionBlockData = sessionBlocks.map((block: any) => ({
        sessionId: session.id,
        activityId: activityId,
        name: block.name,
        startTime: block.startTime,
        endTime: block.endTime,
        capacity: block.capacity || 0,
        price: block.price || 5.00,
        isActive: true
      }));

      await safePrismaQuery(async (client) => {
        return await client.sessionBlock.createMany({
          data: sessionBlockData
        });
      });
    }

    logger.info('Session created successfully', { 
      userId, 
      sessionId: session.id, 
      activityId, 
      date 
    });

    res.status(201).json({
      success: true,
      message: 'Session created successfully',
      data: session
    });

  } catch (error) {
    logger.error('Error creating session:', error);
    throw error;
  }
}));

// Get sessions for business activities
router.get('/', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { activityId, status, dateRange, page = 1, limit = 50 } = req.query;
  
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
        select: { id: true, name: true }
      });
    });

    const venueIds = venues.map(v => v.id);

    // Build where clause
    const where: any = {
      activity: {
        venueId: { in: venueIds }
      }
    };

    if (activityId) {
      where.activityId = activityId;
    }

    if (status) {
      where.status = status;
    }

    // Date range filtering
    if (dateRange) {
      const now = new Date();
      switch (dateRange) {
        case 'today':
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          where.date = {
            gte: today,
            lt: tomorrow
          };
          break;
        case 'week':
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - now.getDay() + 1);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 7);
          where.date = {
            gte: weekStart,
            lt: weekEnd
          };
          break;
        case 'month':
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          where.date = {
            gte: monthStart,
            lt: monthEnd
          };
          break;
        case 'upcoming':
          where.date = {
            gte: now
          };
          break;
      }
    }

    // Get sessions with pagination
    const skip = (Number(page) - 1) * Number(limit);
    
    const [sessions, totalCount] = await safePrismaQuery(async (client) => {
      return await Promise.all([
        client.session.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { date: 'asc' },
          include: {
            activity: {
              select: {
                id: true,
                title: true,
                type: true,
                venue: {
                  select: {
                    name: true,
                    address: true
                  }
                }
              }
            },
            sessionBlocks: {
              select: {
                id: true,
                name: true,
                startTime: true,
                endTime: true,
                capacity: true,
                price: true,
                bookingsCount: true
              }
            },
            bookings: {
              where: { status: 'confirmed' },
              select: { id: true }
            }
          }
        }),
        client.session.count({ where })
      ]);
    });

    // Transform sessions data
    const transformedSessions = sessions.map(session => ({
      id: session.id,
      date: session.date.toISOString().split('T')[0],
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,
      capacity: session.capacity,
      bookingsCount: session.bookings.length,
      price: session.price,
      activity: session.activity,
      sessionBlocks: session.sessionBlocks
    }));

    res.json({
      success: true,
      data: transformedSessions,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / Number(limit))
      }
    });

  } catch (error) {
    logger.error('Error fetching business sessions:', error);
    throw error;
  }
}));

// Get single session details
router.get('/:sessionId', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { sessionId } = req.params;
  
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
        select: { id: true, name: true }
      });
    });

    const venueIds = venues.map(v => v.id);

    // Get session with full details
    const session = await safePrismaQuery(async (client) => {
      return await client.session.findFirst({
        where: {
          id: sessionId,
          activity: {
            venueId: { in: venueIds }
          }
        },
        include: {
          activity: {
            select: {
              id: true,
              title: true,
              type: true,
              description: true,
              venue: {
                select: {
                  name: true,
                  address: true
                }
              }
            }
          },
          sessionBlocks: {
            include: {
              bookings: {
                where: { status: 'confirmed' },
                include: {
                  child: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      yearGroup: true
                    }
                  }
                }
              }
            }
          },
          bookings: {
            where: { status: 'confirmed' },
            include: {
              child: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  yearGroup: true
                }
              }
            }
          }
        }
      });
    });

    if (!session) {
      throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
    }

    res.json({
      success: true,
      data: session
    });

  } catch (error) {
    logger.error('Error fetching session details:', error);
    throw error;
  }
}));

// Update session status
router.patch('/:sessionId/status', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { sessionId } = req.params;
  const { status } = req.body;
  
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

    // Validate status
    if (!['active', 'cancelled', 'completed'].includes(status)) {
      throw new AppError('Invalid status', 400, 'INVALID_STATUS');
    }

    // Get user's venues
    const venues = await safePrismaQuery(async (client) => {
      return await client.venue.findMany({
        where: { ownerId: userId },
        select: { id: true, name: true }
      });
    });

    const venueIds = venues.map(v => v.id);

    // Update session status
    const updatedSession = await safePrismaQuery(async (client) => {
      return await client.session.updateMany({
        where: {
          id: sessionId,
          activity: {
            venueId: { in: venueIds }
          }
        },
        data: { status }
      });
    });

    if (updatedSession.count === 0) {
      throw new AppError('Session not found or access denied', 404, 'SESSION_NOT_FOUND');
    }

    logger.info('Session status updated', { 
      userId, 
      sessionId, 
      status 
    });

    res.json({
      success: true,
      message: 'Session status updated successfully'
    });

  } catch (error) {
    logger.error('Error updating session status:', error);
    throw error;
  }
}));

// Delete session
router.delete('/:sessionId', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { sessionId } = req.params;
  
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
        select: { id: true, name: true }
      });
    });

    const venueIds = venues.map(v => v.id);

    // Check if session has bookings
    const sessionWithBookings = await safePrismaQuery(async (client) => {
      return await client.session.findFirst({
        where: {
          id: sessionId,
          activity: {
            venueId: { in: venueIds }
          }
        },
        include: {
          bookings: {
            where: { status: 'confirmed' }
          }
        }
      });
    });

    if (!sessionWithBookings) {
      throw new AppError('Session not found or access denied', 404, 'SESSION_NOT_FOUND');
    }

    if (sessionWithBookings.bookings.length > 0) {
      throw new AppError('Cannot delete session with confirmed bookings', 400, 'SESSION_HAS_BOOKINGS');
    }

    // Delete session
    await safePrismaQuery(async (client) => {
      return await client.session.delete({
        where: { id: sessionId }
      });
    });

    logger.info('Session deleted', { 
      userId, 
      sessionId 
    });

    res.json({
      success: true,
      message: 'Session deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting session:', error);
    throw error;
  }
}));

// Bulk update session status
router.patch('/bulk/status', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { sessionIds, status } = req.body;
  
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

    // Validate status
    if (!['active', 'cancelled', 'completed'].includes(status)) {
      throw new AppError('Invalid status', 400, 'INVALID_STATUS');
    }

    if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
      throw new AppError('Session IDs required', 400, 'SESSION_IDS_REQUIRED');
    }

    // Get user's venues
    const venues = await safePrismaQuery(async (client) => {
      return await client.venue.findMany({
        where: { ownerId: userId },
        select: { id: true, name: true }
      });
    });

    const venueIds = venues.map(v => v.id);

    // Update multiple sessions
    const updatedSessions = await safePrismaQuery(async (client) => {
      return await client.session.updateMany({
        where: {
          id: { in: sessionIds },
          activity: {
            venueId: { in: venueIds }
          }
        },
        data: { status }
      });
    });

    logger.info('Bulk session status update', { 
      userId, 
      sessionIds, 
      status, 
      updatedCount: updatedSessions.count 
    });

    res.json({
      success: true,
      message: `${updatedSessions.count} sessions updated successfully`
    });

  } catch (error) {
    logger.error('Error bulk updating session status:', error);
    throw error;
  }
}));

export default router;
