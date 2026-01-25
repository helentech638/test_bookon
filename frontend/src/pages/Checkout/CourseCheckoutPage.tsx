import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { toast } from 'react-hot-toast';
import authService from '../../services/authService';
import { buildApiUrl } from '../../config/api';
import StripePayment from '../../components/payment/StripePayment';
import PaymentSuccess from '../../components/payment/PaymentSuccess';

interface CourseData {
  id: string;
  name?: string;
  title?: string;
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
  price: number;
  max_capacity?: number;
  current_capacity?: number;
  capacity?: number;
  bookings?: any[];
  proRataBooking?: boolean;
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

const CourseCheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [course, setCourse] = useState<CourseData | null>(null);
  const [children, setChildren] = useState<Array<{id: string, name: string}>>([]);
  const [childId, setChildId] = useState<string>('');
  const [childName, setChildName] = useState<string>('');
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [bookingData, setBookingData] = useState<any>(null);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  const [paymentIntentId, setPaymentIntentId] = useState<string>('');

  useEffect(() => {
    // Extract course booking data from location state
    if (location.state) {
      const { course: courseData, children: childrenFromState, totalPrice: totalPriceFromState, pricePerChild: pricePerChildFromState } = location.state as any;
      
      if (!courseData || !childrenFromState || childrenFromState.length === 0 || !totalPriceFromState) {
        toast.error('No booking information found');
        navigate('/activities');
        return;
      }

      setCourse(courseData);
      setChildren(childrenFromState);
      setTotalPrice(totalPriceFromState);
      
      // Use the first child for display purposes
      if (childrenFromState.length > 0) {
        setChildId(childrenFromState[0].id);
        setChildName(childrenFromState[0].name);
      }
    } else {
      toast.error('No booking information found');
      navigate('/activities');
    }
  }, [location.state, navigate]);

  const formatCourseSchedule = () => {
    if (!course) return '';
    
    const day = course.regularDay || course.regular_day;
    const time = course.regularTime || course.regular_time;
    const duration = course.durationWeeks || course.duration_weeks;
    const startDate = course.startDate || course.start_date;
    const endDate = course.endDate || course.end_date;
    
    if (!day || !time || !duration || !startDate) return 'Schedule details unavailable';
    
    const hours = time;
    return `Every ${day}, ${hours}, ${duration} weeks from ${new Date(startDate).toLocaleDateString()} – ${endDate ? new Date(endDate).toLocaleDateString() : 'TBD'}`;
  };

  const handlePaymentSuccess = (paymentIntentId: string) => {
    setPaymentIntentId(paymentIntentId);
    setShowPaymentSuccess(true);
    toast.success('Payment successful! Course booking confirmed.');
  };

  const handlePaymentError = (error: string) => {
    toast.error(`Payment failed: ${error}`);
    setShowPayment(false);
  };

  const handlePaymentCancel = () => {
    toast.success('Payment cancelled. You can complete payment later from your bookings page.');
    navigate('/bookings');
  };

