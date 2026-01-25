import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { body, validationResult } from 'express-validator';
import stripeService from '../services/stripe';
import Stripe from 'stripe';
import PDFDocument from 'pdfkit';
import { emailService } from '../services/emailService';

const router = Router();

// Validation middleware
const validatePaymentIntent = [
  body('bookingId').optional().isUUID().withMessage('Booking ID must be a valid UUID'),
  body('bookingIds').optional().isArray().withMessage('Booking IDs must be an array'),
  body('bookingIds.*').optional().isUUID().withMessage('Each booking ID must be a valid UUID'),
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('currency').optional().isIn(['gbp', 'usd', 'eur']).withMessage('Invalid currency'),
  body('venueId').optional().isUUID().withMessage('Venue ID must be a valid UUID'),
];

// Create payment intent for a booking
router.post('/create-intent', authenticateToken, validatePaymentIntent, asyncHandler(async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.error('Payment intent validation failed', { 
        errors: errors.array(),
        body: req.body 
      });
      throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
    }

    const { bookingId, bookingIds, amount, currency = 'gbp', venueId } = req.body;
    const userId = req.user!.id;

    // Log received data for debugging
    logger.info('Payment intent request received', { 
      userId,
      bookingId, 
      bookingIds, 
      amount, 
      currency, 
      venueId,
      body: req.body 
    });

    // Convert amount to pence for Stripe (if not already in pence)
    const amountInPence = Math.round(amount * 100);
    logger.info('Amount conversion', { 
      originalAmount: amount,
      amountInPence: amountInPence
    });

    // Handle both single booking and multiple bookings
    const bookingIdList = bookingIds || (bookingId ? [bookingId] : []);
    
    if (bookingIdList.length === 0) {
      logger.error('No booking IDs provided', { 
        bookingId, 
        bookingIds, 
        body: req.body 
      });
      throw new AppError('At least one booking ID is required', 400, 'MISSING_BOOKING_ID');
    }

    // Get booking details
    const bookings = await prisma.booking.findMany({
      where: {
        id: { in: bookingIdList },
        parentId: userId,
        // Note: isActive field doesn't exist in current schema
      },
      include: {
        activity: {
          select: {
            title: true,
            startDate: true,
            startTime: true,
            venue: {
              select: {
                name: true,
                stripeAccountId: true
              }
            }
          }
        }
      }
    });

    if (bookings.length === 0) {
      throw new AppError('No bookings found', 404, 'BOOKING_NOT_FOUND');
    }

    // Check all bookings are in pending status
    const invalidBookings = bookings.filter(booking => booking.status !== 'pending');
    if (invalidBookings.length > 0) {
      throw new AppError('Some bookings are not in pending status', 400, 'BOOKING_NOT_PENDING');
    }

    // Check if payments already exist for any booking
    const existingPayments = await prisma.payment.findMany({
      where: {
        bookingId: { in: bookingIdList },
        isActive: true
      }
    });

    if (existingPayments.length > 0) {
      // Instead of throwing error, deactivate old payments and continue
      logger.info(`Found ${existingPayments.length} existing payments, deactivating them`);
      
      for (const existingPayment of existingPayments) {
        await prisma.payment.update({
          where: { id: existingPayment.id },
          data: { isActive: false }
        });
        logger.info(`Deactivated existing payment ${existingPayment.id} for booking ${existingPayment.bookingId}`);
      }
    }

    // Create Stripe payment intent with Connect support
    const paymentIntent = await stripeService.createPaymentIntent({
      bookingId: bookingIdList[0], // Use first booking ID for stripe service
      amount,
      currency,
      venueId: venueId || bookings[0]?.activity?.venue?.stripeAccountId,
    });

    // Create payment record in database for the first booking
    const payment = await prisma.payment.create({
      data: {
        bookingId: bookingIdList[0], // Use first booking ID
        userId: userId,
        stripePaymentIntentId: paymentIntent.id,
        amount: amount,
        currency: currency,
        status: 'pending',
        paymentMethod: 'stripe',
        stripeAccountId: venueId || bookings[0]?.activity?.venue?.stripeAccountId,
        isActive: true
      }
    });

    logger.info('Payment intent created successfully', { 
      paymentId: payment.id, 
      bookingIds: bookingIdList,
      userId,
      stripeIntentId: paymentIntent.id,
      venueId: venueId || (bookings[0]?.activity?.venue?.stripeAccountId ?? null)
    });

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: currency,
        booking: {
          id: bookings[0]?.id ?? '',
          activityTitle: bookings[0]?.activity?.title ?? '',
          venueName: bookings[0]?.activity?.venue?.name ?? '',
          startDate: bookings[0]?.activity?.startDate ?? '',
          startTime: bookings[0]?.activity?.startTime ?? '',
        }
      }
    });
  } catch (error) {
    logger.error('Error creating payment intent:', error);
    throw error;
  }
}));

