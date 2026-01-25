import React, { useState, useEffect } from 'react';
import { 
  CalendarDaysIcon, 
  MapPinIcon, 
  ClockIcon, 
  UserGroupIcon, 
  CurrencyPoundIcon,
  PlusIcon,
  XMarkIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import AdminLayout from '../../components/layout/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { authService } from '../../services/authService';
import { buildApiUrl } from '../../config/api';

interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  capacity?: number;
}

interface ActivityFormData {
  title: string;
  type: string;
  venueId: string;
  description: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  capacity: number;
  price: number;
  earlyDropoff: boolean;
  earlyDropoffPrice: number;
  latePickup: boolean;
  latePickupPrice: number;
  generateSessions: boolean;
  excludeDates: string[];
}

const CreateActivityPage: React.FC = () => {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<ActivityFormData>({
    title: '',
    type: 'other',
    venueId: '',
    description: '',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    capacity: 20,
    price: 0,
    earlyDropoff: false,
    earlyDropoffPrice: 0,
    latePickup: false,
    latePickupPrice: 0,
    generateSessions: true,
    excludeDates: []
  });

  const [activityTypes, setActivityTypes] = useState<{ value: string; label: string }[]>([]);

  const steps = [
    { id: 1, name: 'Basic Details', description: 'Activity name, type, and venue' },
    { id: 2, name: 'Scheduling', description: 'Dates, times, and session generation' },
    { id: 3, name: 'Capacity & Pricing', description: 'Pricing and capacity settings' },
    { id: 4, name: 'Review & Create', description: 'Review details and create activity' }
  ];

  useEffect(() => {
    loadVenues();
    loadActivityTypes();
  }, []);

  const loadVenues = async () => {
    try {
      const token = authService.getToken();
      if (!token) throw new Error('No authentication token');

      const response = await fetch(buildApiUrl('/venues'), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setVenues(data.data || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load venues');
    }
  };

  const loadActivityTypes = async () => {
    try {
      const token = authService.getToken();
      if (!token) throw new Error('No authentication token');

      const response = await fetch(buildApiUrl('/activity-types'), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const types = data.data.map((type: any) => ({
            value: type.id,
            label: type.name
          }));
          setActivityTypes(types);
          
          // Set default type if none selected and types are available
          if (types.length > 0 && !formData.type) {
            setFormData(prev => ({ ...prev, type: types[0].value }));
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity types');
    }
  };

  const handleInputChange = (field: keyof ActivityFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear validation error for this field when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleDateExclusion = (date: string) => {
    setFormData(prev => ({
      ...prev,
      excludeDates: prev.excludeDates.includes(date)
        ? prev.excludeDates.filter(d => d !== date)
        : [...prev.excludeDates, date]
    }));
  };

  const generateSessionDates = () => {
    if (!formData.startDate || !formData.endDate) return [];
    
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const dates = [];
    
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 7)) {
      const dateString = date.toISOString().split('T')[0];
      if (!formData.excludeDates.includes(dateString)) {
        dates.push(dateString);
      }
    }
    
    return dates;
  };

  const validateStep = (step: number): boolean => {
    const errors: Record<string, string> = {};
    
    switch (step) {
      case 1:
        if (!formData.title.trim()) errors.title = 'Activity title is required';
        if (!formData.type) errors.type = 'Activity type is required';
        if (!formData.venueId) errors.venueId = 'Venue is required';
        break;
      case 2:
        if (!formData.startDate) errors.startDate = 'Start date is required';
        if (!formData.endDate) errors.endDate = 'End date is required';
        if (!formData.startTime) errors.startTime = 'Start time is required';
        if (!formData.endTime) errors.endTime = 'End time is required';
        
        if (formData.startDate && formData.endDate) {
          const start = new Date(formData.startDate);
          const end = new Date(formData.endDate);
          if (end <= start) {
            errors.endDate = 'End date must be after start date';
          }
        }
        
        if (formData.startTime && formData.endTime) {
          if (formData.endTime <= formData.startTime) {
            errors.endTime = 'End time must be after start time';
          }
        }
        break;
      case 3:
        if (formData.capacity <= 0) errors.capacity = 'Capacity must be greater than 0';
        if (formData.price < 0) errors.price = 'Price cannot be negative';
        
        if (formData.type === 'holiday') {
          if (formData.earlyDropoff && formData.earlyDropoffPrice < 0) {
            errors.earlyDropoffPrice = 'Early drop-off price cannot be negative';
          }
          if (formData.latePickup && formData.latePickupPrice < 0) {
            errors.latePickupPrice = 'Late pick-up price cannot be negative';
          }
        }
        break;
      case 4:
        // Review step - no validation needed
        break;
      default:
        return false;
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    console.log('handleNext called for step:', currentStep);
    console.log('Current form data:', formData);
    
    const isValid = validateStep(currentStep);
    console.log('Validation result:', isValid);
    console.log('Validation errors:', validationErrors);
    
    if (isValid) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length));
    } else {
      console.log('Validation failed, staying on step:', currentStep);
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;
    
    setLoading(true);
    setError(null);

    try {
      const token = authService.getToken();
      if (!token) throw new Error('No authentication token');

      // Prepare activity data
      const activityData = {
        title: formData.title,
        type: formData.type,
        venueId: formData.venueId,
        description: formData.description,
        startDate: formData.startDate,
        endDate: formData.endDate,
        startTime: formData.startTime,
        endTime: formData.endTime,
        capacity: formData.capacity,
        price: formData.price,
        earlyDropoff: formData.earlyDropoff,
        earlyDropoffPrice: formData.earlyDropoffPrice,
        latePickup: formData.latePickup,
        latePickupPrice: formData.latePickupPrice,
        generateSessions: formData.generateSessions,
        excludeDates: formData.excludeDates
      };

      const response = await fetch(buildApiUrl('/activities'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(activityData)
      });

      if (response.ok) {
        const result = await response.json();
        setSuccess(true);
        
        // Reset form after successful creation
        setTimeout(() => {
          setFormData({
            title: '',
            type: 'afterschool',
            venueId: '',
            description: '',
            startDate: '',
            endDate: '',
            startTime: '',
            endTime: '',
            capacity: 20,
            price: 0,
            earlyDropoff: false,
            earlyDropoffPrice: 0,
            latePickup: false,
            latePickupPrice: 0,
            generateSessions: true,
            excludeDates: []
          });
          setCurrentStep(1);
          setSuccess(false);
          setValidationErrors({});
        }, 3000);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create activity');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create activity');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  if (success) {
    return (
      <AdminLayout title="Activity Created">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <CheckIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Activity Created Successfully!</h2>
            <p className="text-gray-600 mb-6">Your activity has been created and is ready for bookings.</p>
            <div className="flex space-x-4 justify-center">
              <button
                onClick={() => setSuccess(false)}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
              >
                Create Another Activity
              </button>
              <button
                onClick={() => window.location.href = '/admin/activities'}
                className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700"
              >
                View All Activities
              </button>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Create New Activity">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Create New Activity</h1>
          <p className="text-sm sm:text-base text-gray-600">Set up a new activity for bookings</p>
        </div>

      {/* Progress Steps */}
      <div className="mb-6 sm:mb-8">
        <div className="hidden sm:flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                currentStep >= step.id
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-gray-300 text-gray-500'
              }`}>
                {currentStep > step.id ? (
                  <CheckIcon className="w-5 h-5" />
                ) : (
                  <span className="text-sm font-medium">{step.id}</span>
                )}
              </div>
              <div className="ml-3">
                <p className={`text-sm font-medium ${
                  currentStep >= step.id ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  {step.name}
                </p>
                <p className="text-xs text-gray-500">{step.description}</p>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-16 h-0.5 mx-4 ${
                  currentStep > step.id ? 'bg-blue-600' : 'bg-gray-300'
                }`} />
              )}
            </div>
          ))}
        </div>
        
        {/* Mobile Progress Steps */}
        <div className="sm:hidden">
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex flex-col items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                  currentStep >= step.id
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-gray-300 text-gray-500'
                }`}>
                  {currentStep > step.id ? (
                    <CheckIcon className="w-5 h-5" />
                  ) : (
                    <span className="text-sm font-medium">{step.id}</span>
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-8 h-0.5 mt-4 ${
                    currentStep > step.id ? 'bg-blue-600' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="text-center">
            <p className={`text-sm font-medium ${
              currentStep >= steps[currentStep - 1]?.id ? 'text-blue-600' : 'text-gray-500'
            }`}>
              {steps[currentStep - 1]?.name}
            </p>
            <p className="text-xs text-gray-500">{steps[currentStep - 1]?.description}</p>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 sm:p-6">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex">
                <XMarkIcon className="w-5 h-5 text-red-400" />
                <div className="ml-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Basic Details */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">Basic Details</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Activity Name *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    validationErrors.title ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="e.g., Year 1 & 2 Football Club"
                />
                {validationErrors.title && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.title}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Activity Type *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => handleInputChange('type', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {activityTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Venue *
                </label>
                <select
                  value={formData.venueId}
                  onChange={(e) => handleInputChange('venueId', e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    validationErrors.venueId ? 'border-red-300' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select a venue</option>
                  {venues.map((venue) => (
                    <option key={venue.id} value={venue.id}>
                      {venue.name} - {venue.city}
                    </option>
                  ))}
                </select>
                {validationErrors.venueId && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.venueId}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe the activity for parents..."
                />
              </div>
            </div>
          )}

          {/* Step 2: Scheduling */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">Scheduling</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => handleInputChange('startDate', e.target.value)}
                    className={`w-full border rounded-lg px-3 py-3 sm:py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      validationErrors.startDate ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {validationErrors.startDate && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.startDate}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date *
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => handleInputChange('endDate', e.target.value)}
                    className={`w-full border rounded-lg px-3 py-3 sm:py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      validationErrors.endDate ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {validationErrors.endDate && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.endDate}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => handleInputChange('startTime', e.target.value)}
                    className={`w-full border rounded-lg px-3 py-3 sm:py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      validationErrors.startTime ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {validationErrors.startTime && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.startTime}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Time *
                  </label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => handleInputChange('endTime', e.target.value)}
                    className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      validationErrors.endTime ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {validationErrors.endTime && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.endTime}</p>
                  )}
                </div>
              </div>

              {formData.type === 'afterschool' && (
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.generateSessions}
                      onChange={(e) => handleInputChange('generateSessions', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Auto-generate weekly sessions
                    </span>
                  </label>
                </div>
              )}

              {formData.generateSessions && formData.startDate && formData.endDate && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Exclude Dates
                  </label>
                  <div className="space-y-2">
                    {generateSessionDates().map((date) => (
                      <label key={date} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.excludeDates.includes(date)}
                          onChange={() => handleDateExclusion(date)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">
                          {new Date(date).toLocaleDateString('en-GB', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Capacity & Pricing */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">Capacity & Pricing</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Capacity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.capacity}
                    onChange={(e) => handleInputChange('capacity', parseInt(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-3 sm:py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price per Session
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <CurrencyPoundIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => handleInputChange('price', parseFloat(e.target.value))}
                      className="w-full pl-10 border border-gray-300 rounded-lg px-3 py-3 sm:py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {formData.type === 'holiday' && (
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-900">Holiday Club Options</h4>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Early Drop-off</label>
                        <p className="text-sm text-gray-500">Allow parents to drop off early</p>
                      </div>
                      <div className="flex items-center space-x-4">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.earlyDropoffPrice}
                          onChange={(e) => handleInputChange('earlyDropoffPrice', parseFloat(e.target.value))}
                          className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                          disabled={!formData.earlyDropoff}
                        />
                        <input
                          type="checkbox"
                          checked={formData.earlyDropoff}
                          onChange={(e) => handleInputChange('earlyDropoff', e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Late Pick-up</label>
                        <p className="text-sm text-gray-500">Allow parents to pick up late</p>
                      </div>
                      <div className="flex items-center space-x-4">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.latePickupPrice}
                          onChange={(e) => handleInputChange('latePickupPrice', parseFloat(e.target.value))}
                          className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                          disabled={!formData.latePickup}
                        />
                        <input
                          type="checkbox"
                          checked={formData.latePickup}
                          onChange={(e) => handleInputChange('latePickup', e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Review & Create */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">Review & Create</h3>
              
              <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-gray-900">Activity Details</h4>
                    <p className="text-sm text-gray-600">{formData.title}</p>
                    <p className="text-sm text-gray-600">{activityTypes.find(t => t.value === formData.type)?.label || 'Unknown type'}</p>
                    <p className="text-sm text-gray-600">{venues.find(v => v.id === formData.venueId)?.name || 'No venue selected'}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900">Schedule</h4>
                    <p className="text-sm text-gray-600">
                      {formData.startDate} to {formData.endDate}
                    </p>
                    <p className="text-sm text-gray-600">
                      {formData.startTime} - {formData.endTime}
                    </p>
                    {formData.generateSessions && (
                      <p className="text-sm text-gray-600">
                        {generateSessionDates().length} sessions generated
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900">Capacity & Pricing</h4>
                    <p className="text-sm text-gray-600">Capacity: {formData.capacity}</p>
                    <p className="text-sm text-gray-600">Price: {formatCurrency(formData.price)} per session</p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900">Special Options</h4>
                    {formData.earlyDropoff && (
                      <p className="text-sm text-gray-600">
                        Early drop-off: {formatCurrency(formData.earlyDropoffPrice)}
                      </p>
                    )}
                    {formData.latePickup && (
                      <p className="text-sm text-gray-600">
                        Late pick-up: {formatCurrency(formData.latePickupPrice)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex flex-col sm:flex-row justify-between gap-4 mt-8">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 1}
              className="w-full sm:w-auto px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            {currentStep < steps.length ? (
              <button
                onClick={handleNext}
                className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full sm:w-auto px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <PlusIcon className="w-4 h-4" />
                    <span>Create Activity</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
    </AdminLayout>
  );
};

export default CreateActivityPage;
