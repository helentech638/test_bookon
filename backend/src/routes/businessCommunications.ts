import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import { prisma, safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';

const router = Router();

// Get business communications overview
router.get('/', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { search, type, status, page = 1, limit = 20 } = req.query;
  
  try {
    // Check if user has business access
    const userInfo = await safePrismaQuery(async (client) => {
      return await client.user.findUnique({
        where: { id: userId },
        select: { role: true, businessName: true, isActive: true }
      });
    });

    if (!userInfo || (!userInfo.businessName && userInfo.role !== 'business' && userInfo.role !== 'admin')) {
      throw new AppError('Business access required', 403, 'BUSINESS_ACCESS_REQUIRED');
    }

    // Build where clause for emails
    const where: any = {};

    if (search) {
      where.OR = [
        { subject: { contains: search as string, mode: 'insensitive' } },
        { toEmail: { contains: search as string, mode: 'insensitive' } },
        { toName: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    if (type) {
      where.channel = type;
    }

    if (status) {
      where.lastStatus = status;
    }

    // Get communications with pagination
    const skip = (Number(page) - 1) * Number(limit);
    
    const [communications, totalCount] = await safePrismaQuery(async (client) => {
      return await Promise.all([
        client.email.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            toEmail: true,
            toName: true,
            subject: true,
            messageType: true,
            channel: true,
            lastStatus: true,
            sentAt: true,
            createdAt: true,
            broadcast: {
              select: {
                id: true,
                title: true
              }
            }
          }
        }),
        client.email.count({ where })
      ]);
    });

    // Get summary statistics
    const stats = await safePrismaQuery(async (client) => {
      const [emailSent, smsSent, notificationSent, scheduled] = await Promise.all([
        client.email.count({ where: { channel: 'email', lastStatus: 'sent' } }),
        client.email.count({ where: { channel: 'sms', lastStatus: 'sent' } }),
        client.email.count({ where: { channel: 'notification', lastStatus: 'sent' } }),
        client.broadcast.count({ where: { status: 'scheduled' } })
      ]);

      return { emailSent, smsSent, notificationSent, scheduled };
    });

    res.json({
      success: true,
      data: {
        communications,
        stats,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / Number(limit))
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching business communications:', error);
    throw new AppError('Failed to fetch communications', 500, 'COMMUNICATIONS_FETCH_ERROR');
  }
}));

// Get automated emails
router.get('/automated', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { search, trigger, status, page = 1, limit = 20 } = req.query;
  
  try {
    // Check if user has business access
    const userInfo = await safePrismaQuery(async (client) => {
      return await client.user.findUnique({
        where: { id: userId },
        select: { role: true, businessName: true, isActive: true }
      });
    });

    if (!userInfo || (!userInfo.businessName && userInfo.role !== 'business' && userInfo.role !== 'admin')) {
      throw new AppError('Business access required', 403, 'BUSINESS_ACCESS_REQUIRED');
    }

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { subjectTemplate: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    if (trigger) {
      where.trigger = trigger;
    }

    if (status) {
      if (status === 'active') {
        where.active = true;
      } else if (status === 'inactive') {
        where.active = false;
      }
    }

    // Get automated emails with pagination
    const skip = (Number(page) - 1) * Number(limit);
    
    const [automatedEmails, totalCount] = await safePrismaQuery(async (client) => {
      return await Promise.all([
        client.emailTemplate.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            trigger: true,
            subjectTemplate: true,
            bodyHtmlTemplate: true,
            active: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                emails: true
              }
            }
          }
        }),
        client.emailTemplate.count({ where })
      ]);
    });

    // Get summary statistics
    const stats = await safePrismaQuery(async (client) => {
      const [totalEmails, activeEmails, inactiveEmails, totalSent] = await Promise.all([
        client.emailTemplate.count(),
        client.emailTemplate.count({ where: { active: true } }),
        client.emailTemplate.count({ where: { active: false } }),
        client.email.count()
      ]);

      return { totalEmails, activeEmails, inactiveEmails, totalSent };
    });

    res.json({
      success: true,
      data: {
        automatedEmails,
        stats,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / Number(limit))
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching automated emails:', error);
    throw new AppError('Failed to fetch automated emails', 500, 'AUTOMATED_EMAILS_FETCH_ERROR');
  }
}));

