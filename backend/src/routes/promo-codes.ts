import { Router, Request, Response } from 'express';
import { authenticateToken, requireAdminOrStaff } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

// Validate promo code
router.post('/validate', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { code, amount, activityId } = req.body;
  const userId = req.user!.id;

  try {
    const promoCode = await prisma.promoCode.findUnique({
      where: { code: code.toUpperCase() }
    });

    if (!promoCode) {
      return res.json({
        success: false,
        message: 'Invalid promo code'
      });
    }

    // Check if code is active and valid
    const now = new Date();
    if (!promoCode.active || 
        promoCode.validFrom > now || 
        (promoCode.validUntil && promoCode.validUntil < now)) {
      return res.json({
        success: false,
        message: 'Promo code is not valid'
      });
    }

    // Check usage limits
    if (promoCode.maxUses && promoCode.usedCount >= promoCode.maxUses) {
      return res.json({
        success: false,
        message: 'Promo code has reached maximum usage limit'
      });
    }

    // Check minimum amount
    if (promoCode.minAmount && amount < promoCode.minAmount) {
      return res.json({
        success: false,
        message: `Minimum amount required: £${promoCode.minAmount}`
      });
    }

    // Check if applicable to activity
    if (promoCode.applicableTo.includes('activities') && 
        promoCode.activityIds.length > 0 && 
        !promoCode.activityIds.includes(activityId)) {
      return res.json({
        success: false,
        message: 'Promo code is not applicable to this activity'
      });
    }

    // Calculate discount
    let discountAmount = 0;
    if (promoCode.type === 'percentage') {
      discountAmount = (amount * promoCode.value) / 100;
    } else if (promoCode.type === 'fixed_amount') {
      discountAmount = promoCode.value;
    }

    // Ensure discount doesn't exceed amount
    discountAmount = Math.min(discountAmount, amount);

    res.json({
      success: true,
      data: {
        code: promoCode.code,
        name: promoCode.name,
        type: promoCode.type,
        discountAmount,
        finalAmount: amount - discountAmount
      }
    });
  } catch (error) {
    logger.error('Error validating promo code:', error);
    throw new AppError('Failed to validate promo code', 500, 'PROMO_CODE_VALIDATION_ERROR');
  }
}));

// Apply promo code to booking
router.post('/apply', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { code, bookingId } = req.body;
  const userId = req.user!.id;

  try {
    const promoCode = await prisma.promoCode.findUnique({
      where: { code: code.toUpperCase() }
    });

    if (!promoCode) {
      throw new AppError('Invalid promo code', 400, 'INVALID_PROMO_CODE');
    }

    // Check if already used for this booking
    const existingUsage = await prisma.promoCodeUsage.findFirst({
      where: {
        promoCodeId: promoCode.id,
        bookingId
      }
    });

    if (existingUsage) {
      throw new AppError('Promo code already applied to this booking', 400, 'PROMO_CODE_ALREADY_USED');
    }

    // Get booking details
    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        parentId: userId
      },
      include: {
        activity: true
      }
    });

    if (!booking) {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    // Validate promo code for this booking
    const now = new Date();
    if (!promoCode.active || 
        promoCode.validFrom > now || 
        (promoCode.validUntil && promoCode.validUntil < now)) {
      throw new AppError('Promo code is not valid', 400, 'PROMO_CODE_INVALID');
    }

    if (promoCode.maxUses && promoCode.usedCount >= promoCode.maxUses) {
      throw new AppError('Promo code has reached maximum usage limit', 400, 'PROMO_CODE_LIMIT_REACHED');
    }

    if (promoCode.minAmount && booking.amount < promoCode.minAmount) {
      throw new AppError(`Minimum amount required: £${promoCode.minAmount}`, 400, 'PROMO_CODE_MIN_AMOUNT');
    }

    // Calculate discount
    let discountAmount = 0;
    if (promoCode.type === 'percentage') {
      discountAmount = (booking.amount * promoCode.value) / 100;
    } else if (promoCode.type === 'fixed_amount') {
      discountAmount = promoCode.value;
    }

    discountAmount = Math.min(discountAmount, booking.amount);

    // Create usage record
    const usage = await prisma.promoCodeUsage.create({
      data: {
        promoCodeId: promoCode.id,
        bookingId,
        userId,
        discountAmount
      }
    });

    // Update promo code usage count
    await prisma.promoCode.update({
      where: { id: promoCode.id },
      data: { usedCount: { increment: 1 } }
    });

    // Update booking with discount
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        totalAmount: booking.amount - discountAmount
      }
    });

    res.json({
      success: true,
      data: {
        usage,
        discountAmount,
        finalAmount: updatedBooking.totalAmount
      }
    });
  } catch (error) {
    logger.error('Error applying promo code:', error);
    throw new AppError('Failed to apply promo code', 500, 'PROMO_CODE_APPLY_ERROR');
  }
}));

// Admin: Create promo code
router.post('/', authenticateToken, requireAdminOrStaff, asyncHandler(async (req: Request, res: Response) => {
  const {
    code,
    name,
    description,
    type,
    value,
    minAmount,
    maxUses,
    validFrom,
    validUntil,
    applicableTo,
    venueIds,
    activityIds
  } = req.body;
  const userId = req.user!.id;

  try {
    const promoCode = await prisma.promoCode.create({
      data: {
        code: code.toUpperCase(),
        name,
        description,
        type,
        value,
        minAmount,
        maxUses,
        validFrom: new Date(validFrom),
        validUntil: validUntil ? new Date(validUntil) : null,
        applicableTo: applicableTo || ['all'],
        venueIds: venueIds || [],
        activityIds: activityIds || [],
        createdBy: userId
      }
    });

    res.json({
      success: true,
      data: promoCode
    });
  } catch (error) {
    logger.error('Error creating promo code:', error);
    throw new AppError('Failed to create promo code', 500, 'PROMO_CODE_CREATE_ERROR');
  }
}));

// Admin: Get all promo codes
router.get('/', authenticateToken, requireAdminOrStaff, asyncHandler(async (req: Request, res: Response) => {
  try {
    const promoCodes = await prisma.promoCode.findMany({
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        usages: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true
              }
            },
            booking: {
              include: {
                activity: {
                  select: {
                    title: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: promoCodes
    });
  } catch (error) {
    logger.error('Error fetching promo codes:', error);
    throw new AppError('Failed to fetch promo codes', 500, 'PROMO_CODES_FETCH_ERROR');
  }
}));

// Admin: Update promo code
router.put('/:id', authenticateToken, requireAdminOrStaff, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;

  try {
    const promoCode = await prisma.promoCode.update({
      where: { id },
      data: {
        ...updateData,
        code: updateData.code ? updateData.code.toUpperCase() : undefined,
        validFrom: updateData.validFrom ? new Date(updateData.validFrom) : undefined,
        validUntil: updateData.validUntil ? new Date(updateData.validUntil) : undefined
      }
    });

    res.json({
      success: true,
      data: promoCode
    });
  } catch (error) {
    logger.error('Error updating promo code:', error);
    throw new AppError('Failed to update promo code', 500, 'PROMO_CODE_UPDATE_ERROR');
  }
}));

// Admin: Delete promo code
router.delete('/:id', authenticateToken, requireAdminOrStaff, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    await prisma.promoCode.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Promo code deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting promo code:', error);
    throw new AppError('Failed to delete promo code', 500, 'PROMO_CODE_DELETE_ERROR');
  }
}));

export default router;
