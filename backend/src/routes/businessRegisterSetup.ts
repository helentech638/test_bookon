import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import { safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';

const router = Router();

// Get register setups for business
router.get('/', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { search, status, page = 1, limit = 20 } = req.query;
  
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

    // Get register setups for the user
    const registerSetups = await safePrismaQuery(async (client) => {
      try {
        return await client.registerSetup.findMany({
          where: {
            createdBy: userId,
            ...(search && {
              OR: [
                { name: { contains: search as string, mode: 'insensitive' } },
                { description: { contains: search as string, mode: 'insensitive' } }
              ]
            }),
            ...(status && status !== 'all' && { isActive: status === 'active' })
          },
          orderBy: { createdAt: 'desc' },
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit),
          include: {
            creator: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        });
      } catch (error: any) {
        if (error.code === 'P2021' || error.message?.includes('does not exist')) {
          // Table doesn't exist yet, return empty array
          logger.warn('RegisterSetup table does not exist yet, returning empty array');
          return [];
        }
        throw error;
      }
    });

    const total = await safePrismaQuery(async (client) => {
      return await client.registerSetup.count({
        where: {
          createdBy: userId,
          ...(search && {
            OR: [
              { name: { contains: search as string, mode: 'insensitive' } },
              { description: { contains: search as string, mode: 'insensitive' } }
            ]
          }),
          ...(status && status !== 'all' && { isActive: status === 'active' })
        }
      });
    });

    res.status(200).json({
      success: true,
      data: {
        registerSetups,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching register setups:', error);
    throw error;
  }
}));

// Create new register setup
router.post('/', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const {
    name,
    description,
    defaultCapacity,
    allowWaitlist,
    autoConfirm,
    requireApproval,
    cancellationPolicy,
    refundPolicy
  } = req.body;

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
    if (!name || !description) {
      throw new AppError('Missing required fields', 400, 'MISSING_FIELDS');
    }

    // Create the register setup
    const registerSetup = await safePrismaQuery(async (client) => {
      return await client.registerSetup.create({
        data: {
          name,
          description,
          defaultCapacity: Number(defaultCapacity) || 20,
          allowWaitlist: allowWaitlist || false,
          autoConfirm: autoConfirm || false,
          requireApproval: requireApproval || false,
          cancellationPolicy: cancellationPolicy || null,
          refundPolicy: refundPolicy || null,
          isActive: true,
          createdBy: userId
        },
        include: {
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });
    });

    logger.info('Register setup created successfully', { registerSetupId: registerSetup.id, userId });

    res.status(201).json({
      success: true,
      message: 'Register setup created successfully',
      data: registerSetup
    });

  } catch (error) {
    logger.error('Error creating register setup:', error);
    throw error;
  }
}));

// Update register setup
router.put('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const updateData = req.body;

  if (!id) {
    throw new AppError('Register setup ID is required', 400, 'MISSING_SETUP_ID');
  }

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

    // Check if register setup exists and belongs to user
    const existingSetup = await safePrismaQuery(async (client) => {
      return await client.registerSetup.findFirst({
        where: {
          id: id,
          createdBy: userId
        }
      });
    });

    if (!existingSetup) {
      throw new AppError('Register setup not found or access denied', 404, 'SETUP_NOT_FOUND');
    }

    // Update the register setup
    const updatedSetup = await safePrismaQuery(async (client) => {
      return await client.registerSetup.update({
        where: { id: id },
        data: {
          ...updateData,
          updatedAt: new Date()
        },
        include: {
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });
    });

    logger.info('Register setup updated successfully', { registerSetupId: id, userId });

    res.status(200).json({
      success: true,
      message: 'Register setup updated successfully',
      data: updatedSetup
    });

  } catch (error) {
    logger.error('Error updating register setup:', error);
    throw error;
  }
}));

// Delete register setup
router.delete('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  if (!id) {
    throw new AppError('Register setup ID is required', 400, 'MISSING_SETUP_ID');
  }

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

    // Check if register setup exists and belongs to user
    const existingSetup = await safePrismaQuery(async (client) => {
      return await client.registerSetup.findFirst({
        where: {
          id: id,
          createdBy: userId
        }
      });
    });

    if (!existingSetup) {
      throw new AppError('Register setup not found or access denied', 404, 'SETUP_NOT_FOUND');
    }

    // Delete the register setup
    await safePrismaQuery(async (client) => {
      return await client.registerSetup.delete({
        where: { id: id }
      });
    });

    logger.info('Register setup deleted successfully', { registerSetupId: id, userId });

    res.status(200).json({
      success: true,
      message: 'Register setup deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting register setup:', error);
    throw error;
  }
}));

export default router;