// Confirm payment intent
router.post('/confirm', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    // const userId = req.user!.id; // Unused variable
    const { paymentIntentId } = req.body;

    logger.info('Payment confirmation request received', { 
      paymentIntentId, 
      paymentIntentIdLength: paymentIntentId?.length,
      paymentIntentIdType: typeof paymentIntentId,
      body: req.body 
    });

    if (!paymentIntentId) {
      throw new AppError('Payment intent ID is required', 400, 'MISSING_PAYMENT_INTENT_ID');
    }

    // Get payment details
    const payment = await prisma.payment.findFirst({
      where: {
        stripePaymentIntentId: paymentIntentId,
        isActive: true
      },
      include: {
        booking: {
          include: {
            activity: true,
            child: true,
            parent: true
          }
        }
      }
    });

    if (!payment) {
      logger.error('Payment not found in database', { paymentIntentId });
      throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
    }

    logger.info('Payment found in database', { 
      paymentId: payment.id, 
      bookingId: payment.bookingId,
      currentStatus: payment.status 
    });

    // Confirm payment intent with Stripe
    const paymentIntent = await stripeService.confirmPayment(paymentIntentId);

    logger.info('Stripe payment intent status', { 
      paymentIntentId, 
      status: paymentIntent.status 
    });

    if (paymentIntent.status === 'succeeded') {
      // Update payment status
      await prisma.payment.update({
        where: { stripePaymentIntentId: paymentIntentId },
        data: {
          status: 'completed',
          updatedAt: new Date(),
        }
      });

      // Update booking status
      await prisma.booking.update({
        where: { id: payment.bookingId },
        data: {
          status: 'confirmed',
          updatedAt: new Date(),
        }
      });

      // Create notification for business owner about payment
      try {
        const { NotificationService } = await import('../services/notificationService');
        if (payment.booking.activity?.ownerId) {
          await NotificationService.createNotification({
            userId: payment.booking.activity.ownerId,
            venueId: payment.booking.activity.venueId || undefined,
            type: 'payment_success',
            title: 'Payment Received',
            message: `Payment of £${Number(payment.amount.toString()).toFixed(2)} received from ${payment.booking.parent?.firstName || 'Parent'} for ${payment.booking.activity?.title || 'Activity'}`,
            data: {
              paymentId: payment.id,
              bookingId: payment.bookingId,
              amount: payment.amount,
              childName: `${payment.booking.child?.firstName || ''} ${payment.booking.child?.lastName || ''}`,
              activityId: payment.booking.activity?.id
            },
            priority: 'high',
            channels: ['in_app', 'email']
          });
          logger.info(`Created payment notification for business owner`);
        }
      } catch (notificationError) {
        logger.error('Failed to create payment notification:', notificationError);
      }

      logger.info('Payment confirmed successfully', { paymentIntentId, bookingId: payment.bookingId });

      res.json({
        success: true,
        message: 'Payment confirmed successfully',
        data: {
          paymentIntentId,
          status: paymentIntent.status,
        },
      });
    } else {
      throw new AppError(`Payment not succeeded. Status: ${paymentIntent.status}`, 400, 'PAYMENT_NOT_SUCCEEDED');
    }
  } catch (error) {
    logger.error('Error confirming payment:', error);
    if (error instanceof AppError) throw error;
    
    if (error instanceof Stripe.errors.StripeError) {
      throw new AppError(`Payment error: ${error.message}`, 400, 'STRIPE_ERROR');
    }
    
    throw new AppError('Failed to confirm payment', 500, 'PAYMENT_CONFIRMATION_ERROR');
  }
}));

