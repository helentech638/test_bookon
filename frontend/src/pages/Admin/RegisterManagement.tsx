import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  ClipboardDocumentListIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  DocumentArrowDownIcon,
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  UserGroupIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon as ClockIconSolid,
  ExclamationTriangleIcon,
  EyeIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  Cog6ToothIcon,
  ShieldCheckIcon,
  CameraIcon,
  HeartIcon
} from '@heroicons/react/24/outline';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import AdminLayout from '../../components/layout/AdminLayout';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { authService } from '../../services/authService';
import { buildApiUrl } from '../../config/api';

interface Register {
  id: string;
  activity_id: string;
  date: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  activity_title: string;
  venue_name: string;
  start_time: string;
  attendance?: AttendanceRecord[];
}

interface AttendanceRecord {
  id: string;
  child_id: string;
  status: 'present' | 'absent' | 'late' | 'left_early';
  notes?: string;
  recorded_at: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  year_group?: string;
  allergies?: string;
  medical_info?: string;
  school?: string;
  class?: string;
  permissions?: {
    consentToWalkHome: boolean;
    consentToPhotography: boolean;
    consentToFirstAid: boolean;
    consentToEmergencyContact: boolean;
  };
  booking?: {
    id: string;
    hasEarlyDropoff?: boolean;
    earlyDropoffAmount?: number;
    hasLatePickup?: boolean;
    latePickupAmount?: number;
    parent: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
    };
  };
}

interface RegisterTemplate {
  activityId: string;
  date: string;
  activityTitle: string;
  venueName: string;
  startTime: string;
  endTime: string;
  children: {
    childId: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    yearGroup?: string;
    allergies?: string;
    medicalInfo?: string;
    school?: string;
    class?: string;
    permissions?: {
      consentToWalkHome: boolean;
      consentToPhotography: boolean;
      consentToFirstAid: boolean;
      consentToEmergencyContact: boolean;
    };
    booking?: {
      id: string;
      hasEarlyDropoff?: boolean;
      earlyDropoffAmount?: number;
      hasLatePickup?: boolean;
      latePickupAmount?: number;
    };
    bookingId: string;
    status: 'present' | 'absent' | 'late' | 'left_early';
    notes: string;
  }[];
}

interface Activity {
  id: string;
  title: string;
  venue_name: string;
  start_date: string;
  start_time: string;
}

