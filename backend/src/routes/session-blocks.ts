import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticateToken, requireRole } from '../middleware/auth';
import { prisma, safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';

const router = Router();

// Get session blocks for an activity
router.get('/activity/:activityId', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { activityId } = req.params;
    const { sessionId } = req.query;

    const where: any = { activityId };
    if (sessionId) {
      where.sessionId = sessionId as string;
    }

    const sessionBlocks = await safePrismaQuery(async (client) => {
      return await client.sessionBlock.findMany({
        where,
        include: {
          session: {
            select: {
              id: true,
              date: true,
              startTime: true,
              endTime: true
            }
          },
          activity: {
            select: {
              id: true,
              title: true,
              isWraparoundCare: true
            }
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
        },
        orderBy: [
          { session: { date: 'asc' } },
          { startTime: 'asc' }
        ]
      });
    });

    res.json({
      success: true,
      data: sessionBlocks
    });
  } catch (error) {
    logger.error('Error fetching session blocks:', error);
    throw new AppError('Failed to fetch session blocks', 500, 'SESSION_BLOCKS_FETCH_ERROR');
  }
}));

// Create session blocks for an activity
router.post('/', authenticateToken, requireRole(['admin', 'coordinator']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const {
      activityId,
      sessionId,
      blocks // Array of { name, startTime, endTime, capacity, price }
    } = req.body;

    if (!activityId || !sessionId || !blocks || !Array.isArray(blocks)) {
      throw new AppError('Missing required fields', 400, 'MISSING_REQUIRED_FIELDS');
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
      throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
    }

    // Create session blocks
    const createdBlocks = await safePrismaQuery(async (client) => {
      return await client.sessionBlock.createMany({
        data: blocks.map((block: any) => ({
          sessionId,
          activityId,
          name: block.name,
          startTime: block.startTime,
          endTime: block.endTime,
          capacity: parseInt(block.capacity) || 0,
          price: parseFloat(block.price) || 0
        }))
      });
    });

    // Fetch created blocks with details
    const sessionBlocks = await safePrismaQuery(async (client) => {
      return await client.sessionBlock.findMany({
        where: {
          sessionId,
          activityId
        },
        include: {
          session: {
            select: {
              id: true,
              date: true
            }
          }
        },
        orderBy: { startTime: 'asc' }
      });
    });

    logger.info('Session blocks created', {
      activityId,
      sessionId,
      blocksCount: blocks.length,
      createdBy: req.user!.id
    });

    res.status(201).json({
      success: true,
      message: 'Session blocks created successfully',
      data: sessionBlocks
    });
  } catch (error) {
    logger.error('Error creating session blocks:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to create session blocks', 500, 'SESSION_BLOCKS_CREATE_ERROR');
  }
}));

// Update session block
router.put('/:id', authenticateToken, requireRole(['admin', 'coordinator']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      startTime,
      endTime,
      capacity,
      price,
      isActive
    } = req.body;

    // Validate session block exists and user has access
    const sessionBlock = await safePrismaQuery(async (client) => {
      return await client.sessionBlock.findFirst({
        where: {
          id,
          activity: {
            ownerId: req.user!.id
          }
        },
        include: {
          activity: true
        }
      });
    });

    if (!sessionBlock) {
      throw new AppError('Session block not found or access denied', 404, 'SESSION_BLOCK_NOT_FOUND');
    }

    // Update session block
    const updatedBlock = await safePrismaQuery(async (client) => {
      return await client.sessionBlock.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(startTime && { startTime }),
          ...(endTime && { endTime }),
          ...(capacity !== undefined && { capacity: parseInt(capacity) }),
          ...(price !== undefined && { price: parseFloat(price) }),
          ...(isActive !== undefined && { isActive })
        },
        include: {
          session: {
            select: {
              id: true,
              date: true
            }
          },
          activity: {
            select: {
              id: true,
              title: true
            }
          }
        }
      });
    });

    logger.info('Session block updated', {
      sessionBlockId: id,
      updatedBy: req.user!.id
    });

    res.json({
      success: true,
      message: 'Session block updated successfully',
      data: updatedBlock
    });
  } catch (error) {
    logger.error('Error updating session block:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to update session block', 500, 'SESSION_BLOCK_UPDATE_ERROR');
  }
}));

