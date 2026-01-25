import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
  ArrowLeftIcon,
  CheckCircleIcon,
  UserIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { authService } from '../../services/authService';
import { buildApiUrl } from '../../config/api';

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
  permissions?: {
    consentToWalkHome: boolean;
    consentToPhotography: boolean;
    consentToFirstAid: boolean;
    consentToEmergencyContact: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

const PermissionsPage: React.FC = () => {
  const navigate = useNavigate();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, {
    consentToWalkHome: boolean;
    consentToPhotography: boolean;
    consentToFirstAid: boolean;
    consentToEmergencyContact: boolean;
  }>>({});

  useEffect(() => {
    fetchChildren();
  }, []);

  const fetchChildren = async () => {
    try {
      setLoading(true);
      const token = authService.getToken();
      
      const response = await fetch(buildApiUrl('/children'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const childrenData = data.data || [];
        setChildren(childrenData);
        
        // Initialize permissions state
        const initialPermissions: Record<string, any> = {};
        childrenData.forEach((child: Child) => {
          initialPermissions[child.id] = {
            consentToWalkHome: child.permissions?.consentToWalkHome ?? null,
            consentToPhotography: child.permissions?.consentToPhotography ?? null,
            consentToFirstAid: child.permissions?.consentToFirstAid ?? null,
            consentToEmergencyContact: child.permissions?.consentToEmergencyContact ?? null,
          };
        });
        setPermissions(initialPermissions);
      } else {
        toast.error('Failed to fetch children');
      }
    } catch (error) {
      toast.error('Error fetching children');
      console.error('Error fetching children:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePermission = (childId: string, permission: string, value: boolean) => {
    setPermissions(prev => ({
      ...prev,
      [childId]: {
        ...prev[childId],
        [permission]: value
      }
    }));
  };

  const savePermissions = async () => {
    try {
      setSaving(true);
      const token = authService.getToken();
      
      // Save permissions for each child
      const promises = Object.entries(permissions).map(async ([childId, childPermissions]) => {
        const response = await fetch(buildApiUrl(`/children/${childId}/permissions`), {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(childPermissions)
        });

        if (!response.ok) {
          throw new Error(`Failed to save permissions for child ${childId}`);
        }
      });

      await Promise.all(promises);
      toast.success('Permissions saved successfully!');
    } catch (error) {
      toast.error('Failed to save permissions');
      console.error('Error saving permissions:', error);
    } finally {
      setSaving(false);
    }
  };

  const getChildDisplayName = (child: Child) => {
    return `${child.firstName} ${child.lastName}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00806a]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Mobile Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 md:hidden">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2"
        >
          <ArrowLeftIcon className="h-6 w-6 text-gray-600" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900">Permissions</h1>
        <div className="w-10"></div>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:block container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Permissions</h1>
            <p className="text-gray-600 mt-2">Manage consent permissions for your children</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 md:px-0 md:py-0 md:container md:mx-auto">
        {children.length === 0 ? (
          <div className="text-center py-12">
            <UserIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No children added yet</h3>
            <p className="text-gray-600 mb-4">Add your children first to manage their permissions.</p>
            <Button onClick={() => navigate('/children')}>
              Add Child
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {children.map((child, index) => (
              <Card key={child.id}>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <UserIcon className="w-5 h-5 mr-2 text-gray-500" />
                    Child {index + 1}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Child Name Input */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Name
                      </label>
                      <Input
                        value={getChildDisplayName(child)}
                        readOnly
                        className="bg-gray-50"
                      />
                    </div>

                    {/* Permissions */}
                    <div className="space-y-6">
                      {/* Consent to walk home */}
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-900">
                          Consent to walk home
                        </label>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={permissions[child.id]?.consentToWalkHome || false}
                            onChange={(e) => updatePermission(child.id, 'consentToWalkHome', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                        </label>
                      </div>

                      {/* Consent to be photographed */}
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-900">
                          Consent to be photographed
                        </label>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={permissions[child.id]?.consentToPhotography || false}
                            onChange={(e) => updatePermission(child.id, 'consentToPhotography', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                        </label>
                      </div>

                      {/* Consent to first aid */}
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-900">
                          Consent to my child to receive first aid
                        </label>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={permissions[child.id]?.consentToFirstAid || false}
                            onChange={(e) => updatePermission(child.id, 'consentToFirstAid', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-6">
              <Button
                variant="outline"
                onClick={() => navigate(-1)}
                className="flex-1"
              >
                Finished
              </Button>
              <Button
                onClick={() => navigate('/activities')}
                className="flex-1 bg-[#00806a] hover:bg-[#006b5a]"
              >
                Book an activity
              </Button>
            </div>

            {/* Save Button */}
            <div className="pt-4">
              <Button
                onClick={savePermissions}
                disabled={saving}
                className="w-full"
              >
                {saving ? 'Saving...' : 'Save Permissions'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PermissionsPage;
