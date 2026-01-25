import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBasket } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import StripePayment from '../../components/payment/StripePayment';
import PaymentSuccess from '../../components/payment/PaymentSuccess';
import { 
  ArrowLeftIcon,
  CreditCardIcon,
  TagIcon,
  CurrencyPoundIcon
} from '@heroicons/react/24/outline';
import { buildApiUrl } from '../../config/api';
import { authService } from '../../services/authService';
import toast from 'react-hot-toast';

interface CartPaymentData {
  id: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: string;
}

const CartPaymentPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { clearBasket } = useBasket();
  const { user } = useAuth();
  
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  const [successData, setSuccessData] = useState<any>(null);
  const [processing, setProcessing] = useState(false);

  const paymentIntentData: CartPaymentData = location.state?.paymentIntent;
  const checkoutData = location.state?.checkoutData;
  const discountData = location.state?.discountData;
  const creditAmount = location.state?.creditAmount || 0;

  // Handle both old and new data structures
  const items = checkoutData?.items || checkoutData?.basketItems || [];

  if (!paymentIntentData || !checkoutData) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Payment Error</h1>
          <p className="text-gray-600 mb-6">No payment data found. Please try again.</p>
          <Button onClick={() => navigate('/basket')} className="bg-teal-600 hover:bg-teal-700">
            Return to Basket
          </Button>
        </div>
      </div>
    );
  }

  const handlePaymentSuccess = async (paymentIntentId: string) => {
    try {
      setProcessing(true);
      
      // Confirm payment with backend (following course checkout pattern)
      const token = authService.getToken();
      const response = await fetch(buildApiUrl('/payments/confirm'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentIntentId: paymentIntentId,
          bookingIds: location.state?.bookingIds || []
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuccessData({
          paymentIntentId,
          amount: (paymentIntentData?.amount || 0) / 100, // Convert from pence to pounds
          currency: paymentIntentData?.currency || 'gbp',
          bookingData: data.bookingData,
          totalAmount: checkoutData?.subtotal || checkoutData?.totalPrice || 0,
          discountAmount: checkoutData?.discountAmount || 0,
          creditAmount: creditAmount
        });
        
        clearBasket();
        setShowPaymentSuccess(true);
        toast.success('Payment successful! Your bookings have been confirmed.');
      } else {
        const errorData = await response.json();
        console.error('Backend confirmation failed:', errorData);
        // Even if backend confirmation fails, if Stripe says payment succeeded, show success
        console.warn('Backend confirmation failed, but Stripe payment succeeded. Showing success screen.');
        toast.success('Payment successful! (Backend sync pending)');
        
        setSuccessData({
          paymentIntentId,
          amount: (paymentIntentData?.amount || 0) / 100, // Convert from pence to pounds
          currency: paymentIntentData?.currency || 'gbp',
          totalAmount: checkoutData?.subtotal || checkoutData?.totalPrice || 0,
          discountAmount: checkoutData?.discountAmount || 0,
          creditAmount: creditAmount
        });
        
        clearBasket();
        setShowPaymentSuccess(true);
      }
    } catch (error) {
      console.error('Error confirming payment:', error);
      toast.error('Payment confirmation failed. Please contact support.');
    } finally {
      setProcessing(false);
    }
  };

  const handlePaymentError = (error: string) => {
    toast.error(`Payment failed: ${error}`);
  };

  const handlePaymentCancel = () => {
    navigate('/basket');
  };

  if (showPaymentSuccess && successData) {
    return (
      <PaymentSuccess
        paymentIntentId={successData.paymentIntentId}
        amount={successData.amount}
        currency={successData.currency}
        bookingData={successData.bookingData}
        onRedirect={() => navigate('/bookings', {
          state: {
            success: true,
            message: 'Your bookings have been completed successfully!',
            bookingData: successData.bookingData
          }
        })}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            onClick={() => navigate('/basket')}
            variant="outline"
            className="mb-6 text-teal-600 border-teal-200 hover:bg-teal-50 hover:border-teal-300 transition-all duration-200 shadow-sm"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Basket
          </Button>
          <div className="text-center">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-teal-800 to-teal-600 bg-clip-text text-transparent">
              Complete Payment
            </h1>
            <p className="text-gray-600 mt-3 text-lg">Secure payment for your selected activities</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Order Summary */}
          <div className="order-2 lg:order-1">
            <Card className="p-8 bg-white/80 backdrop-blur-sm border-0 shadow-xl">
              <div className="flex items-center mb-6">
                <div className="w-10 h-10 bg-gradient-to-r from-teal-500 to-teal-600 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Order Summary</h2>
              </div>
              
              <div className="space-y-6">
                {items.map((item: any, index: number) => (
                  <div key={index} className="group p-6 rounded-xl bg-gradient-to-r from-gray-50 to-teal-50/30 border border-gray-100 hover:border-teal-200 transition-all duration-200">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-lg">{item.activityName}</h3>
                        <p className="text-gray-600 mt-3 flex items-center">
                          <svg className="w-4 h-4 mr-2 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {new Date(item.date).toLocaleDateString()} at {item.time}
                        </p>
                        
                        {/* Show children names */}
                        <div className="mt-3">
                          <p className="text-sm font-medium text-gray-700 flex items-center">
                            <svg className="w-4 h-4 mr-2 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                            </svg>
                            {item.children.length} child{item.children.length > 1 ? 'ren' : ''}:
                          </p>
                          <div className="ml-6 space-y-1 mt-2">
                            {item.children.map((child: any, childIndex: number) => (
                              <p key={childIndex} className="text-sm text-gray-600 flex items-center">
                                <span className="w-2 h-2 bg-teal-400 rounded-full mr-2"></span>
                                {child.name}
                              </p>
                            ))}
                          </div>
                        </div>

                        {/* Show pro-rata information if available */}
                        {(item as any).bookingType === 'course' && (item as any).pricePerChild && (
                          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <p className="text-xs text-blue-700 font-medium">
                              Pro-rata pricing: £{(item as any).pricePerChild.toFixed(2)} per child
                              {item.children.length > 1 && (
                                <span className="ml-1">
                                  (Total: £{item.price.toFixed(2)})
                                </span>
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="text-right ml-6">
                        <span className="text-2xl font-bold text-teal-600">£{item.price.toFixed(2)}</span>
                        {(item as any).bookingType === 'course' && (item as any).pricePerChild && item.children.length > 1 && (
                          <p className="text-sm text-gray-500 mt-1">
                            £{(item as any).pricePerChild.toFixed(2)} × {item.children.length}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-8 p-6 bg-gradient-to-r from-teal-50 to-emerald-50 rounded-xl border border-teal-100">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 font-medium">Subtotal</span>
                    <span className="font-semibold text-gray-900 text-lg">£{(checkoutData?.subtotal || checkoutData?.totalPrice || 0).toFixed(2)}</span>
                  </div>
                  
                  {(checkoutData?.discountAmount || 0) > 0 && (
                    <div className="flex justify-between items-center text-green-600">
                      <span className="font-medium">Discount ({discountData?.code})</span>
                      <span className="font-semibold">-£{(checkoutData?.discountAmount || 0).toFixed(2)}</span>
                    </div>
                  )}
                  
                  {creditAmount > 0 && (
                    <div className="flex justify-between items-center text-blue-600">
                      <span className="font-medium">Credit Applied</span>
                      <span className="font-semibold">-£{creditAmount.toFixed(2)}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center pt-4 border-t border-teal-200">
                    <span className="text-xl font-bold text-gray-900">Total</span>
                    <span className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
                      £{((paymentIntentData?.amount || 0) / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Payment Form */}
          <div className="order-1 lg:order-2">
            <Card className="p-8 bg-white/90 backdrop-blur-sm border-0 shadow-xl">
              <div className="flex items-center mb-8">
                <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Payment Details</h2>
              </div>
              
              <div className="space-y-6">
                <StripePayment
                  amount={(paymentIntentData?.amount || 0) / 100}
                  currency={paymentIntentData?.currency || 'gbp'}
                  bookingId={paymentIntentData?.id || 'basket-checkout'}
                  existingPaymentIntent={paymentIntentData}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                  onCancel={handlePaymentCancel}
                />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartPaymentPage;
