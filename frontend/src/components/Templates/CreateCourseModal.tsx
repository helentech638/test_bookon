import React, { useState, useEffect } from 'react';
import { 
  XMarkIcon,
  CalendarDaysIcon,
  MapPinIcon,
  ClockIcon,
  CurrencyPoundIcon,
  UserGroupIcon,
  PhotoIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { Button } from '../ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import toast from 'react-hot-toast';
import { authService } from '../../services/authService';
import { buildApiUrl } from '../../config/api';

interface Template {
  id: string;
  name: string;
  type: string;
  years: string;
  description?: string;
  whatToBring?: string;
  defaultPrice?: number | string;
  defaultCapacity?: number;
  flags?: {
    photo_consent_required: boolean;
    medical_reminder: boolean;
  };
  tags: string[];
  imageUrl?: string;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  creator: {
    firstName: string;
    lastName: string;
  };
  _count: {
    courses: number;
  };
}

interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
}

interface CreateCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: Template | null;
  onSuccess: () => void;
}

const CreateCourseModal: React.FC<CreateCourseModalProps> = ({
  isOpen,
  onClose,
  template,
  onSuccess
}) => {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    venueIds: [] as string[],
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    price: '',
    capacity: '',
    weekday: '',
    time: '',
    extras: '',
    requiresPhotoConsent: false,
    requiresMedicalReminder: false
  });

  useEffect(() => {
    if (isOpen) {
      fetchVenues();
      if (template) {
        setFormData({
          name: template.name,
          description: template.description || '',
          venueIds: [],
          startDate: '',
          endDate: '',
          startTime: '',
          endTime: '',
          price: template.defaultPrice?.toString() || '0',
          capacity: template.defaultCapacity?.toString() || '0',
          weekday: '',
          time: '',
          extras: '',
          requiresPhotoConsent: template.flags?.photo_consent_required || false,
          requiresMedicalReminder: template.flags?.medical_reminder || false
        });
      }
    }
  }, [isOpen, template]);

  const fetchVenues = async () => {
    try {
      const token = authService.getToken();
      if (!token) return;

      const response = await fetch(buildApiUrl('/venues'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setVenues(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching venues:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!template) return;

    try {
      setLoading(true);
      const token = authService.getToken();
      if (!token) return;

      const response = await fetch(buildApiUrl('/courses'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateId: template.id,
          venueIds: formData.venueIds,
          name: formData.name || template.name,
          type: template.type,
          years: template.years,
          price: formData.price || template.defaultPrice,
          capacity: formData.capacity || template.defaultCapacity,
          startDate: formData.startDate,
          endDate: formData.endDate,
          weekday: formData.weekday || null,
          time: formData.time || null,
          extras: formData.extras || null
        })
      });

      if (response.ok) {
        toast.success('Course created successfully!');
        onSuccess();
        onClose();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create course');
      }
    } catch (error) {
      console.error('Create course error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create course');
    } finally {
      setLoading(false);
    }
  };

  const handleVenueToggle = (venueId: string) => {
    setFormData(prev => ({
      ...prev,
      venueIds: prev.venueIds.includes(venueId)
        ? prev.venueIds.filter(id => id !== venueId)
        : [...prev.venueIds, venueId]
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              Create Course from Template
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Template Info */}
          {template && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Template Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">{template.name}</h3>
                    <p className="text-sm text-gray-600">{template.type} • {template.years}</p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                      £{template.defaultPrice} per session
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {template.defaultCapacity} capacity
                    </span>
                  </div>
                </div>
                {template.description && (
                  <p className="text-sm text-gray-600 mt-2">{template.description}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Course Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Course Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Course Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date *
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Time *
                  </label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price per Session (£) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Capacity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.capacity}
                    onChange={(e) => setFormData(prev => ({ ...prev, capacity: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Weekday
                  </label>
                  <select
                    value={formData.weekday}
                    onChange={(e) => setFormData(prev => ({ ...prev, weekday: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  >
                    <option value="">Select weekday</option>
                    <option value="Monday">Monday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Thursday">Thursday</option>
                    <option value="Friday">Friday</option>
                    <option value="Saturday">Saturday</option>
                    <option value="Sunday">Sunday</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Time
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., 15:30-16:30"
                    value={formData.time}
                    onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Extras
                  </label>
                  <input
                    type="text"
                    placeholder="Additional information"
                    value={formData.extras}
                    onChange={(e) => setFormData(prev => ({ ...prev, extras: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Venue Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Select Venues *</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {venues.map((venue) => (
                  <div
                    key={venue.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      formData.venueIds.includes(venue.id)
                        ? 'border-teal-500 bg-teal-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                    onClick={() => handleVenueToggle(venue.id)}
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={formData.venueIds.includes(venue.id)}
                        onChange={() => handleVenueToggle(venue.id)}
                        className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                      />
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{venue.name}</h4>
                        <p className="text-sm text-gray-600">{venue.address}, {venue.city}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {formData.venueIds.length === 0 && (
                <p className="text-sm text-red-600 mt-2">Please select at least one venue</p>
              )}
            </CardContent>
          </Card>

          {/* Options */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Course Options</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="photoConsent"
                    checked={formData.requiresPhotoConsent}
                    onChange={(e) => setFormData(prev => ({ ...prev, requiresPhotoConsent: e.target.checked }))}
                    className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                  />
                  <label htmlFor="photoConsent" className="ml-3 flex items-center">
                    <PhotoIcon className="h-4 w-4 mr-2 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">Requires Photo Consent</span>
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="medicalReminder"
                    checked={formData.requiresMedicalReminder}
                    onChange={(e) => setFormData(prev => ({ ...prev, requiresMedicalReminder: e.target.checked }))}
                    className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                  />
                  <label htmlFor="medicalReminder" className="ml-3 flex items-center">
                    <ExclamationTriangleIcon className="h-4 w-4 mr-2 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">Requires Medical Reminder</span>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || formData.venueIds.length === 0}
            >
              {loading ? 'Creating...' : 'Create Course'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateCourseModal;
