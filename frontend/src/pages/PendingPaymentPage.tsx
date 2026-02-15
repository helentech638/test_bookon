import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  EnvelopeIcon,
  PhoneIcon,
  ArrowLeftIcon,
  ClipboardDocumentIcon
} from '@heroicons/react/24/outline';
import { Button } from '../components/ui/Button';

interface PendingBooking {
  id: string;
  paymentReference: string;
  amount: number;
  deadline: string;
  status: 'pending' | 'expired' | 'confirmed';
  activity: {
    title: string;
    startDate: string;
    startTime: string;
    venue: {
      name: string;
      address: string;
    };
  };
  child: {
    firstName: string;
    lastName: string;
  };
  parent: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  tfcConfig: {
    providerName: string;
    providerNumber: string;
    instructionText: string;
    bankDetails: {
      accountName: string;
      sortCode: string;
      accountNumber: string;
    };
  };
}

const PendingPaymentPage: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<PendingBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [referenceCopied, setReferenceCopied] = useState(false);

  useEffect(() => {
    if (bookingId) {
      loadPendingBooking();
    }
  }, [bookingId]);

  const loadPendingBooking = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('bookon_token');

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://bookon-api.vercel.app'}/api/v1/tfc/booking/${bookingId}/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setBooking(data.data);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to load booking details');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load booking details');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyReference = () => {
    if (booking) {
      navigator.clipboard.writeText(booking.paymentReference);
      setReferenceCopied(true);
      setTimeout(() => setReferenceCopied(false), 2000);
    }
  };

  const handleResendInstructions = async () => {
    if (!booking) return;

    try {
      const token = localStorage.getItem('bookon_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://bookon-api.vercel.app'}/api/v1/tfc/booking/${booking.id}/resend-instructions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        alert('Payment instructions have been resent to your email');
      } else {
        throw new Error('Failed to resend instructions');
      }
    } catch (err) {
      alert('Failed to resend instructions. Please try again.');
    }
  };

  const formatDeadline = (deadline: string) => {
    const date = new Date(deadline);
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeRemaining = (deadline: string) => {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diff = deadlineDate.getTime() - now.getTime();

    if (diff <= 0) return 'Expired';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} remaining`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} remaining`;
    return `${minutes} minute${minutes > 1 ? 's' : ''} remaining`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading booking details...</p>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Booking Not Found</h1>
          <p className="text-gray-600 mb-4">{error || 'The requested booking could not be found.'}</p>
          <Button onClick={() => navigate('/dashboard')}>
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const timeRemaining = getTimeRemaining(booking.deadline);
  const isExpired = timeRemaining === 'Expired';
  const isUrgent = timeRemaining.includes('hour') || timeRemaining.includes('minute');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                onClick={() => navigate('/dashboard')}
                className="flex items-center space-x-2"
              >
                <ArrowLeftIcon className="w-4 h-4" />
                <span>Back to Dashboard</span>
              </Button>
            </div>
            <div className="text-right">
              <h1 className="text-2xl font-bold text-gray-900">Payment Pending</h1>
              <p className="text-gray-600">Tax-Free Childcare Payment Required</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Status Banner */}
          <div className={`border rounded-lg p-4 ${isExpired
              ? 'bg-red-50 border-red-200'
              : isUrgent
                ? 'bg-amber-50 border-amber-200'
                : 'bg-blue-50 border-blue-200'
            }`}>
            <div className="flex items-center space-x-3">
              {isExpired ? (
                <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
              ) : isUrgent ? (
                <ClockIcon className="w-6 h-6 text-amber-600" />
              ) : (
                <CheckCircleIcon className="w-6 h-6 text-blue-600" />
              )}
              <div>
                <h2 className={`font-semibold ${isExpired
                    ? 'text-red-900'
                    : isUrgent
                      ? 'text-amber-900'
                      : 'text-blue-900'
                  }`}>
                  {isExpired ? 'Payment Deadline Expired' : 'Payment Required'}
                </h2>
                <p className={`text-sm ${isExpired
                    ? 'text-red-700'
                    : isUrgent
                      ? 'text-amber-700'
                      : 'text-blue-700'
                  }`}>
                  {isExpired
                    ? 'This booking will be automatically cancelled'
                    : `Please complete payment by ${formatDeadline(booking.deadline)} (${timeRemaining})`
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Booking Details */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Booking Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Activity</label>
                <p className="text-gray-900">{booking.activity.title}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Child</label>
                <p className="text-gray-900">{booking.child.firstName} {booking.child.lastName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Date & Time</label>
                <p className="text-gray-900">
                  {new Date(booking.activity.startDate).toLocaleDateString('en-GB')} at {booking.activity.startTime}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Venue</label>
                <p className="text-gray-900">{booking.activity.venue.name}</p>
                <p className="text-sm text-gray-600">{booking.activity.venue.address}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Amount Due</label>
                <p className="text-lg font-semibold text-gray-900">£{booking.amount.toFixed(2)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Payment Reference</label>
                <div className="flex items-center space-x-2">
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                    {booking.paymentReference}
                  </code>
                  <button
                    onClick={handleCopyReference}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <ClipboardDocumentIcon className="w-4 h-4" />
                  </button>
                </div>
                {referenceCopied && (
                  <p className="text-xs text-green-600 mt-1">Reference copied!</p>
                )}
              </div>
            </div>
          </div>

          {/* Payment Instructions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Instructions</h3>

            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-green-600 font-semibold text-sm">1</span>
                </div>
                <div>
                  <p className="text-sm text-gray-900">
                    Log into your <strong>Tax-Free Childcare account</strong> at{' '}
                    <a
                      href="https://www.gov.uk/apply-tax-free-childcare"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      gov.uk/apply-tax-free-childcare
                    </a>
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-green-600 font-semibold text-sm">2</span>
                </div>
                <div>
                  <p className="text-sm text-gray-900">
                    Make a payment to <strong>{booking.tfcConfig.providerName}</strong> using reference: <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">{booking.paymentReference}</code>
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-green-600 font-semibold text-sm">3</span>
                </div>
                <div>
                  <p className="text-sm text-gray-900">
                    Your booking will be confirmed automatically once payment is received
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Provider Details */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Provider Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Provider Name</label>
                <p className="text-gray-900">{booking.tfcConfig.providerName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Provider Number</label>
                <p className="text-gray-900">{booking.tfcConfig.providerNumber}</p>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Need Help?</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <EnvelopeIcon className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-900">Email us at</p>
                  <a href="mailto:support@bookon.com" className="text-blue-600 hover:text-blue-800">
                    support@bookon.com
                  </a>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <PhoneIcon className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-900">Call us on</p>
                  <a href="tel:+441234567890" className="text-blue-600 hover:text-blue-800">
                    01234 567890
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-4">
            <Button
              onClick={handleResendInstructions}
              variant="outline"
              className="flex items-center space-x-2"
            >
              <EnvelopeIcon className="w-4 h-4" />
              <span>Resend Instructions</span>
            </Button>
            <Button
              onClick={() => navigate('/dashboard')}
              className="flex items-center space-x-2"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PendingPaymentPage;