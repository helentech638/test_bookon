import { logger } from '../utils/logger';
import { NotificationData } from '../types/refundCredit';
import { db } from '../utils/database';

export class RefundNotificationService {
  /**
   * Send refund processed notification to parent
   */
  static async sendRefundProcessedNotification(data: NotificationData): Promise<void> {
    try {
      const { parentId, bookingId, amount, method, reason, adminFee, netAmount } = data;

      // Get parent details
      const parent = await db('users')
        .where({ id: parentId })
        .first();

      if (!parent) {
        logger.error(`Parent not found for refund notification: ${parentId}`);
        return;
      }

      // Get booking details
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
        logger.error(`Booking not found for refund notification: ${bookingId}`);
        return;
      }

      const emailData = {
        to: parent.email,
        toName: `${parent.firstName} ${parent.lastName}`,
        subject: method === 'refund' 
          ? `Refund Processed - £${netAmount.toFixed(2)}` 
          : `Credit Added to Your Account - £${netAmount.toFixed(2)}`,
        template: method === 'refund' ? 'refund_processed' : 'credit_issued',
        data: {
          parentName: `${parent.firstName} ${parent.lastName}`,
          activityName: booking.activityName,
          activityDate: new Date(booking.activityStartDate).toLocaleDateString('en-GB'),
          activityTime: booking.activityStartTime,
          venueName: booking.venueName,
          originalAmount: amount,
          adminFee: adminFee || 0,
          netAmount: netAmount,
          refundMethod: method,
          reason: reason,
          refundDate: new Date().toLocaleDateString('en-GB'),
          creditExpiryDate: method === 'credit' 
            ? new Date(Date.now() + 12 * 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB')
            : null
        }
      };

      // Send email notification
      await this.sendEmailNotification(emailData);

      // Create in-app notification
      await this.createInAppNotification(parentId, {
        type: 'refund_processed',
        title: method === 'refund' 
          ? `Refund Processed - £${netAmount.toFixed(2)}` 
          : `Credit Added - £${netAmount.toFixed(2)}`,
        message: method === 'refund'
          ? `Your refund of £${netAmount.toFixed(2)} has been processed and will appear in your account within 3-5 business days.`
          : `£${netAmount.toFixed(2)} has been added to your account credit balance and can be used for future bookings.`,
        data: {
          bookingId,
          amount: netAmount,
          method,
          reason
        }
      });

      logger.info(`Refund notification sent to parent: ${parentId}`);
    } catch (error) {
      logger.error('Error sending refund notification:', error);
      throw error;
    }
  }

  /**
   * Send booking cancelled notification to provider/admin
   */
  static async sendBookingCancelledNotification(
    bookingId: string, 
    parentId: string, 
    reason: string,
    refundAmount: number,
    creditAmount: number
  ): Promise<void> {
    try {
      // Get booking details with venue info
      const booking = await db('bookings')
        .select(
          'bookings.*',
          'activities.name as activityName',
          'activities.startDate as activityStartDate',
          'activities.startTime as activityStartTime',
          'venues.name as venueName',
          'venues.ownerId as venueOwnerId',
          'children.firstName as childFirstName',
          'children.lastName as childLastName',
          'users.firstName as parentFirstName',
          'users.lastName as parentLastName',
          'users.email as parentEmail'
        )
        .join('activities', 'bookings.activityId', 'activities.id')
        .join('venues', 'activities.venueId', 'venues.id')
        .join('children', 'bookings.childId', 'children.id')
        .join('users', 'bookings.parentId', 'users.id')
        .where('bookings.id', bookingId)
        .first();

      if (!booking) {
        logger.error(`Booking not found for cancellation notification: ${bookingId}`);
        return;
      }

      // Get venue owner details
      const venueOwner = await db('users')
        .where({ id: booking.venueOwnerId })
        .first();

      if (!venueOwner) {
        logger.error(`Venue owner not found for cancellation notification: ${booking.venueOwnerId}`);
        return;
      }

      const emailData = {
        to: venueOwner.email,
        toName: `${venueOwner.firstName} ${venueOwner.lastName}`,
        subject: `Booking Cancelled - ${booking.activityName}`,
        template: 'booking_cancelled_provider',
        data: {
          venueOwnerName: `${venueOwner.firstName} ${venueOwner.lastName}`,
          venueName: booking.venueName,
          activityName: booking.activityName,
          activityDate: new Date(booking.activityStartDate).toLocaleDateString('en-GB'),
          activityTime: booking.activityStartTime,
          childName: `${booking.childFirstName} ${booking.childLastName}`,
          parentName: `${booking.parentFirstName} ${booking.parentLastName}`,
          parentEmail: booking.parentEmail,
          cancellationReason: reason,
          refundAmount: refundAmount,
          creditAmount: creditAmount,
          cancellationDate: new Date().toLocaleDateString('en-GB'),
          bookingId: bookingId
        }
      };

      // Send email notification to provider
      await this.sendEmailNotification(emailData);

      // Create in-app notification for venue owner
      await this.createInAppNotification(booking.venueOwnerId, {
        type: 'booking_cancelled',
        title: `Booking Cancelled - ${booking.activityName}`,
        message: `${booking.childFirstName} ${booking.childLastName}'s booking for ${booking.activityName} has been cancelled.`,
        data: {
          bookingId,
          childName: `${booking.childFirstName} ${booking.childLastName}`,
          parentName: `${booking.parentFirstName} ${booking.parentLastName}`,
          reason,
          refundAmount,
          creditAmount
        }
      });

      logger.info(`Booking cancellation notification sent to venue owner: ${booking.venueOwnerId}`);
    } catch (error) {
      logger.error('Error sending booking cancellation notification:', error);
      throw error;
    }
  }

