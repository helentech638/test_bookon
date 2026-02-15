import { Router, Request, Response } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { safePrismaQuery } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';

const router = Router();

// Get all activity types
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  try {
    const activityTypes = await safePrismaQuery(async (client) => {
      return await client.activityType.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          description: true,
          isActive: true,
          createdAt: true,
          _count: {
            select: {
              activities: true
            }
          }
        }
      });
    });

    res.json({
      success: true,
      data: activityTypes
    });
  } catch (error: any) {
    logger.error('Error fetching activity types:', error);
    throw new AppError('Failed to fetch activity types', 500, 'FETCH_ACTIVITY_TYPES_ERROR');
  }
}));

// Get all activity types (including inactive) - Admin only
router.get('/admin', authenticateToken, requireAdmin, asyncHandler(async (_req: Request, res: Response) => {
  try {
    const activityTypes = await safePrismaQuery(async (client) => {
      return await client.activityType.findMany({
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          description: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              activities: true
            }
          }
        }
      });
    });

    res.json({
      success: true,
      data: activityTypes
    });
  } catch (error: any) {
    logger.error('Error fetching all activity types:', error);
    throw new AppError('Failed to fetch activity types', 500, 'FETCH_ALL_ACTIVITY_TYPES_ERROR');
  }
}));

// Get single activity type
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const activityType = await safePrismaQuery(async (client) => {
      return await client.activityType.findUnique({
        where: { id: id as string },
        select: {
          id: true,
          name: true,
          description: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          activities: {
            select: {
              id: true,
              title: true,
              isActive: true
            }
          }
        }
      });
    });

    if (!activityType) {
      throw new AppError('Activity type not found', 404, 'ACTIVITY_TYPE_NOT_FOUND');
    }

    res.json({
      success: true,
      data: activityType
    });
  } catch (error: any) {
    logger.error('Error fetching activity type:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch activity type', 500, 'FETCH_ACTIVITY_TYPE_ERROR');
  }
}));

// Create new activity type - Admin only
router.post('/', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;

    if (!name || name.trim().length === 0) {
      throw new AppError('Activity type name is required', 400, 'MISSING_NAME');
    }

    // Check if activity type with same name already exists
    const existingType = await safePrismaQuery(async (client) => {
      return await client.activityType.findFirst({
        where: {
          name: {
            equals: name.trim(),
            mode: 'insensitive'
          }
        }
      });
    });

    if (existingType) {
      throw new AppError('Activity type with this name already exists', 400, 'DUPLICATE_NAME');
    }

    const newActivityType = await safePrismaQuery(async (client) => {
      return await client.activityType.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          isActive: true
        },
        select: {
          id: true,
          name: true,
          description: true,
          isActive: true,
          createdAt: true
        }
      });
    });

    logger.info('Admin created new activity type', {
      activityTypeId: newActivityType.id,
      name: newActivityType.name,
      adminUserId: req.user!.id
    });

    res.status(201).json({
      success: true,
      message: 'Activity type created successfully',
      data: newActivityType
    });
  } catch (error: any) {
    logger.error('Error creating activity type:', error);
    if (error instanceof AppError) throw error;
    if (error.code === 'P2002') {
      throw new AppError('Activity type with this name already exists', 400, 'DUPLICATE_NAME');
    }
    throw new AppError('Failed to create activity type', 500, 'CREATE_ACTIVITY_TYPE_ERROR');
  }
}));

// Update activity type - Admin only
router.put('/:id', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    if (!name || name.trim().length === 0) {
      throw new AppError('Activity type name is required', 400, 'MISSING_NAME');
    }

    // Check if activity type exists
    const existingType = await safePrismaQuery(async (client) => {
      return await client.activityType.findUnique({
        where: { id: id as string },
        select: { id: true, name: true }
      });
    });

    if (!existingType) {
      throw new AppError('Activity type not found', 404, 'ACTIVITY_TYPE_NOT_FOUND');
    }

    // Check if another activity type with same name exists
    const duplicateType = await safePrismaQuery(async (client) => {
      return await client.activityType.findFirst({
        where: {
          name: {
            equals: name.trim(),
            mode: 'insensitive'
          },
          id: { not: id as string }
        }
      });
    });

    if (duplicateType) {
      throw new AppError('Activity type with this name already exists', 400, 'DUPLICATE_NAME');
    }

    const updatedActivityType = await safePrismaQuery(async (client) => {
      return await client.activityType.update({
        where: { id: id as string },
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          isActive: isActive !== undefined ? isActive : true,
          updatedAt: new Date()
        },
        select: {
          id: true,
          name: true,
          description: true,
          isActive: true,
          updatedAt: true
        }
      });
    });

    logger.info('Admin updated activity type', {
      activityTypeId: id,
      name: updatedActivityType.name,
      adminUserId: req.user!.id
    });

    res.json({
      success: true,
      message: 'Activity type updated successfully',
      data: updatedActivityType
    });
  } catch (error: any) {
    logger.error('Error updating activity type:', error);
    if (error instanceof AppError) throw error;
    if (error.code === 'P2025') {
      throw new AppError('Activity type not found', 404, 'ACTIVITY_TYPE_NOT_FOUND');
    }
    if (error.code === 'P2002') {
      throw new AppError('Activity type with this name already exists', 400, 'DUPLICATE_NAME');
    }
    throw new AppError('Failed to update activity type', 500, 'UPDATE_ACTIVITY_TYPE_ERROR');
  }
}));

// Delete activity type - Admin only
router.delete('/:id', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if activity type has any activities
    const activitiesCount = await safePrismaQuery(async (client) => {
      return await client.activity.count({
        where: { activityTypeId: id as string }
      });
    });

    if (activitiesCount > 0) {
      throw new AppError('Cannot delete activity type with existing activities', 400, 'ACTIVITY_TYPE_HAS_ACTIVITIES');
    }

    await safePrismaQuery(async (client) => {
      return await client.activityType.delete({
        where: { id: id as string }
      });
    });

    logger.info('Admin deleted activity type', {
      activityTypeId: id,
      adminUserId: req.user!.id
    });

    res.json({
      success: true,
      message: 'Activity type deleted successfully'
    });
  } catch (error: any) {
    logger.error('Error deleting activity type:', error);
    if (error instanceof AppError) throw error;
    if (error.code === 'P2025') {
      throw new AppError('Activity type not found', 404, 'ACTIVITY_TYPE_NOT_FOUND');
    }
    throw new AppError('Failed to delete activity type', 500, 'DELETE_ACTIVITY_TYPE_ERROR');
  }
}));

export default router;
