import React, { useState, useEffect } from 'react';
import { authService } from '../../services/authService';
import { buildApiUrl } from '../../config/api';
import { 
  CalendarDaysIcon, 
  UserGroupIcon, 
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  EyeIcon,
  PencilIcon,
  PlusIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import AdminLayout from '../../components/layout/AdminLayout';
import { Button } from '../../components/ui/Button';

interface Register {
  id: string;
  date: string;
  capacity: number;
  presentCount: number;
  totalCount: number;
  status: string;
  session: {
    id: string;
    startTime: string;
    endTime: string;
    activity: {
      title: string;
      type: string;
      venue: {
        name: string;
        address: string;
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
    };
    booking: {
      parent: {
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
      };
    };
  }>;
}

interface Activity {
  id: string;
  title: string;
  type: string;
  venue: {
    name: string;
    city: string;
  };
}

const RegisterManagementPage: React.FC = () => {
  const [registers, setRegisters] = useState<Register[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [selectedRegister, setSelectedRegister] = useState<Register | null>(null);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);

  useEffect(() => {
    loadActivities();
    loadRegisters();
  }, [selectedActivity, dateFrom, dateTo]);

  const loadActivities = async () => {
    try {
      const token = authService.getToken();
      if (!token) return;

      const response = await fetch(buildApiUrl('/activities?status=active'), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setActivities(data.data || []);
      }
    } catch (err) {
      console.error('Error loading activities:', err);
    }
  };

  const loadRegisters = async () => {
    setLoading(true);
    try {
      const token = authService.getToken();
      if (!token) throw new Error('No authentication token');

      let url = buildApiUrl('/registers');
      const params = new URLSearchParams();
      
      if (selectedActivity) params.append('activityId', selectedActivity);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setRegisters(data.data || []);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to load registers');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load registers');
    } finally {
      setLoading(false);
    }
  };

  const handleViewRegister = (register: Register) => {
    setSelectedRegister(register);
    setShowAttendanceModal(true);
  };

  const handleUpdateAttendance = async (registerId: string, attendanceRecords: any[]) => {
    try {
      const token = authService.getToken();
      if (!token) throw new Error('No authentication token');

      const response = await fetch(buildApiUrl(`/registers/${registerId}/attendance`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ attendanceRecords })
      });

      if (response.ok) {
        await loadRegisters();
        setShowAttendanceModal(false);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update attendance');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update attendance');
    }
  };

  const handleAutoCreateRegisters = async () => {
    if (!selectedActivity) {
      setError('Please select an activity');
      return;
    }

    try {
      const token = authService.getToken();
      if (!token) throw new Error('No authentication token');

      const response = await fetch(buildApiUrl('/registers/auto-create'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          activityId: selectedActivity,
          startDate: dateFrom || new Date().toISOString().split('T')[0],
          endDate: dateTo || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        })
      });

      if (response.ok) {
        await loadRegisters();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create registers');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create registers');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (timeString: string) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getAttendanceRate = (present: number, total: number) => {
    return total > 0 ? Math.round((present / total) * 100) : 0;
  };

  return (
    <AdminLayout title="Register Management">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Register Management</h1>
            <p className="text-gray-600">Manage attendance registers for activities</p>
          </div>
          <div className="flex space-x-3">
            <Button
              onClick={handleAutoCreateRegisters}
              disabled={!selectedActivity}
              className="bg-green-600 hover:bg-green-700"
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              Auto-Create Registers
            </Button>
            <Button
              onClick={() => loadRegisters()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <ArrowDownTrayIcon className="w-5 h-5 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Activity
              </label>
              <select
                value={selectedActivity}
                onChange={(e) => setSelectedActivity(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Activities</option>
                {activities.map((activity) => (
                  <option key={activity.id} value={activity.id}>
                    {activity.title} - {activity.venue?.name || 'No Venue'}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                From Date
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                To Date
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="flex items-end">
              <Button
                onClick={loadRegisters}
                className="w-full bg-gray-600 hover:bg-gray-700"
              >
                <FunnelIcon className="w-5 h-5 mr-2" />
                Filter
              </Button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <XCircleIcon className="w-5 h-5 text-red-400" />
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Registers List */}
        <div className="bg-white rounded-lg shadow">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading registers...</p>
            </div>
          ) : registers.length === 0 ? (
            <div className="p-8 text-center">
              <CalendarDaysIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No registers found</p>
              <p className="text-sm text-gray-500">Create registers for your activities to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Activity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Venue
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Attendance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {registers.map((register) => (
                    <tr key={register.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {register.session?.activity?.title || 'Unknown Activity'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {register.session?.activity?.type || 'Unknown Type'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm text-gray-900">
                            {formatDate(register.date)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatTime(register.session?.startTime)} - {formatTime(register.session?.endTime)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {register.session?.activity?.venue?.name || 'No Venue'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {register.session?.activity?.venue?.address || 'No Address'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <UserGroupIcon className="w-4 h-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-900">
                            {register.presentCount} / {register.totalCount}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${getAttendanceRate(register.presentCount, register.totalCount)}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-900">
                            {getAttendanceRate(register.presentCount, register.totalCount)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleViewRegister(register)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        <button className="text-gray-600 hover:text-gray-900">
                          <PencilIcon className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Attendance Modal */}
        {showAttendanceModal && selectedRegister && (
          <AttendanceModal
            register={selectedRegister}
            onClose={() => setShowAttendanceModal(false)}
            onSave={handleUpdateAttendance}
          />
        )}
      </div>
    </AdminLayout>
  );
};

// Attendance Modal Component
interface AttendanceModalProps {
  register: Register;
  onClose: () => void;
  onSave: (registerId: string, attendanceRecords: any[]) => void;
}

const AttendanceModal: React.FC<AttendanceModalProps> = ({ register, onClose, onSave }) => {
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Initialize attendance records
    const records: Record<string, any> = {};
    register.attendance.forEach(att => {
      records[att.child.id] = {
        present: att.present,
        checkInTime: att.checkInTime,
        checkOutTime: att.checkOutTime,
        notes: att.notes || ''
      };
    });
    setAttendanceRecords(records);
  }, [register]);

  const handleAttendanceChange = (childId: string, field: string, value: any) => {
    setAttendanceRecords(prev => ({
      ...prev,
      [childId]: {
        ...prev[childId],
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const records = Object.entries(attendanceRecords).map(([childId, data]) => ({
        childId,
        ...data
      }));
      
      await onSave(register.id, records);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Attendance Register</h2>
            <p className="text-sm text-gray-600">
              {register.session?.activity?.title || 'Unknown Activity'} - {new Date(register.date).toLocaleDateString('en-GB')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <XCircleIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="space-y-4">
            {register.attendance.map((attendance) => {
              const record = attendanceRecords[attendance.child.id] || {};
              return (
                <div key={attendance.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {attendance.child.firstName} {attendance.child.lastName}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Parent: {attendance.booking.parent.firstName} {attendance.booking.parent.lastName}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={record.present || false}
                          onChange={(e) => handleAttendanceChange(attendance.child.id, 'present', e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">Present</span>
                      </label>
                    </div>
                  </div>
                  
                  {record.present && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Check-in Time
                        </label>
                        <input
                          type="time"
                          value={record.checkInTime || ''}
                          onChange={(e) => handleAttendanceChange(attendance.child.id, 'checkInTime', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Check-out Time
                        </label>
                        <input
                          type="time"
                          value={record.checkOutTime || ''}
                          onChange={(e) => handleAttendanceChange(attendance.child.id, 'checkOutTime', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      value={record.notes || ''}
                      onChange={(e) => handleAttendanceChange(attendance.child.id, 'notes', e.target.value)}
                      rows={2}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Add any notes about this child's attendance..."
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex space-x-3">
            <Button
              onClick={onClose}
              variant="outline"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                'Save Attendance'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterManagementPage;