// Get payment status
router.get('/:id/status', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    
    const payment = await prisma.payment.findFirst({
      where: {
        id: id!,
        userId: userId,
        isActive: true
      },
      include: {
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
    });

    if (!payment) {
      throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
    }

    // Get latest status from Stripe if payment intent exists
    let stripeStatus = null;
    if (payment.stripePaymentIntentId) {
      try {
        const paymentIntent = await stripeService.getPaymentIntent(payment.stripePaymentIntentId);
        stripeStatus = paymentIntent.status;
      } catch (stripeError) {
        logger.warn('Could not retrieve Stripe payment intent', { 
          paymentId: id, 
          stripeError 
        });
      }
    }

    res.json({
      success: true,
      data: {
        id: payment.id,
        status: payment.status,
        stripeStatus,
        amount: parseFloat(payment.amount.toString()),
        currency: payment.currency,
        bookingStatus: payment.booking.status,
        activityTitle: payment.booking.activity.title,
        createdAt: payment.createdAt,
        completedAt: payment.completedAt
      }
    });
  } catch (error) {
    logger.error('Error fetching payment status:', error);
    throw new AppError('Failed to fetch payment status', 500, 'PAYMENT_STATUS_ERROR');
  }
}));

// Get payment by booking ID
router.get('/booking/:bookingId', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user!.id;

    if (!bookingId) {
      throw new AppError('Booking ID is required', 400, 'MISSING_BOOKING_ID');
    }

    // Get the booking first to verify ownership
    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        parentId: userId
      }
    });

    if (!booking) {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    // Get the payment for this booking
    const payment = await prisma.payment.findFirst({
      where: {
        bookingId: bookingId,
        userId: userId,
        isActive: true
      }
    });

    if (!payment) {
      throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
    }

    res.json({
      success: true,
      data: payment,
      message: 'Payment retrieved successfully'
    });

  } catch (error) {
    logger.error('Error retrieving payment by booking ID:', error);
    throw error;
  }
}));

// Get all payments for user
router.get('/', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { 
      page = '1', 
      limit = '10', 
      status 
    } = req.query;
    
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    
    const whereClause: any = {
      userId: userId,
      isActive: true
    };

    // Filter by status
    if (status && status !== 'all') {
      whereClause.status = status;
    }

    const payments = await prisma.payment.findMany({
      where: whereClause,
      include: {
        booking: {
          include: {
            activity: {
              select: {
                title: true,
                startDate: true,
                startTime: true
              }
            }
          }
        }
      },
      skip: offset,
      take: parseInt(limit as string),
      orderBy: { createdAt: 'desc' }
    });

    // Get total count for pagination
    const totalCount = await prisma.payment.count({
      where: whereClause
    });

    res.json({
      success: true,
      data: payments.map(payment => ({
        id: payment.id,
        status: payment.status,
        amount: parseFloat(payment.amount.toString()),
        currency: payment.currency,
        paymentMethod: payment.paymentMethod,
        booking: {
          status: payment.booking.status,
          activity: {
            title: payment.booking.activity.title,
            startDate: payment.booking.activity.startDate,
            startTime: payment.booking.activity.startTime
          }
        },
        createdAt: payment.createdAt,
        completedAt: payment.completedAt
      })),
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit as string))
      }
    });
  } catch (error) {
    logger.error('Error fetching payments:', error);
    throw new AppError('Failed to fetch payments', 500, 'PAYMENTS_FETCH_ERROR');
  }
}));

