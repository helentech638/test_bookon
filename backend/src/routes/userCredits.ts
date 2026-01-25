import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';

const router = Router();

// Get user credit balance
router.get('/credit-balance', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get user's credit balance
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        id: true, 
        firstName: true, 
        lastName: true, 
        creditBalance: true 
      }
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    res.json({
      success: true,
      data: {
        balance: user.creditBalance || 0,
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`
      }
    });

  } catch (error) {
    logger.error('Error fetching credit balance:', error);
    throw error;
  }
}));

// Add credit to user account (admin only)
router.post('/credit-balance/add', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { amount, reason, targetUserId } = req.body;

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (!user || user.role !== 'admin') {
      throw new AppError('Admin access required', 403, 'ADMIN_ACCESS_REQUIRED');
    }

    if (!amount || amount <= 0) {
      throw new AppError('Invalid amount', 400, 'INVALID_AMOUNT');
    }

    const targetUser = targetUserId || userId;
    
    // Update user's credit balance
    const updatedUser = await prisma.user.update({
      where: { id: targetUser },
      data: {
        creditBalance: {
          increment: amount
        }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        creditBalance: true
      }
    });

    // Log the credit addition
    await prisma.creditTransaction.create({
      data: {
        userId: targetUser,
        amount: amount,
        type: 'credit',
        reason: reason || 'Manual credit addition',
        adminId: userId,
        createdAt: new Date()
      }
    });

    logger.info(`Credit added: ${amount} to user ${targetUser} by admin ${userId}`);

    res.json({
      success: true,
      message: `£${amount} credit added successfully`,
      data: {
        userId: updatedUser.id,
        userName: `${updatedUser.firstName} ${updatedUser.lastName}`,
        newBalance: updatedUser.creditBalance
      }
    });

  } catch (error) {
    logger.error('Error adding credit:', error);
    throw error;
  }
}));

// Get credit transaction history
router.get('/credit-transactions', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { page = 1, limit = 20 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const transactions = await prisma.creditTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit),
      select: {
        id: true,
        amount: true,
        type: true,
        reason: true,
        createdAt: true,
        admin: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    const total = await prisma.creditTransaction.count({
      where: { userId }
    });

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching credit transactions:', error);
    throw error;
  }
}));

export default router;
