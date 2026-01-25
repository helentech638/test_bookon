import { safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';
import { Decimal } from '@prisma/client/runtime/library';
import { CapacityService } from './capacityService';
import { EventService } from './eventService';
import { ConfigurableNotificationService } from './configurableNotificationService';

export interface RegisterUpdate {
  registerId: string;
  bookingId: string;
  childId: string;
  changes: {
    attendance?: boolean;
    checkInTime?: Date;
    checkOutTime?: Date;
    notes?: string;
    medicalNotes?: string;
    permissions?: any;
    bookingOptions?: {
      hasEarlyDropoff?: boolean;
      hasLatePickup?: boolean;
      earlyDropoffAmount?: number;
      latePickupAmount?: number;
    };
  };
  reason: 'booking_created' | 'booking_updated' | 'booking_cancelled' | 'booking_transferred' | 'payment_adjusted';
  adminId?: string;
}

export class RealTimeRegisterService {
  /**
   * Update register in real-time when booking changes
   */
  static async updateRegisterRealTime(update: RegisterUpdate): Promise<void> {
    try {
      const { registerId, bookingId, childId, changes, reason, adminId } = update;

      // Find the attendance record
      const attendance = await safePrismaQuery(async (client) => {
        return await client.attendance.findFirst({
          where: {
            registerId,
            childId,
            bookingId
          },
          include: {
            child: true,
            booking: true,
            register: {
              include: {
                session: {
                  include: {
                    activity: true
                  }
                }
              }
            }
          }
        });
      });

      if (!attendance) {
        logger.warn(`Attendance record not found for register ${registerId}, child ${childId}, booking ${bookingId}`);
        return;
      }

      // Update attendance record
      const updatedAttendance = await safePrismaQuery(async (client) => {
        return await client.attendance.update({
          where: { id: attendance.id },
          data: {
            ...(changes.attendance !== undefined && { present: changes.attendance }),
            ...(changes.checkInTime && { checkInTime: changes.checkInTime }),
            ...(changes.checkOutTime && { checkOutTime: changes.checkOutTime }),
            ...(changes.notes && { notes: changes.notes }),
            updatedAt: new Date()
          },
          include: {
            child: true,
            booking: true
          }
        });
      });

      // Update register timestamp
      await safePrismaQuery(async (client) => {
        return await client.register.update({
          where: { id: registerId },
          data: {
            updatedAt: new Date()
          }
        });
      });

      // Update capacity if booking was created/cancelled
      if (reason === 'booking_created') {
        await CapacityService.updateCapacity({
          activityId: attendance.register.session.activityId,
          sessionId: attendance.register.sessionId,
          holidayTimeSlotId: attendance.booking.holidayTimeSlotId,
          change: 1,
          bookingId,
          reason: 'booking_created'
        });
      } else if (reason === 'booking_cancelled') {
        await CapacityService.updateCapacity({
          activityId: attendance.register.session.activityId,
          sessionId: attendance.register.sessionId,
          holidayTimeSlotId: attendance.booking.holidayTimeSlotId,
          change: -1,
          bookingId,
          reason: 'booking_cancelled'
        });
      }

      // Emit structured event
      await EventService.emitBookingEvent({
        eventType: reason as any,
        bookingId,
        activityId: attendance.register.session.activityId,
        parentId: attendance.booking.parentId,
        childId,
        timestamp: new Date(),
        data: {
          changes,
          reason,
          adminId: adminId || undefined
        },
        metadata: {
          source: adminId ? 'admin' : 'user'
        }
      });

      // Send real-time notification to relevant users
      await this.sendRealTimeNotifications(attendance, changes, reason, adminId);

      logger.info(`Register updated in real-time for booking ${bookingId}`, {
        registerId,
        childId,
        reason,
        changes
      });

    } catch (error) {
      logger.error('Error updating register in real-time:', error);
      throw error;
    }
  }

  /**
   * Create new attendance record when booking is created
   */
  static async createAttendanceForBooking(bookingId: string): Promise<void> {
    try {
      const booking = await safePrismaQuery(async (client) => {
        return await client.booking.findUnique({
          where: { id: bookingId },
          include: {
            activity: {
              include: {
                sessions: {
                  where: {
                    date: {
                      gte: new Date(booking.activityDate)
                    }
                  },
                  orderBy: { date: 'asc' },
                  take: 1
                }
              }
            },
            child: true
          }
        });
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      // Find or create register for the activity date
      let register = await safePrismaQuery(async (client) => {
        return await client.register.findFirst({
          where: {
            session: {
              activityId: booking.activityId
            },
            date: new Date(booking.activityDate)
          }
        });
      });

      if (!register) {
        // Create new register
        register = await safePrismaQuery(async (client) => {
          return await client.register.create({
            data: {
              sessionId: booking.activity.sessions[0]?.id || '',
              date: new Date(booking.activityDate),
              status: 'upcoming',
              createdAt: new Date(),
              updatedAt: new Date()
            }
          });
        });
      }

      // Create attendance record
      const attendance = await safePrismaQuery(async (client) => {
        return await client.attendance.create({
          data: {
            registerId: register.id,
            childId: booking.childId,
            bookingId: booking.id,
            present: false, // Default to absent, will be updated when child arrives
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      });

      // Update register in real-time
      await this.updateRegisterRealTime({
        registerId: register.id,
        bookingId,
        childId: booking.childId,
        changes: {
          attendance: false
        },
        reason: 'booking_created'
      });

      logger.info(`Attendance record created for booking ${bookingId}`, {
        registerId: register.id,
        attendanceId: attendance.id
      });

    } catch (error) {
      logger.error('Error creating attendance for booking:', error);
      throw error;
    }
  }

  /**
   * Update booking options and sync with register
   */
  static async updateBookingOptionsRealTime(
    bookingId: string,
    options: {
      hasEarlyDropoff?: boolean;
      hasLatePickup?: boolean;
      earlyDropoffAmount?: number;
      latePickupAmount?: number;
    },
    adminId?: string
  ): Promise<void> {
    try {
      const booking = await safePrismaQuery(async (client) => {
        return await client.booking.findUnique({
          where: { id: bookingId },
          include: {
            activity: true,
            child: true
          }
        });
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      // Calculate new total amount
      let newTotalAmount = Number(booking.amount);
      if (options.hasEarlyDropoff && booking.activity.earlyDropoffPrice) {
        newTotalAmount += Number(booking.activity.earlyDropoffPrice);
      }
      if (options.hasLatePickup && booking.activity.latePickupPrice) {
        newTotalAmount += Number(booking.activity.latePickupPrice);
      }

      // Update booking
      const updatedBooking = await safePrismaQuery(async (client) => {
        return await client.booking.update({
          where: { id: bookingId },
          data: {
            hasEarlyDropoff: options.hasEarlyDropoff || false,
            earlyDropoffAmount: options.earlyDropoffAmount || null,
            hasLatePickup: options.hasLatePickup || false,
            latePickupAmount: options.latePickupAmount || null,
            totalAmount: new Decimal(newTotalAmount),
            updatedAt: new Date()
          }
        });
      });

      // Find all registers for this booking and update them
      const registers = await safePrismaQuery(async (client) => {
        return await client.register.findMany({
          where: {
            session: {
              activityId: booking.activityId
            }
          },
          include: {
            attendance: {
              where: {
                bookingId
              }
            }
          }
        });
      });

      // Update each register
      for (const register of registers) {
        if (register.attendance.length > 0) {
          await this.updateRegisterRealTime({
            registerId: register.id,
            bookingId,
            childId: booking.childId,
            changes: {
              bookingOptions: {
                hasEarlyDropoff: options.hasEarlyDropoff || false,
                hasLatePickup: options.hasLatePickup || false,
                earlyDropoffAmount: options.earlyDropoffAmount || 0,
                latePickupAmount: options.latePickupAmount || 0
              }
            },
            reason: 'payment_adjusted',
            adminId
          });
        }
      }

      logger.info(`Booking options updated in real-time for booking ${bookingId}`, {
        options,
        newTotalAmount,
        adminId
      });

    } catch (error) {
      logger.error('Error updating booking options in real-time:', error);
      throw error;
    }
  }

  /**
   * Transfer booking and update all related registers
   */
  static async transferBookingRealTime(
    bookingId: string,
    newActivityId: string,
    newDate?: string,
    adminId?: string
  ): Promise<void> {
    try {
      const booking = await safePrismaQuery(async (client) => {
        return await client.booking.findUnique({
          where: { id: bookingId },
          include: {
            activity: true,
            child: true
          }
        });
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      const oldActivityId = booking.activityId;
      const oldDate = booking.activityDate;

      // Update booking
      const updatedBooking = await safePrismaQuery(async (client) => {
        return await client.booking.update({
          where: { id: bookingId },
          data: {
            activityId: newActivityId,
            activityDate: newDate ? new Date(newDate) : booking.activityDate,
            updatedAt: new Date()
          }
        });
      });

      // Remove from old registers
      const oldRegisters = await safePrismaQuery(async (client) => {
        return await client.register.findMany({
          where: {
            session: {
              activityId: oldActivityId
            }
          },
          include: {
            attendance: {
              where: {
                bookingId
              }
            }
          }
        });
      });

      for (const register of oldRegisters) {
        if (register.attendance.length > 0) {
          // Remove attendance record
          await safePrismaQuery(async (client) => {
            return await client.attendance.deleteMany({
              where: {
                registerId: register.id,
                bookingId
              }
            });
          });

          // Update capacity
          await CapacityService.updateCapacity({
            activityId: oldActivityId,
            sessionId: register.sessionId,
            holidayTimeSlotId: booking.holidayTimeSlotId || undefined,
            change: -1,
            bookingId,
            reason: 'booking_transferred'
          });
        }
      }

      // Add to new registers
      await this.createAttendanceForBooking(bookingId);

      // Emit transfer event
      await EventService.emitBookingEvent({
        eventType: 'booking_transferred',
        bookingId,
        activityId: newActivityId,
        parentId: booking.parentId,
        childId: booking.childId,
        timestamp: new Date(),
        data: {
          originalData: {
            activityId: oldActivityId,
            activityDate: oldDate
          },
          newData: {
            activityId: newActivityId,
            activityDate: newDate ? new Date(newDate) : booking.activityDate
          },
          reason: 'booking_transferred',
          adminId: adminId || undefined
        },
        metadata: {
          source: 'admin'
        }
      });

      logger.info(`Booking transferred in real-time for booking ${bookingId}`, {
        oldActivityId,
        newActivityId,
        adminId
      });

    } catch (error) {
      logger.error('Error transferring booking in real-time:', error);
      throw error;
    }
  }

  /**
   * Send real-time notifications to relevant users
   */
  private static async sendRealTimeNotifications(
    attendance: any,
    changes: any,
    reason: string,
    adminId?: string
  ): Promise<void> {
    try {
      // Notify parent
      await ConfigurableNotificationService.sendConfigurableNotification({
        userId: attendance.booking.parentId,
        type: reason,
        title: this.getNotificationTitle(reason),
        message: this.getNotificationMessage(reason, attendance.child.firstName, changes),
        data: {
          bookingId: attendance.booking.id,
          childId: attendance.child.id,
          registerId: attendance.register.id,
          changes
        },
        priority: this.getNotificationPriority(reason),
        venueId: attendance.register.session.activity.venueId
      });

      // Notify business owner
      await ConfigurableNotificationService.sendConfigurableNotification({
        userId: attendance.register.session.activity.ownerId,
        type: reason,
        title: `Admin Action: ${this.getNotificationTitle(reason)}`,
        message: `Admin ${adminId ? 'updated' : 'modified'} booking for ${attendance.child.firstName} ${attendance.child.lastName}`,
        data: {
          bookingId: attendance.booking.id,
          childId: attendance.child.id,
          registerId: attendance.register.id,
          changes,
          adminId
        },
        priority: 'medium',
        venueId: attendance.register.session.activity.venueId
      });

    } catch (error) {
      logger.error('Error sending real-time notifications:', error);
      // Don't throw - notification failures shouldn't break the main flow
    }
  }

  /**
   * Get notification title based on reason
   */
  private static getNotificationTitle(reason: string): string {
    switch (reason) {
      case 'booking_created':
        return 'New Booking Created';
      case 'booking_updated':
        return 'Booking Updated';
      case 'booking_cancelled':
        return 'Booking Cancelled';
      case 'booking_transferred':
        return 'Booking Transferred';
      case 'payment_adjusted':
        return 'Payment Adjusted';
      default:
        return 'Booking Modified';
    }
  }

  /**
   * Get notification message based on reason and changes
   */
  private static getNotificationMessage(reason: string, childName: string, _changes: any): string {
    switch (reason) {
      case 'booking_created':
        return `New booking created for ${childName}`;
      case 'booking_updated':
        return `Booking updated for ${childName}`;
      case 'booking_cancelled':
        return `Booking cancelled for ${childName}`;
      case 'booking_transferred':
        return `Booking transferred for ${childName}`;
      case 'payment_adjusted':
        return `Payment options updated for ${childName}`;
      default:
        return `Booking modified for ${childName}`;
    }
  }

  /**
   * Remove attendance record when booking is cancelled
   */
  static async removeAttendanceForCancelledBooking(bookingId: string): Promise<void> {
    try {
      logger.info(`Removing attendance for cancelled booking ${bookingId}`);

      // Find all attendance records for this booking
      const attendanceRecords = await safePrismaQuery(async (client) => {
        return await client.attendance.findMany({
          where: { bookingId },
          include: {
            child: true,
            booking: true,
            register: {
              include: {
                session: {
                  include: {
                    activity: true
                  }
                }
              }
            }
          }
        });
      });

      if (attendanceRecords.length === 0) {
        logger.info(`No attendance records found for cancelled booking ${bookingId}`);
        return;
      }

      // Remove each attendance record
      for (const attendance of attendanceRecords) {
        await safePrismaQuery(async (client) => {
          return await client.attendance.delete({
            where: { id: attendance.id }
          });
        });

        logger.info(`Removed attendance record ${attendance.id} for cancelled booking ${bookingId}`);

        // Update register statistics
        await this.updateRegisterStatistics(attendance.registerId);

        // Update capacity (increase by 1 since booking is cancelled)
        await CapacityService.updateCapacity({
          activityId: attendance.register.session.activityId,
          sessionId: attendance.register.sessionId,
          holidayTimeSlotId: attendance.booking.holidayTimeSlotId,
          change: 1, // Positive change since we're freeing up capacity
          bookingId,
          reason: 'booking_cancelled'
        });

        // Emit structured event
        await EventService.emitBookingEvent({
          eventType: 'booking_cancelled',
          bookingId,
          activityId: attendance.register.session.activityId,
          parentId: attendance.booking.parentId,
          childId: attendance.childId,
          timestamp: new Date(),
          data: {
            changes: {
              attendance: false, // Mark as removed
              notes: 'Attendance removed due to booking cancellation'
            },
            reason: 'booking_cancelled',
            adminId: undefined
          },
          metadata: {
            source: 'user'
          }
        });
      }

      logger.info(`Successfully removed ${attendanceRecords.length} attendance records for cancelled booking ${bookingId}`);

    } catch (error) {
      logger.error('Error removing attendance for cancelled booking:', error);
      throw error;
    }
  }

  /**
   * Update register statistics after attendance changes
   */
  private static async updateRegisterStatistics(registerId: string): Promise<void> {
    try {
      const attendanceCount = await safePrismaQuery(async (client) => {
        return await client.attendance.count({
          where: { registerId }
        });
      });

      const presentCount = await safePrismaQuery(async (client) => {
        return await client.attendance.count({
          where: { 
            registerId,
            present: true
          }
        });
      });

      // Update register with new statistics
      await safePrismaQuery(async (client) => {
        return await client.register.update({
          where: { id: registerId },
          data: {
            updatedAt: new Date()
            // Add statistics fields if they exist in the schema
            // totalAttendees: attendanceCount,
            // presentAttendees: presentCount
          }
        });
      });

      logger.info(`Updated register ${registerId} statistics: ${presentCount}/${attendanceCount} present`);

    } catch (error) {
      logger.error('Error updating register statistics:', error);
      // Don't throw - this is not critical for the main flow
    }
  }

  /**
   * Get notification priority based on reason
   */
  private static getNotificationPriority(reason: string): 'low' | 'medium' | 'high' | 'urgent' {
    switch (reason) {
      case 'booking_cancelled':
      case 'booking_transferred':
        return 'high';
      case 'payment_adjusted':
        return 'medium';
      default:
        return 'low';
    }
  }
}
