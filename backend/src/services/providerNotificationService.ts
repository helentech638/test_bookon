import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';
import { db } from '../utils/database';

export interface ProviderNotificationData {
  providerId: string;
  venueId?: string;
  bookingId: string;
  parentId: string;
  childId: string;
  activityId: string;
  amount: number;
  bookingDate: Date;
  bookingTime: string;
  activityName: string;
  childName: string;
  parentName: string;
  parentEmail: string;
  venueName?: string;
  notificationType: 'new_booking' | 'booking_cancelled' | 'booking_modified' | 'payment_received';
}

export class ProviderNotificationService {
  /**
   * Send new booking notification to provider
   */
  static async sendNewBookingNotification(data: ProviderNotificationData): Promise<void> {
    try {
      // Get provider details
      const provider = await prisma.user.findUnique({
        where: { id: data.providerId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          businessName: true
        }
      });

      if (!provider) {
        logger.error(`Provider not found for new booking notification: ${data.providerId}`);
        return;
      }

      // Get venue details if available
      let venueName = data.venueName;
      if (!venueName && data.venueId) {
        const venue = await prisma.venue.findUnique({
          where: { id: data.venueId },
          select: { name: true }
        });
        venueName = venue?.name || 'Unknown Venue';
      }

      // Send email notification
      await this.sendProviderEmail({
        to: provider.email,
        toName: `${provider.firstName} ${provider.lastName}`,
        subject: `New Booking Received - ${data.activityName}`,
        template: 'provider_new_booking',
        data: {
          providerName: `${provider.firstName} ${provider.lastName}`,
          businessName: provider.businessName || 'Your Business',
          activityName: data.activityName,
          childName: data.childName,
          parentName: data.parentName,
          parentEmail: data.parentEmail,
          bookingDate: data.bookingDate.toLocaleDateString('en-GB'),
          bookingTime: data.bookingTime,
          venueName: venueName || 'Your Venue',
          amount: data.amount,
          bookingId: data.bookingId,
          bookingReference: data.bookingId.substring(0, 8).toUpperCase()
        }
      });

      // Create in-app notification
      await this.createProviderNotification(data.providerId, {
        type: 'new_booking',
        title: `New Booking - ${data.activityName}`,
        message: `${data.parentName} booked ${data.childName} for ${data.activityName}`,
        data: {
          bookingId: data.bookingId,
          childName: data.childName,
          parentName: data.parentName,
          activityName: data.activityName,
          amount: data.amount,
          bookingDate: data.bookingDate,
          bookingTime: data.bookingTime
        }
      });

      logger.info(`New booking notification sent to provider: ${data.providerId}`);
    } catch (error) {
      logger.error('Error sending new booking notification to provider:', error);
      throw error;
    }
  }

  /**
   * Send booking cancellation notification to provider
   */
  static async sendBookingCancellationNotification(
    providerId: string,
    bookingId: string,
    cancellationData: {
      childName: string;
      parentName: string;
      activityName: string;
      cancellationReason: string;
      refundAmount?: number;
      creditAmount?: number;
      venueName?: string;
    }
  ): Promise<void> {
    try {
      const provider = await prisma.user.findUnique({
        where: { id: providerId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          businessName: true
        }
      });

      if (!provider) {
        logger.error(`Provider not found for cancellation notification: ${providerId}`);
        return;
      }

      // Send email notification
      await this.sendProviderEmail({
        to: provider.email,
        toName: `${provider.firstName} ${provider.lastName}`,
        subject: `Booking Cancelled - ${cancellationData.activityName}`,
        template: 'provider_booking_cancelled',
        data: {
          providerName: `${provider.firstName} ${provider.lastName}`,
          businessName: provider.businessName || 'Your Business',
          activityName: cancellationData.activityName,
          childName: cancellationData.childName,
          parentName: cancellationData.parentName,
          cancellationReason: cancellationData.cancellationReason,
          venueName: cancellationData.venueName || 'Your Venue',
          refundAmount: cancellationData.refundAmount || 0,
          creditAmount: cancellationData.creditAmount || 0,
          bookingId: bookingId,
          cancellationDate: new Date().toLocaleDateString('en-GB')
        }
      });

      // Create in-app notification
      await this.createProviderNotification(providerId, {
        type: 'booking_cancelled',
        title: `Booking Cancelled - ${cancellationData.activityName}`,
        message: `${cancellationData.parentName} cancelled ${cancellationData.childName}'s booking for ${cancellationData.activityName}`,
        data: {
          bookingId: bookingId,
          childName: cancellationData.childName,
          parentName: cancellationData.parentName,
          activityName: cancellationData.activityName,
          cancellationReason: cancellationData.cancellationReason,
          refundAmount: cancellationData.refundAmount,
          creditAmount: cancellationData.creditAmount
        }
      });

      logger.info(`Booking cancellation notification sent to provider: ${providerId}`);
    } catch (error) {
      logger.error('Error sending booking cancellation notification to provider:', error);
      throw error;
    }
  }