  const calculateProRataInfo = () => {
    if (!course) return { sessionsToCharge: 0, totalSessions: 0, isProRata: false };
    
    const now = new Date();
    const courseStartDate = new Date(course.startDate || course.start_date || '');
    const courseEndDate = new Date(course.endDate || course.end_date || '');
    const sessionPrice = Number(course.price || 0);
    const totalSessions = course.durationWeeks || course.duration_weeks || 1;

    if (!course.proRataBooking) {
      return { sessionsToCharge: totalSessions, totalSessions, isProRata: false };
    }

    if (now < courseStartDate) {
      return { sessionsToCharge: totalSessions, totalSessions, isProRata: false };
    }

    if (now > courseEndDate) {
      return { sessionsToCharge: 0, totalSessions, isProRata: true };
    }

    const weeksPassed = Math.ceil((now.getTime() - courseStartDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const remainingWeeks = Math.max(0, totalSessions - weeksPassed);
    const sessionsToCharge = Math.max(1, remainingWeeks);

    return { sessionsToCharge, totalSessions, isProRata: true };
  };

  const handleCompleteBooking = async () => {
    if (!course || children.length === 0 || !totalPrice) {
      toast.error('Missing booking information');
      return;
    }

    // Debug logging
    console.log('Course data:', course);
    console.log('Course ID:', course.id);
    console.log('Children:', children);
    
    if (!course.id) {
      toast.error('Course ID is missing. Please try again.');
      console.error('Course ID is undefined:', course);
      return;
    }

    setSubmitting(true);
    try {
      const token = await authService.getToken();
      if (!token) {
        toast.error('Please log in to complete booking');
        navigate('/login');
        return;
      }

      // Debug: Log the request payload
      const requestPayload = {
        activityId: course.id,
        children: children,
        // Course-specific booking data
        bookingType: 'course',
        courseId: course.id,
        courseSchedule: formatCourseSchedule(),
        totalWeeks: course.durationWeeks || course.duration_weeks,
        amount: totalPrice
      };
      
      console.log('Sending booking request:', requestPayload);

      // First create the course booking
      const bookingResponse = await fetch(buildApiUrl('/bookings'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });

      if (!bookingResponse.ok) {
        const errorData = await bookingResponse.json();
        console.log('Booking error response:', errorData);
        console.log('Booking response status:', bookingResponse.status);
        console.log('Booking response headers:', Object.fromEntries(bookingResponse.headers.entries()));
        
        if (errorData.code === 'COURSE_BOOKING_EXISTS') {
          toast.error('You already have an existing booking for this course. Please check your bookings page to view details.');
          navigate('/bookings');
          return;
        }
        throw new Error('Failed to create booking');
      }

      const bookingData = await bookingResponse.json();
      
      if (!bookingData.success) {
        throw new Error(bookingData.message || 'Failed to create booking');
      }

      // Debug: Log booking response
      console.log('Booking created successfully:', bookingData);
      console.log('Proceeding to payment creation...');

      // Create payment intent for the course booking
      const paymentResponse = await fetch(buildApiUrl('/payments/create-intent'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: totalPrice,
          bookingIds: [bookingData.data.courseBookings[0].id], // Use first course booking
          paymentMethod: 'card',
          successUrl: `${window.location.origin}/bookings?success=true`,
          cancelUrl: `${window.location.origin}/checkout/course`
        })
      });

      if (!paymentResponse.ok) {
        throw new Error('Failed to create payment intent');
      }

      const paymentData = await paymentResponse.json();
      
      // Store booking and payment data, then show payment form
      setBookingData(bookingData.data);
      setPaymentData(paymentData.data);
      setShowPayment(true);
      
      toast.success('Course booking created! Please complete payment to confirm.');
      
    } catch (error) {
      console.error('Error creating course booking:', error);
      // Check if it's a COURSE_BOOKING_EXISTS error
      if (error instanceof Error && error.message.includes('COURSE_BOOKING_EXISTS')) {
        toast.error('You already have an existing booking for this course. Please check your bookings page to view details.');
        navigate('/bookings');
        return;
      }
      toast.error('Failed to proceed with payment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  if (showPaymentSuccess) {
    return (
      <PaymentSuccess
        paymentIntentId={paymentIntentId}
        amount={totalPrice}
        currency="GBP"
        bookingData={bookingData}
        onRedirect={() => navigate('/bookings', {
          state: {
            success: true,
            message: 'Course booking completed successfully!',
            bookingData: bookingData
          }
        })}
      />
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-gray-900 mb-4">Booking Not Found</h1>
                <p className="text-gray-600 mb-6">Unable to retrieve booking information.</p>
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

  if (showPayment) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="mb-6">
            <Button 
              onClick={() => setShowPayment(false)} 
              variant="outline" 
              className="mb-4"
            >
              ← Back to Summary
            </Button>
            <h1 className="text-3xl font-bold text-gray-900">Complete Payment</h1>
          </div>

          {/* Order Summary */}
          <div className="mb-8">
            <Card className="w-full">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between">
                      <span>{course?.title || course?.name}</span>
                      <span className="font-medium">£{Number(totalPrice || 0).toFixed(2)}</span>
                    </div>
                    {(() => {
                      const proRataInfo = calculateProRataInfo();
                      if (proRataInfo.isProRata) {
                        return (
                          <div className="text-xs text-gray-500">
                            Pro rata billing: {proRataInfo.sessionsToCharge} of {proRataInfo.totalSessions} sessions × £{Number(course?.price || 0).toFixed(2)} per session
                          </div>
                        );
                      } else {
                        return (
                          <div className="text-xs text-gray-500">
                            {proRataInfo.totalSessions} × £{Number(course?.price || 0).toFixed(2)} per session
                          </div>
                        );
                      }
                    })()}
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    Enrollment for: {childName}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-lg font-semibold text-gray-900">Total</span>
                    <span className="text-xl font-bold text-[#00806a]">£{Number(totalPrice || 0).toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-gray-500">One-time course payment</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Full-Width Payment Form */}
          <Card className="w-full">
            <CardContent className="p-6">
              <StripePayment
                amount={totalPrice}
                currency="GBP"
                bookingId={bookingData?.courseBookings?.[0]?.id}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                onCancel={handlePaymentCancel}
              />
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
            onClick={handleBack} 
            variant="outline" 
            className="mb-4"
          >
            ← Back to Booking
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Complete Course Booking</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Course Details */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Booking Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Course</h3>
                  <p className="text-lg font-medium">{course.title || course.name}</p>
                  <p className="text-gray-600">Full course enrollment</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Schedule</h3>
                  <p className="text-gray-700">{formatCourseSchedule()}</p>
                </div>

                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <h3 className="font-semibold text-gray-900 mb-2">Enrolled Child</h3>
                     <p className="text-gray-700">{childName}</p>
                   </div>
                   <div>
                     <h3 className="font-semibold text-gray-900 mb-2">Duration</h3>
                     <p className="text-gray-700">{course.durationWeeks || course.duration_weeks || 'TBD'} weeks</p>
                   </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <h3 className="font-semibold text-gray-900 mb-2">Total Sessions</h3>
                     <p className="text-gray-700 font-medium text-[#00806a]">
                       {course.durationWeeks || course.duration_weeks ? 
                         `${course.durationWeeks || course.duration_weeks} sessions` : 
                         'Sessions TBD'
                       }
                     </p>
                   </div>
                   <div>
                     <h3 className="font-semibold text-gray-900 mb-2">Price per Session</h3>
                     <p className="text-gray-700">£{Number(course.price || 0).toFixed(2)}</p>
                   </div>
                 </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
                  <p className="text-gray-700">{course.description}</p>
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

            {/* Important Information */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Important Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm text-gray-700">
                  <div className="flex items-start space-x-2">
                    <span className="text-[#00806a] font-semibold">•</span>
                    <span>This booking enrolls your child for the entire course duration</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-[#00806a] font-semibold">•</span>
                    <span>Payment is due in full at checkout</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-[#00806a] font-semibold">•</span>
                    <span>Full course enrollment</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-[#00806a] font-semibold">•</span>
                    <span>No individual session cancellation</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-[#00806a] font-semibold">•</span>
                    <span>Please check course schedule carefully before booking</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between">
                      <span>{course.title || course.name}</span>
                      <span className="font-medium">£{Number(totalPrice || 0).toFixed(2)}</span>
                    </div>
                    {(() => {
                      const proRataInfo = calculateProRataInfo();
                      if (proRataInfo.isProRata) {
                        return (
                          <div className="text-xs text-gray-500">
                            Pro rata billing: {proRataInfo.sessionsToCharge} of {proRataInfo.totalSessions} sessions × £{Number(course.price || 0).toFixed(2)} per session
                          </div>
                        );
                      } else {
                        return (
                          <div className="text-xs text-gray-500">
                            {proRataInfo.totalSessions} × £{Number(course.price || 0).toFixed(2)} per session
                          </div>
                        );
                      }
                    })()}
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    Enrollment for: {childName}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-lg font-semibold text-gray-900">Total</span>
                    <span className="text-xl font-bold text-[#00806a]">£{Number(totalPrice || 0).toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-gray-500">One-time course payment</p>
                </div>

                {!showPayment ? (
                  <Button 
                    onClick={handleCompleteBooking}
                    disabled={submitting}
                    className="w-full bg-[#00806a] hover:bg-[#006b5a] text-white text-lg py-3"
                  >
                    {submitting ? 'Processing...' : 'Proceed to Payment'}
                  </Button>
                ) : (
                  <div className="text-center text-sm text-gray-600">
                    Complete your payment to confirm the booking
                  </div>
                )}

                <div className="text-xs text-gray-500 text-center">
                  By completing this booking, you agree to enroll for the full course duration.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CourseCheckoutPage;
