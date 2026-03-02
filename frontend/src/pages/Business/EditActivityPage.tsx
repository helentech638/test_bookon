import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  ClockIcon,
  MapPinIcon,
  UserGroupIcon,
  CurrencyPoundIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import BusinessLayout from '../../components/layout/BusinessLayout';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/authService';
import { buildApiUrl } from '../../config/api';
import { toast } from 'react-hot-toast';

interface ActivityFormData {
  title: string;
  description: string;
  type: string;
  venueId: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  price: number;
  capacity: number;
  images: File[];
  imageUrls: string[];
  earlyDropoff: boolean;
  earlyDropoffPrice: number;
  earlyDropoffStartTime: string;
  earlyDropoffEndTime: string;
  latePickup: boolean;
  latePickupPrice: number;
  latePickupStartTime: string;
  latePickupEndTime: string;
  generateSessions: boolean;
  excludeDates: string[];
  // New fields for client requirements
  daysOfWeek: string[];
  proRataBooking: boolean;
  holidaySessions: boolean;
  // Wraparound Care specific fields
  isWraparoundCare: boolean;
  yearGroups: string[];
  sessionBlocks: SessionBlock[];
  // Holiday Club specific fields
  ageRange: string;
  whatToBring: string;
  siblingDiscount: number;
  bulkDiscount: number;
  weeklyDiscount: number;
  // Course/Program specific fields
  durationWeeks: number;
  customTimeSlots: CustomTimeSlot[];
  courseExcludeDates: string[];
}

interface CustomTimeSlot {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  price: number;
  capacity: number;
}

interface SessionBlock {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  capacity: number;
  price: number;
}

interface Venue {
  id: string;
  name: string;
}

