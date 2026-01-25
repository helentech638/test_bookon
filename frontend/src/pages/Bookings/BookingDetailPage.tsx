import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CalendarDaysIcon,
  MapPinIcon,
  UserGroupIcon,
  CurrencyPoundIcon,
  DocumentTextIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import CancellationPreviewModal from '../../components/CancellationPreviewModal';
import { bookingService, Booking } from '../../services/bookingService';
import { formatPrice } from '../../utils/formatting';

const BookingDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Helper function to get child name
  const getChildName = () => {
    return booking?.childName || booking?.child_name || '';
  };

  useEffect(() => {
    if (id) {
      loadBooking(id);
    }
  }, [id]);

  const loadBooking = async (bookingId: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await bookingService.getBooking(bookingId);
      setBooking(data);
    } catch (err) {
      setError('Failed to load booking');
      console.error('Error loading booking:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmBooking = async () => {
    if (!booking) return;
    try {
      const response = await bookingService.confirmBooking(booking.id);
      
      // Check if TFC admin confirmation is required
      if (response && typeof response === 'object' && 'requiresAdminConfirmation' in response) {
        // TFC booking - show instruction message
        setError('This is a Tax-Free Childcare booking. Please wait for admin to confirm payment. Check your email for payment instructions.');
        return;
      }
      
      // Check if payment is required
      if (response && typeof response === 'object' && 'requiresPayment' in response) {
        // Payment is required - redirect to payment page
        setError('Payment required to confirm booking. Redirecting to payment...');
        setTimeout(() => {
          window.location.href = `/payment/${booking.id}`;
        }, 2000);
        return;
      }
      
      await loadBooking(booking.id);
      setSuccessMessage('Booking confirmed successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      // Check if the error indicates TFC admin confirmation is required
      if (err?.response?.data?.data?.requiresAdminConfirmation) {
        setError('This is a Tax-Free Childcare booking. Please wait for admin to confirm payment. Check your email for payment instructions.');
      } else if (err?.response?.data?.data?.requiresPayment) {
        setError('Payment required to confirm booking. Redirecting to payment...');
        setTimeout(() => {
          window.location.href = `/payment/${booking.id}`;
        }, 2000);
      } else {
        setError('Failed to confirm booking');
        console.error('Error confirming booking:', err);
      }
    }
  };

  const handleCancelBooking = async () => {
    if (!booking) return;
    try {
      await bookingService.cancelBooking(booking.id, 'Cancelled by user');
      await loadBooking(booking.id);
      setSuccessMessage('Booking cancelled successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
      setShowCancellationModal(false);
    } catch (err) {
      setError('Failed to cancel booking');
      console.error('Error cancelling booking:', err);
    }
  };

  const handleShowCancellationPreview = () => {
    setShowCancellationModal(true);
  };

  const handleDeleteBooking = async () => {
    if (!booking) return;
    try {
      await bookingService.deleteBooking(booking.id);
      navigate('/bookings');
    } catch (err) {
      setError('Failed to delete booking');
      console.error('Error deleting booking:', err);
    }
  };

  const handleExportToCalendar = () => {
    if (!booking) return;
    
    try {
      const link = document.createElement('a');
      link.href = `/api/v1/calendar/booking/${booking.id}/calendar`;
      link.download = `booking-${booking.id}.ics`;
      link.click();
    } catch (err) {
      setError('Failed to export to calendar');
      console.error('Error exporting to calendar:', err);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatTime = (timeString: string) => {
    return timeString;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'completed':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckIcon className="w-4 h-4" />;
      case 'pending':
        return <ClockIcon className="w-4 h-4" />;
      case 'cancelled':
        return <XMarkIcon className="w-4 h-4" />;
      case 'completed':
        return <CheckIcon className="w-4 h-4" />;
      default:
        return <ClockIcon className="w-4 h-4" />;
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'refunded':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
                onClick={() => navigate('/bookings')}
                className="inline-flex items-center"
              >
                <ArrowLeftIcon className="w-4 h-4 mr-2" />
                Back to Bookings
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Booking Details</h1>
                                 <p className="text-gray-600">Booking #{booking.bookingNumber || 'Loading...'}</p>
              </div>
            </div>
            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={handleExportToCalendar}
                className="inline-flex items-center"
              >
                <CalendarIcon className="w-4 h-4 mr-2" />
                Add to Calendar
              </Button>
              {(booking.status || 'pending') === 'pending' && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/bookings/${booking?.id || ''}/edit`)}
                    className="inline-flex items-center"
                  >
                    <PencilIcon className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    onClick={handleConfirmBooking}
                    className="bg-green-600 hover:bg-green-700 inline-flex items-center"
                  >
                    <CheckIcon className="w-4 h-4 mr-2" />
                    Confirm
                  </Button>
                </>
              )}
              {(booking.status || 'pending') === 'confirmed' && (
                <Button
                  variant="outline"
                  onClick={handleShowCancellationPreview}
                  className="text-red-600 border-red-300 hover:bg-red-50 inline-flex items-center"
                >
                  <XMarkIcon className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              )}
              <Button
                variant="destructive"
                onClick={() => setShowDeleteModal(true)}
                className="inline-flex items-center"
              >
                <TrashIcon className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

        {/* Booking Information */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Child Information */}
            <Card className="p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-[#00806a] rounded-full flex items-center justify-center">
                  <span className="text-white text-lg font-medium">
                    {getChildName() ? getChildName().split(' ').map(n => n[0]).join('') : '?'}
                  </span>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Child</h3>
                  <p className="text-gray-600">{getChildName() || 'Loading...'}</p>
                </div>
              </div>
            </Card>

            {/* Activity & Venue */}
            <Card className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Activity & Venue</h3>
              <div className="space-y-4">
                <div className="flex items-center">
                  <UserGroupIcon className="w-5 h-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {typeof booking.activity === 'string' ? booking.activity : booking.activity?.title || booking.activity_name || 'Loading...'}
                    </p>
                    <p className="text-sm text-gray-500">Activity</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <MapPinIcon className="w-5 h-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {typeof booking.venue === 'string' ? booking.venue : booking.venue?.name || booking.venue_name || 'Loading...'}
                    </p>
                    <p className="text-sm text-gray-500">Venue</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Date & Time */}
            <Card className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Schedule</h3>
              <div className="space-y-4">
                <div className="flex items-center">
                  <CalendarDaysIcon className="w-5 h-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{booking.date ? formatDate(booking.date) : booking.start_date ? formatDate(booking.start_date) : 'Loading...'}</p>
                    <p className="text-sm text-gray-500">Date</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <ClockIcon className="w-5 h-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{booking.time ? formatTime(booking.time) : booking.start_time ? formatTime(booking.start_time) : 'Loading...'}</p>
                    <p className="text-sm text-gray-500">Time</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Status & Payment */}
            <Card className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Status & Payment</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Booking Status</p>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(booking.status || 'pending')}`}>
                    {getStatusIcon(booking.status || 'pending')}
                    <span className="ml-1">{(booking.status || 'pending').charAt(0).toUpperCase() + (booking.status || 'pending').slice(1)}</span>
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Payment Status</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(booking.paymentStatus || booking.payment_status || 'pending')}`}>
                    {(booking.paymentStatus || booking.payment_status || 'pending').charAt(0).toUpperCase() + (booking.paymentStatus || booking.payment_status || 'pending').slice(1)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Amount</p>
                  <p className="text-2xl font-bold text-gray-900">{formatPrice(booking.amount || booking.total_amount || 0)}</p>
                </div>
              </div>
            </Card>

            {/* Booking Details */}
            <Card className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Booking Details</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Booking Number</p>
                  <p className="text-sm font-medium text-gray-900">{booking.bookingNumber || booking.id || 'Loading...'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Booked On</p>
                  <p className="text-sm text-gray-900">{booking.createdAt ? formatDate(booking.createdAt) : booking.created_at ? formatDate(booking.created_at) : 'Loading...'}</p>
                </div>
                {booking.notes && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-2">Notes</p>
                    <div className="flex items-start">
                      <DocumentTextIcon className="w-4 h-4 text-gray-400 mr-2 mt-0.5" />
                      <p className="text-sm text-gray-900">{booking.notes}</p>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <TrashIcon className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mt-4">Delete Booking</h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500">
                  Are you sure you want to delete the booking for <strong>{getChildName() || 'this child'}</strong>?
                  This action cannot be undone.
                </p>
              </div>
              <div className="flex justify-center space-x-4 mt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteBooking}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Preview Modal */}
      {showCancellationModal && booking && (
        <CancellationPreviewModal
          isOpen={showCancellationModal}
          onClose={() => setShowCancellationModal(false)}
          onConfirm={handleCancelBooking}
          bookingId={booking.id.toString()}
          bookingDetails={{
            activityName: typeof booking.activity === 'string' ? booking.activity : booking.activity?.title || 'Unknown Activity',
            venueName: typeof booking.venue === 'string' ? booking.venue : booking.venue?.name || 'Unknown Venue',
            childName: booking.childName || 'Unknown Child',
            bookingDate: booking.date || new Date().toISOString(),
            bookingTime: booking.time || 'Unknown Time',
            amount: booking.amount || 0
          }}
        />
      )}
    </div>
  );
};

export default BookingDetailPage;