// Refund payment
router.post('/:id/refund', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { reason } = req.body;
    
    // Get payment record
    const payment = await prisma.payment.findFirst({
      where: {
        id: id!,
        userId: userId,
        isActive: true
      },
      include: {
        booking: true
      }
    });

    if (!payment) {
      throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
    }

    if (payment.status !== 'completed') {
      throw new AppError('Only completed payments can be refunded', 400, 'PAYMENT_NOT_REFUNDABLE');
    }

    // Check if booking is within refund window (e.g., 7 days)
    const booking = payment.booking;

    if (booking) {
      const now = new Date();
      const paymentDate = new Date(payment.completedAt!);
      const daysSincePayment = (now.getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSincePayment > 7) {
        throw new AppError('Refund window has expired (7 days)', 400, 'REFUND_WINDOW_EXPIRED');
      }
    }

    // Process refund through Stripe
    let refund;
    if (payment.stripePaymentIntentId) {
      try {
        refund = await stripeService.processRefund(payment.stripePaymentIntentId, {
          paymentIntentId: payment.stripePaymentIntentId,
          reason: reason || 'Customer requested refund',
        });
      } catch (stripeError) {
        logger.error('Error processing Stripe refund:', stripeError);
        throw new AppError('Failed to process refund with Stripe', 500, 'STRIPE_REFUND_ERROR');
      }
    }

    // Update payment status
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'refunded',
        refundedAt: new Date(),
        updatedAt: new Date(),
      }
    });

    // Update booking status
    await prisma.booking.update({
      where: { id: payment.bookingId },
      data: {
        status: 'cancelled',
        updatedAt: new Date(),
      }
    });

    logger.info('Payment refunded successfully', { 
      paymentId: payment.id, 
      bookingId: payment.bookingId,
      userId,
      refundId: refund?.id
    });

    res.json({
      success: true,
      message: 'Payment refunded successfully',
      data: {
        paymentId: payment.id,
        status: 'refunded',
        refundId: refund?.id
      }
    });
  } catch (error) {
    logger.error('Error refunding payment:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to refund payment', 500, 'PAYMENT_REFUND_ERROR');
  }
}));

// Webhook endpoint for Stripe events
router.post('/webhook', asyncHandler(async (req: Request, res: Response) => {
  try {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env['STRIPE_WEBHOOK_SECRET'];

    if (!sig || !endpointSecret) {
      throw new AppError('Missing webhook signature or secret', 400, 'WEBHOOK_SIGNATURE_MISSING');
    }

    let event: Stripe.Event;

    try {
      event = stripeService.verifyWebhookSignature(req.body, sig as string, endpointSecret);
    } catch (err) {
      logger.error('Webhook signature verification failed', { err });
      return res.status(400).send(`Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailure(event.data.object as Stripe.PaymentIntent);
        break;
      case 'refund.created':
        await handleRefundCreated(event.data.object as Stripe.Refund);
        break;
      default:
        logger.info(`Unhandled event type: ${event.type}`);
    }

    return res.json({ received: true });
  } catch (error) {
    logger.error('Webhook error:', error);
    return res.status(400).send(`Webhook Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}));

// Helper functions for webhook handling
export async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  try {
    const payment = await prisma.payment.findFirst({
      where: {
        stripePaymentIntentId: paymentIntent.id,
        isActive: true
      },
      include: {
        booking: {
          include: {
            activity: true,
            child: true,
            parent: true
          }
        }
      }
    });

    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          updatedAt: new Date(),
        }
      });

      await prisma.booking.update({
        where: { id: payment.bookingId },
        data: {
          status: 'confirmed',
          updatedAt: new Date(),
        }
      });

      // Create register and attendance for the booking
      await createRegisterForBooking(payment.booking);

      // Create notification for business owner about payment
      try {
        const { NotificationService } = await import('../services/notificationService');
        if (payment.booking.activity?.ownerId) {
          await NotificationService.createNotification({
            userId: payment.booking.activity.ownerId,
            venueId: payment.booking.activity.venueId || undefined,
            type: 'payment_success',
            title: 'Payment Received',
            message: `Payment of £${Number(payment.amount.toString()).toFixed(2)} received from ${payment.booking.parent?.firstName || 'Parent'} for ${payment.booking.activity?.title || 'Activity'}`,
            data: {
              paymentId: payment.id,
              bookingId: payment.bookingId,
              amount: payment.amount,
              childName: `${payment.booking.child?.firstName || ''} ${payment.booking.child?.lastName || ''}`,
              activityId: payment.booking.activity?.id
            },
            priority: 'high',
            channels: ['in_app', 'email']
          });
          logger.info(`Created payment notification for business owner`);
        }
      } catch (notificationError) {
        logger.error('Failed to create payment notification:', notificationError);
      }

      logger.info('Payment completed via webhook', { 
        paymentId: payment.id, 
        bookingId: payment.bookingId 
      });
    }
  } catch (error) {
    logger.error('Error handling payment success webhook:', error);
  }
}

