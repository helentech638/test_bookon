import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { toast } from 'react-hot-toast';
import {
  CheckCircleIcon,
  DocumentArrowDownIcon,
  EnvelopeIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

interface PaymentSuccessProps {
  paymentIntentId: string;
  amount: number;
  currency: string;
  bookingData: any;
  onRedirect?: () => void;
}

const PaymentSuccess: React.FC<PaymentSuccessProps> = ({
  paymentIntentId,
  amount,
  currency,
  bookingData,
  onRedirect
}) => {
  const [countdown, setCountdown] = useState(10);
  const [isDownloading, setIsDownloading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    // Send confirmation email automatically
    sendConfirmationEmail();

    // Start countdown timer
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (onRedirect) {
            onRedirect();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onRedirect]);

  const sendConfirmationEmail = async () => {
    try {
      const token = localStorage.getItem('bookon_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://bookon-api.vercel.app'}/api/v1/payments/send-confirmation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          paymentIntentId,
          bookingData,
          amount,
          currency
        })
      });

      if (response.ok) {
        setEmailSent(true);
        toast.success('Confirmation email sent!');
      } else {
        console.error('Failed to send confirmation email');
      }
    } catch (error) {
      console.error('Error sending confirmation email:', error);
    }
  };

  const downloadReceipt = async () => {
    setIsDownloading(true);
    try {
      const token = localStorage.getItem('bookon_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://bookon-api.vercel.app'}/api/v1/payments/download-receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          paymentIntentId,
          bookingData,
          amount,
          currency
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `receipt-${paymentIntentId.slice(-8)}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Receipt downloaded successfully!');
      } else {
        toast.error('Failed to download receipt');
      }
    } catch (error) {
      console.error('Error downloading receipt:', error);
      toast.error('Failed to download receipt');
    } finally {
      setIsDownloading(false);
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Success Card */}
        <Card className="bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200 shadow-xl">
          <CardContent className="p-8 text-center">
            {/* Success Icon */}
            <div className="w-16 h-16 bg-teal-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
              <CheckCircleIcon className="w-10 h-10 text-white" />
            </div>

            {/* Success Message */}
            <h1 className="text-2xl font-bold text-teal-800 mb-2">Payment Successful!</h1>
            <p className="text-teal-700 mb-6">Your booking has been confirmed</p>

            {/* Payment Details */}
            <div className="bg-white rounded-lg p-4 mb-6 shadow-sm">
              <div className="text-sm text-gray-600 mb-2">Payment Amount</div>
              <div className="text-2xl font-bold text-teal-600 mb-2">
                {formatAmount(amount, currency)}
              </div>
              <div className="text-xs text-gray-500">
                Payment ID: {paymentIntentId.slice(-8)}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {/* Download Receipt Button */}
              <Button
                onClick={downloadReceipt}
                disabled={isDownloading}
                className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center space-x-2"
              >
                {isDownloading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <DocumentArrowDownIcon className="w-5 h-5" />
                    <span>Download Receipt (PDF)</span>
                  </>
                )}
              </Button>

              {/* Email Status */}
              <div className="flex items-center justify-center space-x-2 text-sm">
                <EnvelopeIcon className="w-4 h-4 text-teal-600" />
                <span className="text-teal-700">
                  {emailSent ? 'Confirmation email sent!' : 'Sending confirmation email...'}
                </span>
              </div>
            </div>

            {/* Countdown Timer */}
            <div className="mt-6 pt-6 border-t border-teal-200">
              <div className="flex items-center justify-center space-x-2 text-teal-700">
                <ClockIcon className="w-4 h-4" />
                <span className="text-sm">
                  Redirecting to dashboard in {countdown} second{countdown !== 1 ? 's' : ''}...
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Additional Info */}
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            You can also access your booking details from the{' '}
            <Button
              variant="link"
              onClick={() => window.location.href = '/bookings'}
              className="text-teal-600 hover:text-teal-700 p-0 h-auto"
            >
              bookings page
            </Button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
