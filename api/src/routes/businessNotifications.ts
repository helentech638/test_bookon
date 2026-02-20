import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticateToken, requireRole } from '../middleware/auth';
import { safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';

const router = Router();

const normalizeChannels = (channels: unknown): string[] => {
  if (Array.isArray(channels)) {
    return channels.map(String);
  }
  if (typeof channels === 'string') {
    try {
      const parsed = JSON.parse(channels);
      if (Array.isArray(parsed)) {
        return parsed.map(String);
      }
      return [String(parsed)];
    } catch {
      return [channels];
    }
  }
  if (channels) {
    return [String(channels)];
  }
  return [];
};

router.get('/', authenticateToken, requireRole(['business', 'admin']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { status, type, limit = '50', offset = '0' } = req.query;
    const userId = req.user!.id;
    const statusValue = typeof status === 'string' ? status : undefined;
    const typeValue = typeof type === 'string' ? type : undefined;

    logger.info('Business notifications requested', {
      user: req.user?.email,
      userId,
      status,
      type,
      limit,
      offset
    });

    const userVenues = await safePrismaQuery(async (client) => {
      return await client.venue.findMany({
        where: { ownerId: userId },
        select: { id: true }
      });
    });

    const venueIds = userVenues.map(v => v.id);

    const notifications = await safePrismaQuery(async (client) => {
      return await (client as any).notification.findMany({
        where: {
          OR: [
            { userId: userId },
            { venueId: { in: venueIds } }
          ],
          ...(statusValue ? { status: statusValue } : {}),
          ...(typeValue ? { type: typeValue } : {})
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: parseInt(limit as string),
        skip: parseInt(offset as string)
      });
    });

    const transformedNotifications = (notifications as any[]).map(notification => {
      const channels = normalizeChannels(notification.channels);
      return {
        id: notification.id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        channel: channels[0] || 'in_app',
        status: notification.status,
        targetAudience: notification.venueId ? 'venue_staff' : 'customers',
        scheduledAt: notification.sentAt ? notification.sentAt.toISOString() : null,
        sentAt: notification.sentAt ? notification.sentAt.toISOString() : null,
        readCount: notification.read ? 1 : 0,
        totalRecipients: 1,
        createdAt: notification.createdAt.toISOString(),
        updatedAt: notification.updatedAt.toISOString(),
        user: notification.user
      };
    });

    logger.info('Business notifications retrieved', {
      count: transformedNotifications.length
    });

    res.json({
      success: true,
      data: transformedNotifications
    });
  } catch (error) {
    logger.error('Error fetching business notifications:', error);
    throw new AppError('Failed to fetch notifications', 500, 'BUSINESS_NOTIFICATIONS_FETCH_ERROR');
  }
}));

