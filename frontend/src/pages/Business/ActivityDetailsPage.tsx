import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeftIcon,
  CalendarDaysIcon,
  ClockIcon,
  MapPinIcon,
  UserGroupIcon,
  CurrencyPoundIcon,
  PencilIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import BusinessLayout from '../../components/layout/BusinessLayout';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/authService';
import { buildApiUrl } from '../../config/api';
import { toast } from 'react-hot-toast';

interface Activity {
  id: string;
  title: string;
  type: string;
  description: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  price: number;
  capacity: number;
  booked: number;
  status: string;
  venue: {
    id: string;
    name: string;
    address: string;
  };
  // Holiday Club specific fields
  ageRange?: string;
  whatToBring?: string;
  earlyDropoff: boolean;
  earlyDropoffPrice?: number;
  latePickup: boolean;
  latePickupPrice?: number;
  siblingDiscount?: number;
  bulkDiscount?: number;
  weeklyDiscount?: number;
  excludeDates?: string[];
  holidayTimeSlots?: Array<{
    id: string;
    name: string;
    startTime: string;
    endTime: string;
    price: number;
    capacity: number;
    bookingsCount: number;
  }>;
  // Wraparound Care specific fields
  isWraparoundCare: boolean;
  yearGroups?: string[];
  sessionBlocks?: Array<{
    id: string;
    name: string;
    startTime: string;
    endTime: string;
    capacity: number;
    price: number;
    bookingsCount: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

const ActivityDetailsPage: React.FC = () => {
  const { activityId } = useParams<{ activityId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activityId) {
      fetchActivity();
    }
  }, [activityId]);

