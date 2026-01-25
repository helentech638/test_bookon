import React, { useState, useEffect } from 'react';
import { 
  ExclamationTriangleIcon, 
  CurrencyPoundIcon, 
  ClockIcon,
  CheckCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import { buildApiUrl } from '../config/api';
import { authService } from '../services/authService';

interface RefundCalculation {
  refundableAmount: number;
  adminFee: number;
  netRefund: number;
  refundMethod: 'cash' | 'credit';
  reason: string;
  breakdown: {
    totalPaid: number;
    sessionsRemaining: number;
    valuePerSession: number;
    adminFeeDeducted: number;
  };
}

interface CancellationPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  bookingId: string;
  bookingDetails: {
    activityName: string;
    venueName: string;
    childName: string;
    bookingDate: string;
    bookingTime: string;
    amount: number;
  };
}

const CancellationPreviewModal: React.FC<CancellationPreviewModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  bookingId,
  bookingDetails
}) => {
  const [refundCalculation, setRefundCalculation] = useState<RefundCalculation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && bookingId) {
      fetchCancellationPreview();
    }
  }, [isOpen, bookingId]);

  const fetchCancellationPreview = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(buildApiUrl(`/bookings/${bookingId}/cancel-preview`), {
        headers: {
          'Authorization': `Bearer ${authService.getToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch cancellation preview');
      }

      const data = await response.json();
      setRefundCalculation(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cancellation preview');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getRefundMethodIcon = (method: string) => {
    return method === 'cash' ? (
      <CurrencyPoundIcon className="w-5 h-5 text-green-600" />
    ) : (
      <CheckCircleIcon className="w-5 h-5 text-blue-600" />
    );
  };

  const getRefundMethodLabel = (method: string) => {
    return method === 'cash' ? 'Refund to Card' : 'Credit to Wallet';
  };

  const getRefundMethodDescription = (method: string) => {
    return method === 'cash' 
      ? 'Money will be refunded to your original payment method within 3-5 business days'
      : 'Credit will be added to your BookOn wallet and can be used for future bookings';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <ExclamationTriangleIcon className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Cancel Booking</h2>
                <p className="text-sm text-gray-600">Review cancellation details and refund amount</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Booking Details */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Booking Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Activity</label>
                  <p className="text-gray-900">{bookingDetails.activityName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Child</label>
                  <p className="text-gray-900">{bookingDetails.childName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Venue</label>
                  <p className="text-gray-900">{bookingDetails.venueName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Date & Time</label>
                  <p className="text-gray-900">
                    {formatDate(bookingDetails.bookingDate)} at {bookingDetails.bookingTime}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Amount Paid</label>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatCurrency(bookingDetails.amount)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Calculating refund amount...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-600 mr-2" />
                <p className="text-red-800">{error}</p>
              </div>
            </div>
          )}

          {/* Refund Calculation */}
          {refundCalculation && !loading && (
            <div className="space-y-6">
              {/* Refund Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Refund Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Total Paid</span>
                      <span className="font-medium">{formatCurrency(refundCalculation.breakdown.totalPaid)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Refundable Amount</span>
                      <span className="font-medium">{formatCurrency(refundCalculation.refundableAmount)}</span>
                    </div>
                    {refundCalculation.adminFee > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Admin Fee</span>
                        <span className="font-medium text-red-600">-{formatCurrency(refundCalculation.adminFee)}</span>
                      </div>
                    )}
                    <hr className="border-gray-200" />
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold text-gray-900">Net Refund</span>
                      <span className="text-xl font-bold text-green-600">
                        {formatCurrency(refundCalculation.netRefund)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Refund Method */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Refund Method</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-start space-x-3">
                    {getRefundMethodIcon(refundCalculation.refundMethod)}
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">
                        {getRefundMethodLabel(refundCalculation.refundMethod)}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {getRefundMethodDescription(refundCalculation.refundMethod)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Policy Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Cancellation Policy</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3">
                      <ClockIcon className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-900">{refundCalculation.reason}</p>
                      </div>
                    </div>
                    {refundCalculation.adminFee > 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <p className="text-sm text-yellow-800">
                          <strong>Note:</strong> A {formatCurrency(refundCalculation.adminFee)} admin fee applies to this cancellation.
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4">
                <Button
                  onClick={onClose}
                  variant="outline"
                  className="flex-1"
                >
                  Keep Booking
                </Button>
                <Button
                  onClick={onConfirm}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  Confirm Cancellation
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CancellationPreviewModal;

