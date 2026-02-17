// @ts-nocheck
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

export interface AuditEvent {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  userId: string;
  userRole: string;
  timestamp: Date;
  changes: Record<string, any>;
  metadata: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditReport {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByUser: Record<string, number>;
  eventsByAction: Record<string, number>;
  recentEvents: AuditEvent[];
  summary: {
    period: string;
    startDate: Date;
    endDate: Date;
    totalRefunds: number;
    totalCredits: number;
    totalTFCBookings: number;
    totalCancellations: number;
  };
}

export interface FinancialReport {
  period: string;
  startDate: Date;
  endDate: Date;
  revenue: {
    total: number;
    card: number;
    tfc: number;
    credit: number;
  };
  refunds: {
    total: number;
    cash: number;
    credit: number;
    adminFees: number;
  };
  credits: {
    issued: number;
    used: number;
    expired: number;
    outstanding: number;
  };
  tfc: {
    bookings: number;
    pending: number;
    confirmed: number;
    cancelled: number;
    totalValue: number;
  };
}

class AuditService {
  /**
   * Log an audit event
   */
  async logEvent(
    entityType: string,
    entityId: string,
    action: string,
    userId: string,
    userRole: string,
    changes: Record<string, any> = {},
    metadata: Record<string, any> = {},
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          entityType,
          entityId,
          action,
          userId,
          userRole,
          changes,
          metadata,
          ipAddress,
          userAgent,
          timestamp: new Date()
        }
      });

      logger.info('Audit event logged', {
        entityType,
        entityId,
        action,
        userId,
        userRole
      });
    } catch (error) {
      logger.error('Error logging audit event:', error);
      // Don't throw error to avoid breaking the main operation
    }
  }

  /**
   * Get audit events for an entity
   */
  async getEntityAuditHistory(
    entityType: string,
    entityId: string,
    limit: number = 50
  ): Promise<AuditEvent[]> {
    try {
      const events = await prisma.auditLog.findMany({
        where: {
          entityType,
          entityId
        },
        orderBy: { timestamp: 'desc' },
        take: limit
      });

      return events.map(event => ({
        id: event.id,
        entityType: event.entityType,
        entityId: event.entityId,
        action: event.action,
        userId: event.userId,
        userRole: event.userRole,
        timestamp: event.timestamp,
        changes: event.changes as Record<string, any>,
        metadata: event.metadata as Record<string, any>,
        ipAddress: event.ipAddress || undefined,
        userAgent: event.userAgent || undefined
      }));
    } catch (error) {
      logger.error('Error getting entity audit history:', error);
      throw error;
    }
  }

  /**
   * Get audit report for a period
   */
  async getAuditReport(
    startDate: Date,
    endDate: Date,
    entityType?: string,
    userId?: string
  ): Promise<AuditReport> {
    try {
      const whereClause: any = {
        timestamp: {
          gte: startDate,
          lte: endDate
        }
      };

      if (entityType) {
        whereClause.entityType = entityType;
      }

      if (userId) {
        whereClause.userId = userId;
      }

      const events = await prisma.auditLog.findMany({
        where: whereClause,
        orderBy: { timestamp: 'desc' }
      });

      // Calculate statistics
      const eventsByType: Record<string, number> = {};
      const eventsByUser: Record<string, number> = {};
      const eventsByAction: Record<string, number> = {};

      events.forEach(event => {
        eventsByType[event.entityType] = (eventsByType[event.entityType] || 0) + 1;
        eventsByUser[event.userId] = (eventsByUser[event.userId] || 0) + 1;
        eventsByAction[event.action] = (eventsByAction[event.action] || 0) + 1;
      });

      // Get financial summary
      const refunds = await prisma.refundTransaction.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      const credits = await prisma.walletCredit.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      const tfcBookings = await prisma.booking.findMany({
        where: {
          paymentMethod: 'tfc',
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      const cancellations = await prisma.booking.findMany({
        where: {
          status: 'cancelled',
          updatedAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      return {
        totalEvents: events.length,
        eventsByType,
        eventsByUser,
        eventsByAction,
        recentEvents: events.slice(0, 20).map(event => ({
          id: event.id,
          entityType: event.entityType,
          entityId: event.entityId,
          action: event.action,
          userId: event.userId,
          userRole: event.userRole,
          timestamp: event.timestamp,
          changes: event.changes as Record<string, any>,
          metadata: event.metadata as Record<string, any>,
          ipAddress: event.ipAddress || undefined,
          userAgent: event.userAgent || undefined
        })),
        summary: {
          period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
          startDate,
          endDate,
          totalRefunds: refunds.length,
          totalCredits: credits.length,
          totalTFCBookings: tfcBookings.length,
          totalCancellations: cancellations.length
        }
      };
    } catch (error) {
      logger.error('Error getting audit report:', error);
      throw error;
    }
  }

  /**
   * Get financial report for a period
   */
  async getFinancialReport(
    startDate: Date,
    endDate: Date,
    venueId?: string
  ): Promise<FinancialReport> {
    try {
      const whereClause: any = {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      };

      if (venueId) {
        whereClause.activity = {
          venueId: venueId
        };
      }

      // Get bookings data
      const bookings = await prisma.booking.findMany({
        where: whereClause,
        include: {
          activity: {
            include: {
              venue: true
            }
          }
        }
      });

      // Get refunds data
      const refunds = await prisma.refundTransaction.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        include: {
          booking: {
            include: {
              activity: true
            }
          }
        }
      });

      // Get credits data
      const credits = await prisma.walletCredit.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      // Calculate revenue
      const revenue = {
        total: bookings.reduce((sum, b) => sum + Number(b.amount), 0),
        card: bookings.filter(b => b.paymentMethod === 'card').reduce((sum, b) => sum + Number(b.amount), 0),
        tfc: bookings.filter(b => b.paymentMethod === 'tfc').reduce((sum, b) => sum + Number(b.amount), 0),
        credit: bookings.filter(b => b.paymentMethod === 'credit').reduce((sum, b) => sum + Number(b.amount), 0)
      };

      // Calculate refunds
      const refundsData = {
        total: refunds.reduce((sum, r) => sum + Number(r.amount), 0),
        cash: refunds.filter(r => r.method === 'card').reduce((sum, r) => sum + Number(r.amount), 0),
        credit: refunds.filter(r => r.method === 'credit').reduce((sum, r) => sum + Number(r.amount), 0),
        adminFees: refunds.reduce((sum, r) => sum + Number(r.fee), 0)
      };

      // Calculate credits
      const creditsData = {
        issued: credits.reduce((sum, c) => sum + Number(c.amount), 0),
        used: credits.reduce((sum, c) => sum + Number(c.usedAmount), 0),
        expired: 0, // Would need to query expired credits
        outstanding: credits.reduce((sum, c) => sum + Number(c.amount) - Number(c.usedAmount), 0)
      };

      // Calculate TFC data
      const tfcBookings = bookings.filter(b => b.paymentMethod === 'tfc');
      const tfcData = {
        bookings: tfcBookings.length,
        pending: tfcBookings.filter(b => b.paymentStatus === 'pending_payment').length,
        confirmed: tfcBookings.filter(b => b.paymentStatus === 'paid').length,
        cancelled: tfcBookings.filter(b => b.status === 'cancelled').length,
        totalValue: tfcBookings.reduce((sum, b) => sum + Number(b.amount), 0)
      };

      return {
        period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
        startDate,
        endDate,
        revenue,
        refunds: refundsData,
        credits: creditsData,
        tfc: tfcData
      };
    } catch (error) {
      logger.error('Error getting financial report:', error);
      throw error;
    }
  }

  /**
   * Get user activity report
   */
  async getUserActivityReport(
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<{
    totalUsers: number;
    activeUsers: number;
    userActivity: Array<{
      userId: string;
      userName: string;
      userRole: string;
      totalEvents: number;
      lastActivity: Date;
      eventsByAction: Record<string, number>;
    }>;
  }> {
    try {
      const whereClause: any = {
        timestamp: {
          gte: startDate,
          lte: endDate
        }
      };

      if (userId) {
        whereClause.userId = userId;
      }

      const events = await prisma.auditLog.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              role: true
            }
          }
        },
        orderBy: { timestamp: 'desc' }
      });

      // Group by user
      const userActivityMap = new Map<string, {
        userId: string;
        userName: string;
        userRole: string;
        totalEvents: number;
        lastActivity: Date;
        eventsByAction: Record<string, number>;
      }>();

      events.forEach(event => {
        const userId = event.userId;
        const userName = `${event.user.firstName} ${event.user.lastName}`;
        const userRole = event.user.role;

        if (!userActivityMap.has(userId)) {
          userActivityMap.set(userId, {
            userId,
            userName,
            userRole,
            totalEvents: 0,
            lastActivity: event.timestamp,
            eventsByAction: {}
          });
        }

        const userActivity = userActivityMap.get(userId)!;
        userActivity.totalEvents++;
        userActivity.eventsByAction[event.action] = (userActivity.eventsByAction[event.action] || 0) + 1;
        
        if (event.timestamp > userActivity.lastActivity) {
          userActivity.lastActivity = event.timestamp;
        }
      });

      const userActivity = Array.from(userActivityMap.values());

      return {
        totalUsers: userActivity.length,
        activeUsers: userActivity.filter(u => u.totalEvents > 0).length,
        userActivity
      };
    } catch (error) {
      logger.error('Error getting user activity report:', error);
      throw error;
    }
  }

  /**
   * Export audit data to CSV
   */
  async exportAuditData(
    startDate: Date,
    endDate: Date,
    entityType?: string,
    userId?: string
  ): Promise<string> {
    try {
      const whereClause: any = {
        timestamp: {
          gte: startDate,
          lte: endDate
        }
      };

      if (entityType) {
        whereClause.entityType = entityType;
      }

      if (userId) {
        whereClause.userId = userId;
      }

      const events = await prisma.auditLog.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              role: true
            }
          }
        },
        orderBy: { timestamp: 'desc' }
      });

      // Generate CSV
      const headers = [
        'Timestamp',
        'Entity Type',
        'Entity ID',
        'Action',
        'User ID',
        'User Name',
        'User Email',
        'User Role',
        'IP Address',
        'User Agent',
        'Changes',
        'Metadata'
      ];

      const rows = events.map(event => [
        event.timestamp.toISOString(),
        event.entityType,
        event.entityId,
        event.action,
        event.userId,
        `${event.user.firstName} ${event.user.lastName}`,
        event.user.email,
        event.user.role,
        event.ipAddress || '',
        event.userAgent || '',
        JSON.stringify(event.changes),
        JSON.stringify(event.metadata)
      ]);

      const csvContent = [headers, ...rows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      return csvContent;
    } catch (error) {
      logger.error('Error exporting audit data:', error);
      throw error;
    }
  }
}

export const auditService = new AuditService();