async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  try {
    const payment = await prisma.payment.findFirst({
      where: {
        stripePaymentIntentId: paymentIntent.id,
        isActive: true
      }
    });

    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'failed',
          updatedAt: new Date(),
        }
      });

      logger.info('Payment failed via webhook', { 
        paymentId: payment.id, 
        bookingId: payment.bookingId 
      });
    }
  } catch (error) {
    logger.error('Error handling payment failure webhook:', error);
  }
}

async function handleRefundCreated(refund: Stripe.Refund) {
  try {
    const payment = await prisma.payment.findFirst({
      where: {
        stripePaymentIntentId: refund.payment_intent as string,
        isActive: true
      }
    });

    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'refunded',
          refundedAt: new Date(),
          updatedAt: new Date(),
        }
      });

      await prisma.booking.update({
        where: { id: payment.bookingId },
        data: {
          status: 'cancelled',
          updatedAt: new Date(),
        }
      });

      logger.info('Payment refunded via webhook', { 
        paymentId: payment.id, 
        bookingId: payment.bookingId,
        refundId: refund.id
      });
    }
  } catch (error) {
    logger.error('Error handling refund created webhook:', error);
  }
}

// Process refund for a payment
router.post('/refund', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { paymentId, amount, reason } = req.body;
    
    if (!paymentId) {
      throw new AppError('Payment ID is required', 400, 'PAYMENT_ID_REQUIRED');
    }

    // Get payment details
    const payment = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        isActive: true
      },
      include: {
        booking: {
          include: {
            activity: {
              include: {
                venue: {
                  select: {
                    stripeAccountId: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!payment) {
      throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
    }

    if (payment.status !== 'completed') {
      throw new AppError('Payment must be completed to process refund', 400, 'PAYMENT_NOT_COMPLETED');
    }

    // Process refund through Stripe
    const refundAmount = amount || Number(payment.amount);
    const refundData: any = {
      paymentIntentId: payment.stripePaymentIntentId!,
      amount: refundAmount,
      reason: reason || 'Customer request'
    };
    
    if (payment.booking.activity.venue.stripeAccountId) {
      refundData.connectAccountId = payment.booking.activity.venue.stripeAccountId;
    }
    
    const refund = await stripeService.createRefund(refundData);

    // Update payment status
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'refunded',
        refundedAt: new Date(),
        updatedAt: new Date(),
      }
    });

    // Update booking status if full refund
    if (refundAmount >= Number(payment.amount)) {
      await prisma.booking.update({
        where: { id: payment.bookingId },
        data: {
          status: 'cancelled',
          updatedAt: new Date(),
        }
      });
    }

    logger.info('Refund processed successfully', { 
      paymentId, 
      refundId: refund.id,
      amount: refundAmount 
    });

    res.json({
      success: true,
      message: 'Refund processed successfully',
      data: {
        refundId: refund.id,
        amount: refundAmount,
        status: 'refunded'
      }
    });
  } catch (error) {
    logger.error('Error processing refund:', error);
    throw error;
  }
}));

// Get refund history for a payment
router.get('/:paymentId/refunds', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;
    
    // Get payment to find the Stripe payment intent ID
    const payment = await prisma.payment.findFirst({
      where: {
        id: paymentId!,
        isActive: true
      },
      select: {
        stripePaymentIntentId: true
      }
    });

    if (!payment) {
      throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
    }

    if (!payment.stripePaymentIntentId) {
      throw new AppError('No Stripe payment intent found for this payment', 400, 'NO_STRIPE_PAYMENT_INTENT');
    }
    
    const refunds = await stripeService.listRefunds(payment.stripePaymentIntentId!);
    
    res.json({
      success: true,
      data: refunds
    });
  } catch (error) {
    logger.error('Error fetching refunds:', error);
    throw error;
  }
}));

