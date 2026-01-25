import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

export interface CancellationRequest {
  bookingId: string;
  parentId: string;
  reason: string;
  requestedAt: Date;
}

export interface CancellationResult {
  eligible: boolean;
  refundAmount: number;
  creditAmount: number;
  adminFee: number;
  method: 'cash' | 'credit' | 'mixed';
  reason: string;
  breakdown: {
    totalPaid: number;
    sessionsUsed: number;
    sessionsRemaining: number;
    valuePerSession: number;
    refundableAmount: number;
    creditAmount: number;
    adminFee: number;
  };
}

export interface ProRataCalculation {
  totalPaid: number;
  sessionsUsed: number;
  sessionsRemaining: number;
  valuePerSession: number;
  refundableAmount: number;
  creditAmount: number;
  adminFee: number;
  breakdown: {
    cashRefund: number;
    creditRefund: number;
    fees: number;
  };
}

class CancellationService {
  private readonly ADMIN_FEE = 2.00; // £2 admin fee per cancellation (exactly as per client requirements)
  private readonly REFUND_CUTOFF_HOURS = 24; // 24-hour cutoff for refunds vs credits
  private readonly CREDIT_EXPIRY_MONTHS = 12; // Credits expire after 12 months

  /**
   * Calculate pro-rata refund for a booking (enhanced for multi-session courses)
   */
  async calculateProRataRefund(bookingId: string, cancellationDate: Date): Promise<ProRataCalculation> {
    try {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
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

      if (!booking) {
        throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
      }

      const totalPaid = Number(booking.amount);
      const activityDate = new Date(booking.activityDate);
      const activityTime = booking.activityTime;
      
      // Calculate session details
      const sessionDateTime = new Date(`${activityDate.toISOString().split('T')[0]}T${activityTime}`);
      const hoursUntilSession = (sessionDateTime.getTime() - cancellationDate.getTime()) / (1000 * 60 * 60);
      
      // Enhanced calculation for multi-session courses
      // Check if this is a course booking (multiple sessions)
      const isCourseBooking = booking.activity.duration && booking.activity.duration > 1;
      
      let sessionsUsed = 0;
      let sessionsRemaining = 0;
      let valuePerSession = totalPaid;

      if (isCourseBooking) {
        // For course bookings, calculate based on course duration
        const totalSessions = booking.activity.duration || 1;
        const sessionDuration = booking.activity.sessionDuration || 60; // minutes
        
        // Calculate how many sessions have passed
        const now = new Date();
        const courseStartDate = new Date(booking.activity.startDate);
        const courseEndDate = new Date(booking.activity.endDate);
        
        if (now < courseStartDate) {
          // Course hasn't started yet
          sessionsUsed = 0;
          sessionsRemaining = totalSessions;
        } else if (now > courseEndDate) {
          // Course has finished
          sessionsUsed = totalSessions;
          sessionsRemaining = 0;
        } else {
          // Course is in progress - calculate sessions based on time elapsed
          const totalCourseDuration = courseEndDate.getTime() - courseStartDate.getTime();
          const elapsedTime = now.getTime() - courseStartDate.getTime();
          sessionsUsed = Math.floor((elapsedTime / totalCourseDuration) * totalSessions);
          sessionsRemaining = totalSessions - sessionsUsed;
        }
        
        valuePerSession = totalPaid / totalSessions;
      } else {
        // Single session booking
        sessionsUsed = hoursUntilSession < 0 ? 1 : 0;
        sessionsRemaining = 1 - sessionsUsed;
        valuePerSession = totalPaid;
      }

      // Calculate refundable amounts
      const refundableAmount = sessionsRemaining * valuePerSession;
      
      // For pro-rata calculations (courses after start), no admin fee on credits
      const creditAmount = refundableAmount; // Full amount as credit, no admin fee
      const cashRefund = 0; // Credits only for pro-rata
      const creditRefund = creditAmount;

      return {
        totalPaid,
        sessionsUsed,
        sessionsRemaining,
        valuePerSession,
        refundableAmount,
        creditAmount: creditRefund,
        adminFee: 0, // No admin fee on credits (per client requirements)
        breakdown: {
          cashRefund,
          creditRefund,
          fees: 0 // No admin fee on credits
        }
      };
    } catch (error) {
      logger.error('Error calculating pro-rata refund:', error);
      throw error;
    }
  }

