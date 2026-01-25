import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock external dependencies
jest.mock('../utils/database');
jest.mock('../utils/prisma');
jest.mock('../services/emailService');

describe('Provider Notification System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ProviderNotificationService', () => {
    describe('sendNewBookingNotification', () => {
      it('should send new booking notification to provider', async () => {
        const mockProvider = {
          id: 'provider-1',
          email: 'provider@test.com',
          firstName: 'John',
          lastName: 'Provider',
          businessName: 'Test Business'
        };

        const mockVenue = {
          id: 'venue-1',
          name: 'Test Venue'
        };

        // Mock prisma calls
        const mockPrisma = {
          user: {
            findUnique: jest.fn().mockResolvedValue(mockProvider)
          },
          venue: {
            findUnique: jest.fn().mockResolvedValue(mockVenue)
          }
        };

        // Mock database calls
        const mockDb = jest.fn().mockImplementation(() => ({
          insert: jest.fn().mockResolvedValue(1)
        }));

        // Mock email service
        const mockEmailService = {
          sendTemplateEmail: jest.fn().mockResolvedValue('email-sent')
        };

        // Set up mocks
        jest.doMock('../utils/prisma', () => ({ prisma: mockPrisma }));
        jest.doMock('../utils/database', () => ({ db: mockDb }));
        jest.doMock('../services/emailService', () => ({ emailService: mockEmailService }));

        const { ProviderNotificationService } = await import('../services/providerNotificationService');

        const notificationData = {
          providerId: 'provider-1',
          venueId: 'venue-1',
          bookingId: 'booking-123',
          parentId: 'parent-456',
          childId: 'child-789',
          activityId: 'activity-101',
          amount: 50.00,
          bookingDate: new Date(),
          bookingTime: '10:00',
          activityName: 'Swimming Lesson',
          childName: 'Alice Smith',
          parentName: 'John Smith',
          parentEmail: 'john@example.com',
          venueName: 'Test Venue',
          notificationType: 'new_booking' as const
        };

        await ProviderNotificationService.sendNewBookingNotification(notificationData);

        // Verify provider was found
        expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
          where: { id: 'provider-1' },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            businessName: true
          }
        });

        // Verify email was sent
        expect(mockEmailService.sendTemplateEmail).toHaveBeenCalledWith({
          to: 'provider@test.com',
          toName: 'John Provider',
          template: 'provider_new_booking',
          subject: 'New Booking Received - Swimming Lesson',
          data: expect.objectContaining({
            providerName: 'John Provider',
            businessName: 'Test Business',
            activityName: 'Swimming Lesson',
            childName: 'Alice Smith',
            parentName: 'John Smith',
            parentEmail: 'john@example.com',
            amount: 50.00,
            bookingId: 'booking-123'
          })
        });

        // Verify in-app notification was created
        expect(mockDb).toHaveBeenCalledWith('notifications');
      });
    });

    describe('sendBookingCancellationNotification', () => {
      it('should send booking cancellation notification to provider', async () => {
        const mockProvider = {
          id: 'provider-1',
          email: 'provider@test.com',
          firstName: 'John',
          lastName: 'Provider',
          businessName: 'Test Business'
        };

        const mockPrisma = {
          user: {
            findUnique: jest.fn().mockResolvedValue(mockProvider)
          }
        };

        const mockDb = jest.fn().mockImplementation(() => ({
          insert: jest.fn().mockResolvedValue(1)
        }));

        const mockEmailService = {
          sendTemplateEmail: jest.fn().mockResolvedValue('email-sent')
        };

        jest.doMock('../utils/prisma', () => ({ prisma: mockPrisma }));
        jest.doMock('../utils/database', () => ({ db: mockDb }));
        jest.doMock('../services/emailService', () => ({ emailService: mockEmailService }));

        const { ProviderNotificationService } = await import('../services/providerNotificationService');

        const cancellationData = {
          childName: 'Alice Smith',
          parentName: 'John Smith',
          activityName: 'Swimming Lesson',
          cancellationReason: 'Change of plans',
          refundAmount: 48.00,
          creditAmount: 0,
          venueName: 'Test Venue'
        };

        await ProviderNotificationService.sendBookingCancellationNotification(
          'provider-1',
          'booking-123',
          cancellationData
        );

        // Verify email was sent
        expect(mockEmailService.sendTemplateEmail).toHaveBeenCalledWith({
          to: 'provider@test.com',
          toName: 'John Provider',
          template: 'provider_booking_cancelled',
          subject: 'Booking Cancelled - Swimming Lesson',
          data: expect.objectContaining({
            providerName: 'John Provider',
            businessName: 'Test Business',
            activityName: 'Swimming Lesson',
            childName: 'Alice Smith',
            parentName: 'John Smith',
            cancellationReason: 'Change of plans',
            refundAmount: 48.00,
            creditAmount: 0
          })
        });
      });
    });

    describe('sendPaymentReceivedNotification', () => {
      it('should send payment received notification to provider', async () => {
        const mockProvider = {
          id: 'provider-1',
          email: 'provider@test.com',
          firstName: 'John',
          lastName: 'Provider',
          businessName: 'Test Business'
        };

        const mockPrisma = {
          user: {
            findUnique: jest.fn().mockResolvedValue(mockProvider)
          }
        };

        const mockDb = jest.fn().mockImplementation(() => ({
          insert: jest.fn().mockResolvedValue(1)
        }));

        const mockEmailService = {
          sendTemplateEmail: jest.fn().mockResolvedValue('email-sent')
        };

        jest.doMock('../utils/prisma', () => ({ prisma: mockPrisma }));
        jest.doMock('../utils/database', () => ({ db: mockDb }));
        jest.doMock('../services/emailService', () => ({ emailService: mockEmailService }));

        const { ProviderNotificationService } = await import('../services/providerNotificationService');

        const paymentData = {
          bookingId: 'booking-123',
          amount: 50.00,
          paymentMethod: 'card',
          childName: 'Alice Smith',
          parentName: 'John Smith',
          activityName: 'Swimming Lesson',
          venueName: 'Test Venue'
        };

        await ProviderNotificationService.sendPaymentReceivedNotification(
          'provider-1',
          paymentData
        );

        // Verify email was sent
        expect(mockEmailService.sendTemplateEmail).toHaveBeenCalledWith({
          to: 'provider@test.com',
          toName: 'John Provider',
          template: 'provider_payment_received',
          subject: 'Payment Received - £50.00',
          data: expect.objectContaining({
            providerName: 'John Provider',
            businessName: 'Test Business',
            activityName: 'Swimming Lesson',
            childName: 'Alice Smith',
            parentName: 'John Smith',
            amount: 50.00,
            paymentMethod: 'card'
          })
        });
      });
    });

    describe('getProviderNotificationPreferences', () => {
      it('should return default preferences when none are set', async () => {
        const mockPrisma = {
          user: {
            findUnique: jest.fn().mockResolvedValue({ notificationPreferences: null })
          }
        };

        jest.doMock('../utils/prisma', () => ({ prisma: mockPrisma }));

        const { ProviderNotificationService } = await import('../services/providerNotificationService');

        const preferences = await ProviderNotificationService.getProviderNotificationPreferences('provider-1');

        expect(preferences).toEqual({
          emailNotifications: true,
          inAppNotifications: true,
          smsNotifications: false,
          notificationTypes: ['new_booking', 'booking_cancelled', 'payment_received', 'booking_modified']
        });
      });

      it('should return custom preferences when set', async () => {
        const customPreferences = {
          emailNotifications: false,
          inAppNotifications: true,
          smsNotifications: true,
          notificationTypes: ['new_booking', 'payment_received']
        };

        const mockPrisma = {
          user: {
            findUnique: jest.fn().mockResolvedValue({ notificationPreferences: customPreferences })
          }
        };

        jest.doMock('../utils/prisma', () => ({ prisma: mockPrisma }));

        const { ProviderNotificationService } = await import('../services/providerNotificationService');

        const preferences = await ProviderNotificationService.getProviderNotificationPreferences('provider-1');

        expect(preferences).toEqual({
          emailNotifications: false,
          inAppNotifications: true,
          smsNotifications: true,
          notificationTypes: ['new_booking', 'payment_received']
        });
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete new booking notification flow', async () => {
      const mockProvider = {
        id: 'provider-1',
        email: 'provider@test.com',
        firstName: 'John',
        lastName: 'Provider',
        businessName: 'Test Business'
      };

      const mockVenue = {
        id: 'venue-1',
        name: 'Test Venue'
      };

      const mockPrisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue(mockProvider)
        },
        venue: {
          findUnique: jest.fn().mockResolvedValue(mockVenue)
        }
      };

      const mockDb = jest.fn().mockImplementation(() => ({
        insert: jest.fn().mockResolvedValue(1)
      }));

      const mockEmailService = {
        sendTemplateEmail: jest.fn().mockResolvedValue('email-sent')
      };

      jest.doMock('../utils/prisma', () => ({ prisma: mockPrisma }));
      jest.doMock('../utils/database', () => ({ db: mockDb }));
      jest.doMock('../services/emailService', () => ({ emailService: mockEmailService }));

      const { ProviderNotificationService } = await import('../services/providerNotificationService');

      const notificationData = {
        providerId: 'provider-1',
        venueId: 'venue-1',
        bookingId: 'booking-123',
        parentId: 'parent-456',
        childId: 'child-789',
        activityId: 'activity-101',
        amount: 50.00,
        bookingDate: new Date(),
        bookingTime: '10:00',
        activityName: 'Swimming Lesson',
        childName: 'Alice Smith',
        parentName: 'John Smith',
        parentEmail: 'john@example.com',
        venueName: 'Test Venue',
        notificationType: 'new_booking' as const
      };

      await ProviderNotificationService.sendNewBookingNotification(notificationData);

      // Verify all components were called
      expect(mockPrisma.user.findUnique).toHaveBeenCalled();
      expect(mockPrisma.venue.findUnique).toHaveBeenCalled();
      expect(mockEmailService.sendTemplateEmail).toHaveBeenCalled();
      expect(mockDb).toHaveBeenCalledWith('notifications');
    });
  });
});



