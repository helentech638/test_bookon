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
import BusinessLayout from '../../components/layout/BusinessLayout';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/authService';
import { buildApiUrl } from '../../config/api';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  capacity?: number;
}

interface SessionBlock {
  id?: string;
  name: string;
  startTime: string;
  endTime: string;
  capacity: number;
  price: number;
}

interface CustomTimeSlot {
  id?: string;
  name: string;
  startTime: string;
  endTime: string;
  price: number;
  capacity: number;
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
  images: File[]; // Add images field
  imageUrls: string[]; // Add image URLs field
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
  courseExcludeDates: string[]; // Dates to exclude from course
}

const CreateActivityPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [activityTypes, setActivityTypes] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [sessionTemplates, setSessionTemplates] = useState<any[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  // Year groups for wraparound care
  const yearGroups = [
    'Reception', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6',
    'Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12', 'Year 13'
  ];


  const [formData, setFormData] = useState<ActivityFormData>({
    title: '',
    type: '',
    venueId: '',
    description: '',
    startDate: '',
    endDate: '',
    startTime: '09:00',
    endTime: '17:00',
    capacity: 20,
    price: 0,
    images: [], // Initialize images array
    imageUrls: [], // Initialize image URLs array
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
    // New fields
    daysOfWeek: [],
    proRataBooking: false,
    holidaySessions: true,
    // Wraparound Care specific fields
    isWraparoundCare: false,
    yearGroups: [],
    sessionBlocks: [],
    // Holiday Club specific fields
    ageRange: '',
    whatToBring: '',
    siblingDiscount: 0,
    bulkDiscount: 0,
    weeklyDiscount: 0,
    // Course/Program specific fields
    durationWeeks: 1,
    customTimeSlots: [],
    courseExcludeDates: []
  });

  // Generate individual dates based on start/end date and days of week
  const generateIndividualDates = () => {
    if (!formData.startDate || !formData.endDate) {
      return [];
    }

    const dates: string[] = [];
    const startDate = new Date(formData.startDate);
    const endDate = new Date(formData.endDate);
    
    // Map day names to numbers (Monday = 1, Sunday = 0)
    const dayMap: { [key: string]: number } = {
      'monday': 1,
      'tuesday': 2,
      'wednesday': 3,
      'thursday': 4,
      'friday': 5,
      'saturday': 6,
      'sunday': 0
    };

    const selectedDays = formData.daysOfWeek.map(day => dayMap[day.toLowerCase()]);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      
      // If daysOfWeek is specified, only include those days
      if (selectedDays.length > 0) {
        if (selectedDays.includes(dayOfWeek)) {
          dates.push(d.toISOString().split('T')[0]);
        }
      } else {
        // Default to weekdays only if no specific days selected (matching backend logic)
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Monday to Friday
          dates.push(d.toISOString().split('T')[0]);
        }
      }
    }

    return dates;
  };

  // Calculate individual dates after formData is initialized
  const individualDates = generateIndividualDates();

  useEffect(() => {
    fetchVenues();
    fetchActivityTypes();
    fetchSessionTemplates();
  }, []);

  // Auto-set wraparound care when type is selected
  useEffect(() => {
    if (formData.type === 'wraparound_care') {
      setFormData(prev => ({ ...prev, isWraparoundCare: true }));
    } else {
      setFormData(prev => ({ ...prev, isWraparoundCare: false, sessionBlocks: [] }));
    }
  }, [formData.type]);

  const fetchVenues = async () => {
    try {
      setVenuesLoading(true);
      const token = authService.getToken();
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch(buildApiUrl('/business/venues'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch venues');
      }

      const data = await response.json();
      if (data.success) {
        setVenues(data.data.venues || []);
      } else {
        throw new Error(data.message || 'Failed to fetch venues');
      }
    } catch (error) {
      console.error('Error fetching venues:', error);
      toast.error('Failed to load venues');
    } finally {
      setVenuesLoading(false);
    }
  };

  const fetchActivityTypes = async () => {
    try {
      // Set predefined activity types including the new Course type
      const predefinedTypes = [
        { value: 'activity', label: 'Activity' },
        { value: 'holiday_club', label: 'Holiday Club' },
        { value: 'wraparound_care', label: 'Wraparound Care' },
        { value: 'course/program', label: 'Course/Program' }
      ];
      
      setActivityTypes(predefinedTypes);
    } catch (error) {
      console.error('Error setting activity types:', error);
      toast.error('Failed to load activity types');
    }
  };

  const fetchSessionTemplates = async () => {
    try {
      const token = authService.getToken();
      if (!token) return;

      const response = await fetch(buildApiUrl('/session-templates'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSessionTemplates(data.data || []);
        }
      }
    } catch (error) {
      console.error('Error fetching session templates:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Image upload handlers
  const handleImageUpload = async (files: FileList) => {
    setUploadingImages(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const formData = new FormData();
        formData.append('image', file);
        
        const response = await fetch(buildApiUrl('/upload/image'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authService.getToken()}`
          },
          body: formData
        });
        
        if (!response.ok) throw new Error('Upload failed');
        const result = await response.json();
        return result.data.url;
      });
      
      const uploadedUrls = await Promise.all(uploadPromises);
      setFormData(prev => ({
        ...prev,
        imageUrls: [...prev.imageUrls, ...uploadedUrls]
      }));
      
      toast.success(`${uploadedUrls.length} image(s) uploaded successfully`);
    } catch (error) {
      console.error('Image upload error:', error);
      toast.error('Failed to upload images');
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      imageUrls: prev.imageUrls.filter((_, i) => i !== index)
    }));
  };

  // Session block management functions
  const addSessionBlock = () => {
    const newBlock: SessionBlock = {
      name: `Session ${formData.sessionBlocks.length + 1}`,
      startTime: '15:30',
      endTime: '16:30',
      capacity: 10,
      price: 5.00
    };
    setFormData(prev => ({
      ...prev,
      sessionBlocks: [...prev.sessionBlocks, newBlock]
    }));
  };

  const removeSessionBlock = (index: number) => {
    setFormData(prev => ({
      ...prev,
      sessionBlocks: prev.sessionBlocks.filter((_, i) => i !== index)
    }));
  };

  const updateSessionBlock = (index: number, field: keyof SessionBlock, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      sessionBlocks: prev.sessionBlocks.map((block, i) => 
        i === index ? { ...block, [field]: value } : block
      )
    }));
  };

  const applySessionTemplate = (template: any) => {
    const blocks = template.blocks.map((block: any, index: number) => ({
      name: block.name || `Session ${index + 1}`,
      startTime: block.startTime,
      endTime: block.endTime,
      capacity: block.capacity,
      price: block.price
    }));
    
    setFormData(prev => ({
      ...prev,
      sessionBlocks: blocks
    }));
    
    toast.success(`Applied template: ${template.name}`);
  };

  const handleYearGroupChange = (yearGroup: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      yearGroups: checked 
        ? [...prev.yearGroups, yearGroup]
        : prev.yearGroups.filter(yg => yg !== yearGroup)
    }));
  };

  // Holiday Club custom time slot functions
  const addCustomTimeSlot = () => {
    if (formData.customTimeSlots.length >= 3) {
      toast.error('Maximum 3 custom time slots allowed');
      return;
    }
    const newSlot: CustomTimeSlot = {
      name: `Custom Slot ${formData.customTimeSlots.length + 1}`,
      startTime: '09:00',
      endTime: '15:00',
      price: 0,
      capacity: 10
    };
    setFormData(prev => ({ ...prev, customTimeSlots: [...prev.customTimeSlots, newSlot] }));
  };

  const removeCustomTimeSlot = (index: number) => {
    setFormData(prev => ({
      ...prev,
      customTimeSlots: prev.customTimeSlots.filter((_, i) => i !== index)
    }));
  };

  const updateCustomTimeSlot = (index: number, field: keyof CustomTimeSlot, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      customTimeSlots: prev.customTimeSlots.map((slot, i) => 
        i === index ? { ...slot, [field]: value } : slot
      )
    }));
  };

  // Handle individual date exclusion
  const handleDateExclusion = (date: string, excluded: boolean) => {
    setFormData(prev => ({
      ...prev,
      excludeDates: excluded 
        ? [...prev.excludeDates, date]
        : prev.excludeDates.filter(d => d !== date)
    }));
  };

  // Group dates by week for better display
  const groupDatesByWeek = (dates: string[]) => {
    const weeks: { [key: string]: string[] } = {};
    
    dates.forEach(date => {
      const d = new Date(date);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay() + 1); // Start of week (Monday)
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weeks[weekKey]) {
        weeks[weekKey] = [];
      }
      weeks[weekKey].push(date);
    });
    
    return Object.entries(weeks).map(([weekStart, dates]) => ({
      weekStart,
      dates: dates.sort()
    }));
  };

  const groupedDates = groupDatesByWeek(individualDates);

  // Generate course dates for Course/Program type
  const generateCourseDates = () => {
    if (!formData.startDate || !formData.endDate || formData.daysOfWeek.length === 0) {
      return [];
    }

    const startDate = new Date(formData.startDate);
    const endDate = new Date(formData.endDate);
    const courseDates: Array<{
      week: number;
      date: Date;
      dateString: string;
      dayName: string;
      time: string;
      isExcluded: boolean;
    }> = [];

    // Generate sessions for each selected day of the week
    formData.daysOfWeek.forEach(dayName => {
      // Convert lowercase day name to capitalized for indexOf
      const capitalizedDayName = dayName.charAt(0).toUpperCase() + dayName.slice(1);
      const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(capitalizedDayName);
      
      // Find the first occurrence of this day within the date range
      const firstSessionDate = new Date(startDate);
      const daysUntilFirstSession = (dayOfWeek - startDate.getDay() + 7) % 7;
      firstSessionDate.setDate(startDate.getDate() + daysUntilFirstSession);

      // If the first session date is before the start date, move to next week
      if (firstSessionDate < startDate) {
        firstSessionDate.setDate(firstSessionDate.getDate() + 7);
      }

      // Generate all sessions for this day within the date range
      let currentSessionDate = new Date(firstSessionDate);
      let weekNumber = 1;

      while (currentSessionDate <= endDate) {
        const dateString = currentSessionDate.toISOString().split('T')[0];
        
        // Always add to courseDates (for display), but mark as excluded if needed
        courseDates.push({
          week: weekNumber,
          date: new Date(currentSessionDate),
          dateString: dateString,
          dayName: capitalizedDayName,
          time: formData.startTime && formData.endTime ? 
            `${formData.startTime} - ${formData.endTime}` : 
            'Time to be confirmed',
          isExcluded: formData.courseExcludeDates.includes(dateString)
        });

        // Move to next week
        currentSessionDate.setDate(currentSessionDate.getDate() + 7);
        weekNumber++;
      }
    });

    // Sort by date
    return courseDates.sort((a, b) => a.date.getTime() - b.date.getTime());
  };

  const courseDates: Array<{
    week: number;
    date: Date;
    dateString: string;
    dayName: string;
    time: string;
    isExcluded: boolean;
  }> = generateCourseDates();

  // Auto-calculate durationWeeks for Course/Program based on active sessions
  useEffect(() => {
    if (formData.type === 'course/program' && courseDates.length > 0) {
      const activeSessions = courseDates.filter(d => !d.isExcluded).length;
      setFormData(prev => ({ ...prev, durationWeeks: activeSessions }));
    }
  }, [formData.type, courseDates]);

  const handleExcludeCourseDate = (dateString: string) => {
    setFormData(prev => ({
      ...prev,
      courseExcludeDates: [...prev.courseExcludeDates, dateString]
    }));
  };

  const handleIncludeCourseDate = (dateString: string) => {
    setFormData(prev => ({
      ...prev,
      courseExcludeDates: prev.courseExcludeDates.filter(date => date !== dateString)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.type || !formData.venueId || !formData.startDate || !formData.endDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Note: daysOfWeek can be empty - backend will default to weekdays

    // Price validation
    if (formData.price <= 0) {
      toast.error('Please set a valid price for the activity');
      return;
    }

    // Wraparound care specific validation
    if (formData.isWraparoundCare) {
      if (formData.yearGroups.length === 0) {
        toast.error('Please select at least one year group for wraparound care');
        return;
      }
      if (formData.sessionBlocks.length === 0) {
        toast.error('Please add at least one session block for wraparound care');
        return;
      }
      
      // Validate session blocks
      for (const block of formData.sessionBlocks) {
        if (!block.name || !block.startTime || !block.endTime || block.capacity <= 0 || block.price <= 0) {
          toast.error('Please fill in all session block details correctly');
          return;
        }
      }
    }

    // Course/Program specific validation
    if (formData.type === 'course/program') {
      if (courseDates.length === 0) {
        toast.error('Please ensure your start date, end date, and days of the week are set correctly to generate course sessions');
        return;
      }
      if (formData.daysOfWeek.length === 0) {
        toast.error('Please select at least one day of the week for the course');
        return;
      }
    }

    // Holiday Club and Activity specific validation
    if (formData.type === 'holiday_club' || formData.type === 'activity') {
      if (formData.price <= 0) {
        toast.error('Please set a valid price per session/day for this activity');
        return;
      }
      if (!formData.ageRange) {
        toast.error('Please specify the age range for this activity');
        return;
      }
      
      // Validate custom time slots
      for (const slot of formData.customTimeSlots) {
        if (!slot.name || !slot.startTime || !slot.endTime || slot.price <= 0 || slot.capacity <= 0) {
          toast.error('Please fill in all custom time slot details correctly');
          return;
        }
      }
    }

    try {
      setLoading(true);
      const token = authService.getToken();
      if (!token) {
        navigate('/login');
        return;
      }

      const requestData = {
        ...formData,
        imageUrls: formData.imageUrls // Include image URLs in the request
      };
      

      const response = await fetch(buildApiUrl('/business/activities'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error('Failed to create activity');
      }

      const data = await response.json();
      if (data.success) {
        toast.success('Activity created successfully!');
        navigate('/business/activities');
      } else {
        throw new Error(data.message || 'Failed to create activity');
      }
    } catch (error) {
      console.error('Error creating activity:', error);
      toast.error('Failed to create activity');
    } finally {
      setLoading(false);
    }
  };

  if (venuesLoading) {
    return (
      <BusinessLayout user={user}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-64 mb-6"></div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-4 bg-gray-300 rounded w-full"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </BusinessLayout>
    );
  }

  return (
    <BusinessLayout user={user}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Create New Activity</h1>
            <p className="text-gray-600 mt-1">Set up a new activity for your business</p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate('/business/activities')}
            className="flex items-center gap-2"
          >
            <XMarkIcon className="h-5 w-5" />
            Cancel
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Activity Title *
                </label>
                <Input
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="e.g., Football Training"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Activity Type *
                </label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00806a] focus:border-transparent"
                  required
                >
                  <option value="">Select type</option>
                  {activityTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <Textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe the activity..."
                rows={3}
              />
            </div>

            {/* Activity Images */}
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Activity Images
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => e.target.files && handleImageUpload(e.target.files)}
                  className="hidden"
                  id="image-upload"
                  disabled={uploadingImages}
                />
                <label
                  htmlFor="image-upload"
                  className={`cursor-pointer ${uploadingImages ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex flex-col items-center">
                    <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm text-gray-600">
                      {uploadingImages ? 'Uploading...' : 'Click to upload images or drag and drop'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF up to 10MB each</p>
                  </div>
                </label>
              </div>
              
              {/* Display uploaded images */}
              {formData.imageUrls.length > 0 && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  {formData.imageUrls.map((url, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={url}
                        alt={`Activity image ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Venue & Schedule</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Venue *
                </label>
                <select
                  name="venueId"
                  value={formData.venueId}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00806a] focus:border-transparent"
                  required
                >
                  <option value="">Select venue</option>
                  {venues.map((venue) => (
                    <option key={venue.id} value={venue.id}>
                      {venue.name} - {venue.address}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Capacity
                </label>
                <Input
                  name="capacity"
                  type="number"
                  value={formData.capacity}
                  onChange={handleInputChange}
                  min="1"
                  max="100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date *
                </label>
                <Input
                  name="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={handleInputChange}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date *
                </label>
                <Input
                  name="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Time
                </label>
                <Input
                  name="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={handleInputChange}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Time
                </label>
                <Input
                  name="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>

          {/* Days of Week Selection */}
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Schedule</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Days of the Week *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, index) => (
                  <label key={day} className="flex items-center justify-center p-3 sm:p-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors min-h-[48px] sm:min-h-[40px]">
                    <input
                      type="checkbox"
                      value={day.toLowerCase()}
                      checked={formData.daysOfWeek.includes(day.toLowerCase())}
                      onChange={(e) => {
                        const value = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          daysOfWeek: e.target.checked 
                            ? [...prev.daysOfWeek, value]
                            : prev.daysOfWeek.filter(d => d !== value)
                        }));
                      }}
                      className="mr-2 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 focus:ring-2 accent-teal-600"
                    />
                    <span className="text-sm font-medium select-none">{day.slice(0, 3)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors min-h-[48px]">
                <input
                  type="checkbox"
                  id="holidaySessions"
                  checked={formData.holidaySessions}
                  onChange={(e) => setFormData(prev => ({ ...prev, holidaySessions: e.target.checked }))}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 focus:ring-2 accent-teal-600 flex-shrink-0"
                />
                <label htmlFor="holidaySessions" className="text-sm font-medium text-gray-700 cursor-pointer leading-relaxed">
                  Include sessions during holidays
                </label>
              </div>
              
              <div className="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors min-h-[48px]">
                <input
                  type="checkbox"
                  id="proRataBooking"
                  checked={formData.proRataBooking}
                  onChange={(e) => setFormData(prev => ({ ...prev, proRataBooking: e.target.checked }))}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 focus:ring-2 accent-teal-600 flex-shrink-0"
                />
                <label htmlFor="proRataBooking" className="text-sm font-medium text-gray-700 cursor-pointer leading-relaxed">
                  Allow pro-rata booking (join mid-term)
                </label>
              </div>
            </div>
          </div>

          {/* Course Schedule - Only for Course/Program */}
          {formData.type === 'course/program' && formData.startDate && formData.endDate && formData.daysOfWeek.length > 0 && courseDates.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Course Schedule</h2>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-4">
                  Review and manage individual course sessions. You can remove ANY session from the schedule for holidays, breaks, or other exclusions.
                </p>
                
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-900">
                        Total Sessions Generated: {courseDates.length}
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        {formData.daysOfWeek.map(day => day.charAt(0).toUpperCase() + day.slice(1)).join(', ')} sessions between {formData.startDate} and {formData.endDate}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-blue-900">
                        Active Sessions: {courseDates.filter(d => !d.isExcluded).length}
                      </p>
                      {courseDates.filter(d => d.isExcluded).length > 0 && (
                        <p className="text-xs text-orange-600 mt-1">
                          {courseDates.filter(d => d.isExcluded).length} excluded
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                
                {courseDates.length > 0 ? (
                  <div className="space-y-3">
                    {courseDates.map((courseDate, index) => (
                      <div key={courseDate.dateString} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                        courseDate.isExcluded 
                          ? 'bg-red-50 border-red-200 opacity-60' 
                          : 'bg-white border-gray-200'
                      }`}>
                        <div className="flex items-center space-x-4">
                          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                            courseDate.isExcluded
                              ? 'bg-red-200 text-red-800'
                              : 'bg-[#00806a] text-white'
                          }`}>
                            Week {courseDate.week}
                          </div>
                          <div className="text-gray-700">
                            <span className="font-medium">{courseDate.dayName}</span>
                            <span className="ml-2">{courseDate.date.toLocaleDateString()}</span>
                            <span className="ml-2 text-gray-500">at {courseDate.time}</span>
                            {courseDate.isExcluded && (
                              <span className="ml-2 text-red-600 text-sm font-medium">(EXCLUDED)</span>
                            )}
                          </div>
                        </div>
                        
                        {courseDate.isExcluded ? (
                          <button
                            type="button"
                            onClick={() => handleIncludeCourseDate(courseDate.dateString)}
                            className="px-4 py-2 bg-green-100 text-green-700 rounded-md text-sm hover:bg-green-200 transition-colors font-medium"
                          >
                            ✓ Include Session
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleExcludeCourseDate(courseDate.dateString)}
                            className="px-4 py-2 bg-red-100 text-red-700 rounded-md text-sm hover:bg-red-200 transition-colors font-medium"
                          >
                            ✗ Remove Session
                          </button>
                        )}
                      </div>
                    ))}
                    
                    <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            <strong>Course Summary:</strong>
                          </p>
                          <p className="text-sm text-gray-700 mt-1">
                            {courseDates.filter(d => !d.isExcluded).length} active sessions out of {courseDates.length} total
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-[#00806a]">
                            {courseDates.filter(d => !d.isExcluded).length} Sessions
                          </p>
                          {courseDates.filter(d => d.isExcluded).length > 0 && (
                            <p className="text-xs text-orange-600 mt-1">
                              {courseDates.filter(d => d.isExcluded).length} sessions excluded
                            </p>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 mt-2">
                        💡 You can remove ANY session from the schedule above for holidays, breaks, or other exclusions
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>Set your start date, end date, and days of the week to automatically generate course sessions</p>
                    <p className="text-xs mt-2">The system will find all selected days within your date range</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Individual Dates Display - Show when dates and days are selected */}
          {individualDates.length > 0 && (formData.type === 'holiday_club' || formData.type === 'activity' || formData.type === 'wraparound_care') && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Individual Session Dates</h2>
              <p className="text-sm text-gray-600 mb-4">
                Review and manage individual session dates. Uncheck any dates you want to exclude (e.g., holidays).
              </p>
              
              <div className="space-y-4">
                {groupedDates.map((week, weekIndex) => (
                  <div key={week.weekStart} className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-3">
                      Week {weekIndex + 1}: {new Date(week.dates[0]).toLocaleDateString('en-GB', { 
                        day: 'numeric', 
                        month: 'short' 
                      })} - {new Date(week.dates[week.dates.length - 1]).toLocaleDateString('en-GB', { 
                        day: 'numeric', 
                        month: 'short' 
                      })}
                    </h3>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                      {week.dates.map((date) => {
                        const isExcluded = formData.excludeDates.includes(date);
                        const dayName = new Date(date).toLocaleDateString('en-GB', { weekday: 'short' });
                        const dayNumber = new Date(date).getDate();
                        const monthName = new Date(date).toLocaleDateString('en-GB', { month: 'short' });
                        
                        return (
                          <label
                            key={date}
                            className={`flex items-center justify-center p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                              isExcluded
                                ? 'border-red-300 bg-red-50 text-red-700'
                                : 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={!isExcluded}
                              onChange={(e) => handleDateExclusion(date, !e.target.checked)}
                              className="sr-only"
                            />
                            <div className="text-center">
                              <div className="text-sm font-medium">{dayName}</div>
                              <div className="text-lg font-bold">{dayNumber}</div>
                              <div className="text-xs">{monthName}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-blue-700">
                      <strong>Total Sessions:</strong> {individualDates.length - formData.excludeDates.length} 
                      {formData.excludeDates.length > 0 && (
                        <span className="text-red-600"> (Excluded: {formData.excludeDates.length})</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Wraparound Care Specific Settings */}
          {formData.isWraparoundCare && (
            <>
              {/* Year Groups Selection */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Year Groups</h2>
                <p className="text-sm text-gray-600 mb-4">Select which year groups this wraparound care activity is suitable for:</p>
                
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                  {yearGroups.map((yearGroup) => (
                    <label key={yearGroup} className="flex items-center justify-center p-2 border rounded-md cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={formData.yearGroups.includes(yearGroup)}
                        onChange={(e) => handleYearGroupChange(yearGroup, e.target.checked)}
                        className="mr-2 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 focus:ring-2 accent-teal-600"
                      />
                      <span className="text-sm font-medium">{yearGroup}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Session Blocks Configuration */}
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Session Blocks</h2>
                  <div className="flex items-center gap-2">
                    {sessionTemplates.length > 0 && (
                      <select
                        onChange={(e) => {
                          const template = sessionTemplates.find(t => t.id === e.target.value);
                          if (template) applySessionTemplate(template);
                          e.target.value = '';
                        }}
                        className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-[#00806a]"
                      >
                        <option value="">Apply Template</option>
                        {sessionTemplates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <Button
                      type="button"
                      onClick={addSessionBlock}
                      className="flex items-center gap-1 text-sm"
                    >
                      <PlusIcon className="w-4 h-4" />
                      Add Session
                    </Button>
                  </div>
                </div>
                
                <p className="text-sm text-gray-600 mb-4">
                  Configure the different time slots available for this wraparound care activity. 
                  Parents will be able to book individual sessions for their children.
                </p>

                {formData.sessionBlocks.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <UserGroupIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No session blocks configured</p>
                    <p className="text-sm">Click "Add Session" to create your first session block</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {formData.sessionBlocks.map((block, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-medium text-gray-900">Session {index + 1}</h3>
                          <button
                            type="button"
                            onClick={() => removeSessionBlock(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <XMarkIcon className="w-5 h-5" />
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Session Name
                            </label>
                            <Input
                              value={block.name}
                              onChange={(e) => updateSessionBlock(index, 'name', e.target.value)}
                              placeholder="e.g., After School Club"
                              className="text-sm"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Start Time
                            </label>
                            <Input
                              type="time"
                              value={block.startTime}
                              onChange={(e) => updateSessionBlock(index, 'startTime', e.target.value)}
                              className="text-sm"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              End Time
                            </label>
                            <Input
                              type="time"
                              value={block.endTime}
                              onChange={(e) => updateSessionBlock(index, 'endTime', e.target.value)}
                              className="text-sm"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Capacity
                            </label>
                            <Input
                              type="number"
                              value={block.capacity}
                              onChange={(e) => updateSessionBlock(index, 'capacity', parseInt(e.target.value) || 0)}
                              min="1"
                              className="text-sm"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Price (£)
                            </label>
                            <Input
                              type="number"
                              value={block.price}
                              onChange={(e) => updateSessionBlock(index, 'price', parseFloat(e.target.value) || 0)}
                              min="0"
                              step="0.01"
                              className="text-sm"
                            />
                          </div>
                        </div>
                        
                        <div className="mt-2 text-xs text-gray-500">
                          Duration: {block.startTime} - {block.endTime} | 
                          Capacity: {block.capacity} children | 
                          Price: £{block.price.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Pricing</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price per Session (£)
                </label>
                <Input
                  name="price"
                  type="number"
                  value={formData.price}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          </div>

          {/* Activity, Holiday Club & Course Specific Fields */}
          {(formData.type === 'holiday_club' || formData.type === 'activity' || formData.type === 'course/program') && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Activity Details</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Age Range *
                  </label>
                  <Input
                    name="ageRange"
                    value={formData.ageRange}
                    onChange={handleInputChange}
                    placeholder="e.g., 5-12 years"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    What to Bring (Optional)
                  </label>
                  <Textarea
                    name="whatToBring"
                    value={formData.whatToBring}
                    onChange={handleInputChange}
                    placeholder="e.g., Packed lunch, water bottle, change of clothes"
                    rows={3}
                  />
                </div>


                {/* Extended Hours Section - Only for Holiday Club */}
                {formData.type === 'holiday_club' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="earlyDropoff"
                        checked={formData.earlyDropoff}
                        onChange={(e) => setFormData(prev => ({ ...prev, earlyDropoff: e.target.checked }))}
                        className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 focus:ring-2 accent-teal-600"
                      />
                      <label htmlFor="earlyDropoff" className="text-sm font-medium text-gray-700">
                        Early Drop-off Available
                      </label>
                    </div>

                  {formData.earlyDropoff && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Early Drop-off Time
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Start Time</label>
                            <Input
                              name="earlyDropoffStartTime"
                              type="time"
                              value={formData.earlyDropoffStartTime}
                              onChange={handleInputChange}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">End Time</label>
                            <Input
                              name="earlyDropoffEndTime"
                              type="time"
                              value={formData.earlyDropoffEndTime}
                              onChange={handleInputChange}
                            />
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Early Drop-off Price (£)
                        </label>
                        <Input
                          name="earlyDropoffPrice"
                          type="number"
                          value={formData.earlyDropoffPrice}
                          onChange={handleInputChange}
                          min="0"
                          step="0.01"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="latePickup"
                      checked={formData.latePickup}
                      onChange={(e) => setFormData(prev => ({ ...prev, latePickup: e.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 focus:ring-2 accent-teal-600"
                    />
                    <label htmlFor="latePickup" className="text-sm font-medium text-gray-700">
                      Late Pick-up Available
                    </label>
                  </div>

                  {formData.latePickup && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Late Pick-up Time
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Start Time</label>
                            <Input
                              name="latePickupStartTime"
                              type="time"
                              value={formData.latePickupStartTime}
                              onChange={handleInputChange}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">End Time</label>
                            <Input
                              name="latePickupEndTime"
                              type="time"
                              value={formData.latePickupEndTime}
                              onChange={handleInputChange}
                            />
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Late Pick-up Price (£)
                        </label>
                        <Input
                          name="latePickupPrice"
                          type="number"
                          value={formData.latePickupPrice}
                          onChange={handleInputChange}
                          min="0"
                          step="0.01"
                        />
                      </div>
                    </div>
                  )}
                </div>
                  </>
                )}

                {/* Discounts Section */}
                <div className="border-t pt-4">
                  <h3 className="text-md font-semibold text-gray-900 mb-3">Discounts</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Sibling Discount (%)
                      </label>
                      <Input
                        name="siblingDiscount"
                        type="number"
                        value={formData.siblingDiscount}
                        onChange={handleInputChange}
                        min="0"
                        max="100"
                        step="0.01"
                        placeholder="0"
                      />
                    </div>
                    {formData.type !== 'course/program' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Weekly Discount (%)
                        </label>
                        <Input
                          name="weeklyDiscount"
                          type="number"
                          value={formData.weeklyDiscount}
                          onChange={handleInputChange}
                          min="0"
                          max="100"
                          step="0.01"
                          placeholder="0"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Full Holiday Discount (%)
                      </label>
                      <Input
                        name="bulkDiscount"
                        type="number"
                        value={formData.bulkDiscount}
                        onChange={handleInputChange}
                        min="0"
                        max="100"
                        step="0.01"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                {/* Custom Time Slots Section */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-md font-semibold text-gray-900">Custom Time Slots</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addCustomTimeSlot}
                      disabled={formData.customTimeSlots.length >= 3}
                    >
                      <PlusIcon className="h-4 w-4 mr-1" />
                      Add Slot
                    </Button>
                  </div>
                  
                  {formData.customTimeSlots.length === 0 && (
                    <p className="text-sm text-gray-500 mb-3">
                      Add up to 3 custom time slots for additional session options
                    </p>
                  )}

                  {formData.customTimeSlots.map((slot, index) => (
                    <div key={index} className="bg-gray-50 p-4 rounded-lg mb-3">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-gray-700">Custom Slot {index + 1}</h4>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeCustomTimeSlot(index)}
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Slot Name
                          </label>
                          <Input
                            value={slot.name}
                            onChange={(e) => updateCustomTimeSlot(index, 'name', e.target.value)}
                            placeholder="e.g., Extended Day"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Start Time
                          </label>
                          <Input
                            type="time"
                            value={slot.startTime}
                            onChange={(e) => updateCustomTimeSlot(index, 'startTime', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            End Time
                          </label>
                          <Input
                            type="time"
                            value={slot.endTime}
                            onChange={(e) => updateCustomTimeSlot(index, 'endTime', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Price (£)
                          </label>
                          <Input
                            type="number"
                            value={slot.price}
                            onChange={(e) => updateCustomTimeSlot(index, 'price', parseFloat(e.target.value) || 0)}
                            min="0"
                            step="0.01"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/business/activities')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Creating...
                </>
              ) : (
                <>
                  <CheckIcon className="h-5 w-5" />
                  Create Activity
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </BusinessLayout>
  );
};

export default CreateActivityPage;