router.post('/', authenticateToken, requireRole(['business', 'admin']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { title, message, type, channel, targetAudience, scheduledAt, venueId } = req.body;

    logger.info('Creating business notification', {
      user: req.user?.email,
      userId,
      title,
      type,
      channel,
      targetAudience
    });

    if (!title || !message || !type) {
      throw new AppError('Title, message, and type are required', 400, 'MISSING_FIELDS');
    }

    let targetUserIds: string[] = [];

    if (targetAudience === 'venue_staff' && venueId) {
      const venueStaff = await safePrismaQuery(async (client) => {
        return await client.user.findMany({
          where: {
            OR: [
              { role: 'admin' },
              { role: 'coordinator' },
              { role: 'staff' }
            ],
            venues: {
              some: { id: venueId }
            }
          },
          select: { id: true }
        });
      });
      targetUserIds = venueStaff.map(u => u.id);
    } else if (targetAudience === 'customers') {
      const userVenues = await safePrismaQuery(async (client) => {
        return await client.venue.findMany({
          where: { ownerId: userId },
          select: { id: true }
        });
      });

      const venueIds = userVenues.map(v => v.id);

      const customers = await safePrismaQuery(async (client) => {
        return await client.user.findMany({
          where: {
            bookings: {
              some: {
                activity: {
                  venueId: { in: venueIds }
                }
              }
            }
          },
          select: { id: true }
        });
      });
      targetUserIds = customers.map(u => u.id);
    } else if (targetAudience === 'all') {
      const allUsers = await safePrismaQuery(async (client) => {
        return await client.user.findMany({
          select: { id: true }
        });
      });
      targetUserIds = allUsers.map(u => u.id);
    }

    const notifications = await safePrismaQuery(async (client) => {
      return await (client as any).notification.createMany({
        data: targetUserIds.map(targetUserId => ({
          userId: targetUserId,
          venueId: venueId || null,
          type,
          title,
          message,
          channels: JSON.stringify([channel]),
          status: scheduledAt ? 'scheduled' : 'pending',
          sentAt: scheduledAt ? new Date(scheduledAt) : null
        }))
      });
    });

    logger.info('Business notification created', {
      notificationCount: notifications.count,
      targetUserCount: targetUserIds.length
    });

    res.status(201).json({
      success: true,
      message: 'Notification created successfully',
      data: {
        notificationCount: notifications.count,
        targetUserCount: targetUserIds.length
      }
    });
  } catch (error) {
    logger.error('Error creating business notification:', error);
    throw new AppError('Failed to create notification', 500, 'BUSINESS_NOTIFICATION_CREATE_ERROR');
  }
}));

router.put('/:id', authenticateToken, requireRole(['business', 'admin']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user!.id;

    logger.info('Updating notification status', {
      user: req.user?.email,
      userId,
      notificationId: id,
      status
    });

    const userVenues = await safePrismaQuery(async (client) => {
      return await (client as any).venue.findMany({
        where: { ownerId: userId },
        select: { id: true }
      });
    });

    const venueIds = (userVenues as { id: string }[]).map(v => v.id);

    const notification = await safePrismaQuery(async (client) => {
      return await (client as any).notification.findFirst({
        where: {
          id,
          OR: [
            { userId },
            { venueId: { in: venueIds } }
          ]
        }
      });
    });

    if (!notification) {
      throw new AppError('Notification not found or access denied', 404, 'NOTIFICATION_NOT_FOUND');
    }

    const updatedNotification = await safePrismaQuery(async (client) => {
      return await (client as any).notification.update({
        where: { id },
        data: {
          status,
          ...(status === 'sent' ? { sentAt: new Date() } : {})
        }
      });
    });

    logger.info('Notification status updated', {
      notificationId: id,
      status
    });

    res.json({
      success: true,
      message: 'Notification status updated successfully',
      data: updatedNotification
    });
  } catch (error) {
    logger.error('Error updating notification status:', error);
    throw new AppError('Failed to update notification status', 500, 'NOTIFICATION_UPDATE_ERROR');
  }
}));

router.delete('/:id', authenticateToken, requireRole(['business', 'admin']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    logger.info('Deleting notification', {
      user: req.user?.email,
      userId,
      notificationId: id
    });

    const userVenues = await safePrismaQuery(async (client) => {
      return await (client as any).venue.findMany({
        where: { ownerId: userId },
        select: { id: true }
      });
    });

    const venueIds = (userVenues as { id: string }[]).map(v => v.id);

    const notification = await safePrismaQuery(async (client) => {
      return await (client as any).notification.findFirst({
        where: {
          id,
          OR: [
            { userId },
            { venueId: { in: venueIds } }
          ]
        }
      });
    });

    if (!notification) {
      throw new AppError('Notification not found or access denied', 404, 'NOTIFICATION_NOT_FOUND');
    }

    await safePrismaQuery(async (client) => {
      return await (client as any).notification.delete({
        where: { id }
      });
    });

    logger.info('Notification deleted', {
      notificationId: id
    });

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting notification:', error);
    throw new AppError('Failed to delete notification', 500, 'NOTIFICATION_DELETE_ERROR');
  }
}));