  /**
   * Send payment received notification to provider
   */
  static async sendPaymentReceivedNotification(
    providerId: string,
    paymentData: {
      bookingId: string;
      amount: number;
      paymentMethod: string;
      childName: string;
      parentName: string;
      activityName: string;
      venueName?: string;
    }
  ): Promise<void> {
    try {
      const provider = await prisma.user.findUnique({
        where: { id: providerId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          businessName: true
        }
      });

      if (!provider) {
        logger.error(`Provider not found for payment notification: ${providerId}`);
        return;
      }

      // Send email notification
      await this.sendProviderEmail({
        to: provider.email,
        toName: `${provider.firstName} ${provider.lastName}`,
        subject: `Payment Received - £${paymentData.amount.toFixed(2)}`,
        template: 'provider_payment_received',
        data: {
          providerName: `${provider.firstName} ${provider.lastName}`,
          businessName: provider.businessName || 'Your Business',
          activityName: paymentData.activityName,
          childName: paymentData.childName,
          parentName: paymentData.parentName,
          amount: paymentData.amount,
          paymentMethod: paymentData.paymentMethod,
          venueName: paymentData.venueName || 'Your Venue',
          bookingId: paymentData.bookingId,
          paymentDate: new Date().toLocaleDateString('en-GB')
        }
      });

      // Create in-app notification
      await this.createProviderNotification(providerId, {
        type: 'payment_received',
        title: `Payment Received - £${paymentData.amount.toFixed(2)}`,
        message: `Payment of £${paymentData.amount.toFixed(2)} received for ${paymentData.childName}'s booking`,
        data: {
          bookingId: paymentData.bookingId,
          amount: paymentData.amount,
          paymentMethod: paymentData.paymentMethod,
          childName: paymentData.childName,
          parentName: paymentData.parentName,
          activityName: paymentData.activityName
        }
      });

      logger.info(`Payment received notification sent to provider: ${providerId}`);
    } catch (error) {
      logger.error('Error sending payment received notification to provider:', error);
      throw error;
    }
  }

  /**
   * Send booking modification notification to provider
   */
  static async sendBookingModificationNotification(
    providerId: string,
    bookingId: string,
    modificationData: {
      childName: string;
      parentName: string;
      activityName: string;
      changes: string[];
      venueName?: string;
    }
  ): Promise<void> {
    try {
      const provider = await prisma.user.findUnique({
        where: { id: providerId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          businessName: true
        }
      });

      if (!provider) {
        logger.error(`Provider not found for modification notification: ${providerId}`);
        return;
      }

      // Send email notification
      await this.sendProviderEmail({
        to: provider.email,
        toName: `${provider.firstName} ${provider.lastName}`,
        subject: `Booking Modified - ${modificationData.activityName}`,
        template: 'provider_booking_modified',
        data: {
          providerName: `${provider.firstName} ${provider.lastName}`,
          businessName: provider.businessName || 'Your Business',
          activityName: modificationData.activityName,
          childName: modificationData.childName,
          parentName: modificationData.parentName,
          changes: modificationData.changes.join(', '),
          venueName: modificationData.venueName || 'Your Venue',
          bookingId: bookingId,
          modificationDate: new Date().toLocaleDateString('en-GB')
        }
      });

      // Create in-app notification
      await this.createProviderNotification(providerId, {
        type: 'booking_modified',
        title: `Booking Modified - ${modificationData.activityName}`,
        message: `${modificationData.parentName} modified ${modificationData.childName}'s booking`,
        data: {
          bookingId: bookingId,
          childName: modificationData.childName,
          parentName: modificationData.parentName,
          activityName: modificationData.activityName,
          changes: modificationData.changes
        }
      });

      logger.info(`Booking modification notification sent to provider: ${providerId}`);
    } catch (error) {
      logger.error('Error sending booking modification notification to provider:', error);
      throw error;
    }
  }

  /**
   * Send email notification to provider
   */
  private static async sendProviderEmail(emailData: {
    to: string;
    toName: string;
    subject: string;
    template: string;
    data: Record<string, any>;
  }): Promise<void> {
    try {
      // Import email service
      const { emailService } = await import('./emailService');
      
      await emailService.sendEmail({
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text
      });

      logger.info(`Provider email notification sent to: ${emailData.to}`);
    } catch (error) {
      logger.error('Error sending provider email notification:', error);
      // Don't throw error to avoid breaking the main flow
    }
  }

  /**
   * Create in-app notification for provider
   */
  private static async createProviderNotification(
    providerId: string, 
    notification: {
      type: string;
      title: string;
      message: string;
      data?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      await db('notifications').insert({
        userId: providerId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data ? JSON.stringify(notification.data) : null,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      logger.info(`Provider in-app notification created for user: ${providerId}`);
    } catch (error) {
      logger.error('Error creating provider in-app notification:', error);
      // Don't throw error to avoid breaking the main flow
    }
  }

  /**
   * Get provider notification preferences
   */
  static async getProviderNotificationPreferences(providerId: string): Promise<{
    emailNotifications: boolean;
    inAppNotifications: boolean;
    smsNotifications: boolean;
    notificationTypes: string[];
  }> {
    try {
      const preferences = await prisma.user.findUnique({
        where: { id: providerId },
        select: {
          notificationPreferences: true
        }
      });

      // Default preferences if none set
      const defaultPreferences = {
        emailNotifications: true,
        inAppNotifications: true,
        smsNotifications: false,
        notificationTypes: ['new_booking', 'booking_cancelled', 'payment_received', 'booking_modified']
      };

      if (!preferences?.notificationPreferences) {
        return defaultPreferences;
      }

      return {
        ...defaultPreferences,
        ...preferences.notificationPreferences as any
      };
    } catch (error) {
      logger.error('Error getting provider notification preferences:', error);
      return {
        emailNotifications: true,
        inAppNotifications: true,
        smsNotifications: false,
        notificationTypes: ['new_booking', 'booking_cancelled', 'payment_received', 'booking_modified']
      };
    }
  }

  /**
   * Update provider notification preferences
   */
  static async updateProviderNotificationPreferences(
    providerId: string,
    preferences: {
      emailNotifications?: boolean;
      inAppNotifications?: boolean;
      smsNotifications?: boolean;
      notificationTypes?: string[];
    }
  ): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: providerId },
        data: {
          notificationPreferences: preferences
        }
      });

      logger.info(`Provider notification preferences updated for: ${providerId}`);
    } catch (error) {
      logger.error('Error updating provider notification preferences:', error);
      throw error;
    }
  }
}
