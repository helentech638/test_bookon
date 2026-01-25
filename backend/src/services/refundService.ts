import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import stripeService from './stripe';
import { 
  RefundCalculation, 
  CancellationContext, 
  RefundRequest, 
  RefundTransaction,
  CourseRefundCalculation,
  RefundPolicyConfig,
  AdminRefundOverride
} from '../types/refundCredit';
import { BookingModel } from '../models/Booking';

export class RefundService {
  private static readonly ADMIN_FEE_AMOUNT = 2.00; // £2 admin fee
  private static readonly REFUND_CUTOFF_HOURS = 24;
  private static readonly CREDIT_EXPIRY_MONTHS = 12;

  /**
   * Calculate refund amount based on cancellation timing and policy
   */
  static async calculateRefund(context: CancellationContext): Promise<RefundCalculation> {
    try {
      const hoursUntilStart = this.getHoursUntilActivity(context.activityStartDate, context.cancellationDate);
      const isCourse = context.isCourse || false;
      
      let refundMethod: 'refund' | 'credit';
      let adminFee = 0;
      let netRefund = 0;
      let reason = '';
      let timing: 'before_24h' | 'after_24h' | 'after_start';

      // Determine timing category
      if (hoursUntilStart >= this.REFUND_CUTOFF_HOURS) {
        timing = 'before_24h';
        refundMethod = 'refund';
        adminFee = this.ADMIN_FEE_AMOUNT;
        reason = 'Cancelled more than 24 hours before activity';
      } else if (hoursUntilStart > 0) {
        timing = 'after_24h';
        refundMethod = 'credit';
        adminFee = 0; // No admin fee for credits
        reason = 'Cancelled within 24 hours of activity';
      } else {
        timing = 'after_start';
        refundMethod = 'credit';
        adminFee = 0;
        reason = 'Cancelled after activity started';
      }

      // Calculate refund amount
      if (isCourse && context.courseStartDate && context.totalSessions && context.usedSessions !== undefined) {
        // Pro-rata calculation for courses
        const courseCalculation = this.calculateCourseRefund(
          context.originalAmount,
          context.totalSessions,
          context.usedSessions,
          timing
        );
        
        netRefund = courseCalculation.proRataRefund;
        if (refundMethod === 'refund') {
          netRefund = Math.max(0, netRefund - adminFee);
        }
      } else {
        // Full refund for single sessions
        netRefund = context.originalAmount;
        if (refundMethod === 'refund') {
          netRefund = Math.max(0, netRefund - adminFee);
        }
      }

      return {
        originalAmount: context.originalAmount,
        adminFee,
        netRefund,
        refundMethod,
        reason,
        timing,
        proRataAmount: isCourse ? netRefund : 0,
        unusedSessions: isCourse ? (context.totalSessions || 0) - (context.usedSessions || 0) : 0,
        totalSessions: context.totalSessions
      };
    } catch (error) {
      logger.error('Error calculating refund:', error);
      throw error;
    }
  }

  /**
   * Calculate pro-rata refund for courses
   */
  private static calculateCourseRefund(
    totalAmount: number,
    totalSessions: number,
    usedSessions: number,
    timing: 'before_24h' | 'after_24h' | 'after_start'
  ): CourseRefundCalculation {
    const sessionPrice = totalAmount / totalSessions;
    const unusedSessions = Math.max(0, totalSessions - usedSessions);
    const unusedAmount = unusedSessions * sessionPrice;
    
    // For courses, refund unused sessions
    let proRataRefund = unusedAmount;
    
    // If cancelled after start, only refund unused sessions
    if (timing === 'after_start') {
      proRataRefund = unusedAmount;
    }

    return {
      totalSessions,
      usedSessions,
      unusedSessions,
      sessionPrice,
      unusedAmount,
      proRataRefund
    };
  }

