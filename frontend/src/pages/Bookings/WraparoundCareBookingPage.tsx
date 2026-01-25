import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  CalendarDaysIcon, 
  ClockIcon, 
  UserGroupIcon, 
  CurrencyPoundIcon,
  CheckCircleIcon,
  XMarkIcon,
  ShoppingCartIcon,
  MapPinIcon
} from '@heroicons/react/24/outline';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { authService } from '../../services/authService';
import { buildApiUrl } from '../../config/api';
import toast from 'react-hot-toast';
import CalendarView from '../../components/booking/CalendarView';
import { useBasket } from '../../contexts/CartContext';

interface SessionBlock {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  capacity: number;
  price: number;
  bookingsCount: number;
}

interface Session {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  sessionBlocks: SessionBlock[];
}

interface Activity {
  id: string;
  title: string;
  description: string;
  venue: {
    name: string;
    address: string;
  };
  yearGroups: string[];
  sessions: Session[];
  proRataBooking?: boolean;
}

interface Child {
  id: string;
  firstName: string;
  lastName: string;
  yearGroup?: string;
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

const WraparoundCareBookingPage: React.FC = () => {
  const { activityId } = useParams<{ activityId: string }>();
  const navigate = useNavigate();
  const { addToBasket } = useBasket();
  
  const [activity, setActivity] = useState<Activity | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [bookingCart, setBookingCart] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);

  // Get the default month for calendar navigation based on activity dates
  const getDefaultMonth = () => {
    if (!activity || !activity.sessions || activity.sessions.length === 0) return new Date();
    
    // Use the first session date to determine the default month
    const firstSessionDate = new Date(activity.sessions[0].date);
    return new Date(firstSessionDate.getFullYear(), firstSessionDate.getMonth(), 1);
  };

  // Generate available dates from sessions
  const generateAvailableDates = () => {
    if (!activity?.sessions || activity.sessions.length === 0) {
      return [];
    }
    return activity.sessions.map(session => session.date).sort();
  };

  const availableDates = generateAvailableDates();

  // Handle date selection
  const handleDateSelection = (date: string) => {
    setSelectedDates(prev => 
      prev.includes(date) 
        ? prev.filter(d => d !== date)
        : [...prev, date]
    );
  };

  useEffect(() => {
    if (activityId) {
      fetchActivityData();
      fetchChildren();
    }
  }, [activityId]);