  /**
   * Send credit expiry reminder notification
   */
  static async sendCreditExpiryReminder(parentId: string, creditId: string, daysUntilExpiry: number): Promise<void> {
    try {
      const parent = await db('users')
        .where({ id: parentId })
        .first();

      if (!parent) {
        logger.error(`Parent not found for credit expiry reminder: ${parentId}`);
        return;
      }

      const credit = await db('wallet_credits')
        .where({ id: creditId })
        .first();

      if (!credit) {
        logger.error(`Credit not found for expiry reminder: ${creditId}`);
        return;
      }

      const emailData = {
        to: parent.email,
        toName: `${parent.firstName} ${parent.lastName}`,
        subject: `Credit Expiring Soon - £${parseFloat(credit.amount).toFixed(2)}`,
        template: 'credit_expiry_reminder',
        data: {
          parentName: `${parent.firstName} ${parent.lastName}`,
          creditAmount: parseFloat(credit.amount),
          remainingAmount: parseFloat(credit.amount) - parseFloat(credit.usedAmount),
          expiryDate: new Date(credit.expiryDate).toLocaleDateString('en-GB'),
          daysUntilExpiry: daysUntilExpiry,
          creditSource: credit.source,
          creditDescription: credit.description
        }
      };

      // Send email notification
      await this.sendEmailNotification(emailData);

      // Create in-app notification
      await this.createInAppNotification(parentId, {
        type: 'credit_expiry',
        title: `Credit Expiring Soon - £${parseFloat(credit.amount).toFixed(2)}`,
        message: `You have £${(parseFloat(credit.amount) - parseFloat(credit.usedAmount)).toFixed(2)} in credits expiring in ${daysUntilExpiry} days.`,
        data: {
          creditId,
          amount: parseFloat(credit.amount),
          remainingAmount: parseFloat(credit.amount) - parseFloat(credit.usedAmount),
          expiryDate: credit.expiryDate,
          daysUntilExpiry
        }
      });

      logger.info(`Credit expiry reminder sent to parent: ${parentId}`);
    } catch (error) {
      logger.error('Error sending credit expiry reminder:', error);
      throw error;
    }
  }

  /**
   * Send email notification using existing email service
   */
  private static async sendEmailNotification(emailData: {
    to: string;
    toName: string;
    subject: string;
    template: string;
    data: Record<string, any>;
  }): Promise<void> {
    try {
      // Import email service
      const { emailService } = await import('./emailService');
      
      await emailService.sendTemplateEmail({
        to: emailData.to,
        toName: emailData.toName,
        template: emailData.template,
        subject: emailData.subject,
        data: emailData.data
      });

      logger.info(`Email notification sent to: ${emailData.to}`);
    } catch (error) {
      logger.error('Error sending email notification:', error);
      // Don't throw error to avoid breaking the main flow
    }
  }

