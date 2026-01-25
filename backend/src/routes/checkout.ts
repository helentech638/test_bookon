import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const router = Router();

// Process checkout with cart items
router.post('/process', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { 
      items, 
      subtotal, 
      discountCode, 
      discountAmount, 
      creditAmount, 
      finalTotal 
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new AppError('No items provided for checkout', 400, 'NO_ITEMS');
    }

    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      const bookingIds: string[] = [];
      
      // Process each item
      for (const item of items) {
        // Create booking for each child
        for (const child of item.children) {
          const booking = await tx.booking.create({
            data: {
              parentId: userId,
              activityId: item.activityId,
              childId: child.id,
              bookingDate: new Date(),
              activityDate: new Date(item.date),
              activityTime: item.time,
              status: 'confirmed',
              amount: item.price / item.children.length, // Split price among children
              totalAmount: item.price / item.children.length,
              paymentStatus: finalTotal > 0 ? 'pending' : 'paid',
              paymentMethod: 'card',
              notes: `Cart checkout - ${item.activityName}`,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          });

          bookingIds.push(booking.id);

          // If credit was used, record the credit transaction
          if (creditAmount > 0) {
            await tx.creditTransaction.create({
              data: {
                userId: userId,
                amount: -creditAmount, // Negative for usage
                type: 'debit',
                reason: `Payment for booking ${booking.id}`,
                createdAt: new Date()
              }
            });

            // Update user's credit balance
            await tx.user.update({
              where: { id: userId },
              data: {
                creditBalance: {
                  decrement: creditAmount
                }
              }
            });
          }

          // If discount was applied, record the usage
          if (discountCode && discountAmount > 0) {
            const discount = await tx.discountCode.findFirst({
              where: { code: discountCode }
            });

            if (discount) {
              await tx.discountUsage.create({
                data: {
                  discountCodeId: discount.id,
                  userId: userId,
                  bookingId: booking.id,
                  discountAmount: discountAmount / items.length, // Split discount among items
                  appliedAt: new Date()
                }
              });
            }
          }
        }
      }

      return { bookingIds };
    });

    logger.info(`Checkout processed successfully for user ${userId}: ${result.bookingIds.length} bookings created`);

    res.json({
      success: true,
      message: 'Checkout processed successfully',
      data: {
        bookingIds: result.bookingIds,
        totalBookings: result.bookingIds.length,
        subtotal: subtotal,
        discountAmount: discountAmount || 0,
        creditAmount: creditAmount || 0,
        finalTotal: finalTotal
      }
    });

  } catch (error) {
    logger.error('Error processing checkout:', error);
    throw error;
  }
}));

// Get checkout summary (for preview)
router.post('/summary', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { items, discountCode, useCreditBalance } = req.body;
    const userId = req.user!.id;

    if (!items || !Array.isArray(items)) {
      throw new AppError('No items provided', 400, 'NO_ITEMS');
    }

    const subtotal = items.reduce((sum: number, item: any) => sum + item.price, 0);
    let discountAmount = 0;
    let creditBalance = 0;

    // Get user's credit balance
    if (useCreditBalance) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { creditBalance: true }
      });
      creditBalance = user?.creditBalance || 0;
    }

    // Calculate discount if code provided
    if (discountCode) {
      const discount = await prisma.discountCode.findFirst({
        where: {
          code: discountCode.toUpperCase(),
          isActive: true,
          startDate: { lte: new Date() },
          endDate: { gte: new Date() }
        }
      });

      if (discount) {
        if (discount.type === 'percentage') {
          discountAmount = (subtotal * discount.value) / 100;
          if (discount.maxDiscountAmount) {
            discountAmount = Math.min(discountAmount, discount.maxDiscountAmount);
          }
        } else {
          discountAmount = Math.min(discount.value, subtotal);
        }
      }
    }

    const creditAmount = useCreditBalance ? Math.min(creditBalance, subtotal - discountAmount) : 0;
    const finalTotal = Math.max(0, subtotal - discountAmount - creditAmount);

    res.json({
      success: true,
      data: {
        subtotal,
        discountAmount,
        creditAmount,
        finalTotal,
        creditBalance
      }
    });

  } catch (error) {
    logger.error('Error calculating checkout summary:', error);
    throw error;
  }
}));

