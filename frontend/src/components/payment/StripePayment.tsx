import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from '../ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { toast } from 'react-hot-toast';


// Load Stripe outside of component to avoid recreating on every render
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || 'pk_test_51PECokC72BSUnGiGkjD4pT3lypwmHfdIK8Rwm53A1Que6aCkvgDK9PXnerc3y92TXELG5IN4PDXSItIf5a9hEhZv00N6DU5vVu');

// Debug Stripe key (removed for security)
// console.log('Stripe publishable key:', process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || 'pk_test_51ABC123DEF456GHI789JKL012MNO345PQR678STU901VWX234YZA567BCD890EFG');

interface StripePaymentFormProps {
  amount: number;
  currency: string;
  bookingId: string;
  venueId?: string;
  activityId?: string;
  childId?: string;
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
  onCancel: () => void;
  existingPaymentIntent?: any; // Add this prop for existing payment intents
}

const PaymentForm: React.FC<StripePaymentFormProps> = ({
  amount,
  currency,
  bookingId,
  venueId,
  activityId,
  childId,
  onSuccess,
  onError,
  onCancel,
  existingPaymentIntent
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripeLoadingTimeout, setStripeLoadingTimeout] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  useEffect(() => {
    // Create payment intent when component mounts
    createPaymentIntent();
  }, []);

  // Debug Stripe loading
  useEffect(() => {
  }, [stripe, elements, clientSecret]);

  // Set timeout for Stripe loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!stripe) {
        console.warn('Stripe loading timeout - enabling button anyway');
        setStripeLoadingTimeout(true);
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeout);
  }, [stripe]);

  const createPaymentIntent = async () => {
    try {
      setIsProcessing(true);
      const token = localStorage.getItem('bookon_token');
      
      // If bookingId is temporary, create a real booking first
      let actualBookingId = bookingId;
      if (bookingId.startsWith('temp-')) {
        
        // Validate required fields
        if (!activityId || !childId) {
          throw new Error('Missing required fields: activityId or childId');
        }
        
        // First, check if a booking already exists
        const existingBookingsResponse = await fetch(`${process.env.REACT_APP_API_URL || 'https://bookon-api.vercel.app'}/api/v1/bookings`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (existingBookingsResponse.ok) {
          const existingBookings = await existingBookingsResponse.json();
          const existingBooking = existingBookings.data?.find((booking: any) => 
            booking.activityId === activityId && 
            booking.childId === childId && 
            booking.status === 'pending'
          );
          
          if (existingBooking) {
            actualBookingId = existingBooking.id;
          } else {
            // Create a new booking
            const bookingResponse = await fetch(`${process.env.REACT_APP_API_URL || 'https://bookon-api.vercel.app'}/api/v1/bookings`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({
                activityId: activityId,
                childId: childId,
                startDate: new Date().toISOString().split('T')[0], // Today's date
                startTime: '09:00', // Default time
                notes: 'Stripe payment booking'
              }),
            });
            
            if (!bookingResponse.ok) {
              const errorText = await bookingResponse.text();
              console.error('Booking creation failed:', bookingResponse.status, errorText);
              throw new Error(`Failed to create booking: ${bookingResponse.status}`);
            }
            
            const bookingData = await bookingResponse.json();
            actualBookingId = bookingData.data.id;
          }
        } else {
          // If we can't fetch existing bookings, try to create a new one
          const bookingResponse = await fetch(`${process.env.REACT_APP_API_URL || 'https://bookon-api.vercel.app'}/api/v1/bookings`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              activityId: activityId,
              childId: childId,
              startDate: new Date().toISOString().split('T')[0], // Today's date
              startTime: '09:00', // Default time
              notes: 'Stripe payment booking'
            }),
          });
          
          if (!bookingResponse.ok) {
            const errorText = await bookingResponse.text();
            console.error('Booking creation failed:', bookingResponse.status, errorText);
            throw new Error(`Failed to create booking: ${bookingResponse.status}`);
          }
          
          const bookingData = await bookingResponse.json();
          actualBookingId = bookingData.data.id;
        }
        
        // Validate that we got a valid UUID
        if (!actualBookingId || typeof actualBookingId !== 'string') {
          throw new Error('Invalid booking ID received from server');
        }
      }
      
      // Use existing payment intent if provided, otherwise create new one
      if (existingPaymentIntent) {
        setClientSecret(existingPaymentIntent.client_secret || existingPaymentIntent.clientSecret);
        return;
      }
      
      
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'https://bookon-api.vercel.app'}/api/v1/payments/create-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          bookingId: actualBookingId,
          amount: typeof amount === 'string' ? parseFloat(amount) : amount,
          currency: currency.toLowerCase(),
          venueId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Payment intent creation failed:', response.status, errorText);
        throw new Error(`Failed to create payment intent: ${response.status}`);
      }

      const data = await response.json();
      // Backend responds with { success: true, data: { clientSecret, paymentIntentId, ... } }
      const secret = data?.clientSecret || data?.data?.clientSecret || null;
      if (!secret) {
        console.error('Missing clientSecret in response payload:', data);
        throw new Error('Missing client secret');
      }
      setClientSecret(secret);
    } catch (error) {
      console.error('Error creating payment intent:', error);
      onError('Failed to initialize payment. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements || !clientSecret) {
      return;
    }

    setIsProcessing(true);

    try {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
        },
      });

      if (error) {
        onError(error.message || 'Payment failed');
        return;
      }

      if (!paymentIntent) {
        onError('No payment intent returned');
        return;
      }

      if (paymentIntent.status === 'succeeded') {
        // Debug: Log the payment intent ID from Stripe
        // Call backend to confirm payment and update database
        const token = localStorage.getItem('bookon_token');
        
        const confirmResponse = await fetch(`${process.env.REACT_APP_API_URL || 'https://bookon-api.vercel.app'}/api/v1/payments/confirm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            paymentIntentId: paymentIntent.id,
          }),
        });

        if (confirmResponse.ok) {
          toast.success('Payment successful!');
          onSuccess(paymentIntent.id);
        } else {
          const errorData = await confirmResponse.json();
          console.error('Backend confirmation failed:', errorData);
          // Even if backend confirmation fails, if Stripe says payment succeeded, show success
          // The backend can catch up later via webhooks
          console.warn('Backend confirmation failed, but Stripe payment succeeded. Showing success screen.');
          toast.success('Payment successful! (Backend sync pending)');
          onSuccess(paymentIntent.id);
        }
      } else {
        onError('Payment was not completed');
      }
    } catch (error) {
      console.error('Payment error:', error);
      onError('An unexpected error occurred. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        '::placeholder': {
          color: '#aab7c4',
        },
      },
      invalid: {
        color: '#9e2146',
      },
    },
  };

  if (!showPaymentForm) {
  return (
      <div className="space-y-4">
        {/* Premium Payment Summary Card */}
        <div className="bg-gradient-to-br from-white to-teal-50 border border-teal-200 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-teal-600 rounded-full flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Secure Payment</h3>
                <p className="text-sm text-gray-600">Powered by Stripe</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-teal-600">
                {new Intl.NumberFormat('en-GB', {
                  style: 'currency',
                  currency: currency.toUpperCase(),
                }).format(amount)}
              </div>
              <p className="text-xs text-gray-500">Total Amount</p>
            </div>
          </div>
          
          <div className="bg-white/60 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">🔒 SSL Encrypted</span>
              <span className="text-gray-600">💳 All major cards</span>
              <span className="text-gray-600">⚡ Instant confirmation</span>
            </div>
          </div>

          <Button
            onClick={() => setShowPaymentForm(true)}
            disabled={isProcessing}
            className="w-full bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
          >
            <div className="flex items-center justify-center space-x-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Proceed to Payment</span>
            </div>
          </Button>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isProcessing}
          className="w-full border-gray-300 text-gray-600 hover:bg-gray-50"
        >
          Cancel Payment
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Premium Payment Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white border-2 border-teal-200 rounded-xl p-6 shadow-lg">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-teal-500 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Card Details</h3>
              <p className="text-sm text-gray-600">Enter your payment information</p>
            </div>
          </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
                Card Number, Expiry Date & CVC
          </label>
              <div className="border-2 border-gray-200 rounded-lg p-4 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-200 transition-all duration-200 bg-white shadow-sm">
            <CardElement options={cardElementOptions} />
          </div>
        </div>

            <div className="bg-teal-50 rounded-lg p-4 border border-teal-200">
          <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">Total Amount:</span>
                </div>
                <span className="text-xl font-bold text-teal-600">
              {new Intl.NumberFormat('en-GB', {
                style: 'currency',
                currency: currency.toUpperCase(),
              }).format(amount)}
            </span>
              </div>
          </div>
        </div>
      </div>

      <div className="flex space-x-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isProcessing}
            className="flex-1 border-gray-300 text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={(!stripe && !stripeLoadingTimeout) || isProcessing || !clientSecret}
            className="flex-1 bg-teal-500 hover:bg-teal-600 text-white font-semibold py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300"
            onClick={() => {
              handleSubmit({} as React.FormEvent);
            }}
          >
            {isProcessing ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Processing...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>Pay Now</span>
              </div>
            )}
        </Button>
      </div>
    </form>
    </div>
  );
};

const StripePayment: React.FC<StripePaymentFormProps> = (props) => {
  return (
    <Elements stripe={stripePromise}>
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Complete Payment</CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentForm {...props} />
        </CardContent>
      </Card>
    </Elements>
  );
};

export default StripePayment;
