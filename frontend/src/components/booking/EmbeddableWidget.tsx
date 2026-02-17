import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import {
  CalendarIcon,
  MapPinIcon,
  ClockIcon,
  UsersIcon,
  CurrencyPoundIcon,
  ChevronRightIcon,
  XMarkIcon,
  EyeIcon,
  HeartIcon
} from '@heroicons/react/24/outline';
import { Button } from '../ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import PaymentForm from '../payment/PaymentForm';

interface WidgetConfig {
  venueId?: string;
  activityId?: string;
  theme?: 'light' | 'dark';
  primaryColor?: string;
  logo?: string;
  venueName?: string;
  showVenueInfo?: boolean;
  maxHeight?: string;
  width?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  showLogo?: boolean;
  customCSS?: string;
}

interface Activity {
  id: string;
  title: string;
  description: string;
  startDate: string;
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

interface EmbeddableWidgetProps {
  config: WidgetConfig;
  onClose?: () => void;
  isEmbedded?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
}

const EmbeddableWidget: React.FC<EmbeddableWidgetProps> = ({
  config,
  onClose,
  isEmbedded = false,
  onSuccess,
  onError,
  onCancel
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [showPayment, setShowPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [widgetStats, setWidgetStats] = useState({
    views: 0,
    interactions: 0,
    conversions: 0
  });

  const widgetRef = useRef<HTMLDivElement>(null);

  const steps = [
    { id: '1', title: 'Activity', description: 'Review details', status: 'current' as const },
    { id: '2', title: 'Child', description: 'Select child', status: 'pending' as const },
    { id: '3', title: 'Payment', description: 'Complete booking', status: 'pending' as const },
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

  // Track widget analytics
  const trackWidgetEvent = (eventType: string, data?: any) => {
    try {
      // Send analytics to backend
      fetch('/api/v1/widget/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventType,
          widgetId: config.venueId || 'default',
          venueId: config.venueId,
          activityId: config.activityId,
          timestamp: new Date().toISOString(),
          data
        })
      });
    } catch (error) {
      console.error('Failed to track widget event:', error);
    }
  };

  useEffect(() => {
    // Track widget view
    trackWidgetEvent('WIDGET_VIEW');
    setWidgetStats(prev => ({ ...prev, views: prev.views + 1 }));

    if (config.activityId) {
      fetchActivity();
      fetchChildren();
    }
  }, [config.activityId]);

  // Track widget interactions
  useEffect(() => {
    if (currentStep > 1) {
      trackWidgetEvent('WIDGET_INTERACTION', { step: currentStep });
      setWidgetStats(prev => ({ ...prev, interactions: prev.interactions + 1 }));
    }
  }, [currentStep]);

  const fetchActivity = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/widget/activity/${config.activityId}`);
      if (response.ok) {
        const data = await response.json();
        setActivity(data.data);
      } else {
        setError('Failed to fetch activity details');
      }
    } catch (error) {
      setError('Failed to fetch activity details');
    } finally {
      setLoading(false);
    }
  };

  const fetchChildren = async () => {
    try {
      const response = await fetch('/api/v1/children', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setChildren(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch children:', error);
    }
  };

  const handleChildSelect = (childId: string) => {
    setSelectedChild(childId);
    trackWidgetEvent('CHILD_SELECTED', { childId });
  };

  const handlePaymentSuccess = (paymentData: any) => {
    trackWidgetEvent('BOOKING_SUCCESS', paymentData);
    setWidgetStats(prev => ({ ...prev, conversions: prev.conversions + 1 }));

    if (onSuccess) {
      onSuccess(paymentData);
    } else {
      toast.success('Booking successful!');
    }
  };

  const handlePaymentError = (errorMessage: string) => {
    trackWidgetEvent('BOOKING_ERROR', { error: errorMessage });

    if (onError) {
      onError(errorMessage);
    } else {
      toast.error(errorMessage);
    }
  };

  const handlePaymentCancel = () => {
    trackWidgetEvent('BOOKING_CANCELLED');

    if (onCancel) {
      onCancel();
    }
  };

  const handleClose = () => {
    trackWidgetEvent('WIDGET_CLOSED');
    if (onClose) {
      onClose();
    }
  };

  // Apply custom CSS if provided
  const customStyles = config.customCSS ? { style: { ...JSON.parse(config.customCSS) } } : {};

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <div className="text-red-600 mb-4">{error}</div>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  return (
    <div
      ref={widgetRef}
      className={`widget-container ${config.theme === 'dark' ? 'dark-theme' : 'light-theme'}`}
      style={{
        '--primary-color': config.primaryColor || '#00806a',
        '--widget-width': config.width || '400px',
        '--widget-max-height': config.maxHeight || '600px'
      } as React.CSSProperties}
      {...customStyles}
    >
      {/* Widget Header */}
      <div className="widget-header">
        {config.showLogo && (
          <div className="widget-logo">
            <img src={config.logo || 'https://res.cloudinary.com/dfxypnsvt/image/upload/f_auto,q_auto,w_200/v1757098381/bookonlogo_aq6lq3.png'} alt="Logo" className="h-8 w-auto" />
          </div>
        )}
        <div className="widget-title">
          <h3 className="text-lg font-semibold">Book Activity</h3>
          <p className="text-sm text-gray-600">Quick and easy booking</p>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="widget-close-btn"
          >
            <XMarkIcon className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Widget Content */}
      <div className="widget-content">
        {currentStep === 1 && activity && (
          <div className="activity-details">
            <h4 className="text-xl font-semibold mb-4">{activity.title}</h4>
            <p className="text-gray-600 mb-4">{activity.description}</p>

            <div className="activity-info-grid">
              <div className="info-item">
                <CalendarIcon className="h-5 w-5 text-green-600" />
                <span>{new Date(activity.startDate).toLocaleDateString()}</span>
              </div>
              <div className="info-item">
                <ClockIcon className="h-5 w-5 text-green-600" />
                <span>{activity.startTime} - {activity.endTime}</span>
              </div>
              <div className="info-item">
                <MapPinIcon className="h-5 w-5 text-green-600" />
                <span>{activity.venue.name}</span>
              </div>
              <div className="info-item">
                <CurrencyPoundIcon className="h-5 w-5 text-green-600" />
                <span>£{activity.price}</span>
              </div>
              <div className="info-item">
                <UsersIcon className="h-5 w-5 text-green-600" />
                <span>{activity.bookedCount}/{activity.capacity} booked</span>
              </div>
            </div>

            <Button
              onClick={() => setCurrentStep(2)}
              className="w-full mt-6"
              disabled={activity.bookedCount >= activity.capacity}
            >
              {activity.bookedCount >= activity.capacity ? 'Fully Booked' : 'Continue to Child Selection'}
            </Button>
          </div>
        )}

        {currentStep === 2 && (
          <div className="child-selection">
            <h4 className="text-xl font-semibold mb-4">Select Child</h4>
            {children.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600 mb-4">No children found</p>
                <Button onClick={() => window.open('/children', '_blank')}>
                  Add Child
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {children.map((child) => (
                  <div
                    key={child.id}
                    className={`child-option p-3 border rounded-lg cursor-pointer transition-colors ${selectedChild === child.id
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                      }`}
                    onClick={() => handleChildSelect(child.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{child.firstName} {child.lastName}</p>
                        <p className="text-sm text-gray-600">
                          Age: {Math.floor((Date.now() - new Date(child.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))}
                        </p>
                      </div>
                      {selectedChild === child.id && (
                        <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex space-x-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(1)}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={() => setCurrentStep(3)}
                disabled={!selectedChild}
                className="flex-1"
              >
                Continue to Payment
              </Button>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="payment-section">
            <h4 className="text-xl font-semibold mb-4">Complete Payment</h4>
            <PaymentForm
              amount={activity?.price || 0}
              currency="GBP"
              bookingId={`temp-${Date.now()}`}
              venueId={activity?.venue.id}
              activityName={activity?.title}
              venueName={activity?.venue.name}
              onSuccess={handlePaymentSuccess}
              onCancel={handlePaymentCancel}
            />

            <Button
              variant="outline"
              onClick={() => setCurrentStep(2)}
              className="w-full mt-4"
            >
              Back to Child Selection
            </Button>
          </div>
        )}
      </div>

      {/* Widget Footer */}
      <div className="widget-footer">
        <div className="widget-stats">
          <span className="stat-item">
            <EyeIcon className="h-4 w-4" />
            {widgetStats.views}
          </span>
          <span className="stat-item">
            <HeartIcon className="h-4 w-4" />
            {widgetStats.interactions}
          </span>
        </div>
        <p className="text-xs text-gray-500">Powered by BookOn</p>
      </div>

      {/* Custom CSS for widget positioning and styling */}
      <style>{`
        .widget-container {
          width: var(--widget-width);
          max-height: var(--widget-max-height);
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .widget-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem;
          background: var(--primary-color);
          color: white;
        }

        .widget-content {
          padding: 1.5rem;
          max-height: calc(var(--widget-max-height) - 120px);
          overflow-y: auto;
        }

        .widget-footer {
          padding: 1rem;
          border-top: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #f9fafb;
        }

        .activity-info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin: 1rem 0;
        }

        .info-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
        }

        .child-option {
          transition: all 0.2s ease;
        }

        .widget-stats {
          display: flex;
          gap: 1rem;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.75rem;
          color: #6b7280;
        }

        .dark-theme {
          background: #1f2937;
          color: white;
        }

        .dark-theme .widget-content {
          background: #1f2937;
        }

        .dark-theme .widget-footer {
          background: #111827;
          border-top-color: #374151;
        }

        @media (max-width: 640px) {
          .widget-container {
            width: 100%;
            max-width: 100vw;
            border-radius: 0;
          }
          
          .activity-info-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default EmbeddableWidget;
