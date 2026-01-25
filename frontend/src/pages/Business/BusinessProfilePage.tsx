import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { toast } from 'react-hot-toast';
import { buildApiUrl } from '../../config/api';
import { 
  BuildingOfficeIcon,
  GlobeAltIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  DocumentTextIcon,
  PencilIcon
} from '@heroicons/react/24/outline';

interface BusinessProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  businessName: string;
  tradingName: string;
  companyRegistrationNumber: string;
  businessType: string;
  businessDescription: string;
  websiteUrl: string;
  businessPhone: string;
  businessEmail: string;
  businessAddress: string;
  businessCity: string;
  businessPostcode: string;
  businessCountry: string;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

const BusinessProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [formData, setFormData] = useState<Partial<BusinessProfile>>({});

  const businessTypes = [
    'Sole Trader',
    'Limited Company (Ltd)',
    'Public Limited Company (PLC)',
    'Partnership',
    'Limited Liability Partnership (LLP)',
    'Charity',
    'Community Interest Company (CIC)',
    'Franchise',
    'Other'
  ];

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('bookon_token');
      const response = await fetch(buildApiUrl('/auth/business-profile'), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }

      const data = await response.json();
      setProfile(data.data.user);
      setFormData(data.data.user);
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load business profile');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof BusinessProfile, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('bookon_token');
      const response = await fetch(buildApiUrl('/auth/business-profile'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update profile');
      }

      const data = await response.json();
      setProfile(data.data.user);
      setEditing(false);
      toast.success('Business profile updated successfully!');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData(profile || {});
    setEditing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[#00806a] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading business profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Failed to load business profile</p>
          <Button onClick={() => navigate('/business/dashboard')} className="mt-4">
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Business Profile</h1>
          <p className="text-gray-600 mt-2">Manage your business information</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Business Information */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <BuildingOfficeIcon className="w-5 h-5 mr-2 text-[#00806a]" />
                    Business Information
                  </CardTitle>
                  {!editing && (
                    <Button
                      onClick={() => setEditing(true)}
                      variant="outline"
                      size="sm"
                    >
                      <PencilIcon className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Business Name *
                    </label>
                    <Input
                      value={formData.businessName || ''}
                      onChange={(e) => handleInputChange('businessName', e.target.value)}
                      disabled={!editing}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Trading Name
                    </label>
                    <Input
                      value={formData.tradingName || ''}
                      onChange={(e) => handleInputChange('tradingName', e.target.value)}
                      disabled={!editing}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Business Type *
                    </label>
                    <Select
                      value={formData.businessType || ''}
                      onChange={(e) => handleInputChange('businessType', e.target.value)}
                      disabled={!editing}
                      required
                    >
                      <option value="">Select business type</option>
                      {businessTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Company Registration Number
                    </label>
                    <Input
                      value={formData.companyRegistrationNumber || ''}
                      onChange={(e) => handleInputChange('companyRegistrationNumber', e.target.value)}
                      disabled={!editing}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Business Description
                  </label>
                  <Textarea
                    value={formData.businessDescription || ''}
                    onChange={(e) => handleInputChange('businessDescription', e.target.value)}
                    disabled={!editing}
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <PhoneIcon className="w-5 h-5 mr-2 text-[#00806a]" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Business Phone *
                    </label>
                    <Input
                      value={formData.businessPhone || ''}
                      onChange={(e) => handleInputChange('businessPhone', e.target.value)}
                      disabled={!editing}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Business Email *
                    </label>
                    <Input
                      type="email"
                      value={formData.businessEmail || ''}
                      onChange={(e) => handleInputChange('businessEmail', e.target.value)}
                      disabled={!editing}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Website URL
                  </label>
                  <Input
                    value={formData.websiteUrl || ''}
                    onChange={(e) => handleInputChange('websiteUrl', e.target.value)}
                    disabled={!editing}
                    placeholder="https://your-website.com"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Business Address */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MapPinIcon className="w-5 h-5 mr-2 text-[#00806a]" />
                  Business Address
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address *
                  </label>
                  <Textarea
                    value={formData.businessAddress || ''}
                    onChange={(e) => handleInputChange('businessAddress', e.target.value)}
                    disabled={!editing}
                    rows={3}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City *
                    </label>
                    <Input
                      value={formData.businessCity || ''}
                      onChange={(e) => handleInputChange('businessCity', e.target.value)}
                      disabled={!editing}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Postcode *
                    </label>
                    <Input
                      value={formData.businessPostcode || ''}
                      onChange={(e) => handleInputChange('businessPostcode', e.target.value)}
                      disabled={!editing}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Country
                    </label>
                    <Select
                      value={formData.businessCountry || 'United Kingdom'}
                      onChange={(e) => handleInputChange('businessCountry', e.target.value)}
                      disabled={!editing}
                    >
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="United States">United States</option>
                      <option value="Canada">Canada</option>
                      <option value="Australia">Australia</option>
                      <option value="Other">Other</option>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Account Status */}
            <Card>
              <CardHeader>
                <CardTitle>Account Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Onboarding</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      profile.onboardingCompleted 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {profile.onboardingCompleted ? 'Completed' : 'Pending'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Account Type</span>
                    <span className="text-sm font-medium">Business</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Member Since</span>
                    <span className="text-sm font-medium">
                      {new Date(profile.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            {editing && (
              <Card>
                <CardHeader>
                  <CardTitle>Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button
                    onClick={handleCancel}
                    variant="outline"
                    className="w-full"
                  >
                    Cancel
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessProfilePage;