// Generate and download PDF receipt
router.post('/download-receipt', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { paymentIntentId, bookingData, amount, currency } = req.body;

  if (!paymentIntentId || !bookingData) {
    throw new AppError('Missing required data for receipt generation', 400);
  }

  try {
    // Create PDF document
    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${paymentIntentId.slice(-8)}.pdf"`);

    // Pipe PDF to response
    doc.pipe(res);

    // Add header
    doc.fontSize(20)
       .fillColor('#00806a')
       .text('BookOn', 50, 50)
       .fontSize(12)
       .fillColor('#666')
       .text('Activity Booking Receipt', 50, 80);

    // Add receipt details
    doc.fontSize(14)
       .fillColor('#000')
       .text('Receipt Details', 50, 120)
       .fontSize(10)
       .fillColor('#666')
       .text(`Booking Reference: ${req.body.bookingData?.courseBookings?.[0]?.id ? `BK-${req.body.bookingData.courseBookings[0].id.slice(-8).toUpperCase()}` : `#${paymentIntentId.slice(-8)}`}`, 50, 150)
       .text(`Payment ID: ${paymentIntentId.slice(-8)}`, 50, 170)
       .text(`Date: ${new Date().toLocaleDateString('en-GB')}`, 50, 190)
       .text(`Time: ${new Date().toLocaleTimeString('en-GB')}`, 50, 210);

    // Add booking information
    doc.fontSize(12)
       .fillColor('#000')
       .text('Booking Information', 50, 240)
       .fontSize(10)
       .fillColor('#666');

    let yPosition = 270;
    
    if (bookingData.courseBookings && bookingData.courseBookings.length > 0) {
      const courseBooking = bookingData.courseBookings[0];
      doc.text(`Activity: ${bookingData.activity?.title || 'Course Activity'}`, 50, yPosition);
      yPosition += 20;
      doc.text(`Child: ${courseBooking.childName || 'N/A'}`, 50, yPosition);
      yPosition += 20;
      doc.text(`Venue: ${bookingData.venue?.name || 'N/A'}`, 50, yPosition);
      yPosition += 20;
      doc.text(`Schedule: ${bookingData.courseSchedule || 'Course Schedule'}`, 50, yPosition);
      yPosition += 20;
      
      // Add activity dates if available
      if (bookingData.activity?.startDate || bookingData.activity?.start_date) {
        const startDate = new Date(bookingData.activity.startDate || bookingData.activity.start_date);
        doc.text(`Start Date: ${startDate.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, 50, yPosition);
        yPosition += 20;
      }
      
      if (bookingData.activity?.endDate || bookingData.activity?.end_date) {
        const endDate = new Date(bookingData.activity.endDate || bookingData.activity.end_date);
        doc.text(`End Date: ${endDate.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, 50, yPosition);
        yPosition += 20;
      }
    }

    // Add payment information
    doc.fontSize(12)
       .fillColor('#000')
       .text('Payment Information', 50, yPosition + 20)
       .fontSize(10)
       .fillColor('#666')
       .text(`Amount: ${new Intl.NumberFormat('en-GB', {
         style: 'currency',
         currency: currency.toUpperCase(),
       }).format(amount)}`, 50, yPosition + 50)
       .text(`Payment Method: Card Payment`, 50, yPosition + 70)
       .text(`Payment Status: Completed`, 50, yPosition + 90);

    // Add footer
    doc.fontSize(8)
       .fillColor('#999')
       .text('Thank you for choosing BookOn!', 50, doc.page.height - 100)
       .text('For support, contact us at support@bookon.app', 50, doc.page.height - 80)
       .text('This is an automated receipt. Please keep this for your records.', 50, doc.page.height - 60);

    // Finalize PDF
    doc.end();

    logger.info(`PDF receipt generated for payment ${paymentIntentId}`);
  } catch (error) {
    logger.error('Error generating PDF receipt:', error);
    throw new AppError('Failed to generate receipt', 500);
  }
}));

