import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import { prisma, safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';

const router = Router();

// Get holidays for an activity
router.get('/:activityId/holidays', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { activityId } = req.params;
  
  try {
    // Check if user has business access to this activity
    const activity = await safePrismaQuery(async (client) => {
      return await client.activity.findFirst({
        where: {
          id: activityId,
          venue: {
            ownerId: userId
          }
        }
      });
    });

    if (!activity) {
      throw new AppError('Activity not found or access denied', 404, 'ACTIVITY_NOT_FOUND');
    }

    // Get holidays for this activity
    const holidays = await safePrismaQuery(async (client) => {
      return await client.holiday.findMany({
        where: { activityId },
        orderBy: { startDate: 'asc' }
      });
    });

    res.json({
      success: true,
      data: holidays
    });

  } catch (error) {
    logger.error('Error fetching holidays:', error);
    throw error;
  }
}));

// Add holiday to an activity
router.post('/:activityId/holidays', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { activityId } = req.params;
  const { name, startDate, endDate, type, description } = req.body;
  
  try {
    // Check if user has business access to this activity
    const activity = await safePrismaQuery(async (client) => {
      return await client.activity.findFirst({
        where: {
          id: activityId,
          venue: {
            ownerId: userId
          }
        }
      });
    });

    if (!activity) {
      throw new AppError('Activity not found or access denied', 404, 'ACTIVITY_NOT_FOUND');
    }

    // Validate required fields
    if (!name || !startDate || !endDate) {
      throw new AppError('Missing required fields', 400, 'MISSING_REQUIRED_FIELDS');
    }

    // Validate date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start > end) {
      throw new AppError('Start date must be before end date', 400, 'INVALID_DATE_RANGE');
    }

    // Create holiday
    const holiday = await safePrismaQuery(async (client) => {
      return await client.holiday.create({
        data: {
          name,
          startDate: start,
          endDate: end,
          type: type || 'custom',
          description,
          activityId,
          createdBy: userId
        }
      });
    });

    logger.info('Holiday created', { 
      userId, 
      activityId, 
      holidayId: holiday.id,
      name,
      startDate,
      endDate
    });

    res.status(201).json({
      success: true,
      data: holiday,
      message: 'Holiday created successfully'
    });

  } catch (error) {
    logger.error('Error creating holiday:', error);
    throw error;
  }
}));

// Delete holiday
router.delete('/:activityId/holidays/:holidayId', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { activityId, holidayId } = req.params;
  
  try {
    // Check if user has business access to this activity
    const activity = await safePrismaQuery(async (client) => {
      return await client.activity.findFirst({
        where: {
          id: activityId,
          venue: {
            ownerId: userId
          }
        }
      });
    });

    if (!activity) {
      throw new AppError('Activity not found or access denied', 404, 'ACTIVITY_NOT_FOUND');
    }

    // Delete holiday
    const deletedHoliday = await safePrismaQuery(async (client) => {
      return await client.holiday.deleteMany({
        where: {
          id: holidayId,
          activityId
        }
      });
    });

    if (deletedHoliday.count === 0) {
      throw new AppError('Holiday not found', 404, 'HOLIDAY_NOT_FOUND');
    }

    logger.info('Holiday deleted', { 
      userId, 
      activityId, 
      holidayId 
    });

    res.json({
      success: true,
      message: 'Holiday deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting holiday:', error);
    throw error;
  }
}));

// Bulk exclude sessions during holidays
router.post('/:activityId/holidays/bulk-exclude', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { activityId } = req.params;
  const { holidayIds } = req.body;
  
  try {
    // Check if user has business access to this activity
    const activity = await safePrismaQuery(async (client) => {
      return await client.activity.findFirst({
        where: {
          id: activityId,
          venue: {
            ownerId: userId
          }
        }
      });
    });

    if (!activity) {
      throw new AppError('Activity not found or access denied', 404, 'ACTIVITY_NOT_FOUND');
    }

    if (!Array.isArray(holidayIds) || holidayIds.length === 0) {
      throw new AppError('Holiday IDs required', 400, 'HOLIDAY_IDS_REQUIRED');
    }

    // Get holidays
    const holidays = await safePrismaQuery(async (client) => {
      return await client.holiday.findMany({
        where: {
          id: { in: holidayIds },
          activityId
        }
      });
    });

    if (holidays.length === 0) {
      throw new AppError('No holidays found', 404, 'HOLIDAYS_NOT_FOUND');
    }

    // Get sessions that fall within holiday periods
    const sessionsToExclude = await safePrismaQuery(async (client) => {
      const sessions = [];
      
      for (const holiday of holidays) {
        const holidaySessions = await client.session.findMany({
          where: {
            activityId,
            date: {
              gte: holiday.startDate,
              lte: holiday.endDate
            },
            status: 'active'
          }
        });
        sessions.push(...holidaySessions);
      }
      
      return sessions;
    });

    // Update sessions to cancelled status
    const excludedSessions = await safePrismaQuery(async (client) => {
      const sessionIds = sessionsToExclude.map(s => s.id);
      
      if (sessionIds.length === 0) {
        return { count: 0 };
      }
      
      return await client.session.updateMany({
        where: {
          id: { in: sessionIds }
        },
        data: {
          status: 'cancelled',
          cancellationReason: 'Holiday exclusion'
        }
      });
    });

    logger.info('Bulk session exclusion', { 
      userId, 
      activityId, 
      holidayIds,
      excludedCount: excludedSessions.count
    });

    res.json({
      success: true,
      message: `${excludedSessions.count} sessions excluded during holidays`,
      excludedCount: excludedSessions.count
    });

  } catch (error) {
    logger.error('Error bulk excluding sessions:', error);
    throw error;
  }
}));

export default router;

