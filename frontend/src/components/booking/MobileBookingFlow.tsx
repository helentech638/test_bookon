import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { 
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  UserIcon,
  CurrencyPoundIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PhoneIcon,
  EnvelopeIcon
} from '@heroicons/react/24/outline';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { authService } from '../../services/authService';
import { buildApiUrl } from '../../config/api';
import PaymentForm from '../payment/PaymentForm';

interface Activity {
  id: string;
  title: string;
  description: string;
  price: number;
  max_capacity: number;
  current_capacity: number;
  start_date: string;
  start_time: string;
  end_time: string;
  venue: {
    id: string;
    name: string;
    address: string;
    city: string;
  };
  proRataBooking?: boolean;
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

interface MobileBookingFlowProps {
  activity: Activity;
  onSuccess: (bookingId: string) => void;
  onCancel: () => void;
}

const MobileBookingFlow: React.FC<MobileBookingFlowProps> = ({ 
  activity, 
  onSuccess, 
  onCancel 
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState(activity.start_date);
  const [selectedTime, setSelectedTime] = useState(activity.start_time);
  const [showPayment, setShowPayment] = useState(false);
  const [bookingData, setBookingData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const totalSteps = 4;

  useEffect(() => {
    fetchChildren();
  }, []);

  const fetchChildren = async () => {
    try {
      const token = authService.getToken();
      
      if (!token) {
        setError('Authentication required');
        return;
      }

      const response = await fetch(buildApiUrl('/children'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setChildren(data.data || []);
      } else {
        setError('Failed to fetch children');
      }
    } catch (error) {
      setError('Error fetching children');
      console.error('Error fetching children:', error);
    }
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleChildSelect = (childId: string) => {
    setSelectedChild(childId);
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
  };

  const handleBookingSubmit = async () => {
    if (!selectedChild) {
      toast.error('Please select a child');
      return;
    }

    setLoading(true);
    try {
      const token = authService.getToken();
      
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const bookingPayload = {
        activityId: activity.id,
        childId: selectedChild,
        startDate: selectedDate,
        startTime: selectedTime,
        notes: ''
      };

      const response = await fetch(buildApiUrl('/bookings'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookingPayload),
      });

      if (response.ok) {
        const data = await response.json();
        setBookingData(data.data);
        setShowPayment(true);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error?.message || 'Failed to create booking');
      }
    } catch (error) {
      toast.error('Error creating booking');
      console.error('Error creating booking:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = (paymentIntentId: string) => {
    toast.success('Booking and payment completed successfully!');
    if (bookingData) {
      onSuccess(bookingData.id);
    }
  };

  const handlePaymentError = (error: string) => {
    toast.error(error);
  };

  const handlePaymentCancel = () => {
    setShowPayment(false);
    // Optionally cancel the booking if payment is cancelled
    toast('Payment cancelled. You can try again or contact support.', { icon: 'ℹ️' });
  };

  const getStepStatus = (step: number) => {
    if (step < currentStep) return 'completed';
    if (step === currentStep) return 'current';
    return 'pending';
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-between mb-6 px-4">
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
        <div key={step} className="flex items-center">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
            getStepStatus(step) === 'completed' 
              ? 'bg-green-500 text-white' 
              : getStepStatus(step) === 'current'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-600'
          }`}>
            {getStepStatus(step) === 'completed' ? (
              <CheckCircleIcon className="w-5 h-5" />
            ) : (
              step
            )}
          </div>
          {step < totalSteps && (
            <div className={`w-12 h-0.5 mx-2 ${
              getStepStatus(step + 1) === 'completed' ? 'bg-green-500' : 'bg-gray-200'
            }`} />
          )}
        </div>
      ))}
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Activity Details</h2>
              <p className="text-gray-600">Review the activity information</p>
            </div>

            <Card className="mx-4">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {activity.title}
                    </h3>
                    <p className="text-gray-600">{activity.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center">
                      <MapPinIcon className="h-5 w-5 text-gray-500 mr-2" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{activity.venue.name}</p>
                        <p className="text-xs text-gray-500">{activity.venue.city}</p>
                      </div>
                    </div>

                    <div className="flex items-center">
                      <CurrencyPoundIcon className="h-5 w-5 text-gray-500 mr-2" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">from £{activity.price}</p>
                        <p className="text-xs text-gray-500">per session</p>
                      </div>
                    </div>

                    <div className="flex items-center">
                      <CalendarIcon className="h-5 w-5 text-gray-500 mr-2" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {new Date(activity.start_date).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-gray-500">Date</p>
                      </div>
                    </div>

                    <div className="flex items-center">
                      <ClockIcon className="h-5 w-5 text-gray-500 mr-2" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {activity.start_time} - {activity.end_time}
                        </p>
                        <p className="text-xs text-gray-500">Time</p>
                      </div>
                    </div>

                    <div className="flex items-center">
                      <div>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          activity.proRataBooking 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {activity.proRataBooking ? 'Pro-rata Available' : 'Full Booking Only'}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">Booking Type</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <UserIcon className="h-5 w-5 text-blue-500 mr-2" />
                      <div>
                        <p className="text-sm font-medium text-blue-900">
                          {activity.current_capacity}/{activity.max_capacity} spots available
                        </p>
                        <p className="text-xs text-blue-700">Limited availability</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Child</h2>
              <p className="text-gray-600">Choose which child will attend</p>
            </div>

            {children.length === 0 ? (
              <div className="text-center py-8">
                <UserIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No children found</h3>
                <p className="text-gray-600 mb-4">Add a child to your profile first</p>
                <Button onClick={() => window.location.href = '/children'}>
                  Add Child
                </Button>
              </div>
            ) : (
              <div className="space-y-3 px-4">
                {children.map((child) => (
                  <Card 
                    key={child.id} 
                    className={`cursor-pointer transition-all ${
                      selectedChild === child.id 
                        ? 'ring-2 ring-blue-500 bg-blue-50' 
                        : 'hover:shadow-md'
                    }`}
                    onClick={() => handleChildSelect(child.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                            <UserIcon className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {child.firstName} {child.lastName}
                            </p>
                            <p className="text-sm text-gray-500">
                              {child.yearGroup || 'Age not specified'}
                            </p>
                          </div>
                        </div>
                        {selectedChild === child.id && (
                          <CheckCircleIcon className="w-6 h-6 text-blue-500" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Confirm Details</h2>
              <p className="text-gray-600">Review your booking information</p>
            </div>

            <Card className="mx-4">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="border-b pb-4">
                    <h3 className="font-semibold text-gray-900 mb-2">Activity</h3>
                    <p className="text-gray-600">{activity.title}</p>
                  </div>

                  <div className="border-b pb-4">
                    <h3 className="font-semibold text-gray-900 mb-2">Child</h3>
                    {children.find(c => c.id === selectedChild) && (
                      <p className="text-gray-600">
                        {children.find(c => c.id === selectedChild)?.firstName} {' '}
                        {children.find(c => c.id === selectedChild)?.lastName}
                      </p>
                    )}
                  </div>

                  <div className="border-b pb-4">
                    <h3 className="font-semibold text-gray-900 mb-2">Date & Time</h3>
                    <p className="text-gray-600">
                      {new Date(selectedDate).toLocaleDateString()} at {selectedTime}
                    </p>
                  </div>

                  <div className="border-b pb-4">
                    <h3 className="font-semibold text-gray-900 mb-2">Venue</h3>
                    <p className="text-gray-600">{activity.venue.name}</p>
                    <p className="text-sm text-gray-500">{activity.venue.address}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Total Cost</h3>
                    <p className="text-2xl font-bold text-gray-900">£{activity.price}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg mx-4 p-4">
              <div className="flex">
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mr-2" />
                <div>
                  <h4 className="text-sm font-medium text-yellow-800">Important</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Please arrive 10 minutes before the activity starts. Bring appropriate clothing and equipment.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment</h2>
              <p className="text-gray-600">Complete your booking with payment</p>
            </div>

            <div className="mx-4">
              {showPayment ? (
                <PaymentForm
                  amount={activity.price}
                  currency="gbp"
                  bookingId={bookingData?.id || ''}
                  venueId={activity.venue.id}
                  activityName={activity.title}
                  venueName={activity.venue.name}
                  onSuccess={handlePaymentSuccess}
                  onCancel={handlePaymentCancel}
                />
              ) : (
                <Card>
                  <CardContent className="p-6">
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircleIcon className="w-8 h-8 text-green-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          Ready to Book!
                        </h3>
                        <p className="text-gray-600 mb-4">
                          Your booking details have been confirmed. Proceed to payment to complete your reservation.
                        </p>
                        <div className="bg-gray-50 rounded-lg p-4 mb-4">
                          <p className="text-sm text-gray-600">
                            <strong>Total Amount:</strong> £{activity.price}
                          </p>
                        </div>
                      </div>
                      <Button 
                        onClick={handleBookingSubmit}
                        disabled={loading}
                        className="w-full"
                      >
                        {loading ? 'Creating Booking...' : 'Proceed to Payment'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={onCancel}>Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={currentStep === 1 ? onCancel : handlePrevious}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ChevronLeftIcon className="h-5 w-5 mr-1" />
            {currentStep === 1 ? 'Cancel' : 'Back'}
          </button>
          <div className="text-center">
            <h1 className="text-lg font-semibold text-gray-900">Book Activity</h1>
            <p className="text-sm text-gray-500">Step {currentStep} of {totalSteps}</p>
          </div>
          <div className="w-16"></div> {/* Spacer for centering */}
        </div>
        {renderStepIndicator()}
      </div>

      {/* Content */}
      <div className="pb-20">
        {renderStepContent()}
      </div>

      {/* Bottom Navigation */}
      {currentStep < totalSteps && !showPayment && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={handlePrevious}
              className="flex-1"
              disabled={currentStep === 1}
            >
              Previous
            </Button>
            <Button
              onClick={handleNext}
              className="flex-1"
              disabled={
                (currentStep === 2 && !selectedChild) ||
                (currentStep === 3 && !selectedChild)
              }
            >
              Next
              <ChevronRightIcon className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Floating Action Button for quick actions */}
      {currentStep === 1 && (
        <div className="fixed bottom-20 right-4">
          <div className="flex flex-col space-y-2">
            <button
              onClick={() => window.location.href = `tel:+441234567890`}
              className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shadow-lg hover:bg-green-600 transition-colors"
            >
              <PhoneIcon className="w-6 h-6 text-white" />
            </button>
            <button
              onClick={() => window.location.href = `mailto:support@bookon.com`}
              className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center shadow-lg hover:bg-blue-600 transition-colors"
            >
              <EnvelopeIcon className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileBookingFlow;
