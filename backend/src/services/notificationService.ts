import { prisma, safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';

export interface NotificationData {
  userId: string;
  venueId?: string | undefined;
  type: 'booking_confirmation' | 'payment_success' | 'payment_failed' | 'booking_cancelled' | 'activity_reminder' | 'system_alert';
  title: string;
  message: string;
  data?: any;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  channels?: ('email' | 'sms' | 'push' | 'in_app')[];
}

export class NotificationService {
  // Send notification to all admin users
  static async notifyAdmins(notificationData: Omit<NotificationData, 'userId'>) {
    try {
      // Get all admin users
      const adminUsers = await prisma.user.findMany({
        where: { role: 'admin' },
        select: { id: true }
      });

      if (adminUsers.length === 0) {
        logger.info('No admin users found to notify');
        return;
      }

      // Create notifications for each admin
      const notifications = await Promise.all(
        adminUsers.map(admin => 
          this.createNotification({
            ...notificationData,
            userId: admin.id
          })
        )
      );

      logger.info(`Sent admin notifications to ${adminUsers.length} admin users`, {
        notificationType: notificationData.type,
        adminCount: adminUsers.length
      });

      return notifications;
    } catch (error) {
      logger.error('Error sending admin notifications:', error);
      throw error;
    }
  }

  // Create a new notification
  static async createNotification(notificationData: NotificationData) {
    try {
      const notification = await prisma.notification.create({
        data: {
          type: notificationData.type,
          title: notificationData.title,
          message: notificationData.message,
          data: notificationData.data || {},
          priority: notificationData.priority || 'medium',
          channels: notificationData.channels || ['in_app'],
          userId: notificationData.userId || '',
          venueId: notificationData.venueId || null,
          status: 'pending'
        }
      });
      
      // Process notification through different channels
      await this.processNotification({ id: notification.id, ...notificationData });

      logger.info('Notification created successfully', { notificationId: notification.id });
      return { id: notification.id, ...notificationData };
    } catch (error) {
      logger.error('Error creating notification:', error);
      throw error;
    }
  }

  // Process notification through configured channels
  static async processNotification(notification: any) {
    try {
      const channels = notification.channels || ['in_app'];
      
      for (const channel of channels) {
        switch (channel) {
          case 'email':
            await this.sendEmailNotification(notification);
            break;
          case 'sms':
            await this.sendSMSNotification(notification);
            break;
          case 'push':
            await this.sendPushNotification(notification);
            break;
          case 'in_app':
            await this.sendInAppNotification(notification);
            break;
        }
      }

      // Update notification status
      await prisma.$executeRaw`
        UPDATE notifications 
        SET status = 'sent', "sentAt" = NOW()
        WHERE id = ${notification.id}
      `;

    } catch (error) {
      logger.error('Error processing notification:', error);
      
      // Update notification status to failed
      await prisma.$executeRaw`
        UPDATE notifications 
        SET status = 'failed', error = ${error instanceof Error ? error.message : 'Unknown error'}
        WHERE id = ${notification.id}
      `;
      
      throw error;
    }
  }

  // Send email notification
  static async sendEmailNotification(notification: any) {
    try {
      // TODO: Implement email service integration (SendGrid, AWS SES, etc.)
      logger.info('Sending email notification', { 
        notificationId: notification.id,
        userId: notification.userId,
        type: notification.type 
      });
      
      // Simulate email sending
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      logger.error('Error sending email notification:', error);
      throw error;
    }
  }

  // Send SMS notification
  static async sendSMSNotification(notification: any) {
    try {
      // TODO: Implement SMS service integration (Twilio, AWS SNS, etc.)
      logger.info('Sending SMS notification', { 
        notificationId: notification.id,
        userId: notification.userId,
        type: notification.type 
      });
      
      // Simulate SMS sending
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      logger.error('Error sending SMS notification:', error);
      throw error;
    }
  }

  // Send push notification
  static async sendPushNotification(notification: any) {
    try {
      // TODO: Implement push notification service (Firebase, OneSignal, etc.)
      logger.info('Sending push notification', { 
        notificationId: notification.id,
        userId: notification.userId,
        type: notification.type 
      });
      
      // Simulate push notification sending
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      logger.error('Error sending push notification:', error);
      throw error;
    }
  }

  // Send in-app notification
  static async sendInAppNotification(notification: any) {
    try {
      // In-app notifications are stored in the database and retrieved by the frontend
      logger.info('Storing in-app notification', { 
        notificationId: notification.id,
        userId: notification.userId,
        type: notification.type 
      });
      
    } catch (error) {
      logger.error('Error storing in-app notification:', error);
      throw error;
    }
  }

  // Get notifications for a user
  static async getUserNotifications(userId: string, limit: number = 20, offset: number = 0) {
    try {
      const notifications = await safePrismaQuery(async (client) => {
        return await client.notification.findMany({
          where: {
            userId: userId
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: limit,
          skip: offset
        });
      });

      return notifications;
    } catch (error) {
      logger.error('Error fetching user notifications:', error);
      throw error;
    }
  }

  // Mark notification as read
  static async markAsRead(notificationId: string) {
    try {
      await prisma.notification.update({
        where: {
          id: notificationId
        },
        data: {
          read: true,
          readAt: new Date()
        }
      });

      logger.info('Notification marked as read', { notificationId });
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      throw error;
    }
  }

  // Get notification statistics
  static async getNotificationStats(venueId?: string) {
    try {
      const whereClause = venueId ? `WHERE "venueId" = '${venueId}'` : '';
      
      const [total, unread, byType, byStatus] = await Promise.all([
        prisma.$queryRaw`SELECT COUNT(*) as count FROM notifications ${whereClause}` as any,
        prisma.$queryRaw`SELECT COUNT(*) as count FROM notifications ${whereClause} AND read = false` as any,
        prisma.$queryRaw`SELECT type, COUNT(*) as count FROM notifications ${whereClause} GROUP BY type` as any,
        prisma.$queryRaw`SELECT status, COUNT(*) as count FROM notifications ${whereClause} GROUP BY status` as any,
      ]);

      return {
        total: total[0]?.count || 0,
        unread: unread[0]?.count || 0,
        byType: byType,
        byStatus: byStatus,
      };
    } catch (error) {
      logger.error('Error fetching notification statistics:', error);
      throw error;
    }
  }

  // Send booking confirmation notification
  static async sendBookingConfirmation(bookingId: string) {
    try {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          parent: true,
          activity: {
            include: {
              venue: true,
            },
          },
        },
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      await this.createNotification({
        userId: booking.parentId,
        venueId: booking.activity.venueId,
        type: 'booking_confirmation',
        title: 'Booking Confirmed!',
        message: `Your booking for ${booking.activity.title} on ${booking.activityDate} has been confirmed.`,
        data: {
          bookingId: booking.id,
          activityName: booking.activity.title,
          venueName: booking.activity.venue.name,
          date: booking.activityDate,
          time: booking.activityTime,
        },
        priority: 'medium',
        channels: ['email', 'in_app'],
      });

    } catch (error) {
      logger.error('Error sending booking confirmation:', error);
      throw error;
    }
  }

  // Send payment success notification
  static async sendPaymentSuccess(bookingId: string) {
    try {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          parent: true,
          activity: {
            include: {
              venue: true,
            },
          },
        },
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      await this.createNotification({
        userId: booking.parentId,
        venueId: booking.activity.venueId,
        type: 'payment_success',
        title: 'Payment Successful!',
        message: `Your payment for ${booking.activity.title} has been processed successfully.`,
        data: {
          bookingId: booking.id,
          amount: booking.totalAmount,
          activityName: booking.activity.title,
        },
        priority: 'medium',
        channels: ['email', 'in_app'],
      });

    } catch (error) {
      logger.error('Error sending payment success notification:', error);
      throw error;
    }
  }

  // Send payment failed notification
  static async sendPaymentFailed(bookingId: string) {
    try {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          parent: true,
          activity: {
            include: {
              venue: true,
            },
          },
        },
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      await this.createNotification({
        userId: booking.parentId,
        venueId: booking.activity.venueId,
        type: 'payment_failed',
        title: 'Payment Failed',
        message: `Your payment for ${booking.activity.title} could not be processed. Please try again.`,
        data: {
          bookingId: booking.id,
          amount: booking.totalAmount,
          activityName: booking.activity.title,
        },
        priority: 'high',
        channels: ['email', 'sms', 'in_app'],
      });

    } catch (error) {
      logger.error('Error sending payment failed notification:', error);
      throw error;
    }
  }
}

export default NotificationService;
