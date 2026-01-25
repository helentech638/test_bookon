import React, { useState, useEffect } from 'react';
import { 
  CalendarDaysIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
  PlusIcon,
  TrashIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { authService } from '../../services/authService';
import { buildApiUrl } from '../../config/api';
import toast from 'react-hot-toast';

interface Holiday {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  type: 'school_holiday' | 'bank_holiday' | 'custom';
  description?: string;
  createdAt: string;
}

interface HolidayExclusionProps {
  activityId: string;
  onHolidaysUpdated: () => void;
  className?: string;
}

const HolidayExclusion: React.FC<HolidayExclusionProps> = ({
  activityId,
  onHolidaysUpdated,
  className = ''
}) => {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newHoliday, setNewHoliday] = useState({
    name: '',
    startDate: '',
    endDate: '',
    type: 'custom' as const,
    description: ''
  });

  useEffect(() => {
    fetchHolidays();
  }, [activityId]);

  const fetchHolidays = async () => {
    try {
      const token = authService.getToken();
      if (!token) return;

      const response = await fetch(buildApiUrl(`/business/activities/${activityId}/holidays`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch holidays');
      }

      const data = await response.json();
      if (data.success) {
        setHolidays(data.data);
      }
    } catch (error) {
      console.error('Error fetching holidays:', error);
      toast.error('Failed to load holidays');
    } finally {
      setLoading(false);
    }
  };

  const handleAddHoliday = async () => {
    try {
      const token = authService.getToken();
      if (!token) return;

      if (!newHoliday.name || !newHoliday.startDate || !newHoliday.endDate) {
        toast.error('Please fill in all required fields');
        return;
      }

      const response = await fetch(buildApiUrl(`/business/activities/${activityId}/holidays`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newHoliday)
      });

      if (!response.ok) {
        throw new Error('Failed to add holiday');
      }

      const data = await response.json();
      if (data.success) {
        toast.success('Holiday added successfully');
        setNewHoliday({
          name: '',
          startDate: '',
          endDate: '',
          type: 'custom',
          description: ''
        });
        setShowAddForm(false);
        fetchHolidays();
        onHolidaysUpdated();
      }
    } catch (error) {
      console.error('Error adding holiday:', error);
      toast.error('Failed to add holiday');
    }
  };

  const handleDeleteHoliday = async (holidayId: string) => {
    if (!confirm('Are you sure you want to delete this holiday?')) {
      return;
    }

    try {
      const token = authService.getToken();
      if (!token) return;

      const response = await fetch(buildApiUrl(`/business/activities/${activityId}/holidays/${holidayId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete holiday');
      }

      const data = await response.json();
      if (data.success) {
        toast.success('Holiday deleted successfully');
        fetchHolidays();
        onHolidaysUpdated();
      }
    } catch (error) {
      console.error('Error deleting holiday:', error);
      toast.error('Failed to delete holiday');
    }
  };

  const handleBulkExcludeSessions = async () => {
    if (!confirm('This will cancel all sessions during the selected holidays. Continue?')) {
      return;
    }

    try {
      const token = authService.getToken();
      if (!token) return;

      const response = await fetch(buildApiUrl(`/business/activities/${activityId}/holidays/bulk-exclude`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ holidayIds: holidays.map(h => h.id) })
      });

      if (!response.ok) {
        throw new Error('Failed to exclude sessions');
      }

      const data = await response.json();
      if (data.success) {
        toast.success(`Excluded ${data.excludedCount} sessions during holidays`);
        onHolidaysUpdated();
      }
    } catch (error) {
      console.error('Error excluding sessions:', error);
      toast.error('Failed to exclude sessions');
    }
  };

  const getHolidayTypeColor = (type: string) => {
    switch (type) {
      case 'school_holiday': return 'bg-blue-100 text-blue-800';
      case 'bank_holiday': return 'bg-purple-100 text-purple-800';
      case 'custom': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start.toDateString() === end.toDateString()) {
      return start.toLocaleDateString('en-GB');
    }
    
    return `${start.toLocaleDateString('en-GB')} - ${end.toLocaleDateString('en-GB')}`;
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#00806a]"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDaysIcon className="w-5 h-5" />
            Holiday Management
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowAddForm(true)}
              size="sm"
            >
              <PlusIcon className="w-4 h-4 mr-1" />
              Add Holiday
            </Button>
            {holidays.length > 0 && (
              <Button
                onClick={handleBulkExcludeSessions}
                variant="outline"
                size="sm"
                className="text-orange-600 hover:text-orange-700"
              >
                <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
                Exclude Sessions
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Add Holiday Form */}
        {showAddForm && (
          <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Holiday</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Holiday Name *</label>
                <Input
                  type="text"
                  value={newHoliday.name}
                  onChange={(e) => setNewHoliday(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Christmas Break, Easter Holiday"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <Select
                  value={newHoliday.type}
                  onChange={(e) => setNewHoliday(prev => ({ ...prev, type: e.target.value as any }))}
                >
                  <option value="custom">Custom Holiday</option>
                  <option value="school_holiday">School Holiday</option>
                  <option value="bank_holiday">Bank Holiday</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date *</label>
                <Input
                  type="date"
                  value={newHoliday.startDate}
                  onChange={(e) => setNewHoliday(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Date *</label>
                <Input
                  type="date"
                  value={newHoliday.endDate}
                  onChange={(e) => setNewHoliday(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <Input
                type="text"
                value={newHoliday.description}
                onChange={(e) => setNewHoliday(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description"
              />
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={handleAddHoliday}>
                Add Holiday
              </Button>
              <Button
                onClick={() => setShowAddForm(false)}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Holidays List */}
        {holidays.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <CalendarDaysIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>No holidays configured</p>
            <p className="text-sm">Add holidays to automatically exclude sessions during these periods</p>
          </div>
        ) : (
          <div className="space-y-3">
            {holidays.map(holiday => (
              <div key={holiday.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="font-medium text-gray-900">{holiday.name}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getHolidayTypeColor(holiday.type)}`}>
                      {holiday.type.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <CalendarDaysIcon className="w-4 h-4" />
                      <span>{formatDateRange(holiday.startDate, holiday.endDate)}</span>
                    </div>
                    {holiday.description && (
                      <span>{holiday.description}</span>
                    )}
                  </div>
                </div>
                <Button
                  onClick={() => handleDeleteHoliday(holiday.id)}
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                >
                  <TrashIcon className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-start">
            <ExclamationTriangleIcon className="w-5 h-5 text-blue-400 mt-0.5 mr-3" />
            <div>
              <h4 className="text-sm font-medium text-blue-800">Holiday Exclusion</h4>
              <p className="text-sm text-blue-700 mt-1">
                Holidays automatically exclude sessions during these periods. Use "Exclude Sessions" to cancel existing sessions during holidays.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default HolidayExclusion;

