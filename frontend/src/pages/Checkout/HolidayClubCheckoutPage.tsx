import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/authService';
import { buildApiUrl } from '../../config/api';
import { toast } from 'react-hot-toast';
import { 
  CreditCard,
  Banknote
} from 'lucide-react';
import { 
  ArrowLeftIcon,
  CheckIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

interface BookingItem {
  childId: string;
  childName: string;
  sessionId: string;
  holidayTimeSlotId: string;
  sessionDate: string;
  sessionName: string;
  startTime: string;
  endTime: string;
  price: number;
}

interface Activity {
  id: string;
  title: string;
  venue: {
    name: string;
  };
  startTime?: string;
  earlyDropoffStartTime?: string;
  holidayTimeSlots?: Array<{
    name: string;
    startTime: string;
    endTime: string;
    price: number;
  }>;
  siblingDiscount?: number;
  bulkDiscount?: number;
  weeklyDiscount?: number;
}

const HolidayClubCheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const { activity, bookingItems } = location.state || {};
  
  // Calculate total from booking items if not provided
  const total = bookingItems?.reduce((sum: number, item: BookingItem) => sum + (item.price || 0), 0) || 0;
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'tfc'>('card');
  const [loading, setLoading] = useState(false);
  const [discounts, setDiscounts] = useState({
    sibling: 0,
    weekly: 0,
    bulk: 0
  });
  const [totalDiscount, setTotalDiscount] = useState(0);
  const [finalTotal, setFinalTotal] = useState(0);

  // Check if we have the required data from navigation state
  if (!location.state || !activity || !bookingItems || bookingItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <ExclamationTriangleIcon className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">No booking data found</h2>
            <p className="text-gray-600 mb-6">
              It looks like you accessed this page directly. Please go back to the activities page and complete your booking.
            </p>
            <Button onClick={() => navigate('/activities')}>
              Back to Activities
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Calculate discounts when component mounts or dependencies change
  useEffect(() => {
    if (!activity || !bookingItems || bookingItems.length === 0) return;

    const uniqueChildren = new Set(bookingItems.map((item: BookingItem) => item.childId));
    const uniqueDates = new Set(bookingItems.map((item: BookingItem) => item.sessionDate));
    
    let siblingDiscount = 0;
    let weeklyDiscount = 0;
    let bulkDiscount = 0;
    
    // Sibling discount (if more than 1 child)
    if (uniqueChildren.size > 1 && activity.siblingDiscount) {
      siblingDiscount = (total * activity.siblingDiscount) / 100;
    }
    
    // Weekly discount (if booking 5+ days)
    if (uniqueDates.size >= 5 && activity.weeklyDiscount) {
      weeklyDiscount = (total * activity.weeklyDiscount) / 100;
    }
    
    // Bulk discount (if booking all available days)
    if (uniqueDates.size >= 10 && activity.bulkDiscount) {
      bulkDiscount = (total * activity.bulkDiscount) / 100;
    }
    
    const calculatedDiscounts = { sibling: siblingDiscount, weekly: weeklyDiscount, bulk: bulkDiscount };
    const calculatedTotalDiscount = siblingDiscount + weeklyDiscount + bulkDiscount;
    const calculatedFinalTotal = parseFloat((total || 0).toString()) - calculatedTotalDiscount;
    
    setDiscounts(calculatedDiscounts);
    setTotalDiscount(calculatedTotalDiscount);
    setFinalTotal(calculatedFinalTotal);
  }, [activity, bookingItems, total]);

  const handlePayment = async () => {
    if (paymentMethod === 'card') {
      await handleCardPayment();
    } else {
      await handleTFCPayment();
    }
  };

  // Map time slot names to actual start times
  const getTimeSlotStartTime = (timeSlot: string): string => {
    if (!activity) return '09:00'; // Default fallback
    
    // Check if it's a custom time slot
    const customSlot = activity.holidayTimeSlots?.find((slot: any) => slot.name === timeSlot);
    if (customSlot) {
      console.log(`Custom slot found for ${timeSlot}:`, customSlot.startTime);
      return customSlot.startTime;
    }
    
    // Map standard time slots
    let startTime: string;
    switch (timeSlot) {
      case 'Standard Day':
        startTime = activity.startTime || '09:00';
        break;
      case 'Early Drop-off':
        startTime = activity.earlyDropoffStartTime || '08:00';
        break;
      case 'Late Pick-up':
        startTime = activity.startTime || '09:00'; // Late pick-up starts when standard day ends
        break;
      default:
        startTime = activity.startTime || '09:00';
    }
    
    console.log(`Mapped ${timeSlot} to start time:`, startTime);
    return startTime;
  };

  const handleCardPayment = async () => {
    try {
      setLoading(true);
      
      // Create bookings sequentially to avoid race conditions
      const bookings = [];
      const token = authService.getToken();
      
      console.log('Booking items to create:', bookingItems);
      console.log('Total booking items:', bookingItems.length);
      
      // Create one single booking with all children and sessions
      const totalAmount = bookingItems.reduce((sum: number, item: BookingItem) => sum + item.price, 0);
      const firstItem = bookingItems[0];
      
      const bookingData = {
        activityId: activity.id,
        childId: firstItem.childId, // Use first child as primary
        startDate: firstItem.sessionDate,
        startTime: getTimeSlotStartTime(firstItem.sessionName),
        amount: totalAmount,
        // Include all children and sessions in the booking
        children: bookingItems.map((item: BookingItem) => ({
          childId: item.childId,
          childName: item.childName,
          sessions: [{
            sessionId: item.sessionId,
            holidayTimeSlotId: item.holidayTimeSlotId,
            sessionDate: item.sessionDate,
            sessionName: item.sessionName,
            startTime: item.startTime,
            endTime: item.endTime,
            price: item.price
          }]
        }))
      };
      
      console.log('Creating single booking with all children and sessions:', bookingData);
      
      const response = await fetch(buildApiUrl('/bookings'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bookingData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Booking creation failed:', response.status, errorText);
        throw new Error(`Failed to create booking: ${response.status} ${errorText}`);
      }

      const booking = await response.json();
      bookings.push(booking);
      console.log('Successfully created single booking with all details:', booking);
      
      // Create payment intent
      let paymentData;
      try {
        const paymentResponse = await fetch(buildApiUrl('/payments/create-intent'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            amount: finalTotal,
            bookingIds: bookings.map(b => b.data.id),
            paymentMethod: 'card',
            successUrl: `${window.location.origin}/bookings?success=true`,
            cancelUrl: `${window.location.origin}/checkout/holiday-club`
          })
        });

        if (!paymentResponse.ok) {
          const errorData = await paymentResponse.json();
          
          // If payment already exists, try to get existing payment intent
          if (errorData.error?.code === 'PAYMENT_ALREADY_EXISTS') {
            console.log('Payment already exists, attempting to retrieve existing payment intent');
            
            // Try to get existing payment for the booking
            const existingPaymentResponse = await fetch(buildApiUrl(`/payments/booking/${bookings[0].data.id}`), {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            
            if (existingPaymentResponse.ok) {
              const existingPayment = await existingPaymentResponse.json();
              paymentData = {
                data: {
                  paymentIntentId: existingPayment.data.stripePaymentIntentId,
                  clientSecret: existingPayment.data.stripeClientSecret || 'existing_payment'
                }
              };
              console.log('Retrieved existing payment:', paymentData);
            } else {
              throw new Error('Failed to retrieve existing payment');
            }
          } else {
            throw new Error('Failed to create payment intent');
          }
        } else {
          paymentData = await paymentResponse.json();
        }
      } catch (paymentError) {
        console.error('Payment intent creation/retrieval failed:', paymentError);
        throw paymentError;
      }
      
      console.log('Payment data received:', paymentData);
      console.log('About to navigate to /payment with state:', {
        activityId: activity.id,
        childId: bookingItems[0].childId,
        originalAmount: total,
        promoDiscount: totalDiscount,
        creditAmount: 0,
        finalAmount: finalTotal,
        paymentIntentId: paymentData.data.paymentIntentId,
        clientSecret: paymentData.data.clientSecret,
        bookingIds: bookings.map(b => b.data.id)
      });
      
      // Navigate to payment details page with Stripe data
      navigate('/payment', {
        state: {
          activityId: activity.id,
          childId: bookingItems[0].childId, // Use first child as primary
          originalAmount: total,
          promoDiscount: totalDiscount,
          creditAmount: 0, // No credits applied in holiday club
          finalAmount: finalTotal,
          // Stripe-specific data
          paymentIntentId: paymentData.data.paymentIntentId,
          clientSecret: paymentData.data.clientSecret,
          bookingIds: bookings.map(b => b.data.id)
        }
      });
      
      console.log('Navigation to /payment completed');
      
      // Force redirect to payment page (temporary fix for deployment issue)
      setTimeout(() => {
        window.location.href = '/payment';
      }, 100);
      
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTFCPayment = async () => {
    try {
      setLoading(true);
      
      // Create bookings with TFC status sequentially to avoid race conditions
      const token = authService.getToken();
      
      for (const item of bookingItems) {
        const bookingData = {
          activityId: activity.id,
          childId: item.childId,
          startDate: item.sessionDate,
          startTime: getTimeSlotStartTime(item.sessionName),
          amount: item.price,
          paymentMethod: 'tfc'
        };
        
        console.log('Creating TFC booking with data:', bookingData);
        
        const response = await fetch(buildApiUrl('/bookings'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(bookingData)
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('TFC booking creation failed:', response.status, errorText);
          throw new Error(`Failed to create booking: ${response.status} ${errorText}`);
        }

        await response.json();
      }
      
      toast.success('Bookings created! Please complete your Tax-Free Childcare payment.');
      navigate('/bookings', { 
        state: { 
          message: 'Your bookings are pending Tax-Free Childcare payment. Please complete payment within 5 days to secure your places.' 
        } 
      });
      
    } catch (error) {
      console.error('TFC booking error:', error);
      toast.error('Booking failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
          <p className="text-gray-600 mt-2">Complete your Holiday Club booking</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Booking Summary */}
          <div className="lg:col-span-2">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Booking Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg">{activity.title}</h3>
                    <p className="text-gray-600">{activity.venue.name}</p>
                  </div>
                  
                  <div className="space-y-2">
                    {bookingItems.map((item: BookingItem, index: number) => (
                      <div key={index} className="flex justify-between py-2 border-b border-gray-100">
                        <div>
                          <div className="font-medium">{item.childName}</div>
                          <div className="text-sm text-gray-600">
                            {new Date(item.sessionDate).toLocaleDateString('en-GB', { 
                              weekday: 'long', 
                              day: 'numeric', 
                              month: 'long' 
                            })} - {item.sessionName}
                          </div>
                        </div>
                        <div className="font-medium">£{Number(item.price).toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Discounts */}
            {(discounts.sibling > 0 || discounts.weekly > 0 || discounts.bulk > 0) && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Discounts Applied</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {discounts.sibling > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Sibling Discount ({activity.siblingDiscount}%)</span>
                        <span>-£{(discounts.sibling || 0).toFixed(2)}</span>
                      </div>
                    )}
                    {discounts.weekly > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Weekly Discount ({activity.weeklyDiscount}%)</span>
                        <span>-£{(discounts.weekly || 0).toFixed(2)}</span>
                      </div>
                    )}
                    {discounts.bulk > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Full Holiday Discount ({activity.bulkDiscount}%)</span>
                        <span>-£{(discounts.bulk || 0).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Payment Method Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Payment Method</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      onClick={() => setPaymentMethod('card')}
                      className={`p-4 rounded-lg border-2 transition-colors ${
                        paymentMethod === 'card'
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-6 w-6" />
                        <div className="text-left">
                          <div className="font-medium">Card Payment</div>
                          <div className="text-sm text-gray-600">Instant confirmation</div>
                        </div>
                      </div>
                    </button>
                    
                    <button
                      onClick={() => setPaymentMethod('tfc')}
                      className={`p-4 rounded-lg border-2 transition-colors ${
                        paymentMethod === 'tfc'
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Banknote className="h-6 w-6" />
                        <div className="text-left">
                          <div className="font-medium">Tax-Free Childcare</div>
                          <div className="text-sm text-gray-600">Payment pending</div>
                        </div>
                      </div>
                    </button>
                  </div>
                  
                  {paymentMethod === 'tfc' && (
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="flex items-start gap-3">
                        <ExclamationTriangleIcon className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div className="text-sm text-blue-800">
                          <p className="font-medium mb-1">Tax-Free Childcare Payment</p>
                          <p>Your booking will be held as pending until payment is received. You'll receive payment instructions via email.</p>
                        </div>
                      </div>
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
                  <div className="flex justify-between">
                    <span>Subtotal ({bookingItems.length} sessions):</span>
                    <span>£{(total || 0).toFixed(2)}</span>
                  </div>
                  
                  {totalDiscount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discounts:</span>
                      <span>-£{(totalDiscount || 0).toFixed(2)}</span>
                    </div>
                  )}
                  
                  <div className="border-t pt-4">
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total:</span>
                      <span>£{(finalTotal || 0).toFixed(2)}</span>
                    </div>
                  </div>
                  
                  <Button 
                    className="w-full mt-6"
                    onClick={handlePayment}
                    disabled={loading}
                  >
                    {loading ? 'Processing...' : `Pay £${(finalTotal || 0).toFixed(2)}`}
                  </Button>
                  
                  <div className="text-xs text-gray-500 text-center">
                    By proceeding, you agree to our terms and conditions
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HolidayClubCheckoutPage;