const RegisterManagement: React.FC = () => {
  const [registers, setRegisters] = useState<Register[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showDateSwapModal, setShowDateSwapModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [selectedRegister, setSelectedRegister] = useState<Register | null>(null);
  const [selectedAttendance, setSelectedAttendance] = useState<AttendanceRecord | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [registerTemplate, setRegisterTemplate] = useState<RegisterTemplate | null>(null);
  const [filterVenue, setFilterVenue] = useState<string>('');
  const [filterDate, setFilterDate] = useState<string>('');
  const [selectedFields, setSelectedFields] = useState<string[]>(['all']);
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('csv');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRegisters, setTotalRegisters] = useState(0);
  
  // Booking options modal state
  const [hasEarlyDropoff, setHasEarlyDropoff] = useState(false);
  const [hasLatePickup, setHasLatePickup] = useState(false);
  const [reasonText, setReasonText] = useState('');

  useEffect(() => {
    fetchRegisters();
    fetchActivities();
  }, [filterVenue, filterDate]);

  const fetchRegisters = async (page: number = currentPage) => {
    try {
      const token = authService.getToken();
      let url = buildApiUrl('/registers');
      const params = new URLSearchParams();
      
      // Add pagination
      params.append('page', page.toString());
      params.append('limit', '50'); // Show 50 at a time
      
      if (filterVenue) params.append('venueId', filterVenue);
      if (filterDate) params.append('date', filterDate);
      
      // Add custom fields parameter
      if (selectedFields.length > 0 && !selectedFields.includes('all')) {
        params.append('fields', selectedFields.join(','));
      }
      
      url += `?${params.toString()}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRegisters(data.data);
        
        // Update pagination info
        if (data.pagination) {
          setCurrentPage(data.pagination.page || 1);
          setTotalPages(data.pagination.pages || 1);
          setTotalRegisters(data.pagination.total || 0);
        }
      } else {
        toast.error('Failed to fetch registers');
      }
    } catch (error) {
      toast.error('Error fetching registers');
    } finally {
      setLoading(false);
    }
  };

  const fetchActivities = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch(buildApiUrl('/activities'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setActivities(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
      toast.error('Failed to fetch activities');
    }
  };

  const generateTemplate = async () => {
    if (!selectedActivity || !selectedDate) {
      toast.error('Please select both activity and date');
      return;
    }

    try {
      const token = authService.getToken();
      const response = await fetch(
        buildApiUrl(`/registers/template/${selectedActivity}?date=${selectedDate}`),
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setRegisterTemplate(data.data);
        setShowCreateModal(true);
      } else {
        toast.error('Failed to generate template');
      }
    } catch (error) {
      toast.error('Error generating template');
    }
  };

  const createRegister = async () => {
    if (!registerTemplate) return;

    try {
      const token = authService.getToken();
      const response = await fetch(buildApiUrl('/registers'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          activityId: registerTemplate.activityId,
          date: registerTemplate.date,
          attendance: registerTemplate.children?.map(child => ({
            childId: child.childId,
            status: child.status,
            notes: child.notes
          })) || []
        })
      });

      if (response.ok) {
        toast.success('Register created successfully');
        setShowCreateModal(false);
        setRegisterTemplate(null);
        fetchRegisters();
      } else {
        toast.error('Failed to create register');
      }
    } catch (error) {
      toast.error('Error creating register');
    }
  };

  const updateRegister = async () => {
    if (!selectedRegister || !registerTemplate) return;

    try {
      const token = authService.getToken();
      const response = await fetch(buildApiUrl(`/registers/${selectedRegister.id}`), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          attendance: registerTemplate.children?.map(child => ({
            childId: child.childId,
            status: child.status,
            notes: child.notes
          })) || []
        })
      });

      if (response.ok) {
        toast.success('Register updated successfully');
        setShowEditModal(false);
        setSelectedRegister(null);
        setRegisterTemplate(null);
        fetchRegisters();
      } else {
        toast.error('Failed to update register');
      }
    } catch (error) {
      toast.error('Error updating register');
    }
  };

  const deleteRegister = async () => {
    if (!selectedRegister) return;

    try {
      const token = authService.getToken();
      const response = await fetch(buildApiUrl(`/registers/${selectedRegister.id}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        toast.success('Register deleted successfully');
        setShowDeleteModal(false);
        setSelectedRegister(null);
        fetchRegisters();
      } else {
        toast.error('Failed to delete register');
      }
    } catch (error) {
      toast.error('Error deleting register');
    }
  };

  const exportRegister = async (registerId: string) => {
    try {
      const token = authService.getToken();
      const params = new URLSearchParams();
      params.append('format', exportFormat);
      
      if (selectedFields.length > 0 && !selectedFields.includes('all')) {
        params.append('fields', selectedFields.join(','));
      }
      
      const response = await fetch(buildApiUrl(`/registers/export/${registerId}?${params.toString()}`), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `register-${registerId}-${new Date().toISOString().split('T')[0]}.${exportFormat}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast.success(`Register exported as ${exportFormat.toUpperCase()} successfully`);
      } else {
        toast.error('Failed to export register');
      }
    } catch (error) {
      toast.error('Error exporting register');
    }
  };

  const openEditModal = async (register: Register) => {
    try {
      console.log('Opening edit modal for register:', register.id);
      const token = authService.getToken();
      const response = await fetch(buildApiUrl(`/registers/${register.id}`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Register details response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Register details data:', data);
        const registerWithAttendance = data.data;
        
        // Convert to template format
        const template: RegisterTemplate = {
          activityId: registerWithAttendance.activity_id,
          date: registerWithAttendance.date,
          activityTitle: registerWithAttendance.activity_title,
          venueName: registerWithAttendance.venue_name,
          startTime: registerWithAttendance.start_time,
          endTime: registerWithAttendance.end_time || registerWithAttendance.start_time,
          children: registerWithAttendance.attendance.map((att: any) => ({
            childId: att.child_id,
            firstName: att.first_name,
            lastName: att.last_name,
            dateOfBirth: att.date_of_birth,
            yearGroup: att.year_group,
            school: att.school,
            class: att.class,
            allergies: att.allergies,
            medicalInfo: att.medical_info,
            permissions: att.permissions,
            bookingId: att.booking?.id || '',
            status: att.status,
            notes: att.notes || '',
            booking: att.booking
          }))
        };
        
        setRegisterTemplate(template);
        setSelectedRegister(register);
        setShowEditModal(true);
      } else {
        toast.error('Failed to fetch register details');
      }
    } catch (error) {
      toast.error('Error fetching register details');
    }
  };

  const transferBooking = async (bookingId: string, newActivityId: string, newDate: string, reason: string) => {
    try {
      const token = authService.getToken();
      const response = await fetch(buildApiUrl(`/bookings/${bookingId}/transfer`), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          newActivityId,
          newDate,
          reason
        })
      });

      if (response.ok) {
        toast.success('Booking transferred successfully');
        setShowTransferModal(false);
        fetchRegisters();
      } else {
        toast.error('Failed to transfer booking');
      }
    } catch (error) {
      toast.error('Error transferring booking');
    }
  };

  const swapHolidayDate = async (bookingId: string, newDate: string, reason: string) => {
    try {
      const token = authService.getToken();
      const response = await fetch(buildApiUrl(`/bookings/${bookingId}/swap-date`), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          newDate,
          reason
        })
      });

      if (response.ok) {
        toast.success('Holiday club date swapped successfully');
        setShowDateSwapModal(false);
        fetchRegisters();
      } else {
        toast.error('Failed to swap holiday club date');
      }
    } catch (error) {
      toast.error('Error swapping holiday club date');
    }
  };

  const updateBookingOptions = async (bookingId: string, hasEarlyDropoff: boolean, hasLatePickup: boolean, reason: string) => {
    try {
      const token = authService.getToken();
      const response = await fetch(buildApiUrl(`/bookings/${bookingId}/admin-options`), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          hasEarlyDropoff,
          hasLatePickup,
          reason
        })
      });

      if (response.ok) {
        toast.success('Booking options updated successfully');
        setShowOptionsModal(false);
        setSelectedAttendance(null);
        setHasEarlyDropoff(false);
        setHasLatePickup(false);
        setReasonText('');
        fetchRegisters();
      } else {
        const errorData = await response.json();
        toast.error('Failed to update booking options');
      }
    } catch (error) {
      toast.error('Error updating booking options');
    }
  };

  const openDeleteModal = (register: Register) => {
    setSelectedRegister(register);
    setShowDeleteModal(true);
  };

  const openTransferModal = (child: any) => {
    setSelectedAttendance(child as AttendanceRecord);
    setShowTransferModal(true);
  };

  const openDateSwapModal = (child: any) => {
    setSelectedAttendance(child as AttendanceRecord);
    setShowDateSwapModal(true);
  };

  const openOptionsModal = (child: any) => {
    setSelectedAttendance(child as AttendanceRecord);
    // Initialize state with current booking values
    setHasEarlyDropoff(child.booking?.hasEarlyDropoff || false);
    setHasLatePickup(child.booking?.hasLatePickup || false);
    setReasonText('');
    setShowOptionsModal(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'absent':
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
      case 'late':
        return <ClockIconSolid className="w-5 h-5 text-yellow-500" />;
      case 'left_early':
        return <ExclamationTriangleIcon className="w-5 h-5 text-orange-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return 'bg-green-100 text-green-800';
      case 'absent':
        return 'bg-red-100 text-red-800';
      case 'late':
        return 'bg-yellow-100 text-yellow-800';
      case 'left_early':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading registers...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout title="Register Management">
      <div className="mb-6">
        <p className="text-gray-600">Manage digital registers and track attendance</p>
      </div>
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <Button onClick={() => setShowCreateModal(true)}>
            <PlusIcon className="w-5 h-5 mr-2" />
            Create Register
          </Button>
        </div>

      {/* Filters and Custom Fields */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Venue</label>
              <Select
                value={filterVenue}
                onChange={(e) => setFilterVenue(e.target.value)}
              >
                <option value="">All Venues</option>
                {activities.map(activity => (
                  <option key={activity.venue_name} value={activity.venue_name}>
                    {activity.venue_name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Date</label>
              <Input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Custom Fields</label>
              <Select
                value={selectedFields.includes('all') ? 'all' : selectedFields.join(',')}
                onChange={(e) => {
                  if (e.target.value === 'all') {
                    setSelectedFields(['all']);
                  } else {
                    setSelectedFields(e.target.value.split(','));
                  }
                }}
              >
                <option value="all">All Fields</option>
                <option value="basic">Basic Info Only</option>
                <option value="medical">Medical Info</option>
                <option value="permissions">Permissions</option>
                <option value="booking_options">Booking Options</option>
                <option value="basic,medical">Basic + Medical</option>
                <option value="basic,permissions">Basic + Permissions</option>
                <option value="medical,permissions">Medical + Permissions</option>
              </Select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={() => { 
                setFilterVenue(''); 
                setFilterDate(''); 
                setSelectedFields(['all']);
              }}>
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Registers List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {registers.map((register) => (
          <Card key={register.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{register.activity_title}</CardTitle>
                  <p className="text-sm text-gray-600">{register.venue_name}</p>
                </div>
                <div className="flex space-x-2">
                  <div className="relative group">
                  <Button
                    variant="outline"
                    size="sm"
                      title="Export Register"
                  >
                    <DocumentArrowDownIcon className="w-4 h-4" />
                  </Button>
                    <div className="absolute right-0 mt-1 w-32 bg-white rounded-md shadow-lg z-10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                      <div className="py-1">
                        <button
                          onClick={() => {
                            setExportFormat('csv');
                            exportRegister(register.id);
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          Export as CSV
                        </button>
                        <button
                          onClick={() => {
                            setExportFormat('pdf');
                            exportRegister(register.id);
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          Export as PDF
                        </button>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditModal(register)}
                    title="Edit Register"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openDeleteModal(register)}
                    title="Delete Register"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center text-sm text-gray-600">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {new Date(register.date).toLocaleDateString('en-GB')}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <ClockIcon className="w-4 h-4 mr-2" />
                  {register.start_time}
                </div>
                {register.attendance && register.attendance.length > 0 && (
                  <div className="flex items-center text-sm text-gray-600">
                    <UserGroupIcon className="w-4 h-4 mr-2" />
                    {register.attendance.length} children
                  </div>
                )}
                {register.notes && (
                  <div className="text-sm text-gray-600">
                    <p className="font-medium">Notes:</p>
                    <p>{register.notes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center space-x-4 mt-8">
          <Button
            variant="outline"
            onClick={() => fetchRegisters(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-600">
            Page {currentPage} of {totalPages} (Showing {registers.length} of {totalRegisters} registers)
          </span>
          <Button
            variant="outline"
            onClick={() => fetchRegisters(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {registers.length === 0 && (
        <div className="text-center py-12">
          <ClipboardDocumentListIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No registers found</h3>
          <p className="text-gray-600 mb-4">Create your first register to start tracking attendance.</p>
          <Button onClick={() => setShowCreateModal(true)}>
            <PlusIcon className="w-5 h-5 mr-2" />
            Create Register
          </Button>
        </div>
      )}

      {/* Create/Edit Register Modal */}
      <Modal
        isOpen={showCreateModal || showEditModal}
        onClose={() => {
          setShowCreateModal(false);
          setShowEditModal(false);
          setRegisterTemplate(null);
          setSelectedRegister(null);
        }}
        title={showEditModal ? 'Edit Register' : 'Create Register'}
        size="xl"
      >
        {!registerTemplate ? (
          <div className="p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Activity</label>
                <Select
                  value={selectedActivity}
                  onChange={(e) => setSelectedActivity(e.target.value)}
                >
                  <option value="">Choose an activity</option>
                  {activities.map(activity => (
                    <option key={activity.id} value={activity.id}>
                      {activity.title} - {activity.venue_name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateModal(false);
                    setSelectedActivity('');
                    setSelectedDate('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={generateTemplate}
                  disabled={!selectedActivity || !selectedDate}
                >
                  Generate Template
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full max-h-[80vh]">
            {/* Header Section */}
            <div className="flex-shrink-0 p-6 border-b border-gray-200 bg-gray-50">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{registerTemplate.activityTitle}</h3>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1">
                    <span className="text-sm text-gray-600 flex items-center">
                      <MapPinIcon className="w-4 h-4 mr-1" />
                      {registerTemplate.venueName}
                    </span>
                    <span className="text-sm text-gray-600 flex items-center">
                      <CalendarIcon className="w-4 h-4 mr-1" />
                {new Date(registerTemplate.date).toLocaleDateString('en-GB')} at {registerTemplate.startTime}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">
                    {registerTemplate.children?.length || 0} participants
                  </span>
                </div>
              </div>
            </div>
            
            {/* Content Section - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6">
              {registerTemplate.children?.length > 0 ? (
                <div className="space-y-6">
                  {registerTemplate.children.map((child, index) => (
                    <div key={child.childId} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                      {/* Child Header */}
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
                        <div className="flex-1">
                          <h4 className="text-lg font-semibold text-gray-900 mb-1">
                            {child.firstName} {child.lastName}
                          </h4>
                          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                            {child.yearGroup && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                                {child.yearGroup}
                              </span>
                            )}
                            <span>{new Date().getFullYear() - new Date(child.dateOfBirth).getFullYear()} years old</span>
                            {child.school && <span>• {child.school}</span>}
                            {child.class && <span>• {child.class}</span>}
                    </div>
                        </div>
                        <div className="flex-shrink-0">
                    <Select
                      value={child.status}
                      onChange={(e) => {
                        const newTemplate = { ...registerTemplate };
                        if (newTemplate.children && newTemplate.children[index]) {
                          newTemplate.children[index].status = e.target.value as any;
                          setRegisterTemplate(newTemplate);
                        }
                      }}
                            className="min-w-[120px]"
                          >
                            <option value="present">✅ Present</option>
                            <option value="absent">❌ Absent</option>
                            <option value="late">⏰ Late</option>
                            <option value="left_early">🚪 Left Early</option>
                    </Select>
                        </div>
                  </div>
                  
                      {/* Child Information Grid */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                        {/* Medical Information */}
                        <div className="space-y-3">
                          <div className="flex items-center">
                            <HeartIcon className="w-5 h-5 mr-2 text-red-500" />
                            <h5 className="font-medium text-gray-900">Medical Info</h5>
                    </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Allergies:</span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                child.allergies && child.allergies !== 'no' 
                                  ? 'bg-red-100 text-red-800' 
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {child.allergies && child.allergies !== 'no' ? child.allergies : 'None'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Medical Info:</span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                child.medicalInfo && child.medicalInfo !== 'no' 
                                  ? 'bg-red-100 text-red-800' 
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {child.medicalInfo && child.medicalInfo !== 'no' ? child.medicalInfo : 'None'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Permissions */}
                        <div className="space-y-3">
                          <div className="flex items-center">
                            <ShieldCheckIcon className="w-5 h-5 mr-2 text-blue-500" />
                            <h5 className="font-medium text-gray-900">Permissions</h5>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Photos:</span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center ${
                                child.permissions?.consentToPhotography 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                <CameraIcon className="w-3 h-3 mr-1" />
                                {child.permissions?.consentToPhotography ? 'Allowed' : 'Not Allowed'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Walk Home:</span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                child.permissions?.consentToWalkHome 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {child.permissions?.consentToWalkHome ? 'Allowed' : 'Must be Collected'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Booking Options */}
                        <div className="space-y-3">
                          <div className="flex items-center">
                            <ClockIcon className="w-5 h-5 mr-2 text-orange-500" />
                            <h5 className="font-medium text-gray-900">Booking Options</h5>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Early Drop-off:</span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                child.booking?.hasEarlyDropoff 
                                  ? 'bg-orange-100 text-orange-800' 
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {child.booking?.hasEarlyDropoff ? `£${child.booking.earlyDropoffAmount}` : 'Not booked'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Late Pick-up:</span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                child.booking?.hasLatePickup 
                                  ? 'bg-orange-100 text-orange-800' 
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {child.booking?.hasLatePickup ? `£${child.booking.latePickupAmount}` : 'Not booked'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Admin Action Buttons */}
                      <div className="flex flex-wrap gap-3 mb-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openTransferModal(child)}
                          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <ArrowPathIcon className="w-4 h-4" />
                          Transfer
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openDateSwapModal(child)}
                          className="flex items-center gap-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                        >
                          <CalendarDaysIcon className="w-4 h-4" />
                          Swap Date
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openOptionsModal(child)}
                          className="flex items-center gap-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          <Cog6ToothIcon className="w-4 h-4" />
                          Options
                        </Button>
                      </div>
                      
                      {/* Notes Section */}
                  <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                    <Textarea
                          value={child.notes || ''}
                      onChange={(e) => {
                        const newTemplate = { ...registerTemplate };
                        if (newTemplate.children && newTemplate.children[index]) {
                          newTemplate.children[index].notes = e.target.value;
                          setRegisterTemplate(newTemplate);
                        }
                      }}
                      placeholder="Add notes about this child's attendance..."
                          rows={3}
                          className="resize-none"
                    />
                  </div>
                </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <UserGroupIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No participants found</h3>
                  <p className="text-gray-600">No children are registered for this activity on the selected date.</p>
                </div>
              )}
            </div>
            
            {/* Footer Section */}
            <div className="flex-shrink-0 p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="text-sm text-gray-600">
                  Last updated: {new Date().toLocaleString()}
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  setRegisterTemplate(null);
                  setSelectedRegister(null);
                }}
                    className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                onClick={showEditModal ? updateRegister : createRegister}
                    className="w-full sm:w-auto"
              >
                {showEditModal ? 'Update Register' : 'Create Register'}
              </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedRegister(null);
        }}
        title="Delete Register"
      >
        <div className="p-6">
          <p className="text-gray-700 mb-4">
            Are you sure you want to delete the register for "{selectedRegister?.activity_title}" on {selectedRegister?.date}?
            This action cannot be undone.
          </p>
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteModal(false);
                setSelectedRegister(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={deleteRegister}
            >
              Delete Register
            </Button>
          </div>
        </div>
      </Modal>
      {/* Booking Transfer Modal */}
      <Modal
        isOpen={showTransferModal}
        onClose={() => {
          setShowTransferModal(false);
          setSelectedAttendance(null);
        }}
        title="Transfer Booking"
      >
        <div className="p-6">
          {selectedAttendance && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  Transfer booking for <strong>{selectedAttendance.first_name} {selectedAttendance.last_name}</strong>
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">New Activity</label>
                <Select>
                  <option value="">Select new activity</option>
                  {activities.map(activity => (
                    <option key={activity.id} value={activity.id}>
                      {activity.title} - {activity.venue_name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">New Date</label>
                <Input type="date" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
                <Textarea placeholder="Reason for transfer..." rows={3} />
              </div>
              <div className="flex justify-end space-x-3">
                <Button variant="outline" onClick={() => setShowTransferModal(false)}>
                  Cancel
                </Button>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  Transfer Booking
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Holiday Club Date Swap Modal */}
      <Modal
        isOpen={showDateSwapModal}
        onClose={() => {
          setShowDateSwapModal(false);
          setSelectedAttendance(null);
        }}
        title="Swap Holiday Club Date"
      >
        <div className="p-6">
          {selectedAttendance && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  Swap holiday club date for <strong>{selectedAttendance.first_name} {selectedAttendance.last_name}</strong>
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">New Date</label>
                <Input type="date" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
                <Textarea placeholder="Reason for date swap..." rows={3} />
              </div>
              <div className="flex justify-end space-x-3">
                <Button variant="outline" onClick={() => setShowDateSwapModal(false)}>
                  Cancel
                </Button>
                <Button className="bg-purple-600 hover:bg-purple-700">
                  Swap Date
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Booking Options Modal */}
      <Modal
        isOpen={showOptionsModal}
        onClose={() => {
          setShowOptionsModal(false);
          setSelectedAttendance(null);
          setHasEarlyDropoff(false);
          setHasLatePickup(false);
          setReasonText('');
        }}
        title="Manage Booking Options"
      >
        <div className="p-6">
          {selectedAttendance && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  Manage booking options for <strong>{selectedAttendance.first_name} {selectedAttendance.last_name}</strong>
                </p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center">
                  <input 
                    type="checkbox" 
                    className="mr-2" 
                    checked={hasEarlyDropoff}
                    onChange={(e) => setHasEarlyDropoff(e.target.checked)}
                  />
                  <label className="text-sm font-medium text-gray-700">Early Drop-off</label>
                </div>
                <div className="flex items-center">
                  <input 
                    type="checkbox" 
                    className="mr-2" 
                    checked={hasLatePickup}
                    onChange={(e) => setHasLatePickup(e.target.checked)}
                  />
                  <label className="text-sm font-medium text-gray-700">Late Pick-up</label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
                <Textarea 
                  placeholder="Reason for changes..." 
                  rows={3}
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                />
              </div>
              <div className="flex justify-end space-x-3">
                <Button variant="outline" onClick={() => {
                  setShowOptionsModal(false);
                  setSelectedAttendance(null);
                  setHasEarlyDropoff(false);
                  setHasLatePickup(false);
                  setReasonText('');
                }}>
                  Cancel
                </Button>
                <Button 
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => {
                    if (selectedAttendance?.booking?.id) {
                      updateBookingOptions(
                        selectedAttendance.booking.id,
                        hasEarlyDropoff,
                        hasLatePickup,
                        reasonText
                      );
                    }
                  }}
                >
                  Update Options
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
      </div>
    </AdminLayout>
  );
};

export default RegisterManagement;
