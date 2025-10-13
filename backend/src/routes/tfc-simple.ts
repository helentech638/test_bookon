import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticateToken, requireRole } from '../middleware/auth';
import { safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';
import { emailService } from '../services/emailService';

const router = Router();

// Get TFC configuration for a venue
router.get('/config/:venueId', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { venueId } = req.params;

    const venue = await safePrismaQuery(async (client) => {
      return await client.venue.findUnique({
        where: { id: venueId }
      });
    });

    if (!venue) {
      throw new AppError('Venue not found', 404, 'VENUE_NOT_FOUND');
    }

    // Get TFC configuration
    const tfcConfig = {
      enabled: venue.tfcEnabled || true,
      providerName: venue.name,
      providerNumber: 'TFC001',
      holdPeriodDays: venue.tfcHoldPeriod || 5,
      instructionText: venue.tfcInstructions || `Please use the payment reference when making your Tax-Free Childcare payment. Your booking will be confirmed once payment is received.`,
      bankDetails: {
        accountName: venue.name,
        sortCode: '20-00-00',
        accountNumber: '12345678'
      }
    };

    res.json({
      success: true,
      data: tfcConfig
    });
  } catch (error) {
    logger.error('Error fetching TFC config:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch TFC configuration', 500, 'TFC_CONFIG_ERROR');
  }
}));

// Create TFC booking
router.post('/create-booking', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const {
      activityId,
      childId,
      paymentReference,
      deadline,
      amount,
      tfcConfig
    } = req.body;

    const userId = req.user!.id;

    // Get activity information first
    const activity = await safePrismaQuery(async (client) => {
      return await client.activity.findUnique({
        where: { id: activityId }
      });
    });

    if (!activity) {
      throw new AppError('Activity not found', 404, 'ACTIVITY_NOT_FOUND');
    }

    // Create booking with TFC status
    const booking = await safePrismaQuery(async (client) => {
      return await client.booking.create({
        data: {
          activityId,
          childId,
          parentId: userId,
          amount: parseFloat(amount),
          status: 'tfc_pending',
          paymentStatus: 'pending_payment',
          paymentMethod: 'tfc',
          tfcReference: paymentReference,
          tfcDeadline: new Date(deadline),
          tfcInstructions: tfcConfig?.instructionText || 'Please use the payment reference when making your Tax-Free Childcare payment.',
          holdPeriod: tfcConfig?.holdPeriodDays || 5,
          bookingDate: new Date(),
          activityDate: activity.startDate,
          activityTime: activity.startTime || 'TBD'
        }
      });
    });

    // Get parent and child info for email
    const parent = await safePrismaQuery(async (client) => {
      return await client.user.findUnique({
        where: { id: userId }
      });
    });

    const child = await safePrismaQuery(async (client) => {
      return await client.child.findUnique({
        where: { id: childId }
      });
    });

    // Send TFC instructions email
    if (parent && child) {
      try {
        await emailService.sendTFCInstructions({
          to: parent.email,
          parentName: `${parent.firstName} ${parent.lastName}`,
          childName: `${child.firstName} ${child.lastName}`,
          activityName: activity.title,
          venueName: 'Unknown Venue',
          paymentReference,
          deadline: new Date(deadline),
          amount: parseFloat(amount),
          tfcConfig
        });
      } catch (emailError) {
        logger.error('Failed to send TFC instructions email:', emailError);
        // Don't fail the booking creation if email fails
      }
    }

    logger.info('TFC booking created', {
      bookingId: booking.id,
      paymentReference,
      parentId: userId
    });

    res.status(201).json({
      success: true,
      message: 'TFC booking created successfully',
      data: booking
    });
  } catch (error) {
    logger.error('Error creating TFC booking:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to create TFC booking', 500, 'TFC_BOOKING_ERROR');
  }
}));

