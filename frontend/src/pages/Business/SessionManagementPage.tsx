import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CalendarDaysIcon,
  ClockIcon,
  UserGroupIcon,
  CurrencyPoundIcon,
  EyeIcon,
  TrashIcon,
  XMarkIcon,
  CheckIcon,
  MapPinIcon
} from '@heroicons/react/24/outline';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import BusinessLayout from '../../components/layout/BusinessLayout';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/authService';
import { buildApiUrl } from '../../config/api';
import toast from 'react-hot-toast';
import CalendarView from '../../components/booking/CalendarView';
import BusinessCalendarView from '../../components/business/BusinessCalendarView';
import HolidayExclusion from '../../components/business/HolidayExclusion';

interface Session {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'active' | 'cancelled' | 'completed';
  capacity: number;
  bookingsCount: number;
  price: number;
  activity: {
    id: string;
    title: string;
    type: string;
    venue: {
      name: string;
      address: string;
    };
  };
  sessionBlocks?: SessionBlock[];
}

interface SessionBlock {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookingsCount: number;
  price: number;
}

interface Activity {
  id: string;
  title: string;
  type: string;
  venue: {
    name: string;
    address: string;
  };
  sessions: Session[];
}

const SessionManagementPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [filters, setFilters] = useState({
    search: '',
    type: '',
    status: '',
    dateRange: ''
  });

  useEffect(() => {
    fetchActivities();
  }, []);

  useEffect(() => {
    if (selectedActivity) {
      fetchSessions();
    }
  }, [selectedActivity, filters]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const token = authService.getToken();
      
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch(buildApiUrl('/business/activities'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch activities');
      }

      const data = await response.json();
      if (data.success) {
        // Ensure data.data is an array before filtering
        const activitiesData = Array.isArray(data.data) ? data.data : [];
        
        // Filter for holiday club and wraparound care only
        const filteredActivities = activitiesData.filter((activity: any) => 
          activity.type === 'holiday_club' || activity.type === 'wraparound_care'
        );
        setActivities(filteredActivities);
        
        if (filteredActivities.length > 0) {
          setSelectedActivity(filteredActivities[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
      toast.error('Failed to load activities');
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    try {
      const token = authService.getToken();
      if (!token) return;

      const queryParams = new URLSearchParams({
        activityId: selectedActivity,
        ...(filters.status && { status: filters.status }),
        ...(filters.dateRange && { dateRange: filters.dateRange })
      });

      const response = await fetch(buildApiUrl(`/business/sessions?${queryParams}`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }

      const data = await response.json();
      if (data.success) {
        setSessions(data.data);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast.error('Failed to load sessions');
    }
  };

  const handleSessionStatusChange = async (sessionId: string, newStatus: string) => {
    try {
      const token = authService.getToken();
      if (!token) return;

      const response = await fetch(buildApiUrl(`/business/sessions/${sessionId}/status`), {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        throw new Error('Failed to update session status');
      }

      const data = await response.json();
      if (data.success) {
        toast.success('Session status updated successfully');
        fetchSessions(); // Refresh sessions
      }
    } catch (error) {
      console.error('Error updating session status:', error);
      toast.error('Failed to update session status');
    }
  };

  const handleSessionDelete = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this session? This action cannot be undone.')) {
      return;
    }

    try {
      const token = authService.getToken();
      if (!token) return;

      const response = await fetch(buildApiUrl(`/business/sessions/${sessionId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete session');
      }

      const data = await response.json();
      if (data.success) {
        toast.success('Session deleted successfully');
        fetchSessions(); // Refresh sessions
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      toast.error('Failed to delete session');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCapacityColor = (bookings: number, capacity: number) => {
    const percentage = (bookings / capacity) * 100;
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 70) return 'text-yellow-600';
    return 'text-green-600';
  };

  const generateAvailableDates = () => {
    return sessions.map(session => session.date).sort();
  };

  const handleDateSelection = (date: string) => {
    setSelectedDate(selectedDate === date ? '' : date);
  };

  const handleSessionClick = (session: Session) => {
    // Navigate to session details or show modal
    navigate(`/business/sessions/${session.id}`);
  };

  const filteredSessions = sessions.filter(session => {
    if (selectedDate && session.date !== selectedDate) return false;
    if (filters.search && !session.activity.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });

  const selectedActivityData = activities.find(a => a.id === selectedActivity);

  if (loading) {
    return (
      <BusinessLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00806a]"></div>
        </div>
      </BusinessLayout>
    );
  }

  return (
    <BusinessLayout>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Session Management</h1>
          <p className="text-gray-600">Manage sessions for Holiday Club and Wraparound Care activities</p>
        </div>

        {/* Activity Selection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Select Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Activity</label>
                <Select
                  value={selectedActivity}
                  onChange={(e) => setSelectedActivity(e.target.value)}
                >
                  <option value="">Select an activity</option>
                  {activities.map(activity => (
                    <option key={activity.id} value={activity.id}>
                      {activity.title} ({activity.type.replace('_', ' ')})
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">View Mode</label>
                <Select
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value as 'calendar' | 'list')}
                >
                  <option value="calendar">Calendar View</option>
                  <option value="list">List View</option>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {selectedActivityData && (
          <>
            {/* Activity Info */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{selectedActivityData.title}</h2>
                    <div className="flex items-center text-gray-600 space-x-4 mt-1">
                      <div className="flex items-center">
                        <CalendarDaysIcon className="w-4 h-4 mr-1" />
                        <span>{selectedActivityData.type.replace('_', ' ')}</span>
                      </div>
                      <div className="flex items-center">
                        <MapPinIcon className="w-4 h-4 mr-1" />
                        <span>{selectedActivityData.venue.name}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Total Sessions</div>
                    <div className="text-2xl font-bold text-[#00806a]">{sessions.length}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Filters */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                    <Input
                      type="text"
                      placeholder="Search sessions..."
                      value={filters.search}
                      onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <Select
                      value={filters.status}
                      onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                    >
                      <option value="">All Statuses</option>
                      <option value="active">Active</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="completed">Completed</option>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                    <Select
                      value={filters.dateRange}
                      onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
                    >
                      <option value="">All Dates</option>
                      <option value="today">Today</option>
                      <option value="week">This Week</option>
                      <option value="month">This Month</option>
                      <option value="upcoming">Upcoming</option>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={() => setFilters({ search: '', type: '', status: '', dateRange: '' })}
                      variant="outline"
                      className="w-full"
                    >
                      Clear Filters
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Calendar View */}
            {viewMode === 'calendar' && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Session Calendar</CardTitle>
                </CardHeader>
                <CardContent>
                  <BusinessCalendarView
                    sessions={sessions}
                    onSessionClick={handleSessionClick}
                    onDateClick={handleDateSelection}
                    className="w-full"
                  />
                </CardContent>
              </Card>
            )}

            {/* Sessions List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Sessions ({filteredSessions.length})</span>
                  {selectedDate && (
                    <Button
                      onClick={() => setSelectedDate('')}
                      variant="outline"
                      size="sm"
                    >
                      <XMarkIcon className="w-4 h-4 mr-1" />
                      Clear Date Filter
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {filteredSessions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <CalendarDaysIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No sessions found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredSessions.map(session => (
                      <div key={session.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-4 mb-2">
                              <div className="flex items-center text-gray-600">
                                <CalendarDaysIcon className="w-4 h-4 mr-1" />
                                <span>{new Date(session.date).toLocaleDateString('en-GB', {
                                  weekday: 'long',
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric'
                                })}</span>
                              </div>
                              <div className="flex items-center text-gray-600">
                                <ClockIcon className="w-4 h-4 mr-1" />
                                <span>{session.startTime} - {session.endTime}</span>
                              </div>
                              <div className="flex items-center text-gray-600">
                                <CurrencyPoundIcon className="w-4 h-4 mr-1" />
                                <span>£{session.price.toFixed(2)}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-4">
                              <div className="flex items-center">
                                <UserGroupIcon className="w-4 h-4 mr-1 text-gray-500" />
                                <span className={`text-sm font-medium ${getCapacityColor(session.bookingsCount, session.capacity)}`}>
                                  {session.bookingsCount}/{session.capacity} booked
                                </span>
                              </div>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(session.status)}`}>
                                {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <Button
                              onClick={() => navigate(`/business/sessions/${session.id}`)}
                              variant="outline"
                              size="sm"
                            >
                              <EyeIcon className="w-4 h-4" />
                            </Button>
                            
                            {session.status === 'active' && (
                              <>
                                <Button
                                  onClick={() => handleSessionStatusChange(session.id, 'cancelled')}
                                  variant="outline"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <XMarkIcon className="w-4 h-4" />
                                </Button>
                                <Button
                                  onClick={() => handleSessionStatusChange(session.id, 'completed')}
                                  variant="outline"
                                  size="sm"
                                  className="text-green-600 hover:text-green-700"
                                >
                                  <CheckIcon className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            
                            {session.status === 'cancelled' && (
                              <Button
                                onClick={() => handleSessionStatusChange(session.id, 'active')}
                                variant="outline"
                                size="sm"
                                className="text-green-600 hover:text-green-700"
                              >
                                <CheckIcon className="w-4 h-4" />
                              </Button>
                            )}
                            
                            <Button
                              onClick={() => handleSessionDelete(session.id)}
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Holiday Management */}
        {selectedActivityData && (
          <HolidayExclusion
            activityId={selectedActivity}
            onHolidaysUpdated={fetchSessions}
            className="mt-6"
          />
        )}
      </div>
    </BusinessLayout>
  );
};

export default SessionManagementPage;
