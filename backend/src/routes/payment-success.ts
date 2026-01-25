import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

// Get payment success details
router.get('/:bookingId', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { bookingId } = req.params;
  const userId = req.user!.id;

  try {
    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        parentId: userId
      },
      include: {
        activity: {
          include: {
            venue: true
          }
        },
        child: true,
        parent: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        },
        paymentSuccesses: true,
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!booking) {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    // Get payment success record
    let paymentSuccess = booking.paymentSuccesses[0];
    if (!paymentSuccess && booking.payments[0]) {
      // Create payment success record if it doesn't exist
      paymentSuccess = await prisma.paymentSuccess.create({
        data: {
          bookingId,
          paymentIntentId: booking.payments[0].stripePaymentIntentId || `manual-${bookingId}`,
          amount: booking.amount,
          currency: booking.currency,
          paymentMethod: booking.paymentMethod
        }
      });
    }

    res.json({
      success: true,
      data: {
        booking: {
          id: booking.id,
          amount: booking.amount,
          currency: booking.currency,
          paymentMethod: booking.paymentMethod,
          activityDate: booking.activityDate,
          activityTime: booking.activityTime,
          activity: {
            title: booking.activity.title,
            venue: {
              name: booking.activity.venue.name
            }
          },
          child: {
            firstName: booking.child.firstName,
            lastName: booking.child.lastName
          },
          parent: booking.parent
        },
        paymentSuccess: paymentSuccess
      }
    });
  } catch (error) {
    logger.error('Error fetching payment success details:', error);
    throw new AppError('Failed to fetch payment success details', 500, 'PAYMENT_SUCCESS_FETCH_ERROR');
  }
}));

// Mark receipt as sent
router.post('/:bookingId/receipt-sent', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { bookingId } = req.params;
  const userId = req.user!.id;

  try {
    // Verify booking belongs to user
    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        parentId: userId
      }
    });

    if (!booking) {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    // Update payment success record
    const paymentSuccess = await prisma.paymentSuccess.updateMany({
      where: { bookingId },
      data: { receiptSent: true }
    });

    res.json({
      success: true,
      message: 'Receipt marked as sent'
    });
  } catch (error) {
    logger.error('Error marking receipt as sent:', error);
    throw new AppError('Failed to mark receipt as sent', 500, 'RECEIPT_SENT_ERROR');
  }
}));

// Mark calendar as added
router.post('/:bookingId/calendar-added', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { bookingId } = req.params;
  const userId = req.user!.id;

  try {
    // Verify booking belongs to user
    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        parentId: userId
      }
    });

    if (!booking) {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    // Update payment success record
    const paymentSuccess = await prisma.paymentSuccess.updateMany({
      where: { bookingId },
      data: { calendarAdded: true }
    });

    res.json({
      success: true,
      message: 'Calendar marked as added'
    });
  } catch (error) {
    logger.error('Error marking calendar as added:', error);
    throw new AppError('Failed to mark calendar as added', 500, 'CALENDAR_ADDED_ERROR');
  }
}));

// Generate receipt data
router.get('/:bookingId/receipt', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { bookingId } = req.params;
  const userId = req.user!.id;

  try {
    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        parentId: userId
      },
      include: {
        activity: {
          include: {
            venue: true
          }
        },
        child: true,
        parent: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!booking) {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    const receiptData = {
      bookingId: booking.id,
      receiptNumber: `RCP-${booking.id.slice(-8).toUpperCase()}`,
      date: booking.createdAt,
      parent: booking.parent,
      child: booking.child,
      activity: {
        title: booking.activity.title,
        venue: booking.activity.venue.name,
        date: booking.activityDate,
        time: booking.activityTime
      },
      payment: {
        amount: booking.amount,
        currency: booking.currency,
        method: booking.paymentMethod,
        paymentIntentId: booking.payments[0]?.stripePaymentIntentId
      }
    };

    res.json({
      success: true,
      data: receiptData
    });
  } catch (error) {
    logger.error('Error generating receipt:', error);
    throw new AppError('Failed to generate receipt', 500, 'RECEIPT_GENERATION_ERROR');
  }
}));

export default router;