// Confirm TFC payment
router.post('/confirm/:bookingId', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const adminId = req.user!.id;

    const booking = await safePrismaQuery(async (client) => {
      return await client.booking.findUnique({
        where: { id: bookingId }
      });
    });

    if (!booking) {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    if (booking.paymentMethod !== 'tfc') {
      throw new AppError('Booking is not a TFC payment', 400, 'NOT_TFC_BOOKING');
    }

    if (booking.paymentStatus !== 'pending_payment') {
      throw new AppError('Booking is not in pending payment status', 400, 'INVALID_STATUS');
    }

    // Update booking status to confirmed
    await safePrismaQuery(async (client) => {
      return await client.booking.update({
        where: { id: bookingId },
        data: {
          paymentStatus: 'paid',
          status: 'confirmed',
          updatedAt: new Date()
        }
      });
    });

    logger.info('TFC payment confirmed', {
      bookingId,
      adminId,
      reference: booking.tfcReference,
      amount: booking.amount
    });

    res.json({
      success: true,
      message: 'TFC payment confirmed successfully'
    });
  } catch (error) {
    logger.error('Error confirming TFC payment:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to confirm TFC payment', 500, 'TFC_CONFIRM_ERROR');
  }
}));

// Get TFC booking status
router.get('/booking/:bookingId/status', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user!.id;

    const booking = await safePrismaQuery(async (client) => {
      return await client.booking.findUnique({
        where: { id: bookingId },
        include: {
          activity: true,
          child: true,
          parent: true
        }
      });
    });

    if (!booking) {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    // Check if user owns this booking
    if (booking.parentId !== userId) {
      throw new AppError('Unauthorized access to booking', 403, 'UNAUTHORIZED');
    }

    // Check if it's a TFC booking
    if (booking.paymentMethod !== 'tfc') {
      throw new AppError('Not a TFC booking', 400, 'NOT_TFC_BOOKING');
    }

    const tfcStatus = {
      id: booking.id,
      paymentReference: booking.tfcReference,
      amount: parseFloat(booking.amount.toString()),
      deadline: booking.tfcDeadline,
      status: booking.paymentStatus,
      activity: {
        title: booking.activity.title,
        startDate: booking.activity.startDate,
        startTime: booking.activity.startTime,
        venue: {
          name: 'Unknown Venue', // We'll need to get this from venue
          address: 'Unknown Address'
        }
      },
      child: {
        firstName: booking.child.firstName,
        lastName: booking.child.lastName
      },
      parent: {
        firstName: booking.parent.firstName,
        lastName: booking.parent.lastName,
        email: booking.parent.email,
        phone: booking.parent.phone || ''
      },
      tfcConfig: {
        providerName: 'BookOn Platform',
        providerNumber: 'TFC001',
        instructionText: booking.tfcInstructions || 'Please use the payment reference when making your Tax-Free Childcare payment.',
        bankDetails: {
          accountName: 'BookOn Platform',
          sortCode: '20-00-00',
          accountNumber: '12345678'
        }
      }
    };

    res.json({
      success: true,
      data: tfcStatus
    });
  } catch (error) {
    logger.error('Error fetching TFC booking status:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch TFC booking status', 500, 'TFC_STATUS_ERROR');
  }
}));

// Resend TFC instructions
router.post('/booking/:bookingId/resend-instructions', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user!.id;

    const booking = await safePrismaQuery(async (client) => {
      return await client.booking.findUnique({
        where: { id: bookingId },
        include: {
          activity: true,
          child: true,
          parent: true
        }
      });
    });

    if (!booking) {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    // Check if user owns this booking
    if (booking.parentId !== userId) {
      throw new AppError('Unauthorized access to booking', 403, 'UNAUTHORIZED');
    }

    // Check if it's a TFC booking
    if (booking.paymentMethod !== 'tfc') {
      throw new AppError('Not a TFC booking', 400, 'NOT_TFC_BOOKING');
    }

    // Resend TFC instructions email
    try {
      await emailService.sendTFCInstructions({
        to: booking.parent.email,
        parentName: `${booking.parent.firstName} ${booking.parent.lastName}`,
        childName: `${booking.child.firstName} ${booking.child.lastName}`,
        activityName: booking.activity.title,
        venueName: 'Unknown Venue',
        paymentReference: booking.tfcReference || 'N/A',
        deadline: booking.tfcDeadline || new Date(),
        amount: parseFloat(booking.amount.toString()),
        tfcConfig: {
          instructionText: booking.tfcInstructions || 'Please use the payment reference when making your Tax-Free Childcare payment.'
        }
      });
    } catch (emailError) {
      logger.error('Failed to resend TFC instructions email:', emailError);
      throw new AppError('Failed to resend instructions email', 500, 'EMAIL_ERROR');
    }

    res.json({
      success: true,
      message: 'TFC instructions resent successfully'
    });
  } catch (error) {
    logger.error('Error resending TFC instructions:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to resend TFC instructions', 500, 'TFC_RESEND_ERROR');
  }
}));