// Get email logs
router.get('/logs', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { search, type, status, date, page = 1, limit = 20 } = req.query;
  
  try {
    // Check if user has business access
    const userInfo = await safePrismaQuery(async (client) => {
      return await client.user.findUnique({
        where: { id: userId },
        select: { role: true, businessName: true, isActive: true }
      });
    });

    if (!userInfo || (!userInfo.businessName && userInfo.role !== 'business' && userInfo.role !== 'admin')) {
      throw new AppError('Business access required', 403, 'BUSINESS_ACCESS_REQUIRED');
    }

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { toEmail: { contains: search as string, mode: 'insensitive' } },
        { subject: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    if (type) {
      where.channel = type;
    }

    if (status) {
      where.lastStatus = status;
    }

    // Date filter
    if (date) {
      const now = new Date();
      let startDate: Date;
      let endDate: Date = now;

      switch (date) {
        case 'today':
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'yesterday':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now);
          endDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate = new Date(now);
          startDate.setMonth(now.getMonth() - 1);
          break;
        default:
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
      }

      where.createdAt = {
        gte: startDate,
        lte: endDate
      };
    }

    // Get email logs with pagination
    const skip = (Number(page) - 1) * Number(limit);
    
    const [logs, totalCount] = await safePrismaQuery(async (client) => {
      return await Promise.all([
        client.email.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            toEmail: true,
            toName: true,
            subject: true,
            messageType: true,
            channel: true,
            lastStatus: true,
            sentAt: true,
            createdAt: true,
            events: {
              select: {
                eventType: true,
                occurredAt: true
              },
              orderBy: { occurredAt: 'desc' },
              take: 1
            }
          }
        }),
        client.email.count({ where })
      ]);
    });

    // Get summary statistics
    const stats = await safePrismaQuery(async (client) => {
      const [totalLogs, delivered, opened, failed] = await Promise.all([
        client.email.count(),
        client.email.count({ where: { lastStatus: 'delivered' } }),
        client.email.count({ where: { lastStatus: 'opened' } }),
        client.email.count({ where: { lastStatus: 'failed' } })
      ]);

      return { totalLogs, delivered, opened, failed };
    });

    res.json({
      success: true,
      data: {
        logs,
        stats,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / Number(limit))
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching email logs:', error);
    throw new AppError('Failed to fetch email logs', 500, 'EMAIL_LOGS_FETCH_ERROR');
  }
}));

// Get broadcasts for business
router.get('/broadcasts', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { search, type, status, page = 1, limit = 20 } = req.query;
  
  try {
    // Check if user has business access
    const userInfo = await safePrismaQuery(async (client) => {
      return await client.user.findUnique({
        where: { id: userId },
        select: { role: true, businessName: true, isActive: true }
      });
    });

    if (!userInfo || (!userInfo.businessName && userInfo.role !== 'business' && userInfo.role !== 'admin')) {
      throw new AppError('Business access required', 403, 'BUSINESS_ACCESS_REQUIRED');
    }

    // Build where clause
    const where: any = { createdBy: userId };

    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { subject: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    if (type) {
      where.channels = { has: type };
    }

    if (status) {
      where.status = status;
    }

    // Get broadcasts with pagination
    const skip = (Number(page) - 1) * Number(limit);
    
    const [broadcasts, totalCount] = await safePrismaQuery(async (client) => {
      return await Promise.all([
        client.broadcast.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            subject: true,
            channels: true,
            scheduledFor: true,
            sentAt: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                emails: true
              }
            }
          }
        }),
        client.broadcast.count({ where })
      ]);
    });

    // Get summary statistics
    const stats = await safePrismaQuery(async (client) => {
      const [totalBroadcasts, sentBroadcasts, scheduledBroadcasts, drafts] = await Promise.all([
        client.broadcast.count({ where: { createdBy: userId } }),
        client.broadcast.count({ where: { createdBy: userId, status: 'sent' } }),
        client.broadcast.count({ where: { createdBy: userId, status: 'scheduled' } }),
        client.broadcast.count({ where: { createdBy: userId, status: 'draft' } })
      ]);

      return { totalBroadcasts, sentBroadcasts, scheduledBroadcasts, drafts };
    });

    res.json({
      success: true,
      data: {
        broadcasts,
        stats,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / Number(limit))
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching broadcasts:', error);
    throw new AppError('Failed to fetch broadcasts', 500, 'BROADCASTS_FETCH_ERROR');
  }
}));

// Create broadcast
router.post('/broadcasts', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const {
    title,
    subject,
    bodyHtml,
    bodyText,
    audienceQuery,
    channels,
    scheduledFor
  } = req.body;

  try {
    // Check if user has business access
    const userInfo = await safePrismaQuery(async (client) => {
      return await client.user.findUnique({
        where: { id: userId },
        select: { role: true, businessName: true, isActive: true }
      });
    });

    if (!userInfo || (!userInfo.businessName && userInfo.role !== 'business' && userInfo.role !== 'admin')) {
      throw new AppError('Business access required', 403, 'BUSINESS_ACCESS_REQUIRED');
    }

    const broadcast = await safePrismaQuery(async (client) => {
      return await client.broadcast.create({
        data: {
          title,
          subject,
          bodyHtml,
          bodyText,
          audienceQuery: audienceQuery || { type: 'all' },
          channels: channels || ['email'],
          scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
          status: scheduledFor ? 'scheduled' : 'draft',
          createdBy: userId
        },
        include: {
          creator: {
            select: { firstName: true, lastName: true, email: true }
          }
        }
      });
    });

    logger.info('Broadcast created', {
      broadcastId: broadcast.id,
      title: broadcast.title,
      createdBy: userId
    });

    res.status(201).json({
      success: true,
      message: 'Broadcast created successfully',
      data: broadcast
    });
  } catch (error) {
    logger.error('Error creating broadcast:', error);
    throw new AppError('Failed to create broadcast', 500, 'BROADCAST_CREATE_ERROR');
  }
}));

export default router;
