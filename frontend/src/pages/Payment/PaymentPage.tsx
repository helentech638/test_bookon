import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { Button } from '../../components/ui/Button';
import PaymentForm from '../../components/payment/PaymentForm';
import { authService } from '../../services/authService';
import { buildApiUrl } from '../../config/api';
import toast from 'react-hot-toast';

interface PaymentData {
  activityId: string;
  childId: string;
  originalAmount: number;
  promoDiscount: number;
  creditAmount: number;
  finalAmount: number;
  promoCode?: string;
  creditId?: string;
  // Stripe-specific data
  paymentIntentId?: string;
  clientSecret?: string;
  bookingIds?: string[];
}

interface Activity {
  id: string;
  title: string;
  venue: {
    id: string;
    name: string;
  };
}

const PaymentPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get payment data from navigation state
  const paymentData = location.state as PaymentData;

  useEffect(() => {
    if (!paymentData) {
      setError('No payment data provided');
      setLoading(false);
      return;
    }

    fetchActivityDetails();
  }, [paymentData]);

  const fetchActivityDetails = async () => {
    try {
      setLoading(true);
      const token = authService.getToken();
      
      if (!token) {
        toast.error('Authentication required');
        navigate('/login');
        return;
      }

      const response = await fetch(buildApiUrl(`/activities/${paymentData.activityId}`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch activity details');
      }

      const data = await response.json();
      setActivity(data.data);
    } catch (err) {
      console.error('Error fetching activity:', err);
      setError('Failed to load activity details');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async (paymentIntentId: string) => {
    try {
      const token = authService.getToken();
      if (!token) {
        toast.error('Authentication required');
        navigate('/login');
        return;
      }

      // Create the booking
      const response = await fetch(buildApiUrl('/bookings'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          activityId: paymentData.activityId,
          childId: paymentData.childId,
          status: 'confirmed',
          paymentIntentId,
          promoCode: paymentData.promoCode,
          creditId: paymentData.creditId
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('Booking confirmed successfully!');
        
        // Navigate to payment success page
        navigate(`/payment-success/${data.data.id}`);
      } else if (response.status === 401) {
        toast.error('Session expired. Please login again.');
        authService.logout();
        navigate('/login');
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Failed to create booking');
      }
    } catch (error) {
      console.error('Error creating booking:', error);
      toast.error('Error creating booking');
    }
  };

  const handlePaymentCancel = () => {
    navigate(-1); // Go back to checkout
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00806a]"></div>
        </div>
      </div>
    );
  }

  if (error || !paymentData || !activity) {
    return (
      <div className="min-h-screen bg-white">
        <div className="flex items-center justify-center h-screen px-4">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
            <p className="text-gray-600 mb-4">{error || 'No payment data available'}</p>
            <Button onClick={() => navigate('/activities')}>
              Back to Activities
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Mobile Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <button
          onClick={handlePaymentCancel}
          className="p-2 -ml-2"
        >
          <ArrowLeftIcon className="h-6 w-6 text-gray-600" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900">Payment</h1>
        <div className="w-10"></div> {/* Spacer for centering */}
      </div>

      <div className="px-4 py-6">
        <PaymentForm
          amount={paymentData.finalAmount}
          currency="GBP"
          bookingId={paymentData.bookingIds?.[0] || paymentData.activityId} // Use first booking ID if available, fallback to activity ID
          childId={paymentData.childId}
          venueId={activity.venue.id}
          activityName={activity.title}
          venueName={activity.venue.name}
          onSuccess={handlePaymentSuccess}
          onCancel={handlePaymentCancel}
        />
      </div>
    </div>
  );
};

export default PaymentPage;
