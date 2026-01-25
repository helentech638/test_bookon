import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { AppError } from '../middleware/errorHandler';
import { ProviderNotificationService } from '../services/providerNotificationService';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Get provider notification preferences
 */
router.get('/preferences', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;

    if (userRole !== 'admin' && userRole !== 'staff' && userRole !== 'business') {
      throw new AppError('Provider access required', 403, 'PROVIDER_REQUIRED');
    }

    const preferences = await ProviderNotificationService.getProviderNotificationPreferences(userId);

    res.json({
      success: true,
      data: preferences
    });
  } catch (error) {
    logger.error('Error getting provider notification preferences:', error);
    throw error;
  }
}));

/**
 * Update provider notification preferences
 */
router.put('/preferences', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { emailNotifications, inAppNotifications, smsNotifications, notificationTypes } = req.body;

    if (userRole !== 'admin' && userRole !== 'staff' && userRole !== 'business') {
      throw new AppError('Provider access required', 403, 'PROVIDER_REQUIRED');
    }

    const preferences = {
      emailNotifications,
      inAppNotifications,
      smsNotifications,
      notificationTypes
    };

    await ProviderNotificationService.updateProviderNotificationPreferences(userId, preferences);

    res.json({
      success: true,
      message: 'Notification preferences updated successfully',
      data: preferences
    });
  } catch (error) {
    logger.error('Error updating provider notification preferences:', error);
    throw error;
  }
}));

/**
 * Test provider notification (admin only)
 */
router.post('/test', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { providerId, notificationType, testData } = req.body;

    if (userRole !== 'admin' && userRole !== 'staff') {
      throw new AppError('Admin access required', 403, 'ADMIN_REQUIRED');
    }

    if (!providerId || !notificationType) {
      throw new AppError('Provider ID and notification type are required', 400, 'MISSING_FIELDS');
    }

    // Send test notification based on type
    switch (notificationType) {
      case 'new_booking':
        await ProviderNotificationService.sendNewBookingNotification({
          providerId,
          venueId: testData?.venueId,
          bookingId: testData?.bookingId || 'test-booking-123',
          parentId: testData?.parentId || 'test-parent-123',
          childId: testData?.childId || 'test-child-123',
          activityId: testData?.activityId || 'test-activity-123',
          amount: testData?.amount || 50.00,
          bookingDate: new Date(),
          bookingTime: testData?.bookingTime || '10:00',
          activityName: testData?.activityName || 'Test Activity',
          childName: testData?.childName || 'Test Child',
          parentName: testData?.parentName || 'Test Parent',
          parentEmail: testData?.parentEmail || 'test@example.com',
          venueName: testData?.venueName || 'Test Venue',
          notificationType: 'new_booking'
        });
        break;

      case 'booking_cancelled':
        await ProviderNotificationService.sendBookingCancellationNotification(
          providerId,
          testData?.bookingId || 'test-booking-123',
          {
            childName: testData?.childName || 'Test Child',
            parentName: testData?.parentName || 'Test Parent',
            activityName: testData?.activityName || 'Test Activity',
            cancellationReason: testData?.cancellationReason || 'Test cancellation',
            refundAmount: testData?.refundAmount || 48.00,
            creditAmount: testData?.creditAmount || 0,
            venueName: testData?.venueName || 'Test Venue'
          }
        );
        break;

      case 'payment_received':
        await ProviderNotificationService.sendPaymentReceivedNotification(
          providerId,
          {
            bookingId: testData?.bookingId || 'test-booking-123',
            amount: testData?.amount || 50.00,
            paymentMethod: testData?.paymentMethod || 'card',
            childName: testData?.childName || 'Test Child',
            parentName: testData?.parentName || 'Test Parent',
            activityName: testData?.activityName || 'Test Activity',
            venueName: testData?.venueName || 'Test Venue'
          }
        );
        break;

      case 'booking_modified':
        await ProviderNotificationService.sendBookingModificationNotification(
          providerId,
          testData?.bookingId || 'test-booking-123',
          {
            childName: testData?.childName || 'Test Child',
            parentName: testData?.parentName || 'Test Parent',
            activityName: testData?.activityName || 'Test Activity',
            changes: testData?.changes || ['Time changed', 'Date changed'],
            venueName: testData?.venueName || 'Test Venue'
          }
        );
        break;

      default:
        throw new AppError('Invalid notification type', 400, 'INVALID_NOTIFICATION_TYPE');
    }

    res.json({
      success: true,
      message: `Test ${notificationType} notification sent successfully`
    });
  } catch (error) {
    logger.error('Error sending test provider notification:', error);
    throw error;
  }
}));

export default router;



