import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  CalendarDaysIcon, 
  ClockIcon, 
  UserGroupIcon, 
  CheckCircleIcon,
  XMarkIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import AdminLayout from '../../components/layout/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { authService } from '../../services/authService';
import { buildApiUrl } from '../../config/api';
import toast from 'react-hot-toast';

interface SessionBlock {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookingsCount: number;
  bookings: Booking[];
}

interface Booking {
  id: string;
  child: {
    id: string;
    firstName: string;
    lastName: string;
    yearGroup?: string;
    allergies?: string;
    medicalInfo?: string;
  };
  parent: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  status: string;
  attendance?: Attendance[];
}

interface Attendance {
  id: string;
  attended: boolean;
  checkInTime?: string;
  checkOutTime?: string;
  notes?: string;
}

interface Session {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  sessionBlocks: SessionBlock[];
}

interface Activity {
  id: string;
  title: string;
  description: string;
  venue: {
    name: string;
    address: string;
  };
  isWraparoundCare: boolean;
  sessions: Session[];
}

const RegisterPage: React.FC = () => {
  const { activityId, sessionId } = useParams<{ activityId: string; sessionId?: string }>();
  
  const [activity, setActivity] = useState<Activity | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [sessionBlocks, setSessionBlocks] = useState<SessionBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (activityId) {
      fetchActivityData();
    }
  }, [activityId]);

  useEffect(() => {
    if (selectedSession) {
      fetchSessionBlocks();
    }
  }, [selectedSession]);

  const fetchActivityData = async () => {
    try {
      const token = authService.getToken();
      if (!token) {
        return;
      }

      const response = await fetch(buildApiUrl(`/activities/${activityId}`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch activity');
      }

      const data = await response.json();
      if (data.success) {
        setActivity(data.data);
        
        // Set selected session
        if (sessionId) {
          const session = data.data.sessions?.find((s: Session) => s.id === sessionId);
          if (session) {
            setSelectedSession(session);
          }
        } else if (data.data.sessions && data.data.sessions.length > 0) {
          setSelectedSession(data.data.sessions[0]);
        }
      } else {
        throw new Error(data.message || 'Failed to fetch activity');
      }
    } catch (error) {
      console.error('Error fetching activity:', error);
      toast.error('Failed to load activity details');
    } finally {
      setLoading(false);
    }
  };

  const fetchSessionBlocks = async () => {
    if (!selectedSession) return;

    try {
      const token = authService.getToken();
      if (!token) return;

      const response = await fetch(buildApiUrl(`/session-blocks/activity/${activityId}?sessionId=${selectedSession.id}`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSessionBlocks(data.data || []);
        }
      }
    } catch (error) {
      console.error('Error fetching session blocks:', error);
    }
  };

  const updateAttendance = async (bookingId: string, attended: boolean, notes?: string) => {
    try {
      setSaving(true);
      const token = authService.getToken();
      if (!token) return;

      const response = await fetch(buildApiUrl(`/attendance/${bookingId}`), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          attended,
          notes,
          checkInTime: attended ? new Date().toISOString() : null
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Update local state
          setSessionBlocks(prev => prev.map(block => ({
            ...block,
            bookings: block.bookings.map(booking => 
              booking.id === bookingId 
                ? { 
                    ...booking, 
                    attendance: booking.attendance?.map(att => ({ ...att, attended })) || []
                  }
                : booking
            )
          })));
          toast.success('Attendance updated successfully');
        }
      } else {
        throw new Error('Failed to update attendance');
      }
    } catch (error) {
      console.error('Error updating attendance:', error);
      toast.error('Failed to update attendance');
    } finally {
      setSaving(false);
    }
  };

  const getAttendanceStatus = (booking: Booking) => {
    const attendance = booking.attendance?.[0];
    if (!attendance) return 'not_marked';
    return attendance.attended ? 'attended' : 'absent';
  };

  const getAttendanceIcon = (status: string) => {
    switch (status) {
      case 'attended':
        return <CheckCircleIcon className="w-5 h-5 text-green-600" />;
      case 'absent':
        return <XMarkIcon className="w-5 h-5 text-red-600" />;
      default:
        return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600" />;
    }
  };

  const getAttendanceColor = (status: string) => {
    switch (status) {
      case 'attended':
        return 'bg-green-100 text-green-800';
      case 'absent':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  if (loading) {
    return (
    <AdminLayout title="Register">
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00806a]"></div>
      </div>
    </AdminLayout>
    );
  }

  if (!activity || !selectedSession) {
    return (
    <AdminLayout title="Register">
      <div className="text-center py-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Activity Not Found</h2>
        <p className="text-gray-600 mb-4">The requested activity or session could not be found.</p>
      </div>
    </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Register">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Register - {activity.title}</h1>
          <div className="flex items-center text-gray-600 space-x-4">
            <div className="flex items-center">
              <CalendarDaysIcon className="w-4 h-4 mr-1" />
              <span>{new Date(selectedSession.date).toLocaleDateString('en-GB', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}</span>
            </div>
            <div className="flex items-center">
              <ClockIcon className="w-4 h-4 mr-1" />
              <span>{selectedSession.startTime} - {selectedSession.endTime}</span>
            </div>
            <div className="flex items-center">
              <UserGroupIcon className="w-4 h-4 mr-1" />
              <span>{activity.venue.name}</span>
            </div>
          </div>
        </div>

        {/* Session Blocks */}
        {activity.isWraparoundCare ? (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">Session Blocks</h2>
            
            {sessionBlocks.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <UserGroupIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p className="text-gray-500">No session blocks configured for this session</p>
                </CardContent>
              </Card>
            ) : (
              sessionBlocks.map(sessionBlock => (
                <Card key={sessionBlock.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center">
                        <ClockIcon className="w-5 h-5 mr-2 text-gray-500" />
                        {sessionBlock.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {sessionBlock.startTime} - {sessionBlock.endTime} | 
                        {sessionBlock.bookings.length}/{sessionBlock.capacity} children
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {sessionBlock.bookings.length === 0 ? (
                      <div className="text-center py-4 text-gray-500">
                        No bookings for this session block
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Child
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Year Group
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Parent Contact
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Medical Info
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Attendance
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {sessionBlock.bookings.map(booking => {
                              const attendanceStatus = getAttendanceStatus(booking);
                              return (
                                <tr key={booking.id} className="hover:bg-gray-50">
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">
                                      {booking.child.firstName} {booking.child.lastName}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-900">
                                      {booking.child.yearGroup || 'N/A'}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-900">
                                      {booking.parent.firstName} {booking.parent.lastName}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                      {booking.parent.email}
                                    </div>
                                    {booking.parent.phone && (
                                      <div className="text-sm text-gray-500">
                                        {booking.parent.phone}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-900">
                                      {booking.child.allergies && (
                                        <div className="mb-1">
                                          <span className="font-medium">Allergies:</span> {booking.child.allergies}
                                        </div>
                                      )}
                                      {booking.child.medicalInfo && (
                                        <div>
                                          <span className="font-medium">Medical:</span> {booking.child.medicalInfo}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getAttendanceColor(attendanceStatus)}`}>
                                      {getAttendanceIcon(attendanceStatus)}
                                      <span className="ml-1">
                                        {attendanceStatus === 'attended' ? 'Present' : 
                                         attendanceStatus === 'absent' ? 'Absent' : 'Not Marked'}
                                      </span>
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <div className="flex space-x-2">
                                      <Button
                                        size="sm"
                                        onClick={() => updateAttendance(booking.id, true)}
                                        disabled={saving}
                                        className="bg-green-600 hover:bg-green-700 text-white"
                                      >
                                        Present
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => updateAttendance(booking.id, false)}
                                        disabled={saving}
                                        className="border-red-300 text-red-700 hover:bg-red-50"
                                      >
                                        Absent
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-8">
              <ExclamationTriangleIcon className="w-12 h-12 mx-auto mb-2 text-yellow-500" />
              <p className="text-gray-600">This activity is not configured for session-based attendance</p>
              <p className="text-sm text-gray-500 mt-2">Use the standard register view for this activity</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

export default RegisterPage;
