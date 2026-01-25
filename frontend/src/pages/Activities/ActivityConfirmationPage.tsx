import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeftIcon, CalendarIcon, ClockIcon, MapPinIcon, UserIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { authService } from '../../services/authService';
import { buildApiUrl } from '../../config/api';

interface Activity {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  capacity: number;
  price: number;
  status: string;
  whatToBring?: string;
  venue: {
    id: string;
    name: string;
    address: string;
    city: string;
    postcode: string;
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
  school?: string;
  class?: string;
}

const ActivityConfirmationPage: React.FC = () => {
  const { activityId } = useParams<{ activityId: string }>();
  const navigate = useNavigate();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch activity details
        const activityResponse = await fetch(buildApiUrl(`/activities/${activityId}`), {
          headers: {
            'Authorization': `Bearer ${authService.getToken()}`
          }
        });
        
        if (!activityResponse.ok) {
          throw new Error('Failed to fetch activity');
        }
        
        const activityData = await activityResponse.json();
        setActivity(activityData.data);

        // Fetch user's children
        const childrenResponse = await fetch(buildApiUrl('/children'), {
          headers: {
            'Authorization': `Bearer ${authService.getToken()}`
          }
        });
        
        if (!childrenResponse.ok) {
          throw new Error('Failed to fetch children');
        }
        
        const childrenData = await childrenResponse.json();
        setChildren(childrenData.data);
        
        // Auto-select first child if only one
        if (childrenData.data.length === 1) {
          setSelectedChildId(childrenData.data[0].id);
        }
        
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load activity details');
      } finally {
        setIsLoading(false);
      }
    };

    if (activityId) {
      fetchData();
    }
  }, [activityId]);

  const handleContinue = () => {
    if (!activityId) {
      setError('No activity ID provided');
      return;
    }
    
    if (!selectedChildId) {
      setError('Please select a child');
      return;
    }
    
    // Navigate to checkout with selected child
    navigate(`/checkout/${activityId}?childId=${selectedChildId}`);
  };

  const selectedChild = children.find(child => child.id === selectedChildId);

  // Early return if no activityId
  if (!activityId) {
    return (
      <div className="min-h-screen bg-white">
        <div className="flex items-center justify-center h-screen px-4">
          <div className="text-center">
            <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Invalid Activity</h2>
            <p className="text-gray-600 mb-4">No activity ID provided.</p>
            <Button onClick={() => navigate('/activities')}>
              Back to Activities
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00806a]"></div>
        </div>
      </div>
    );
  }

  if (error || !activity) {
    return (
      <div className="min-h-screen bg-white">
        <div className="flex items-center justify-center h-screen px-4">
          <div className="text-center">
            <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
            <p className="text-gray-600 mb-4">{error || 'Activity not found'}</p>
            <Button onClick={() => navigate('/activities')}>
              Back to Activities
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Mobile Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2"
        >
          <ArrowLeftIcon className="h-6 w-6 text-gray-600" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900">Activity Confirmation</h1>
        <div className="w-10"></div> {/* Spacer for centering */}
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Activity Details Card */}
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">{activity.title}</h2>
              <p className="text-gray-600">{activity.description}</p>
            </div>

            {/* Activity Info */}
            <div className="space-y-3">
              <div className="flex items-center text-gray-600">
                <CalendarIcon className="h-5 w-5 mr-3 text-[#00806a]" />
                <span>{new Date(activity.startDate).toLocaleDateString('en-GB', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</span>
              </div>
              
              <div className="flex items-center text-gray-600">
                <ClockIcon className="h-5 w-5 mr-3 text-[#00806a]" />
                <span>{activity.startTime} - {activity.endTime}</span>
              </div>
              
              <div className="flex items-center text-gray-600">
                <MapPinIcon className="h-5 w-5 mr-3 text-[#00806a]" />
                <div>
                  <div className="font-medium">{activity.venue.name}</div>
                  <div className="text-sm">{activity.venue.address}, {activity.venue.city} {activity.venue.postcode}</div>
                </div>
              </div>
            </div>

            {/* What to Bring */}
            {activity.whatToBring && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <h3 className="font-medium text-blue-900 mb-2">What to Bring</h3>
                <p className="text-blue-800 text-sm">{activity.whatToBring}</p>
              </div>
            )}

            {/* Price */}
            <div className="border-t pt-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-900">Price</span>
                <span className="text-2xl font-bold text-[#00806a]">£{activity.price.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Child Selection */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Child</h3>
          
          {children.length === 0 ? (
            <div className="text-center py-8">
              <UserIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">No children found</p>
              <Link to="/children/add" className="text-[#00806a] font-medium">
                Add a child
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {children.map((child) => (
                <div
                  key={child.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedChildId === child.id
                      ? 'border-[#00806a] bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedChildId(child.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {child.firstName} {child.lastName}
                      </h4>
                      <div className="text-sm text-gray-600 space-y-1">
                        {child.yearGroup && <div>Year Group: {child.yearGroup}</div>}
                        {child.school && <div>School: {child.school}</div>}
                        {child.class && <div>Class: {child.class}</div>}
                      </div>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      selectedChildId === child.id
                        ? 'border-[#00806a] bg-[#00806a]'
                        : 'border-gray-300'
                    }`}>
                      {selectedChildId === child.id && (
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Selected Child Details */}
        {selectedChild && (
          <Card className="p-6 bg-green-50 border-green-200">
            <h3 className="text-lg font-semibold text-green-900 mb-4">Selected Child</h3>
            <div className="space-y-2 text-sm">
              <div><strong>Name:</strong> {selectedChild.firstName} {selectedChild.lastName}</div>
              {selectedChild.yearGroup && <div><strong>Year Group:</strong> {selectedChild.yearGroup}</div>}
              {selectedChild.school && <div><strong>School:</strong> {selectedChild.school}</div>}
              {selectedChild.class && <div><strong>Class:</strong> {selectedChild.class}</div>}
              {selectedChild.allergies && (
                <div><strong>Allergies:</strong> {selectedChild.allergies}</div>
              )}
              {selectedChild.medicalInfo && (
                <div><strong>Medical Info:</strong> {selectedChild.medicalInfo}</div>
              )}
            </div>
          </Card>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Continue Button */}
        <div className="pt-6">
          <Button
            onClick={handleContinue}
            disabled={!selectedChildId}
            className="w-full bg-[#00806a] hover:bg-[#006d5a] text-white py-3 text-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Continue to Checkout
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ActivityConfirmationPage;
