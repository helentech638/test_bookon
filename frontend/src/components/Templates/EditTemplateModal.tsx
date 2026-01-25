import React, { useState, useEffect } from 'react';
import { 
  XMarkIcon,
  PhotoIcon,
  ExclamationTriangleIcon,
  TagIcon,
  ExclamationCircleIcon
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

interface EditTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: Template | null;
  onSuccess: () => void;
}

const EditTemplateModal: React.FC<EditTemplateModalProps> = ({
  isOpen,
  onClose,
  template,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'activity',
    years: 'Y1-Y2',
    description: '',
    defaultPrice: '',
    defaultCapacity: '',
    requiresPhotoConsent: false,
    requiresMedicalReminder: false,
    tags: [] as string[],
    image: ''
  });
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    if (isOpen && template) {
      setFormData({
        name: template.name,
        type: template.type,
        years: template.years,
        description: template.description || '',
        defaultPrice: template.defaultPrice?.toString() || '0',
        defaultCapacity: template.defaultCapacity?.toString() || '0',
        requiresPhotoConsent: template.flags?.photo_consent_required || false,
        requiresMedicalReminder: template.flags?.medical_reminder || false,
        tags: template.tags || [],
        image: template.imageUrl || ''
      });
    }
  }, [isOpen, template]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!template) return;

    try {
      setLoading(true);
      const token = authService.getToken();
      if (!token) return;

      const response = await fetch(buildApiUrl(`/templates/${template.id}`), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          defaultPrice: formData.defaultPrice ? parseFloat(formData.defaultPrice) : null,
          defaultCapacity: formData.defaultCapacity ? parseInt(formData.defaultCapacity) : null,
          flags: {
            requiresPhotoConsent: formData.requiresPhotoConsent,
            requiresMedicalReminder: formData.requiresMedicalReminder
          },
          imageUrl: formData.image
        })
      });

      if (response.ok) {
        toast.success('Template updated successfully!');
        onSuccess();
        onClose();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update template');
      }
    } catch (error) {
      console.error('Update template error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update template');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  if (!isOpen || !template) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Edit Template</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Warning Banner */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex">
              <ExclamationCircleIcon className="h-5 w-5 text-yellow-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Important Notice
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    Changes to this template will only affect future courses created from it. 
                    Existing courses will not be modified.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    required
                  >
                    <option value="activity">Activity</option>
                    <option value="holiday_club">Holiday Club</option>
                    <option value="wraparound_care">Wraparound Care</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Year Group *
                  </label>
                  <select
                    value={formData.years}
                    onChange={(e) => setFormData(prev => ({ ...prev, years: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    required
                  >
                    <option value="Y1-Y2">Y1-Y2</option>
                    <option value="Y3-Y4">Y3-Y4</option>
                    <option value="Y5-Y6">Y5-Y6</option>
                    <option value="Y7+">Y7+</option>
                    <option value="All">All Ages</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Photo
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setFormData(prev => ({ ...prev, image: event.target?.result as string }));
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
                {formData.image && (
                  <div className="mt-2">
                    <img 
                      src={formData.image} 
                      alt="Template preview" 
                      className="w-32 h-32 object-cover rounded-lg border"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Default Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Default Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Price (£) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.defaultPrice}
                    onChange={(e) => setFormData(prev => ({ ...prev, defaultPrice: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Capacity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.defaultCapacity}
                    onChange={(e) => setFormData(prev => ({ ...prev, defaultCapacity: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tags</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  placeholder="Add a tag..."
                />
                <Button
                  type="button"
                  onClick={handleAddTag}
                  disabled={!newTag.trim()}
                  variant="outline"
                >
                  Add
                </Button>
              </div>
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-teal-100 text-teal-800"
                    >
                      <TagIcon className="h-3 w-3 mr-1" />
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-2 text-teal-600 hover:text-teal-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Options */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Template Options</CardTitle>
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
              disabled={loading}
            >
              {loading ? 'Updating...' : 'Update Template'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTemplateModal;
