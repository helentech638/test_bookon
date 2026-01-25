import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

export interface RefundCalculation {
  refundableAmount: number;
  adminFee: number;
  netRefund: number;
  refundMethod: 'cash' | 'credit';
  reason: string;
  breakdown: {
    totalPaid: number;
    sessionsRemaining: number;
    valuePerSession: number;
    adminFeeDeducted: number;
  };
}

export interface CancellationContext {
  bookingId: string;
  parentId: string;
  cancellationTime: Date;
  reason: string;
  isProviderCancellation?: boolean;
}

export class RefundPolicyService {
  /**
   * Calculate refund based on cancellation policy
   */
  static async calculateRefund(context: CancellationContext): Promise<RefundCalculation> {
    try {
      // Get booking details
      const booking = await prisma.booking.findUnique({
        where: { id: context.bookingId },
        include: {
          activity: true,
          parent: true,
          child: true
        }
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      // Get provider settings for refund policy
      const providerSettings = await prisma.providerSettings.findFirst({
        where: { providerId: booking.activity.venueId }
      });

      const adminFee = providerSettings?.adminFeeAmount || 2.00;
      const defaultRefundMethod = providerSettings?.defaultRefundMethod || 'credit';

      // Calculate time to first session
      const activityStartTime = new Date(booking.activityDate);
      const timeToStart = activityStartTime.getTime() - context.cancellationTime.getTime();
      const hoursToStart = timeToStart / (1000 * 60 * 60);

      const totalPaid = Number(booking.amount);
      const paymentMethod = booking.paymentMethod;

      let refundableAmount = 0;
      let refundMethod: 'cash' | 'credit' = 'credit';
      let reason = '';

      // Apply cancellation rules based on requirements document
      if (context.isProviderCancellation) {
        // Provider cancels: Full refund or full credit (parent choice), no admin fee
        refundableAmount = totalPaid;
        refundMethod = defaultRefundMethod === 'parent_choice' ? 'credit' : defaultRefundMethod as 'cash' | 'credit';
        reason = 'Provider cancellation - full refund/credit (no admin fee)';
      } else if (hoursToStart >= 24) {
        // Parent cancels ≥24 hours before first session
        if (paymentMethod === 'card') {
          refundableAmount = totalPaid;
          refundMethod = 'cash';
          reason = 'Parent cancellation ≥24h before - cash refund minus admin fee';
        } else {
          // TFC/voucher payments: issue account credit (no cash)
          refundableAmount = totalPaid;
          refundMethod = 'credit';
          reason = 'Parent cancellation ≥24h before - credit refund minus admin fee';
        }
      } else if (hoursToStart < 24) {
        // Parent cancels <24 hours or mid-course: Pro-rata credit for unused sessions
        refundableAmount = totalPaid; // For now, assume full amount (would need session tracking for pro-rata)
        refundMethod = 'credit';
        reason = 'Parent cancellation <24h - pro-rata credit minus admin fee';
      } else {
        // No-show: No refund/credit
        refundableAmount = 0;
        refundMethod = 'credit';
        reason = 'No-show - no refund/credit';
      }

      // Apply admin fee (except for provider cancellations)
      const adminFeeToApply = context.isProviderCancellation ? 0 : adminFee;
      const netRefund = Math.max(0, refundableAmount - adminFeeToApply);

      return {
        refundableAmount,
        adminFee: adminFeeToApply,
        netRefund,
        refundMethod,
        reason,
        breakdown: {
          totalPaid,
          sessionsRemaining: 1, // Would need session tracking for accurate count
          valuePerSession: totalPaid,
          adminFeeDeducted: adminFeeToApply
        }
      };
    } catch (error) {
      logger.error('Error calculating refund:', error);
      throw error;
    }
  }

  /**
   * Process refund based on calculation
   */
  static async processRefund(
    context: CancellationContext, 
    calculation: RefundCalculation
  ): Promise<void> {
    try {
      await prisma.$transaction(async (tx) => {
        // Update booking status
        await tx.booking.update({
          where: { id: context.bookingId },
          data: {
            status: 'cancelled',
            updatedAt: new Date()
          }
        });

        // Create refund record
        if (calculation.refundMethod === 'cash') {
          await tx.refund.create({
            data: {
              transactionId: context.bookingId, // Using booking ID as transaction reference
              parentId: context.parentId,
              bookingId: context.bookingId,
              amount: calculation.netRefund,
              method: 'cash',
              reason: calculation.reason,
              status: 'processing',
              createdAt: new Date()
            }
          });
        } else {
          // Create wallet credit
          await tx.walletCredit.create({
            data: {
              parentId: context.parentId,
              amount: calculation.netRefund,
              usedAmount: 0,
              expiryDate: new Date(Date.now() + 12 * 30 * 24 * 60 * 60 * 1000), // 12 months
              source: 'cancellation',
              status: 'active',
              description: calculation.reason,
              createdAt: new Date()
            }
          });
        }

        // Log the refund
        logger.info('Refund processed', {
          bookingId: context.bookingId,
          parentId: context.parentId,
          refundAmount: calculation.netRefund,
          adminFee: calculation.adminFee,
          refundMethod: calculation.refundMethod,
          reason: calculation.reason
        });
      });

      // Remove attendance records from registers (outside transaction to avoid conflicts)
      try {
        const { RealTimeRegisterService } = await import('./realTimeRegisterService');
        await RealTimeRegisterService.removeAttendanceForCancelledBooking(context.bookingId);
        logger.info(`Removed attendance records for cancelled booking ${context.bookingId}`);
      } catch (attendanceError) {
        logger.error('Failed to remove attendance records:', attendanceError);
        // Don't fail the refund if attendance removal fails
      }

    } catch (error) {
      logger.error('Error processing refund:', error);
      throw error;
    }
  }

  /**
   * Get cancellation preview for parent
   */
  static async getCancellationPreview(context: CancellationContext): Promise<RefundCalculation> {
    return await this.calculateRefund(context);
  }
}