// Create payment intent for cart checkout
router.post('/create-payment', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { 
      amount, 
      items, 
      discountCode, 
      discountAmount, 
      creditAmount, 
      subtotal,
      paymentMethod,
      successUrl,
      cancelUrl
    } = req.body;

    logger.info('Creating payment intent for cart checkout', { 
      userId, 
      amount, 
      itemCount: items?.length,
      discountCode,
      discountAmount,
      creditAmount 
    });

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new AppError('No items provided for checkout', 400, 'NO_ITEMS');
    }

    if (amount <= 0) {
      throw new AppError('Invalid payment amount', 400, 'INVALID_AMOUNT');
    }

    // Get user's Stripe customer ID
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true, firstName: true, lastName: true, email: true }
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    logger.info('User found for payment intent', { 
      userId, 
      email: user.email, 
      hasStripeCustomerId: !!user.stripeCustomerId 
    });

    // Create or get Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      logger.info('Creating new Stripe customer', { userId, email: user.email });
      
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: {
          userId: userId
        }
      });
      
      customerId = customer.id;
      
      // Update user with Stripe customer ID
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId }
      });
      
      logger.info('Stripe customer created and user updated', { userId, customerId });
    }

    // Create payment intent
    logger.info('Creating Stripe payment intent', { 
      userId, 
      customerId, 
      amount: Math.round(amount * 100) 
    });
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to pence
      currency: 'gbp',
      customer: customerId,
      payment_method_types: ['card'],
      metadata: {
        userId: userId,
        type: 'cart_checkout',
        itemCount: items.length.toString(),
        subtotal: subtotal.toString(),
        discountAmount: (discountAmount || 0).toString(),
        creditAmount: (creditAmount || 0).toString(),
        discountCode: discountCode || ''
      },
      description: `Cart checkout - ${items.length} items`,
      receipt_email: user.email,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    logger.info(`Payment intent created successfully: ${paymentIntent.id}`, { 
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      status: paymentIntent.status 
    });

    res.json({
      success: true,
      data: {
        paymentIntent: {
          id: paymentIntent.id,
          clientSecret: paymentIntent.client_secret,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status
        },
        checkoutData: {
          items,
          subtotal,
          discountAmount: discountAmount || 0,
          creditAmount: creditAmount || 0,
          finalAmount: amount
        }
      }
    });

  } catch (error) {
    logger.error('Error creating payment intent for cart checkout:', error);
    throw error;
  }
}));

// Process successful payment for cart checkout
router.post('/process-payment-success', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { 
      paymentIntentId,
      items, 
      subtotal, 
      discountCode, 
      discountAmount, 
      creditAmount, 
      finalTotal 
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new AppError('No items provided for checkout', 400, 'NO_ITEMS');
    }

    // Verify payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      throw new AppError('Payment not completed', 400, 'PAYMENT_NOT_COMPLETED');
    }

    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      const bookingIds: string[] = [];
      
      // Process each item
      for (const item of items) {
        // Create booking for each child
        for (const child of item.children) {
          const booking = await tx.booking.create({
            data: {
              parentId: userId,
              activityId: item.activityId,
              childId: child.id,
              bookingDate: new Date(),
              activityDate: new Date(item.date),
              activityTime: item.time,
              status: 'confirmed',
              amount: item.price / item.children.length, // Split price among children
              totalAmount: item.price / item.children.length,
              paymentStatus: 'paid',
              paymentMethod: 'card',
              notes: `Cart checkout - ${item.activityName}`,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          });

          bookingIds.push(booking.id);

          // If credit was used, record the credit transaction
          if (creditAmount > 0) {
            await tx.creditTransaction.create({
              data: {
                userId: userId,
                amount: -creditAmount, // Negative for usage
                type: 'debit',
                reason: `Payment for booking ${booking.id}`,
                createdAt: new Date()
              }
            });

            // Update user's credit balance
            await tx.user.update({
              where: { id: userId },
              data: {
                creditBalance: {
                  decrement: creditAmount
                }
              }
            });
          }

          // If discount was applied, record the usage
          if (discountCode && discountAmount > 0) {
            const discount = await tx.discountCode.findFirst({
              where: { code: discountCode }
            });

            if (discount) {
              await tx.discountUsage.create({
                data: {
                  discountCodeId: discount.id,
                  userId: userId,
                  bookingId: booking.id,
                  discountAmount: discountAmount / items.length, // Split discount among items
                  appliedAt: new Date()
                }
              });
            }
          }
        }
      }

      // Create payment record
      const payment = await tx.payment.create({
        data: {
          userId: userId,
          amount: finalTotal,
          currency: 'gbp',
          status: 'succeeded',
          paymentMethod: 'card',
          stripePaymentIntentId: paymentIntentId,
          stripeChargeId: paymentIntent.latest_charge as string,
          description: `Cart checkout - ${items.length} items`,
          metadata: {
            itemCount: items.length,
            subtotal: subtotal,
            discountAmount: discountAmount || 0,
            creditAmount: creditAmount || 0,
            discountCode: discountCode || ''
          },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      return { bookingIds, payment };
    });

    logger.info(`Cart checkout payment processed successfully for user ${userId}: ${result.bookingIds.length} bookings created`);

    res.json({
      success: true,
      message: 'Payment processed successfully',
      data: {
        bookingIds: result.bookingIds,
        paymentId: result.payment.id,
        totalBookings: result.bookingIds.length,
        subtotal: subtotal,
        discountAmount: discountAmount || 0,
        creditAmount: creditAmount || 0,
        finalTotal: finalTotal
      }
    });

  } catch (error) {
    logger.error('Error processing cart checkout payment:', error);
    throw error;
  }
}));

export default router;
