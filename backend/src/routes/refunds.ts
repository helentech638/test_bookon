import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { AppError } from '../middleware/errorHandler';
import { cancellationService } from '../services/cancellationService';
import { CreditService } from '../services/creditService';
import { RefundNotificationService } from '../services/refundNotificationService';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { 
  CancellationPreview, 
  RefundRequest, 
  AdminRefundOverride,
  ParentWallet 
} from '../types/refundCredit';

const router = Router();

/**
 * Get cancellation preview for a booking
 * Shows parent exactly what they'll get before confirming cancellation
 */
router.get('/:bookingId/cancellation-preview', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Verify booking exists and user has access
    const booking = await db('bookings')
      .select(
        'bookings.*',
        'activities.name as activityName',
        'activities.startDate as activityStartDate',
        'activities.startTime as activityStartTime',
        'venues.name as venueName'
      )
      .join('activities', 'bookings.activityId', 'activities.id')
      .join('venues', 'activities.venueId', 'venues.id')
      .where('bookings.id', bookingId)
      .first();

    if (!booking) {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    // Check permissions
    if (userRole !== 'admin' && userRole !== 'staff' && booking.parentId !== userId) {
      throw new AppError('Unauthorized access to booking', 403, 'UNAUTHORIZED');
    }

    // Get cancellation eligibility
    const eligibility = await cancellationService.determineCancellationEligibility(bookingId, new Date());

    const preview: CancellationPreview = {
      bookingId,
      activityName: booking.activityName,
      activityDate: new Date(booking.activityStartDate),
      originalAmount: parseFloat(booking.amount),
      timing: eligibility.refundAmount > 0 ? 'before_24h' : 'after_24h',
      refundMethod: eligibility.method === 'cash' ? 'refund' : 'credit',
      adminFee: eligibility.adminFee,
      netAmount: eligibility.refundAmount > 0 ? eligibility.refundAmount : eligibility.creditAmount,
      reason: eligibility.reason,
      canCancel: eligibility.eligible,
      cancellationMessage: eligibility.eligible 
        ? `You will receive ${eligibility.method === 'cash' ? 'a refund of' : 'credit worth'} £${(eligibility.refundAmount > 0 ? eligibility.refundAmount : eligibility.creditAmount).toFixed(2)}${eligibility.adminFee > 0 ? ` (minus £${eligibility.adminFee.toFixed(2)} admin fee)` : ''}.`
        : eligibility.reason
    };

    res.json({
      success: true,
      data: preview
    });
  } catch (error) {
    logger.error('Error getting cancellation preview:', error);
    throw error;
  }
}));

/**
 * Cancel booking with refund/credit processing
 */
router.post('/:bookingId/cancel', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    if (!reason) {
      throw new AppError('Cancellation reason is required', 400, 'MISSING_REASON');
    }

    // Verify booking exists and user has access
    const booking = await db('bookings')
      .where('id', bookingId)
      .first();

    if (!booking) {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    // Check permissions
    if (userRole !== 'admin' && userRole !== 'staff' && booking.parentId !== userId) {
      throw new AppError('Unauthorized access to booking', 403, 'UNAUTHORIZED');
    }

    // Process cancellation
    const result = await cancellationService.processCancellation(
      bookingId,
      booking.parentId,
      reason,
      userRole === 'admin' || userRole === 'staff' ? userId : undefined
    );

    // Send notifications
    try {
      const eligibility = await cancellationService.determineCancellationEligibility(bookingId, new Date());
      
      await RefundNotificationService.sendRefundProcessedNotification({
        type: eligibility.method === 'cash' ? 'refund_processed' : 'credit_issued',
        parentId: booking.parentId,
        bookingId,
        amount: parseFloat(booking.amount),
        method: eligibility.method === 'cash' ? 'refund' : 'credit',
        reason,
        adminFee: eligibility.adminFee,
        netAmount: eligibility.refundAmount > 0 ? eligibility.refundAmount : eligibility.creditAmount
      });

      await RefundNotificationService.sendBookingCancelledNotification(
        bookingId,
        booking.parentId,
        reason,
        eligibility.refundAmount,
        eligibility.creditAmount
      );
    } catch (notificationError) {
      logger.error('Error sending notifications:', notificationError);
      // Don't fail the cancellation if notifications fail
    }

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      data: {
        refundTransactionId: result.refundTransactionId,
        creditId: result.creditId
      }
    });
  } catch (error) {
    logger.error('Error cancelling booking:', error);
    throw error;
  }
}));

/**
 * Get parent's wallet/credit balance
 */
router.get('/wallet', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // For admin/staff, allow viewing any parent's wallet
    const parentId = req.query.parentId as string || userId;
    
    if (userRole !== 'admin' && userRole !== 'staff' && parentId !== userId) {
      throw new AppError('Unauthorized access to wallet', 403, 'UNAUTHORIZED');
    }

    const wallet = await CreditService.getParentWallet(parentId);

    res.json({
      success: true,
      data: wallet
    });
  } catch (error) {
    logger.error('Error getting parent wallet:', error);
    throw error;
  }
}));

/**
 * Get parent's credit transactions
 */
