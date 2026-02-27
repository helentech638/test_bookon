// @ts-nocheck
import { prisma, safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';

interface SessionGenerationOptions {
  activityId: string;
  startDate: Date;
  endDate: Date;
  startTime: string;
  endTime: string;
  excludeDates: string[];
  generateSessions: boolean;
}

interface HolidayOptions {
  earlyDropoff: boolean;
  earlyDropoffPrice: number;
  latePickup: boolean;
  latePickupPrice: number;
}

class ActivityService {
  async createActivityWithSessions(
    activityData: any,
    sessionOptions: SessionGenerationOptions,
    holidayOptions?: HolidayOptions
  ) {
    try {
      return await safePrismaQuery(async (client) => {
        // Create the activity
        const activity = await client.activity.create({
          data: {
            title: activityData.title,
            type: activityData.type,
            venue: {
              connect: { id: activityData.venueId }
            },
            owner: {
              connect: { id: activityData.createdBy }
            },
            description: activityData.description,
            startDate: sessionOptions.startDate,
            endDate: sessionOptions.endDate,
            startTime: sessionOptions.startTime,
            endTime: sessionOptions.endTime,
            capacity: activityData.capacity,
            price: activityData.price,
            status: 'active',
            isActive: true
          }
        });

        // Generate sessions if requested
        if (sessionOptions.generateSessions) {
          await this.generateSessions(activity.id, sessionOptions);
        }

        return activity;
      });
    } catch (error) {
      logger.error('Failed to create activity with sessions:', error);
      throw error;
    }
  }

  async generateSessions(activityId: string, options: SessionGenerationOptions) {
    try {
      const sessions = this.calculateSessionDates(
        options.startDate,
        options.endDate,
        options.excludeDates
      );

      await safePrismaQuery(async (client) => {
        const sessionData = sessions.map(date => ({
          activityId,
          date: new Date(date),
          startTime: options.startTime,
          endTime: options.endTime,
          status: 'active',
          capacity: 0, // Will be set from activity
          bookingsCount: 0
        }));

        await client.session.createMany({
          data: sessionData
        });

        // Update session capacity from activity
        await client.session.updateMany({
          where: { activityId },
          data: {
            capacity: {
              // This will be handled by a trigger or manual update
            }
          }
        });
      });

      logger.info(`Generated ${sessions.length} sessions for activity ${activityId}`);
      return sessions.length;
    } catch (error) {
      logger.error('Failed to generate sessions:', error);
      throw error;
    }
  }

  private calculateSessionDates(
    startDate: Date,
    endDate: Date,
    excludeDates: string[]
  ): string[] {
    const sessions: string[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      const dateString = current.toISOString().split('T')[0];

      // Skip excluded dates
      if (!excludeDates.includes(dateString)) {
        // For afterschool activities, generate sessions for weekdays only
        // For holiday clubs, generate sessions for all days
        const dayOfWeek = current.getDay();
        if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Monday to Friday
          sessions.push(dateString);
        }
      }

      current.setDate(current.getDate() + 1);
    }

    return sessions;
  }

  async updateActivityCapacity(activityId: string, newCapacity: number) {
    try {
      await safePrismaQuery(async (client) => {
        // Update activity capacity
        await client.activity.update({
          where: { id: activityId },
          data: { capacity: newCapacity }
        });

        // Update all sessions capacity
        await client.session.updateMany({
          where: { activityId },
          data: { capacity: newCapacity }
        });
      });

      logger.info(`Updated capacity to ${newCapacity} for activity ${activityId}`);
    } catch (error) {
      logger.error('Failed to update activity capacity:', error);
      throw error;
    }
  }

  async getActivityWithSessions(activityId: string) {
    try {
      return await safePrismaQuery(async (client) => {
        return await client.activity.findUnique({
          where: { id: activityId },
          include: {
            venue: true,
            sessions: {
              orderBy: { date: 'asc' }
            },
            bookings: {
              include: {
                child: true,
                parent: true
              }
            },
            _count: {
              select: {
                sessions: true,
                bookings: true
              }
            }
          }
        });
      });
    } catch (error) {
      logger.error('Failed to get activity with sessions:', error);
      throw error;
    }
  }

  async getUpcomingSessions(activityId: string, limit: number = 10) {
    try {
      return await safePrismaQuery(async (client) => {
        return await client.session.findMany({
          where: {
            activityId,
            date: {
              gte: new Date()
            },
            status: 'active'
          },
          orderBy: { date: 'asc' },
          take: limit,
          include: {
            activity: {
              select: {
                title: true,
                type: true,
                venue: {
                  select: {
                    name: true,
                    address: true
                  }
                }
              }
            }
          }
        });
      });
    } catch (error) {
      logger.error('Failed to get upcoming sessions:', error);
      throw error;
    }
  }

  async getActivityStats(activityId: string) {
    try {
      return await safePrismaQuery(async (client) => {
        const activity = await client.activity.findUnique({
          where: { id: activityId },
          include: {
            _count: {
              select: {
                sessions: true,
                bookings: true
              }
            },
            sessions: {
              select: {
                bookingsCount: true,
                capacity: true
              }
            }
          }
        });

        if (!activity) return null;

        const totalCapacity = activity.sessions.reduce((sum, session) => sum + session.capacity, 0);
        const totalBookings = activity.sessions.reduce((sum, session) => sum + session.bookingsCount, 0);
        const utilizationRate = totalCapacity > 0 ? (totalBookings / totalCapacity) * 100 : 0;

        return {
          totalSessions: activity._count.sessions,
          totalBookings: activity._count.bookings,
          totalCapacity,
          utilizationRate: Math.round(utilizationRate * 100) / 100,
          averageBookingsPerSession: activity._count.sessions > 0
            ? Math.round((totalBookings / activity._count.sessions) * 100) / 100
            : 0
        };
      });
    } catch (error) {
      logger.error('Failed to get activity stats:', error);
      throw error;
    }
  }

  async deleteActivity(activityId: string) {
    try {
      await safePrismaQuery(async (client) => {
        // Collect IDs of related entities that need manual cleanup
        const bookings = await client.booking.findMany({
          where: { activityId },
          select: { id: true }
        });
        const sessions = await client.session.findMany({
          where: { activityId },
          select: { id: true }
        });

        const bookingIds = bookings.map(b => b.id);
        const sessionIds = sessions.map(s => s.id);

        // Execute deletions in a transaction to ensure atomicity
        await client.$transaction([
          // 1. Delete entities linked to bookings
          ...(bookingIds.length > 0 ? [
            client.attendance.deleteMany({ where: { bookingId: { in: bookingIds } } }),
            client.payment_successes.deleteMany({ where: { bookingId: { in: bookingIds } } }),
            client.promo_code_usages.deleteMany({ where: { bookingId: { in: bookingIds } } }),
            client.discount_usages.deleteMany({ where: { bookingId: { in: bookingIds } } }),
            client.bank_feed_transactions.deleteMany({ where: { matchedBookingId: { in: bookingIds } } }),
            client.chargeback.deleteMany({ where: { bookingId: { in: bookingIds } } }),
            client.credit.deleteMany({ where: { bookingId: { in: bookingIds } } }),
            client.email.deleteMany({ where: { bookingId: { in: bookingIds } } }),
            client.refund.deleteMany({ where: { bookingId: { in: bookingIds } } }),
            client.refundTransaction.deleteMany({ where: { bookingId: { in: bookingIds } } }),
            client.payment.deleteMany({ where: { bookingId: { in: bookingIds } } }),
            client.transaction.deleteMany({ where: { bookingId: { in: bookingIds } } }),
            client.credit_transactions.deleteMany({ where: { bookingId: { in: bookingIds } } }),
            client.walletCredit.deleteMany({ where: { bookingId: { in: bookingIds } } }),
            client.booking.deleteMany({ where: { activityId } })
          ] : []),

          // 2. Delete entities linked to sessions
          ...(sessionIds.length > 0 ? [
            client.register.deleteMany({ where: { sessionId: { in: sessionIds } } }),
            client.session_blocks.deleteMany({ where: { sessionId: { in: sessionIds } } }),
            client.holiday_time_slots.deleteMany({ where: { sessionId: { in: sessionIds } } })
          ] : []),

          // 3. Delete entities directly linked to activity
          client.session.deleteMany({ where: { activityId } }),
          client.session_blocks.deleteMany({ where: { activityId } }),
          client.holiday_time_slots.deleteMany({ where: { activityId } }),
          client.holidays.deleteMany({ where: { activityId } }),
          client.widgetAnalytics.deleteMany({ where: { activityId } }),
          client.analytics_events.deleteMany({
            where: {
              entityId: activityId,
              entityType: 'Activity'
            }
          }),

          // 4. Finally delete the activity itself
          client.activity.delete({
            where: { id: activityId }
          })
        ]);
      });

      logger.info(`Deleted activity ${activityId} and all related data`);
    } catch (error) {
      logger.error('Failed to delete activity:', error);
      throw error;
    }
  }

  async archiveActivity(activityId: string) {
    try {
      await safePrismaQuery(async (client) => {
        await client.activity.update({
          where: { id: activityId },
          data: {
            isActive: false,
            status: 'archived'
          }
        });
      });

      logger.info(`Archived activity ${activityId}`);
    } catch (error) {
      logger.error('Failed to archive activity:', error);
      throw error;
    }
  }

  async getActivitiesByVenue(venueId: string) {
    try {
      return await safePrismaQuery(async (client) => {
        return await client.activity.findMany({
          where: {
            venueId,
            isActive: true
          },
          include: {
            venue: true,
            _count: {
              select: {
                sessions: true,
                bookings: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        });
      });
    } catch (error) {
      logger.error('Failed to get activities by venue:', error);
      throw error;
    }
  }

  async getActivitiesByType(type: string) {
    try {
      return await safePrismaQuery(async (client) => {
        return await client.activity.findMany({
          where: {
            type,
            isActive: true
          },
          include: {
            venue: true,
            _count: {
              select: {
                sessions: true,
                bookings: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        });
      });
    } catch (error) {
      logger.error('Failed to get activities by type:', error);
      throw error;
    }
  }
}

export const activityService = new ActivityService();
export default activityService;