  const fetchActivity = async () => {
    try {
      setLoading(true);
      const token = authService.getToken();
      
      if (!token) {
        toast.error('Please log in to view activity details');
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
        setActivity(data.data);
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

  const handleEdit = () => {
    navigate(`/business/activities/${activityId}/edit`);
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this activity? This action cannot be undone.')) {
      return;
    }

    try {
      const token = authService.getToken();
      const response = await fetch(buildApiUrl(`/business/activities/${activityId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete activity');
      }

      const data = await response.json();
      
      if (data.success) {
        toast.success('Activity deleted successfully');
        navigate('/business/activities');
      } else {
        throw new Error(data.message || 'Failed to delete activity');
      }
    } catch (error) {
      console.error('Delete activity error:', error);
      toast.error('Failed to delete activity');
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

  if (!activity) {
    return (
      <BusinessLayout >
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Activity not found</h2>
          <Button onClick={() => navigate('/business/activities')}>
            Back to Activities
          </Button>
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
              onClick={() => navigate('/business/activities')}
            >
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to Activities
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{activity.title}</h1>
              <p className="text-gray-600 capitalize">{activity.type.replace('_', ' ')}</p>
            </div>
          </div>
          
          <div className="flex space-x-3">
            <Button onClick={handleEdit} className="bg-[#00806a] hover:bg-[#006d5a]">
              <PencilIcon className="h-4 w-4 mr-2" />
              Edit Activity
            </Button>
            <Button 
              onClick={handleDelete} 
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-50"
            >
              <TrashIcon className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center space-x-2">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            activity.status === 'active' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-gray-100 text-gray-800'
          }`}>
            {activity.status}
          </span>
          <span className="text-sm text-gray-500">
            Created {new Date(activity.createdAt).toLocaleDateString()}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{activity.title}</h3>
                  <p className="text-gray-600 mt-1">{activity.description || 'No description provided'}</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <MapPinIcon className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium">{activity.venue.name}</p>
                      <p className="text-sm text-gray-600">{activity.venue.address}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <CalendarDaysIcon className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium">
                        {new Date(activity.startDate).toLocaleDateString()} - {new Date(activity.endDate).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-600">Duration</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <ClockIcon className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium">{activity.startTime} - {activity.endTime}</p>
                      <p className="text-sm text-gray-600">Daily Schedule</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <CurrencyPoundIcon className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium">£{Number(activity.price).toFixed(2)}</p>
                      <p className="text-sm text-gray-600">Per session</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Capacity Information */}
            <Card>
              <CardHeader>
                <CardTitle>Capacity & Bookings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Total Capacity</span>
                    <span className="text-sm text-gray-900">{activity.capacity}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Booked</span>
                    <span className="text-sm text-gray-900">{activity.booked}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Available</span>
                    <span className="text-sm text-gray-900">{activity.capacity - activity.booked}</span>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-2 relative overflow-hidden">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        activity.booked > activity.capacity
                          ? 'bg-red-600' 
                          : 'bg-[#00806a]'
                      }`}
                      style={{ 
                        width: `${Math.min((activity.booked / activity.capacity) * 100, 100)}%` 
                      }}
                    ></div>
                    {/* Overcapacity indicator */}
                    {activity.booked > activity.capacity && (
                      <div className="absolute top-0 right-0 h-2 w-1 bg-red-800 rounded-r-full"></div>
                    )}
                  </div>
                  
                  <p className={`text-sm text-center ${
                    activity.booked > activity.capacity 
                      ? 'text-red-600 font-semibold' 
                      : 'text-gray-600'
                  }`}>
                    {Math.round((activity.booked / activity.capacity) * 100)}% capacity used
                    {activity.booked > activity.capacity && ' (Overbooked)'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Activity & Holiday Club Specific Information */}
            {(activity.type === 'holiday_club' || activity.type === 'activity') && (
              <Card>
                <CardHeader>
                  <CardTitle>Activity Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {activity.ageRange && (
                    <div>
                      <h4 className="font-medium text-gray-900">Age Range</h4>
                      <p className="text-gray-600">{activity.ageRange}</p>
                    </div>
                  )}
                  
                  {activity.whatToBring && (
                    <div>
                      <h4 className="font-medium text-gray-900">What to Bring</h4>
                      <p className="text-gray-600">{activity.whatToBring}</p>
                    </div>
                  )}
                  
                  {(activity.earlyDropoff || activity.latePickup) && (
                    <div>
                      <h4 className="font-medium text-gray-900">Extended Hours</h4>
                      <div className="space-y-2">
                        {activity.earlyDropoff && (
                          <p className="text-sm text-gray-600">
                            Early Drop-off: £{activity.earlyDropoffPrice || 0}
                          </p>
                        )}
                        {activity.latePickup && (
                          <p className="text-sm text-gray-600">
                            Late Pick-up: £{activity.latePickupPrice || 0}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {(activity.siblingDiscount || activity.weeklyDiscount || activity.bulkDiscount) && (
                    <div>
                      <h4 className="font-medium text-gray-900">Discounts</h4>
                      <div className="space-y-1">
                        {activity.siblingDiscount && (
                          <p className="text-sm text-gray-600">Sibling Discount: {activity.siblingDiscount}%</p>
                        )}
                        {activity.weeklyDiscount && (
                          <p className="text-sm text-gray-600">Weekly Discount: {activity.weeklyDiscount}%</p>
                        )}
                        {activity.bulkDiscount && (
                          <p className="text-sm text-gray-600">Full Holiday Discount: {activity.bulkDiscount}%</p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {activity.holidayTimeSlots && activity.holidayTimeSlots.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900">Custom Time Slots</h4>
                      <div className="space-y-2">
                        {activity.holidayTimeSlots.map((slot) => (
                          <div key={slot.id} className="bg-gray-50 p-3 rounded-lg">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-medium">{slot.name}</p>
                                <p className="text-sm text-gray-600">{slot.startTime} - {slot.endTime}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium">£{Number(slot.price).toFixed(2)}</p>
                                <p className="text-sm text-gray-600">{slot.bookingsCount}/{slot.capacity}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Wraparound Care Specific Information */}
            {activity.isWraparoundCare && (
              <Card>
                <CardHeader>
                  <CardTitle>Wraparound Care Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {activity.yearGroups && activity.yearGroups.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900">Year Groups</h4>
                      <p className="text-gray-600">{activity.yearGroups.join(', ')}</p>
                    </div>
                  )}
                  
                  {activity.sessionBlocks && activity.sessionBlocks.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900">Session Blocks</h4>
                      <div className="space-y-2">
                        {activity.sessionBlocks.map((block) => (
                          <div key={block.id} className="bg-gray-50 p-3 rounded-lg">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-medium">{block.name}</p>
                                <p className="text-sm text-gray-600">{block.startTime} - {block.endTime}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium">£{Number(block.price).toFixed(2)}</p>
                                <p className="text-sm text-gray-600">{block.bookingsCount}/{block.capacity}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  onClick={handleEdit} 
                  className="w-full bg-[#00806a] hover:bg-[#006d5a]"
                >
                  <PencilIcon className="h-4 w-4 mr-2" />
                  Edit Activity
                </Button>
                
                <Button 
                  onClick={() => navigate('/business/activities')} 
                  variant="outline" 
                  className="w-full"
                >
                  Back to Activities
                </Button>
              </CardContent>
            </Card>

            {/* Activity Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Activity Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Capacity</span>
                  <span className="font-medium">{activity.capacity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Booked</span>
                  <span className="font-medium">{activity.booked}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Available</span>
                  <span className="font-medium">{activity.capacity - activity.booked}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Utilization</span>
                  <span className="font-medium">{Math.round((activity.booked / activity.capacity) * 100)}%</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </BusinessLayout>
  );
};

export default ActivityDetailsPage;
