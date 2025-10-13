import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticateToken, requireRole } from '../middleware/auth';
import { prisma, safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';

const router = Router();

// Get session templates
router.get('/', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { venueId } = req.query;

    const where: any = { isActive: true };
    if (venueId) {
      where.venueId = venueId as string;
    }

    const templates = await safePrismaQuery(async (client) => {
      return await client.sessionTemplate.findMany({
        where,
        include: {
          venue: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: { name: 'asc' }
      });
    });

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    logger.error('Error fetching session templates:', error);
    throw new AppError('Failed to fetch session templates', 500, 'SESSION_TEMPLATES_FETCH_ERROR');
  }
}));

// Get session template by ID
router.get('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const template = await safePrismaQuery(async (client) => {
      return await client.sessionTemplate.findUnique({
        where: { id },
        include: {
          venue: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });
    });

    if (!template) {
      throw new AppError('Session template not found', 404, 'SESSION_TEMPLATE_NOT_FOUND');
    }

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    logger.error('Error fetching session template:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch session template', 500, 'SESSION_TEMPLATE_FETCH_ERROR');
  }
}));

// Create session template
router.post('/', authenticateToken, requireRole(['admin', 'coordinator']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      venueId,
      blocks // Array of block configurations
    } = req.body;

    if (!name || !blocks || !Array.isArray(blocks)) {
      throw new AppError('Missing required fields', 400, 'MISSING_REQUIRED_FIELDS');
    }

    // Validate venue exists and user has access (if venueId provided)
    if (venueId) {
      const venue = await safePrismaQuery(async (client) => {
        return await client.venue.findFirst({
          where: {
            id: venueId,
            ownerId: req.user!.id
          }
        });
      });

      if (!venue) {
        throw new AppError('Venue not found or access denied', 404, 'VENUE_NOT_FOUND');
      }
    }

    // Validate blocks structure
    for (const block of blocks) {
      if (!block.name || !block.startTime || !block.endTime || !block.capacity || !block.price) {
        throw new AppError('Invalid block configuration', 400, 'INVALID_BLOCK_CONFIG');
      }
    }

    const template = await safePrismaQuery(async (client) => {
      return await client.sessionTemplate.create({
        data: {
          name,
          description,
          venueId: venueId || null,
          blocks: blocks.map((block: any) => ({
            name: block.name,
            startTime: block.startTime,
            endTime: block.endTime,
            capacity: parseInt(block.capacity),
            price: parseFloat(block.price)
          }))
        },
        include: {
          venue: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });
    });

    logger.info('Session template created', {
      templateId: template.id,
      name: template.name,
      createdBy: req.user!.id
    });

    res.status(201).json({
      success: true,
      message: 'Session template created successfully',
      data: template
    });
  } catch (error) {
    logger.error('Error creating session template:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to create session template', 500, 'SESSION_TEMPLATE_CREATE_ERROR');
  }
}));

// Update session template
router.put('/:id', authenticateToken, requireRole(['admin', 'coordinator']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      venueId,
      blocks,
      isActive
    } = req.body;

    // Validate template exists and user has access
    const existingTemplate = await safePrismaQuery(async (client) => {
      return await client.sessionTemplate.findFirst({
        where: {
          id,
          OR: [
            { venueId: null }, // Global templates
            { venue: { ownerId: req.user!.id } } // User's venue templates
          ]
        }
      });
    });

    if (!existingTemplate) {
      throw new AppError('Session template not found or access denied', 404, 'SESSION_TEMPLATE_NOT_FOUND');
    }

    // Validate venue if provided
    if (venueId) {
      const venue = await safePrismaQuery(async (client) => {
        return await client.venue.findFirst({
          where: {
            id: venueId,
            ownerId: req.user!.id
          }
        });
      });

      if (!venue) {
        throw new AppError('Venue not found or access denied', 404, 'VENUE_NOT_FOUND');
      }
    }

    // Validate blocks if provided
    if (blocks && Array.isArray(blocks)) {
      for (const block of blocks) {
        if (!block.name || !block.startTime || !block.endTime || !block.capacity || !block.price) {
          throw new AppError('Invalid block configuration', 400, 'INVALID_BLOCK_CONFIG');
        }
      }
    }

    const updatedTemplate = await safePrismaQuery(async (client) => {
      return await client.sessionTemplate.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(venueId !== undefined && { venueId: venueId || null }),
          ...(blocks && { blocks: blocks.map((block: any) => ({
            name: block.name,
            startTime: block.startTime,
            endTime: block.endTime,
            capacity: parseInt(block.capacity),
            price: parseFloat(block.price)
          })) }),
          ...(isActive !== undefined && { isActive })
        },
        include: {
          venue: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });
    });

    logger.info('Session template updated', {
      templateId: id,
      updatedBy: req.user!.id
    });

    res.json({
      success: true,
      message: 'Session template updated successfully',
      data: updatedTemplate
    });
  } catch (error) {
    logger.error('Error updating session template:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to update session template', 500, 'SESSION_TEMPLATE_UPDATE_ERROR');
  }
}));

