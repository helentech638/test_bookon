import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { authService } from '../../services/authService';
import { buildApiUrl } from '../../config/api';
import toast from 'react-hot-toast';
import CalendarView from '../../components/booking/CalendarView';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Tag,
  ArrowLeftIcon
} from 'lucide-react';
import { CheckCircleIcon, XMarkIcon, ShoppingCartIcon } from '@heroicons/react/24/outline';
import { useBasket } from '../../contexts/CartContext';

interface HolidayTimeSlot {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  price: number;
  capacity: number;
  bookingsCount: number;
}

interface Session {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  holidayTimeSlots: HolidayTimeSlot[];
}

interface Activity {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  price: number;
  capacity: number;
  ageRange?: string;
  whatToBring?: string;
  earlyDropoff: boolean;
  earlyDropoffPrice?: number;
  earlyDropoffStartTime?: string;
  earlyDropoffEndTime?: string;
  latePickup: boolean;
  latePickupPrice?: number;
  latePickupStartTime?: string;
  latePickupEndTime?: string;
  excludeDates: string[];
  holidayTimeSlots: HolidayTimeSlot[];
  sessions: Session[];
  venue?: {
    name: string;
    address: string;
  };
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
  holidayTimeSlotId: string;
  sessionDate: string;
  sessionName: string;
  startTime: string;
  endTime: string;
  price: number;
}