  const fetchActivityData = async () => {
    try {
      const token = authService.getToken();
      if (!token) {
        navigate('/login');
        return;
      }

      // Fetch activity with sessions and session blocks
      const response = await fetch(buildApiUrl(`/activities/${activityId}`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch activity');
      }

      const data = await response.json();
      if (data.success) {
        setActivity(data.data);
        
        // Set first available date as default
        if (data.data.sessions && data.data.sessions.length > 0) {
          setSelectedDates([data.data.sessions[0].date]);
        }
      } else {
        throw new Error(data.message || 'Failed to fetch activity');
      }
    } catch (error) {
      console.error('Error fetching activity:', error);
      toast.error('Failed to load activity details');
    } finally {
      setLoading(false);
    }
  };

  const fetchChildren = async () => {
    try {
      const token = authService.getToken();
      if (!token) return;

      const response = await fetch(buildApiUrl('/children'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setChildren(data.data || []);
        }
      }
    } catch (error) {
      console.error('Error fetching children:', error);
    }
  };

  const getAvailableDates = () => {
    if (!activity?.sessions) return [];
    return activity.sessions.map(session => session.date).sort();
  };

  const getSessionsForDate = (date: string) => {
    if (!activity?.sessions) return [];
    return activity.sessions.find(session => session.date === date)?.sessionBlocks || [];
  };

  const isChildEligible = (child: Child) => {
    if (!activity?.yearGroups || activity.yearGroups.length === 0) return true;
    return activity.yearGroups.includes(child.yearGroup || '');
  };

  const isSessionBlockAvailable = (sessionBlock: SessionBlock) => {
    return sessionBlock.bookingsCount < sessionBlock.capacity;
  };

  const isSessionBlockBooked = (childId: string, sessionBlockId: string) => {
    return bookingCart.some(item => 
      item.childId === childId && item.sessionBlockId === sessionBlockId
    );
  };

  const toggleSessionBooking = (child: Child, sessionBlock: SessionBlock, date: string) => {
    const existingIndex = bookingCart.findIndex(item => 
      item.childId === child.id && item.sessionBlockId === sessionBlock.id && item.sessionDate === date
    );

    if (existingIndex >= 0) {
      // Remove from cart
      setBookingCart(prev => prev.filter((_, index) => index !== existingIndex));
    } else {
      // Add to cart
      const session = activity?.sessions.find(s => s.date === date);
      if (session) {
        const newBooking: BookingItem = {
          childId: child.id,
          childName: `${child.firstName} ${child.lastName}`,
          sessionId: session.id,
          sessionBlockId: sessionBlock.id,
          sessionDate: date,
          sessionName: sessionBlock.name,
          startTime: sessionBlock.startTime,
          endTime: sessionBlock.endTime,
          price: parseFloat(sessionBlock.price?.toString() || '0')
        };
        setBookingCart(prev => [...prev, newBooking]);
      }
    }
  };

  const getTotalPrice = () => {
    return bookingCart.reduce((total, item) => total + parseFloat(String(item.price || 0)), 0);
  };

  const getBookingsForChild = (childId: string) => {
    return bookingCart.filter(item => item.childId === childId);
  };

  const handleCheckout = () => {
    if (bookingCart.length === 0) {
      toast.error('Please select at least one session');
      return;
    }

    if (!activity) {
      toast.error('Activity information not available');
      return;
    }

    // Add all selected sessions to basket and navigate to basket checkout
    bookingCart.forEach((booking, index) => {
      const basketItem = {
        id: `wraparound-${activity.id}-${booking.sessionBlockId}-${Date.now()}-${index}`,
        activityId: activity.id,
        activityName: activity.title || 'Unknown Wraparound Care',
        venueName: activity.venue?.name || 'Unknown Venue',
        date: booking.sessionDate,
        time: `${booking.startTime} - ${booking.endTime}`,
        price: booking.price,
        children: [{
          id: booking.childId,
          name: booking.childName
        }],
        bookingType: 'wraparound_care' as const,
        sessionId: booking.sessionId,
        sessionBlockId: booking.sessionBlockId,
        sessionName: booking.sessionName
      };

      addToBasket(basketItem);
    });
    
    // Navigate to basket checkout
    navigate('/checkout', {
      state: {
        basketItems: bookingCart.map((booking, index) => ({
          id: `wraparound-${activity.id}-${booking.sessionBlockId}-${Date.now()}-${index}`,
          activityId: activity.id,
          activityName: activity.title || 'Unknown Wraparound Care',
          venueName: activity.venue?.name || 'Unknown Venue',
          date: booking.sessionDate,
          time: `${booking.startTime} - ${booking.endTime}`,
          price: booking.price,
          children: [{
            id: booking.childId,
            name: booking.childName
          }],
          bookingType: 'wraparound_care' as const,
          sessionId: booking.sessionId,
          sessionBlockId: booking.sessionBlockId,
          sessionName: booking.sessionName
        })),
        totalPrice: bookingCart.reduce((total, booking) => total + booking.price, 0),
        totalItems: bookingCart.length
      }
    });
  };

  const handleAddToBasket = () => {
    if (bookingCart.length === 0) {
      toast.error('Please select at least one session');
      return;
    }

    if (!activity) {
      toast.error('Activity information not available');
      return;
    }

    // Create basket items for each booking in the cart
    bookingCart.forEach((booking, index) => {
      const basketItem = {
        id: `wraparound-${activity.id}-${booking.sessionBlockId}-${Date.now()}-${index}`,
        activityId: activity.id,
        activityName: activity.title || 'Unknown Wraparound Care',
        venueName: activity.venue?.name || 'Unknown Venue',
        date: booking.sessionDate,
        time: `${booking.startTime} - ${booking.endTime}`,
        price: booking.price,
        children: [{
          id: booking.childId,
          name: booking.childName
        }],
        // Additional wraparound-specific data
        bookingType: 'wraparound_care' as const,
        sessionId: booking.sessionId,
        sessionBlockId: booking.sessionBlockId,
        sessionName: booking.sessionName
      };

      addToBasket(basketItem);
    });

    toast.success(`${bookingCart.length} wraparound care booking${bookingCart.length > 1 ? 's' : ''} added to basket`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00806a]"></div>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Activity Not Found</h2>
        <p className="text-gray-600 mb-4">The requested activity could not be found.</p>
        <Button onClick={() => navigate('/activities')}>
          Back to Activities
        </Button>
      </div>
    );
  }

