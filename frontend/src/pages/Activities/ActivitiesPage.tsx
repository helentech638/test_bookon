import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BookingWidget } from '../../components/booking/BookingWidget';
import { Activity, Venue } from '../../types/booking';
import AdminLayout from '../../components/layout/AdminLayout';
import { buildApiUrl } from '../../config/api';
import { authService } from '../../services/authService';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import {
  Search,
  Filter,
  MapPin,
  Clock,
  Users,
  Calendar,
  Tag,
  CalendarDays,
  DollarSign,
  User,
  Ticket
} from 'lucide-react';
import {
  ArrowLeftIcon,
  MapPinIcon,
  CalendarIcon,
  ClockIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  CurrencyDollarIcon,
  UserIcon,
  TicketIcon
} from '@heroicons/react/24/outline';

const ActivitiesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedVenue, setSelectedVenue] = useState<string>('');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 100]);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  // Function to toggle session expansion
  const toggleSessionExpansion = (activityId: string) => {
    setExpandedSessions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(activityId)) {
        newSet.delete(activityId);
      } else {
        newSet.add(activityId);
      }
      return newSet;
    });
  };

  // Function to format activity type for display
  const formatActivityType = (type: string): string => {
    if (!type) return 'Activity';

    const typeMap: { [key: string]: string } = {
      'holiday_club': 'Holiday Club',
      'wraparound_care': 'Wraparound Care',
      'after_school': 'After School',
      'sports': 'Sports',
      'arts_crafts': 'Arts & Crafts',
      'music': 'Music',
      'dance': 'Dance',
      'swimming': 'Swimming',
      'other': 'Other'
    };

    return typeMap[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Fetch real data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch activities
        const token = authService.getToken();
        if (!token) {
          toast.error('Please log in to view activities');
          navigate('/login');
          return;
        }

        // Add retry logic for 429 errors
        let retries = 3;
        let activitiesResponse;

        while (retries > 0) {
          try {
            activitiesResponse = await fetch(buildApiUrl('/activities'), {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });

            if (activitiesResponse.ok) {
              break;
            } else if (activitiesResponse.status === 429 && retries > 1) {
              // Wait before retrying
              await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries)));
              retries--;
              continue;
            } else {
              throw new Error('Failed to fetch activities');
            }
          } catch (error) {
            if (retries > 1) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              retries--;
              continue;
            }
            throw error;
          }
        }

        if (!activitiesResponse) {
          throw new Error('Failed to fetch activities after retries');
        }

        const activitiesData = await activitiesResponse.json();

        if (activitiesData.success) {
          // Transform backend data to frontend format
          const transformedActivities: Activity[] = activitiesData.data.map((activity: any) => ({
            id: activity.id.toString(),
            name: activity.title,
            description: activity.description || 'No description available',
            category: formatActivityType(activity.type) || 'Activity',
            type: activity.type, // Preserve original type for routing
            venue_id: activity.venue_id || activity.venueId?.toString() || '1',
            max_capacity: activity.max_capacity || activity.capacity || 10,
            current_capacity: activity.current_capacity || 0,
            price: parseFloat(activity.price) || 0,
            duration: 60, // Default duration since backend doesn't have this field
            age_range: (() => {
              // Handle different ageRange formats from backend
              const ageRange = activity.age_range || activity.ageRange;
              if (!ageRange) return { min: 5, max: 16 };

              // If it's already an object
              if (typeof ageRange === 'object' && ageRange.min && ageRange.max) {
                return ageRange;
              }

              // If it's a string like "5-16" or "5 to 16"
              if (typeof ageRange === 'string') {
                const numbers = ageRange.match(/\d+/g);
                if (numbers && numbers.length >= 2) {
                  return { min: parseInt(numbers[0]), max: parseInt(numbers[1]) };
                }
              }

              return { min: 5, max: 16 };
            })(),
            skill_level: 'All Levels', // Default skill level
            instructor: 'TBD', // Default instructor
            is_active: activity.is_active !== undefined ? activity.is_active : activity.isActive,
            start_date: activity.start_date ? new Date(activity.start_date).toISOString().split('T')[0] : (activity.startDate ? new Date(activity.startDate).toISOString().split('T')[0] : '2024-01-01'),
            end_date: activity.end_date ? new Date(activity.end_date).toISOString().split('T')[0] : (activity.endDate ? new Date(activity.endDate).toISOString().split('T')[0] : '2024-12-31'),
            start_time: activity.start_time || activity.startTime || '',
            end_time: activity.end_time || activity.endTime || '',
            // Holiday Club specific fields
            holidayTimeSlots: activity.holidayTimeSlots || [],
            // Wraparound Care specific fields
            sessionBlocks: activity.sessionBlocks || [],
            isWraparoundCare: activity.isWraparoundCare || false,
            // Course/Program specific fields
            durationWeeks: activity.durationWeeks || activity.duration_weeks || null,
            duration_weeks: activity.duration_weeks || activity.durationWeeks || null,
            regularDay: activity.regularDay || activity.regular_day || null,
            regularTime: activity.regularTime || activity.regular_time || null,
            daysOfWeek: activity.daysOfWeek || [],
            courseExcludeDates: activity.courseExcludeDates || [],
            images: activity.imageUrls && activity.imageUrls.length > 0 ? activity.imageUrls : ['/images/default-activity.jpg'],
            proRataBooking: activity.proRataBooking || false,
            holidaySessions: activity.holidaySessions || false,
            rating: activity.rating || null,
            reviewCount: activity.reviewCount || 0,
            created_at: activity.createdAt || '2024-01-01T00:00:00Z',
            updated_at: activity.updatedAt || '2024-01-01T00:00:00Z'
          }));

          setActivities(transformedActivities);
        } else {
          throw new Error(activitiesData.message || 'Failed to fetch activities');
        }

        // Fetch venues from API with retry logic
        try {
          let venuesRetries = 3;
          let venuesResponse;

          while (venuesRetries > 0) {
            try {
              venuesResponse = await fetch(buildApiUrl('/venues'), {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              });

              if (venuesResponse.ok) {
                break;
              } else if (venuesResponse.status === 429 && venuesRetries > 1) {
                await new Promise(resolve => setTimeout(resolve, 1000 * (4 - venuesRetries)));
                venuesRetries--;
                continue;
              } else {
                break; // Non-429 error, don't retry
              }
            } catch (error) {
              if (venuesRetries > 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                venuesRetries--;
                continue;
              }
              break; // exit loop if all retries exhausted
            }
          }

          if (venuesResponse && venuesResponse.ok) {
            const venuesData = await venuesResponse.json();
            if (venuesData.success && Array.isArray(venuesData.data)) {
              setVenues(venuesData.data);
            } else {
              setVenues([]);
            }
          } else {
            setVenues([]);
          }
        } catch (error) {
          setVenues([]);
        }

      } catch (error) {
        toast.error('Failed to load activities. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  const categories = ['All', 'Activity', 'Holiday Club', 'Wraparound Care'];
  const venueOptions = ['All', ...venues.map(v => v.name)];

  const filteredActivities = activities.filter(activity => {
    const matchesSearch = activity.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (activity.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || selectedCategory === 'All' || activity.category === selectedCategory;
    const matchesVenue = !selectedVenue || selectedVenue === 'All' ||
      venues.find(v => v.id === activity.venue_id)?.name === selectedVenue;
    const matchesPrice = activity.price >= priceRange[0] && activity.price <= priceRange[1];

    return matchesSearch && matchesCategory && matchesVenue && matchesPrice;
  });

  const handleBookActivity = (activityId: string, activityType?: string) => {
    // Find the activity to check if it's fully booked
    const activity = activities.find(a => a.id === activityId);
    const isFullyBooked = activity && activity.max_capacity && activity.current_capacity !== undefined &&
      (activity.max_capacity - activity.current_capacity) <= 0;

    if (isFullyBooked) {
      // Navigate to waiting list page for any activity type
      navigate(`/activities/${activityId}/waiting-list`);
    } else {
      // Normal booking flow
      if (activityType === 'holiday_club') {
        navigate(`/activities/${activityId}/holiday-club-booking`);
      } else if (activityType === 'activity') {
        navigate(`/activities/${activityId}/activity-booking`);
      } else if (activityType === 'wraparound_care') {
        navigate(`/activities/${activityId}/wraparound-booking`);
      } else if (activityType === 'course/program') {
        navigate(`/activities/${activityId}/course-booking`);
      } else {
        navigate(`/bookings/flow/${activityId}`);
      }
    }
  };

  // Render content based on user role
  const renderContent = () => (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <Link
              to="/parent/dashboard"
              className="flex items-center text-gray-600 hover:text-[#00806a] transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5 mr-2" />
              <span className="font-medium">Back to Dashboard</span>
            </Link>
            <div className="h-6 w-px bg-gray-300"></div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Activities</h1>
          <p className="text-gray-600">Discover and book activities for your children</p>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  placeholder="Search activities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                title="Select category"
              >
                <option value="">All Categories</option>
                {categories.slice(1).map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>

              <select
                value={selectedVenue}
                onChange={(e) => setSelectedVenue(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                title="Select venue"
              >
                <option value="">All Venues</option>
                {venueOptions.slice(1).map(venue => (
                  <option key={venue} value={venue}>{venue}</option>
                ))}
              </select>

              <Button variant="outline" className="px-4 py-3">
                <Filter className="h-5 w-5 mr-2" />
                More Filters
              </Button>
            </div>
          </div>

          {/* Price Range */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">Price Range:</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={priceRange[0]}
                onChange={(e) => setPriceRange([parseInt(e.target.value) || 0, priceRange[1]])}
                className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Min"
              />
              <span className="text-gray-500">-</span>
              <input
                type="number"
                value={priceRange[1]}
                onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value) || 100])}
                className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Max"
              />
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-6">
          <p className="text-gray-600">
            Showing {filteredActivities.length} of {activities.length} activities
          </p>
        </div>

        {/* Activities Grid */}
        {filteredActivities.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Calendar className="h-16 w-16 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No activities found</h3>
            <p className="text-gray-600 mb-6">Try adjusting your search criteria or filters</p>
            <Button onClick={() => {
              setSearchTerm('');
              setSelectedCategory('');
              setSelectedVenue('');
              setPriceRange([0, 100]);
            }}>
              Clear Filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredActivities.map((activity) => {
              return (
                <Card key={activity.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="relative w-full h-40 sm:h-48 bg-gray-200 overflow-hidden">
                    <img
                      src={activity.images?.[0] || '/images/default-activity.jpg'}
                      alt={activity.name}
                      className="w-full h-full object-contain object-center min-h-[160px]"
                      onError={(e) => {
                        e.currentTarget.src = '/images/default-activity.jpg';
                      }}
                    />
                  </div>

                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          {activity.name}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Tag className="h-4 w-4" />
                          <span>{activity.category}</span>
                        </div>
                        {/* Pro Rata Indicator */}
                        {activity.proRataBooking && (
                          <div className="mt-1">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                              <CalendarDays className="h-3 w-3 mr-1" />
                              Pro Rata Billing
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-600">
                          from £{Number(activity.price).toFixed(2)}
                        </div>
                        <div className="text-sm text-gray-500">per session</div>
                      </div>
                    </div>

                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                      {activity.description || 'No description available'}
                    </p>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin className="h-4 w-4" />
                        <span>{venues.find(v => v.id === activity.venue_id)?.name || 'Unknown Venue'}</span>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {activity.start_date && activity.end_date
                            ? (() => {
                              try {
                                const startDate = new Date(activity.start_date);
                                const endDate = new Date(activity.end_date);
                                if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                                  return 'Dates TBD';
                                }
                                // If dates are the same, show only one date
                                if (startDate.toDateString() === endDate.toDateString()) {
                                  return startDate.toLocaleDateString();
                                }
                                return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
                              } catch (error) {
                                return 'Dates TBD';
                              }
                            })()
                            : 'Dates TBD'
                          }
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="h-4 w-4" />
                        <span>
                          {activity.start_time && activity.end_time
                            ? `${activity.start_time} - ${activity.end_time}`
                            : 'Times TBD'
                          }
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Users className="h-4 w-4" />
                        <span>
                          {activity.current_capacity >= activity.max_capacity
                            ? 'Join Waiting List'
                            : 'Spaces Available'
                          }
                        </span>
                      </div>

                      {/* Show age range for Holiday Club and Activity */}
                      {activity.age_range && (
                        <div className="mt-2">
                          <div className="text-xs font-medium text-gray-700 mb-1">Activity Details:</div>
                          <div className="text-xs text-gray-600">
                            <span className="font-medium">Age Range:</span> {activity.age_range.min}-{activity.age_range.max} years
                          </div>
                        </div>
                      )}

                      {/* Pro Rata Billing Information */}
                      {activity.proRataBooking && (
                        <div className="mt-2">
                          <div className="bg-teal-50 border border-teal-200 rounded-lg p-2">
                            <div className="flex items-center text-xs text-teal-800">
                              <CalendarDays className="h-3 w-3 mr-1" />
                              <span className="font-medium">Pro Rata Billing Enabled</span>
                            </div>
                            <div className="text-xs text-teal-700 mt-1">
                              Only pay for remaining sessions when booking mid-course
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Show individual session dates for Holiday Club and Activity */}
                      {((activity.type === 'holiday_club' || activity.type === 'activity') && activity.schedule && Object.keys(activity.schedule).length > 0) && (
                        <div className="mt-3">
                          <div className="text-xs font-medium text-gray-700 mb-2">Schedule:</div>
                          <div className="space-y-1">
                            <div className="text-xs bg-teal-50 text-teal-700 px-2 py-1 rounded">
                              Check booking page for available dates
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Show Holiday Club and Activity time slots if available */}
                      {activity.holidayTimeSlots && activity.holidayTimeSlots.length > 0 && (
                        <div className="mt-3">
                          <div className="bg-gradient-to-r from-[#00806a] to-[#00a085] p-3 rounded-lg text-white">
                            <div className="text-sm font-medium text-white mb-2 flex items-center">
                              <CalendarDaysIcon className="w-4 h-4 mr-2" />
                              Available Sessions:
                            </div>
                            <div className="space-y-1">
                              {activity.holidayTimeSlots.slice(0, expandedSessions.has(activity.id) ? activity.holidayTimeSlots.length : 3).map((slot: any, index: number) => (
                                <div
                                  key={index}
                                  className="flex items-center justify-between text-xs bg-white/20 rounded px-2 py-1"
                                >
                                  <span className="font-medium text-white">{slot.name}</span>
                                  <span className="text-white/80">{slot.startTime} - {slot.endTime}</span>
                                </div>
                              ))}
                              {activity.holidayTimeSlots.length > 3 && (
                                <div className="text-xs text-center py-2">
                                  <button
                                    onClick={() => toggleSessionExpansion(activity.id)}
                                    className="inline-flex items-center px-2 py-1 rounded-full bg-white/20 text-white border border-white/30 hover:bg-white/30 transition-colors cursor-pointer"
                                  >
                                    <span className="font-medium">
                                      {expandedSessions.has(activity.id) ? 'Show Less' : `+${activity.holidayTimeSlots.length - 3}`}
                                    </span>
                                    <span className="ml-1">
                                      {expandedSessions.has(activity.id) ? '' : 'more sessions'}
                                    </span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Fallback: Show basic session info for Activity type without detailed slots */}
                      {(activity.type === 'activity' && (!activity.holidayTimeSlots || activity.holidayTimeSlots.length === 0)) && (
                        <div className="mt-3">
                          <div className="bg-gradient-to-r from-[#00806a] to-[#00a085] p-3 rounded-lg text-white">
                            <div className="text-sm font-medium text-white mb-2 flex items-center">
                              <CalendarDaysIcon className="w-4 h-4 mr-2" />
                              Available Sessions:
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs bg-white/20 rounded px-2 py-1">
                                <span className="font-medium text-white">Standard Day</span>
                                <span className="text-white/80">{activity.start_time} - {activity.end_time}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Show Wraparound Care session blocks if available */}
                      {activity.sessionBlocks && activity.sessionBlocks.length > 0 && (
                        <div className="mt-3">
                          <div className="bg-gradient-to-r from-[#00806a] to-[#00a085] p-3 rounded-lg text-white">
                            <div className="text-sm font-medium text-white mb-2 flex items-center">
                              <CalendarDaysIcon className="w-4 h-4 mr-2" />
                              Available Sessions:
                            </div>
                            <div className="space-y-1">
                              {activity.sessionBlocks.slice(0, expandedSessions.has(activity.id) ? activity.sessionBlocks.length : 3).map((block: any, index: number) => (
                                <div
                                  key={index}
                                  className="flex items-center justify-between text-xs bg-white/20 rounded px-2 py-1"
                                >
                                  <span className="font-medium text-white">{block.name}</span>
                                  <span className="text-white/80">{block.startTime} - {block.endTime}</span>
                                </div>
                              ))}
                              {activity.sessionBlocks.length > 3 && (
                                <div className="text-xs text-center py-2">
                                  <button
                                    onClick={() => toggleSessionExpansion(activity.id)}
                                    className="inline-flex items-center px-2 py-1 rounded-full bg-white/20 text-white border border-white/30 hover:bg-white/30 transition-colors cursor-pointer"
                                  >
                                    <span className="font-medium">
                                      {expandedSessions.has(activity.id) ? 'Show Less' : `+${activity.sessionBlocks.length - 3}`}
                                    </span>
                                    <span className="ml-1">
                                      {expandedSessions.has(activity.id) ? '' : 'more sessions'}
                                    </span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Show Course/Program information */}
                      {activity.type === 'course/program' && (
                        <div className="mt-3">
                          <div className="bg-gradient-to-r from-[#00806a] to-[#00a085] p-3 rounded-lg text-white">
                            <div className="text-sm font-semibold mb-2">Course Details</div>
                            <div className="space-y-1">
                              {/* Description */}
                              <div className="flex justify-between text-xs">
                                <span className="text-white/80 flex items-center">
                                  <Tag className="w-3 h-3 mr-1" />
                                  Description:
                                </span>
                                <span className="font-medium text-white">
                                  {activity.description || 'No description available'}
                                </span>
                              </div>

                              {/* Location */}
                              <div className="flex justify-between text-xs">
                                <span className="text-white/80 flex items-center">
                                  <MapPinIcon className="w-3 h-3 mr-1" />
                                  Location:
                                </span>
                                <span className="font-medium text-white">
                                  {(() => {
                                    const venue = venues.find(v => v.id === activity.venue_id);
                                    return venue ? venue.name : 'Venue TBD';
                                  })()}
                                </span>
                              </div>

                              {/* Dates */}
                              <div className="flex justify-between text-xs">
                                <span className="text-white/80 flex items-center">
                                  <CalendarIcon className="w-3 h-3 mr-1" />
                                  Dates:
                                </span>
                                <span className="font-medium text-white">
                                  {activity.start_date && activity.end_date ?
                                    `${new Date(activity.start_date).toLocaleDateString()} - ${new Date(activity.end_date).toLocaleDateString()}` :
                                    'TBD'}
                                </span>
                              </div>

                              {/* Day and Times */}
                              <div className="flex justify-between text-xs">
                                <span className="text-white/80 flex items-center">
                                  <ClockIcon className="w-3 h-3 mr-1" />
                                  Schedule:
                                </span>
                                <span className="font-medium text-white">
                                  {(() => {

                                    if (activity.type === 'course/program' && activity.daysOfWeek && activity.daysOfWeek.length > 0) {
                                      const daysText = activity.daysOfWeek.map(day => day.charAt(0).toUpperCase() + day.slice(1)).join(', ');
                                      const timeText = activity.start_time && activity.end_time ?
                                        `${activity.start_time} - ${activity.end_time}` : 'TBD';
                                      return `${daysText} ${timeText}`;
                                    } else {
                                      const dayText = activity.regular_day || activity.regularDay ||
                                        (activity.start_date ?
                                          new Date(activity.start_date).toLocaleDateString('en-US', { weekday: 'long' }) :
                                          'TBD');
                                      const timeText = activity.regular_time || activity.regularTime ||
                                        (activity.start_time && activity.end_time ?
                                          `${activity.start_time} - ${activity.end_time}` :
                                          'TBD');
                                      return `${dayText} ${timeText}`;
                                    }
                                  })()}
                                </span>
                              </div>


                              {/* Sessions Remaining */}
                              <div className="flex justify-between text-xs">
                                <span className="text-white/80 flex items-center">
                                  <CalendarDaysIcon className="w-3 h-3 mr-1" />
                                  Sessions:
                                </span>
                                <span className="font-medium text-yellow-300">
                                  {(() => {

                                    // Use durationWeeks if available (from backend calculation)
                                    if (activity.duration_weeks || activity.durationWeeks) {
                                      return `${activity.duration_weeks || activity.durationWeeks} sessions total`;
                                    }

                                    return 'Sessions TBD';
                                  })()}
                                </span>
                              </div>

                              {/* Age Range */}
                              <div className="flex justify-between text-xs">
                                <span className="text-white/80 flex items-center">
                                  <UserGroupIcon className="w-3 h-3 mr-1" />
                                  Age:
                                </span>
                                <span className="font-medium text-white">
                                  {activity.age_range?.min && activity.age_range?.max ?
                                    `${activity.age_range.min}-${activity.age_range.max} years` :
                                    'All ages'}
                                </span>
                              </div>

                              {/* Total Cost */}
                              {(() => {
                                // Calculate duration using the same logic as sessions
                                let duration = null;

                                // Use durationWeeks if available (from backend calculation)
                                if (activity.duration_weeks || activity.durationWeeks) {
                                  duration = activity.duration_weeks || activity.durationWeeks;
                                }
                                // Calculate sessions based on selected days of the week
                                else if (activity.start_date && activity.end_date && activity.daysOfWeek && activity.daysOfWeek.length > 0) {
                                  const startDate = new Date(activity.start_date);
                                  const endDate = new Date(activity.end_date);
                                  let totalSessions = 0;

                                  // Calculate sessions for each selected day
                                  activity.daysOfWeek.forEach((dayName: string) => {
                                    const capitalizedDayName = dayName.charAt(0).toUpperCase() + dayName.slice(1);
                                    const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(capitalizedDayName);

                                    // Find first occurrence of this day within date range
                                    const firstSessionDate = new Date(startDate);
                                    const daysUntilFirstSession = (dayOfWeek - startDate.getDay() + 7) % 7;
                                    firstSessionDate.setDate(startDate.getDate() + daysUntilFirstSession);

                                    // If first session date is before start date, move to next week
                                    if (firstSessionDate < startDate) {
                                      firstSessionDate.setDate(firstSessionDate.getDate() + 7);
                                    }

                                    // Count sessions for this day within date range
                                    let currentSessionDate = new Date(firstSessionDate);
                                    while (currentSessionDate <= endDate) {
                                      totalSessions++;
                                      currentSessionDate.setDate(currentSessionDate.getDate() + 7);
                                    }
                                  });

                                  duration = totalSessions;
                                }
                                // Fallback to simple week calculation
                                else if (activity.start_date && activity.end_date) {
                                  duration = Math.ceil((new Date(activity.end_date).getTime() - new Date(activity.start_date).getTime()) / (1000 * 60 * 60 * 24 * 7));
                                }

                                return duration && (
                                  <div className="flex justify-between text-xs border-t border-white/20 pt-1 mt-1">
                                    <span className="text-white/80 flex items-center">
                                      <CurrencyDollarIcon className="w-3 h-3 mr-1" />
                                      Total Cost:
                                    </span>
                                    <span className="font-bold text-yellow-300">
                                      £{(duration * Number(activity.price || 0)).toFixed(2)}
                                    </span>
                                  </div>
                                );
                              })()}

                              {/* Spaces Available */}
                              <div className="flex justify-between text-xs">
                                <span className="text-white/80 flex items-center">
                                  <UserIcon className="w-3 h-3 mr-1" />
                                  Spaces:
                                </span>
                                <span className="font-medium text-white">
                                  {activity.max_capacity && activity.current_capacity !== undefined ?
                                    `${Math.max(0, activity.max_capacity - activity.current_capacity)} available` :
                                    'Check availability'}
                                </span>
                              </div>

                            </div>
                          </div>
                        </div>
                      )}

                      {/* Pro Rata Status - Show for all activity types */}
                      <div className="mt-3">
                        <div className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                          <span className="text-sm text-gray-600 flex items-center">
                            <TicketIcon className="w-4 h-4 mr-2" />
                            Booking Type:
                          </span>
                          <span className={`text-sm font-medium px-2 py-1 rounded-full ${activity.proRataBooking
                            ? 'bg-green-100 text-green-800'
                            : 'bg-teal-100 text-teal-800'
                            }`}>
                            {activity.proRataBooking ? 'Pro-rata Available' : 'Full Booking Only'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <Button
                        onClick={() => handleBookActivity(activity.id, activity.type)}
                        className="px-6 py-3 font-semibold text-white rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105 hover:shadow-xl bg-gradient-to-r from-[#00806a] to-[#00a085] hover:from-[#006b5a] hover:to-[#008a73]"
                      >
                        {(() => {
                          // Check if activity is fully booked
                          const isFullyBooked = activity.max_capacity && activity.current_capacity !== undefined &&
                            (activity.max_capacity - activity.current_capacity) <= 0;

                          if (isFullyBooked) {
                            return 'Add to Waiting List';
                          }

                          // Return appropriate booking text based on activity type
                          switch (activity.type) {
                            case 'holiday_club':
                              return 'Book Holiday Club';
                            case 'activity':
                              return 'Book Activity';
                            case 'wraparound_care':
                              return 'Book Wraparound Care';
                            case 'course/program':
                              return 'Book Course';
                            default:
                              return 'Book Now';
                          }
                        })()}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-gray-200 rounded-lg h-64"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // For admin users, wrap with AdminLayout, otherwise return content directly
  if (user?.role === 'admin') {
    return (
      <AdminLayout title="Activities">
        <div className="p-6">
          {renderContent()}
        </div>
      </AdminLayout>
    );
  }

  return renderContent();
};

export default ActivitiesPage;