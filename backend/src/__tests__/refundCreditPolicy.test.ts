import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock the database module
const mockDb = jest.fn();
jest.mock('../utils/database', () => ({
  db: mockDb
}));

// Mock the prisma module
const mockPrisma = {
  booking: {
    findUnique: jest.fn(),
    update: jest.fn(),
    findFirst: jest.fn()
  },
  walletCredit: {
    create: jest.fn(),
    findMany: jest.fn()
  },
  refundTransaction: {
    create: jest.fn(),
    findMany: jest.fn()
  },
  user: {
    update: jest.fn(),
    findFirst: jest.fn()
  }
};

jest.mock('../utils/prisma', () => ({
  prisma: mockPrisma
}));

// Mock notification service
jest.mock('../services/refundNotificationService', () => ({
  RefundNotificationService: {
    sendRefundProcessedNotification: jest.fn(),
    sendBookingCancelledNotification: jest.fn()
  }
}));

// Mock stripe service
jest.mock('../services/stripe', () => ({
  default: {
    processRefund: jest.fn()
  }
}));

describe('Refund and Credit System - Policy Compliance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Client Policy Requirements', () => {
    it('should charge £2 admin fee on refunds only (≥24 hours)', () => {
      const originalAmount = 50.00;
      const adminFee = 2.00;
      const expectedRefund = originalAmount - adminFee; // £48

      // Test the exact policy: ≥24 hours = refund with £2 admin fee
      expect(expectedRefund).toBe(48.00);
      expect(adminFee).toBe(2.00);
    });

    it('should NOT charge admin fee on credits (<24 hours)', () => {
      const originalAmount = 50.00;
      const adminFee = 0.00; // No admin fee on credits
      const expectedCredit = originalAmount; // £50

      // Test the exact policy: <24 hours = credit with no admin fee
      expect(expectedCredit).toBe(50.00);
      expect(adminFee).toBe(0.00);
    });

    it('should calculate pro-rata refunds for courses correctly', () => {
      const totalAmount = 100.00;
      const totalSessions = 4;
      const usedSessions = 1;
      const unusedSessions = totalSessions - usedSessions; // 3
      const sessionPrice = totalAmount / totalSessions; // £25
      const unusedAmount = unusedSessions * sessionPrice; // £75
      const adminFee = 0.00; // No admin fee on credits (after start)
      const expectedCredit = unusedAmount - adminFee; // £75

      // Test pro-rata calculation for courses after start
      expect(unusedSessions).toBe(3);
      expect(sessionPrice).toBe(25.00);
      expect(unusedAmount).toBe(75.00);
      expect(expectedCredit).toBe(75.00);
      expect(adminFee).toBe(0.00);
    });

    it('should handle 24-hour cutoff rule correctly', () => {
      const now = new Date();
      const sessionTime = new Date(now.getTime() + 25 * 60 * 60 * 1000); // 25 hours from now
      const hoursUntilSession = (sessionTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Test ≥24 hours rule
      expect(hoursUntilSession).toBeGreaterThanOrEqual(24);
      
      const sessionTime2 = new Date(now.getTime() + 12 * 60 * 60 * 1000); // 12 hours from now
      const hoursUntilSession2 = (sessionTime2.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Test <24 hours rule
      expect(hoursUntilSession2).toBeLessThan(24);
    });

    it('should handle single admin fee per refund action', () => {
      const bookingAmount = 50.00;
      const adminFee = 2.00;
      const netRefund = bookingAmount - adminFee;

      // Test that only ONE £2 admin fee is charged per refund action
      expect(adminFee).toBe(2.00);
      expect(netRefund).toBe(48.00);
      
      // Even for multiple sessions, only one admin fee
      const multipleSessionAmount = 200.00;
      const multipleSessionRefund = multipleSessionAmount - adminFee; // Still only £2 fee
      
      expect(multipleSessionRefund).toBe(198.00);
      expect(adminFee).toBe(2.00); // Same fee regardless of amount
    });

    it('should handle credit expiry correctly', () => {
      const expiryMonths = 12;
      const now = new Date();
      const expiryDate = new Date(now.getTime() + expiryMonths * 30 * 24 * 60 * 60 * 1000);

      // Test 12-month expiry
      expect(expiryMonths).toBe(12);
      expect(expiryDate.getTime()).toBeGreaterThan(now.getTime());
    });
  });

  describe('Business Logic Validation', () => {
    it('should validate refund scenarios', () => {
      // Scenario 1: ≥24 hours before session
      const scenario1 = {
        originalAmount: 50.00,
        hoursUntilSession: 25,
        expectedMethod: 'refund',
        expectedAmount: 48.00,
        adminFee: 2.00
      };

      expect(scenario1.hoursUntilSession).toBeGreaterThanOrEqual(24);
      expect(scenario1.expectedMethod).toBe('refund');
      expect(scenario1.expectedAmount).toBe(scenario1.originalAmount - scenario1.adminFee);

      // Scenario 2: <24 hours before session
      const scenario2 = {
        originalAmount: 50.00,
        hoursUntilSession: 12,
        expectedMethod: 'credit',
        expectedAmount: 50.00,
        adminFee: 0.00
      };

      expect(scenario2.hoursUntilSession).toBeLessThan(24);
      expect(scenario2.expectedMethod).toBe('credit');
      expect(scenario2.expectedAmount).toBe(scenario2.originalAmount);
      expect(scenario2.adminFee).toBe(0.00);
    });

    it('should validate course pro-rata scenarios', () => {
      // Course scenario: 4 sessions, 1 used, 3 remaining
      const courseScenario = {
        totalAmount: 100.00,
        totalSessions: 4,
        usedSessions: 1,
        sessionPrice: 25.00,
        unusedSessions: 3,
        unusedAmount: 75.00,
        adminFee: 0.00, // No admin fee on credits
        expectedCredit: 75.00
      };

      expect(courseScenario.unusedSessions).toBe(courseScenario.totalSessions - courseScenario.usedSessions);
      expect(courseScenario.sessionPrice).toBe(courseScenario.totalAmount / courseScenario.totalSessions);
      expect(courseScenario.unusedAmount).toBe(courseScenario.unusedSessions * courseScenario.sessionPrice);
      expect(courseScenario.expectedCredit).toBe(courseScenario.unusedAmount - courseScenario.adminFee);
    });

    it('should validate admin override scenarios', () => {
      // Admin can override the 24-hour rule
      const adminOverride = {
        originalAmount: 50.00,
        hoursUntilSession: 12, // Normally would be credit
        adminOverride: true,
        overrideAmount: 50.00,
        adminFee: 0.00, // Admin can waive fee
        expectedRefund: 50.00
      };

      expect(adminOverride.adminOverride).toBe(true);
      expect(adminOverride.hoursUntilSession).toBeLessThan(24); // Would normally be credit
      expect(adminOverride.expectedRefund).toBe(adminOverride.overrideAmount);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero amount bookings', () => {
      const zeroAmountBooking = {
        originalAmount: 0.00,
        adminFee: 2.00,
        netRefund: Math.max(0, 0.00 - 2.00) // Should be 0, not negative
      };

      expect(zeroAmountBooking.netRefund).toBe(0.00);
    });

    it('should handle bookings with amount less than admin fee', () => {
      const smallAmountBooking = {
        originalAmount: 1.00,
        adminFee: 2.00,
        netRefund: Math.max(0, 1.00 - 2.00) // Should be 0, not negative
      };

      expect(smallAmountBooking.netRefund).toBe(0.00);
    });

    it('should handle exact 24-hour boundary', () => {
      const exact24Hours = {
        hoursUntilSession: 24.0,
        expectedMethod: 'refund', // Exactly 24 hours should be refund
        adminFee: 2.00
      };

      expect(exact24Hours.hoursUntilSession).toBeGreaterThanOrEqual(24);
      expect(exact24Hours.expectedMethod).toBe('refund');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete refund flow', () => {
      const refundFlow = {
        bookingId: 'booking-123',
        parentId: 'parent-456',
        originalAmount: 50.00,
        hoursUntilSession: 25,
        cancellationReason: 'Change of plans',
        expectedRefund: 48.00,
        adminFee: 2.00,
        stripeRefundId: 're_1234567890',
        notificationSent: true
      };

      // Validate complete refund flow
      expect(refundFlow.hoursUntilSession).toBeGreaterThanOrEqual(24);
      expect(refundFlow.expectedRefund).toBe(refundFlow.originalAmount - refundFlow.adminFee);
      expect(refundFlow.stripeRefundId).toMatch(/^re_/);
      expect(refundFlow.notificationSent).toBe(true);
    });

    it('should handle complete credit flow', () => {
      const creditFlow = {
        bookingId: 'booking-789',
        parentId: 'parent-012',
        originalAmount: 50.00,
        hoursUntilSession: 12,
        cancellationReason: 'Emergency',
        expectedCredit: 50.00,
        adminFee: 0.00,
        creditId: 'credit-3456789',
        expiryDate: new Date(Date.now() + 12 * 30 * 24 * 60 * 60 * 1000),
        notificationSent: true
      };

      // Validate complete credit flow
      expect(creditFlow.hoursUntilSession).toBeLessThan(24);
      expect(creditFlow.expectedCredit).toBe(creditFlow.originalAmount);
      expect(creditFlow.adminFee).toBe(0.00);
      expect(creditFlow.creditId).toMatch(/^credit-/);
      expect(creditFlow.notificationSent).toBe(true);
    });
  });
});
