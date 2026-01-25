import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { authService } from '../../services/authService';
import { buildApiUrl } from '../../config/api';
import toast from 'react-hot-toast';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Tag,
  ArrowLeftIcon,
  ReceiptIcon
} from 'lucide-react';
import { CreditCardIcon, BanknotesIcon } from '@heroicons/react/24/outline';

interface TimeSlot {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  price: number;
  capacity: number;
  bookingsCount: number;
}

interface BookingCartItem {
  activityId?: string;
  sessionId: string;
  timeSlotId?: string;
  childId: string;
  childName?: string;
  sessionDate?: string;
  date?: string;
  startTime: string;
  endTime: string;
  sessionName?: string;
  price: number;
}

interface ActivityData {
  id: string;
  name?: string;
  title?: string;
  description: string;
  start_date?: string;
  end_date?: string;
  startDate?: string;
  endDate?: string;
  start_time?: string;
  end_time?: string;
  startTime?: string;
  endTime?: string;
  price: number;
  max_capacity?: number;
  current_capacity?: number;
  capacity?: number;
  bookings?: any[];
  age_range?: {
    min: number;
    max: number;
  };
  ageRange?: string | {
    min: number;
    max: number;
  };
  venue?: {
    name: string;
    address: string;
  };
  holidayTimeSlots?: TimeSlot[];
  sessionBlocks?: any[];
}

const ActivityCheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [bookingCart, setBookingCart] = useState<BookingCartItem[]>([]);
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [totalPrice, setTotalPrice] = useState(0);
  const [children, setChildren] = useState<any[]>([]);

  useEffect(() => {
    // Get booking cart data from navigation state
    console.log('ActivityCheckoutPage location.state:', location.state);
    if (location.state?.bookingCart && location.state?.activity) {
      setBookingCart(location.state.bookingCart);
      setActivity(location.state.activity);
      setTotalPrice(location.state.totalPrice || 0);
    } else {
      // No booking data, redirect back
      toast.error('No booking information found');
      navigate('/activities');
      return;
    }

    // Fetch children to display names
    fetchChildren();
  }, [location.state, navigate]);

  const fetchChildren = async () => {
    try {
      const token = await authService.getToken();
      const response = await fetch(buildApiUrl('/children'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch children');
      }

      const data = await response.json();
      setChildren(data);
    } catch (error) {
      console.error('Error fetching children:', error);
      toast.error('Failed to load children information');
    }
  };

  const handleProceedToPayment = async () => {
    if (bookingCart.length === 0) {
      toast.error('No sessions selected');
      return;
    }

    setLoading(true);
    try {
      // Create booking and proceed to payment
      const token = await authService.getToken();
      const response = await fetch(buildApiUrl('/bookings'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          activityId: activity?.id,
          childId: bookingCart[0]?.childId, // Use first child as primary
          startDate: bookingCart[0]?.sessionDate || bookingCart[0]?.date,
          startTime: bookingCart[0]?.startTime,
          amount: totalPrice,
          // Include all children and sessions in the booking
          children: bookingCart.map(item => ({
            childId: item.childId,
            childName: item.childName,
            sessions: [{
              sessionId: item.sessionId,
              timeSlotId: item.timeSlotId,
              sessionDate: item.sessionDate || item.date,
              sessionName: item.sessionName || 'Standard Day',
              startTime: item.startTime,
              endTime: item.endTime,
              price: item.price
            }]
          }))
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create booking');
      }

      const data = await response.json();
      
      if (data.success) {
        // Redirect to payment page with booking data
        navigate('/payment', { 
          state: { 
            bookings: data.data.bookings,
            paymentIntent: data.data.paymentIntent,
            totalAmount: totalPrice
          } 
        });
      } else {
        throw new Error(data.message || 'Failed to create booking');
      }
    } catch (error) {
      console.error('Error creating booking:', error);
      toast.error('Failed to proceed with payment');
    } finally {
      setLoading(false);
    }
  };

  const getChildName = (childId: string) => {
    if (!Array.isArray(children)) {
      return 'Child';
    }
    const child = children.find(c => c.id === childId);
    return child ? `${child.firstName || child.first_name || ''} ${child.lastName || child.last_name || ''}`.trim() || 'Child' : 'Child';
  };

  const getDiscountTotal = () => {
    // Calculate potential discounts (sibling, bulk, weekly)
    // For now, return 0 - discounts can be implemented later
    return 0;
  };

  const getFinalTotal = () => {
    return totalPrice - getDiscountTotal();
  };

  if (!activity || bookingCart.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Bookings Found</h2>
          <p className="text-gray-600 mb-4">Please go back and select sessions to book.</p>
          <Button onClick={() => navigate('/activities')}>Back to Activities</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate(-1)}
            className="mb-4 flex items-center gap-2"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Activity Selection
          </Button>
          
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
            <p className="text-gray-600 mt-2">Review your booking details before payment</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Booking Summary */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Activity Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">{activity.title || activity.name || 'Activity'}</h3>
                
                {activity.description && (
                  <p className="text-gray-600 mb-4">{activity.description}</p>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">
                      {new Date(activity.startDate || activity.start_date || '').toLocaleDateString()} - {new Date(activity.endDate || activity.end_date || '').toLocaleDateString()}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">
                      {activity.startTime || activity.start_time || '-'} - {activity.endTime || activity.end_time || '-'}
                    </span>
                  </div>
                  
                  {activity.venue && (
                    <>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-600">
                          {activity.venue.name || 'Venue TBD'}
                        </span>
                      </div>
                      
                      {activity.venue.address && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-500" />
                          <span className="text-sm text-gray-600">{activity.venue.address}</span>
                        </div>
                      )}
                    </>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">
                      {(activity.capacity || activity.max_capacity || 0) - (activity.bookings?.length || activity.current_capacity || 0)} slots available
                    </span>
                  </div>
                  
                  {(activity.ageRange || activity.age_range) && (
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-600">
                        {(() => {
                          const ageRange = activity.ageRange || activity.age_range;
                          if (typeof ageRange === 'string') {
                            return ageRange;
                          } else if (ageRange && typeof ageRange === 'object' && ageRange.min && ageRange.max) {
                            return `Ages ${ageRange.min}-${ageRange.max}`;
                          }
                          return 'Age TBD';
                        })()}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Selected Sessions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ReceiptIcon className="h-5 w-5" />
                  Selected Sessions ({Array.isArray(bookingCart) ? bookingCart.length : 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!Array.isArray(bookingCart) || bookingCart.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No sessions selected</p>
                ) : (
                <div className="space-y-3">
                  {bookingCart.map((item, index) => (
                    <div key={index} className="flex justify-between items-center p-3 border rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900">{getChildName(item.childId)}</div>
                        <div className="text-sm text-gray-600">
                          {new Date(item.date || item.sessionDate || '').toLocaleDateString('en-GB', { 
                            weekday: 'short', 
                            day: 'numeric', 
                            month: 'short' 
                          })} • {item.startTime} - {item.endTime}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-green-600">£{item.price}</div>
                      </div>
                    </div>
                  ))}
                </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Subtotal ({bookingCart.length} sessions):</span>
                    <span>£{totalPrice.toFixed(2)}</span>
                  </div>
                  
                  {getDiscountTotal() > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discounts:</span>
                      <span>-£{getDiscountTotal().toFixed(2)}</span>
                    </div>
                  )}
                  
                  <div className="border-t pt-3">
                    <div className="flex justify-between font-semibold text-lg">
                      <span>Total:</span>
                      <span>£{getFinalTotal().toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 space-y-3">
                  <Button 
                    onClick={handleProceedToPayment}
                    disabled={loading}
                    className="w-full bg-teal-600 hover:bg-teal-700"
                  >
                    {loading ? 'Processing...' : `Pay £${getFinalTotal().toFixed(2)}`}
                  </Button>
                  
                  <div className="text-xs text-gray-500 text-center">
                    Secure payment powered by Stripe
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

export default ActivityCheckoutPage;
