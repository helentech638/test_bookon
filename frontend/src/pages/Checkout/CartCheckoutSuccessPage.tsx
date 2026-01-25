import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { 
  CheckCircleIcon,
  DocumentArrowDownIcon,
  ArrowRightIcon,
  CalendarDaysIcon,
  CurrencyPoundIcon,
  TagIcon,
  CreditCardIcon
} from '@heroicons/react/24/outline';
import { buildApiUrl } from '../../config/api';
import { authService } from '../../services/authService';
import toast from 'react-hot-toast';

interface CartSuccessData {
  success: boolean;
  message: string;
  bookingIds: string[];
  paymentData?: any;
  totalAmount: number;
  discountAmount: number;
  creditAmount: number;
}

const CartCheckoutSuccessPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(10);
  const [downloading, setDownloading] = useState(false);

  const successData: CartSuccessData = location.state;

  useEffect(() => {
    if (!successData?.success) {
      navigate('/bookings');
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          navigate('/bookings');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [successData, navigate]);

  const downloadInvoice = async () => {
    if (!successData.paymentData?.paymentId) {
      toast.error('Payment data not available for invoice generation');
      return;
    }

    try {
      setDownloading(true);
      const token = authService.getToken();
      
      const response = await fetch(buildApiUrl('/payments/download-receipt'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentId: successData.paymentData.paymentId,
          type: 'cart_checkout'
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${successData.paymentData.paymentId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Invoice downloaded successfully!');
      } else {
        throw new Error('Failed to download invoice');
      }
    } catch (error) {
      console.error('Error downloading invoice:', error);
      toast.error('Failed to download invoice. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const sendConfirmationEmail = async () => {
    if (!successData.paymentData?.paymentId) {
      toast.error('Payment data not available for email confirmation');
      return;
    }

    try {
      const token = authService.getToken();
      
      const response = await fetch(buildApiUrl('/payments/send-confirmation'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentId: successData.paymentData.paymentId,
          type: 'cart_checkout',
          bookingIds: successData.bookingIds
        }),
      });

      if (response.ok) {
        toast.success('Confirmation email sent successfully!');
      } else {
        throw new Error('Failed to send confirmation email');
      }
    } catch (error) {
      console.error('Error sending confirmation email:', error);
      toast.error('Failed to send confirmation email. Please try again.');
    }
  };

  if (!successData?.success) {
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Card className="p-8 text-center">
        <div className="mb-6">
          <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
          <p className="text-gray-600">{successData.message}</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Summary</h2>
          
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Amount</span>
              <span className="font-semibold text-gray-900">£{successData.totalAmount.toFixed(2)}</span>
            </div>
            
            {successData.discountAmount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount Applied</span>
                <span>-£{successData.discountAmount.toFixed(2)}</span>
              </div>
            )}
            
            {successData.creditAmount > 0 && (
              <div className="flex justify-between text-blue-600">
                <span>Credit Applied</span>
                <span>-£{successData.creditAmount.toFixed(2)}</span>
              </div>
            )}
            
            <div className="flex justify-between text-lg font-semibold border-t pt-3">
              <span>Final Amount</span>
              <span className="text-teal-600">
                £{(successData.totalAmount - successData.discountAmount - successData.creditAmount).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <Button
            onClick={downloadInvoice}
            disabled={downloading}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white"
          >
            <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
            {downloading ? 'Generating Invoice...' : 'Download Invoice'}
          </Button>
          
          <Button
            onClick={sendConfirmationEmail}
            variant="outline"
            className="w-full border-teal-600 text-teal-600 hover:bg-teal-600 hover:text-white"
          >
            <CalendarDaysIcon className="h-5 w-5 mr-2" />
            Send Confirmation Email
          </Button>
        </div>

        <div className="text-sm text-gray-500 mb-4">
          <p>Redirecting to your bookings in {countdown} seconds...</p>
        </div>

        <div className="flex gap-4">
          <Button
            onClick={() => navigate('/bookings')}
            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white"
          >
            View My Bookings
            <ArrowRightIcon className="h-4 w-4 ml-2" />
          </Button>
          
          <Button
            onClick={() => navigate('/activities')}
            variant="outline"
            className="flex-1 border-teal-600 text-teal-600 hover:bg-teal-600 hover:text-white"
          >
            Browse More Activities
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default CartCheckoutSuccessPage;



