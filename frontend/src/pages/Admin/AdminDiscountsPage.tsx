import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { 
  PlusIcon, 
  TagIcon, 
  CurrencyPoundIcon,
  CalendarDaysIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import authService from '../../services/authService';
import { buildApiUrl } from '../../config/api';

interface DiscountCode {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  description?: string;
  minAmount?: number;
  maxDiscountAmount?: number;
  maxUsesPerUser?: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
  _count: {
    usages: number;
  };
}

const AdminDiscountsPage: React.FC = () => {
  const { user } = useAuth();
  const [discounts, setDiscounts] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    type: 'percentage' as 'percentage' | 'fixed',
    value: '',
    description: '',
    minAmount: '',
    maxDiscountAmount: '',
    maxUsesPerUser: '',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchDiscounts();
    }
  }, [user]);

  const fetchDiscounts = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch(buildApiUrl('/discounts/list'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDiscounts(data.data);
      }
    } catch (error) {
      console.error('Error fetching discounts:', error);
      toast.error('Failed to fetch discount codes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const token = authService.getToken();
      const response = await fetch(buildApiUrl('/discounts/create'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          value: parseFloat(formData.value),
          minAmount: formData.minAmount ? parseFloat(formData.minAmount) : undefined,
          maxDiscountAmount: formData.maxDiscountAmount ? parseFloat(formData.maxDiscountAmount) : undefined,
          maxUsesPerUser: formData.maxUsesPerUser ? parseInt(formData.maxUsesPerUser) : undefined,
        }),
      });

      if (response.ok) {
        toast.success('Discount code created successfully');
        setShowCreateForm(false);
        setFormData({
          code: '',
          type: 'percentage',
          value: '',
          description: '',
          minAmount: '',
          maxDiscountAmount: '',
          maxUsesPerUser: '',
          startDate: '',
          endDate: ''
        });
        fetchDiscounts();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create discount code');
      }
    } catch (error) {
      console.error('Error creating discount:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create discount code');
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
          <Card className="p-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
            <p className="text-gray-600">You need admin privileges to access this page.</p>
          </Card>
        </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Discount Codes</h1>
            <p className="text-gray-600">Manage discount codes and promotions</p>
          </div>
          <Button
            onClick={() => setShowCreateForm(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Create Discount Code
          </Button>
        </div>

        {/* Create Form Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Create Discount Code</h2>
              
              <form onSubmit={handleCreateDiscount} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code
                  </label>
                  <Input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="SAVE20"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as 'percentage' | 'fixed' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Value
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    placeholder={formData.type === 'percentage' ? '20' : '10.00'}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <Input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="20% off all activities"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Min Amount
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.minAmount}
                      onChange={(e) => setFormData({ ...formData, minAmount: e.target.value })}
                      placeholder="50.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Discount
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.maxDiscountAmount}
                      onChange={(e) => setFormData({ ...formData, maxDiscountAmount: e.target.value })}
                      placeholder="100.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Uses Per User
                  </label>
                  <Input
                    type="number"
                    value={formData.maxUsesPerUser}
                    onChange={(e) => setFormData({ ...formData, maxUsesPerUser: e.target.value })}
                    placeholder="1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date
                    </label>
                    <Input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Date
                    </label>
                    <Input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="flex space-x-3 pt-4">
                  <Button
                    type="submit"
                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
                  >
                    Create Code
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* Discount Codes List */}
        {loading ? (
          <Card className="p-8 text-center">
            <p className="text-gray-600">Loading discount codes...</p>
          </Card>
        ) : (
          <div className="grid gap-6">
            {discounts.map((discount) => (
              <Card key={discount.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <TagIcon className="h-5 w-5 text-teal-600" />
                      <h3 className="text-lg font-semibold text-gray-900">
                        {discount.code}
                      </h3>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        discount.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {discount.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    
                    <p className="text-gray-600 mb-3">{discount.description}</p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">Type:</span>
                        <p className="text-gray-600 capitalize">{discount.type}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Value:</span>
                        <p className="text-gray-600">
                          {discount.type === 'percentage' 
                            ? `${discount.value}%` 
                            : `£${discount.value}`
                          }
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Min Amount:</span>
                        <p className="text-gray-600">
                          {discount.minAmount ? `£${discount.minAmount}` : 'None'}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Uses:</span>
                        <p className="text-gray-600">{discount._count.usages}</p>
                      </div>
                    </div>
                    
                    <div className="mt-3 text-sm text-gray-500">
                      <CalendarDaysIcon className="h-4 w-4 inline mr-1" />
                      {new Date(discount.startDate).toLocaleDateString()} - {new Date(discount.endDate).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
            
            {discounts.length === 0 && (
              <Card className="p-8 text-center">
                <TagIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No discount codes</h3>
                <p className="text-gray-600 mb-4">Create your first discount code to get started.</p>
                <Button
                  onClick={() => setShowCreateForm(true)}
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                >
                  <PlusIcon className="h-5 w-5 mr-2" />
                  Create Discount Code
                </Button>
              </Card>
            )}
          </div>
        )}
      </div>
  );
};

export default AdminDiscountsPage;
