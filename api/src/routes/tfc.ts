import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticateToken, requireRole } from '../middleware/auth';
import { prisma, safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';
import { emailService } from '../services/emailService';

const router = Router();

// Get TFC configuration for a venue
router.get('/config/:venueId', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { venueId } = req.params;

    const venue = await safePrismaQuery(async (client) => {
      return await client.venue.findUnique({
        where: { id: venueId },
        include: {
          businessAccount: true
        }
      });
    });

    if (!venue) {
      throw new AppError('Venue not found', 404, 'VENUE_NOT_FOUND');
    }

    // Get TFC configuration from venue settings
    const tfcConfig = {
      enabled: venue.tfcEnabled || false,
      providerName: venue.businessAccount?.name || venue.name,
      providerNumber: venue.businessAccount?.providerNumber || 'TFC001',
      holdPeriodDays: venue.tfcHoldPeriod || 5,
      instructionText: venue.tfcInstructions || `Please use the payment reference when making your Tax-Free Childcare payment. Your booking will be confirmed once payment is received.`,
      bankDetails: {
        accountName: venue.businessAccount?.name || venue.name,
        sortCode: venue.businessAccount?.sortCode || '20-00-00',
        accountNumber: venue.businessAccount?.accountNumber || '12345678'
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

    // Create booking with TFC status
    const booking = await safePrismaQuery(async (client) => {
      return await client.booking.create({
        data: {
          activityId,
          childId,
          parentId: userId,
          amount: parseFloat(amount),
          status: 'tfc_pending',
          paymentMethod: 'tfc',
          paymentReference,
          tfcDeadline: new Date(deadline),
          metadata: {
            tfcConfig,
            paymentReference,
            deadline
          }
        },
        include: {
          activity: {
            include: {
              venue: true
            }
          },
          child: true,
          parent: true
        }
      });
    });

    // Send TFC instructions email
    try {
      await emailService.sendTFCInstructions({
        to: booking.parent.email,
        parentName: `${booking.parent.firstName} ${booking.parent.lastName}`,
        childName: `${booking.child.firstName} ${booking.child.lastName}`,
        activityName: booking.activity.title,
        venueName: booking.activity.venue.name,
        paymentReference,
        deadline: new Date(deadline),
        amount: parseFloat(amount),
        tfcConfig
      });
    } catch (emailError) {
      logger.error('Failed to send TFC instructions email:', emailError);
      // Don't fail the booking creation if email fails
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
    throw new AppError('Failed to create TFC booking', 500, 'TFC_BOOKING_CREATE_ERROR');
  }
}));

// Get TFC booking status
router.get('/booking/:bookingId/status', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user!.id;

    const booking = await safePrismaQuery(async (client) => {
      return await client.booking.findFirst({
        where: {
          id: bookingId,
          parentId: userId,
          paymentMethod: 'tfc'
        },
        include: {
          activity: {
            include: {
              venue: true
            }
          },
          child: true,
          parent: true
        }
      });
    });

    if (!booking) {
      throw new AppError('TFC booking not found', 404, 'TFC_BOOKING_NOT_FOUND');
    }

    // Check if deadline has passed
    const now = new Date();
    const deadline = new Date(booking.tfcDeadline || booking.createdAt);
    const isExpired = now > deadline;

    if (isExpired && booking.status === 'tfc_pending') {
      // Auto-cancel expired booking
      await safePrismaQuery(async (client) => {
        return await client.booking.update({
          where: { id: bookingId },
          data: { status: 'cancelled' }
        });
      });

      // Send cancellation email
      try {
        await emailService.sendTFCCancellation({
          to: booking.parent.email,
          parentName: `${booking.parent.firstName} ${booking.parent.lastName}`,
          childName: `${booking.child.firstName} ${booking.child.lastName}`,
          activityName: booking.activity.title,
          paymentReference: booking.paymentReference
        });
      } catch (emailError) {
        logger.error('Failed to send TFC cancellation email:', emailError);
      }
    }

    res.json({
      success: true,
      data: {
        ...booking,
        status: isExpired ? 'expired' : booking.status,
        isExpired
      }
    });
  } catch (error) {
    logger.error('Error fetching TFC booking status:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch TFC booking status', 500, 'TFC_BOOKING_STATUS_ERROR');
  }
}));

