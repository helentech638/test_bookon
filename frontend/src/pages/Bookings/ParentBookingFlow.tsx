import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
  CheckCircleIcon,
  UserIcon,
  CreditCardIcon,
  CalendarIcon,
  MapPinIcon,
  ClockIcon,
  UsersIcon,
  CurrencyPoundIcon
} from '@heroicons/react/24/outline';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Stepper } from '../../components/ui/Stepper';
import { CalendarIntegration } from '../../components/CalendarIntegration';
import PaymentForm from '../../components/payment/PaymentForm';
import { authService } from '../../services/authService';
import { buildApiUrl } from '../../config/api';
import { calendarService } from '../../services/calendarService';


interface Activity {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  price: number;
  currency: string;
  capacity: number;
  bookedCount: number;
  venue: {
    id: string;
    name: string;
    address: string;
  };
}

interface Child {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  yearGroup?: string;
  allergies?: string;
  medicalInfo?: string;
}

interface BookingSummary {
  activityId: string;
  childId: string;
  totalAmount: number;
  currency: string;
}


const ParentBookingFlow: React.FC = () => {
  const navigate = useNavigate();
  const { activityId } = useParams<{ activityId: string }>();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [bookingSummary, setBookingSummary] = useState<BookingSummary | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps = [
    { id: '1', title: 'Choose Activity', description: 'Review activity details', status: 'current' as const },
    { id: '2', title: 'Select Child', description: 'Choose your child', status: 'pending' as const },
    { id: '3', title: 'Payment', description: 'Complete payment', status: 'pending' as const },
  ];

  // Update step statuses based on current step
  const getStepStatus = (stepId: string) => {
    const stepIndex = parseInt(stepId);
    if (stepIndex < currentStep) return 'completed' as const;
    if (stepIndex === currentStep) return 'current' as const;
    return 'pending' as const;
  };

  const currentSteps = steps.map(step => ({
    ...step,
    status: getStepStatus(step.id)
  }));

  useEffect(() => {
    if (activityId) {
      fetchData();
    }
  }, [activityId]);

  const fetchData = async () => {
    const startTime = performance.now();
    setLoading(true);
    setError(null);

    try {
      const token = authService.getToken();
      if (!token) {
        toast.error('Authentication required');
        navigate('/login');
        return;
      }

      // Make both API calls in parallel for better performance
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for both calls

      const [activityResponse, childrenResponse] = await Promise.allSettled([
        fetch(buildApiUrl(`/activities/${activityId}`), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        }),
        fetch(buildApiUrl('/children'), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        })
      ]);

      clearTimeout(timeoutId);

      // Process activity response
      if (activityResponse.status === 'fulfilled' && activityResponse.value.ok) {
        const activityData = await activityResponse.value.json();
        console.log('Activity data received:', activityData.data);
        
        // Transform the activity data to match our interface
        const transformedActivity = {
          ...activityData.data,
          startDate: activityData.data.startDate ? 
            (typeof activityData.data.startDate === 'string' ? 
              activityData.data.startDate : 
              new Date(activityData.data.startDate).toISOString().split('T')[0]) :
            activityData.data.start_date,
          endDate: activityData.data.endDate ? 
            (typeof activityData.data.endDate === 'string' ? 
              activityData.data.endDate : 
              new Date(activityData.data.endDate).toISOString().split('T')[0]) :
            activityData.data.end_date,
          title: activityData.data.title || activityData.data.name,
          venue: {
            id: activityData.data.venue_id || activityData.data.venue?.id,
            name: activityData.data.venue_name || activityData.data.venue?.name || 'Unknown Venue',
            address: activityData.data.venue_address || activityData.data.venue?.address || ''
          }
        };
        
        console.log('Transformed activity:', transformedActivity);
        setActivity(transformedActivity);
      } else if (activityResponse.status === 'fulfilled' && activityResponse.value.status === 401) {
        toast.error('Session expired. Please login again.');
        authService.logout();
        navigate('/login');
        return;
      } else {
        toast.error('Failed to fetch activity details');
        navigate('/activities');
        return;
      }

      // Process children response
      if (childrenResponse.status === 'fulfilled' && childrenResponse.value.ok) {
        const childrenData = await childrenResponse.value.json();
        setChildren(childrenData.data || []);
      } else if (childrenResponse.status === 'fulfilled' && childrenResponse.value.status === 401) {
        toast.error('Session expired. Please login again.');
        authService.logout();
        navigate('/login');
        return;
      } else {
        toast.error('Failed to fetch children');
      }

      const endTime = performance.now();
      console.log(`Booking flow data loaded in ${(endTime - startTime).toFixed(2)}ms`);

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        toast.error('Request timed out. Please try again.');
      } else {
        toast.error('Error loading booking data');
      }
      navigate('/activities');
    } finally {
      setLoading(false);
    }
  };


  const handleChildSelect = (childId: string) => {
    setSelectedChild(childId);
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      // Step 1: Check if user has children before proceeding
      if (children.length === 0) {
        toast.error('Please add a child first before booking activities');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!selectedChild) {
        toast.error('Please select a child to continue');
        return;
      }
      setCurrentStep(3);
      setShowPayment(true);
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      if (currentStep === 3) {
        setShowPayment(false);
      }
    }
  };

  const handlePaymentSuccess = async (paymentIntentId: string) => {
    try {
      // Create the booking
      const token = authService.getToken();
      if (!token) {
        toast.error('Authentication required');
        navigate('/login');
        return;
      }

      const response = await fetch(buildApiUrl('/bookings'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          activityId: activity!.id,
          childId: selectedChild,
          status: 'confirmed',
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('Booking confirmed successfully!');
        
        // Navigate to payment success page
        navigate(`/payment-success/${data.data.id}`);
      } else if (response.status === 401) {
        toast.error('Session expired. Please login again.');
        authService.logout();
        navigate('/login');
      } else {
        toast.error('Failed to create booking');
      }
    } catch (error) {
      toast.error('Error creating booking');
    }
  };

  const handlePaymentCancel = () => {
    setShowPayment(false);
    setCurrentStep(2);
  };

  const handleAddToCalendar = () => {
    if (!activity) return;
    
    try {
      const calendarEvent = calendarService.createEventFromActivity(activity);
      calendarService.downloadICalFile(calendarEvent);
      toast.success('Activity added to calendar!');
    } catch (err) {
      console.error('Error creating calendar event:', err);
      toast.error('Failed to add to calendar');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header skeleton */}
        <div className="text-center mb-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mx-auto mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
          </div>
        </div>

        {/* Stepper skeleton */}
        <div className="mb-8">
          <div className="animate-pulse">
            <div className="flex justify-center space-x-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center">
                  <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                  <div className="ml-2">
                    <div className="h-4 bg-gray-200 rounded w-20 mb-1"></div>
                    <div className="h-3 bg-gray-200 rounded w-16"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="animate-pulse">
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="space-y-4">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="grid grid-cols-2 gap-4 mt-6">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-16 bg-gray-200 rounded"></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="lg:col-span-1">
            <div className="animate-pulse">
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-4 bg-gray-200 rounded"></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Activity not found</p>
        <Button onClick={() => navigate('/activities')} className="mt-4">
          Back to Activities
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Book Activity</h1>
        <p className="text-gray-600 mt-2">Complete your booking in just a few steps</p>
      </div>

      {/* Stepper */}
      <div className="mb-8">
        <Stepper steps={currentSteps} currentStep={currentStep} />
      </div>

      {/* Step Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Step Content */}
        <div className="lg:col-span-2">
          {currentStep === 1 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <CalendarIcon className="w-6 h-6 mr-2" />
                  Activity Details
                </CardTitle>
                  {activity && (
                    <CalendarIntegration
                      event={calendarService.createEventFromActivity(activity)}
                      buttonText="Add to Calendar"
                      showOptions={true}
                    />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">{activity.title}</h3>
                    <p className="text-gray-600 mt-2">{activity.description}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center">
                      <CalendarIcon className="w-5 h-5 text-gray-400 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Date</p>
                        <p className="text-sm text-gray-600">
                          {new Date(activity.startDate).toLocaleDateString('en-GB', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center">
                      <ClockIcon className="w-5 h-5 text-gray-400 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Time</p>
                        <p className="text-sm text-gray-600">
                          {activity.startTime} - {activity.endTime}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center">
                      <MapPinIcon className="w-5 h-5 text-gray-400 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Venue</p>
                        <p className="text-sm text-gray-600">{activity.venue.name}</p>
                        <p className="text-xs text-gray-500">{activity.venue.address}</p>
                      </div>
                    </div>

                    <div className="flex items-center">
                      <UsersIcon className="w-5 h-5 text-gray-400 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Availability</p>
                        <p className="text-sm text-gray-600">
                          {activity.capacity - (activity.bookedCount || 0)} of {activity.capacity} spots left
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-900">Price</p>
                        <p className="text-2xl font-bold text-blue-900">
                          {new Intl.NumberFormat('en-GB', {
                            style: 'currency',
                            currency: (activity.currency || 'GBP').toUpperCase(),
                          }).format(activity.price)}
                        </p>
                      </div>
                      <CheckCircleIcon className="w-8 h-8 text-blue-500" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <UserIcon className="w-6 h-6 mr-2" />
                  Select Child
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {children.length === 0 ? (
                    <div className="text-center py-8">
                      <UserIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No children added yet</h3>
                      <p className="text-gray-600 mb-4">Add your children to start booking activities for them.</p>
                      <Button onClick={() => navigate('/children')}>
                        Add Child
                      </Button>
                    </div>
                  ) : (
                    children.map((child) => (
                      <div
                        key={child.id}
                        className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                          selectedChild === child.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => handleChildSelect(child.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                              <UserIcon className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900">
                                {child.firstName} {child.lastName}
                              </h4>
                              <p className="text-sm text-gray-600">
                                {new Date().getFullYear() - new Date(child.dateOfBirth).getFullYear()} years old
                                {child.yearGroup && ` • ${child.yearGroup}`}
                              </p>
                            </div>
                          </div>
                          {selectedChild === child.id && (
                            <CheckCircleIcon className="w-6 h-6 text-blue-500" />
                          )}
                        </div>
                        
                        {(child.allergies || child.medicalInfo) && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            {child.allergies && (
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">Allergies:</span> {child.allergies}
                              </p>
                            )}
                            {child.medicalInfo && (
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">Medical Info:</span> {child.medicalInfo}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 3 && showPayment && (
            <PaymentForm
              amount={activity.price}
              currency={activity.currency || 'GBP'}
              bookingId={`temp-${Date.now()}`}
              venueId={activity.venue.id}
              activityId={activityId}
              childId={selectedChild}
              activityName={activity.title}
              venueName={activity.venue.name}
              startDate={activity.startDate}
              endDate={activity.endDate}
              startTime={activity.startTime}
              endTime={activity.endTime}
              childName={children.find(c => c.id === selectedChild)?.firstName + ' ' + children.find(c => c.id === selectedChild)?.lastName}
              onSuccess={handlePaymentSuccess}
              onCancel={handlePaymentCancel}
            />
          )}
        </div>

        {/* Right Column - Summary & Navigation */}
        <div className="lg:col-span-1">
          <div className="sticky top-8">
            <Card>
              <CardHeader>
                <CardTitle>Booking Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900">{activity.title}</h4>
                    <p className="text-sm text-gray-600">{activity.venue.name}</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Date & Time</span>
                    <div className="text-sm font-medium text-gray-900 text-right">
                      <div>
                      {new Date(activity.startDate).toLocaleDateString('en-GB', {
                          month: 'short',
                          day: 'numeric'
                        })} - {new Date(activity.endDate).toLocaleDateString('en-GB', {
                        month: 'short',
                        day: 'numeric'
                      })}
                      <br />
                      {activity.startTime}
                      </div>
                    </div>
                  </div>

                  {selectedChild && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Child</span>
                      <span className="text-sm font-medium text-gray-900">
                        {children.find(c => c.id === selectedChild)?.firstName} {children.find(c => c.id === selectedChild)?.lastName}
                      </span>
                    </div>
                  )}

                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-medium text-gray-900">Total</span>
                      <span className="text-2xl font-bold text-gray-900">
                        {new Intl.NumberFormat('en-GB', {
                          style: 'currency',
                          currency: (activity.currency || 'GBP').toUpperCase(),
                        }).format(activity.price)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 text-right mt-1">
                      Full program price
                    </div>
                  </div>

                  {/* Navigation Buttons */}
                  <div className="space-y-3 pt-4">
                    {currentStep > 1 && (
                      <Button
                        variant="outline"
                        onClick={handlePreviousStep}
                        className="w-full"
                      >
                        Previous Step
                      </Button>
                    )}

                    {currentStep === 1 && (
                      <Button
                        onClick={handleNextStep}
                        className="w-full"
                      >
                        Continue to Child Selection
                      </Button>
                    )}

                    {currentStep === 2 && selectedChild && (
                      <Button
                        onClick={handleNextStep}
                        className="w-full"
                      >
                        Continue to Payment
                      </Button>
                    )}

                    {currentStep === 2 && !selectedChild && (
                      <Button disabled className="w-full opacity-50">
                        Select a child to continue
                      </Button>
                    )}
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

export default ParentBookingFlow;