  /**
   * Determine cancellation eligibility and method based on EXACT client requirements:
   * 1) Refunds: Charge £2 admin fee, available if cancelled ≥24 hours before
   * 2) Credits: No admin fee, issued when cancelled <24 hours
   * 3) Pro-rata for courses after start date
   * 4) Only one £2 admin fee per refund action
   */
  async determineCancellationEligibility(bookingId: string, cancellationDate: Date): Promise<CancellationResult> {
    try {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          activity: true,
          parent: true
        }
      });

      if (!booking) {
        throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
      }

      const activityDate = new Date(booking.activityDate);
      const activityTime = booking.activityTime;
      const sessionDateTime = new Date(`${activityDate.toISOString().split('T')[0]}T${activityTime}`);
      const hoursUntilSession = (sessionDateTime.getTime() - cancellationDate.getTime()) / (1000 * 60 * 60);

      // Check if session has already started
      const isPastSession = hoursUntilSession < 0;
      const isWithin24Hours = hoursUntilSession < this.REFUND_CUTOFF_HOURS && hoursUntilSession >= 0;
      const isMoreThan24Hours = hoursUntilSession >= this.REFUND_CUTOFF_HOURS;

      if (isPastSession) {
        // Session has started - check if it's a course for pro-rata calculation
        const isCourse = booking.activity.duration && booking.activity.duration > 1;
        if (isCourse) {
          // Pro-rata refund for unused sessions
          const calculation = await this.calculateProRataRefund(bookingId, cancellationDate);
          return {
            eligible: true,
            refundAmount: 0, // Credits only after session starts
            creditAmount: calculation.creditAmount,
            adminFee: 0, // No admin fee for credits
            method: 'credit',
            reason: 'Course cancellation after start - pro-rata credit for unused sessions',
            breakdown: calculation.breakdown
          };
        } else {
          return {
            eligible: false,
            refundAmount: 0,
            creditAmount: 0,
            adminFee: 0,
            method: 'credit',
            reason: 'Session has already occurred - no refund available',
            breakdown: {
              totalPaid: Number(booking.amount),
              sessionsUsed: 1,
              sessionsRemaining: 0,
              valuePerSession: Number(booking.amount),
              refundableAmount: 0,
              creditAmount: 0,
              adminFee: 0
            }
          };
        }
      }

      // Apply EXACT client policy rules
      if (isMoreThan24Hours) {
        // ≥24 hours before: REFUND with £2 admin fee
        const totalAmount = Number(booking.amount);
        const refundAmount = Math.max(0, totalAmount - this.ADMIN_FEE);
        
        return {
          eligible: true,
          refundAmount: refundAmount,
          creditAmount: 0,
          adminFee: this.ADMIN_FEE,
          method: 'cash',
          reason: 'Cancelled ≥24 hours before session - refund minus £2 admin fee',
          breakdown: {
            totalPaid: totalAmount,
            sessionsUsed: 0,
            sessionsRemaining: 1,
            valuePerSession: totalAmount,
            refundableAmount: refundAmount,
            creditAmount: 0,
            adminFee: this.ADMIN_FEE
          }
        };
      } else if (isWithin24Hours) {
        // <24 hours: CREDIT with no admin fee
        const totalAmount = Number(booking.amount);
        
        return {
          eligible: true,
          refundAmount: 0,
          creditAmount: totalAmount, // Full amount as credit, no admin fee
          adminFee: 0, // No admin fee on credits
          method: 'credit',
          reason: 'Cancelled <24 hours before session - full credit (no admin fee)',
          breakdown: {
            totalPaid: totalAmount,
            sessionsUsed: 0,
            sessionsRemaining: 1,
            valuePerSession: totalAmount,
            refundableAmount: 0,
            creditAmount: totalAmount,
            adminFee: 0
          }
        };
      }

      // Fallback (should not reach here)
      return {
        eligible: false,
        refundAmount: 0,
        creditAmount: 0,
        adminFee: 0,
        method: 'credit',
        reason: 'Unable to determine cancellation eligibility',
        breakdown: {
          totalPaid: Number(booking.amount),
          sessionsUsed: 0,
          sessionsRemaining: 1,
          valuePerSession: Number(booking.amount),
          refundableAmount: 0,
          creditAmount: 0,
          adminFee: 0
        }
      };
    } catch (error) {
      logger.error('Error determining cancellation eligibility:', error);
      throw error;
    }
  }

  /**
   * Process cancellation request
   */
  async processCancellation(
    bookingId: string, 
    parentId: string, 
    reason: string, 
    adminId?: string
  ): Promise<{ refundTransactionId?: string; creditId?: string }> {
    try {
      const cancellationDate = new Date();
      const eligibility = await this.determineCancellationEligibility(bookingId, cancellationDate);

      if (!eligibility.eligible) {
        throw new AppError(eligibility.reason, 400, 'CANCELLATION_NOT_ELIGIBLE');
      }

      // Update booking status
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: 'cancelled',
          notes: `Cancelled: ${reason}`,
          updatedAt: new Date()
        }
      });

      let refundTransactionId: string | undefined;
      let creditId: string | undefined;

      // Process refund if applicable
      if (eligibility.refundAmount > 0) {
        const refundTransaction = await prisma.refundTransaction.create({
          data: {
            bookingId,
            amount: eligibility.refundAmount,
            method: 'card',
            fee: eligibility.adminFee,
            reason: 'cancellation',
            status: 'pending',
            adminId: adminId || null,
            auditTrail: {
              requestedBy: parentId,
              requestedAt: cancellationDate,
              reason,
              calculation: eligibility.breakdown
            }
          }
        });
        refundTransactionId = refundTransaction.id;
      }

      // Process credit if applicable
      if (eligibility.creditAmount > 0) {
        const credit = await prisma.walletCredit.create({
          data: {
            parentId,
            providerId: null, // Will be set based on venue
            bookingId,
            amount: eligibility.creditAmount,
            expiryDate: new Date(Date.now() + this.CREDIT_EXPIRY_MONTHS * 30 * 24 * 60 * 60 * 1000), // 12 months from now
            source: 'cancellation',
            status: 'active',
            description: `Credit from cancellation of booking ${bookingId}`
          }
        });
        creditId = credit.id;
      }

      logger.info('Cancellation processed successfully', {
        bookingId,
        parentId,
        refundAmount: eligibility.refundAmount,
        creditAmount: eligibility.creditAmount,
        adminFee: eligibility.adminFee,
        refundTransactionId,
        creditId
      });

      return { refundTransactionId, creditId };
    } catch (error) {
      logger.error('Error processing cancellation:', error);
      throw error;
    }
  }

  /**
   * Process provider cancellation (no admin fee)
   */
  async processProviderCancellation(
    bookingId: string,
    adminId: string,
    reason: string,
    refundMethod: 'cash' | 'credit' | 'parent_choice' = 'parent_choice'
  ): Promise<{ refundTransactionId?: string; creditId?: string }> {
    try {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { activity: true }
      });

      if (!booking) {
        throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
      }

      const totalAmount = Number(booking.amount);
      const cancellationDate = new Date();

      // Update booking status
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: 'cancelled',
          notes: `Provider cancelled: ${reason}`,
          updatedAt: cancellationDate
        }
      });

      let refundTransactionId: string | undefined;
      let creditId: string | undefined;

      // Provider cancellations have no admin fee
      if (refundMethod === 'cash' || refundMethod === 'parent_choice') {
        const refundTransaction = await prisma.refundTransaction.create({
          data: {
            bookingId,
            amount: totalAmount,
            method: 'card',
            fee: 0, // No admin fee for provider cancellations
            reason: 'provider_cancelled',
            status: 'pending',
            adminId,
            auditTrail: {
              cancelledBy: adminId,
              cancelledAt: cancellationDate,
              reason,
              fullRefund: true
            }
          }
        });
        refundTransactionId = refundTransaction.id;
      }

      if (refundMethod === 'credit' || refundMethod === 'parent_choice') {
        const credit = await prisma.walletCredit.create({
          data: {
            parentId: booking.parentId,
            providerId: booking.activity.venueId,
            bookingId,
            amount: totalAmount,
            expiryDate: new Date(Date.now() + this.CREDIT_EXPIRY_MONTHS * 30 * 24 * 60 * 60 * 1000),
            source: 'provider_cancellation',
            status: 'active',
            description: `Full credit from provider cancellation of booking ${bookingId}`
          }
        });
        creditId = credit.id;
      }

      logger.info('Provider cancellation processed successfully', {
        bookingId,
        adminId,
        refundAmount: refundMethod === 'cash' ? totalAmount : 0,
        creditAmount: refundMethod === 'credit' ? totalAmount : 0,
        refundTransactionId,
        creditId
      });

      // Remove attendance records from registers
      try {
        const { RealTimeRegisterService } = await import('./realTimeRegisterService');
        await RealTimeRegisterService.removeAttendanceForCancelledBooking(bookingId);
        logger.info(`Removed attendance records for provider-cancelled booking ${bookingId}`);
      } catch (attendanceError) {
        logger.error('Failed to remove attendance records:', attendanceError);
        // Don't fail the cancellation if attendance removal fails
      }

      return { refundTransactionId, creditId };
    } catch (error) {
      logger.error('Error processing provider cancellation:', error);
      throw error;
    }
  }

  /**
   * Get cancellation history for a booking
   */
  async getCancellationHistory(bookingId: string): Promise<any[]> {
    try {
      const refunds = await prisma.refundTransaction.findMany({
        where: { bookingId },
        include: {
          booking: {
            include: {
              activity: true,
              child: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return refunds.map(refund => ({
        id: refund.id,
        amount: refund.amount,
        method: refund.method,
        fee: refund.fee,
        reason: refund.reason,
        status: refund.status,
        processedAt: refund.processedAt,
        createdAt: refund.createdAt,
        auditTrail: refund.auditTrail
      }));
    } catch (error) {
      logger.error('Error getting cancellation history:', error);
      throw error;
    }
  }

  /**
   * Get cancellation statistics for admin dashboard
   */
  async getCancellationStats(venueId?: string): Promise<{
    totalCancellations: number;
    totalRefunds: number;
    totalCredits: number;
    totalFees: number;
    cancellationsByReason: Record<string, number>;
    cancellationsByMethod: Record<string, number>;
  }> {
    try {
      const whereClause: any = {};
      if (venueId) {
        whereClause.booking = {
          activity: {
            venueId: venueId
          }
        };
      }

      const refunds = await prisma.refundTransaction.findMany({
        where: whereClause,
        include: {
          booking: {
            include: {
              activity: true
            }
          }
        }
      });

      const stats = {
        totalCancellations: refunds.length,
        totalRefunds: refunds.reduce((sum, r) => sum + Number(r.amount), 0),
        totalCredits: 0, // Would need to query wallet credits separately
        totalFees: refunds.reduce((sum, r) => sum + Number(r.fee), 0),
        cancellationsByReason: {} as Record<string, number>,
        cancellationsByMethod: {} as Record<string, number>
      };

      refunds.forEach(refund => {
        // Count by reason
        stats.cancellationsByReason[refund.reason] = 
          (stats.cancellationsByReason[refund.reason] || 0) + 1;
        
        // Count by method
        stats.cancellationsByMethod[refund.method] = 
          (stats.cancellationsByMethod[refund.method] || 0) + 1;
      });

      return stats;
    } catch (error) {
      logger.error('Error getting cancellation stats:', error);
      throw error;
    }
  }
}

export const cancellationService = new CancellationService();
