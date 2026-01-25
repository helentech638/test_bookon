import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, UserIcon } from '@heroicons/react/24/outline';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import authService from '../../services/authService';
import { buildApiUrl } from '../../config/api';
import toast from 'react-hot-toast';

interface Child {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  yearGroup?: string;
  allergies?: string;
  medicalInfo?: string;
  school?: string;
  class?: string;
  createdAt: string;
  updatedAt: string;
}

interface ChildPermissions {
  id: string;
  childId: string;
  consentToWalkHome: boolean;
  consentToPhotography: boolean;
  consentToFirstAid: boolean;
  consentToEmergencyContact: boolean;
}

const SingleChildPermissionsPage: React.FC = () => {
  const { childId } = useParams<{ childId: string }>();
  const navigate = useNavigate();
  
  const [child, setChild] = useState<Child | null>(null);
  const [permissions, setPermissions] = useState<ChildPermissions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch child details
        const childResponse = await fetch(buildApiUrl(`/children/${childId}`), {
          headers: {
            'Authorization': `Bearer ${authService.getToken()}`
          }
        });
        
        if (!childResponse.ok) throw new Error('Failed to fetch child');
        const childData = await childResponse.json();
        setChild(childData.data);

        // Fetch permissions
        const permissionsResponse = await fetch(buildApiUrl(`/child-permissions/${childId}`), {
          headers: {
            'Authorization': `Bearer ${authService.getToken()}`
          }
        });
        
        if (!permissionsResponse.ok) throw new Error('Failed to fetch permissions');
        const permissionsData = await permissionsResponse.json();
        setPermissions(permissionsData.data);
        
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load child permissions');
        toast.error('Failed to load child permissions');
      } finally {
        setIsLoading(false);
      }
    };

    if (childId) {
      fetchData();
    }
  }, [childId]);

  const handlePermissionChange = (permission: keyof Omit<ChildPermissions, 'id' | 'childId'>) => {
    if (!permissions) return;
    
    setPermissions(prev => prev ? {
      ...prev,
      [permission]: !prev[permission]
    } : null);
  };

  const handleSave = async () => {
    if (!permissions || !childId) return;
    
    try {
      setIsSaving(true);
      const token = authService.getToken();
      
      const response = await fetch(buildApiUrl(`/child-permissions/${childId}`), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          consentToWalkHome: permissions.consentToWalkHome,
          consentToPhotography: permissions.consentToPhotography,
          consentToFirstAid: permissions.consentToFirstAid,
          consentToEmergencyContact: permissions.consentToEmergencyContact
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save permissions');
      }

      toast.success('Permissions saved successfully!');
      navigate('/children');
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast.error('Failed to save permissions');
    } finally {
      setIsSaving(false);
    }
  };

  const getChildDisplayName = (child: Child) => {
    return `${child.firstName} ${child.lastName}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00806a]"></div>
        </div>
      </div>
    );
  }

  if (error || !child || !permissions) {
    return (
      <div className="min-h-screen bg-white">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
            <p className="text-gray-600 mb-4">{error || 'Child not found'}</p>
            <Button onClick={() => navigate('/children')}>
              Back to Children
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="md:hidden bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 py-4">
          <button
            onClick={() => navigate('/children')}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <ArrowLeftIcon className="h-6 w-6 text-gray-600" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Permissions</h1>
          <div className="w-10"></div>
        </div>
        <div className="px-4 pb-4">
          <p className="text-sm text-gray-600">Set permissions for {getChildDisplayName(child)}</p>
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:block bg-white shadow-sm">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Permissions</h1>
              <p className="text-gray-600 mt-2">Set permissions for {getChildDisplayName(child)}</p>
            </div>
            <button
              onClick={() => navigate('/children')}
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Back to Children
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 md:px-6 md:py-8 max-w-4xl">
        <Card className="shadow-lg">
          <CardHeader className="bg-white border-b border-gray-200">
            <CardTitle className="flex items-center text-xl">
              <UserIcon className="w-6 h-6 mr-3 text-gray-500" />
              <span className="text-gray-900">{getChildDisplayName(child)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              {/* Child Name Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Child Name
                </label>
                <Input
                  value={getChildDisplayName(child)}
                  readOnly
                  className="bg-gray-50 border-gray-200 text-gray-900"
                />
              </div>

              {/* Permissions Section */}
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
                  Permission Settings
                </h3>
                
                {/* Consent to walk home */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-white border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-900 block mb-1">
                      Consent to walk home
                    </label>
                    <p className="text-xs text-gray-500">
                      Allow child to walk home independently after activities
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={permissions.consentToWalkHome}
                      onChange={() => handlePermissionChange('consentToWalkHome')}
                      className="sr-only peer"
                    />
                    <div className="w-12 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>

                {/* Consent to be photographed */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-white border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-900 block mb-1">
                      Consent to be photographed
                    </label>
                    <p className="text-xs text-gray-500">
                      Allow photos/videos to be taken during activities
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={permissions.consentToPhotography}
                      onChange={() => handlePermissionChange('consentToPhotography')}
                      className="sr-only peer"
                    />
                    <div className="w-12 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>

                {/* Consent to first aid */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-white border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-900 block mb-1">
                      Consent to first aid treatment
                    </label>
                    <p className="text-xs text-gray-500">
                      Allow first aid treatment in case of injury or illness
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={permissions.consentToFirstAid}
                      onChange={() => handlePermissionChange('consentToFirstAid')}
                      className="sr-only peer"
                    />
                    <div className="w-12 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>

                {/* Consent to emergency contact */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-white border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-900 block mb-1">
                      Consent to emergency contact
                    </label>
                    <p className="text-xs text-gray-500">
                      Allow emergency services to be contacted if needed
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={permissions.consentToEmergencyContact}
                      onChange={() => handlePermissionChange('consentToEmergencyContact')}
                      className="sr-only peer"
                    />
                    <div className="w-12 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="mt-8 space-y-4">
          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-[#00806a] hover:bg-[#006b5a] text-white py-3 text-base font-medium"
          >
            {isSaving ? 'Saving...' : 'Save Permissions'}
          </Button>

          {/* Navigation Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={() => navigate('/children')}
              className="flex-1 py-3 text-base font-medium border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Finished
            </Button>
            <Button
              onClick={() => navigate('/activities')}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 text-base font-medium"
            >
              Book an Activity
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SingleChildPermissionsPage;