// Get TFC pending queue (admin access)
router.get('/pending', authenticateToken, requireRole(['admin', 'coordinator', 'staff']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { status, page = '1', limit = '50' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      paymentMethod: 'tfc',
      status: status === 'all' ? undefined : status
    };

    const [bookings, total] = await Promise.all([
      safePrismaQuery(async (client) => {
        return await client.booking.findMany({
          where,
          include: {
            activity: {
              include: {
                venue: true
              }
            },
            child: true,
            parent: true
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum
        });
      }),
      safePrismaQuery(async (client) => {
        return await client.booking.count({ where });
      })
    ]);

    // Transform data to match frontend interface
    const transformedBookings = bookings.map(booking => {
      const now = new Date();
      const deadline = new Date(booking.tfcDeadline || booking.createdAt);
      const daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      return {
        id: booking.id,
        child: `${booking.child.firstName} ${booking.child.lastName}`,
        parent: `${booking.parent.firstName} ${booking.parent.lastName}`,
        parentEmail: booking.parent.email,
        activity: booking.activity.title,
        venue: booking.activity.venue.name,
        venueId: booking.activity.venue.id,
        amount: parseFloat(booking.amount.toString()),
        reference: booking.tfcReference || 'N/A',
        deadline: deadline.toISOString(),
        createdAt: booking.createdAt.toISOString(),
        daysRemaining: daysRemaining
      };
    });

    res.json({
      success: true,
      data: transformedBookings,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    logger.error('Error fetching TFC pending queue:', error);
    throw new AppError('Failed to fetch TFC pending queue', 500, 'TFC_PENDING_QUEUE_ERROR');
  }
}));

// Cancel TFC booking
router.post('/cancel/:bookingId', authenticateToken, requireRole(['admin', 'coordinator', 'staff']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body;
    const adminId = req.user!.id;

    const booking = await safePrismaQuery(async (client) => {
      return await client.booking.findUnique({
        where: { id: bookingId }
      });
    });

    if (!booking) {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    if (booking.paymentMethod !== 'tfc') {
      throw new AppError('Booking is not a TFC payment', 400, 'NOT_TFC_BOOKING');
    }

    // Update booking status to cancelled
    await safePrismaQuery(async (client) => {
      return await client.booking.update({
        where: { id: bookingId },
        data: {
          paymentStatus: 'cancelled',
          status: 'cancelled',
          updatedAt: new Date(),
          cancellationReason: reason || 'Cancelled by admin'
        }
      });
    });

    logger.info('TFC booking cancelled', {
      bookingId,
      adminId,
      reason: reason || 'Cancelled by admin'
    });

    res.json({
      success: true,
      message: 'TFC booking cancelled successfully'
    });
  } catch (error) {
    logger.error('Error cancelling TFC booking:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to cancel TFC booking', 500, 'TFC_CANCEL_ERROR');
  }
}));

// Mark TFC booking as part-paid
router.post('/part-paid/:bookingId', authenticateToken, requireRole(['admin', 'coordinator', 'staff']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const { amountReceived } = req.body;
    const adminId = req.user!.id;

    const booking = await safePrismaQuery(async (client) => {
      return await client.booking.findUnique({
        where: { id: bookingId }
      });
    });

    if (!booking) {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    if (booking.paymentMethod !== 'tfc') {
      throw new AppError('Booking is not a TFC payment', 400, 'NOT_TFC_BOOKING');
    }

    if (!amountReceived || amountReceived <= 0) {
      throw new AppError('Invalid amount received', 400, 'INVALID_AMOUNT');
    }

    // Update booking status to part-paid
    await safePrismaQuery(async (client) => {
      return await client.booking.update({
        where: { id: bookingId },
        data: {
          paymentStatus: 'part_paid',
          status: 'part_paid',
          amountReceived: parseFloat(amountReceived),
          updatedAt: new Date()
        }
      });
    });

    logger.info('TFC booking marked as part-paid', {
      bookingId,
      adminId,
      amountReceived: parseFloat(amountReceived),
      totalAmount: booking.amount
    });

    res.json({
      success: true,
      message: 'TFC booking marked as part-paid successfully'
    });
  } catch (error) {
    logger.error('Error marking TFC booking as part-paid:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to mark TFC booking as part-paid', 500, 'TFC_PART_PAID_ERROR');
  }
}));