const HolidayClubBookingPage: React.FC = () => {
  const { activityId } = useParams<{ activityId: string }>();
  const navigate = useNavigate();
  const { addToBasket } = useBasket();
  
  const [activity, setActivity] = useState<Activity | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [bookingCart, setBookingCart] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Get the default month for calendar navigation based on activity dates
  const getDefaultMonth = () => {
    if (!activity) return new Date();
    
    // Use the start date of the activity to determine the default month
    const startDate = new Date(activity.startDate);
    return new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  };


  // Teal color palette for different dates (3 shades)
  const getDateColor = (date: string) => {
    const dateIndex = selectedDates.indexOf(date);
    const colors = [
      { bg: 'bg-teal-50', border: 'border-teal-200', header: 'bg-teal-100', text: 'text-teal-800', accent: 'bg-teal-400' }, // Light teal
      { bg: 'bg-teal-100', border: 'border-teal-300', header: 'bg-teal-200', text: 'text-teal-900', accent: 'bg-teal-500' }, // Medium teal
      { bg: 'bg-teal-200', border: 'border-teal-400', header: 'bg-teal-300', text: 'text-teal-900', accent: 'bg-teal-600' }  // Dark teal
    ];
    return colors[dateIndex % colors.length];
  };

  // Get available dates from activity sessions
  const getAvailableDates = () => {
    if (!activity?.sessions) return [];
    return activity.sessions.map(session => session.date).sort();
  };

  const availableDates = getAvailableDates();

  // Get holiday time slots for a specific date
  const getHolidayTimeSlotsForDate = (date: string) => {
    if (!activity?.sessions) return [];
    return activity.sessions.find(session => session.date === date)?.holidayTimeSlots || [];
  };

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
    fetchActivity();
    fetchChildren();
    }
  }, [activityId]);

  const fetchActivity = async () => {
    try {
      const token = authService.getToken();
      if (!token) {
        toast.error('Please login to view activities');
        navigate('/login');
        return;
      }

      const response = await fetch(`${buildApiUrl('')}/activities/${activityId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Session expired. Please login again.');
          authService.logout();
          navigate('/login');
          return;
        }
        throw new Error('Failed to fetch activity');
      }

      const result = await response.json();
      if (result.success && result.data) {
        setActivity(result.data);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Error fetching activity:', error);
      toast.error('Failed to load activity details');
      navigate('/activities');
    }
  };

  const fetchChildren = async () => {
    try {
      const token = authService.getToken();
      if (!token) {
        toast.error('Please login to view children');
        navigate('/login');
        return;
      }

      const response = await fetch(`${buildApiUrl('')}/children`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Session expired. Please login again.');
          authService.logout();
          navigate('/login');
          return;
        }
        throw new Error('Failed to fetch children');
      }

      const result = await response.json();
      if (result.success && result.data) {
        setChildren(result.data);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Error fetching children:', error);
      toast.error('Failed to load children');
    } finally {
      setLoading(false);
    }
  };

  const isHolidayTimeSlotAvailable = (holidayTimeSlot: HolidayTimeSlot) => {
    return holidayTimeSlot.bookingsCount < holidayTimeSlot.capacity;
  };

  const isHolidayTimeSlotBooked = (childId: string, holidayTimeSlotId: string) => {
    return bookingCart.some(item => 
      item.childId === childId && item.holidayTimeSlotId === holidayTimeSlotId
    );
  };

  const toggleHolidayTimeSlotBooking = (child: Child, holidayTimeSlot: HolidayTimeSlot, date: string) => {
    const existingIndex = bookingCart.findIndex(item => 
      item.childId === child.id && item.holidayTimeSlotId === holidayTimeSlot.id && item.sessionDate === date
    );

    if (existingIndex >= 0) {
      // Remove from cart
      setBookingCart(prev => prev.filter((_, index) => index !== existingIndex));
      toast.success(`${child.firstName} removed from ${holidayTimeSlot.name}`);
    } else {
      // Add to cart
      const session = activity?.sessions.find(s => s.date === date);
      if (session) {
        const newBooking: BookingItem = {
          childId: child.id,
          childName: `${child.firstName} ${child.lastName}`,
          sessionId: session.id,
          holidayTimeSlotId: holidayTimeSlot.id,
          sessionDate: date,
          sessionName: holidayTimeSlot.name,
          startTime: holidayTimeSlot.startTime,
          endTime: holidayTimeSlot.endTime,
          price: parseFloat(holidayTimeSlot.price?.toString() || '0')
        };
        setBookingCart(prev => [...prev, newBooking]);
        toast.success(`${child.firstName} added to ${holidayTimeSlot.name} for ${new Date(date).toLocaleDateString('en-GB')}`);
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
      toast.error('Please select at least one time slot');
      return;
    }
    
    if (!activity) {
      toast.error('Activity information not available');
      return;
    }

    // Add all selected time slots to basket and navigate to basket checkout
    bookingCart.forEach((booking, index) => {
      const basketItem = {
        id: `holiday-club-${activity.id}-${booking.holidayTimeSlotId}-${Date.now()}-${index}`,
        activityId: activity.id,
        activityName: activity.title || 'Unknown Holiday Club',
        venueName: activity.venue?.name || 'Unknown Venue',
        date: booking.sessionDate,
        time: `${booking.startTime} - ${booking.endTime}`,
        price: booking.price,
        children: [{
          id: booking.childId,
          name: booking.childName
        }],
        bookingType: 'holiday_club' as const,
        sessionId: booking.sessionId,
        timeSlotId: booking.holidayTimeSlotId,
        holidayTimeSlotId: booking.holidayTimeSlotId,
        sessionName: `${booking.startTime} - ${booking.endTime}`
      };
      
      addToBasket(basketItem);
    });
    
    // Navigate to basket checkout
    navigate('/checkout', {
      state: {
        basketItems: bookingCart.map((booking, index) => ({
          id: `holiday-club-${activity.id}-${booking.holidayTimeSlotId}-${Date.now()}-${index}`,
          activityId: activity.id,
          activityName: activity.title || 'Unknown Holiday Club',
          venueName: activity.venue?.name || 'Unknown Venue',
          date: booking.sessionDate,
          time: `${booking.startTime} - ${booking.endTime}`,
          price: booking.price,
          children: [{
            id: booking.childId,
            name: booking.childName
          }],
          bookingType: 'holiday_club' as const,
          sessionId: booking.sessionId,
          timeSlotId: booking.holidayTimeSlotId,
          holidayTimeSlotId: booking.holidayTimeSlotId,
          sessionName: `${booking.startTime} - ${booking.endTime}`
        })),
        totalPrice: bookingCart.reduce((total, booking) => total + booking.price, 0),
        totalItems: bookingCart.length
      }
    });
  };

  const handleAddToBasket = () => {
    if (bookingCart.length === 0) {
      toast.error('Please select at least one time slot');
      return;
    }

    if (!activity) {
      toast.error('Activity information not available');
      return;
    }

    // Create basket items for each booking in the cart
    bookingCart.forEach((booking, index) => {
      const basketItem = {
        id: `holiday-club-${activity.id}-${booking.holidayTimeSlotId}-${Date.now()}-${index}`,
        activityId: activity.id,
        activityName: activity.title || 'Unknown Holiday Club',
        venueName: activity.venue?.name || 'Unknown Venue',
        date: booking.sessionDate,
        time: `${booking.startTime} - ${booking.endTime}`,
        price: booking.price,
        children: [{
          id: booking.childId,
          name: booking.childName
        }],
        // Additional holiday club-specific data
        bookingType: 'holiday_club' as const,
        sessionId: booking.sessionId,
        timeSlotId: booking.holidayTimeSlotId,
        sessionName: booking.sessionName
      };

      addToBasket(basketItem);
    });

    toast.success(`${bookingCart.length} holiday club booking${bookingCart.length > 1 ? 's' : ''} added to basket`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="h-64 bg-gray-300 rounded"></div>
                <div className="h-32 bg-gray-300 rounded"></div>
              </div>
              <div className="h-96 bg-gray-300 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
          <Button onClick={() => navigate('/activities')} variant='ghost'>
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Back to Activities
            </Button>
          
          <div className="mt-4">
            <h1 className="text-3xl font-bold text-gray-900">{activity?.title}</h1>
            <p className="mt-2 text-lg text-gray-600">{activity?.description}</p>
            
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-500">
              <div className="flex items-center">
                <MapPin className="h-4 w-4 mr-1" />
                {activity?.venue?.name}, {activity?.venue?.address}
                  </div>
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                {new Date(activity?.startDate || '').toLocaleDateString('en-GB', { 
                  day: 'numeric', 
                  month: 'short' 
                })} - {new Date(activity?.endDate || '').toLocaleDateString('en-GB', { 
                  day: 'numeric', 
                  month: 'short' 
                })}
                  </div>
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                {activity?.startTime} - {activity?.endTime}
              </div>
              <div className="flex items-center">
                <Users className="h-4 w-4 mr-1" />
                Max {activity?.capacity} children
              </div>
              <div className="flex items-center">
                <Tag className="h-4 w-4 mr-1" />
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  activity?.proRataBooking 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {activity?.proRataBooking ? 'Pro-rata Available' : 'Full Booking Only'}
                </span>
              </div>
            </div>
          </div>
                    </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel - Booking Form */}
          <div className="space-y-6">
            {/* Date Selection */}
              <Card>
                <CardHeader>
                <CardTitle className="text-lg">
                  Select Dates
                </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                  Click on available dates to select them for booking. Selected dates are highlighted.
                    </p>
                    
                    <CalendarView
                      availableDates={availableDates}
                      selectedDates={selectedDates}
                      onDateSelect={handleDateSelection}
                      onDateDeselect={handleDateSelection}
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
                </CardContent>
              </Card>

            {/* Holiday Time Slot Selection */}
            {selectedDates.length === 0 ? (
              <Card>
                <CardContent>
                  <div className="text-center py-8 text-gray-500">
                    <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Please select dates to view available time slots</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Choose Time Slots</CardTitle>
                  <p className="text-sm text-gray-600">Select individual time slots for each child</p>
                  </CardHeader>
                  <CardContent>
                  {/* Color Legend */}
                  {selectedDates.length > 1 && (
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Date Color Guide</h4>
                      <div className="flex flex-wrap gap-3">
                        {selectedDates.map((date, index) => {
                          const colors = getDateColor(date);
                          return (
                            <div key={date} className="flex items-center space-x-2">
                              <div className={`w-3 h-3 ${colors.accent} rounded-full`}></div>
                              <span className="text-xs text-gray-600">
                                {new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-6">
                    {selectedDates.map(date => {
                      const dateHolidayTimeSlots = getHolidayTimeSlotsForDate(date);
                      return (
                        <div key={date} className="border border-gray-200 rounded-lg p-4">
                          {(() => {
                            const colors = getDateColor(date);
                            return (
                              <div className={`${colors.bg} ${colors.border} border-2 rounded-xl p-4 mb-4`}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    <div className={`w-4 h-4 ${colors.accent} rounded-full`}></div>
                                    <h3 className={`font-semibold ${colors.text} text-lg`}>
                                      {new Date(date).toLocaleDateString('en-GB', {
                                        weekday: 'long', 
                                        day: 'numeric', 
                                        month: 'long' 
                                      })}
                                    </h3>
                                  </div>
                                  <div className={`px-3 py-1 ${colors.header} ${colors.text} rounded-full text-sm font-medium`}>
                                    {dateHolidayTimeSlots.length} sessions
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                          
                          {dateHolidayTimeSlots.length === 0 ? (
                            <div className="text-center py-4 text-gray-500">
                              <Clock className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                              <p>No time slots available for this date</p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {children.map(child => {
                                const colors = getDateColor(date);
                                return (
                                <div key={child.id} className={`border ${colors.border} rounded-lg p-3 ${colors.bg}`}>
                                  <div className="flex items-center justify-between mb-3">
                                    <h4 className="font-medium text-gray-900">
                                      {child.firstName} {child.lastName}
                                      {child.yearGroup && (
                                        <span className="text-sm text-gray-500 ml-2">({child.yearGroup})</span>
                                      )}
                                    </h4>
                                    <div className="text-sm text-gray-500">
                                      {getBookingsForChild(child.id).filter(booking => booking.sessionDate === date).length} slot(s) selected
                                    </div>
                                  </div>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {dateHolidayTimeSlots.map(holidayTimeSlot => {
                                      const isBooked = isHolidayTimeSlotBooked(child.id, holidayTimeSlot.id);
                                      const isAvailable = isHolidayTimeSlotAvailable(holidayTimeSlot);
                                      const isDisabled = !isAvailable && !isBooked;
                                      
                                      return (
                                        <button
                                          key={holidayTimeSlot.id}
                                          onClick={() => isAvailable ? toggleHolidayTimeSlotBooking(child, holidayTimeSlot, date) : null}
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
                                            <div className="font-medium">{holidayTimeSlot.name}</div>
                                            <div className="text-xs text-gray-500">
                                              {holidayTimeSlot.startTime} - {holidayTimeSlot.endTime}
                                            </div>
                                            <div className="text-xs font-medium">
                                              £{parseFloat(String(holidayTimeSlot.price || 0)).toFixed(2)}
                                            </div>
                                            {!isAvailable && (
                                              <div className="text-xs text-red-500 mt-1">
                                                Full ({holidayTimeSlot.bookingsCount}/{holidayTimeSlot.capacity})
                                              </div>
                                            )}
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

          {/* Right Panel - Booking Cart */}
          <div>
            <Card>
                <CardHeader>
                <CardTitle className="flex items-center">
                  <ShoppingCartIcon className="w-5 h-5 mr-2" />
                  Booking Cart
                </CardTitle>
                </CardHeader>
                <CardContent>
                {bookingCart.length === 0 && selectedDates.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                    <ShoppingCartIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No time slots selected</p>
                    <p className="text-sm">Select time slots for your children above</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Show selected dates summary */}
                      {selectedDates.length > 0 && (
                        <div className="border-b border-gray-200 pb-4">
                          <h4 className="font-medium text-gray-900 mb-2">Selected Dates</h4>
                          <div className="space-y-1">
                            {selectedDates.map((date, index) => (
                              <div key={index} className="flex items-center justify-between text-sm">
                                <div className="text-gray-600">
                                  {new Date(date).toLocaleDateString('en-GB', { 
                                    weekday: 'long', 
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric'
                                  })}
                                </div>
                                <div className="text-gray-500">
                                  {getHolidayTimeSlotsForDate(date).length} time slot(s) available
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Show selected children and time slots */}
                      {bookingCart.length > 0 && (
                        <>
                          <div className="border-b border-gray-200 pb-4">
                            <h4 className="font-medium text-gray-900 mb-2">Selected Time Slots</h4>
                          </div>
                          {/* Group bookings by child */}
                          {children.map(child => {
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
                                          onClick={() => toggleHolidayTimeSlotBooking(
                                            { id: booking.childId, firstName: '', lastName: '' },
                                            { id: booking.holidayTimeSlotId, name: '', startTime: '', endTime: '', capacity: 0, price: 0, bookingsCount: 0 },
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
                                <div className="border-t pt-2 mt-2">
                                  <div className="flex justify-between font-bold">
                                    <span>Child Total:</span>
                                    <span>£{childBookings.reduce((sum, b) => sum + b.price, 0).toFixed(2)}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          
                          <div className="border-t pt-4">
                            <div className="flex justify-between font-bold text-lg">
                              <span>Total ({bookingCart.length} sessions):</span>
                              <span>£{getTotalPrice().toFixed(2)}</span>
                            </div>
                          </div>
                        </>
                      )}
                      
                      {bookingCart.length > 0 && (
                        <div className="space-y-3 mt-6">
                          <Button 
                            onClick={handleCheckout}
                            className="w-full bg-[#00806a] hover:bg-[#006b5a] text-white"
                          >
                            Book Holiday Club Now ({bookingCart.length} sessions)
                          </Button>
                          
                          <Button 
                            onClick={handleAddToBasket}
                            variant="outline"
                            className="w-full border-[#00806a] text-[#00806a] hover:bg-[#00806a] hover:text-white flex items-center justify-center gap-2"
                          >
                            <ShoppingCartIcon className="h-4 w-4" />
                            Add to Basket ({bookingCart.length} sessions)
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HolidayClubBookingPage;