// Resend TFC instructions
router.post('/booking/:bookingId/resend-instructions', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user!.id;

    const booking = await safePrismaQuery(async (client) => {
      return await client.booking.findFirst({
        where: {
          id: bookingId,
          parentId: userId,
          paymentMethod: 'tfc'
        },
        include: {
          activity: {
            include: {
              venue: true
            }
          },
          child: true,
          parent: true
        }
      });
    });

    if (!booking) {
      throw new AppError('TFC booking not found', 404, 'TFC_BOOKING_NOT_FOUND');
    }

    // Send TFC instructions email
    await emailService.sendTFCInstructions({
      to: booking.parent.email,
      parentName: `${booking.parent.firstName} ${booking.parent.lastName}`,
      childName: `${booking.child.firstName} ${booking.child.lastName}`,
      activityName: booking.activity.title,
      venueName: booking.activity.venue.name,
      paymentReference: booking.paymentReference || '',
      deadline: new Date(booking.tfcDeadline || booking.createdAt),
      amount: Number(booking.amount),
      tfcConfig: booking.metadata?.tfcConfig || {}
    });

    logger.info('TFC instructions resent', {
      bookingId,
      parentId: userId
    });

    res.json({
      success: true,
      message: 'TFC instructions resent successfully'
    });
  } catch (error) {
    logger.error('Error resending TFC instructions:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to resend TFC instructions', 500, 'TFC_INSTRUCTIONS_RESEND_ERROR');
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

// Admin: Get TFC pending queue (legacy route)
router.get('/admin/pending', authenticateToken, requireRole(['admin', 'coordinator']), asyncHandler(async (req: Request, res: Response) => {
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

    // Add computed status based on deadline
    const bookingsWithStatus = bookings.map(booking => {
      const now = new Date();
      const deadline = new Date(booking.tfcDeadline || booking.createdAt);
      const isExpired = now > deadline;
      
      return {
        ...booking,
        status: isExpired ? 'expired' : booking.status,
        isExpired
      };
    });

    res.json({
      success: true,
      data: bookingsWithStatus,
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
        await tx.walletTransaction.create({
          data: {
            userId: booking.parentId,
            amount: booking.amount,
            type: 'credit',
            description: `TFC booking converted to wallet credit - Booking ID: ${bookingId}`,
            reference: `TFC-CONVERT-${bookingId}`,
            status: 'completed'
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

// Admin: Mark TFC booking as paid
router.post('/admin/pending/:bookingId/mark-paid', authenticateToken, requireRole(['admin', 'coordinator']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;

    const booking = await safePrismaQuery(async (client) => {
      return await client.booking.update({
        where: { id: bookingId },
        data: { 
          status: 'confirmed',
          confirmedAt: new Date()
        },
        include: {
          activity: {
            include: {
              venue: true
            }
          },
          child: true,
          parent: true
        }
      });
    });

    // Send confirmation email
    try {
      await emailService.sendBookingConfirmation({
        to: booking.parent.email,
        parentName: `${booking.parent.firstName} ${booking.parent.lastName}`,
        childName: `${booking.child.firstName} ${booking.child.lastName}`,
        activityName: booking.activity.title,
        venueName: booking.activity.venue.name,
        startDate: booking.activity.startDate,
        startTime: booking.activity.startTime,
        amount: Number(booking.amount)
      });
    } catch (emailError) {
      logger.error('Failed to send booking confirmation email:', emailError);
    }

    logger.info('TFC booking marked as paid', {
      bookingId,
      markedBy: req.user!.id
    });

    res.json({
      success: true,
      message: 'Booking marked as paid successfully',
      data: booking
    });
  } catch (error) {
    logger.error('Error marking TFC booking as paid:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to mark booking as paid', 500, 'TFC_MARK_PAID_ERROR');
  }
}));

// Admin: Cancel TFC booking
router.post('/admin/pending/:bookingId/cancel', authenticateToken, requireRole(['admin', 'coordinator']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body;

    const booking = await safePrismaQuery(async (client) => {
      return await client.booking.update({
        where: { id: bookingId },
        data: { 
          status: 'cancelled',
          cancelledAt: new Date(),
          cancellationReason: reason || 'Admin cancelled - TFC payment not received'
        },
        include: {
          activity: {
            include: {
              venue: true
            }
          },
          child: true,
          parent: true
        }
      });
    });

    // Send cancellation email
    try {
      await emailService.sendBookingCancellation({
        to: booking.parent.email,
        parentName: `${booking.parent.firstName} ${booking.parent.lastName}`,
        childName: `${booking.child.firstName} ${booking.child.lastName}`,
        activityName: booking.activity.title,
        reason: reason || 'Payment not received within deadline'
      });
    } catch (emailError) {
      logger.error('Failed to send booking cancellation email:', emailError);
    }

    logger.info('TFC booking cancelled', {
      bookingId,
      cancelledBy: req.user!.id,
      reason
    });

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      data: booking
    });
  } catch (error) {
    logger.error('Error cancelling TFC booking:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to cancel booking', 500, 'TFC_CANCEL_ERROR');
  }
}));

// Admin: Convert TFC booking to credit
router.post('/admin/pending/:bookingId/convert-credit', authenticateToken, requireRole(['admin', 'coordinator']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const { creditAmount, reason } = req.body;

    const booking = await safePrismaQuery(async (client) => {
      // Cancel the booking
      const updatedBooking = await client.booking.update({
        where: { id: bookingId },
        data: { 
          status: 'cancelled',
          cancelledAt: new Date(),
          cancellationReason: reason || 'Converted to credit - TFC payment not received'
        },
        include: {
          parent: true,
          child: true,
          activity: true
        }
      });

      // Create credit for the parent
      const credit = await client.credit.create({
        data: {
          parentId: booking.parentId,
          amount: parseFloat(creditAmount || booking.amount.toString()),
          source: 'tfc_conversion',
          description: `Credit from TFC booking conversion - ${booking.activity.title}`,
          bookingId: bookingId,
          createdBy: req.user!.id,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year expiry
        }
      });

      return { booking: updatedBooking, credit };
    });

    // Send credit notification email
    try {
      await emailService.sendCreditIssued({
        to: booking.parent.email,
        parentName: `${booking.parent.firstName} ${booking.parent.lastName}`,
        amount: parseFloat(creditAmount || booking.amount.toString()),
        reason: 'TFC booking converted to credit',
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      });
    } catch (emailError) {
      logger.error('Failed to send credit notification email:', emailError);
    }

    logger.info('TFC booking converted to credit', {
      bookingId,
      creditAmount: creditAmount || booking.amount,
      convertedBy: req.user!.id
    });

    res.json({
      success: true,
      message: 'Booking converted to credit successfully',
      data: booking
    });
  } catch (error) {
    logger.error('Error converting TFC booking to credit:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to convert booking to credit', 500, 'TFC_CONVERT_CREDIT_ERROR');
  }
}));

// Admin: Bulk mark as paid
router.post('/admin/pending/bulk-mark-paid', authenticateToken, requireRole(['admin', 'coordinator']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { bookingIds } = req.body;

    if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
      throw new AppError('Booking IDs are required', 400, 'MISSING_BOOKING_IDS');
    }

    const result = await safePrismaQuery(async (client) => {
      return await client.booking.updateMany({
        where: {
          id: { in: bookingIds },
          paymentMethod: 'tfc',
          status: 'tfc_pending'
        },
        data: {
          status: 'confirmed',
          confirmedAt: new Date()
        }
      });
    });

    logger.info('TFC bookings bulk marked as paid', {
      count: result.count,
      bookingIds,
      markedBy: req.user!.id
    });

    res.json({
      success: true,
      message: `${result.count} bookings marked as paid successfully`,
      data: { count: result.count }
    });
  } catch (error) {
    logger.error('Error bulk marking TFC bookings as paid:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to mark bookings as paid', 500, 'TFC_BULK_MARK_PAID_ERROR');
  }
}));

export default router;