  /**
   * Create in-app notification
   */
  private static async createInAppNotification(
    userId: string, 
    notification: {
      type: string;
      title: string;
      message: string;
      data?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      await db('notifications').insert({
        userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data ? JSON.stringify(notification.data) : null,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      logger.info(`In-app notification created for user: ${userId}`);
    } catch (error) {
      logger.error('Error creating in-app notification:', error);
      // Don't throw error to avoid breaking the main flow
    }
  }

  /**
   * Send admin override notification
   */
  static async sendAdminOverrideNotification(
    parentId: string,
    adminId: string,
    bookingId: string,
    overrideDetails: {
      originalAmount: number;
      overrideAmount: number;
      overrideReason: string;
      refundMethod: 'refund' | 'credit';
      adminFee?: number;
    }
  ): Promise<void> {
    try {
      const parent = await db('users')
        .where({ id: parentId })
        .first();

      const admin = await db('users')
        .where({ id: adminId })
        .first();

      if (!parent || !admin) {
        logger.error(`Parent or admin not found for override notification`);
        return;
      }

      const emailData = {
        to: parent.email,
        toName: `${parent.firstName} ${parent.lastName}`,
        subject: `Booking Refund Override - £${overrideDetails.overrideAmount.toFixed(2)}`,
        template: 'admin_override_notification',
        data: {
          parentName: `${parent.firstName} ${parent.lastName}`,
          adminName: `${admin.firstName} ${admin.lastName}`,
          originalAmount: overrideDetails.originalAmount,
          overrideAmount: overrideDetails.overrideAmount,
          overrideReason: overrideDetails.overrideReason,
          refundMethod: overrideDetails.refundMethod,
          adminFee: overrideDetails.adminFee || 0,
          overrideDate: new Date().toLocaleDateString('en-GB')
        }
      };

      // Send email notification
      await this.sendEmailNotification(emailData);

      // Create in-app notification
      await this.createInAppNotification(parentId, {
        type: 'admin_override',
        title: `Refund Override Applied - £${overrideDetails.overrideAmount.toFixed(2)}`,
        message: `An admin has applied a refund override for your booking. ${overrideDetails.overrideReason}`,
        data: {
          bookingId,
          adminId,
          overrideAmount: overrideDetails.overrideAmount,
          overrideReason: overrideDetails.overrideReason,
          refundMethod: overrideDetails.refundMethod
        }
      });

      logger.info(`Admin override notification sent to parent: ${parentId}`);
    } catch (error) {
      logger.error('Error sending admin override notification:', error);
      throw error;
    }
  }

  /**
   * Send bulk notification for expired credits
   */
  static async sendBulkExpiredCreditsNotification(): Promise<void> {
    try {
      // Get all parents with expired credits
      const expiredCredits = await db('wallet_credits')
        .select('parentId', 'amount', 'usedAmount', 'expiryDate', 'source')
        .where('status', 'active')
        .where('expiryDate', '<', new Date())
        .groupBy('parentId');

      for (const creditGroup of expiredCredits) {
        const parent = await db('users')
          .where({ id: creditGroup.parentId })
          .first();

        if (!parent) continue;

        const totalExpiredAmount = parseFloat(creditGroup.amount) - parseFloat(creditGroup.usedAmount);

        const emailData = {
          to: parent.email,
          toName: `${parent.firstName} ${parent.lastName}`,
          subject: `Credits Expired - £${totalExpiredAmount.toFixed(2)}`,
          template: 'credits_expired',
          data: {
            parentName: `${parent.firstName} ${parent.lastName}`,
            expiredAmount: totalExpiredAmount,
            expiryDate: new Date(creditGroup.expiryDate).toLocaleDateString('en-GB')
          }
        };

        await this.sendEmailNotification(emailData);
      }

      logger.info(`Bulk expired credits notifications sent`);
    } catch (error) {
      logger.error('Error sending bulk expired credits notification:', error);
      throw error;
    }
  }
}



