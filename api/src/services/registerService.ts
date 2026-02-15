import { prisma, safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';

interface RegisterData {
  sessionId: string;
  activityId: string;
  date: Date;
  capacity: number;
  notes?: string;
}

interface AttendanceRecord {
  childId: string;
  present: boolean;
  checkInTime?: Date;
  checkOutTime?: Date;
  notes?: string;
}

class RegisterService {
  async createRegister(sessionId: string, capacity: number, notes?: string) {
    try {
      return await safePrismaQuery(async (client) => {
        // Get session details
        const session = await client.session.findUnique({
          where: { id: sessionId },
          include: {
            activity: {
              select: {
                id: true,
                title: true,
                type: true,
                venueId: true,
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

        if (!session) {
          throw new Error('Session not found');
        }

        // Create register
        const register = await client.register.create({
          data: {
            sessionId,
            activityId: session.activity!.id,
            venueId: session.activity!.venueId,
            date: session.date,
            capacity: capacity || session.capacity || 20,
            notes,
            status: 'active'
          },
          include: {
            session: {
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
            }
          }
        });

        logger.info('Register created', {
          registerId: register.id,
          sessionId,
          activityId: session.activity!.id,
          date: session.date
        });

        return register;
      });
    } catch (error) {
      logger.error('Failed to create register:', error);
      throw error;
    }
  }

  async getRegister(registerId: string) {
    try {
      return await safePrismaQuery(async (client) => {
        return await client.register.findUnique({
          where: { id: registerId },
          include: {
            session: {
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
            },
            attendance: {
              include: {
                child: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    dateOfBirth: true,
                    allergies: true
                  }
                },
                booking: {
                  select: {
                    id: true,
                    parent: {
                      select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                        phone: true
                      }
                    }
                  }
                }
              }
            }
          }
        });
      });
    } catch (error) {
      logger.error('Failed to get register:', error);
      throw error;
    }
  }

  async getRegistersByActivity(activityId: string, dateFrom?: Date, dateTo?: Date) {
    try {
      return await safePrismaQuery(async (client) => {
        const where: any = { activityId };

        if (dateFrom || dateTo) {
          where.date = {};
          if (dateFrom) where.date.gte = dateFrom;
          if (dateTo) where.date.lte = dateTo;
        }

        return await client.register.findMany({
          where,
          include: {
            session: {
              include: {
                activity: {
                  select: {
                    title: true,
                    type: true
                  }
                }
              }
            },
            _count: {
              select: {
                attendance: true
              }
            }
          },
          orderBy: { date: 'desc' }
        });
      });
    } catch (error) {
      logger.error('Failed to get registers by activity:', error);
      throw error;
    }
  }

  async getRegistersBySession(sessionId: string) {
    try {
      return await safePrismaQuery(async (client) => {
        return await client.register.findMany({
          where: { sessionId },
          include: {
            session: {
              include: {
                activity: {
                  select: {
                    title: true,
                    type: true
                  }
                }
              }
            },
            _count: {
              select: {
                attendance: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        });
      });
    } catch (error) {
      logger.error('Failed to get registers by session:', error);
      throw error;
    }
  }

  async updateAttendance(registerId: string, attendanceRecords: AttendanceRecord[]) {
    try {
      return await safePrismaQuery(async (client) => {
        const register = await client.register.findUnique({
          where: { id: registerId },
          include: {
            session: {
              include: {
                activity: {
                  select: {
                    title: true,
                    type: true
                  }
                }
              }
            }
          }
        });

        if (!register) {
          throw new Error('Register not found');
        }

        // Get existing attendance records
        const existingAttendance = await client.attendance.findMany({
          where: { registerId }
        });

        // Update or create attendance records
        const results = [];
        for (const record of attendanceRecords) {
          const existing = existingAttendance.find(a => a.childId === record.childId);

          if (existing) {
            // Update existing record
            const updated = await client.attendance.update({
              where: { id: existing.id },
              data: {
                present: record.present,
                checkInTime: record.checkInTime,
                checkOutTime: record.checkOutTime,
                notes: record.notes
              }
            });
            results.push(updated);
          } else {
            // Create new record
            const created = await client.attendance.create({
              data: {
                registerId,
                childId: record.childId,
                present: record.present,
                checkInTime: record.checkInTime,
                checkOutTime: record.checkOutTime,
                notes: record.notes
              }
            });
            results.push(created);
          }
        }

        // Update register statistics
        const presentCount = results.filter(r => r.present).length;
        const totalCount = results.length;

        await client.register.update({
          where: { id: registerId },
          data: {
            presentCount,
            totalCount,
            lastUpdated: new Date()
          }
        });

        logger.info('Attendance updated', {
          registerId,
          presentCount,
          totalCount
        });

        return results;
      });
    } catch (error) {
      logger.error('Failed to update attendance:', error);
      throw error;
    }
  }

  async getAttendanceStats(registerId: string) {
    try {
      return await safePrismaQuery(async (client) => {
        const register = await client.register.findUnique({
          where: { id: registerId },
          include: {
            attendance: true
          }
        });

        if (!register) return null;

        const totalAttendance = register.attendance.length;
        const presentCount = register.attendance.filter(a => a.present).length;
        const absentCount = totalAttendance - presentCount;

        return {
          totalBookings: register.totalCount,
          totalAttendance,
          presentCount,
          absentCount,
          noShowCount: register.totalCount - totalAttendance,
          attendanceRate: register.totalCount > 0 ? (totalAttendance / register.totalCount) * 100 : 0,
          presentRate: totalAttendance > 0 ? (presentCount / totalAttendance) * 100 : 0
        };
      });
    } catch (error) {
      logger.error('Failed to get attendance stats:', error);
      throw error;
    }
  }

  async generateAttendanceReport(activityId: string, dateFrom: Date, dateTo: Date) {
    try {
      return await safePrismaQuery(async (client) => {
        const registers = await client.register.findMany({
          where: {
            activityId,
            date: {
              gte: dateFrom,
              lte: dateTo
            }
          },
          include: {
            session: {
              include: {
                activity: {
                  select: {
                    title: true,
                    type: true
                  }
                }
              }
            },
            attendance: {
              include: {
                child: {
                  select: {
                    firstName: true,
                    lastName: true
                  }
                }
              }
            }
          },
          orderBy: { date: 'asc' }
        });

        const report = {
          activityId,
          dateFrom,
          dateTo,
          totalSessions: registers.length,
          totalAttendance: registers.reduce((sum, r) => sum + r.attendance.length, 0),
          totalPresent: registers.reduce((sum, r) => sum + r.presentCount, 0),
          averageAttendance: registers.length > 0
            ? registers.reduce((sum, r) => sum + r.attendance.length, 0) / registers.length
            : 0,
          sessions: registers.map(register => ({
            date: register.date,
            presentCount: register.presentCount,
            totalCount: register.totalCount,
            attendanceRate: register.totalCount > 0
              ? (register.presentCount / register.totalCount) * 100
              : 0,
            children: register.attendance.map(att => ({
              name: `${att.child.firstName} ${att.child.lastName}`,
              present: att.present,
              checkInTime: att.checkInTime,
              checkOutTime: att.checkOutTime
            }))
          }))
        };

        return report;
      });
    } catch (error) {
      logger.error('Failed to generate attendance report:', error);
      throw error;
    }
  }

  async deleteRegister(registerId: string) {
    try {
      await safePrismaQuery(async (client) => {
        // Delete attendance records first
        await client.attendance.deleteMany({
          where: { registerId }
        });

        // Delete the register
        await client.register.delete({
          where: { id: registerId }
        });
      });

      logger.info('Register deleted', { registerId });
    } catch (error) {
      logger.error('Failed to delete register:', error);
      throw error;
    }
  }

  async autoCreateRegistersForActivity(activityId: string, startDate: Date, endDate: Date) {
    try {
      return await safePrismaQuery(async (client) => {
        // Get all sessions for the activity in the date range
        const sessions = await client.session.findMany({
          where: {
            activityId,
            date: {
              gte: startDate,
              lte: endDate
            },
            status: 'scheduled'
          },
          include: {
            activity: {
              select: {
                id: true,
                title: true,
                capacity: true,
                venueId: true
              }
            }
          }
        });

        const registers = [];
        for (const session of sessions) {
          // Check if register already exists
          const existingRegister = await client.register.findFirst({
            where: { sessionId: session.id }
          });

          if (!existingRegister) {
            const register = await client.register.create({
              data: {
                sessionId: session.id,
                activityId: session.activity!.id,
                venueId: session.activity!.venueId,
                date: session.date,
                capacity: session.capacity || session.activity!.capacity || 20,
                status: 'active'
              }
            });
            registers.push(register);
          }
        }

        logger.info('Auto-created registers', {
          activityId,
          registersCreated: registers.length,
          totalSessions: sessions.length
        });

        return registers;
      });
    } catch (error) {
      logger.error('Failed to auto-create registers:', error);
      throw error;
    }
  }
}

export const registerService = new RegisterService();
export default registerService;
