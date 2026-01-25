import { prisma, safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';

export interface NotificationConfig {
  userId: string;
  role: 'parent' | 'admin' | 'coach' | 'business';
  channels: {
    in_app: boolean;
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  eventTypes: {
    booking_created: boolean;
    booking_updated: boolean;
    booking_cancelled: boolean;
    booking_transferred: boolean;
    payment_success: boolean;
    payment_failed: boolean;
    activity_reminder: boolean;
    system_alert: boolean;
  };
  preferences: {
    quietHours: {
      enabled: boolean;
      start: string; // HH:MM format
      end: string;   // HH:MM format
    };
    frequency: 'immediate' | 'daily_digest' | 'weekly_digest';
    language: string;
  };
}

export interface NotificationRequest {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  channels?: string[];
  venueId?: string;
}

export class ConfigurableNotificationService {
  /**
   * Get notification configuration for a user
   */
  static async getUserNotificationConfig(userId: string): Promise<NotificationConfig> {
    try {
      const user = await safePrismaQuery(async (client) => {
        return await client.user.findUnique({
          where: { id: userId },
          select: { role: true }
        });
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Get user's notification preferences
      const preferences = await safePrismaQuery(async (client) => {
        return await client.userNotificationPreferences.findUnique({
          where: { userId }
        });
      });

      // Return default config if no preferences exist
      if (!preferences) {
        return this.getDefaultConfig(userId, user.role as any);
      }

      return {
        userId,
        role: user.role as any,
        channels: {
          in_app: preferences.inAppEnabled,
          email: preferences.emailEnabled,
          sms: preferences.smsEnabled,
          push: preferences.pushEnabled
        },
        eventTypes: {
          booking_created: preferences.bookingCreatedEnabled,
          booking_updated: preferences.bookingUpdatedEnabled,
          booking_cancelled: preferences.bookingCancelledEnabled,
          booking_transferred: preferences.bookingTransferredEnabled,
          payment_success: preferences.paymentSuccessEnabled,
          payment_failed: preferences.paymentFailedEnabled,
          activity_reminder: preferences.activityReminderEnabled,
          system_alert: preferences.systemAlertEnabled
        },
        preferences: {
          quietHours: {
            enabled: preferences.quietHoursEnabled,
            start: preferences.quietHoursStart || '22:00',
            end: preferences.quietHoursEnd || '08:00'
          },
          frequency: preferences.frequency as any || 'immediate',
          language: preferences.language || 'en'
        }
      };

    } catch (error) {
      logger.error('Error getting user notification config:', error);
      throw error;
    }
  }

  /**
   * Update notification configuration for a user
   */
  static async updateUserNotificationConfig(userId: string, config: Partial<NotificationConfig>): Promise<void> {
    try {
      await safePrismaQuery(async (client) => {
        return await client.userNotificationPreferences.upsert({
          where: { userId },
          update: {
            inAppEnabled: config.channels?.in_app,
            emailEnabled: config.channels?.email,
            smsEnabled: config.channels?.sms,
            pushEnabled: config.channels?.push,
            bookingCreatedEnabled: config.eventTypes?.booking_created,
            bookingUpdatedEnabled: config.eventTypes?.booking_updated,
            bookingCancelledEnabled: config.eventTypes?.booking_cancelled,
            bookingTransferredEnabled: config.eventTypes?.booking_transferred,
            paymentSuccessEnabled: config.eventTypes?.payment_success,
            paymentFailedEnabled: config.eventTypes?.payment_failed,
            activityReminderEnabled: config.eventTypes?.activity_reminder,
            systemAlertEnabled: config.eventTypes?.system_alert,
            quietHoursEnabled: config.preferences?.quietHours?.enabled,
            quietHoursStart: config.preferences?.quietHours?.start,
            quietHoursEnd: config.preferences?.quietHours?.end,
            frequency: config.preferences?.frequency,
            language: config.preferences?.language,
            updatedAt: new Date()
          },
          create: {
            userId,
            inAppEnabled: config.channels?.in_app ?? true,
            emailEnabled: config.channels?.email ?? true,
            smsEnabled: config.channels?.sms ?? false,
            pushEnabled: config.channels?.push ?? true,
            bookingCreatedEnabled: config.eventTypes?.booking_created ?? true,
            bookingUpdatedEnabled: config.eventTypes?.booking_updated ?? true,
            bookingCancelledEnabled: config.eventTypes?.booking_cancelled ?? true,
            bookingTransferredEnabled: config.eventTypes?.booking_transferred ?? true,
            paymentSuccessEnabled: config.eventTypes?.payment_success ?? true,
            paymentFailedEnabled: config.eventTypes?.payment_failed ?? true,
            activityReminderEnabled: config.eventTypes?.activity_reminder ?? true,
            systemAlertEnabled: config.eventTypes?.system_alert ?? true,
            quietHoursEnabled: config.preferences?.quietHours?.enabled ?? false,
            quietHoursStart: config.preferences?.quietHours?.start ?? '22:00',
            quietHoursEnd: config.preferences?.quietHours?.end ?? '08:00',
            frequency: config.preferences?.frequency ?? 'immediate',
            language: config.preferences?.language ?? 'en',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      });

      logger.info(`Notification config updated for user ${userId}`);

    } catch (error) {
      logger.error('Error updating user notification config:', error);
      throw error;
    }
  }

  /**
   * Send notification based on user's configuration
   */
  static async sendConfigurableNotification(request: NotificationRequest): Promise<void> {
    try {
      const config = await this.getUserNotificationConfig(request.userId);

      // Check if user wants to receive this type of notification
      if (!this.shouldSendNotification(config, request.type)) {
        logger.info(`Notification skipped for user ${request.userId} - type ${request.type} disabled`);
        return;
      }

      // Check quiet hours
      if (this.isQuietHours(config)) {
        logger.info(`Notification delayed for user ${request.userId} - quiet hours`);
        await this.scheduleDelayedNotification(request, config);
        return;
      }

      // Determine which channels to use
      const channels = this.getEnabledChannels(config, request.channels);

      // Send notification through each enabled channel
      for (const channel of channels) {
        await this.sendNotificationByChannel(request, channel, config);
      }

      logger.info(`Configurable notification sent to user ${request.userId}`, {
        type: request.type,
        channels: channels
      });

    } catch (error) {
      logger.error('Error sending configurable notification:', error);
      throw error;
    }
  }

  /**
   * Check if notification should be sent based on user's configuration
   */
  private static shouldSendNotification(config: NotificationConfig, eventType: string): boolean {
    const eventTypeKey = eventType as keyof NotificationConfig['eventTypes'];
    return config.eventTypes[eventTypeKey] ?? true;
  }

  /**
   * Check if current time is within quiet hours
   */
  private static isQuietHours(config: NotificationConfig): boolean {
    if (!config.preferences.quietHours.enabled) {
      return false;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const startTime = this.parseTime(config.preferences.quietHours.start);
    const endTime = this.parseTime(config.preferences.quietHours.end);

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Quiet hours span midnight
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  /**
   * Parse time string (HH:MM) to minutes
   */
  private static parseTime(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Get enabled channels for notification
   */
  private static getEnabledChannels(config: NotificationConfig, requestedChannels?: string[]): string[] {
    const channels: string[] = [];

    if (requestedChannels) {
      // Use requested channels if specified
      for (const channel of requestedChannels) {
        if (config.channels[channel as keyof NotificationConfig['channels']]) {
          channels.push(channel);
        }
      }
    } else {
      // Use all enabled channels
      for (const [channel, enabled] of Object.entries(config.channels)) {
        if (enabled) {
          channels.push(channel);
        }
      }
    }

    return channels;
  }

  /**
   * Send notification by specific channel
   */
  private static async sendNotificationByChannel(
    request: NotificationRequest,
    channel: string,
    config: NotificationConfig
  ): Promise<void> {
    try {
      switch (channel) {
        case 'in_app':
          await this.sendInAppNotification(request);
          break;
        case 'email':
          await this.sendEmailNotification(request, config);
          break;
        case 'sms':
          await this.sendSmsNotification(request, config);
          break;
        case 'push':
          await this.sendPushNotification(request, config);
          break;
        default:
          logger.warn(`Unknown notification channel: ${channel}`);
      }
    } catch (error) {
      logger.error(`Error sending ${channel} notification:`, error);
      // Don't throw - individual channel failures shouldn't break the whole flow
    }
  }

  /**
   * Send in-app notification
   */
  private static async sendInAppNotification(request: NotificationRequest): Promise<void> {
    try {
      await safePrismaQuery(async (client) => {
        return await client.notification.create({
          data: {
            userId: request.userId,
            type: request.type,
            title: request.title,
            message: request.message,
            data: request.data,
            priority: request.priority,
            status: 'unread',
            venueId: request.venueId,
            createdAt: new Date()
          }
        });
      });
    } catch (error) {
      logger.error('Error sending in-app notification:', error);
      throw error;
    }
  }

  /**
   * Send email notification
   */
  private static async sendEmailNotification(request: NotificationRequest, config: NotificationConfig): Promise<void> {
    try {
      // This would integrate with the email service
      logger.info(`Email notification sent to user ${request.userId}`, {
        type: request.type,
        language: config.preferences.language
      });
    } catch (error) {
      logger.error('Error sending email notification:', error);
      throw error;
    }
  }

  /**
   * Send SMS notification
   */
  private static async sendSmsNotification(request: NotificationRequest, config: NotificationConfig): Promise<void> {
    try {
      // This would integrate with SMS service
      logger.info(`SMS notification sent to user ${request.userId}`, {
        type: request.type,
        language: config.preferences.language
      });
    } catch (error) {
      logger.error('Error sending SMS notification:', error);
      throw error;
    }
  }

  /**
   * Send push notification
   */
  private static async sendPushNotification(request: NotificationRequest, config: NotificationConfig): Promise<void> {
    try {
      // This would integrate with push notification service
      logger.info(`Push notification sent to user ${request.userId}`, {
        type: request.type,
        language: config.preferences.language
      });
    } catch (error) {
      logger.error('Error sending push notification:', error);
      throw error;
    }
  }

  /**
   * Schedule delayed notification for quiet hours
   */
  private static async scheduleDelayedNotification(request: NotificationRequest, config: NotificationConfig): Promise<void> {
    try {
      // Calculate delay until quiet hours end
      const now = new Date();
      const endTime = this.parseTime(config.preferences.quietHours.end);
      const currentTime = now.getHours() * 60 + now.getMinutes();
      
      let delayMinutes = endTime - currentTime;
      if (delayMinutes <= 0) {
        delayMinutes += 24 * 60; // Add 24 hours if end time is next day
      }

      // Schedule notification
      await safePrismaQuery(async (client) => {
        return await client.scheduledNotification.create({
          data: {
            userId: request.userId,
            type: request.type,
            title: request.title,
            message: request.message,
            data: request.data,
            priority: request.priority,
            scheduledFor: new Date(now.getTime() + delayMinutes * 60 * 1000),
            status: 'pending',
            venueId: request.venueId,
            createdAt: new Date()
          }
        });
      });

      logger.info(`Delayed notification scheduled for user ${request.userId}`, {
        delayMinutes,
        scheduledFor: new Date(now.getTime() + delayMinutes * 60 * 1000)
      });

    } catch (error) {
      logger.error('Error scheduling delayed notification:', error);
      throw error;
    }
  }

  /**
   * Get default notification configuration
   */
  private static getDefaultConfig(userId: string, role: string): NotificationConfig {
    const baseConfig = {
      userId,
      role: role as any,
      channels: {
        in_app: true,
        email: true,
        sms: false,
        push: true
      },
      eventTypes: {
        booking_created: true,
        booking_updated: true,
        booking_cancelled: true,
        booking_transferred: true,
        payment_success: true,
        payment_failed: true,
        activity_reminder: true,
        system_alert: true
      },
      preferences: {
        quietHours: {
          enabled: false,
          start: '22:00',
          end: '08:00'
        },
        frequency: 'immediate' as const,
        language: 'en'
      }
    };

    // Role-specific adjustments
    if (role === 'admin') {
      baseConfig.eventTypes.activity_reminder = false; // Admins don't need activity reminders
    }

    if (role === 'coach') {
      baseConfig.channels.sms = true; // Coaches might need SMS for urgent updates
    }

    return baseConfig;
  }
}



