import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { db } from '../utils/database';
import { cancellationService } from '../services/cancellationService';
import { CreditService } from '../services/creditService';
import { RefundNotificationService } from '../services/refundNotificationService';
import { RefundService } from '../services/refundService';

// Mock external dependencies
jest.mock('../utils/database');
jest.mock('../services/refundNotificationService');
jest.mock('../services/stripe');

describe('Refund and Credit System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('CancellationService', () => {
    describe('determineCancellationEligibility', () => {
      it('should return refund for cancellation ≥24 hours before session', async () => {
        const mockBooking = {
          id: 'booking-1',
          amount: 50.00,
          activityDate: new Date(Date.now() + 25 * 60 * 60 * 1000), // 25 hours from now
          activityTime: '10:00',
          activity: { duration: 1 },
          parent: { id: 'parent-1' }
        };

        (db as any).mockImplementation(() => ({
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(mockBooking)
        }));

        const result = await cancellationService.determineCancellationEligibility('booking-1', new Date());

        expect(result.eligible).toBe(true);
        expect(result.method).toBe('cash');
        expect(result.refundAmount).toBe(48.00); // £50 - £2 admin fee
        expect(result.creditAmount).toBe(0);
        expect(result.adminFee).toBe(2.00);
        expect(result.reason).toContain('≥24 hours before');
      });

      it('should return credit for cancellation <24 hours before session', async () => {
        const mockBooking = {
          id: 'booking-1',
          amount: 50.00,
          activityDate: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours from now
          activityTime: '10:00',
          activity: { duration: 1 },
          parent: { id: 'parent-1' }
        };

        (db as any).mockImplementation(() => ({
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(mockBooking)
        }));

        const result = await cancellationService.determineCancellationEligibility('booking-1', new Date());

        expect(result.eligible).toBe(true);
        expect(result.method).toBe('credit');
        expect(result.refundAmount).toBe(0);
        expect(result.creditAmount).toBe(50.00); // Full amount, no admin fee
        expect(result.adminFee).toBe(0);
        expect(result.reason).toContain('<24 hours before');
      });

      it('should return pro-rata credit for course cancellation after start', async () => {
        const mockBooking = {
          id: 'booking-1',
          amount: 100.00,
          activityDate: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          activityTime: '10:00',
          activity: { duration: 4 }, // 4-session course
          parent: { id: 'parent-1' }
        };

        (db as any).mockImplementation(() => ({
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(mockBooking)
        }));

        const result = await cancellationService.determineCancellationEligibility('booking-1', new Date());

        expect(result.eligible).toBe(true);
        expect(result.method).toBe('credit');
        expect(result.refundAmount).toBe(0);
        expect(result.adminFee).toBe(0);
        expect(result.reason).toContain('pro-rata credit');
      });

      it('should return ineligible for single session after start', async () => {
        const mockBooking = {
          id: 'booking-1',
          amount: 50.00,
          activityDate: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          activityTime: '10:00',
          activity: { duration: 1 }, // Single session
          parent: { id: 'parent-1' }
        };

        (db as any).mockImplementation(() => ({
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(mockBooking)
        }));

        const result = await cancellationService.determineCancellationEligibility('booking-1', new Date());

        expect(result.eligible).toBe(false);
        expect(result.reason).toContain('already occurred');
      });
    });

    describe('processCancellation', () => {
      it('should process refund cancellation correctly', async () => {
        const mockBooking = {
          id: 'booking-1',
          amount: 50.00,
          activityDate: new Date(Date.now() + 25 * 60 * 60 * 1000),
          activityTime: '10:00',
          activity: { duration: 1 },
          parent: { id: 'parent-1' }
        };

        (db as any).mockImplementation(() => ({
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(mockBooking),
          insert: jest.fn().mockReturnThis(),
          returning: jest.fn().mockResolvedValue([{ id: 'refund-1' }]),
          update: jest.fn().mockResolvedValue([mockBooking])
        }));

        const result = await cancellationService.processCancellation('booking-1', 'parent-1', 'Test reason');

        expect(result.refundTransactionId).toBe('refund-1');
        expect(result.creditId).toBeUndefined();
      });

      it('should process credit cancellation correctly', async () => {
        const mockBooking = {
          id: 'booking-1',
          amount: 50.00,
          activityDate: new Date(Date.now() + 12 * 60 * 60 * 1000),
          activityTime: '10:00',
          activity: { duration: 1 },
          parent: { id: 'parent-1' }
        };

        (db as any).mockImplementation(() => ({
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(mockBooking),
          insert: jest.fn().mockReturnThis(),
          returning: jest.fn().mockResolvedValue([{ id: 'credit-1' }]),
          update: jest.fn().mockResolvedValue([mockBooking])
        }));

        const result = await cancellationService.processCancellation('booking-1', 'parent-1', 'Test reason');

        expect(result.creditId).toBe('credit-1');
        expect(result.refundTransactionId).toBeUndefined();
      });
    });
  });

  describe('CreditService', () => {
    describe('getParentWallet', () => {
      it('should return parent wallet with correct totals', async () => {
        const mockCredits = [
          { id: 'credit-1', amount: 50.00, usedAmount: 20.00, status: 'active', expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), source: 'cancellation', description: 'Test credit', bookingId: 'booking-1', createdAt: new Date(), updatedAt: new Date() },
          { id: 'credit-2', amount: 30.00, usedAmount: 0.00, status: 'active', expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), source: 'admin_override', description: 'Admin credit', bookingId: null, createdAt: new Date(), updatedAt: new Date() }
        ];

        const mockTransactions = [
          { id: 'txn-1', amount: 50.00, adminFee: 2.00, netAmount: 48.00, method: 'refund', reason: 'Test refund', status: 'completed', createdAt: new Date(), updatedAt: new Date() }
        ];

        (db as any).mockImplementation((table) => {
          if (table === 'wallet_credits') {
            return {
              where: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockResolvedValue(mockCredits)
            };
          }
          if (table === 'refund_transactions') {
            return {
              where: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              limit: jest.fn().mockResolvedValue(mockTransactions)
            };
          }
          return {
            where: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({ count: '2' })
          };
        });

        const wallet = await CreditService.getParentWallet('parent-1');

        expect(wallet.parentId).toBe('parent-1');
        expect(wallet.totalCredits).toBe(80.00);
        expect(wallet.availableCredits).toBe(60.00);
        expect(wallet.usedCredits).toBe(20.00);
        expect(wallet.credits).toHaveLength(2);
        expect(wallet.recentTransactions).toHaveLength(1);
      });
    });

    describe('issueCredit', () => {
      it('should issue credit correctly', async () => {
        const mockCredit = {
          id: 'credit-1',
          parentId: 'parent-1',
          amount: 50.00,
          usedAmount: 0,
          expiryDate: new Date(Date.now() + 12 * 30 * 24 * 60 * 60 * 1000),
          source: 'cancellation',
          status: 'active',
          description: 'Test credit',
          bookingId: 'booking-1',
          createdAt: new Date(),
          updatedAt: new Date()
        };

        (db as any).mockImplementation((table) => {
          if (table === 'wallet_credits') {
            return {
              insert: jest.fn().mockReturnThis(),
              returning: jest.fn().mockResolvedValue([mockCredit])
            };
          }
          if (table === 'users') {
            return {
              where: jest.fn().mockReturnThis(),
              increment: jest.fn().mockResolvedValue(1)
            };
          }
        });

        const creditId = await CreditService.issueCredit({
          parentId: 'parent-1',
          amount: 50.00,
          reason: 'Test credit',
          source: 'cancellation',
          bookingId: 'booking-1'
        });

        expect(creditId).toBe('credit-1');
      });
    });

    describe('useCredit', () => {
      it('should use credit in FIFO order', async () => {
        const mockCredits = [
          { id: 'credit-1', amount: 30.00, usedAmount: 0.00, status: 'active', expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), source: 'cancellation', description: 'Old credit', bookingId: 'booking-1', createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), updatedAt: new Date() },
          { id: 'credit-2', amount: 50.00, usedAmount: 0.00, status: 'active', expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), source: 'admin_override', description: 'New credit', bookingId: null, createdAt: new Date(), updatedAt: new Date() }
        ];

        (db as any).mockImplementation((table) => {
          if (table === 'wallet_credits') {
            return {
              where: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockResolvedValue(mockCredits)
            };
          }
          if (table === 'users') {
            return {
              where: jest.fn().mockReturnThis(),
              decrement: jest.fn().mockResolvedValue(1)
            };
          }
          return {
            where: jest.fn().mockReturnThis(),
            update: jest.fn().mockResolvedValue(1)
          };
        });

        const result = await CreditService.useCredit('parent-1', 40.00, 'booking-2', 'Test usage');

        expect(result.usedCredits).toHaveLength(2);
        expect(result.remainingAmount).toBe(0);
        expect(result.usedCredits[0].id).toBe('credit-1'); // Should use oldest first
      });
    });
  });

  describe('RefundService', () => {
    describe('calculateRefund', () => {
      it('should calculate refund correctly for ≥24 hours', async () => {
        const context = {
          bookingId: 'booking-1',
          parentId: 'parent-1',
          activityId: 'activity-1',
          activityStartDate: new Date(Date.now() + 25 * 60 * 60 * 1000), // 25 hours from now
          cancellationDate: new Date(),
          originalAmount: 50.00,
          paymentIntentId: 'pi-1',
          venueId: 'venue-1',
          isCourse: false
        };

        const calculation = await RefundService.calculateRefund(context);

        expect(calculation.refundMethod).toBe('refund');
        expect(calculation.adminFee).toBe(2.00);
        expect(calculation.netRefund).toBe(48.00);
        expect(calculation.timing).toBe('before_24h');
        expect(calculation.reason).toContain('≥24 hours');
      });

      it('should calculate credit correctly for <24 hours', async () => {
        const context = {
          bookingId: 'booking-1',
          parentId: 'parent-1',
          activityId: 'activity-1',
          activityStartDate: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours from now
          cancellationDate: new Date(),
          originalAmount: 50.00,
          paymentIntentId: 'pi-1',
          venueId: 'venue-1',
          isCourse: false
        };

        const calculation = await RefundService.calculateRefund(context);

        expect(calculation.refundMethod).toBe('credit');
        expect(calculation.adminFee).toBe(0);
        expect(calculation.netRefund).toBe(50.00);
        expect(calculation.timing).toBe('after_24h');
        expect(calculation.reason).toContain('<24 hours');
      });

      it('should calculate pro-rata refund for course after start', async () => {
        const context = {
          bookingId: 'booking-1',
          parentId: 'parent-1',
          activityId: 'activity-1',
          activityStartDate: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          cancellationDate: new Date(),
          originalAmount: 100.00,
          paymentIntentId: 'pi-1',
          venueId: 'venue-1',
          isCourse: true,
          courseStartDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
          totalSessions: 4,
          usedSessions: 1
        };

        const calculation = await RefundService.calculateRefund(context);

        expect(calculation.refundMethod).toBe('credit');
        expect(calculation.adminFee).toBe(0);
        expect(calculation.timing).toBe('after_start');
        expect(calculation.proRataAmount).toBeDefined();
        expect(calculation.unusedSessions).toBe(3);
        expect(calculation.totalSessions).toBe(4);
      });
    });
  });

  describe('RefundNotificationService', () => {
    describe('sendRefundProcessedNotification', () => {
      it('should send refund notification correctly', async () => {
        const mockParent = {
          id: 'parent-1',
          email: 'parent@test.com',
          firstName: 'John',
          lastName: 'Doe'
        };

        const mockBooking = {
          activityName: 'Swimming',
          activityStartDate: new Date(),
          activityStartTime: '10:00',
          venueName: 'Test Pool'
        };

        (db as any).mockImplementation((table) => {
          if (table === 'users') {
            return {
              where: jest.fn().mockReturnThis(),
              first: jest.fn().mockResolvedValue(mockParent)
            };
          }
          if (table === 'bookings') {
            return {
              select: jest.fn().mockReturnThis(),
              join: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              first: jest.fn().mockResolvedValue(mockBooking)
            };
          }
          if (table === 'notifications') {
            return {
              insert: jest.fn().mockResolvedValue(1)
            };
          }
        });

        const notificationData = {
          type: 'refund_processed' as const,
          parentId: 'parent-1',
          bookingId: 'booking-1',
          amount: 50.00,
          method: 'refund' as const,
          reason: 'Test cancellation',
          adminFee: 2.00,
          netAmount: 48.00
        };

        await RefundNotificationService.sendRefundProcessedNotification(notificationData);

        // Verify notification was created
        expect(db).toHaveBeenCalledWith('notifications');
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete refund flow correctly', async () => {
      // Mock booking data
      const mockBooking = {
        id: 'booking-1',
        amount: 50.00,
        activityDate: new Date(Date.now() + 25 * 60 * 60 * 1000), // 25 hours from now
        activityTime: '10:00',
        activity: { duration: 1 },
        parent: { id: 'parent-1' }
      };

      // Mock database responses
      (db as any).mockImplementation((table) => {
        if (table === 'bookings') {
          return {
            where: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue(mockBooking),
            update: jest.fn().mockResolvedValue([mockBooking])
          };
        }
        if (table === 'refund_transactions') {
          return {
            insert: jest.fn().mockReturnThis(),
            returning: jest.fn().mockResolvedValue([{ id: 'refund-1' }])
          };
        }
        if (table === 'users') {
          return {
            where: jest.fn().mockReturnThis(),
            increment: jest.fn().mockResolvedValue(1)
          };
        }
        return {
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(mockBooking)
        };
      });

      // Process cancellation
      const result = await cancellationService.processCancellation('booking-1', 'parent-1', 'Test reason');

      expect(result.refundTransactionId).toBe('refund-1');
      expect(result.creditId).toBeUndefined();
    });

    it('should handle complete credit flow correctly', async () => {
      // Mock booking data
      const mockBooking = {
        id: 'booking-1',
        amount: 50.00,
        activityDate: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours from now
        activityTime: '10:00',
        activity: { duration: 1 },
        parent: { id: 'parent-1' }
      };

      // Mock database responses
      (db as any).mockImplementation((table) => {
        if (table === 'bookings') {
          return {
            where: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue(mockBooking),
            update: jest.fn().mockResolvedValue([mockBooking])
          };
        }
        if (table === 'wallet_credits') {
          return {
            insert: jest.fn().mockReturnThis(),
            returning: jest.fn().mockResolvedValue([{ id: 'credit-1' }])
          };
        }
        if (table === 'users') {
          return {
            where: jest.fn().mockReturnThis(),
            increment: jest.fn().mockResolvedValue(1)
          };
        }
        return {
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(mockBooking)
        };
      });

      // Process cancellation
      const result = await cancellationService.processCancellation('booking-1', 'parent-1', 'Test reason');

      expect(result.creditId).toBe('credit-1');
      expect(result.refundTransactionId).toBeUndefined();
    });
  });
});



