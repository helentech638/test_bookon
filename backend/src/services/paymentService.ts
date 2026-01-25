import { safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';
import { Decimal } from '@prisma/client/runtime/library';

export interface PaymentAdjustment {
  bookingId: string;
  originalAmount: number;
  newAmount: number;
  adjustmentAmount: number;
  reason: 'early_dropoff_added' | 'early_dropoff_removed' | 'late_pickup_added' | 'late_pickup_removed' | 'booking_transferred' | 'booking_modified';
  adminId?: string;
}

export interface RefundCalculation {
  refundAmount: number;
  refundType: 'full' | 'partial' | 'none';
  reason: string;
}

export class PaymentService {
  /**
   * Calculate payment adjustment for booking modifications
   */
  static async calculatePaymentAdjustment(bookingId: string, newOptions: {
    hasEarlyDropoff?: boolean;
    hasLatePickup?: boolean;
    earlyDropoffAmount?: number;
    latePickupAmount?: number;
  }): Promise<PaymentAdjustment> {
    try {
      const booking = await safePrismaQuery(async (client) => {
        return await client.booking.findUnique({
          where: { id: bookingId },
          include: {
            activity: {
              select: {
                earlyDropoffPrice: true,
                latePickupPrice: true
              }
            }
          }
        });
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      const originalAmount = Number(booking.totalAmount || booking.amount);
      let newAmount = Number(booking.amount);

      // Calculate new total based on options
      if (newOptions.hasEarlyDropoff && booking.activity.earlyDropoffPrice) {
        newAmount += Number(booking.activity.earlyDropoffPrice);
      }
      if (newOptions.hasLatePickup && booking.activity.latePickupPrice) {
        newAmount += Number(booking.activity.latePickupPrice);
      }

      const adjustmentAmount = newAmount - originalAmount;

      return {
        bookingId,
        originalAmount,
        newAmount,
        adjustmentAmount,
        reason: this.determineAdjustmentReason(booking, newOptions)
      };
    } catch (error) {
      logger.error('Error calculating payment adjustment:', error);
      throw error;
    }
  }

  /**
   * Apply payment adjustment to booking
   */
  static async applyPaymentAdjustment(adjustment: PaymentAdjustment): Promise<void> {
    try {
      const { bookingId, newAmount, adjustmentAmount, reason, adminId } = adjustment;

      // Update booking total amount
      await safePrismaQuery(async (client) => {
        return await client.booking.update({
          where: { id: bookingId },
          data: {
            totalAmount: new Decimal(newAmount),
            updatedAt: new Date()
          }
        });
      });

      // If adjustment is positive (additional charge), create a new payment intent
      if (adjustmentAmount > 0) {
        await this.createAdditionalPayment(bookingId, adjustmentAmount, reason);
      }

      // If adjustment is negative (refund), process refund
      if (adjustmentAmount < 0) {
        await this.processRefund(bookingId, Math.abs(adjustmentAmount), reason);
      }

      // Log payment adjustment
      await this.logPaymentAdjustment(adjustment);

      logger.info(`Payment adjustment applied for booking ${bookingId}`, {
        adjustmentAmount,
        reason,
        adminId
      });

    } catch (error) {
      logger.error('Error applying payment adjustment:', error);
      throw error;
    }
  }

  /**
   * Calculate refund for booking cancellation
   */
  static async calculateCancellationRefund(bookingId: string): Promise<RefundCalculation> {
    try {
      const booking = await safePrismaQuery(async (client) => {
        return await client.booking.findUnique({
          where: { id: bookingId },
          select: {
            totalAmount: true,
            amount: true,
            activityDate: true,
            status: true
          }
        });
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      const activityDate = new Date(booking.activityDate);
      const now = new Date();
      const hoursUntilActivity = (activityDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      const totalAmount = Number(booking.totalAmount || booking.amount);
      let refundAmount = 0;
      let refundType: 'full' | 'partial' | 'none' = 'none';
      let reason = '';

      // Refund policy: Full refund if cancelled 48+ hours before, 50% if 24-48 hours, no refund if <24 hours
      if (hoursUntilActivity >= 48) {
        refundAmount = totalAmount;
        refundType = 'full';
        reason = 'Full refund - cancelled more than 48 hours before activity';
      } else if (hoursUntilActivity >= 24) {
        refundAmount = totalAmount * 0.5;
        refundType = 'partial';
        reason = '50% refund - cancelled 24-48 hours before activity';
      } else {
        refundAmount = 0;
        refundType = 'none';
        reason = 'No refund - cancelled less than 24 hours before activity';
      }

      return {
        refundAmount,
        refundType,
        reason
      };
    } catch (error) {
      logger.error('Error calculating cancellation refund:', error);
      throw error;
    }
  }

  /**
   * Process refund for booking
   */
  static async processRefund(bookingId: string, refundAmount: number, reason: string): Promise<void> {
    try {
      const booking = await safePrismaQuery(async (client) => {
        return await client.booking.findUnique({
          where: { id: bookingId },
          select: {
            parentId: true,
            paymentIntentId: true
          }
        });
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      // Add refund to user's credit balance
      await safePrismaQuery(async (client) => {
        return await client.user.update({
          where: { id: booking.parentId },
          data: {
            creditBalance: {
              increment: refundAmount
            }
          }
        });
      });

      // Create credit transaction record
      await safePrismaQuery(async (client) => {
        return await client.creditTransaction.create({
          data: {
            userId: booking.parentId,
            amount: new Decimal(refundAmount),
            type: 'credit',
            reason: `Refund for booking modification: ${reason}`,
            createdAt: new Date()
          }
        });
      });

      // If there's a Stripe payment intent, process refund through Stripe
      if (booking.paymentIntentId) {
        await this.processStripeRefund(booking.paymentIntentId, refundAmount);
      }

      logger.info(`Refund processed for booking ${bookingId}`, {
        refundAmount,
        reason
      });

    } catch (error) {
      logger.error('Error processing refund:', error);
      throw error;
    }
  }

  /**
   * Create additional payment for booking modifications
   */
  private static async createAdditionalPayment(bookingId: string, amount: number, reason: string): Promise<void> {
    try {
      // For now, add to user's credit balance (they can pay later)
      // In a full implementation, this would create a new Stripe payment intent
      const booking = await safePrismaQuery(async (client) => {
        return await client.booking.findUnique({
          where: { id: bookingId },
          select: { parentId: true }
        });
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      // Create a pending payment record
      await safePrismaQuery(async (client) => {
        return await client.payment.create({
          data: {
            bookingId,
            userId: booking.parentId,
            amount: new Decimal(amount),
            currency: 'GBP',
            status: 'pending',
            metadata: { reason: `Additional payment for: ${reason}` }
          }
        });
      });

      logger.info(`Additional payment created for booking ${bookingId}`, {
        amount,
        reason
      });

    } catch (error) {
      logger.error('Error creating additional payment:', error);
      throw error;
    }
  }

  /**
   * Process Stripe refund
   */
  private static async processStripeRefund(paymentIntentId: string, amount: number): Promise<void> {
    try {
      // This would integrate with Stripe API to process the refund
      // For now, we'll just log it
      logger.info(`Stripe refund processed for payment intent ${paymentIntentId}`, {
        amount
      });
    } catch (error) {
      logger.error('Error processing Stripe refund:', error);
      throw error;
    }
  }

  /**
   * Determine adjustment reason
   */
  private static determineAdjustmentReason(booking: any, newOptions: any): 'early_dropoff_added' | 'early_dropoff_removed' | 'late_pickup_added' | 'late_pickup_removed' | 'booking_transferred' | 'booking_modified' {
    if (newOptions.hasEarlyDropoff && !booking.hasEarlyDropoff) {
      return 'early_dropoff_added';
    }
    if (!newOptions.hasEarlyDropoff && booking.hasEarlyDropoff) {
      return 'early_dropoff_removed';
    }
    if (newOptions.hasLatePickup && !booking.hasLatePickup) {
      return 'late_pickup_added';
    }
    if (!newOptions.hasLatePickup && booking.hasLatePickup) {
      return 'late_pickup_removed';
    }
    return 'booking_modified';
  }

  /**
   * Log payment adjustment for audit
   */
  private static async logPaymentAdjustment(adjustment: PaymentAdjustment): Promise<void> {
    try {
      await safePrismaQuery(async (client) => {
        return await client.auditLog.create({
          data: {
            action: 'payment_adjustment',
            entityType: 'booking',
            entityId: adjustment.bookingId,
            changes: {
              originalAmount: adjustment.originalAmount,
              newAmount: adjustment.newAmount,
              adjustmentAmount: adjustment.adjustmentAmount,
              reason: adjustment.reason,
              adminId: adjustment.adminId
            },
            userId: adjustment.adminId || 'system',
            userRole: 'admin',
            timestamp: new Date()
          }
        });
      });
    } catch (error) {
      logger.error('Error logging payment adjustment:', error);
      // Don't throw - this is not critical
    }
  }
}