// Delete session template
router.delete('/:id', authenticateToken, requireRole(['admin', 'coordinator']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Validate template exists and user has access
    const template = await safePrismaQuery(async (client) => {
      return await client.sessionTemplate.findFirst({
        where: {
          id,
          OR: [
            { venueId: null }, // Global templates
            { venue: { ownerId: req.user!.id } } // User's venue templates
          ]
        }
      });
    });

    if (!template) {
      throw new AppError('Session template not found or access denied', 404, 'SESSION_TEMPLATE_NOT_FOUND');
    }

    // Soft delete by setting isActive to false
    await safePrismaQuery(async (client) => {
      return await client.sessionTemplate.update({
        where: { id },
        data: { isActive: false }
      });
    });

    logger.info('Session template deleted', {
      templateId: id,
      deletedBy: req.user!.id
    });

    res.json({
      success: true,
      message: 'Session template deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting session template:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to delete session template', 500, 'SESSION_TEMPLATE_DELETE_ERROR');
  }
}));

// Apply template to activity sessions
router.post('/:id/apply', authenticateToken, requireRole(['admin', 'coordinator']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id: templateId } = req.params;
    const {
      activityId,
      sessionIds // Array of session IDs to apply template to
    } = req.body;

    if (!activityId || !sessionIds || !Array.isArray(sessionIds)) {
      throw new AppError('Missing required fields', 400, 'MISSING_REQUIRED_FIELDS');
    }

    // Validate template exists
    const template = await safePrismaQuery(async (client) => {
      return await client.sessionTemplate.findUnique({
        where: { id: templateId }
      });
    });

    if (!template) {
      throw new AppError('Session template not found', 404, 'SESSION_TEMPLATE_NOT_FOUND');
    }

    // Validate activity exists and user has access
    const activity = await safePrismaQuery(async (client) => {
      return await client.activity.findFirst({
        where: {
          id: activityId,
          ownerId: req.user!.id
        }
      });
    });

    if (!activity) {
      throw new AppError('Activity not found or access denied', 404, 'ACTIVITY_NOT_FOUND');
    }

    // Apply template to sessions
    const appliedSessions = [];
    for (const sessionId of sessionIds) {
      // Validate session exists
      const session = await safePrismaQuery(async (client) => {
        return await client.session.findFirst({
          where: {
            id: sessionId,
            activityId
          }
        });
      });

      if (!session) {
        throw new AppError(`Session ${sessionId} not found`, 404, 'SESSION_NOT_FOUND');
      }

      // Create session blocks from template
      const blocks = template.blocks as any[];
      await safePrismaQuery(async (client) => {
        return await client.sessionBlock.createMany({
          data: blocks.map((block: any) => ({
            sessionId,
            activityId,
            name: block.name,
            startTime: block.startTime,
            endTime: block.endTime,
            capacity: parseInt(block.capacity),
            price: parseFloat(block.price)
          }))
        });
      });

      appliedSessions.push({
        sessionId,
        blocksCount: blocks.length
      });
    }

    logger.info('Session template applied', {
      templateId,
      activityId,
      sessionsCount: sessionIds.length,
      appliedBy: req.user!.id
    });

    res.status(201).json({
      success: true,
      message: 'Session template applied successfully',
      data: {
        appliedSessions,
        totalBlocksCreated: appliedSessions.reduce((sum, session) => sum + session.blocksCount, 0)
      }
    });
  } catch (error) {
    logger.error('Error applying session template:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to apply session template', 500, 'SESSION_TEMPLATE_APPLY_ERROR');
  }
}));

export default router;