router.get('/templates', authenticateToken, requireRole(['business', 'admin']), asyncHandler(async (_req: Request, res: Response) => {
  try {
    const templates = [
      {
        id: 'booking_confirmation',
        name: 'Booking Confirmation',
        subject: 'Booking Confirmed - {{activity_name}}',
        content: 'Your booking for {{activity_name}} on {{date}} at {{time}} has been confirmed. Please arrive 10 minutes early.',
        type: 'booking_confirmation',
        isDefault: true
      },
      {
        id: 'booking_reminder',
        name: 'Booking Reminder',
        subject: 'Reminder: {{activity_name}} Tomorrow',
        content: 'This is a friendly reminder that you have {{activity_name}} scheduled for tomorrow at {{time}}. See you there!',
        type: 'booking_reminder',
        isDefault: true
      },
      {
        id: 'cancellation',
        name: 'Cancellation Notice',
        subject: 'Booking Cancelled - {{activity_name}}',
        content: 'Your booking for {{activity_name}} on {{date}} has been cancelled. If you have any questions, please contact us.',
        type: 'cancellation',
        isDefault: true
      },
      {
        id: 'payment_confirmation',
        name: 'Payment Confirmation',
        subject: 'Payment Received - {{activity_name}}',
        content: 'Thank you! We have received your payment of £{{amount}} for {{activity_name}}. Your booking is confirmed.',
        type: 'payment_confirmation',
        isDefault: true
      },
      {
        id: 'venue_announcement',
        name: 'Venue Announcement',
        subject: 'Important Update - {{venue_name}}',
        content: 'We have an important update regarding {{venue_name}}. {{message}}',
        type: 'venue_announcement',
        isDefault: true
      }
    ];

    logger.info('Business notification templates retrieved', {
      count: templates.length
    });

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    logger.error('Error fetching notification templates:', error);
    throw new AppError('Failed to fetch notification templates', 500, 'TEMPLATES_FETCH_ERROR');
  }
}));

router.get('/settings', authenticateToken, requireRole(['business', 'admin']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    logger.info('Business notification settings requested', {
      user: req.user?.email,
      userId
    });

    const user = await safePrismaQuery(async (client) => {
      return await (client as any).user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          notificationPreferences: true
        }
      });
    });

    const defaultSettings = {
      emailNotifications: true,
      smsNotifications: true,
      pushNotifications: true,
      marketingEmails: false,
      bookingConfirmations: true,
      bookingReminders: true,
      paymentNotifications: true,
      cancellationNotifications: true
    };

    let settings = defaultSettings;
    if (user?.notificationPreferences) {
      try {
        const rawPreferences = user.notificationPreferences as unknown;
        const parsedPreferences = typeof rawPreferences === 'string'
          ? JSON.parse(rawPreferences)
          : rawPreferences;
        settings = { ...defaultSettings, ...(parsedPreferences as Record<string, boolean>) };
      } catch (parseError) {
        logger.warn('Failed to parse user notification preferences', { userId, parseError });
      }
    }

    logger.info('Business notification settings retrieved', {
      userId
    });

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    logger.error('Error fetching notification settings:', error);
    throw new AppError('Failed to fetch notification settings', 500, 'SETTINGS_FETCH_ERROR');
  }
}));

router.put('/settings', authenticateToken, requireRole(['business', 'admin']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const settings = req.body;

    logger.info('Updating business notification settings', {
      user: req.user?.email,
      userId,
      settings
    });

    await safePrismaQuery(async (client) => {
      return await (client as any).user.update({
        where: { id: userId },
        data: {
          notificationPreferences: JSON.stringify(settings)
        }
      });
    });

    logger.info('Business notification settings updated', {
      userId
    });

    res.json({
      success: true,
      message: 'Notification settings updated successfully',
      data: settings
    });
  } catch (error) {
    logger.error('Error updating notification settings:', error);
    throw new AppError('Failed to update notification settings', 500, 'SETTINGS_UPDATE_ERROR');
  }
}));

export default router;