const EditActivityPage: React.FC = () => {
  const { activityId } = useParams<{ activityId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [formData, setFormData] = useState<ActivityFormData>({
    title: '',
    description: '',
    type: '',
    venueId: '',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    price: 0,
    capacity: 0,
    images: [],
    imageUrls: [],
    earlyDropoff: false,
    earlyDropoffPrice: 0,
    earlyDropoffStartTime: '07:30',
    earlyDropoffEndTime: '09:00',
    latePickup: false,
    latePickupPrice: 0,
    latePickupStartTime: '15:00',
    latePickupEndTime: '17:30',
    generateSessions: true,
    excludeDates: [],
    daysOfWeek: [],
    proRataBooking: false,
    holidaySessions: true,
    ageRange: '',
    whatToBring: '',
    siblingDiscount: 0,
    bulkDiscount: 0,
    weeklyDiscount: 0,
    customTimeSlots: [],
    isWraparoundCare: false,
    yearGroups: [],
    sessionBlocks: [],
    durationWeeks: 1,
    courseExcludeDates: []
  });

  const activityTypes = [
    'Activity',
    'Holiday Club',
    'Wraparound Care',
    'Course/Program'
  ];

  const yearGroupOptions = [
    'Reception',
    'Year 1',
    'Year 2',
    'Year 3',
    'Year 4',
    'Year 5',
    'Year 6',
    'Year 7',
    'Year 8',
    'Year 9',
    'Year 10',
    'Year 11'
  ];

  const daysOfWeek = [
    { value: 'monday', label: 'Monday' },
    { value: 'tuesday', label: 'Tuesday' },
    { value: 'wednesday', label: 'Wednesday' },
    { value: 'thursday', label: 'Thursday' },
    { value: 'friday', label: 'Friday' },
    { value: 'saturday', label: 'Saturday' },
    { value: 'sunday', label: 'Sunday' }
  ];

  useEffect(() => {
    if (activityId) {
      fetchActivity();
      fetchVenues();
    }
  }, [activityId]);

  const fetchActivity = async () => {
    try {
      setLoading(true);
      const token = authService.getToken();

      if (!token) {
        toast.error('Please log in to edit activity');
        navigate('/login');
        return;
      }

      const response = await fetch(buildApiUrl(`/business/activities/${activityId}`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch activity');
      }

      const data = await response.json();

      if (data.success) {
        const activity = data.data;
        setFormData({
          title: activity.title || '',
          description: activity.description || '',
          type: activity.type || '',
          venueId: activity.venue?.id || '',
          startDate: activity.startDate ? new Date(activity.startDate).toISOString().split('T')[0] : '',
          endDate: activity.endDate ? new Date(activity.endDate).toISOString().split('T')[0] : '',
          startTime: activity.startTime || '',
          endTime: activity.endTime || '',
          price: activity.price || 0,
          capacity: activity.capacity || 0,
          images: [], // Images are handled separately
          imageUrls: activity.imageUrls || [],
          earlyDropoff: activity.earlyDropoff || false,
          earlyDropoffPrice: activity.earlyDropoffPrice || 0,
          earlyDropoffStartTime: activity.earlyDropoffStartTime || '07:30',
          earlyDropoffEndTime: activity.earlyDropoffEndTime || '09:00',
          latePickup: activity.latePickup || false,
          latePickupPrice: activity.latePickupPrice || 0,
          latePickupStartTime: activity.latePickupStartTime || '15:00',
          latePickupEndTime: activity.latePickupEndTime || '17:30',
          generateSessions: activity.generateSessions !== false,
          excludeDates: activity.excludeDates || [],
          daysOfWeek: activity.daysOfWeek || [],
          proRataBooking: activity.proRataBooking || false,
          holidaySessions: activity.holidaySessions !== false,
          ageRange: activity.ageRange || '',
          whatToBring: activity.whatToBring || '',
          siblingDiscount: activity.siblingDiscount || 0,
          bulkDiscount: activity.bulkDiscount || 0,
          weeklyDiscount: activity.weeklyDiscount || 0,
          customTimeSlots: Array.isArray(activity.holidayTimeSlots) ? activity.holidayTimeSlots.map((slot: any) => ({
            id: slot.id,
            name: slot.name,
            startTime: slot.startTime,
            endTime: slot.endTime,
            price: slot.price,
            capacity: slot.capacity
          })) : [],
          isWraparoundCare: activity.isWraparoundCare || false,
          yearGroups: activity.yearGroups || [],
          sessionBlocks: Array.isArray(activity.sessionBlocks) ? activity.sessionBlocks.map((block: any) => ({
            id: block.id,
            name: block.name,
            startTime: block.startTime,
            endTime: block.endTime,
            capacity: block.capacity,
            price: block.price
          })) : [],
          durationWeeks: activity.durationWeeks || 1,
          courseExcludeDates: activity.courseExcludeDates || []
        });
      } else {
        throw new Error(data.message || 'Failed to fetch activity');
      }
    } catch (error) {
      console.error('Error fetching activity:', error);
      toast.error('Failed to fetch activity details');
      navigate('/business/activities');
    } finally {
      setLoading(false);
    }
  };

  const fetchVenues = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch(buildApiUrl('/business/venues'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();

        if (data.success) {
          // Handle different possible data structures
          let venuesData = [];
          if (Array.isArray(data.data)) {
            venuesData = data.data;
          } else if (data.data && Array.isArray(data.data.venues)) {
            venuesData = data.data.venues;
          } else if (data.data && Array.isArray(data.data.data)) {
            venuesData = data.data.data;
          } else if (data.data && typeof data.data === 'object') {
            // If data is an object, try to find venues array
            venuesData = Object.values(data.data).find(val => Array.isArray(val)) || [];
          }

          setVenues(venuesData);
        } else {
          setVenues([]);
        }
      } else {
        setVenues([]);
      }
    } catch (error) {
      console.error('Error fetching venues:', error);
      setVenues([]);
    }
  };

  const handleInputChange = (field: keyof ActivityFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleDayToggle = (day: string) => {
    setFormData(prev => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter(d => d !== day)
        : [...prev.daysOfWeek, day]
    }));
  };

  const addCustomTimeSlot = () => {
    const newSlot: CustomTimeSlot = {
      id: Date.now().toString(),
      name: '',
      startTime: '',
      endTime: '',
      price: 0,
      capacity: 0
    };
    setFormData(prev => ({
      ...prev,
      customTimeSlots: [...prev.customTimeSlots, newSlot]
    }));
  };

  const removeCustomTimeSlot = (id: string) => {
    setFormData(prev => ({
      ...prev,
      customTimeSlots: prev.customTimeSlots.filter(slot => slot.id !== id)
    }));
  };

  const updateCustomTimeSlot = (id: string, field: keyof CustomTimeSlot, value: any) => {
    setFormData(prev => ({
      ...prev,
      customTimeSlots: prev.customTimeSlots.map(slot =>
        slot.id === id ? { ...slot, [field]: value } : slot
      )
    }));
  };

  const addSessionBlock = () => {
    const newBlock: SessionBlock = {
      id: Date.now().toString(),
      name: '',
      startTime: '',
      endTime: '',
      capacity: 0,
      price: 0
    };
    setFormData(prev => ({
      ...prev,
      sessionBlocks: [...prev.sessionBlocks, newBlock]
    }));
  };

  const removeSessionBlock = (id: string) => {
    setFormData(prev => ({
      ...prev,
      sessionBlocks: prev.sessionBlocks.filter(block => block.id !== id)
    }));
  };

  const updateSessionBlock = (id: string, field: keyof SessionBlock, value: any) => {
    setFormData(prev => ({
      ...prev,
      sessionBlocks: prev.sessionBlocks.map(block =>
        block.id === id ? { ...block, [field]: value } : block
      )
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error('Activity name is required');
      return;
    }

    if (!formData.venueId) {
      toast.error('Please select a venue');
      return;
    }

    // Note: daysOfWeek can be empty - backend will default to weekdays

    if (formData.type === 'holiday_club') {
      if (!formData.ageRange.trim()) {
        toast.error('Age range is required for Holiday Club');
        return;
      }
      if (formData.price <= 0) {
        toast.error('Price must be greater than 0');
        return;
      }
    }

    if (formData.type === 'course/program') {
      if (formData.durationWeeks <= 0) {
        toast.error('Duration must be at least 1 week');
        return;
      }
      if (formData.price <= 0) {
        toast.error('Price must be greater than 0');
        return;
      }
    }

    if (formData.isWraparoundCare) {
      if (formData.yearGroups.length === 0) {
        toast.error('Please select at least one year group for Wraparound Care');
        return;
      }
      if (formData.sessionBlocks.length === 0) {
        toast.error('Please add at least one session block for Wraparound Care');
        return;
      }
    }

    try {
      setSaving(true);
      const token = authService.getToken();

      const response = await fetch(buildApiUrl(`/business/activities/${activityId}`), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error('Failed to update activity');
      }

      const data = await response.json();

      if (data.success) {
        toast.success('Activity updated successfully');
        navigate(`/business/activities/${activityId}`);
      } else {
        throw new Error(data.message || 'Failed to update activity');
      }
    } catch (error) {
      console.error('Error updating activity:', error);
      toast.error('Failed to update activity');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <BusinessLayout >
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 rounded w-1/4 mb-6"></div>
          <div className="h-64 bg-gray-300 rounded"></div>
        </div>
      </BusinessLayout>
    );
  }

  return (
    <BusinessLayout >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={() => navigate(`/business/activities/${activityId}`)}
            >
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to Activity
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Edit Activity</h1>
              <p className="text-gray-600">{formData.title}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Activity Name *
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => handleInputChange('title', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
                      placeholder="Enter activity name"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
                      rows={3}
                      placeholder="Describe your activity"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Activity Type *
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => handleInputChange('type', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
                      required
                    >
                      <option value="">Select activity type</option>
                      {activityTypes.map(type => (
                        <option key={type} value={type.toLowerCase().replace(' ', '_')}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Venue *
                    </label>
                    <select
                      value={formData.venueId}
                      onChange={(e) => handleInputChange('venueId', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
                      required
                    >
                      <option value="">Select venue</option>
                      {Array.isArray(venues) && venues.map(venue => (
                        <option key={venue.id} value={venue.id}>
                          {venue.name}
                        </option>
                      ))}
                    </select>
                    {venues.length === 0 && (
                      <p className="mt-1 text-sm text-red-600">No venues available. Please add venues first.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Schedule */}
              <Card>
                <CardHeader>
                  <CardTitle>Schedule</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Date *
                      </label>
                      <input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => handleInputChange('startDate', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        End Date *
                      </label>
                      <input
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => handleInputChange('endDate', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Time *
                      </label>
                      <input
                        type="time"
                        value={formData.startTime}
                        onChange={(e) => handleInputChange('startTime', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        End Time *
                      </label>
                      <input
                        type="time"
                        value={formData.endTime}
                        onChange={(e) => handleInputChange('endTime', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Days of the Week *
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                      {daysOfWeek.map(day => (
                        <label key={day.value} className="flex items-center justify-center p-3 sm:p-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors min-h-[48px] sm:min-h-[40px]">
                          <input
                            type="checkbox"
                            checked={formData.daysOfWeek.includes(day.value)}
                            onChange={() => handleDayToggle(day.value)}
                            className="mr-2 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 focus:ring-2 accent-teal-600"
                          />
                          <span className="text-sm font-medium select-none">{day.label.slice(0, 3)}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors min-h-[48px]">
                      <input
                        type="checkbox"
                        checked={formData.holidaySessions}
                        onChange={(e) => handleInputChange('holidaySessions', e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 focus:ring-2 accent-teal-600 flex-shrink-0"
                      />
                      <span className="text-sm font-medium text-gray-700 cursor-pointer leading-relaxed">
                        Include sessions during holidays
                      </span>
                    </div>

                    <div className="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors min-h-[48px]">
                      <input
                        type="checkbox"
                        checked={formData.proRataBooking}
                        onChange={(e) => handleInputChange('proRataBooking', e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 focus:ring-2 accent-teal-600 flex-shrink-0"
                      />
                      <span className="text-sm font-medium text-gray-700 cursor-pointer leading-relaxed">
                        Allow pro-rata booking
                      </span>
                    </div>

                    <div className="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors min-h-[48px]">
                      <input
                        type="checkbox"
                        checked={formData.generateSessions}
                        onChange={(e) => handleInputChange('generateSessions', e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 focus:ring-2 accent-teal-600 flex-shrink-0"
                      />
                      <span className="text-sm font-medium text-gray-700 cursor-pointer leading-relaxed">
                        Generate sessions automatically
                      </span>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Exclude Dates (Optional)
                      </label>
                      <div className="space-y-2">
                        {formData.excludeDates.map((date, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            <input
                              type="date"
                              value={date}
                              onChange={(e) => {
                                const newDates = [...formData.excludeDates];
                                newDates[index] = e.target.value;
                                handleInputChange('excludeDates', newDates);
                              }}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newDates = formData.excludeDates.filter((_, i) => i !== index);
                                handleInputChange('excludeDates', newDates);
                              }}
                              className="px-3 py-2 text-red-600 hover:text-red-800"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            const newDates = [...formData.excludeDates, ''];
                            handleInputChange('excludeDates', newDates);
                          }}
                          className="px-4 py-2 text-[#00806a] hover:text-[#006b5a] border border-[#00806a] rounded-md hover:bg-[#00806a]/5"
                        >
                          Add Exclude Date
                        </button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Pricing */}
              <Card>
                <CardHeader>
                  <CardTitle>Pricing & Capacity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Base Price (£) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.price}
                        onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Capacity *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formData.capacity}
                        onChange={(e) => handleInputChange('capacity', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
                        required
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Activity & Holiday Club Specific Fields */}
              {(formData.type === 'holiday_club' || formData.type === 'activity') && (
                <Card>
                  <CardHeader>
                    <CardTitle>Activity Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Age Range *
                      </label>
                      <input
                        type="text"
                        value={formData.ageRange}
                        onChange={(e) => handleInputChange('ageRange', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
                        placeholder="e.g., 4-12 years"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        What to Bring
                      </label>
                      <textarea
                        value={formData.whatToBring}
                        onChange={(e) => handleInputChange('whatToBring', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
                        rows={3}
                        placeholder="List items children should bring"
                      />
                    </div>

                    {/* Extended Hours Section - Only for Holiday Club */}
                    {formData.type === 'holiday_club' && (
                      <div className="space-y-4">
                        <h4 className="font-medium text-gray-900">Extended Hours</h4>

                        <div className="space-y-3">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={formData.earlyDropoff}
                              onChange={(e) => handleInputChange('earlyDropoff', e.target.checked)}
                              className="mr-2 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 focus:ring-2 accent-teal-600"
                            />
                            <span className="text-sm font-medium text-gray-700">
                              Early Drop-off
                            </span>
                          </label>
                          {formData.earlyDropoff && (
                            <div className="ml-6">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Early Drop-off Start Time
                                  </label>
                                  <input
                                    type="time"
                                    value={formData.earlyDropoffStartTime}
                                    onChange={(e) => handleInputChange('earlyDropoffStartTime', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Early Drop-off End Time
                                  </label>
                                  <input
                                    type="time"
                                    value={formData.earlyDropoffEndTime}
                                    onChange={(e) => handleInputChange('earlyDropoffEndTime', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
                                  />
                                </div>
                              </div>
                              <div className="mt-3">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Early Drop-off Price (£)
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={formData.earlyDropoffPrice}
                                  onChange={(e) => handleInputChange('earlyDropoffPrice', parseFloat(e.target.value) || 0)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
                                  placeholder="Price for early drop-off"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="space-y-3">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={formData.latePickup}
                              onChange={(e) => handleInputChange('latePickup', e.target.checked)}
                              className="mr-2"
                            />
                            <span className="text-sm font-medium text-gray-700">
                              Late Pick-up
                            </span>
                          </label>
                          {formData.latePickup && (
                            <div className="ml-6">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Late Pick-up Start Time
                                  </label>
                                  <input
                                    type="time"
                                    value={formData.latePickupStartTime}
                                    onChange={(e) => handleInputChange('latePickupStartTime', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Late Pick-up End Time
                                  </label>
                                  <input
                                    type="time"
                                    value={formData.latePickupEndTime}
                                    onChange={(e) => handleInputChange('latePickupEndTime', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
                                  />
                                </div>
                              </div>
                              <div className="mt-3">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Late Pick-up Price (£)
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={formData.latePickupPrice}
                                  onChange={(e) => handleInputChange('latePickupPrice', parseFloat(e.target.value) || 0)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
                                  placeholder="Price for late pick-up"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-900">Discounts</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Sibling Discount (%)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={formData.siblingDiscount}
                            onChange={(e) => handleInputChange('siblingDiscount', parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Weekly Discount (%)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={formData.weeklyDiscount}
                            onChange={(e) => handleInputChange('weeklyDiscount', parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Full Holiday Discount (%)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={formData.bulkDiscount}
                            onChange={(e) => handleInputChange('bulkDiscount', parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">Custom Time Slots</h4>
                        <Button
                          type="button"
                          onClick={addCustomTimeSlot}
                          className="bg-[#00806a] hover:bg-[#006d5a] text-white text-sm"
                        >
                          Add Time Slot
                        </Button>
                      </div>
                      <div className="space-y-3">
                        {Array.isArray(formData.customTimeSlots) && formData.customTimeSlots.map((slot) => (
                          <div key={slot.id} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex justify-between items-start mb-3">
                              <h5 className="font-medium text-gray-900">Time Slot</h5>
                              <Button
                                type="button"
                                onClick={() => removeCustomTimeSlot(slot.id)}
                                className="text-red-600 hover:text-red-800 p-1"
                              >
                                <XMarkIcon className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <input
                                type="text"
                                value={slot.name}
                                onChange={(e) => updateCustomTimeSlot(slot.id, 'name', e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
                                placeholder="Slot name"
                              />
                              <input
                                type="time"
                                value={slot.startTime}
                                onChange={(e) => updateCustomTimeSlot(slot.id, 'startTime', e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
                              />
                              <input
                                type="time"
                                value={slot.endTime}
                                onChange={(e) => updateCustomTimeSlot(slot.id, 'endTime', e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
                              />
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={slot.price}
                                onChange={(e) => updateCustomTimeSlot(slot.id, 'price', parseFloat(e.target.value) || 0)}
                                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
                                placeholder="Price"
                              />
                              <input
                                type="number"
                                min="1"
                                value={slot.capacity}
                                onChange={(e) => updateCustomTimeSlot(slot.id, 'capacity', parseInt(e.target.value) || 0)}
                                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
                                placeholder="Capacity"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Course/Program Specific Fields */}
              {formData.type === 'course/program' && (
                <Card>
                  <CardHeader>
                    <CardTitle>Course/Program Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Duration (Weeks) *
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={formData.durationWeeks}
                          onChange={(e) => handleInputChange('durationWeeks', parseInt(e.target.value) || 1)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
                          placeholder="Number of weeks"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Exclude Dates (Optional)
                        </label>
                        <div className="space-y-2">
                          {formData.courseExcludeDates.map((date, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              <input
                                type="date"
                                value={date}
                                onChange={(e) => {
                                  const newDates = [...formData.courseExcludeDates];
                                  newDates[index] = e.target.value;
                                  handleInputChange('courseExcludeDates', newDates);
                                }}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const newDates = formData.courseExcludeDates.filter((_, i) => i !== index);
                                  handleInputChange('courseExcludeDates', newDates);
                                }}
                                className="px-3 py-2 text-red-600 hover:text-red-800"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              const newDates = [...formData.courseExcludeDates, ''];
                              handleInputChange('courseExcludeDates', newDates);
                            }}
                            className="px-4 py-2 text-[#00806a] hover:text-[#006b5a] border border-[#00806a] rounded-md hover:bg-[#00806a]/5"
                          >
                            Add Exclude Date
                          </button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Wraparound Care Specific Fields */}
              {formData.isWraparoundCare && (
                <Card>
                  <CardHeader>
                    <CardTitle>Wraparound Care Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Year Groups *
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {yearGroupOptions.map(year => (
                          <label key={year} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={formData.yearGroups.includes(year)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  handleInputChange('yearGroups', [...formData.yearGroups, year]);
                                } else {
                                  handleInputChange('yearGroups', formData.yearGroups.filter(y => y !== year));
                                }
                              }}
                              className="mr-2"
                            />
                            <span className="text-sm">{year}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">Session Blocks</h4>
                        <Button
                          type="button"
                          onClick={addSessionBlock}
                          className="bg-[#00806a] hover:bg-[#006d5a] text-white text-sm"
                        >
                          Add Session Block
                        </Button>
                      </div>
                      <div className="space-y-3">
                        {Array.isArray(formData.sessionBlocks) && formData.sessionBlocks.map((block) => (
                          <div key={block.id} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex justify-between items-start mb-3">
                              <h5 className="font-medium text-gray-900">Session Block</h5>
                              <Button
                                type="button"
                                onClick={() => removeSessionBlock(block.id)}
                                className="text-red-600 hover:text-red-800 p-1"
                              >
                                <XMarkIcon className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <input
                                type="text"
                                value={block.name}
                                onChange={(e) => updateSessionBlock(block.id, 'name', e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
                                placeholder="Block name"
                              />
                              <input
                                type="time"
                                value={block.startTime}
                                onChange={(e) => updateSessionBlock(block.id, 'startTime', e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
                              />
                              <input
                                type="time"
                                value={block.endTime}
                                onChange={(e) => updateSessionBlock(block.id, 'endTime', e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
                              />
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={block.price}
                                onChange={(e) => updateSessionBlock(block.id, 'price', parseFloat(e.target.value) || 0)}
                                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
                                placeholder="Price"
                              />
                              <input
                                type="number"
                                min="1"
                                value={block.capacity}
                                onChange={(e) => updateSessionBlock(block.id, 'capacity', parseInt(e.target.value) || 0)}
                                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
                                placeholder="Capacity"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Save Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    type="submit"
                    disabled={saving}
                    className="w-full bg-[#00806a] hover:bg-[#006d5a]"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>

                  <Button
                    type="button"
                    onClick={() => navigate(`/business/activities/${activityId}`)}
                    variant="outline"
                    className="w-full"
                  >
                    Cancel
                  </Button>
                </CardContent>
              </Card>

              {/* Form Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Type:</span>
                    <span className="font-medium capitalize">{formData.type.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Price:</span>
                    <span className="font-medium">£{formData.price}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Capacity:</span>
                    <span className="font-medium">{formData.capacity}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Days:</span>
                    <span className="font-medium">{formData.daysOfWeek.length}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </div>
    </BusinessLayout>
  );
};

export default EditActivityPage;
