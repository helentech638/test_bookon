import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import BusinessLayout from '../../components/layout/BusinessLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { 
  ArrowLeftIcon,
  CheckIcon,
  XMarkIcon,
  PhoneIcon,
  CameraIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  ArrowDownTrayIcon,
  DocumentArrowDownIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import authService from '../../services/authService';
import { buildApiUrl } from '../../config/api';

interface RegisterDetail {
  id: string;
  date: string;
  status: string;
  notes: string;
  lastSaved?: string;
  session: {
    id: string;
    startTime: string;
    endTime: string;
    activity: {
      id: string;
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
      yearGroup?: string;
      classGroup?: string;
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

const RegisterDetailPage: React.FC = () => {
  const { registerId } = useParams<{ registerId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [register, setRegister] = useState<RegisterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string>('');
  const [medicalNotes, setMedicalNotes] = useState<{[key: string]: string}>({});
  const [uploadedImages, setUploadedImages] = useState<{[key: string]: string}>({});

  useEffect(() => {
    if (registerId) {
      fetchRegisterDetail();
    }
  }, [registerId]);

  const fetchRegisterDetail = async () => {
    try {
      setLoading(true);
      const token = authService.getToken();
      if (!token) {
        toast.error('Please log in to view register');
        navigate('/login');
        return;
      }

      const response = await fetch(buildApiUrl(`/business/registers/${registerId}`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch register details');
      }

      const data = await response.json();
      if (data.success) {
        setRegister(data.data);
      } else {
        throw new Error(data.message || 'Failed to fetch register details');
      }
    } catch (error) {
      console.error('Error fetching register details:', error);
      toast.error('Failed to load register details');
      navigate('/business/registers');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAttendance = (attendanceId: string, present: boolean) => {
    setRegister(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        attendance: prev.attendance.map(att => 
          att.id === attendanceId ? { ...att, present } : att
        )
      };
    });
  };

  const handleSaveRegister = async () => {
    if (!register) return;
    
    try {
      setSaving(true);
      const token = authService.getToken();
      
      const response = await fetch(buildApiUrl(`/business/registers/${registerId}/save`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          attendance: register.attendance.map(att => ({
            id: att.id,
            present: att.present
          }))
        }),
      });

      if (response.ok) {
        const now = new Date();
        setLastSaved(`${Math.floor((Date.now() - now.getTime()) / 60000)} mins ago`);
        toast.success('Register saved successfully');
      } else {
        throw new Error('Failed to save register');
      }
    } catch (error) {
      console.error('Error saving register:', error);
      toast.error('Failed to save register');
    } finally {
      setSaving(false);
    }
  };

  const handleContactParent = (phone: string, parentName: string) => {
    // Open phone dialer or copy phone number
    if (navigator.userAgent.match(/iPhone|iPad|iPod/i)) {
      window.location.href = `tel:${phone}`;
    } else {
      navigator.clipboard.writeText(phone);
      toast.success(`Phone number copied: ${phone}`);
    }
  };

  const handleMedicalNoteChange = (attendanceId: string, note: string) => {
    setMedicalNotes(prev => ({
      ...prev,
      [attendanceId]: note
    }));
  };

  const handleImageUpload = (attendanceId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Convert to base64 for preview (in real app, you'd upload to server)
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setUploadedImages(prev => ({
          ...prev,
          [attendanceId]: result
        }));
        toast.success('Image uploaded successfully');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleExportRegister = async (format: 'csv' | 'excel' | 'pdf') => {
    if (!register || !register.session?.activity?.id) return;
    
    try {
      const token = authService.getToken();
      const activityId = register.session.activity.id;

      const response = await fetch(
        buildApiUrl(`/registers/export-course/${activityId}?format=${format}`),
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to export register');
      }

      // Get filename from response or create one
      const contentDisposition = response.headers.get('content-disposition');
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `register_${new Date().toISOString().split('T')[0]}.${format === 'pdf' ? 'pdf' : format === 'excel' ? 'xls' : 'csv'}`;

      // Get blob and create download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`Register exported as ${format.toUpperCase()} successfully`);
    } catch (error) {
      console.error('Error exporting register:', error);
      toast.error('Failed to export register');
    }
  };

  const removeImage = (attendanceId: string) => {
    setUploadedImages(prev => {
      const newImages = { ...prev };
      delete newImages[attendanceId];
      return newImages;
    });
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

  if (loading) {
    return (
      <BusinessLayout user={user}>
        <div className="bg-white min-h-screen">
          <div className="animate-pulse">
            <div className="h-16 bg-gray-200"></div>
            <div className="p-4">
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </BusinessLayout>
    );
  }

  if (!register) {
    return (
      <BusinessLayout user={user}>
        <div className="bg-white min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Register not found</h3>
            <p className="text-gray-600 mb-4">The register you're looking for doesn't exist or you don't have access to it.</p>
            <button
              onClick={() => navigate('/business/registers')}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              Back to Registers
            </button>
          </div>
        </div>
      </BusinessLayout>
    );
  }

  return (
    <BusinessLayout user={user}>
      {/* Mobile Layout */}
      <div className="block md:hidden">
        <div className="bg-white min-h-screen">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <button
              onClick={() => navigate('/business/registers')}
              className="p-2"
            >
              <ArrowLeftIcon className="h-6 w-6 text-gray-600" />
            </button>
            <h1 className="text-lg font-bold text-gray-900">Register</h1>
            <div className="flex gap-1">
              <button
                onClick={() => handleExportRegister('csv')}
                className="p-2 text-gray-600 hover:text-gray-900"
                title="Export CSV"
              >
                <ArrowDownTrayIcon className="h-5 w-5" />
              </button>
              <button
                onClick={() => handleExportRegister('pdf')}
                className="p-2 text-gray-600 hover:text-gray-900"
                title="Export PDF"
              >
                <DocumentArrowDownIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Event Details */}
          <div className="px-4 py-4">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {register.session.activity.title}
            </h2>
            <p className="text-sm text-gray-600">
              {new Date(register.date).toLocaleDateString('en-GB', {
                month: 'long',
                day: 'numeric'
              })}, {register.session.startTime} · {register.session.activity.venue.name}
            </p>
          </div>

          {/* Participants List */}
          <div className="px-4">
            {register.attendance.map((attendance, index) => (
              <div key={attendance.id} className={`py-4 ${index !== register.attendance.length - 1 ? 'border-b border-gray-200' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900">
                        {attendance.child.firstName} {attendance.child.lastName.charAt(0)}.
                      </h3>
                      {attendance.child.yearGroup && (
                        <span className="text-xs text-gray-500">
                          {attendance.child.yearGroup}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {attendance.child.classGroup || 'Student'}
                    </p>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    {/* Present Button */}
                    <button
                      onClick={() => handleToggleAttendance(attendance.id, true)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        attendance.present 
                          ? 'bg-green-600 text-white shadow-md' 
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      }`}
                    >
                      <CheckIcon className="h-4 w-4" />
                    </button>
                    
                    {/* Absent Button */}
                    <button
                      onClick={() => handleToggleAttendance(attendance.id, false)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        !attendance.present 
                          ? 'bg-red-600 text-white shadow-md' 
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      }`}
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                    
                    {/* Medical Button */}
                    <button
                      onClick={() => {
                        const note = prompt('Medical notes:', medicalNotes[attendance.id] || '');
                        if (note !== null) {
                          handleMedicalNoteChange(attendance.id, note);
                        }
                      }}
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        medicalNotes[attendance.id] 
                          ? 'bg-orange-500 text-white' 
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      <PlusIcon className="h-4 w-4" />
                    </button>
                    
                    {/* Photo Upload Button */}
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(attendance.id, e)}
                        className="absolute inset-0 w-8 h-8 opacity-0 cursor-pointer"
                      />
                      <button
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          uploadedImages[attendance.id] 
                            ? 'bg-teal-500 text-white' 
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        <CameraIcon className="h-4 w-4" />
                      </button>
                    </div>
                    
                    {/* Contact Button */}
                    <button
                      onClick={() => handleContactParent(attendance.booking.parent.phone, attendance.booking.parent.firstName)}
                      className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center"
                    >
                      <PhoneIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Save Button */}
          <div className="px-4 py-6">
            <button
              onClick={handleSaveRegister}
              disabled={saving}
              className="w-full bg-teal-700 hover:bg-teal-800 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : 'Save Register'}
            </button>
            {lastSaved && (
              <p className="text-xs text-gray-500 text-center mt-2">
                Last saved {lastSaved}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:block">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/business/registers')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Register</h1>
                <p className="text-gray-600">Attendance Management</p>
              </div>
            </div>
            
            {/* Export Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => handleExportRegister('csv')}
                className="flex items-center gap-2"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExportRegister('excel')}
                className="flex items-center gap-2"
              >
                <DocumentArrowDownIcon className="h-4 w-4" />
                Excel
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExportRegister('pdf')}
                className="flex items-center gap-2"
              >
                <DocumentArrowDownIcon className="h-4 w-4" />
                PDF
              </Button>
            </div>
          </div>

          {/* Event Details Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {register.session.activity.title}
            </h2>
            <p className="text-gray-600">
              {new Date(register.date).toLocaleDateString('en-GB', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })} · {register.session.startTime} · {register.session.activity.venue.name}
            </p>
          </div>

          {/* Participants List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {register.attendance.map((attendance, index) => (
              <div key={attendance.id} className={`p-6 ${index !== register.attendance.length - 1 ? 'border-b border-gray-200' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-medium text-gray-900">
                        {attendance.child.firstName} {attendance.child.lastName}
                      </h3>
                      {attendance.child.yearGroup && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-sm rounded-md">
                          {attendance.child.yearGroup}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      Parent: {attendance.booking.parent.firstName} {attendance.booking.parent.lastName}
                    </p>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center gap-3">
                    {/* Present Button */}
                    <button
                      onClick={() => handleToggleAttendance(attendance.id, true)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                        attendance.present 
                          ? 'bg-green-600 text-white shadow-md' 
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      }`}
                    >
                      <CheckIcon className="h-5 w-5" />
                    </button>
                    
                    {/* Absent Button */}
                    <button
                      onClick={() => handleToggleAttendance(attendance.id, false)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                        !attendance.present 
                          ? 'bg-red-600 text-white shadow-md' 
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      }`}
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                    
                    {/* Medical Button */}
                    <button
                      onClick={() => {
                        const note = prompt('Medical notes:', medicalNotes[attendance.id] || '');
                        if (note !== null) {
                          handleMedicalNoteChange(attendance.id, note);
                        }
                      }}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                        medicalNotes[attendance.id] 
                          ? 'bg-orange-500 text-white shadow-md' 
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      }`}
                    >
                      <PlusIcon className="h-5 w-5" />
                    </button>
                    
                    {/* Photo Upload Button */}
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(attendance.id, e)}
                        className="absolute inset-0 w-10 h-10 opacity-0 cursor-pointer"
                      />
                      <button
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                          uploadedImages[attendance.id] 
                            ? 'bg-teal-500 text-white shadow-md' 
                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        }`}
                      >
                        <CameraIcon className="h-5 w-5" />
                      </button>
                    </div>
                    
                    {/* Contact Button */}
                    <button
                      onClick={() => handleContactParent(attendance.booking.parent.phone, attendance.booking.parent.firstName)}
                      className="w-10 h-10 rounded-full bg-teal-600 text-white flex items-center justify-center hover:bg-teal-700 transition-colors shadow-md"
                    >
                      <PhoneIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Save Button */}
          <div className="mt-8">
            <button
              onClick={handleSaveRegister}
              disabled={saving}
              className="w-full bg-teal-700 hover:bg-teal-800 disabled:bg-gray-400 text-white font-medium py-4 px-6 rounded-xl transition-colors shadow-md"
            >
              {saving ? 'Saving...' : 'Save Register'}
            </button>
            {lastSaved && (
              <p className="text-sm text-gray-500 text-center mt-3">
                Last saved {lastSaved}
              </p>
            )}
          </div>
        </div>
      </div>
    </BusinessLayout>
  );
};

export default RegisterDetailPage;
