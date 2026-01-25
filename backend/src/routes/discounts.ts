import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';

const router = Router();

// Validate discount code
router.post('/validate', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { code, amount } = req.body;
    const userId = req.user!.id;

    if (!code || !amount) {
      throw new AppError('Code and amount are required', 400, 'MISSING_PARAMETERS');
    }

    // Find active discount code
    const discount = await prisma.discountCode.findFirst({
      where: {
        code: code.toUpperCase(),
        isActive: true,
        startDate: { lte: new Date() },
        endDate: { gte: new Date() }
      }
    });

    if (!discount) {
      return res.json({
        success: false,
        valid: false,
        message: 'Invalid or expired discount code'
      });
    }

    // Check minimum amount requirement
    if (discount.minAmount && amount < discount.minAmount) {
      return res.json({
        success: false,
        valid: false,
        message: `Minimum order amount of £${discount.minAmount} required`
      });
    }

    // Check usage limits
    const usageCount = await prisma.discountUsage.count({
      where: {
        discountCodeId: discount.id,
        userId: userId
      }
    });

    if (discount.maxUsesPerUser && usageCount >= discount.maxUsesPerUser) {
      return res.json({
        success: false,
        valid: false,
        message: 'You have already used this discount code'
      });
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (discount.type === 'percentage') {
      discountAmount = (amount * discount.value) / 100;
      if (discount.maxDiscountAmount) {
        discountAmount = Math.min(discountAmount, discount.maxDiscountAmount);
      }
    } else {
      discountAmount = Math.min(discount.value, amount);
    }

    res.json({
      success: true,
      valid: true,
      discount: {
        code: discount.code,
        type: discount.type,
        value: discount.value,
        amount: discountAmount,
        description: discount.description
      }
    });

  } catch (error) {
    logger.error('Error validating discount code:', error);
    throw error;
  }
}));

// Create discount code (admin only)
router.post('/create', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { 
      code, 
      type, 
      value, 
      description, 
      minAmount, 
      maxDiscountAmount,
      maxUsesPerUser,
      startDate,
      endDate 
    } = req.body;

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (!user || user.role !== 'admin') {
      throw new AppError('Admin access required', 403, 'ADMIN_ACCESS_REQUIRED');
    }

    if (!code || !type || !value) {
      throw new AppError('Code, type, and value are required', 400, 'MISSING_PARAMETERS');
    }

    // Check if code already exists
    const existingCode = await prisma.discountCode.findFirst({
      where: { code: code.toUpperCase() }
    });

    if (existingCode) {
      throw new AppError('Discount code already exists', 400, 'CODE_EXISTS');
    }

    const discount = await prisma.discountCode.create({
      data: {
        code: code.toUpperCase(),
        type,
        value,
        description: description || '',
        minAmount: minAmount || null,
        maxDiscountAmount: maxDiscountAmount || null,
        maxUsesPerUser: maxUsesPerUser || null,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        isActive: true,
        createdBy: userId
      }
    });

    logger.info(`Discount code created: ${code} by admin ${userId}`);

    res.status(201).json({
      success: true,
      message: 'Discount code created successfully',
      data: discount
    });

  } catch (error) {
    logger.error('Error creating discount code:', error);
    throw error;
  }
}));

// Get all discount codes (admin only)
router.get('/list', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (!user || user.role !== 'admin') {
      throw new AppError('Admin access required', 403, 'ADMIN_ACCESS_REQUIRED');
    }

    const discounts = await prisma.discountCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        creator: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        _count: {
          select: {
            usages: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: discounts
    });

  } catch (error) {
    logger.error('Error fetching discount codes:', error);
    throw error;
  }
}));

// Apply discount code to booking
router.post('/apply', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { code, bookingId, discountAmount } = req.body;
    const userId = req.user!.id;

    if (!code || !bookingId || !discountAmount) {
      throw new AppError('Code, bookingId, and discountAmount are required', 400, 'MISSING_PARAMETERS');
    }

    // Find discount code
    const discount = await prisma.discountCode.findFirst({
      where: { code: code.toUpperCase() }
    });

    if (!discount) {
      throw new AppError('Invalid discount code', 400, 'INVALID_CODE');
    }

    // Record usage
    await prisma.discountUsage.create({
      data: {
        discountCodeId: discount.id,
        userId: userId,
        bookingId: bookingId,
        discountAmount: discountAmount,
        appliedAt: new Date()
      }
    });

    logger.info(`Discount code ${code} applied to booking ${bookingId} by user ${userId}`);

    res.json({
      success: true,
      message: 'Discount code applied successfully'
    });

  } catch (error) {
    logger.error('Error applying discount code:', error);
    throw error;
  }
}));

export default router;