// Delete session block
router.delete('/:id', authenticateToken, requireRole(['admin', 'coordinator']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Validate session block exists and user has access
    const sessionBlock = await safePrismaQuery(async (client) => {
      return await client.sessionBlock.findFirst({
        where: {
          id,
          activity: {
            ownerId: req.user!.id
          }
        },
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
      });
    });

    if (!sessionBlock) {
      throw new AppError('Session block not found or access denied', 404, 'SESSION_BLOCK_NOT_FOUND');
    }

    // Check if there are active bookings
    if (sessionBlock._count.bookings > 0) {
      throw new AppError('Cannot delete session block with active bookings', 400, 'SESSION_BLOCK_HAS_BOOKINGS');
    }

    // Delete session block
    await safePrismaQuery(async (client) => {
      return await client.sessionBlock.delete({
        where: { id }
      });
    });

    logger.info('Session block deleted', {
      sessionBlockId: id,
      deletedBy: req.user!.id
    });

    res.json({
      success: true,
      message: 'Session block deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting session block:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to delete session block', 500, 'SESSION_BLOCK_DELETE_ERROR');
  }
}));

// Clone session blocks to multiple sessions
router.post('/clone', authenticateToken, requireRole(['admin', 'coordinator']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const {
      sourceSessionId,
      targetSessionIds, // Array of session IDs to clone to
      blocks // Array of blocks to clone
    } = req.body;

    if (!sourceSessionId || !targetSessionIds || !Array.isArray(targetSessionIds) || !blocks) {
      throw new AppError('Missing required fields', 400, 'MISSING_REQUIRED_FIELDS');
    }

    // Validate source session exists and user has access
    const sourceSession = await safePrismaQuery(async (client) => {
      return await client.session.findFirst({
        where: {
          id: sourceSessionId,
          activity: {
            ownerId: req.user!.id
          }
        },
        include: {
          activity: true
        }
      });
    });

    if (!sourceSession) {
      throw new AppError('Source session not found or access denied', 404, 'SESSION_NOT_FOUND');
    }

    // Clone blocks to target sessions
    const clonedBlocks = [];
    for (const targetSessionId of targetSessionIds) {
      // Validate target session exists
      const targetSession = await safePrismaQuery(async (client) => {
        return await client.session.findFirst({
          where: {
            id: targetSessionId,
            activityId: sourceSession.activityId
          }
        });
      });

      if (!targetSession) {
        throw new AppError(`Target session ${targetSessionId} not found`, 404, 'TARGET_SESSION_NOT_FOUND');
      }

      // Create blocks for this session
      const sessionBlocks = await safePrismaQuery(async (client) => {
        return await client.sessionBlock.createMany({
          data: blocks.map((block: any) => ({
            sessionId: targetSessionId,
            activityId: sourceSession.activityId,
            name: block.name,
            startTime: block.startTime,
            endTime: block.endTime,
            capacity: parseInt(block.capacity) || 0,
            price: parseFloat(block.price) || 0
          }))
        });
      });

      clonedBlocks.push({
        sessionId: targetSessionId,
        blocksCount: blocks.length
      });
    }

    logger.info('Session blocks cloned', {
      sourceSessionId,
      targetSessionsCount: targetSessionIds.length,
      clonedBy: req.user!.id
    });

    res.status(201).json({
      success: true,
      message: 'Session blocks cloned successfully',
      data: {
        clonedSessions: clonedBlocks,
        totalBlocksCreated: clonedBlocks.reduce((sum, session) => sum + session.blocksCount, 0)
      }
    });
  } catch (error) {
    logger.error('Error cloning session blocks:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to clone session blocks', 500, 'SESSION_BLOCKS_CLONE_ERROR');
  }
}));

export default router;
