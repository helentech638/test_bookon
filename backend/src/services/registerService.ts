import { safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';

interface AttendanceRecord {
  childId: string;
  bookingId?: string;
  present: boolean;
  checkInTime?: Date;
  checkOutTime?: Date;
  notes?: string;
}

class RegisterService {
  async createRegister(sessionId: string, notes?: string) {
    try {
      return await safePrismaQuery(async (client) => {
        // Get session details
        const session = await client.session.findUnique({
          where: { id: sessionId },
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

        if (!session) {
          throw new Error('Session not found');
        }

        // Create register
        const register = await client.register.create({
          data: {
            sessionId: session.id,
            date: session.date,
            notes: notes || null,
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
          activityId: session.activityId,
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
                    yearGroup: true,
                    school: true,
                    class: true,
                    allergies: true,
                    medicalInfo: true,
                    permissions: {
                      select: {
                        consentToWalkHome: true,
                        consentToPhotography: true,
                        consentToFirstAid: true,
                        consentToEmergencyContact: true
                      }
                    }
                  }
                },
                booking: {
                  select: {
                    id: true,
                    hasEarlyDropoff: true,
                    earlyDropoffAmount: true,
                    hasLatePickup: true,
                    latePickupAmount: true,
                    parent: {
                      select: {
                        id: true,
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
        const where: any = {
          session: {
            activityId: activityId
          }
        };
        
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
                    dateOfBirth: true
                  }
                },
                booking: {
                  include: {
                    parent: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        phone: true
                      }
                    }
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
                    title: true
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
          where: { registerId: registerId }
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
                checkInTime: record.checkInTime || null,
                checkOutTime: record.checkOutTime || null,
                notes: record.notes || null
              }
            });
            results.push(updated);
          } else {
            // Create new record
            const created = await client.attendance.create({
              data: {
                registerId: registerId,
                childId: record.childId,
                bookingId: record.bookingId || '', // This might need to be handled differently
                present: record.present,
                checkInTime: record.checkInTime || null,
                checkOutTime: record.checkOutTime || null,
                notes: record.notes || null
              }
            });
            results.push(created);
          }
        }

        // Update register statistics
        const presentCount = results.filter(r => r.present).length;
        const totalCount = results.length;

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
            session: {
              include: {
                activity: {
                  select: {
                    title: true
                  }
                }
              }
            },
            attendance: true
          }
        });

        if (!register) return null;

        const totalAttendance = register.attendance.length;
        const presentCount = register.attendance.filter(a => a.present).length;
        const absentCount = totalAttendance - presentCount;

        return {
          totalAttendance,
          presentCount,
          absentCount,
          attendanceRate: totalAttendance > 0 ? (presentCount / totalAttendance) * 100 : 0,
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
            session: {
              activityId: activityId
            },
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
            attendance: true
          },
          orderBy: { date: 'asc' }
        });

        const totalAttendance = registers.reduce((sum, r) => sum + r.attendance.length, 0);
        const totalPresent = registers.reduce((sum, r) => sum + r.attendance.filter(a => a.present).length, 0);

        const report = {
          activityId,
          dateFrom,
          dateTo,
          totalSessions: registers.length,
          totalAttendance,
          totalPresent,
          averageAttendance: registers.length > 0 ? totalAttendance / registers.length : 0,
          sessions: registers.map(register => ({
            date: register.date,
            presentCount: register.attendance.filter(a => a.present).length,
            totalCount: register.attendance.length,
            attendanceRate: register.attendance.length > 0 
              ? (register.attendance.filter(a => a.present).length / register.attendance.length) * 100 
              : 0,
            children: register.attendance.map(attendance => ({
              childId: attendance.childId,
              present: attendance.present,
              checkInTime: attendance.checkInTime,
              checkOutTime: attendance.checkOutTime,
              notes: attendance.notes
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
        // TODO: Implement attendance deletion

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
            activityId: activityId,
            date: {
              gte: startDate,
              lte: endDate
            }
          },
          select: {
            id: true,
            activityId: true,
            date: true
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
                date: session.date,
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
