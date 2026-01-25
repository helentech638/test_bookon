import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { toast } from 'react-hot-toast';
import authService from '../../services/authService';
import { buildApiUrl } from '../../config/api';
import { TicketIcon, ShoppingCartIcon } from '@heroicons/react/24/outline';
import { useBasket } from '../../contexts/CartContext';

interface Child {
  id: string;
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
  yearGroup?: string;
}

interface CourseBookingData {
  id: string;
  title?: string;
  name?: string;
  description: string;
  start_date?: string;
  end_date?: string;
  startDate?: string;
  endDate?: string;
  duration_weeks?: number;
  durationWeeks?: number;
  regular_day?: string;
  regularDay?: string;
  regular_time?: string;
  regularTime?: string;
  daysOfWeek?: string[];
  start_time?: string;
  end_time?: string;
  price: number;
  max_capacity?: number;
  current_capacity?: number;
  capacity?: number;
  proRataBooking?: boolean;
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
}

// Calculate pro rata price based on remaining sessions
const calculateProRataPrice = (course: any): number => {
  const now = new Date();
  const courseStartDate = new Date(course.startDate || course.start_date);
  const courseEndDate = new Date(course.endDate || course.end_date);
  const sessionPrice = Number(course.price || 0);
  
  // If pro rata booking is disabled, charge full amount
  if (!course.proRataBooking) {
    return (course.durationWeeks || course.duration_weeks || 1) * sessionPrice;
  }
  
  // If course hasn't started yet, charge full amount
  if (now < courseStartDate) {
    return (course.durationWeeks || course.duration_weeks || 1) * sessionPrice;
  }
  
  // If course has ended, no charge (shouldn't happen in normal flow)
  if (now > courseEndDate) {
    return 0;
  }
  
  // Calculate remaining sessions
  const totalWeeks = course.durationWeeks || course.duration_weeks || 1;
  const courseStartTime = new Date(courseStartDate);
  const courseEndTime = new Date(courseEndDate);
  
  // Calculate how many weeks have passed
  // Use Math.ceil to count partial weeks as full weeks (conservative approach)
  const weeksPassed = Math.ceil((now.getTime() - courseStartTime.getTime()) / (7 * 24 * 60 * 60 * 1000));
  const remainingWeeks = Math.max(0, totalWeeks - weeksPassed);
  
  // If we're in the middle of a week, count it as a full week (conservative approach)
  const weeksToCharge = Math.max(1, remainingWeeks); // At least charge for 1 week
  
  
  return weeksToCharge * sessionPrice;
};

