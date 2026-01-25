import { prisma, safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';

export interface BookingEvent {
  eventType: 'booking_created' | 'booking_updated' | 'booking_cancelled' | 'booking_transferred' | 'booking_payment_adjusted';
  bookingId: string;
  activityId: string;
  parentId: string;
  childId: string;
  timestamp: Date;
  data: {
    originalData?: any;
    newData?: any;
    changes?: any;
    reason?: string;
    adminId?: string;
  };
  metadata: {
    source: 'user' | 'admin' | 'system';
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
  };
}

export interface AnalyticsEvent {
  eventType: string;
  userId: string;
  entityType: 'booking' | 'activity' | 'payment';
  entityId: string;
  properties: Record<string, any>;
  timestamp: Date;
}

export class EventService {
  /**
   * Emit a structured booking event
   */
  static async emitBookingEvent(event: BookingEvent): Promise<void> {
    try {
      // Store event in database for audit trail
      await safePrismaQuery(async (client) => {
        const userId = event.metadata.source === 'admin' ? event.data.adminId : event.parentId;
        
        // Get user role
        const user = await client.user.findUnique({
          where: { id: userId },
          select: { role: true }
        });
        
        return await client.auditLog.create({
          data: {
            action: event.eventType,
            entityType: 'booking',
            entityId: event.bookingId,
            changes: {
              activityId: event.activityId,
              parentId: event.parentId,
              childId: event.childId,
              data: event.data
            },
            metadata: event.metadata,
            userId: userId,
            userRole: user?.role || 'user',
            timestamp: event.timestamp
          }
        });
      });

      // Emit analytics event
      await this.emitAnalyticsEvent({
        eventType: event.eventType,
        userId: event.parentId,
        entityType: 'booking',
        entityId: event.bookingId,
        properties: {
          activityId: event.activityId,
          childId: event.childId,
          changes: event.data.changes,
          reason: event.data.reason,
          source: event.metadata.source
        },
        timestamp: event.timestamp
      });

      // Emit real-time event for live updates
      await this.emitRealTimeEvent(event);

      logger.info(`Booking event emitted: ${event.eventType}`, {
        bookingId: event.bookingId,
        activityId: event.activityId,
        parentId: event.parentId
      });

    } catch (error) {
      logger.error('Error emitting booking event:', error);
      throw error;
    }
  }

  /**
   * Emit analytics event
   */
  static async emitAnalyticsEvent(event: AnalyticsEvent): Promise<void> {
    try {
      // Store analytics event
      await safePrismaQuery(async (client) => {
        return await client.analyticsEvent.create({
          data: {
            eventType: event.eventType,
            userId: event.userId,
            entityType: event.entityType,
            entityId: event.entityId,
            properties: event.properties,
            timestamp: event.timestamp
          }
        });
      });

      // Send to external analytics service (if configured)
      await this.sendToAnalyticsService(event);

    } catch (error) {
      logger.error('Error emitting analytics event:', error);
      // Don't throw - analytics failures shouldn't break the main flow
    }
  }

  /**
   * Emit real-time event for live updates
   */
  private static async emitRealTimeEvent(event: BookingEvent): Promise<void> {
    try {
      // This would integrate with WebSocket or Server-Sent Events
      // For now, we'll just log it
      logger.info(`Real-time event emitted: ${event.eventType}`, {
        bookingId: event.bookingId,
        activityId: event.activityId
      });

      // In a full implementation, this would:
      // 1. Send WebSocket message to connected clients
      // 2. Update real-time dashboard
      // 3. Trigger live register updates
      // 4. Send push notifications

    } catch (error) {
      logger.error('Error emitting real-time event:', error);
      // Don't throw - real-time failures shouldn't break the main flow
    }
  }

  /**
   * Send event to external analytics service
   */
  private static async sendToAnalyticsService(event: AnalyticsEvent): Promise<void> {
    try {
      // This would integrate with services like Google Analytics, Mixpanel, etc.
      // For now, we'll just log it
      logger.info(`Analytics event sent: ${event.eventType}`, {
        userId: event.userId,
        entityType: event.entityType,
        entityId: event.entityId
      });

    } catch (error) {
      logger.error('Error sending to analytics service:', error);
      // Don't throw - analytics failures shouldn't break the main flow
    }
  }

  /**
   * Get booking event history
   */
  static async getBookingEventHistory(bookingId: string): Promise<BookingEvent[]> {
    try {
      const events = await safePrismaQuery(async (client) => {
        return await client.auditLog.findMany({
          where: {
            entityType: 'booking',
            entityId: bookingId,
            action: {
              in: ['booking_created', 'booking_updated', 'booking_cancelled', 'booking_transferred', 'booking_payment_adjusted']
            }
          },
          orderBy: { timestamp: 'desc' }
        });
      });

      return events.map(event => ({
        eventType: event.action as any,
        bookingId: event.entityId,
        activityId: event.details.activityId,
        parentId: event.details.parentId,
        childId: event.details.childId,
        timestamp: event.timestamp,
        data: event.details.data,
        metadata: event.details.metadata
      }));

    } catch (error) {
      logger.error('Error getting booking event history:', error);
      throw error;
    }
  }

  /**
   * Get analytics events for a user
   */
  static async getUserAnalyticsEvents(userId: string, limit: number = 100): Promise<AnalyticsEvent[]> {
    try {
      const events = await safePrismaQuery(async (client) => {
        return await client.analyticsEvent.findMany({
          where: { userId },
          orderBy: { timestamp: 'desc' },
          take: limit
        });
      });

      return events.map(event => ({
        eventType: event.eventType,
        userId: event.userId,
        entityType: event.entityType as any,
        entityId: event.entityId,
        properties: event.properties,
        timestamp: event.timestamp
      }));

    } catch (error) {
      logger.error('Error getting user analytics events:', error);
      throw error;
    }
  }
}
