import { Request, Response } from 'express';
import Stripe from 'stripe';

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: jest.fn(),
    },
  }));
});

// Mock Prisma
const mockPrisma = {
  payment: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  booking: {
    update: jest.fn(),
  },
} as any;

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock notification service
jest.mock('../services/notificationService', () => ({
  NotificationService: {
    createNotification: jest.fn(),
  },
}));

// Import the function to test
import { handlePaymentSuccess } from '../routes/payments';

describe('Payment Webhook Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handlePaymentSuccess', () => {
    const mockPaymentIntent: Stripe.PaymentIntent = {
      id: 'pi_test_123',
      amount: 2000, // £20.00
      currency: 'gbp',
      status: 'succeeded',
    } as Stripe.PaymentIntent;

    const mockPayment = {
      id: 'payment-123',
      stripePaymentIntentId: 'pi_test_123',
      bookingId: 'booking-123',
      amount: 2000,
      booking: {
        id: 'booking-123',
        activityId: 'activity-123',
        activityDate: new Date('2024-01-15'),
        activityTime: '10:00',
        childId: 'child-123',
        parent: {
          firstName: 'John',
          lastName: 'Doe',
        },
        child: {
          firstName: 'Jane',
          lastName: 'Doe',
        },
        activity: {
          id: 'activity-123',
          title: 'Swimming Lesson',
          ownerId: 'owner-123',
          venueId: 'venue-123',
        },
      },
    };

    it('should handle successful payment and create register', async () => {
      // Mock: Find payment
      mockPrisma.payment.findFirst.mockResolvedValue(mockPayment);

      // Mock: Update payment
      mockPrisma.payment.update.mockResolvedValue({
        ...mockPayment,
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock: Update booking
      mockPrisma.booking.update.mockResolvedValue({
        ...mockPayment.booking,
        status: 'confirmed',
        updatedAt: new Date(),
      });

      // Mock createRegisterForBooking function
      const mockCreateRegisterForBooking = jest.fn().mockResolvedValue(undefined);
      jest.doMock('../routes/payments', () => ({
        ...jest.requireActual('../routes/payments'),
        createRegisterForBooking: mockCreateRegisterForBooking,
      }));

      // Execute the function
      await handlePaymentSuccess(mockPaymentIntent);

      // Verify payment was found
      expect(mockPrisma.payment.findFirst).toHaveBeenCalledWith({
        where: {
          stripePaymentIntentId: 'pi_test_123',
          isActive: true,
        },
        include: {
          booking: {
            include: {
              activity: true,
              child: true,
              parent: true,
            },
          },
        },
      });

      // Verify payment was updated
      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-123' },
        data: {
          status: 'completed',
          completedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      });

      // Verify booking was updated
      expect(mockPrisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'booking-123' },
        data: {
          status: 'confirmed',
          updatedAt: expect.any(Date),
        },
      });

      // Verify register creation was called
      expect(mockCreateRegisterForBooking).toHaveBeenCalledWith(mockPayment.booking);
    });

    it('should handle payment not found gracefully', async () => {
      // Mock: Payment not found
      mockPrisma.payment.findFirst.mockResolvedValue(null);

      // Execute the function
      await handlePaymentSuccess(mockPaymentIntent);

      // Verify payment update was not called
      expect(mockPrisma.payment.update).not.toHaveBeenCalled();
      expect(mockPrisma.booking.update).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      // Mock: Database error
      mockPrisma.payment.findFirst.mockRejectedValue(new Error('Database connection failed'));

      // Execute the function - should not throw
      await expect(handlePaymentSuccess(mockPaymentIntent)).resolves.not.toThrow();

      // Verify error was logged
      const { logger } = require('../utils/logger');
      expect(logger.error).toHaveBeenCalledWith(
        'Error handling payment success webhook:',
        expect.any(Error)
      );
    });

    it('should create notification for business owner', async () => {
      // Mock: Find payment
      mockPrisma.payment.findFirst.mockResolvedValue(mockPayment);

      // Mock: Update operations
      mockPrisma.payment.update.mockResolvedValue(mockPayment);
      mockPrisma.booking.update.mockResolvedValue(mockPayment.booking);

      // Mock createRegisterForBooking
      const mockCreateRegisterForBooking = jest.fn().mockResolvedValue(undefined);
      jest.doMock('../routes/payments', () => ({
        ...jest.requireActual('../routes/payments'),
        createRegisterForBooking: mockCreateRegisterForBooking,
      }));

      // Execute the function
      await handlePaymentSuccess(mockPaymentIntent);

      // Verify notification was created
      const { NotificationService } = require('../services/notificationService');
      expect(NotificationService.createNotification).toHaveBeenCalledWith({
        userId: 'owner-123',
        venueId: 'venue-123',
        type: 'payment_success',
        title: 'Payment Received',
        message: 'Payment of £20.00 received from John for Swimming Lesson',
        data: {
          paymentId: 'payment-123',
          bookingId: 'booking-123',
          amount: 2000,
          childName: 'Jane Doe',
          activityId: 'activity-123',
        },
        priority: 'high',
        channels: ['in_app', 'email'],
      });
    });

    it('should handle notification creation failure gracefully', async () => {
      // Mock: Find payment
      mockPrisma.payment.findFirst.mockResolvedValue(mockPayment);

      // Mock: Update operations
      mockPrisma.payment.update.mockResolvedValue(mockPayment);
      mockPrisma.booking.update.mockResolvedValue(mockPayment.booking);

      // Mock: Notification service failure
      const { NotificationService } = require('../services/notificationService');
      NotificationService.createNotification.mockRejectedValue(new Error('Notification service failed'));

      // Mock createRegisterForBooking
      const mockCreateRegisterForBooking = jest.fn().mockResolvedValue(undefined);
      jest.doMock('../routes/payments', () => ({
        ...jest.requireActual('../routes/payments'),
        createRegisterForBooking: mockCreateRegisterForBooking,
      }));

      // Execute the function - should not throw
      await expect(handlePaymentSuccess(mockPaymentIntent)).resolves.not.toThrow();

      // Verify error was logged
      const { logger } = require('../utils/logger');
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to create payment notification:',
        expect.any(Error)
      );
    });
  });
});
