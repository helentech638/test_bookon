import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  UserIcon,
  CalendarIcon,
  ExclamationTriangleIcon,
  HeartIcon,
  ShieldCheckIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import ChildForm from '../../components/children/ChildForm';
import { authService } from '../../services/authService';
import { useNavigate } from 'react-router-dom';

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

const ChildrenPage: React.FC = () => {
  const navigate = useNavigate();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);

  useEffect(() => {
    fetchChildren();
  }, []);

  const fetchChildren = async () => {
    try {
      setLoading(true);
      const token = authService.getToken();
      
      const response = await fetch('/api/v1/children', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setChildren(data.data || []);
      } else {
        const errorData = await response.json();
        setError(errorData.error?.message || 'Failed to fetch children');
      }
    } catch (error) {
      setError('Error fetching children');
    } finally {
      setLoading(false);
    }
  };


  const handleEditChild = async (childData: Omit<Child, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!selectedChild) return;

    try {
      const token = authService.getToken();
      
      const response = await fetch(`/api/v1/children/${selectedChild.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(childData)
      });

      if (response.ok) {
        const data = await response.json();
        setChildren(prev => prev.map(child => 
          child.id === selectedChild.id ? data.data : child
        ));
        setShowEditModal(false);
        setSelectedChild(null);
        toast.success('Child updated successfully');
      } else {
        const errorData = await response.json();
        toast.error(errorData.error?.message || 'Failed to update child');
      }
    } catch (error) {
      toast.error('Error updating child');
    }
  };

  const handleDeleteChild = async () => {
    if (!selectedChild) return;

    try {
      const token = authService.getToken();
      
      const response = await fetch(`/api/v1/children/${selectedChild.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setChildren(prev => prev.filter(child => child.id !== selectedChild.id));
        setShowDeleteModal(false);
        setSelectedChild(null);
        toast.success('Child deleted successfully');
      } else {
        toast.error('Failed to delete child');
      }
    } catch (error) {
      toast.error('Error deleting child');
    }
  };

  const openEditModal = (child: Child) => {
    setSelectedChild(child);
    setShowEditModal(true);
  };

  const openDeleteModal = (child: Child) => {
    setSelectedChild(child);
    setShowDeleteModal(true);
  };

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading children...</p>
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
        <h1 className="text-lg font-semibold text-gray-900">My Children</h1>
        <button
          onClick={() => navigate('/children/new')}
          className="p-2 -mr-2"
        >
          <PlusIcon className="h-6 w-6 text-[#00806a]" />
        </button>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:block container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Children</h1>
            <p className="text-gray-600 mt-2">Manage your children's information and preferences</p>
          </div>
          <Button onClick={() => navigate('/children/new')}>
            <PlusIcon className="w-5 h-5 mr-2" />
            Add Child
          </Button>
        </div>
      </div>

      <div className="px-4 py-6 md:px-0 md:py-0 md:container md:mx-auto">

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <div className="flex">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-400 mr-2" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {children.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <UserIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No children added yet</h3>
            <p className="text-gray-600 mb-6">Add your children to start booking activities for them.</p>
            <Button onClick={() => navigate('/children/new')}>
              <PlusIcon className="w-5 h-5 mr-2" />
              Add Your First Child
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {children.map((child) => (
            <Card key={child.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                      <UserIcon className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-semibold">
                        {child.firstName} {child.lastName}
                      </CardTitle>
                      <p className="text-sm text-gray-600 flex items-center">
                        <CalendarIcon className="w-4 h-4 mr-1" />
                        Age {calculateAge(child.dateOfBirth)}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/children/${child.id}/permissions`)}
                      title="Manage Permissions"
                    >
                      <ShieldCheckIcon className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditModal(child)}
                    >
                      <PencilIcon className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => openDeleteModal(child)}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {child.yearGroup && (
                    <p className="text-sm">
                      <span className="font-medium">Year Group:</span> {child.yearGroup}
                    </p>
                  )}
                  {child.school && (
                    <p className="text-sm">
                      <span className="font-medium">School:</span> {child.school}
                    </p>
                  )}
                  {child.class && (
                    <p className="text-sm">
                      <span className="font-medium">Class:</span> {child.class}
                    </p>
                  )}
                  {child.allergies && (
                    <p className="text-sm">
                      <span className="font-medium">Allergies:</span> {child.allergies}
                    </p>
                  )}
                  {child.medicalInfo && (
                    <p className="text-sm">
                      <span className="font-medium">Medical Info:</span> {child.medicalInfo}
                    </p>
                  )}
                </div>
                
                {/* Permissions Summary */}
                {child.permissions && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Permissions</span>
                      <div className="flex space-x-1">
                        {child.permissions.consentToWalkHome && (
                          <div className="w-2 h-2 bg-green-500 rounded-full" title="Walk Home"></div>
                        )}
                        {child.permissions.consentToPhotography && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full" title="Photography"></div>
                        )}
                        {child.permissions.consentToFirstAid && (
                          <div className="w-2 h-2 bg-yellow-500 rounded-full" title="First Aid"></div>
                        )}
                        {child.permissions.consentToEmergencyContact && (
                          <div className="w-2 h-2 bg-red-500 rounded-full" title="Emergency Contact"></div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Child Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Child"
      >
        {selectedChild && (
          <ChildForm
            child={selectedChild}
            onSubmit={handleEditChild}
            onCancel={() => setShowEditModal(false)}
          />
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Child"
      >
        <div className="text-center">
          <ExclamationTriangleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Are you sure you want to delete {selectedChild?.firstName} {selectedChild?.lastName}?
          </h3>
          <p className="text-gray-600 mb-6">
            This action cannot be undone. All bookings associated with this child will also be affected.
          </p>
          <div className="flex justify-center space-x-4">
            <Button
              variant="outline"
              onClick={() => setShowDeleteModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteChild}
            >
              Delete Child
            </Button>
          </div>
        </div>
      </Modal>
      </div>
    </div>
  );
};

export default ChildrenPage;
