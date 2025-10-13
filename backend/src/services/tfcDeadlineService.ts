import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { EmailService } from './emailService';

export class TFCDeadlineService {
  /**
   * Check for TFC bookings approaching deadline and send reminders
   */
  static async checkDeadlinesAndSendReminders(): Promise<void> {
    try {
      logger.info('Checking TFC deadlines and sending reminders...');

      // Get TFC bookings that are approaching deadline (48 hours before)
      const reminderThreshold = new Date();
      reminderThreshold.setHours(reminderThreshold.getHours() + 48);

      const bookingsNeedingReminder = await prisma.booking.findMany({
        where: {
          paymentMethod: 'tfc',
          status: 'pending_payment',
          tfcDeadline: {
            lte: reminderThreshold,
            gte: new Date() // Not expired yet
          }
        },
        include: {
          parent: true,
          child: true,
          activity: {
            include: {
              venue: true
            }
          }
        }
      });

      logger.info(`Found ${bookingsNeedingReminder.length} bookings needing reminder`);

      // Send reminders
      for (const booking of bookingsNeedingReminder) {
        try {
          await EmailService.sendTFCDeadlineReminder(booking.id);
          logger.info(`Sent TFC reminder for booking ${booking.id}`);
        } catch (error) {
          logger.error(`Failed to send TFC reminder for booking ${booking.id}:`, error);
        }
      }

      // Check for expired bookings and auto-cancel
      await this.autoCancelExpiredBookings();

    } catch (error) {
      logger.error('Error checking TFC deadlines:', error);
      throw error;
    }
  }

  /**
   * Auto-cancel expired TFC bookings
   */
  static async autoCancelExpiredBookings(): Promise<void> {
    try {
      logger.info('Checking for expired TFC bookings...');

      const now = new Date();
      const expiredBookings = await prisma.booking.findMany({
        where: {
          paymentMethod: 'tfc',
          status: 'pending_payment',
          tfcDeadline: {
            lt: now
          }
        },
        include: {
          parent: true,
          child: true,
          activity: {
            include: {
              venue: true
            }
          }
        }
      });

      logger.info(`Found ${expiredBookings.length} expired TFC bookings`);

      for (const booking of expiredBookings) {
        try {
          await this.cancelExpiredBooking(booking.id);
          logger.info(`Auto-cancelled expired booking ${booking.id}`);
        } catch (error) {
          logger.error(`Failed to auto-cancel booking ${booking.id}:`, error);
        }
      }

    } catch (error) {
      logger.error('Error auto-cancelling expired bookings:', error);
      throw error;
    }
  }

  /**
   * Cancel a specific expired booking
   */
  private static async cancelExpiredBooking(bookingId: string): Promise<void> {
    try {
      await prisma.$transaction(async (tx) => {
        // Update booking status
        await tx.booking.update({
          where: { id: bookingId },
          data: {
            status: 'cancelled',
            updatedAt: new Date()
          }
        });

        // Log the auto-cancellation
        logger.info('TFC booking auto-cancelled due to expired deadline', {
          bookingId,
          cancelledAt: new Date()
        });
      });

      // Send cancellation email
      try {
        await EmailService.sendCancellationConfirmation(bookingId, 0, 'No refund - payment deadline expired');
      } catch (emailError) {
        logger.error('Failed to send auto-cancellation email:', emailError);
      }

    } catch (error) {
      logger.error('Error cancelling expired booking:', error);
      throw error;
    }
  }

  /**
   * Schedule TFC deadline checks (to be called by cron job)
   */
  static async scheduleDeadlineChecks(): Promise<void> {
    try {
      // This would typically be called by a cron job or scheduled task
      // For now, we'll just run the checks
      await this.checkDeadlinesAndSendReminders();
    } catch (error) {
      logger.error('Error in scheduled deadline checks:', error);
      throw error;
    }
  }

  /**
   * Get TFC bookings approaching deadline for admin dashboard
   */
  static async getBookingsApproachingDeadline(hoursThreshold: number = 48): Promise<any[]> {
    try {
      const threshold = new Date();
      threshold.setHours(threshold.getHours() + hoursThreshold);

      const bookings = await prisma.booking.findMany({
        where: {
          paymentMethod: 'tfc',
          status: 'pending_payment',
          tfcDeadline: {
            lte: threshold,
            gte: new Date()
          }
        },
        include: {
          parent: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          child: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          },
          activity: {
            include: {
              venue: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        },
        orderBy: {
          tfcDeadline: 'asc'
        }
      });

      return bookings.map(booking => ({
        id: booking.id,
        parentName: `${booking.parent.firstName} ${booking.parent.lastName}`,
        parentEmail: booking.parent.email,
        childName: `${booking.child.firstName} ${booking.child.lastName}`,
        activityName: booking.activity.title,
        venueName: booking.activity.venue.name,
        amount: Number(booking.amount),
        paymentReference: booking.tfcReference,
        deadline: booking.tfcDeadline,
        hoursUntilDeadline: booking.tfcDeadline ? 
          Math.floor((booking.tfcDeadline.getTime() - new Date().getTime()) / (1000 * 60 * 60)) : 0
      }));

    } catch (error) {
      logger.error('Error getting bookings approaching deadline:', error);
      throw error;
    }
  }

  /**
   * Get expired TFC bookings for admin dashboard
   */
  static async getExpiredBookings(): Promise<any[]> {
    try {
      const now = new Date();
      const bookings = await prisma.booking.findMany({
        where: {
          paymentMethod: 'tfc',
          status: 'pending_payment',
          tfcDeadline: {
            lt: now
          }
        },
        include: {
          parent: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          child: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          },
          activity: {
            include: {
              venue: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        },
        orderBy: {
          tfcDeadline: 'desc'
        }
      });

      return bookings.map(booking => ({
        id: booking.id,
        parentName: `${booking.parent.firstName} ${booking.parent.lastName}`,
        parentEmail: booking.parent.email,
        childName: `${booking.child.firstName} ${booking.child.lastName}`,
        activityName: booking.activity.title,
        venueName: booking.activity.venue.name,
        amount: Number(booking.amount),
        paymentReference: booking.tfcReference,
        deadline: booking.tfcDeadline,
        hoursOverdue: booking.tfcDeadline ? 
          Math.floor((new Date().getTime() - booking.tfcDeadline.getTime()) / (1000 * 60 * 60)) : 0
      }));

    } catch (error) {
      logger.error('Error getting expired bookings:', error);
      throw error;
    }
  }
}