const CourseBookingPage: React.FC = () => {
  const { activityId } = useParams<{ activityId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToBasket } = useBasket();

  // Function to calculate all session dates for selected days
  const calculateSessionDates = (startDate: string, endDate: string, daysOfWeek: string[]) => {
    if (!startDate || !endDate || !daysOfWeek || daysOfWeek.length === 0) return [];
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const sessionDates: string[] = [];
    
    // Map day names to day numbers (0 = Sunday, 1 = Monday, etc.)
    const dayMap: { [key: string]: number } = {
      'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3, 
      'thursday': 4, 'friday': 5, 'saturday': 6
    };
    
    const targetDays = daysOfWeek.map(day => dayMap[day.toLowerCase()]).filter(day => day !== undefined);
    
    // Find all dates for each target day within the range
    targetDays.forEach(targetDay => {
      const currentDate = new Date(start);
      
      // Find first occurrence of this day
      const daysUntilFirstSession = (targetDay - start.getDay() + 7) % 7;
      currentDate.setDate(start.getDate() + daysUntilFirstSession);
      
      // If first session date is before start date, move to next week
      if (currentDate < start) {
        currentDate.setDate(currentDate.getDate() + 7);
      }
      
      // Add all sessions for this day within the date range
      while (currentDate <= end) {
        sessionDates.push(currentDate.toLocaleDateString('en-GB', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric' 
        }));
        currentDate.setDate(currentDate.getDate() + 7);
      }
    });
    
    return sessionDates.sort((a, b) => new Date(a.split('/').reverse().join('-')).getTime() - new Date(b.split('/').reverse().join('-')).getTime());
  };
  const [children, setChildren] = useState<Child[]>([]);
  const [course, setCourse] = useState<CourseBookingData | null>(null);
  const [selectedChildIds, setSelectedChildIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (activityId) {
      fetchCourse();
      fetchChildren();
    }
  }, [activityId]);

  const checkExistingBooking = async (courseId: string) => {
    try {
      const token = authService.getToken();
      if (!token) return;

      const response = await fetch(buildApiUrl('/bookings'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const existingBooking = data.data.find((booking: any) => 
            booking.activityId === courseId && 
            booking.notes && 
            booking.notes.includes('COURSE_BOOKING') &&
            booking.status !== 'cancelled'
          );
          
          if (existingBooking) {
            toast.error('You already have an existing booking for this course. Please check your bookings page to view details.');
            navigate('/bookings');
            return;
          }
        }
      }
    } catch (error) {
      // Don't block the user if we can't check
    }
  };

  const fetchCourse = async () => {
    try {
      const token = authService.getToken();
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch(buildApiUrl(`/activities/${activityId}`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch course');
      }

      const data = await response.json();
      if (data.success && data.data) {
        setCourse(data.data);
        
        // Check if user already has a booking for this course
        await checkExistingBooking(data.data.id);
      } else {
        throw new Error(data.message || 'Failed to fetch course');
      }
    } catch (error) {
      toast.error('Failed to load course details');
      navigate('/activities');
    }
  };

  const fetchChildren = async () => {
    try {
      const token = authService.getToken();
      if (!token) {
        navigate('/login');
        return;
      }

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
      if (data.success && data.data) {
        setChildren(data.data);
      } else {
        throw new Error(data.message || 'Failed to fetch children');
      }
    } catch (error) {
      toast.error('Failed to load children');
    } finally {
      setLoading(false);
    }
  };

  const getChildName = (child: Child) => {
    const firstName = child.firstName || child.first_name || '';
    const lastName = child.lastName || child.last_name || '';
    return `${firstName} ${lastName}`.trim() || 'Child';
  };

  const formatCourseSchedule = () => {
    if (!course) return '';
    
    const days = course.daysOfWeek && course.daysOfWeek.length > 0 ? 
      course.daysOfWeek.map(day => day.charAt(0).toUpperCase() + day.slice(1)).join(', ') :
      course.regularDay || course.regular_day;
    const time = course.start_time && course.end_time ? 
      `${course.start_time} - ${course.end_time}` :
      course.regularTime || course.regular_time;
    const duration = course.durationWeeks || course.duration_weeks;
    const startDate = course.startDate || course.start_date;
    const endDate = course.endDate || course.end_date;
    
    if (!days || !time || !duration || !startDate) {
      return 'Schedule details unavailable';
    }
    
    return `Every ${days}, ${time}, ${duration} sessions from ${new Date(startDate).toLocaleDateString()} – ${endDate ? new Date(endDate).toLocaleDateString() : 'TBD'}`;
  };

  const handleBookCourse = () => {
    if (selectedChildIds.length === 0) {
      toast.error('Please select at least one child');
      return;
    }

    if (!course) {
      toast.error('Course information not available');
      return;
    }

    // Calculate pro rata price for all selected children
    const pricePerChild = calculateProRataPrice(course);
    const totalPrice = pricePerChild * selectedChildIds.length;

    // Prepare children data
    const selectedChildren = children.filter(child => selectedChildIds.includes(child.id));
    const childrenData = selectedChildren.map(child => ({
      id: child.id,
      name: getChildName(child)
    }));

    // Create basket item for course booking
    const basketItem = {
      id: `course-${course.id}-${Date.now()}`,
      activityId: course.id,
      activityName: course.title || 'Unknown Course',
      venueName: course.venue?.name || 'Unknown Venue',
      date: course.startDate || course.start_date || '',
      time: course.regularTime || course.regular_time || '',
      price: totalPrice,
      children: childrenData,
      bookingType: 'course' as const,
      pricePerChild: pricePerChild,
      courseSchedule: formatCourseSchedule(),
      totalWeeks: course.durationWeeks || course.duration_weeks || 1
    };

    // Add to basket and navigate to basket checkout
    addToBasket(basketItem);
    
    navigate('/checkout', {
      state: {
        basketItems: [basketItem],
        totalPrice: totalPrice,
        totalItems: 1
      }
    });
  };

  const handleAddToBasket = () => {
    if (selectedChildIds.length === 0) {
      toast.error('Please select at least one child');
      return;
    }

    if (!course) {
      toast.error('Course information not available');
      return;
    }

    // Calculate pro rata price for all selected children
    const pricePerChild = calculateProRataPrice(course);
    const totalPrice = pricePerChild * selectedChildIds.length;

    // Prepare children data
    const selectedChildren = children.filter(child => selectedChildIds.includes(child.id));
    const childrenData = selectedChildren.map(child => ({
      id: child.id,
      name: getChildName(child)
    }));

    // Create basket item
    const basketItem = {
      id: `course-${course.id}-${Date.now()}`, // Unique ID
      activityId: course.id,
      activityName: course.title || 'Unknown Course',
      venueName: course.venue?.name || 'Unknown Venue',
      date: course.startDate || course.start_date || '',
      time: course.start_time && course.end_time ? 
        `${course.start_time} - ${course.end_time}` : 
        course.regularTime || course.regular_time || 'TBD',
      price: totalPrice,
      children: childrenData,
      // Additional course-specific data
      bookingType: 'course' as const,
      courseSchedule: formatCourseSchedule(),
      totalWeeks: course.durationWeeks || course.duration_weeks,
      pricePerChild: pricePerChild
    };

    // Add to basket
    addToBasket(basketItem);
    
    toast.success(`Course "${course.title}" added to basket for ${selectedChildIds.length} child${selectedChildIds.length > 1 ? 'ren' : ''}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00806a] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading course details...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-gray-900 mb-4">Course Not Found</h1>
                <p className="text-gray-600 mb-6">The course you're looking for doesn't exist or has been removed.</p>
                <Button onClick={() => navigate('/activities')} className="bg-[#00806a] hover:bg-[#006b5a] text-white">
                  Back to Activities
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Button 
            onClick={() => navigate('/activities')} 
            variant="outline" 
            className="mb-4"
          >
            ← Back to Activities
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">
            Book Course: {course.title || course.name}
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Course Details */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Course Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Schedule</h3>
                  <p className="text-gray-700">{formatCourseSchedule()}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
                  <p className="text-gray-700">{course.description}</p>
                </div>

                 {/* Course Schedule & Pricing Overview */}
                 <div className="bg-gradient-to-r from-[#00806a] to-[#00a085] p-4 rounded-lg text-white">
                   <h3 className="font-semibold text-lg mb-3 text-white">Course Details</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                       <p className="text-sm text-white/80">Schedule</p>
                       <p className="font-medium text-white">
                         {course.daysOfWeek && course.daysOfWeek.length > 0 ? 
                           `Every ${course.daysOfWeek.map(day => day.charAt(0).toUpperCase() + day.slice(1)).join(', ')}` :
                           `Every ${course.regularDay || course.regular_day || 'TBD'}`
                         }
                       </p>
                       <p className="text-sm text-white">
                         {course.durationWeeks || course.duration_weeks ? 
                           `${course.durationWeeks || course.duration_weeks} sessions total` : 
                           'Sessions TBD'
                         }
                       </p>
                       {/* Session Dates */}
                       {course.daysOfWeek && course.daysOfWeek.length > 0 && (course.start_date || course.startDate) && (course.end_date || course.endDate) && (
                         <div className="mt-2">
                           <p className="text-xs text-white/80">Session Dates:</p>
                           <div className="text-xs text-white">
                             {(() => {
                               const startDate = course.start_date || course.startDate;
                               const endDate = course.end_date || course.endDate;
                               if (!startDate || !endDate) return 'Dates TBD';
                               
                               const sessionDates = calculateSessionDates(startDate, endDate, course.daysOfWeek);
                               return sessionDates.length > 0 ? 
                                 sessionDates.join(', ') : 
                                 'Dates TBD';
                             })()}
                           </div>
                         </div>
                       )}
                     </div>
                     <div>
                       <p className="text-sm text-white/80">Pricing</p>
                       <p className="font-medium text-white">
                         from £{Number(course.price || 0).toFixed(2)} per session
                       </p>
                       <p className="text-sm text-white">
                         {course.durationWeeks || course.duration_weeks ? 
                           `× ${course.durationWeeks || course.duration_weeks} = £${calculateProRataPrice(course).toFixed(2)} total` : 
                           'Total TBD'
                         }
                       </p>
                       {course.proRataBooking && (
                         <p className="text-xs text-white/70">
                           Pro rata billing enabled - only pay for remaining sessions
                         </p>
                       )}
                     </div>
                     <div>
                       <p className="text-sm text-white/80 flex items-center">
                         <TicketIcon className="w-4 h-4 mr-2" />
                         Booking Type:
                       </p>
                       <span className={`text-sm font-medium px-2 py-1 rounded-full ${
                         course.proRataBooking 
                           ? 'bg-green-100 text-green-800' 
                           : 'bg-teal-100 text-teal-800'
                       }`}>
                         {course.proRataBooking ? 'Pro-rata Available' : 'Full Booking Only'}
                       </span>
                     </div>
                   </div>
                 </div>


                 <div className="grid grid-cols-2 gap-4 mt-4">
                   <div>
                     <h3 className="font-semibold text-gray-900 mb-2">Age Range</h3>
                     <p className="text-gray-700">
                       {(() => {
                         const ageRange = course.ageRange || course.age_range;
                         if (typeof ageRange === 'string') {
                           return ageRange;
                         } else if (ageRange && typeof ageRange === 'object' && ageRange.min && ageRange.max) {
                           return `Ages ${ageRange.min}-${ageRange.max}`;
                         }
                         return 'Age TBD';
                       })()}
                     </p>
                   </div>
                   <div>
                     <h3 className="font-semibold text-gray-900 mb-2">Session Time</h3>
                     <p className="text-gray-700">
                       {course.start_time && course.end_time ? 
                         `${course.start_time} - ${course.end_time}` :
                         course.regularTime || course.regular_time || 'Time to be confirmed'
                       }
                     </p>
                   </div>
                 </div>

                {course.venue && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Venue</h3>
                    <p className="text-gray-700">{course.venue.name}</p>
                    <p className="text-gray-600 text-sm">{course.venue.address}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Child Selection */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Select Children</CardTitle>
                <p className="text-sm text-gray-600">You can select multiple children for this course</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {children.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => {
                        if (selectedChildIds.includes(child.id)) {
                          setSelectedChildIds(selectedChildIds.filter(id => id !== child.id));
                        } else {
                          setSelectedChildIds([...selectedChildIds, child.id]);
                        }
                      }}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedChildIds.includes(child.id)
                          ? 'border-[#00806a] bg-[#00806a]/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-4 h-4 rounded border-2 ${
                          selectedChildIds.includes(child.id)
                            ? 'border-[#00806a] bg-[#00806a]'
                            : 'border-gray-300'
                        }`}>
                          {selectedChildIds.includes(child.id) && (
                            <div className="w-full h-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <span className="font-medium">{getChildName(child)}</span>
                        {child.yearGroup && (
                          <span className="text-gray-500 text-sm">{child.yearGroup}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                
                {selectedChildIds.length > 0 && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>{selectedChildIds.length}</strong> child{selectedChildIds.length > 1 ? 'ren' : ''} selected
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Total cost: £{(calculateProRataPrice(course) * selectedChildIds.length).toFixed(2)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Booking Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Booking Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-medium text-gray-900">Course</h3>
                  <p className="text-gray-600">{course.title || course.name}</p>
                </div>

                {/* Course Schedule Details */}
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Schedule:</span>
                      <span className="text-sm font-medium">
                        {course.daysOfWeek && course.daysOfWeek.length > 0 ? 
                          `Every ${course.daysOfWeek.map(day => day.charAt(0).toUpperCase() + day.slice(1)).join(', ')}` :
                          `Every ${course.regularDay || course.regular_day || 'TBD'}`
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Time:</span>
                      <span className="text-sm font-medium">
                        {course.start_time && course.end_time ? 
                          `${course.start_time} - ${course.end_time}` :
                          course.regularTime || course.regular_time || 'TBD'
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Sessions:</span>
                      <span className="text-sm font-medium text-[#00806a]">
                        {course.durationWeeks || course.duration_weeks || 'TBD'} total
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Booking:</span>
                      <span className="text-sm font-medium">
                        {course.proRataBooking ? 'Pro-rata' : 'Full Course'}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-gray-900">Selected Children</h3>
                  {selectedChildIds.length > 0 ? (
                    <div className="space-y-1">
                      {selectedChildIds.map(childId => {
                        const child = children.find(c => c.id === childId);
                        return child ? (
                          <p key={childId} className="text-gray-600">• {getChildName(child)}</p>
                        ) : null;
                      })}
                    </div>
                  ) : (
                    <p className="text-gray-600">Please select at least one child</p>
                  )}
                </div>

                 <div className="border-t pt-4">
                   <div className="space-y-2">
                     <div className="flex justify-between">
                       <span className="text-sm text-gray-600">Price per child:</span>
                       <span className="text-sm">£{calculateProRataPrice(course).toFixed(2)}</span>
                     </div>
                     <div className="flex justify-between">
                       <span className="text-sm text-gray-600">Number of children:</span>
                       <span className="text-sm">{selectedChildIds.length}</span>
                     </div>
                   </div>
                   <div className="flex justify-between items-center mt-3 pt-3 border-t">
                     <span className="text-lg font-semibold text-gray-900">Total Price</span>
                     <span className="text-lg font-bold text-[#00806a]">
                       £{(calculateProRataPrice(course) * selectedChildIds.length).toFixed(2)}
                     </span>
                   </div>
                   <p className="text-xs text-gray-500 mt-1">
                     {course.proRataBooking ? 
                       `Pro rata billing - only remaining sessions × ${selectedChildIds.length} children` :
                       `${course.durationWeeks || course.duration_weeks} × from £${Number(course.price || 0).toFixed(2)} per session × ${selectedChildIds.length} children`
                     }
                   </p>
                 </div>

                <div className="space-y-3">
                  <Button 
                    onClick={handleBookCourse}
                    disabled={selectedChildIds.length === 0 || submitting}
                    className="w-full bg-[#00806a] hover:bg-[#006b5a] text-white"
                  >
                    {submitting ? 'Processing...' : 'Book Course Now'}
                  </Button>
                  
                  <Button 
                    onClick={handleAddToBasket}
                    disabled={selectedChildIds.length === 0}
                    variant="outline"
                    className="w-full border-[#00806a] text-[#00806a] hover:bg-[#00806a] hover:text-white flex items-center justify-center gap-2"
                  >
                    <ShoppingCartIcon className="h-4 w-4" />
                    Add to Basket
                  </Button>
                </div>

                <div className="text-xs text-gray-500 space-y-1">
                  <p>• Full course enrollment</p>
                  <p>• No individual session booking</p>
                  <p>• Payment due at checkout</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseBookingPage;
