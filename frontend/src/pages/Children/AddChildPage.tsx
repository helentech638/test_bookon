import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import ChildForm from '../../components/children/ChildForm';
import { authService } from '../../services/authService';
import { buildApiUrl, API_CONFIG } from '../../config/api';
import toast from 'react-hot-toast';

interface ChildFormData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  yearGroup?: string;
  allergies?: string;
  medicalInfo?: string;
  school?: string;
  class?: string;
}

const AddChildPage: React.FC = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddChild = async (formData: ChildFormData) => {
    setIsSubmitting(true);
    try {
      const token = authService.getToken();
      if (!token) {
        toast.error('Authentication required');
        navigate('/login');
        return;
      }

      const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CHILDREN), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add child');
      }

      const result = await response.json();
      toast.success('Child added successfully!');
      // Navigate to single child permissions page
      navigate(`/children/${result.data.id}/permissions`);
    } catch (error) {
      console.error('Error adding child:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add child');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate('/children');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="mb-4 flex items-center space-x-2"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            <span>Back to Children</span>
          </Button>
          
          <h1 className="text-3xl font-bold text-gray-900">Add New Child</h1>
          <p className="mt-2 text-gray-600">
            Add a new child to your account. This information will be used for bookings and activities.
          </p>
        </div>

        {/* Form Card */}
        <Card>
          <CardHeader>
            <CardTitle>Child Information</CardTitle>
          </CardHeader>
          <CardContent>
            <ChildForm
              onSubmit={handleAddChild}
              onCancel={handleCancel}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AddChildPage;
