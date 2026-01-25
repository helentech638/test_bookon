// Refund and Credit System Types

export interface RefundCalculation {
  originalAmount: number;
  adminFee: number;
  netRefund: number;
  refundMethod: 'refund' | 'credit';
  reason: string;
  timing: 'before_24h' | 'after_24h' | 'after_start';
  proRataAmount?: number;
  unusedSessions?: number;
  totalSessions?: number;
}

export interface CreditCalculation {
  originalAmount: number;
  creditAmount: number;
  adminFee: number;
  reason: string;
  expiryDate: Date;
  source: 'cancellation' | 'admin_override' | 'refund_conversion';
}

export interface CancellationContext {
  bookingId: string;
  parentId: string;
  activityId: string;
  activityStartDate: Date;
  cancellationDate: Date;
  originalAmount: number;
  paymentIntentId?: string;
  venueId?: string;
  isCourse?: boolean;
  courseStartDate?: Date;
  totalSessions?: number;
  usedSessions?: number;
}

export interface RefundRequest {
  bookingId: string;
  parentId: string;
  reason: string;
  adminOverride?: boolean;
  adminId?: string;
  refundMethod?: 'refund' | 'credit';
  amount?: number; // For partial refunds
}

export interface CreditRequest {
  parentId: string;
  amount: number;
  reason: string;
  source: 'cancellation' | 'admin_override' | 'refund_conversion';
  expiryMonths?: number;
  adminId?: string;
  bookingId?: string;
}

export interface RefundTransaction {
  id: string;
  bookingId: string;
  parentId: string;
  amount: number;
  adminFee: number;
  netAmount: number;
  method: 'refund' | 'credit';
  reason: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  stripeRefundId?: string;
  processedAt?: Date;
  adminId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreditTransaction {
  id: string;
  parentId: string;
  amount: number;
  usedAmount: number;
  remainingAmount: number;
  source: string;
  description: string;
  status: 'active' | 'used' | 'expired' | 'cancelled';
  expiryDate: Date;
  bookingId?: string;
  createdAt: Date;
  updatedAt: Date;
  usedAt?: Date;
}

export interface ParentWallet {
  parentId: string;
  totalCredits: number;
  availableCredits: number;
  usedCredits: number;
  expiredCredits: number;
  credits: CreditTransaction[];
  recentTransactions: RefundTransaction[];
}

export interface CancellationPreview {
  bookingId: string;
  activityName: string;
  activityDate: Date;
  originalAmount: number;
  timing: 'before_24h' | 'after_24h' | 'after_start';
  refundMethod: 'refund' | 'credit';
  adminFee: number;
  netAmount: number;
  reason: string;
  canCancel: boolean;
  cancellationMessage: string;
}

export interface AdminRefundOverride {
  bookingId: string;
  parentId: string;
  overrideReason: string;
  refundMethod: 'refund' | 'credit';
  amount: number;
  adminId: string;
  adminFee?: number; // Can be waived
}

export interface NotificationData {
  type: 'refund_processed' | 'credit_issued' | 'booking_cancelled';
  parentId: string;
  bookingId: string;
  amount: number;
  method: 'refund' | 'credit';
  reason: string;
  adminFee?: number;
  netAmount: number;
}

export interface RefundPolicyConfig {
  adminFeeAmount: number;
  refundCutoffHours: number;
  creditExpiryMonths: number;
  proRataEnabled: boolean;
  platformFeeRefundable: boolean;
  franchiseFeeRefundable: boolean;
}

export interface CourseRefundCalculation {
  totalSessions: number;
  usedSessions: number;
  unusedSessions: number;
  sessionPrice: number;
  unusedAmount: number;
  proRataRefund: number;
}

export interface RefundAuditLog {
  id: string;
  refundId: string;
  action: string;
  userId: string;
  userRole: string;
  changes: Record<string, any>;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}



