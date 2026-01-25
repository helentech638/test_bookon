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

interface TimeSlot {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  price: number;
  capacity: number;
  bookingsCount: number;
}

interface ActivitySession {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  timeSlots: TimeSlot[];
}

interface Child {
  id: string;
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
  yearGroup?: string;
}

interface BookingItem {
  childId: string;
  childName: string;
  sessionId: string;
  timeSlotId: string;
  sessionDate: string;
  sessionName: string;
  startTime: string;
  endTime: string;
  price: number;
}

interface ActivityData {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  price: number;
  capacity: number;
  bookings: any[];
  ageRange?: string | { min: number; max: number };
  venue?: {
    name: string;
    address: string;
  };
  holidayTimeSlots?: TimeSlot[];
  proRataBooking?: boolean;
}

const ActivityBookingPage: React.FC = () => {
  const { activityId } = useParams<{ activityId: string }>();
  const navigate = useNavigate();
  const { addToBasket } = useBasket();
  
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [bookingCart, setBookingCart] = useState<BookingItem[]>([]);
  const [sessions, setSessions] = useState<ActivitySession[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Generate available dates from activity
  const generateAvailableDates = () => {
    if (!activity?.startDate || !activity?.endDate) {
      return [];
    }
    const dates = [];
    const startDate = new Date(activity.startDate);
    const endDate = new Date(activity.endDate);
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      dates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return dates.sort();
  };

  const availableDates = generateAvailableDates();

  // Get the default month for calendar navigation based on activity dates
  const getDefaultMonth = () => {
    if (!activity) return new Date();
    
    // Use the start date of the activity to determine the default month
    const startDate = new Date(activity.startDate);
    return new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  };

  // Handle date selection
  const handleDateSelection = (date: string) => {
    setSelectedDates(prev => {
      if (prev.includes(date)) {
        // Remove date if already selected
        const newDates = prev.filter(d => d !== date);
        // Remove time slot bookings for this date
        setBookingCart(curr => curr.filter(booking => booking.sessionDate !== date));
        return newDates;
      } else {
        // Add date if not selected
        return [...prev, date];
      }
    });
  };

  // Get time slots for a specific date
  const getTimeSlotsForDate = (date: string) => {
    const session = sessions.find(s => s.date === date);
    return session ? session.timeSlots : [];
  };

  // Check if time slot is available
  const isTimeSlotAvailable = (timeSlot: TimeSlot) => {
    return timeSlot.bookingsCount < timeSlot.capacity;
  };

  // Check if time slot is already booked for a child
  const isTimeSlotBooked = (childId: string, timeSlotId: string) => {
    return bookingCart.some(item => 
      item.childId === childId && item.timeSlotId === timeSlotId
    );
  };

  // Toggle time slot booking
  const toggleTimeSlotBooking = (child: Child, timeSlot: TimeSlot, date: string) => {
    const existingIndex = bookingCart.findIndex(item => 
      item.childId === child.id && item.timeSlotId === timeSlot.id && item.sessionDate === date
    );

    if (existingIndex >= 0) {
      // Remove from cart
      setBookingCart(prev => prev.filter((_, index) => index !== existingIndex));
      toast.success(`${child.firstName} removed from ${timeSlot.name}`);
    } else {
      // Add to cart
      const session = sessions.find(s => s.date === date);
      if (session) {
        const newBooking: BookingItem = {
          childId: child.id,
          childName: `${child.firstName} ${child.lastName}`,
          sessionId: session.id,
          timeSlotId: timeSlot.id,
          sessionDate: date,
          sessionName: timeSlot.name,
          startTime: timeSlot.startTime,
          endTime: timeSlot.endTime,
          price: parseFloat(timeSlot.price?.toString() || '0')
        };
        setBookingCart(prev => [...prev, newBooking]);
        toast.success(`${child.firstName} added to ${timeSlot.name} for ${new Date(date).toLocaleDateString('en-GB')}`);
      }
    }
  };

  // Get bookings for a specific child
  const getBookingsForChild = (childId: string) => {
    return bookingCart.filter(item => item.childId === childId);
  };

  // Get total price
  const getTotalPrice = () => {
    return bookingCart.reduce((total, item) => total + parseFloat(String(item.price || 0)), 0);
  };

  const fetchActivity = async () => {
    try {
      const token = await authService.getToken();
      const response = await fetch(buildApiUrl(`/activities/${activityId}`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          console.warn('Rate limited when fetching activity, retrying after delay');
          toast.error('Too many requests, please wait a moment');
          setTimeout(() => {
            fetchActivity();
          }, 2000);
          return;
        } else if (response.status === 404) {
          throw new Error('Activity not found');
        }
        throw new Error(`Failed to fetch activity: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Activity API response:', data);
      
      // Handle wrapped API response format
      const activityData = data.success ? data.data : data;
      setActivity(activityData);
      
      // Generate sessions for all activities
      generateSessions(activityData);
    } catch (error) {
      console.error('Error fetching activity:', error);
      if (error instanceof Error && !error.message.includes('429')) {
        toast.error(`Failed to load activity details: ${error.message}`);
      } else {
        toast.error('Please login again');
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const generateSessions = (activityData: ActivityData) => {
    const generatedSessions: ActivitySession[] = [];
    const startDate = new Date(activityData.startDate);
    const endDate = new Date(activityData.endDate);
    
    // Create default time slot if none exist
    const defaultTimeSlot: TimeSlot = {
      id: 'standard-day',
      name: 'Standard Day',
      startTime: activityData.startTime || '09:00',
      endTime: activityData.endTime || '17:00',
      price: activityData.price || 12,
      capacity: activityData.capacity || 20,
      bookingsCount: activityData.bookings?.length || 0
    };
    
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const session: ActivitySession = {
        id: `session-${currentDate.toISOString().split('T')[0]}`,
        date: currentDate.toISOString().split('T')[0],
        startTime: activityData.startTime,
        endTime: activityData.endTime,
        timeSlots: activityData.holidayTimeSlots && activityData.holidayTimeSlots.length > 0 
          ? activityData.holidayTimeSlots 
          : [defaultTimeSlot]
      };
      
      generatedSessions.push(session);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    setSessions(generatedSessions);
  };

  const fetchChildren = async () => {
    try {
      const token = await authService.getToken();
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
        if (response.status === 429) {
          console.warn('Rate limited when fetching children, retrying after delay');
          toast.error('Too many requests, please wait a moment');
          setTimeout(() => {
            fetchChildren();
          }, 2000);
          return;
        }
        throw new Error(`Failed to fetch children: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success && result.data) {
        setChildren(result.data);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Error fetching children:', error);
      if (error instanceof Error && !error.message.includes('429')) {
        toast.error('Failed to load children');
      }
    }
  };

  const handleProceedToCheckout = () => {
    if (bookingCart.length === 0) {
      toast.error('Please select at least one time slot');
      return;
    }
    
    // Add all selected time slots to basket and navigate to basket checkout
    for (const timeSlot of bookingCart) {
      const basketItem = {
        id: `${activity!.id}-${timeSlot.sessionId}`,
        activityId: activity!.id,
        activityName: activity!.title,
        venueName: activity!.venue?.name || 'Unknown Venue',
        date: timeSlot.sessionDate,
        time: `${timeSlot.startTime} - ${timeSlot.endTime}`,
        price: timeSlot.price,
        children: [{
          id: timeSlot.childId,
          name: timeSlot.childName
        }],
        bookingType: 'activity' as const,
        sessionId: timeSlot.sessionId,
        timeSlotId: timeSlot.timeSlotId,
        sessionName: timeSlot.sessionName
      };
      
      addToBasket(basketItem);
    }
    
    // Navigate to basket checkout
    navigate('/checkout', {
      state: {
        basketItems: bookingCart.map(timeSlot => ({
          id: `${activity!.id}-${timeSlot.sessionId}`,
          activityId: activity!.id,
          activityName: activity!.title,
          venueName: activity!.venue?.name || 'Unknown Venue',
          date: timeSlot.sessionDate,
          time: `${timeSlot.startTime} - ${timeSlot.endTime}`,
          price: timeSlot.price,
          children: [{
            id: timeSlot.childId,
            name: timeSlot.childName
          }],
          bookingType: 'activity' as const,
          sessionId: timeSlot.sessionId,
          timeSlotId: timeSlot.timeSlotId,
          sessionName: timeSlot.sessionName
        })),
        totalPrice: getTotalPrice(),
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
        id: `activity-${activity.id}-${booking.timeSlotId}-${Date.now()}-${index}`,
        activityId: activity.id,
        activityName: activity.title || 'Unknown Activity',
        venueName: activity.venue?.name || 'Unknown Venue',
        date: booking.sessionDate,
        time: `${booking.startTime} - ${booking.endTime}`,
        price: booking.price,
        children: [{
          id: booking.childId,
          name: booking.childName
        }],
        // Additional activity-specific data
        bookingType: 'activity' as const,
        sessionId: booking.sessionId,
        timeSlotId: booking.timeSlotId,
        sessionName: booking.sessionName
      };

      addToBasket(basketItem);
    });

    toast.success(`${bookingCart.length} booking${bookingCart.length > 1 ? 's' : ''} added to basket`);
  };

  useEffect(() => {
    fetchActivity();
    fetchChildren();
  }, [activityId]);

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

  if (!activity) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Activity Not Found</h1>
            <Button onClick={() => navigate('/activities')}>
              Back to Activities
            </Button>
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
            <h1 className="text-3xl font-bold text-gray-900">{activity.title}</h1>
            <p className="mt-2 text-lg text-gray-600">{activity.description}</p>
            
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                {new Date(activity.startDate).toLocaleDateString('en-GB')} - {new Date(activity.endDate).toLocaleDateString('en-GB')}
              </div>
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                {activity.startTime} - {activity.endTime}
              </div>
              <div className="flex items-center">
                <Users className="h-4 w-4 mr-1" />
                Max {activity.capacity} children
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Booking Interface */}
          <div className="space-y-6">
            {/* Date Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Select Dates</CardTitle>
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

            {/* Time Slot Selection */}
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
                  <div className="space-y-6">
                    {selectedDates.map(date => {
                      const dateTimeSlots = getTimeSlotsForDate(date);
                      return (
                        <div key={date} className="border border-gray-200 rounded-lg p-4">
                          <div className="bg-blue-500 border-2 border-blue-500 rounded-xl p-4 mb-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                                <h3 className="font-semibold text-white text-lg">
                                  {new Date(date).toLocaleDateString('en-GB', {
                                    weekday: 'long', 
                                    day: 'numeric', 
                                    month: 'long' 
                                  })}
                                </h3>
                              </div>
                              <div className="px-3 py-1 bg-blue-600 text-white rounded-full text-sm font-medium">
                                {dateTimeSlots.length} session{dateTimeSlots.length !== 1 ? 's' : ''}
                              </div>
                            </div>
                          </div>
                          
                          {dateTimeSlots.length === 0 ? (
                            <div className="text-center py-4 text-gray-500">
                              <Clock className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                              <p>No time slots available for this date</p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {children.map(child => (
                                <div key={child.id} className="border border-gray-300 rounded-lg p-3 bg-gray-50">
                                  <div className="flex items-center justify-between mb-3">
                                    <h4 className="font-medium text-gray-900">
                                      {child.firstName || child.first_name} {child.lastName || child.last_name}
                                      {child.yearGroup && (
                                        <span className="text-sm text-gray-500 ml-2">({child.yearGroup})</span>
                                      )}
                                    </h4>
                                    <div className="text-sm text-gray-500">
                                      {getBookingsForChild(child.id).filter(booking => booking.sessionDate === date).length} slot(s) selected
                                    </div>
                                  </div>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {dateTimeSlots.map(timeSlot => {
                                      const isBooked = isTimeSlotBooked(child.id, timeSlot.id);
                                      const isAvailable = isTimeSlotAvailable(timeSlot);
                                      const isDisabled = !isAvailable && !isBooked;
                                      
                                      return (
                                        <button
                                          key={timeSlot.id}
                                          onClick={() => isAvailable ? toggleTimeSlotBooking(child, timeSlot, date) : null}
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
                                            <div className="font-medium">{timeSlot.name}</div>
                                            <div className="text-xs text-gray-500">
                                              {timeSlot.startTime} - {timeSlot.endTime}
                                            </div>
                                            <div className="text-xs font-bold text-green-600 mt-1">
                                              £{timeSlot.price}
                                            </div>
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
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

          {/* Right Column - Booking Summary */}
          <div className="space-y-6">
            {/* Activity Info */}
            <Card>
              <CardHeader>
                <CardTitle>Activity Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Date Range:</span>
                    <span>{new Date(activity.startDate).toLocaleDateString('en-GB')} - {new Date(activity.endDate).toLocaleDateString('en-GB')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Times:</span>
                    <span>{activity.startTime} - {activity.endTime}</span>
                  </div>
                  {activity.venue && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Venue:</span>
                        <span className={activity.venue.name ? 'text-sm' : 'text-sm text-gray-400'}>
                          {activity.venue.name || 'TBD'}
                        </span>
                      </div>
                      {activity.venue.address && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Address:</span>
                          <span className="text-sm">{activity.venue.address}</span>
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Capacity:</span>
                    <span>{activity.capacity - (activity.bookings?.length || 0)} slots available</span>
                  </div>
                  {activity.ageRange && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Age Range:</span>
                      <span className="text-sm">
                        {typeof activity.ageRange === 'string' ? activity.ageRange : 
                         typeof activity.ageRange === 'object' ? `Ages ${activity.ageRange.min}-${activity.ageRange.max}` : 
                         'Age TBD'}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Price:</span>
                    <span className="text-lg font-semibold text-green-600">from £{activity.price}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Booking Type:</span>
                    <span className={`text-sm font-medium px-2 py-1 rounded-full ${
                      activity.proRataBooking 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {activity.proRataBooking ? 'Pro-rata Available' : 'Full Booking Only'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Booking Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCartIcon className="h-5 w-5" />
                  Booking Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                {bookingCart.length === 0 && selectedDates.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <ShoppingCartIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>Booking empty</p>
                    <p className="text-sm">Select dates and time slots to start booking</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Show selected dates summary */}
                    {selectedDates.length > 0 && (
                      <div className="border-b border-gray-200 pb-4">
                        <h4 className="font-medium text-gray-900 mb-2">Selected Dates</h4>
                        <div className="space-y-1">
                          {selectedDates.map(date => (
                            <div key={date} className="text-sm text-gray-600">
                              {new Date(date).toLocaleDateString('en-GB', { 
                                weekday: 'short', 
                                day: 'numeric',
                                month: 'short'
                              })}
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
                                {child.firstName || child.first_name} {child.lastName || child.last_name}
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
                                        })}
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <span className="font-medium">£{parseFloat(String(booking.price || 0)).toFixed(2)}</span>
                                      <button
                                        onClick={() => toggleTimeSlotBooking(
                                          { id: booking.childId, firstName: '', lastName: '' },
                                          { id: booking.timeSlotId, name: '', startTime: '', endTime: '', capacity: 0, price: 0, bookingsCount: 0 },
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
                      </>
                    )}

                    {/* Total */}
                    {bookingCart.length > 0 && (
                      <div className="pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-between text-lg font-semibold">
                          <span>Total ({bookingCart.length} sessions):</span>
                          <span>£{getTotalPrice().toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="space-y-3 mt-6">
                  <Button 
                    onClick={handleProceedToCheckout}
                    disabled={bookingCart.length === 0}
                    className="w-full bg-[#00806a] hover:bg-[#006b5a] text-white"
                  >
                    Book Activity Now ({bookingCart.length} sessions)
                  </Button>
                  
                  <Button 
                    onClick={handleAddToBasket}
                    disabled={bookingCart.length === 0}
                    variant="outline"
                    className="w-full border-[#00806a] text-[#00806a] hover:bg-[#00806a] hover:text-white flex items-center justify-center gap-2"
                  >
                    <ShoppingCartIcon className="h-4 w-4" />
                    Add to Basket ({bookingCart.length} sessions)
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

export default ActivityBookingPage;