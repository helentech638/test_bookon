import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import BusinessLayout from '../../components/layout/BusinessLayout';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { 
  ClipboardDocumentListIcon, 
  ArrowLeftIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  ClockIcon,
  MapPinIcon,
  CheckCircleIcon,
  XCircleIcon,
  PencilIcon
} from '@heroicons/react/24/outline';
import CreateRegisterModal from '../../components/registers/CreateRegisterModal';
import toast from 'react-hot-toast';
import authService from '../../services/authService';
import { buildApiUrl } from '../../config/api';

interface Register {
  id: string;
  date: string;
  status: 'upcoming' | 'in-progress' | 'completed' | 'cancelled';
  notes?: string;
  createdAt: string;
  updatedAt: string;
  session: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    capacity: number;
    bookingsCount: number;
    activity: {
      id: string;
      title: string;
      type: string;
      description?: string;
      venue: {
        id: string;
        name: string;
        address?: string;
      };
    };
  };
  attendance: Array<{
    id: string;
    present: boolean;
    checkInTime?: string;
    checkOutTime?: string;
    notes?: string;
    child: {
      id: string;
      firstName: string;
      lastName: string;
      dateOfBirth: string;
    };
    booking: {
      id: string;
      parent: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        phone?: string;
      };
    };
  }>;
}

interface Activity {
  id: string;
  title: string;
  description?: string;
  type: string;
  venue: {
    id: string;
    name: string;
    address?: string;
  };
}

const ActivityRegisterPage: React.FC = () => {
  const { activityId } = useParams<{ activityId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [registers, setRegisters] = useState<Register[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (activityId) {
      fetchActivityAndRegisters();
    }
  }, [activityId]);

  const fetchActivityAndRegisters = async () => {
    try {
      setLoading(true);
      const token = authService.getToken();
      if (!token) {
        toast.error('Please log in to view registers');
        return;
      }

      // Fetch activity details
      const activityResponse = await fetch(buildApiUrl(`/activities/${activityId}`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!activityResponse.ok) {
        throw new Error('Failed to fetch activity');
      }

      const activityData = await activityResponse.json();
      if (activityData.success) {
        setActivity(activityData.data);
      }

      // Fetch registers for this activity
      const registersResponse = await fetch(buildApiUrl(`/registers/activity/${activityId}`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!registersResponse.ok) {
        throw new Error('Failed to fetch registers');
      }

      const registersData = await registersResponse.json();
      if (registersData.success) {
        setRegisters(registersData.data);
      }
    } catch (error) {
      console.error('Error fetching activity and registers:', error);
      setError('Failed to load activity registers');
      toast.error('Failed to load activity registers');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterCreated = () => {
    // Refresh the registers list
    fetchActivityAndRegisters();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming':
        return 'bg-blue-100 text-blue-800';
      case 'in-progress':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <BusinessLayout user={user}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-64 mb-6"></div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white p-6 rounded-lg shadow">
                  <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-300 rounded w-1/2 mb-4"></div>
                  <div className="h-3 bg-gray-300 rounded w-full mb-2"></div>
                  <div className="h-3 bg-gray-300 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </BusinessLayout>
    );
  }

  if (error) {
    return (
      <BusinessLayout user={user}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center">
            <XCircleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Registers</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => fetchActivityAndRegisters()}>
              Try Again
            </Button>
          </div>
        </div>
      </BusinessLayout>
    );
  }

  return (
    <BusinessLayout user={user}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Button
              variant="outline"
              onClick={() => navigate(`/business/activities/${activityId}`)}
              className="mr-4 flex items-center space-x-2"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              <span>Back to Activity</span>
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Activity Registers</h1>
              <p className="text-gray-600 mt-1">
                {activity?.title} - Attendance Management
              </p>
            </div>
          </div>
          <Button 
            className="flex items-center gap-2"
            onClick={() => setShowCreateModal(true)}
          >
            <ClipboardDocumentListIcon className="h-5 w-5" />
            Create Register
          </Button>
        </div>

        {/* Activity Info */}
        {activity && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <CalendarDaysIcon className="h-6 w-6 mr-2 text-[#00806a]" />
                Activity Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <h3 className="font-semibold text-gray-900">{activity.title}</h3>
                  <p className="text-sm text-gray-600">{activity.type}</p>
                </div>
                <div className="flex items-center">
                  <MapPinIcon className="h-5 w-5 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-600">{activity.venue.name}</span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">
                    {registers.length} register{registers.length !== 1 ? 's' : ''} created
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Registers List */}
        <div className="space-y-4">
          {registers.length === 0 ? (
            <Card className="p-12 text-center">
              <ClipboardDocumentListIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No registers found</h3>
              <p className="text-gray-600 mb-4">
                Create your first register to start tracking attendance for this activity
              </p>
              <Button
                onClick={() => setShowCreateModal(true)}
              >
                <ClipboardDocumentListIcon className="h-5 w-5 mr-2" />
                Create Register
              </Button>
            </Card>
          ) : (
            registers.map((register) => (
              <Card key={register.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <ClipboardDocumentListIcon className="h-6 w-6 text-[#00806a]" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900">
                              {formatDate(register.session.date)}
                            </h3>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(register.status)}`}>
                              {register.status.replace('-', ' ')}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center">
                              <ClockIcon className="h-4 w-4 mr-1" />
                              {formatTime(register.session.startTime)} - {formatTime(register.session.endTime)}
                            </span>
                            <span className="flex items-center">
                              <UserGroupIcon className="h-4 w-4 mr-1" />
                              {register.attendance.length} / {register.session.capacity} attendees
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Attendance Summary */}
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">Attendance</span>
                          <div className="flex space-x-1">
                            <span className="text-sm text-green-600">
                              {register.attendance.filter(a => a.present).length} present
                            </span>
                            <span className="text-sm text-red-600">
                              {register.attendance.filter(a => !a.present).length} absent
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-[#00806a] h-2 rounded-full" 
                            style={{ 
                              width: `${register.attendance.length > 0 ? (register.attendance.filter(a => a.present).length / register.attendance.length) * 100 : 0}%` 
                            }}
                          ></div>
                        </div>
                      </div>

                      {/* Children List */}
                      {register.attendance.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <h4 className="text-sm font-medium text-gray-700 mb-3">Children</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {register.attendance.map((attendance) => (
                              <div key={attendance.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                <div className="flex items-center">
                                  {attendance.present ? (
                                    <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                                  ) : (
                                    <XCircleIcon className="h-4 w-4 text-red-500 mr-2" />
                                  )}
                                  <span className="text-sm font-medium">
                                    {attendance.child.firstName} {attendance.child.lastName}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-500">
                                  {attendance.checkInTime && (
                                    <span>In: {formatTime(attendance.checkInTime)}</span>
                                  )}
                                  {attendance.checkOutTime && (
                                    <span className="ml-2">Out: {formatTime(attendance.checkOutTime)}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <button className="p-2 text-gray-400 hover:text-blue-600">
                        <PencilIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Create Register Modal */}
        <CreateRegisterModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          activityId={activityId || ''}
          onRegisterCreated={handleRegisterCreated}
        />
      </div>
    </BusinessLayout>
  );
};

export default ActivityRegisterPage;