router.get('/wallet/credits', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;

    // For admin/staff, allow viewing any parent's credits
    const parentId = req.query.parentId as string || userId;
    
    if (userRole !== 'admin' && userRole !== 'staff' && parentId !== userId) {
      throw new AppError('Unauthorized access to credits', 403, 'UNAUTHORIZED');
    }

    const result = await CreditService.getParentCredits(parentId, page, limit, status);

    res.json({
      success: true,
      data: result.credits,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit)
      }
    });
  } catch (error) {
    logger.error('Error getting parent credits:', error);
    throw error;
  }
}));

/**
 * Admin override for refund/credit processing
 */
router.post('/admin/override', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;

    if (userRole !== 'admin' && userRole !== 'staff') {
      throw new AppError('Admin access required', 403, 'ADMIN_REQUIRED');
    }

    const {
      bookingId,
      parentId,
      overrideReason,
      refundMethod,
      amount,
      adminFee
    }: AdminRefundOverride = req.body;

    if (!bookingId || !parentId || !overrideReason || !refundMethod || !amount) {
      throw new AppError('Missing required fields', 400, 'MISSING_FIELDS');
    }

    // Verify booking exists
    const booking = await db('bookings')
      .where('id', bookingId)
      .first();

    if (!booking) {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    // Process admin override
    const refundRequest: RefundRequest = {
      bookingId,
      parentId,
      reason: overrideReason,
      adminOverride: true,
      adminId: userId,
      refundMethod,
      amount
    };

    // Import RefundService
    const { RefundService } = await import('../services/refundService');
    const refundTransaction = await RefundService.processRefund(refundRequest);

    // Send notification
    try {
      await RefundNotificationService.sendAdminOverrideNotification(
        parentId,
        userId,
        bookingId,
        {
          originalAmount: parseFloat(booking.amount),
          overrideAmount: amount,
          overrideReason,
          refundMethod,
          adminFee
        }
      );
    } catch (notificationError) {
      logger.error('Error sending admin override notification:', notificationError);
    }

    res.json({
      success: true,
      message: 'Admin override processed successfully',
      data: {
        refundTransactionId: refundTransaction.id,
        amount: refundTransaction.netAmount,
        method: refundTransaction.method
      }
    });
  } catch (error) {
    logger.error('Error processing admin override:', error);
    throw error;
  }
}));

/**
 * Get refund transactions for admin dashboard
 */
router.get('/admin/refunds', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;

    if (userRole !== 'admin' && userRole !== 'staff') {
      throw new AppError('Admin access required', 403, 'ADMIN_REQUIRED');
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const venueId = req.query.venueId as string;

    const offset = (page - 1) * limit;
    let query = db('refund_transactions')
      .select(
        'refund_transactions.*',
        'bookings.activityId',
        'activities.name as activityName',
        'activities.startDate as activityStartDate',
        'venues.name as venueName',
        'users.firstName as parentFirstName',
        'users.lastName as parentLastName',
        'users.email as parentEmail'
      )
      .join('bookings', 'refund_transactions.bookingId', 'bookings.id')
      .join('activities', 'bookings.activityId', 'activities.id')
      .join('venues', 'activities.venueId', 'venues.id')
      .join('users', 'refund_transactions.parentId', 'users.id');

    if (status) {
      query = query.where('refund_transactions.status', status);
    }

    if (venueId) {
      query = query.where('venues.id', venueId);
    }

    const refunds = await query
      .orderBy('refund_transactions.createdAt', 'desc')
      .limit(limit)
      .offset(offset);

    const total = await query.clone().count('* as count').first();

    res.json({
      success: true,
      data: refunds,
      pagination: {
        page,
        limit,
        total: parseInt(total?.count as string) || 0,
        totalPages: Math.ceil((parseInt(total?.count as string) || 0) / limit)
      }
    });
  } catch (error) {
    logger.error('Error getting refund transactions:', error);
    throw error;
  }
}));

/**
 * Get credit statistics for admin dashboard
 */
router.get('/admin/credits/stats', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;

    if (userRole !== 'admin' && userRole !== 'staff') {
      throw new AppError('Admin access required', 403, 'ADMIN_REQUIRED');
    }

    const venueId = req.query.venueId as string;
    const stats = await CreditService.getCreditStats(venueId);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error getting credit stats:', error);
    throw error;
  }
}));

/**
 * Process expired credits (admin endpoint)
 */
router.post('/admin/process-expired-credits', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;

    if (userRole !== 'admin' && userRole !== 'staff') {
      throw new AppError('Admin access required', 403, 'ADMIN_REQUIRED');
    }

    const processedCount = await CreditService.processExpiredCredits();

    res.json({
      success: true,
      message: `Processed ${processedCount} expired credits`,
      data: { processedCount }
    });
  } catch (error) {
    logger.error('Error processing expired credits:', error);
    throw error;
  }
}));

/**
 * Cancel a credit (admin endpoint)
 */
router.post('/admin/credits/:creditId/cancel', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { creditId } = req.params;
    const { reason } = req.body;

    if (userRole !== 'admin' && userRole !== 'staff') {
      throw new AppError('Admin access required', 403, 'ADMIN_REQUIRED');
    }

    if (!reason) {
      throw new AppError('Cancellation reason is required', 400, 'MISSING_REASON');
    }

    await CreditService.cancelCredit(creditId, reason);

    res.json({
      success: true,
      message: 'Credit cancelled successfully'
    });
  } catch (error) {
    logger.error('Error cancelling credit:', error);
    throw error;
  }
}));

export default router;