// Send confirmation email
router.post('/send-confirmation', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { paymentIntentId, bookingData, amount, currency } = req.body;

  if (!paymentIntentId || !bookingData) {
    throw new AppError('Missing required data for email confirmation', 400);
  }

  try {
    // Get user information
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true
      }
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Prepare email data
    const emailData = {
      to: user.email,
      parentName: `${user.firstName} ${user.lastName}`,
      childName: bookingData.courseBookings?.[0]?.childName || 'Your child',
      activityName: bookingData.activity?.title || 'Course Activity',
      venueName: bookingData.venue?.name || 'Venue',
      amount: amount,
      currency: currency,
      paymentIntentId: paymentIntentId,
      bookingDate: new Date().toLocaleDateString('en-GB'),
      courseSchedule: bookingData.courseSchedule || 'Course Schedule',
      venuePhone: bookingData.venue?.phone || 'N/A',
      venueEmail: bookingData.venue?.email || 'N/A',
      bookingReference: bookingData.courseBookings?.[0]?.id ? `BK-${bookingData.courseBookings[0].id.slice(-8).toUpperCase()}` : `BK-${paymentIntentId.slice(-8).toUpperCase()}`,
      activityStartDate: bookingData.activity?.startDate || bookingData.activity?.start_date,
      activityEndDate: bookingData.activity?.endDate || bookingData.activity?.end_date,
      sessionDates: bookingData.sessionDates || []
    };

    // Send payment confirmation email
    await emailService.sendPaymentReceipt(emailData);

    logger.info(`Payment confirmation email sent to ${user.email} for payment ${paymentIntentId}`);

    res.json({
      success: true,
      message: 'Confirmation email sent successfully'
    });
  } catch (error) {
    logger.error('Error sending confirmation email:', error);
    throw new AppError('Failed to send confirmation email', 500);
  }
}));

// Utility endpoint to fix existing bookings without registers
router.post('/fix-missing-registers', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    // Get all confirmed bookings without registers
    const bookings = await prisma.booking.findMany({
      where: {
        parentId: userId,
        status: 'confirmed',
        paymentStatus: 'paid'
      },
      include: {
        activity: true,
        child: true
      }
    });

    let fixedCount = 0;
    
    for (const booking of bookings) {
      try {
        await createRegisterForBooking(booking);
        fixedCount++;
        logger.info(`Fixed register for booking ${booking.id}`);
      } catch (error) {
        logger.error(`Failed to fix register for booking ${booking.id}:`, error);
      }
    }

    res.json({
      success: true,
      message: `Successfully created registers for ${fixedCount} bookings`,
      data: { fixed: fixedCount }
    });

  } catch (error) {
    logger.error('Error fixing missing registers:', error);
    throw new AppError('Failed to fix missing registers', 500, 'REGISTER_FIX_ERROR');
  }
}));

/**
 * Create register and attendance for a booking after payment success
 */
export async function createRegisterForBooking(booking: any) {
  try {
    logger.info(`Creating register for booking ${booking.id}`, {
      activityId: booking.activityId,
      activityDate: booking.activityDate,
      activityTime: booking.activityTime
    });

    // Find or create a session for this booking
    let session = await prisma.session.findFirst({
      where: {
        activityId: booking.activityId,
        date: booking.activityDate
      }
    });

    if (!session) {
      // Create session for this booking
      session = await prisma.session.create({
        data: {
          activityId: booking.activityId,
          date: booking.activityDate,
          startTime: booking.activityTime,
          endTime: booking.activityTime, // Using same time for end time
          status: 'active',
          capacity: 20, // Default capacity
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      logger.info(`Created session ${session.id} for booking ${booking.id}`);
    }

    // Find or create register for this session
    let register = await prisma.register.findFirst({
      where: { sessionId: session.id }
    });

    if (!register) {
      register = await prisma.register.create({
        data: {
          sessionId: session.id,
          date: booking.activityDate,
          status: 'upcoming',
          notes: `Auto-created for booking ${booking.id}`,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      logger.info(`Created register ${register.id} for session ${session.id}`);
    }

    // Create attendance record for this child
    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        registerId: register.id,
        childId: booking.childId,
        bookingId: booking.id
      }
    });

    if (!existingAttendance) {
      await prisma.attendance.create({
        data: {
          registerId: register.id,
          childId: booking.childId,
          bookingId: booking.id,
          present: false, // Default to absent, admin marks present
          notes: `Auto-enrolled for ${booking.activity?.title || 'Activity'}`,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      logger.info(`Created attendance record for booking ${booking.id} in register ${register.id}`);
    }

  } catch (error) {
    logger.error('Failed to create register for booking:', error);
    // Don't throw - this shouldn't fail the payment process
  }
}

export default router;
