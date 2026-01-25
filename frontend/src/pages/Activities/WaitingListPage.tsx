import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeftIcon,
  ClockIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  MapPinIcon,
  CurrencyPoundIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/authService';
import { buildApiUrl } from '../../config/api';
import { toast } from 'react-hot-toast';

interface Activity {
  id: string;
  title: string;
  description: string;
  type: string;
  price: number;
  max_capacity: number;
  current_capacity: number;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  venue: {
    name: string;
    address: string;
  };
  daysOfWeek?: string[];
  durationWeeks?: number;
}

interface Child {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
}

const WaitingListPage: React.FC = () => {
  const { activityId } = useParams<{ activityId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [activity, setActivity] = useState<Activity | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (activityId) {
      fetchActivity();
      fetchChildren();
    }
  }, [activityId]);

  const fetchActivity = async () => {
    try {
      const response = await fetch(buildApiUrl(`/activities/${activityId}`));
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
      toast.error('Failed to load activity details');
      navigate('/activities');
    } finally {
      setLoading(false);
    }
  };

  const fetchChildren = async () => {
    try {
      const token = await authService.getToken();
      if (!token) {
        toast.error('Please login to view children');
        navigate('/login');
        return;
      }

      const response = await fetch(buildApiUrl('/children'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch children');
      }

      const result = await response.json();
      if (result.success && result.data) {
        setChildren(result.data);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Error fetching children:', error);
      toast.error('Failed to load children');
    }
  };

  const handleJoinWaitingList = async () => {
    if (!selectedChildId) {
      toast.error('Please select a child');
      return;
    }

    if (!activity) {
      toast.error('Activity information not available');
      return;
    }

    setSubmitting(true);
    try {
      const token = await authService.getToken();
      if (!token) {
        toast.error('Please log in to join waiting list');
        navigate('/login');
        return;
      }

      const response = await fetch(buildApiUrl('/bookings'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          activityId: activity.id,
          childId: selectedChildId,
          bookingType: 'waiting_list',
          notes: `WAITING_LIST: ${notes || 'No additional notes'}`,
          amount: 0, // No payment required for waiting list
          status: 'waiting_list'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to join waiting list');
      }

      const data = await response.json();
      
      if (data.success) {
        toast.success('Successfully added to waiting list! You will be notified when a space becomes available.');
        navigate('/bookings');
      } else {
        throw new Error(data.message || 'Failed to join waiting list');
      }
    } catch (error) {
      console.error('Error joining waiting list:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to join waiting list');
    } finally {
      setSubmitting(false);
    }
  };

  const getActivityTypeLabel = (type: string) => {
    switch (type) {
      case 'holiday_club':
        return 'Holiday Club';
      case 'activity':
        return 'Activity';
      case 'wraparound_care':
        return 'Wraparound Care';
      case 'course/program':
        return 'Course/Program';
      default:
        return 'Activity';
    }
  };

  const formatSchedule = () => {
    if (!activity) return '';
    
    if (activity.type === 'course/program' && activity.daysOfWeek && activity.daysOfWeek.length > 0) {
      const days = activity.daysOfWeek.map(day => day.charAt(0).toUpperCase() + day.slice(1)).join(', ');
      const duration = activity.durationWeeks || 1;
      return `Every ${days}, ${activity.startTime} - ${activity.endTime}, ${duration} sessions`;
    } else {
      const startDate = new Date(activity.startDate).toLocaleDateString();
      const endDate = activity.endDate ? new Date(activity.endDate).toLocaleDateString() : 'Ongoing';
      return `${startDate} - ${endDate}, ${activity.startTime} - ${activity.endTime}`;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00806a] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading activity details...</p>
        </div>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Activity Not Found</h2>
          <Button onClick={() => navigate('/activities')} className="bg-[#00806a] hover:bg-[#006b5a]">
            Back to Activities
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            onClick={() => navigate('/activities')}
            variant="outline"
            className="mb-4"
          >
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back to Activities
          </Button>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <ClockIcon className="w-6 h-6 text-yellow-600 mr-3" />
              <div>
                <h3 className="text-lg font-semibold text-yellow-800">Activity Fully Booked</h3>
                <p className="text-yellow-700">
                  This {getActivityTypeLabel(activity.type).toLowerCase()} is currently at full capacity. 
                  Join the waiting list to be notified when a space becomes available.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Activity Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CalendarDaysIcon className="w-5 h-5 mr-2" />
                Activity Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{activity.title}</h3>
                <p className="text-sm text-gray-600">{getActivityTypeLabel(activity.type)}</p>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center text-sm">
                  <MapPinIcon className="w-4 h-4 mr-2 text-gray-500" />
                  <span>{activity.venue.name}</span>
                </div>
                
                <div className="flex items-center text-sm">
                  <CalendarDaysIcon className="w-4 h-4 mr-2 text-gray-500" />
                  <span>{formatSchedule()}</span>
                </div>
                
                <div className="flex items-center text-sm">
                  <UserGroupIcon className="w-4 h-4 mr-2 text-gray-500" />
                  <span>Capacity: {activity.current_capacity}/{activity.max_capacity}</span>
                </div>
                
                <div className="flex items-center text-sm">
                  <CurrencyPoundIcon className="w-4 h-4 mr-2 text-gray-500" />
                  <span>Price: £{activity.price}</span>
                </div>
              </div>
              
              {activity.description && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Description</h4>
                  <p className="text-sm text-gray-600">{activity.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Waiting List Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CheckCircleIcon className="w-5 h-5 mr-2" />
                Join Waiting List
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Child
                </label>
                <select
                  value={selectedChildId}
                  onChange={(e) => setSelectedChildId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
                  required
                >
                  <option value="">Choose a child...</option>
                  {children.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.firstName} {child.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
                  placeholder="Any special requirements or notes..."
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">What happens next?</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• You'll be added to the waiting list for this activity</li>
                  <li>• We'll notify you immediately when a space becomes available</li>
                  <li>• You'll have 24 hours to confirm your booking</li>
                  <li>• No payment is required until you confirm your booking</li>
                </ul>
              </div>

              <Button
                onClick={handleJoinWaitingList}
                disabled={!selectedChildId || submitting}
                className="w-full bg-[#00806a] hover:bg-[#006b5a] disabled:opacity-50"
              >
                {submitting ? 'Adding to Waiting List...' : 'Join Waiting List'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default WaitingListPage;