  const eligibleChildren = children.filter(isChildEligible);
  
  // Debug logging
  console.log('All children:', children);
  console.log('Activity year groups:', activity?.yearGroups);
  console.log('Eligible children:', eligibleChildren);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{activity.title}</h1>
          <div className="flex items-center text-gray-600 space-x-4">
            <div className="flex items-center">
              <MapPinIcon className="w-4 h-4 mr-1" />
              <span>{activity.venue.name}</span>
            </div>
            <div className="flex items-center">
              <UserGroupIcon className="w-4 h-4 mr-1" />
              <span>{activity.yearGroups.join(', ')}</span>
            </div>
            <div className="flex items-center">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                activity.proRataBooking 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {activity.proRataBooking ? 'Pro-rata Available' : 'Full Booking Only'}
              </span>
            </div>
          </div>
          {activity.description && (
            <p className="text-gray-600 mt-2">{activity.description}</p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Session Selection */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CalendarDaysIcon className="w-5 h-5 mr-2" />
                  Select Sessions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Date Selection with Calendar */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Dates
                  </label>
                  <p className="text-sm text-gray-600 mb-4">
                    Click on available dates to select them for booking. Selected dates are highlighted in blue.
                  </p>
                  
                  <CalendarView
                    availableDates={availableDates}
                    selectedDates={selectedDates}
                    onDateSelect={handleDateSelection}
                    onDateDeselect={(date) => handleDateSelection(date)} // Toggle selection
                    defaultMonth={getDefaultMonth()}
                    className="w-full"
                  />
                  
                  <div className="mt-4 p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-green-800">
                        Selected: {selectedDates.length} date{selectedDates.length !== 1 ? 's' : ''}
                      </span>
                      {selectedDates.length > 0 && (
                        <button
                          onClick={() => setSelectedDates([])}
                          className="text-sm text-green-600 hover:text-green-800 underline"
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Session Blocks */}
                {selectedDates.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <CalendarDaysIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>Please select dates to view available sessions</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {selectedDates.map(date => {
                      const dateSessionBlocks = getSessionsForDate(date);
                      return (
                        <div key={date} className="border border-gray-200 rounded-lg p-4">
                          <h3 className="font-medium text-gray-900 mb-4">
                            Available Sessions for {new Date(date).toLocaleDateString('en-GB', {
                              weekday: 'long',
                              day: 'numeric',
                              month: 'long'
                            })}
                          </h3>
                          
                          {dateSessionBlocks.length === 0 ? (
                            <div className="text-center py-4 text-gray-500">
                              <ClockIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                              <p>No sessions available for this date</p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {eligibleChildren.map(child => (
                                <div key={child.id} className="border border-gray-200 rounded-lg p-3">
                                  <div className="flex items-center justify-between mb-3">
                                    <h4 className="font-medium text-gray-900">
                                      {child.firstName} {child.lastName}
                                      {child.yearGroup && (
                                        <span className="text-sm text-gray-500 ml-2">({child.yearGroup})</span>
                                      )}
                                    </h4>
                                    <div className="text-sm text-gray-500">
                                      {getBookingsForChild(child.id).filter(booking => booking.sessionDate === date).length} session(s) selected
                                    </div>
                                  </div>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {dateSessionBlocks.map(sessionBlock => {
                                      const isBooked = isSessionBlockBooked(child.id, sessionBlock.id);
                                      const isAvailable = isSessionBlockAvailable(sessionBlock);
                                      const isDisabled = !isAvailable && !isBooked;
                                      
                                      return (
                                        <button
                                          key={sessionBlock.id}
                                          onClick={() => isAvailable ? toggleSessionBooking(child, sessionBlock, date) : null}
                                          disabled={isDisabled}
                                          className={`p-3 text-sm font-medium rounded-lg border transition-colors ${
                                            isBooked
                                              ? 'bg-green-100 text-green-800 border-green-300'
                                              : isAvailable
                                              ? 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                              : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                          }`}
                                        >
                                          <div className="text-center">
                                            <div className="font-medium">{sessionBlock.name}</div>
                                            <div className="text-xs text-gray-500">
                                              {sessionBlock.startTime} - {sessionBlock.endTime}
                                            </div>
                                            <div className="text-xs font-medium">
                                              £{parseFloat(String(sessionBlock.price || 0)).toFixed(2)}
                                            </div>
                                            {!isAvailable && (
                                              <div className="text-xs text-red-500 mt-1">
                                                Full ({sessionBlock.bookingsCount}/{sessionBlock.capacity})
                                              </div>
                                            )}
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                              
                              {/* Show ineligible children with explanation */}
                              {children.filter(child => !isChildEligible(child)).length > 0 && (
                                <div className="border border-yellow-200 rounded-lg p-3 bg-yellow-50">
                                  <h4 className="font-medium text-yellow-800 mb-2">Other Children Not Eligible</h4>
                                  <div className="space-y-1">
                                    {children.filter(child => !isChildEligible(child)).map(child => (
                                      <div key={child.id} className="text-sm text-yellow-700">
                                        {child.firstName} {child.lastName} ({child.yearGroup || 'No year group'}) - 
                                        Not eligible for this activity (requires: {activity?.yearGroups?.join(', ') || 'Any year group'})
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Booking Cart */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <ShoppingCartIcon className="w-5 h-5 mr-2" />
                  Booking Cart
                </CardTitle>
              </CardHeader>
              <CardContent>
                {bookingCart.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <ShoppingCartIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No sessions selected</p>
                    <p className="text-sm">Select sessions for your children above</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Group bookings by child */}
                    {eligibleChildren.map(child => {
                      const childBookings = getBookingsForChild(child.id);
                      if (childBookings.length === 0) return null;
                      
                      return (
                        <div key={child.id} className="border-b border-gray-200 pb-4">
                          <h4 className="font-medium text-gray-900 mb-2">
                            {child.firstName} {child.lastName}
                          </h4>
                          <div className="space-y-2">
                            {childBookings.map((booking, index) => (
                              <div key={index} className="flex items-center justify-between text-sm">
                                <div>
                                  <div className="font-medium">{booking.sessionName}</div>
                                  <div className="text-gray-500">
                                    {new Date(booking.sessionDate).toLocaleDateString('en-GB', { 
                                      weekday: 'short', 
                                      day: 'numeric',
                                      month: 'short'
                                    })} - {booking.startTime} - {booking.endTime}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium">£{parseFloat(String(booking.price || 0)).toFixed(2)}</span>
                                  <button
                                    onClick={() => toggleSessionBooking(
                                      { id: booking.childId, firstName: '', lastName: '' },
                                      { id: booking.sessionBlockId, name: '', startTime: '', endTime: '', capacity: 0, price: 0, bookingsCount: 0 },
                                      booking.sessionDate
                                    )}
                                    className="text-red-600 hover:text-red-800"
                                  >
                                    <XMarkIcon className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Total */}
                    <div className="border-t border-gray-200 pt-4">
                      <div className="flex items-center justify-between text-lg font-semibold">
                        <span>Total</span>
                        <span>£{getTotalPrice().toFixed(2)}</span>
                      </div>
                    </div>
                    
                    {/* Checkout Button */}
                    <div className="space-y-3">
                      <Button
                        onClick={handleCheckout}
                        disabled={booking}
                        className="w-full bg-[#00806a] hover:bg-[#006b5a] text-white"
                      >
                        {booking ? 'Processing...' : 'Book Wraparound Care Now'}
                      </Button>
                      
                      <Button
                        onClick={handleAddToBasket}
                        disabled={booking}
                        variant="outline"
                        className="w-full border-[#00806a] text-[#00806a] hover:bg-[#00806a] hover:text-white flex items-center justify-center gap-2"
                      >
                        <ShoppingCartIcon className="h-4 w-4" />
                        Add to Basket
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
};

export default WraparoundCareBookingPage;
