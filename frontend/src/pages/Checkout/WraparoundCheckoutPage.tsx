import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  ArrowLeftIcon, 
  CreditCardIcon, 
  TagIcon, 
  GiftIcon, 
  CheckIcon,
  ClockIcon,
  UserGroupIcon,
  CalendarDaysIcon
} from '@heroicons/react/24/outline';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { authService } from '../../services/authService';
import { buildApiUrl } from '../../config/api';
import toast from 'react-hot-toast';

interface SessionBlock {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  price: number;
}

interface BookingItem {
  childId: string;
  childName: string;
  sessionId: string;
  sessionBlockId: string;
  sessionDate: string;
  sessionName: string;
  startTime: string;
  endTime: string;
  price: number;
}

interface Activity {
  id: string;
  title: string;
  description: string;
  venue: {
    name: string;
    address: string;
  };
  isWraparoundCare: boolean;
}

interface Credit {
  id: string;
  amount: number;
  usedAmount: number;
  expiresAt: string;
  description: string;
}

interface PromoCodeResult {
  success: boolean;
  data?: {
    code: string;
    name: string;
    type: string;
    discountAmount: number;
    finalAmount: number;
  };
  message?: string;
}

const WraparoundCheckoutPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const [activity, setActivity] = useState<Activity | null>(null);
  const [bookingItems, setBookingItems] = useState<BookingItem[]>([]);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [selectedCredits, setSelectedCredits] = useState<string[]>([]);
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState<PromoCodeResult | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'tfc'>('card');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    // Get booking data from location state
    const state = location.state as { activity: Activity; bookingItems: BookingItem[] };
    if (state?.activity && state?.bookingItems) {
      setActivity(state.activity);
      setBookingItems(state.bookingItems);
      fetchCredits();
    } else {
      toast.error('No booking data found');
      navigate('/activities');
    }
    setLoading(false);
  }, [location.state, navigate]);

  const fetchCredits = async () => {
    try {
      const token = authService.getToken();
      if (!token) return;

      const response = await fetch(buildApiUrl('/wallet/credits'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCredits(data.data || []);
        }
      } else if (response.status === 404) {
        // Credits endpoint doesn't exist yet, set empty array
        console.log('Credits endpoint not available, using empty credits');
        setCredits([]);
      }
    } catch (error) {
      console.error('Error fetching credits:', error);
      // Set empty credits array on error
      setCredits([]);
    }
  };

  const applyPromoCode = async () => {
    if (!promoCode.trim()) {
      toast.error('Please enter a promo code');
      return;
    }

    try {
      const token = authService.getToken();
      if (!token) return;

      const response = await fetch(buildApiUrl('/promo-codes/validate'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: promoCode,
          amount: getSubtotal()
        })
      });

      const data = await response.json();
      setPromoResult(data);
      
      if (data.success) {
        toast.success('Promo code applied successfully!');
      } else {
        toast.error(data.message || 'Invalid promo code');
      }
    } catch (error) {
      console.error('Error applying promo code:', error);
      toast.error('Failed to apply promo code');
    }
  };

  const getSubtotal = () => {
    return bookingItems.reduce((total, item) => total + item.price, 0);
  };

  const getCreditsTotal = () => {
    return selectedCredits.reduce((total, creditId) => {
      const credit = credits.find(c => c.id === creditId);
      return total + (credit ? credit.amount - credit.usedAmount : 0);
    }, 0);
  };

  const getDiscountAmount = () => {
    return promoResult?.data?.discountAmount || 0;
  };

  const getTotal = () => {
    const subtotal = getSubtotal();
    const creditsTotal = getCreditsTotal();
    const discountAmount = getDiscountAmount();
    return Math.max(0, subtotal - creditsTotal - discountAmount);
  };

  const toggleCredit = (creditId: string) => {
    setSelectedCredits(prev => 
      prev.includes(creditId) 
        ? prev.filter(id => id !== creditId)
        : [...prev, creditId]
    );
  };

  const groupBookingsByChild = () => {
    const grouped: { [childId: string]: BookingItem[] } = {};
    bookingItems.forEach(item => {
      if (!grouped[item.childId]) {
        grouped[item.childId] = [];
      }
      grouped[item.childId].push(item);
    });
    return grouped;
  };

  const processPayment = async () => {
    if (getTotal() <= 0 && selectedCredits.length === 0) {
      toast.error('Please select a payment method');
      return;
    }

    try {
      setProcessing(true);
      const token = authService.getToken();
      if (!token) {
        navigate('/login');
        return;
      }

      // Create bookings sequentially to avoid race conditions
      const results = [];
      
      for (const item of bookingItems) {
        const bookingData = {
          activityId: activity?.id,
          sessionBlockId: item.sessionBlockId,
          childId: item.childId,
          startDate: item.sessionDate,
          startTime: item.startTime,
          amount: parseFloat(String(item.price || 0)),
          paymentMethod: paymentMethod,
          promoCode: promoCode || null,
          creditsUsed: selectedCredits
        };
        
        console.log('Creating wraparound booking with data:', bookingData);
        console.log('Activity ID:', activity?.id);
        console.log('Session Date:', item.sessionDate);
        console.log('Start Time:', item.startTime);
        console.log('Session Block ID:', item.sessionBlockId);
        
        // Validate required fields
        if (!activity?.id) {
          throw new Error('Activity ID is missing');
        }
        if (!item.childId) {
          throw new Error('Child ID is missing');
        }
        if (!item.sessionDate) {
          throw new Error('Session date is missing');
        }
        if (!item.startTime) {
          throw new Error('Start time is missing');
        }
        if (!item.sessionBlockId) {
          throw new Error('Session block ID is missing');
        }
        
        const response = await fetch(buildApiUrl('/bookings'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(bookingData)
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Wraparound booking creation failed:', response.status, errorText);
          throw new Error(`Failed to create booking: ${response.status} ${errorText}`);
        }

        const result = await response.json();
        results.push(result);
      }

      // If using card payment and total > 0, redirect to Stripe
      if (paymentMethod === 'card' && getTotal() > 0) {
        // Create payment intent
        const paymentResponse = await fetch(buildApiUrl('/payments/create-intent'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: getTotal() * 100, // Convert to pence
            currency: 'gbp',
            bookingIds: results.map(r => r.data.id),
            metadata: {
              activityId: activity?.id,
              sessionCount: bookingItems.length
            }
          })
        });

        const paymentData = await paymentResponse.json();
        if (paymentData.success) {
          // Redirect to Stripe Checkout
          window.location.href = paymentData.data.url;
          return;
        } else {
          throw new Error('Failed to create payment intent');
        }
      }

      // If using credits only or TFC, bookings are already created
      toast.success('Bookings created successfully!');
      navigate('/bookings');
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error('Failed to process payment');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00806a]"></div>
      </div>
    );
  }

  if (!activity || !bookingItems.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Booking Data</h2>
          <p className="text-gray-600 mb-4">Please select sessions to book first.</p>
          <Button onClick={() => navigate('/activities')}>
            Back to Activities
          </Button>
        </div>
      </div>
    );
  }

  const groupedBookings = groupBookingsByChild();
  const subtotal = getSubtotal();
  const creditsTotal = getCreditsTotal();
  const discountAmount = getDiscountAmount();
  const total = getTotal();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back to Booking
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Checkout</h1>
          <p className="text-gray-600 mt-1">Complete your wraparound care booking</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Booking Summary */}
          <div className="lg:col-span-2 space-y-6">
            {/* Activity Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CalendarDaysIcon className="w-5 h-5 mr-2" />
                  {activity.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-600">
                  <p className="mb-1">{activity.venue.name}</p>
                  <p>{activity.venue.address}</p>
                </div>
              </CardContent>
            </Card>

            {/* Session Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <ClockIcon className="w-5 h-5 mr-2" />
                  Session Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(groupedBookings).map(([childId, childBookings]) => (
                    <div key={childId} className="border border-gray-200 rounded-lg p-4">
                      <h3 className="font-medium text-gray-900 mb-3">
                        {childBookings[0].childName}
                      </h3>
                      <div className="space-y-2">
                        {childBookings.map((booking, index) => (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <div className="flex items-center">
                              <ClockIcon className="w-4 h-4 mr-2 text-gray-400" />
                              <div>
                                <div className="font-medium">{booking.sessionName}</div>
                                <div className="text-gray-500">
                                  {new Date(booking.sessionDate).toLocaleDateString('en-GB')} • 
                                  {booking.startTime} - {booking.endTime}
                                </div>
                              </div>
                            </div>
                            <div className="font-medium">£{booking.price.toFixed(2)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Payment Method */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCardIcon className="w-5 h-5 mr-2" />
                  Payment Method
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex space-x-4">
                    <button
                      onClick={() => setPaymentMethod('card')}
                      className={`flex items-center px-4 py-2 border rounded-lg transition-colors ${
                        paymentMethod === 'card'
                          ? 'border-[#00806a] bg-[#00806a] text-white'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <CreditCardIcon className="w-5 h-5 mr-2" />
                      Card Payment
                    </button>
                    <button
                      onClick={() => setPaymentMethod('tfc')}
                      className={`flex items-center px-4 py-2 border rounded-lg transition-colors ${
                        paymentMethod === 'tfc'
                          ? 'border-[#00806a] bg-[#00806a] text-white'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <TagIcon className="w-5 h-5 mr-2" />
                      Tax-Free Childcare
                    </button>
                  </div>
                  
                  {paymentMethod === 'tfc' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-medium text-blue-900 mb-2">Tax-Free Childcare Instructions</h4>
                      <p className="text-sm text-blue-800 mb-2">
                        Your booking will be held as pending until payment is received.
                      </p>
                      <p className="text-sm text-blue-800">
                        Please use reference: <span className="font-mono font-medium">TFC-{Date.now()}</span>
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-8">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Subtotal */}
                  <div className="flex justify-between">
                    <span>Subtotal ({bookingItems.length} sessions)</span>
                    <span>£{subtotal.toFixed(2)}</span>
                  </div>

                  {/* Credits */}
                  {credits.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-gray-700">Available Credits</div>
                      {credits.map(credit => (
                        <label key={credit.id} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedCredits.includes(credit.id)}
                            onChange={() => toggleCredit(credit.id)}
                            className="mr-2"
                          />
                          <span className="text-sm">
                            {credit.description} - £{(credit.amount - credit.usedAmount).toFixed(2)}
                          </span>
                        </label>
                      ))}
                      {creditsTotal > 0 && (
                        <div className="flex justify-between text-sm">
                          <span>Credits Applied</span>
                          <span className="text-green-600">-£{creditsTotal.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Promo Code */}
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-gray-700">Promo Code</div>
                    <div className="flex space-x-2">
                      <Input
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        placeholder="Enter promo code"
                        className="flex-1"
                      />
                      <Button
                        size="sm"
                        onClick={applyPromoCode}
                        disabled={!promoCode.trim()}
                      >
                        Apply
                      </Button>
                    </div>
                    {promoResult && (
                      <div className={`text-sm ${promoResult.success ? 'text-green-600' : 'text-red-600'}`}>
                        {promoResult.success ? (
                          <div>
                            <div>✓ {promoResult.data?.name}</div>
                            <div>Discount: £{promoResult.data?.discountAmount.toFixed(2)}</div>
                          </div>
                        ) : (
                          promoResult.message
                        )}
                      </div>
                    )}
                  </div>

                  {/* Total */}
                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex justify-between text-lg font-semibold">
                      <span>Total</span>
                      <span>£{total.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Checkout Button */}
                  <Button
                    onClick={processPayment}
                    disabled={processing || (paymentMethod === 'card' && total <= 0)}
                    className="w-full bg-[#00806a] hover:bg-[#006b5a] text-white"
                  >
                    {processing ? 'Processing...' : 
                     paymentMethod === 'card' ? 'Pay with Card' : 'Complete Booking'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WraparoundCheckoutPage;
