import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import BusinessLayout from '../../components/layout/BusinessLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { 
  DocumentDuplicateIcon, 
  PlusIcon, 
  PencilIcon, 
  TrashIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  CalendarDaysIcon,
  ClockIcon,
  UsersIcon,
  CurrencyPoundIcon,
  TagIcon,
  PhotoIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import authService from '../../services/authService';
import { buildApiUrl } from '../../config/api';

interface ActivityTemplate {
  id: string;
  name: string;
  description: string;
  type: 'activity' | 'holiday_club' | 'wraparound_care';
  years: string; // Added years field
  ageRange: {
    min: number;
    max: number;
  };
  duration: number; // in minutes
  capacity: number;
  price: number;
  currency: string;
  category: string;
  tags: string[];
  imageUrl?: string;
  requirements: string[];
  objectives: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const TemplatesPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<ActivityTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ActivityTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'activity' as 'activity' | 'holiday_club' | 'wraparound_care',
    years: 'Reception-Year 6', // Added years field with default value
    ageRange: { min: 5, max: 12 },
    duration: 60,
    capacity: 20,
    price: 0,
    currency: 'GBP',
    category: '',
    tags: [] as string[],
    imageUrl: '',
    requirements: [] as string[],
    objectives: [] as string[]
  });

  const activityTypes = [
    { value: 'activity', label: 'Activity' },
    { value: 'holiday_club', label: 'Holiday Club' },
    { value: 'wraparound_care', label: 'Wraparound Care' }
  ];

  const categories = [
    'Sports', 'Arts & Crafts', 'Music', 'Dance', 'Science', 'Technology', 
    'Languages', 'Cooking', 'Outdoor Activities', 'Academic Support'
  ];

  useEffect(() => {
    fetchTemplates();
  }, [searchTerm, typeFilter, categoryFilter, statusFilter]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const token = authService.getToken();
      if (!token) {
        navigate('/login');
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

      const response = await fetch(buildApiUrl('/templates'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }

      const data = await response.json();
      console.log('Templates API response:', data); // Debug log
      if (data.success) {
        // Transform API data to match our interface
        const transformedTemplates: ActivityTemplate[] = data.data.map((template: any) => ({
          id: template.id,
          name: template.name,
          description: template.description || '',
          type: template.type || 'activity',
          years: template.years || 'All Ages', // Added years field
          ageRange: { min: 5, max: 12 }, // Default since backend doesn't have this
          duration: 60, // Default since backend doesn't have this
          capacity: template.defaultCapacity || 20,
          price: template.defaultPrice || 0,
          currency: 'GBP', // Default since backend doesn't have this
          category: '', // Default since backend doesn't have this
          tags: template.tags || [],
          imageUrl: template.imageUrl || '',
          requirements: [], // Default since backend doesn't have this
          objectives: [], // Default since backend doesn't have this
          isActive: template.status === 'active',
          createdAt: template.createdAt,
          updatedAt: template.updatedAt
        }));
        setTemplates(transformedTemplates);
      } else {
        throw new Error(data.message || 'Failed to fetch templates');
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        toast.error('Templates loading timeout - please refresh');
      } else {
        toast.error('Failed to load templates');
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || template.type === typeFilter;
    const matchesCategory = categoryFilter === 'all' || template.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && template.isActive) ||
                         (statusFilter === 'inactive' && !template.isActive);
    
    console.log('Template filtering:', {
      templateName: template.name,
      matchesSearch,
      matchesType,
      matchesCategory,
      matchesStatus,
      isActive: template.isActive,
      statusFilter,
      typeFilter,
      categoryFilter
    }); // Debug log
    
    return matchesSearch && matchesType && matchesCategory && matchesStatus;
  });

  const handleDeleteTemplate = async (templateId: string) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      try {
        const token = authService.getToken();
        if (!token) {
          navigate('/login');
          return;
        }

        const response = await fetch(buildApiUrl(`/templates/${templateId}`), {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to delete template');
        }

        const data = await response.json();
        if (data.success) {
          setTemplates(prev => prev.filter(t => t.id !== templateId));
          toast.success('Template deleted successfully');
        } else {
          throw new Error(data.message || 'Failed to delete template');
        }
      } catch (error) {
        console.error('Error deleting template:', error);
        toast.error('Failed to delete template');
      }
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const token = authService.getToken();
      if (!token) {
        toast.error('Please log in to save template');
        return;
      }

      const url = editingTemplate 
        ? buildApiUrl(`/templates/${editingTemplate.id}`)
        : buildApiUrl('/templates/business');
      
      const method = editingTemplate ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          image: formData.imageUrl,
          defaultPrice: formData.price,
          defaultCapacity: formData.capacity,
          requiresPhotoConsent: false,
          requiresMedicalReminder: false,
          tags: formData.tags
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save template');
      }

      const data = await response.json();
      console.log('Template creation response:', data); // Debug log
      if (data.success) {
        toast.success(editingTemplate ? 'Template updated successfully!' : 'Template created successfully!');
        setShowCreateModal(false);
        setEditingTemplate(null);
        resetForm();
        fetchTemplates();
      } else {
        throw new Error(data.message || 'Failed to save template');
      }
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Failed to save template');
    }
  };

  const handleEdit = (template: ActivityTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description,
      type: template.type,
      years: template.years, // Added years field
      ageRange: template.ageRange,
      duration: template.duration,
      capacity: template.capacity,
      price: template.price,
      currency: template.currency,
      category: template.category,
      tags: template.tags,
      imageUrl: template.imageUrl || '',
      requirements: template.requirements,
      objectives: template.objectives
    });
    setShowCreateModal(true);
  };

  const handleDelete = async (templateId: string) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      try {
        const token = authService.getToken();
        if (!token) {
          toast.error('Please log in to delete template');
          return;
        }

        const response = await fetch(buildApiUrl(`/templates/${templateId}`), {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to delete template');
        }

        const data = await response.json();
        if (data.success) {
          toast.success('Template deleted successfully');
          fetchTemplates();
        } else {
          throw new Error(data.message || 'Failed to delete template');
        }
      } catch (error) {
        console.error('Error deleting template:', error);
        toast.error('Failed to delete template');
      }
    }
  };

  const handleToggleStatus = async (templateId: string) => {
    try {
      const token = authService.getToken();
      if (!token) {
        toast.error('Please log in to update template');
        return;
      }

      const response = await fetch(buildApiUrl(`/templates/${templateId}/toggle`), {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to toggle template status');
      }

      const data = await response.json();
      if (data.success) {
        setTemplates(prev => prev.map(t => 
          t.id === templateId ? { ...t, isActive: !t.isActive } : t
        ));
        toast.success('Template status updated');
      } else {
        throw new Error(data.message || 'Failed to update template');
      }
    } catch (error) {
      console.error('Error updating template:', error);
      toast.error('Failed to update template');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      type: 'activity',
      years: 'Reception-Year 6', // Added years field with default value
      ageRange: { min: 5, max: 12 },
      duration: 60,
      capacity: 20,
      price: 0,
      currency: 'GBP',
      category: '',
      tags: [],
      imageUrl: '',
      requirements: [],
      objectives: []
    });
  };

  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    resetForm();
    setShowCreateModal(true);
  };

  if (loading) {
    return (
      <BusinessLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
        </div>
      </BusinessLayout>
    );
  }

  // If creating or editing a template, show the form page
  if (showCreateModal) {
    return (
      <BusinessLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="mb-6">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingTemplate(null);
                  resetForm();
                }}
                className="flex items-center gap-2"
              >
                ← Back to Templates
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {editingTemplate ? 'Edit Activity Template' : 'Create Activity Template'}
                </h1>
                <p className="text-gray-600 mt-1">
                  {editingTemplate ? 'Update your activity template' : 'Create a new activity template for your catalogue'}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Template Name *</label>
                  <Input
                    type="text"
                    value={formData.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Beginner Swimming Course"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Activity Type *</label>
                  <Select
                    value={formData.type}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                  >
                    {activityTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </Select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year Groups *</label>
                <Input
                  type="text"
                  value={formData.years}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, years: e.target.value }))}
                  placeholder="e.g., Reception-Year 6, Year 7-11, EYFS"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={formData.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  placeholder="Describe what this activity is about..."
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template Photo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setFormData(prev => ({ ...prev, imageUrl: event.target?.result as string }));
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                {formData.imageUrl && (
                  <div className="mt-2">
                    <img 
                      src={formData.imageUrl} 
                      alt="Template preview" 
                      className="w-32 h-32 object-cover rounded-lg border"
                    />
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingTemplate(null);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-green-600 hover:bg-green-700">
                  {editingTemplate ? 'Update Template' : 'Create Template'}
                </Button>
            </div>
            </form>
          </div>
        </div>
      </BusinessLayout>
    );
  }

  return (
    <BusinessLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Activity Templates</h1>
            <p className="text-gray-600 mt-1">Create and manage activity templates for your catalogue</p>
          </div>
          <Button className="flex items-center gap-2" onClick={handleCreateTemplate}>
            <PlusIcon className="h-5 w-5" />
            Create Template
          </Button>
        </div>

        {/* Filters */}
        <Card className="p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="all">All Types</option>
                {activityTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm('');
                  setTypeFilter('all');
                  setCategoryFilter('all');
                  setStatusFilter('all');
                }}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </Card>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <DocumentDuplicateIcon className="h-8 w-8 text-green-500" />
                  <div>
                    <h3 className="font-semibold text-gray-900">{template.name}</h3>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      template.type === 'activity' ? 'bg-blue-100 text-blue-800' :
                      template.type === 'holiday_club' ? 'bg-green-100 text-green-800' :
                      'bg-purple-100 text-purple-800'
                    }`}>
                      {template.type.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleStatus(template.id)}
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      template.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {template.isActive ? 'Active' : 'Inactive'}
                  </button>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-4 line-clamp-2">{template.description}</p>

              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div className="flex items-center gap-1">
                  <UsersIcon className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">Ages:</span>
                  <span className="font-medium">{template.ageRange.min}-{template.ageRange.max}</span>
                </div>
                <div className="flex items-center gap-1">
                  <ClockIcon className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-medium">{template.duration}min</span>
                </div>
                <div className="flex items-center gap-1">
                  <UsersIcon className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">Capacity:</span>
                  <span className="font-medium">{template.capacity}</span>
                </div>
                <div className="flex items-center gap-1">
                  <CurrencyPoundIcon className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">Price:</span>
                  <span className="font-medium">{template.currency} {template.price}</span>
                </div>
              </div>

              {template.category && (
                <div className="mb-4">
                  <div className="flex items-center gap-1">
                    <TagIcon className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600">Category:</span>
                    <span className="text-sm font-medium">{template.category}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-xs text-gray-500">
                  Updated {new Date(template.updatedAt).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleEdit(template)}
                    className="p-1 text-gray-400 hover:text-blue-600"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(template.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {filteredTemplates.length === 0 && (
          <Card className="p-12 text-center">
            <DocumentDuplicateIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || typeFilter !== 'all' || categoryFilter !== 'all' || statusFilter !== 'all' 
                ? 'Try adjusting your search criteria'
                : 'Get started by creating your first activity template'
              }
            </p>
            <Button onClick={handleCreateTemplate}>
              <PlusIcon className="h-5 w-5 mr-2" />
              Create Template
            </Button>
          </Card>
        )}

        {/* Modal removed - now using page-based form */}
      </div>
    </BusinessLayout>
  );
};

export default TemplatesPage;
