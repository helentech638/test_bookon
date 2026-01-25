import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { CalendarDaysIcon, ClockIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import authService from '../../services/authService';
import { buildApiUrl } from '../../config/api';

interface Session {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookingsCount: number;
  activity: {
    id: string;
    title: string;
    type: string;
    venue: {
      id: string;
      name: string;
    };
  };
}

interface CreateRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  activityId: string;
  onRegisterCreated: () => void;
}

const CreateRegisterModal: React.FC<CreateRegisterModalProps> = ({
  isOpen,
  onClose,
  activityId,
  onRegisterCreated
}) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    sessionId: '',
    date: '',
    status: 'upcoming',
    notes: ''
  });

  useEffect(() => {
    if (isOpen && activityId) {
      fetchSessions();
    }
  }, [isOpen, activityId]);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const token = authService.getToken();
      if (!token) {
        toast.error('Please log in to create registers');
        return;
      }

      const response = await fetch(buildApiUrl(`/activities/${activityId}/sessions`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }

      const data = await response.json();
      if (data.success) {
        setSessions(data.data || []);
      } else {
        throw new Error(data.message || 'Failed to fetch sessions');
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.sessionId || !formData.date) {
      toast.error('Please select a session and date');
      return;
    }

    try {
      setSubmitting(true);
      const token = authService.getToken();
      if (!token) {
        toast.error('Please log in to create registers');
        return;
      }

      const response = await fetch(buildApiUrl('/business/registers'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: formData.sessionId,
          date: formData.date,
          status: formData.status,
          notes: formData.notes || undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create register');
      }

      const data = await response.json();
      if (data.success) {
        toast.success('Register created successfully!');
        onRegisterCreated();
        onClose();
        // Reset form
        setFormData({
          sessionId: '',
          date: '',
          status: 'upcoming',
          notes: ''
        });
      } else {
        throw new Error(data.message || 'Failed to create register');
      }
    } catch (error) {
      console.error('Error creating register:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create register');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Register">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Session Selection */}
        <div>
          <label htmlFor="sessionId" className="block text-sm font-medium text-gray-700 mb-2">
            Select Session *
          </label>
          {loading ? (
            <div className="p-3 border border-gray-300 rounded-md bg-gray-50">
              <div className="animate-pulse text-sm text-gray-500">Loading sessions...</div>
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-3 border border-gray-300 rounded-md bg-gray-50">
              <div className="text-sm text-gray-500">No sessions available for this activity</div>
            </div>
          ) : (
            <Select
              id="sessionId"
              value={formData.sessionId}
              onChange={(e) => handleInputChange('sessionId', e.target.value)}
              required
            >
              <option value="">Choose a session...</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {formatDate(session.date)} - {formatTime(session.startTime)} to {formatTime(session.endTime)} ({session.bookingsCount}/{session.capacity} booked)
                </option>
              ))}
            </Select>
          )}
        </div>

        {/* Date */}
        <div>
          <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
            Register Date *
          </label>
          <Input
            id="date"
            type="date"
            value={formData.date}
            onChange={(e) => handleInputChange('date', e.target.value)}
            required
          />
        </div>

        {/* Status */}
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
            Status
          </label>
          <Select
            id="status"
            value={formData.status}
            onChange={(e) => handleInputChange('status', e.target.value)}
          >
            <option value="upcoming">Upcoming</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
            Notes (Optional)
          </label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            rows={3}
            placeholder="Add any notes about this register..."
          />
        </div>

        {/* Selected Session Info */}
        {formData.sessionId && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Session Details</h4>
            {(() => {
              const selectedSession = sessions.find(s => s.id === formData.sessionId);
              if (!selectedSession) return null;
              
              return (
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center">
                    <CalendarDaysIcon className="h-4 w-4 mr-2" />
                    <span>{formatDate(selectedSession.date)}</span>
                  </div>
                  <div className="flex items-center">
                    <ClockIcon className="h-4 w-4 mr-2" />
                    <span>{formatTime(selectedSession.startTime)} - {formatTime(selectedSession.endTime)}</span>
                  </div>
                  <div className="flex items-center">
                    <UserGroupIcon className="h-4 w-4 mr-2" />
                    <span>{selectedSession.bookingsCount} / {selectedSession.capacity} attendees</span>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting || !formData.sessionId || !formData.date}
            className="flex-1"
          >
            {submitting ? 'Creating...' : 'Create Register'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateRegisterModal;