// Convert TFC booking to wallet credit
router.post('/convert-to-credit/:bookingId', authenticateToken, requireRole(['admin', 'coordinator', 'staff']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const adminId = req.user!.id;

    const booking = await safePrismaQuery(async (client) => {
      return await client.booking.findUnique({
        where: { id: bookingId },
        include: {
          parent: true
        }
      });
    });

    if (!booking) {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    if (booking.paymentMethod !== 'tfc') {
      throw new AppError('Booking is not a TFC payment', 400, 'NOT_TFC_BOOKING');
    }

    // Update booking status and add wallet credit
    await safePrismaQuery(async (client) => {
      await client.$transaction(async (tx) => {
        // Update booking status
        await tx.booking.update({
          where: { id: bookingId },
          data: {
            paymentStatus: 'converted_to_credit',
            status: 'converted_to_credit',
            updatedAt: new Date()
          }
        });

        // Add wallet credit to parent
        await tx.walletCredit.create({
          data: {
            parentId: booking.parentId,
            bookingId: bookingId,
            amount: booking.amount,
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
            source: 'tfc_conversion',
            description: `TFC booking converted to wallet credit - Booking ID: ${bookingId}`,
            status: 'active'
          }
        });
      });
    });

    logger.info('TFC booking converted to wallet credit', {
      bookingId,
      adminId,
      parentId: booking.parentId,
      amount: booking.amount
    });

    res.json({
      success: true,
      message: 'TFC booking converted to wallet credit successfully'
    });
  } catch (error) {
    logger.error('Error converting TFC booking to wallet credit:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to convert TFC booking to wallet credit', 500, 'TFC_CONVERT_ERROR');
  }
}));

// Bulk confirm TFC payments
router.post('/bulk-confirm', authenticateToken, requireRole(['admin', 'coordinator', 'staff']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { bookingIds } = req.body;
    const adminId = req.user!.id;

    if (!bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0) {
      throw new AppError('Invalid booking IDs provided', 400, 'INVALID_BOOKING_IDS');
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const bookingId of bookingIds) {
      try {
        const booking = await safePrismaQuery(async (client) => {
          return await client.booking.findUnique({
            where: { id: bookingId }
          });
        });

        if (!booking) {
          errors.push(`Booking ${bookingId} not found`);
          errorCount++;
          continue;
        }

        if (booking.paymentMethod !== 'tfc') {
          errors.push(`Booking ${bookingId} is not a TFC payment`);
          errorCount++;
          continue;
        }

        if (booking.paymentStatus !== 'pending_payment') {
          errors.push(`Booking ${bookingId} is not in pending payment status`);
          errorCount++;
          continue;
        }

        // Update booking status to confirmed
        await safePrismaQuery(async (client) => {
          return await client.booking.update({
            where: { id: bookingId },
            data: {
              paymentStatus: 'paid',
              status: 'confirmed',
              updatedAt: new Date()
            }
          });
        });

        successCount++;
      } catch (error) {
        errors.push(`Error processing booking ${bookingId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        errorCount++;
      }
    }

    logger.info('Bulk TFC payment confirmation completed', {
      adminId,
      totalBookings: bookingIds.length,
      successCount,
      errorCount
    });

    res.json({
      success: true,
      message: `Bulk confirmation completed: ${successCount} successful, ${errorCount} errors`,
      data: {
        totalBookings: bookingIds.length,
        successCount,
        errorCount,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error) {
    logger.error('Error in bulk TFC payment confirmation:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to bulk confirm TFC payments', 500, 'TFC_BULK_CONFIRM_ERROR');
  }
}));

export default router;