  /**
   * Process refund through Stripe
   */
  static async processStripeRefund(
    paymentIntentId: string,
    amount: number,
    reason: string,
    connectAccountId?: string
  ): Promise<string> {
    try {
      const refund = await stripeService.processRefund(paymentIntentId, {
        amount,
        reason,
        connectAccountId
      });

      logger.info(`Stripe refund processed: ${refund.id} for amount: ${amount}`);
      return refund.id;
    } catch (error) {
      logger.error('Error processing Stripe refund:', error);
      throw new AppError('Failed to process refund through Stripe', 500, 'STRIPE_REFUND_FAILED');
    }
  }

  /**
   * Process refund transaction
   */
  static async processRefund(request: RefundRequest): Promise<RefundTransaction> {
    try {
      // Get booking details
      const booking = await BookingModel.findByIdWithDetails(request.bookingId);
      if (!booking) {
        throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
      }

      // Verify parent ownership
      if (booking.parentId !== request.parentId) {
        throw new AppError('Unauthorized access to booking', 403, 'UNAUTHORIZED');
      }

      // Create cancellation context
      const context: CancellationContext = {
        bookingId: request.bookingId,
        parentId: request.parentId,
        activityId: booking.activityId,
        activityStartDate: new Date(booking.activity.startDate),
        cancellationDate: new Date(),
        originalAmount: parseFloat(booking.totalAmount?.toString() || '0'),
        paymentIntentId: booking.paymentIntentId,
        venueId: booking.venue?.id
      };

      // Calculate refund
      const calculation = await this.calculateRefund(context);

      // Override refund method if specified
      if (request.refundMethod) {
        calculation.refundMethod = request.refundMethod;
        if (request.refundMethod === 'refund') {
          calculation.adminFee = this.ADMIN_FEE_AMOUNT;
          calculation.netRefund = Math.max(0, calculation.originalAmount - calculation.adminFee);
        } else {
          calculation.adminFee = 0;
          calculation.netRefund = calculation.originalAmount;
        }
      }

      // Override amount if specified (for partial refunds)
      if (request.amount && request.amount < calculation.originalAmount) {
        calculation.netRefund = request.amount;
        if (calculation.refundMethod === 'refund') {
          calculation.adminFee = Math.min(this.ADMIN_FEE_AMOUNT, calculation.originalAmount - request.amount);
        }
      }

      // Process refund in transaction
      const refundTransaction = await db.transaction(async (trx) => {
        // Create refund transaction record
        const [refundRecord] = await trx('refund_transactions')
          .insert({
            bookingId: request.bookingId,
            parentId: request.parentId,
            amount: calculation.originalAmount,
            adminFee: calculation.adminFee,
            netAmount: calculation.netRefund,
            method: calculation.refundMethod,
            reason: request.reason,
            status: 'processing',
            adminId: request.adminId,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning('*');

        // Process based on refund method
        if (calculation.refundMethod === 'refund') {
          // Process Stripe refund
          if (booking.paymentIntentId) {
            const stripeRefundId = await this.processStripeRefund(
              booking.paymentIntentId,
              calculation.netRefund,
              request.reason
            );
            
            await trx('refund_transactions')
              .where({ id: refundRecord.id })
              .update({
                stripeRefundId,
                status: 'completed',
                processedAt: new Date(),
                updatedAt: new Date()
              });
          }
        } else {
          // Process credit issuance
          await this.issueCredit({
            parentId: request.parentId,
            amount: calculation.netRefund,
            reason: request.reason,
            source: 'cancellation',
            bookingId: request.bookingId,
            adminId: request.adminId
          }, trx);

          await trx('refund_transactions')
            .where({ id: refundRecord.id })
            .update({
              status: 'completed',
              processedAt: new Date(),
              updatedAt: new Date()
            });
        }

        // Update booking status
        await trx('bookings')
          .where({ id: request.bookingId })
          .update({
            status: 'cancelled',
            cancelledAt: new Date(),
            updatedAt: new Date()
          });

        return refundRecord;
      });

      logger.info(`Refund processed: ${refundTransaction.id} for booking: ${request.bookingId}`);
      return refundTransaction;
    } catch (error) {
      logger.error('Error processing refund:', error);
      throw error;
    }
  }

  /**
   * Issue credit to parent wallet
   */
  static async issueCredit(
    creditRequest: {
      parentId: string;
      amount: number;
      reason: string;
      source: string;
      bookingId?: string;
      adminId?: string;
    },
    trx?: any
  ): Promise<string> {
    try {
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + this.CREDIT_EXPIRY_MONTHS);

      const creditData = {
        parentId: creditRequest.parentId,
        amount: creditRequest.amount,
        usedAmount: 0,
        expiryDate,
        source: creditRequest.source,
        status: 'active',
        description: creditRequest.reason,
        bookingId: creditRequest.bookingId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const query = trx || db;
      const [credit] = await query('wallet_credits')
        .insert(creditData)
        .returning('*');

      // Update parent's credit balance
      await query('users')
        .where({ id: creditRequest.parentId })
        .increment('creditBalance', creditRequest.amount);

      logger.info(`Credit issued: ${credit.id} for parent: ${creditRequest.parentId}, amount: ${creditRequest.amount}`);
      return credit.id;
    } catch (error) {
      logger.error('Error issuing credit:', error);
      throw error;
    }
  }

  /**
   * Admin override for refund processing
   */
  static async processAdminRefund(override: AdminRefundOverride): Promise<RefundTransaction> {
    try {
      const request: RefundRequest = {
        bookingId: override.bookingId,
        parentId: override.parentId,
        reason: override.overrideReason,
        adminOverride: true,
        adminId: override.adminId,
        refundMethod: override.refundMethod,
        amount: override.amount
      };

      // Override admin fee if specified
      if (override.adminFee !== undefined) {
        // This would be handled in the calculation override
      }

      return await this.processRefund(request);
    } catch (error) {
      logger.error('Error processing admin refund:', error);
      throw error;
    }
  }

  /**
   * Get refund transaction by ID
   */
  static async getRefundTransaction(id: string): Promise<RefundTransaction | null> {
    try {
      const refund = await db('refund_transactions')
        .where({ id })
        .first();

      return refund || null;
    } catch (error) {
      logger.error('Error getting refund transaction:', error);
      throw error;
    }
  }

  /**
   * Get refund transactions for a parent
   */
  static async getParentRefunds(
    parentId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ refunds: RefundTransaction[], total: number }> {
    try {
      const offset = (page - 1) * limit;

      const refunds = await db('refund_transactions')
        .where({ parentId })
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .offset(offset);

      const total = await db('refund_transactions')
        .where({ parentId })
        .count('* as count')
        .first();

      return {
        refunds,
        total: parseInt(total?.count as string) || 0
      };
    } catch (error) {
      logger.error('Error getting parent refunds:', error);
      throw error;
    }
  }

  /**
   * Calculate hours until activity starts
   */
  private static getHoursUntilActivity(activityStartDate: Date, cancellationDate: Date): number {
    const startTime = new Date(activityStartDate).getTime();
    const cancelTime = new Date(cancellationDate).getTime();
    return (startTime - cancelTime) / (1000 * 60 * 60); // Convert to hours
  }

  /**
   * Get refund policy configuration
   */
  static getRefundPolicyConfig(): RefundPolicyConfig {
    return {
      adminFeeAmount: this.ADMIN_FEE_AMOUNT,
      refundCutoffHours: this.REFUND_CUTOFF_HOURS,
      creditExpiryMonths: this.CREDIT_EXPIRY_MONTHS,
      proRataEnabled: true,
      platformFeeRefundable: true,
      franchiseFeeRefundable: true
    };
  }

  /**
   * Update refund transaction status
   */
  static async updateRefundStatus(
    refundId: string,
    status: 'pending' | 'processing' | 'completed' | 'failed',
    stripeRefundId?: string
  ): Promise<void> {
    try {
      await db('refund_transactions')
        .where({ id: refundId })
        .update({
          status,
          stripeRefundId,
          processedAt: status === 'completed' ? new Date() : undefined,
          updatedAt: new Date()
        });

      logger.info(`Refund status updated: ${refundId} to ${status}`);
    } catch (error) {
      logger.error('Error updating refund status:', error);
      throw error;
    }
  }
}
