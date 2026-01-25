import { prisma, safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';

export interface CapacityUpdate {
  activityId: string;
  sessionId?: string;
  holidayTimeSlotId?: string;
  change: number; // +1 for booking, -1 for cancellation
  bookingId: string;
  reason: 'booking_created' | 'booking_cancelled' | 'booking_transferred' | 'booking_modified';
}

export class CapacityService {
  /**
   * Update capacity for an activity/session/holiday slot
   */
  static async updateCapacity(update: CapacityUpdate): Promise<void> {
    try {
      const { activityId, sessionId, holidayTimeSlotId, change, bookingId, reason } = update;

      // Update activity capacity
      await safePrismaQuery(async (client) => {
        return await client.activity.update({
          where: { id: activityId },
          data: {
            bookingsCount: {
              increment: change
            }
          }
        });
      });

      // Update session capacity if applicable
      if (sessionId) {
        await safePrismaQuery(async (client) => {
          return await client.session.update({
            where: { id: sessionId },
            data: {
              bookingsCount: {
                increment: change
              }
            }
          });
        });
      }

      // Update holiday time slot capacity if applicable
      if (holidayTimeSlotId) {
        await safePrismaQuery(async (client) => {
          return await client.holidayTimeSlot.update({
            where: { id: holidayTimeSlotId },
            data: {
              bookingsCount: {
                increment: change
              }
            }
          });
        });
      }

      // Log capacity change for audit
      await this.logCapacityChange({
        activityId,
        sessionId,
        holidayTimeSlotId,
        bookingId,
        change,
        reason
      });

      logger.info(`Capacity updated for activity ${activityId}`, {
        change,
        reason,
        bookingId
      });

    } catch (error) {
      logger.error('Error updating capacity:', error);
      throw error;
    }
  }

  /**
   * Recalculate all capacities for an activity
   */
  static async recalculateActivityCapacity(activityId: string): Promise<void> {
    try {
      // Count confirmed bookings for the activity
      const bookingCount = await safePrismaQuery(async (client) => {
        return await client.booking.count({
          where: {
            activityId,
            status: { in: ['confirmed', 'pending'] }
          }
        });
      });

      // Update activity capacity
      await safePrismaQuery(async (client) => {
        return await client.activity.update({
          where: { id: activityId },
          data: {
            bookingsCount: bookingCount
          }
        });
      });

      // Recalculate session capacities
      const sessions = await safePrismaQuery(async (client) => {
        return await client.session.findMany({
          where: { activityId }
        });
      });

      for (const session of sessions) {
        const sessionBookingCount = await safePrismaQuery(async (client) => {
          return await client.booking.count({
            where: {
              activityId,
              sessionBlockId: session.id,
              status: { in: ['confirmed', 'pending'] }
            }
          });
        });

        await safePrismaQuery(async (client) => {
          return await client.session.update({
            where: { id: session.id },
            data: {
              bookingsCount: sessionBookingCount
            }
          });
        });
      }

      // Recalculate holiday time slot capacities
      const holidaySlots = await safePrismaQuery(async (client) => {
        return await client.holidayTimeSlot.findMany({
          where: { activityId }
        });
      });

      for (const slot of holidaySlots) {
        const slotBookingCount = await safePrismaQuery(async (client) => {
          return await client.booking.count({
            where: {
              activityId,
              holidayTimeSlotId: slot.id,
              status: { in: ['confirmed', 'pending'] }
            }
          });
        });

        await safePrismaQuery(async (client) => {
          return await client.holidayTimeSlot.update({
            where: { id: slot.id },
            data: {
              bookingsCount: slotBookingCount
            }
          });
        });
      }

      logger.info(`Recalculated capacity for activity ${activityId}`, {
        totalBookings: bookingCount
      });

    } catch (error) {
      logger.error('Error recalculating activity capacity:', error);
      throw error;
    }
  }

  /**
   * Log capacity changes for audit trail
   */
  private static async logCapacityChange(data: {
    activityId: string;
    sessionId?: string;
    holidayTimeSlotId?: string;
    bookingId: string;
    change: number;
    reason: string;
  }): Promise<void> {
    try {
      await safePrismaQuery(async (client) => {
        return await client.auditLog.create({
          data: {
            action: 'capacity_update',
            entityType: 'booking',
            entityId: data.bookingId,
            changes: {
              activityId: data.activityId,
              sessionId: data.sessionId,
              holidayTimeSlotId: data.holidayTimeSlotId,
              change: data.change,
              reason: data.reason
            },
            userId: 'system',
            userRole: 'system',
            timestamp: new Date()
          }
        });
      });
    } catch (error) {
      logger.error('Error logging capacity change:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Get capacity information for an activity
   */
  static async getCapacityInfo(activityId: string): Promise<{
    totalCapacity: number;
    currentBookings: number;
    availableSpots: number;
    isFull: boolean;
  }> {
    try {
      const activity = await safePrismaQuery(async (client) => {
        return await client.activity.findUnique({
          where: { id: activityId },
          select: {
            capacity: true,
            bookingsCount: true
          }
        });
      });

      if (!activity) {
        throw new Error('Activity not found');
      }

      const totalCapacity = activity.capacity || 0;
      const currentBookings = activity.bookingsCount || 0;
      const availableSpots = Math.max(0, totalCapacity - currentBookings);
      const isFull = availableSpots === 0;

      return {
        totalCapacity,
        currentBookings,
        availableSpots,
        isFull
      };
    } catch (error) {
      logger.error('Error getting capacity info:', error);
      throw error;
    }
  }
}
