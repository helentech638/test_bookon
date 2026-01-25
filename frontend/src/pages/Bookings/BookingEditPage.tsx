import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeftIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  CalendarDaysIcon,
  ClockIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { bookingService, Booking } from '../../services/bookingService';

const BookingEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    notes: ''
  });

  useEffect(() => {
    if (id) {
      loadBooking(id);
    }
  }, [id]);

  const loadBooking = async (bookingId: string) => {
    try {
      setLoading(true);
      const data = await bookingService.getBooking(bookingId);
      setBooking(data);
      setFormData({
        date: data.date,
        time: data.time,
        notes: data.notes || ''
      });
      setError(null);
    } catch (err) {
      console.error('Error loading booking:', err);
      setError('Failed to load booking');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking) return;

    try {
      setSaving(true);
      await bookingService.updateBooking(booking.id, formData);
      setSuccessMessage('Booking updated successfully!');
      setTimeout(() => {
        navigate(`/bookings/${booking?.id || ''}`);
      }, 1500);
    } catch (err) {
      setError('Failed to update booking');
      console.error('Error updating booking:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00806a] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading booking...</p>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <ExclamationTriangleIcon className="h-12 w-12 mx-auto" />
          </div>
          <p className="text-gray-900 text-lg font-medium mb-2">Error Loading Booking</p>
          <p className="text-gray-600 mb-4">{error || 'Booking not found'}</p>
          <Button onClick={() => navigate('/bookings')} variant="outline">
            Back to Bookings
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
                             <Button
                 variant="outline"
                 onClick={() => navigate(`/bookings/${booking?.id || ''}`)}
                 className="inline-flex items-center"
               >
                 <ArrowLeftIcon className="w-4 h-4 mr-2" />
                 Back to Booking
               </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Edit Booking</h1>
                                 <p className="text-gray-600">Booking #{booking.bookingNumber || 'Loading...'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex">
              <CheckIcon className="h-5 w-5 text-green-400" />
              <div className="ml-3">
                <p className="text-sm text-green-800">{successMessage}</p>
              </div>
            </div>
          </div>
        )}

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Child and Activity Info (Read-only) */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Booking Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Child</p>
                  <p className="text-sm text-gray-900">{booking.childName || 'Loading...'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Activity</p>
                  <p className="text-sm text-gray-900">
                    {typeof booking.activity === 'string' ? booking.activity : booking.activity?.title || 'Loading...'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Venue</p>
                  <p className="text-sm text-gray-900">
                    {typeof booking.venue === 'string' ? booking.venue : booking.venue?.name || 'Loading...'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Status</p>
                  <p className="text-sm text-gray-900 capitalize">{booking.status || 'Loading...'}</p>
                </div>
              </div>
            </div>

            {/* Editable Fields */}
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">Edit Details</h3>
              
              {/* Date */}
              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
                  <CalendarDaysIcon className="w-4 h-4 inline mr-2" />
                  Date
                </label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                  required
                  className="w-full"
                />
              </div>

              {/* Time */}
              <div>
                <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-2">
                  <ClockIcon className="w-4 h-4 inline mr-2" />
                  Time
                </label>
                <Input
                  id="time"
                  type="text"
                  value={formData.time}
                  onChange={(e) => handleInputChange('time', e.target.value)}
                  placeholder="e.g., 14:00-15:00"
                  required
                  className="w-full"
                />
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                  <DocumentTextIcon className="w-4 h-4 inline mr-2" />
                  Notes
                </label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Add any special requirements or notes..."
                  rows={4}
                  className="w-full"
                />
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                  <div className="ml-3">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/bookings/${booking?.id || ''}`)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="inline-flex items-center"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckIcon className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default BookingEditPage;
