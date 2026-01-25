import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Stepper, Step } from '../ui/Stepper';
import { Calendar, Clock, MapPin, Users, CreditCard, AlertCircle, CheckCircle } from 'lucide-react';
import { Activity, Venue, Child, BookingFormData } from '../../types/booking';
import toast from 'react-hot-toast';


interface BookingWidgetProps {
  venueId?: string;
  activityId?: string;
  onBookingComplete?: (bookingId: string) => void;
  className?: string;
  embeddable?: boolean;
}

const BookingWidget: React.FC<BookingWidgetProps> = ({
  venueId,
  activityId,
  onBookingComplete,
  className,
  embeddable = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const steps: Step[] = [
    {
      id: 'select-activity',
      title: 'Select Activity',
      description: 'Choose an activity for your child',
      status: 'pending',
    },
    {
      id: 'select-details',
      title: 'Select Details',
      description: 'Pick date, time, and child',
      status: 'pending',
    },
    {
      id: 'payment',
      title: 'Payment',
      description: 'Complete your booking',
      status: 'pending',
    },
  ];

  // Update step statuses based on current step
  const updatedSteps: Step[] = steps.map((step, index) => ({
    ...step,
    status: 
      index < currentStep ? 'completed' :
      index === currentStep ? 'current' : 'pending'
  }));

  useEffect(() => {
    if (isOpen) {
      fetchInitialData();
    }
  }, [isOpen]);

  const fetchInitialData = async () => {
    try {
      // Fetch activities
      if (venueId) {
        const activitiesResponse = await fetch(`/api/v1/venues/${venueId}/activities`);
        if (activitiesResponse.ok) {
          const activitiesData = await activitiesResponse.json();
          setActivities(activitiesData.data || []);
        }
      }

      // Fetch user's children
      const token = localStorage.getItem('token');
      if (token) {
        const childrenResponse = await fetch('/api/v1/children', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (childrenResponse.ok) {
          const childrenData = await childrenResponse.json();
          setChildren(childrenData.data || []);
        }
      }

      // Generate available dates (next 30 days)
      const dates = [];
      const today = new Date();
      for (let i = 1; i <= 30; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        dates.push(date.toISOString().split('T')[0]);
      }
      setAvailableDates(dates);

      // Generate available times
      setAvailableTimes(['09:00', '10:00', '11:00', '14:00', '15:00', '16:00']);
    } catch (error) {
      console.error('Error fetching initial data:', error);
      toast.error('Failed to load available options');
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 0:
        if (!selectedActivity) {
          newErrors.activity = 'Please select an activity';
        }
        break;
      case 1:
        if (!selectedDate) {
          newErrors.date = 'Please select a date';
        }
        if (!selectedTime) {
          newErrors.time = 'Please select a time';
        }
        if (!selectedChild) {
          newErrors.child = 'Please select a child';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleStepClick = (stepIndex: number) => {
    if (stepIndex <= currentStep) {
      setCurrentStep(stepIndex);
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < steps.length - 1) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    if (!validateStep(currentStep)) return;

    setIsLoading(true);
    try {
      const bookingData: BookingFormData = {
        activity_id: selectedActivity!.id,
        child_id: selectedChild,
        date: selectedDate,
        time: selectedTime,
      };

      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch('/api/v1/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(bookingData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Booking failed');
      }

      const result = await response.json();
      const bookingId = result.data.booking.id;
      
      toast.success('Booking completed successfully!');
      onBookingComplete?.(bookingId);
      setIsOpen(false);
      setCurrentStep(0);
      resetForm();
    } catch (error) {
      console.error('Booking failed:', error);
      toast.error(error instanceof Error ? error.message : 'Booking failed');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedActivity(null);
    setSelectedDate('');
    setSelectedTime('');
    setSelectedChild('');
    setErrors({});
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return <ActivitySelectionStep 
          selectedActivity={selectedActivity}
          onActivitySelect={setSelectedActivity}
          activities={activities}
          venueId={venueId}
          activityId={activityId}
          error={errors.activity}
        />;
      case 1:
        return <DetailsSelectionStep
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          selectedTime={selectedTime}
          onTimeSelect={setSelectedTime}
          selectedChild={selectedChild}
          onChildSelect={setSelectedChild}
          activity={selectedActivity}
          availableDates={availableDates}
          availableTimes={availableTimes}
          children={children}
          errors={errors}
        />;
      case 2:
        return <PaymentStep
          activity={selectedActivity}
          date={selectedDate}
          time={selectedTime}
          child={children.find(c => c.id === selectedChild)}
        />;
      default:
        return null;
    }
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className={className}
        leftIcon={<Calendar className="h-4 w-4" />}
      >
        {embeddable ? 'Book Now' : 'Book Activity'}
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Book Your Activity"
        size="xl"
        closeOnOverlayClick={false}
      >
        <div className="space-y-6">
          {/* Stepper */}
          <Stepper
            steps={updatedSteps}
            currentStep={currentStep}
            onStepClick={handleStepClick}
            className="mb-8"
          />

          {/* Step Content */}
          <div className="min-h-[400px]">
            {renderStepContent()}
          </div>

          {/* Navigation */}
          <div className="flex justify-between pt-6 border-t">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
            >
              Previous
            </Button>

            <div className="flex gap-2">
              {currentStep < steps.length - 1 ? (
                <Button onClick={handleNext}>
                  Next
                </Button>
              ) : (
                <Button
                  onClick={handleComplete}
                  loading={isLoading}
                  leftIcon={<CreditCard className="h-4 w-4" />}
                >
                  Complete Booking
                </Button>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
};

// Step Components
const ActivitySelectionStep: React.FC<{
  selectedActivity: Activity | null;
  onActivitySelect: (activity: Activity) => void;
  activities: Activity[];
  venueId?: string;
  activityId?: string;
  error?: string;
}> = ({ selectedActivity, onActivitySelect, activities, venueId, activityId, error }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Choose an Activity</h3>
      
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {activities.length === 0 ? (
        <div className="text-center py-8">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No activities available at this venue.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {activities.map((activity) => (
            <Card
              key={activity.id}
              className={`cursor-pointer transition-all ${
                selectedActivity?.id === activity.id
                  ? 'ring-2 ring-blue-500 bg-blue-50'
                  : 'hover:shadow-md'
              }`}
              onClick={() => onActivitySelect(activity)}
            >
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{activity.name}</h4>
                    <p className="text-sm text-gray-600 mt-1">{activity.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {activity.duration} min
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {activity.current_capacity}/{activity.max_capacity}
                      </span>
                      {activity.category && (
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {activity.category}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-lg font-bold text-green-600">
                      £{Number(activity.price).toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {activity.current_capacity < activity.max_capacity ? 'Available' : 'Full'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

const DetailsSelectionStep: React.FC<{
  selectedDate: string;
  onDateSelect: (date: string) => void;
  selectedTime: string;
  onTimeSelect: (time: string) => void;
  selectedChild: string;
  onChildSelect: (child: string) => void;
  activity: Activity | null;
  availableDates: string[];
  availableTimes: string[];
  children: Child[];
  errors: Record<string, string>;
}> = ({ selectedDate, onDateSelect, selectedTime, onTimeSelect, selectedChild, onChildSelect, activity, availableDates, availableTimes, children, errors }) => {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Select Details</h3>
      
      {/* Date Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Date *
        </label>
        <div className="grid grid-cols-5 gap-2">
          {availableDates.map((date) => (
            <button
              key={date}
              onClick={() => onDateSelect(date)}
              className={`p-3 text-sm rounded-lg border transition-all ${
                selectedDate === date
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {new Date(date).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
              })}
            </button>
          ))}
        </div>
        {errors.date && (
          <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            {errors.date}
          </p>
        )}
      </div>

      {/* Time Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Time *
        </label>
        <div className="grid grid-cols-5 gap-2">
          {availableTimes.map((time) => (
            <button
              key={time}
              onClick={() => onTimeSelect(time)}
              className={`p-3 text-sm rounded-lg border transition-all ${
                selectedTime === time
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {time}
            </button>
          ))}
        </div>
        {errors.time && (
          <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            {errors.time}
          </p>
        )}
      </div>

      {/* Child Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Child *
        </label>
        {children.length === 0 ? (
          <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 text-center">
            <p className="text-gray-500">No children found in your profile.</p>
            <p className="text-sm text-gray-400 mt-1">Please add children to your profile first.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {children.map((child) => (
              <button
                key={child.id}
                onClick={() => onChildSelect(child.id)}
                className={`w-full p-3 text-left rounded-lg border transition-all ${
                  selectedChild === child.id
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium">{child.first_name} {child.last_name}</div>
                <div className="text-sm text-gray-500">
                  Age: {new Date().getFullYear() - new Date(child.date_of_birth).getFullYear()}
                </div>
              </button>
            ))}
          </div>
        )}
        {errors.child && (
          <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            {errors.child}
          </p>
        )}
      </div>
    </div>
  );
};

const PaymentStep: React.FC<{
  activity: Activity | null;
  date: string;
  time: string;
  child: Child | undefined;
}> = ({ activity, date, time, child }) => {
  if (!activity || !child) return <div>Missing information</div>;

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Review & Payment</h3>
      
      {/* Booking Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Booking Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Activity:</span>
              <span className="font-medium">{activity.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Child:</span>
              <span className="font-medium">{child.first_name} {child.last_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Date:</span>
              <span className="font-medium">
                {new Date(date).toLocaleDateString('en-GB')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Time:</span>
              <span className="font-medium">{time}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Duration:</span>
              <span className="font-medium">{activity.duration} minutes</span>
            </div>
            <div className="border-t pt-3">
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span className="text-green-600">£{Number(activity.price).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Form Placeholder */}
      <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span className="font-medium text-gray-900">Payment Information</span>
        </div>
        <p className="text-sm text-gray-600">
          Your payment will be processed securely through Stripe Connect. 
          You'll be redirected to complete the payment after confirming this booking.
        </p>
      </div>
    </div>
  );
};

export { BookingWidget };
