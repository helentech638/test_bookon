import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { 
  CalendarIcon, 
  ClockIcon, 
  MapPinIcon, 
  UserIcon,
  CurrencyPoundIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  ArrowPathIcon,
  PlusIcon,
  FunnelIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { CalendarWidget } from '../../components/CalendarWidget';
import { authService } from '../../services/authService';
import { buildApiUrl } from '../../config/api';

interface Booking {
  id: string;
  activity_name: string;
  venue_name: string;
  child_name: string;
  start_date: string;
  start_time: string;
  end_time: string;
  total_amount: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  created_at: string;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  notes?: string;
  // Early drop-off and late pick-up options
  hasEarlyDropoff?: boolean;
  earlyDropoffAmount?: number;
  hasLatePickup?: boolean;
  latePickupAmount?: number;
  activity: {
    id: string;
    title: string;
    description: string;
    price: number;
    max_capacity: number;
    current_capacity: number;
    // Early drop-off and late pick-up availability
    earlyDropoff?: boolean;
    earlyDropoffPrice?: number;
    earlyDropoffStartTime?: string;
    earlyDropoffEndTime?: string;
    latePickup?: boolean;
    latePickupPrice?: number;
    latePickupStartTime?: string;
    latePickupEndTime?: string;
  };
  venue: {
    id: string;
    name: string;
    address: string;
    city: string;
  };
  child: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface BookingStats {
  totalBookings: number;
  confirmedBookings: number;
  pendingBookings: number;
  cancelledBookings: number;
  totalSpent: number;
  upcomingActivities: number;
}

const MyBookingsPage: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState<BookingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [editingBookingOptions, setEditingBookingOptions] = useState<Booking | null>(null);
  const [tempEarlyDropoff, setTempEarlyDropoff] = useState(false);
  const [tempLatePickup, setTempLatePickup] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchBookings();
    fetchBookingStats();
  }, []);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const token = authService.getToken();
      
      if (!token) {
        setError('Authentication required');
        return;
      }

      const response = await fetch(buildApiUrl('/dashboard/bookings'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setBookings(data.data || []);
      } else {
        const errorData = await response.json();
        setError(errorData.error?.message || 'Failed to fetch bookings');
      }
    } catch (error) {
      setError('Error fetching bookings');
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBookingStats = async () => {
    try {
      const token = authService.getToken();
      
      if (!token) return;

      const response = await fetch(buildApiUrl('/dashboard/stats'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      }
    } catch (error) {
      console.error('Error fetching booking stats:', error);
    }
  };

  const handleCancelBooking = async () => {
    if (!selectedBooking) return;

    try {
      const token = authService.getToken();
      
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch(buildApiUrl(`/bookings/${selectedBooking.id}/cancel`), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        toast.success('Booking cancelled successfully');
        setShowCancelModal(false);
        fetchBookings();
        fetchBookingStats();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error?.message || 'Failed to cancel booking');
      }
    } catch (error) {
      toast.error('Error cancelling booking');
      console.error('Error cancelling booking:', error);
    }
  };

  const handleRescheduleBooking = async (newDate: string, newTime: string) => {
    if (!selectedBooking) return;

    try {
      const token = authService.getToken();
      
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch(buildApiUrl(`/bookings/${selectedBooking.id}/reschedule`), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newDate,
          newTime,
        }),
      });

      if (response.ok) {
        toast.success('Booking rescheduled successfully');
        setShowRescheduleModal(false);
        fetchBookings();
        fetchBookingStats();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error?.message || 'Failed to reschedule booking');
      }
    } catch (error) {
      toast.error('Error rescheduling booking');
      console.error('Error rescheduling booking:', error);
    }
  };

  const handleExportAllBookingsToCalendar = () => {
    try {
      const token = authService.getToken();
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const link = document.createElement('a');
      link.href = `/api/v1/calendar/parent/${authService.getUser()?.id}/calendar`;
      link.download = 'my-bookings.ics';
      link.click();
      toast.success('Calendar file downloaded');
    } catch (err) {
      toast.error('Failed to export bookings to calendar');
      console.error('Error exporting bookings to calendar:', err);
    }
  };

  const handleExportSingleBookingToCalendar = (bookingId: string) => {
    try {
      const link = document.createElement('a');
      link.href = `/api/v1/calendar/booking/${bookingId}/calendar`;
      link.download = `booking-${bookingId}.ics`;
      link.click();
      toast.success('Calendar file downloaded');
    } catch (err) {
      toast.error('Failed to export booking to calendar');
      console.error('Error exporting booking to calendar:', err);
    }
  };

  const handleUpdateBookingOptions = async (bookingId: string, hasEarlyDropoff: boolean, hasLatePickup: boolean) => {
    try {
      const token = authService.getToken();
      
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch(buildApiUrl(`/bookings/${bookingId}/options`), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          hasEarlyDropoff,
          hasLatePickup
        }),
      });

      if (response.ok) {
        toast.success('Booking options updated successfully');
        fetchBookings();
        fetchBookingStats();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error?.message || 'Failed to update booking options');
      }
    } catch (error) {
      toast.error('Error updating booking options');
      console.error('Error updating booking options:', error);
    }
  };

  const handleOpenOptionsModal = (booking: Booking) => {
    setEditingBookingOptions(booking);
    setTempEarlyDropoff(booking.hasEarlyDropoff || false);
    setTempLatePickup(booking.hasLatePickup || false);
    setShowOptionsModal(true);
  };

  const handleSaveBookingOptions = async () => {
    if (!editingBookingOptions) return;

    await handleUpdateBookingOptions(
      editingBookingOptions.id,
      tempEarlyDropoff,
      tempLatePickup
    );

    setShowOptionsModal(false);
    setEditingBookingOptions(null);
  };

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      confirmed: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      cancelled: 'bg-red-100 text-red-800',
      completed: 'bg-blue-100 text-blue-800'
    };
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClasses[status as keyof typeof statusClasses] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getPaymentStatusBadge = (status: string) => {
    const statusClasses = {
      paid: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800',
      refunded: 'bg-gray-100 text-gray-800'
    };
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClasses[status as keyof typeof statusClasses] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const filteredBookings = bookings.filter(booking => {
    const matchesStatus = filterStatus === 'all' || booking.status === filterStatus;
    const matchesSearch = booking.activity_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         booking.venue_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         booking.child_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const sortedBookings = [...filteredBookings].sort((a, b) => {
    if (sortBy === 'date') {
      return sortOrder === 'asc' 
        ? new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
        : new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
    }
    if (sortBy === 'amount') {
      return sortOrder === 'asc' ? a.total_amount - b.total_amount : b.total_amount - a.total_amount;
    }
    if (sortBy === 'status') {
      return sortOrder === 'asc' ? a.status.localeCompare(b.status) : b.status.localeCompare(a.status);
    }
    return 0;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[#00806a]"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Bookings</h1>
          <p className="text-gray-600 mt-2">Manage your activity bookings and view booking history</p>
        </div>
        <div className="flex space-x-3">
          <Button 
            variant="outline"
            onClick={handleExportAllBookingsToCalendar}
          >
            <CalendarIcon className="h-4 w-4 mr-2" />
            Export All to Calendar
          </Button>
          <Button onClick={() => window.location.href = '/activities'}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Book New Activity
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg mr-3">
                  <CalendarIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Bookings</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalBookings}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg mr-3">
                  <CheckCircleIcon className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Confirmed</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.confirmedBookings}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg mr-3">
                  <ClockIcon className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Upcoming</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.upcomingActivities}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg mr-3">
                  <CurrencyPoundIcon className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Spent</p>
                  <p className="text-2xl font-bold text-gray-900">£{stats.totalSpent.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Calendar Widget */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          {/* Filters and Search */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search bookings..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
            <option value="completed">Completed</option>
          </select>

          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('-');
              setSortBy(field);
              setSortOrder(order as 'asc' | 'desc');
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="date-desc">Date (Newest)</option>
            <option value="date-asc">Date (Oldest)</option>
            <option value="amount-desc">Amount (High to Low)</option>
            <option value="amount-asc">Amount (Low to High)</option>
            <option value="status-asc">Status (A-Z)</option>
            <option value="status-desc">Status (Z-A)</option>
          </select>

          <Button
            onClick={() => {
              fetchBookings();
              fetchBookingStats();
            }}
            variant="outline"
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Bookings List */}
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      ) : sortedBookings.length === 0 ? (
        <div className="text-center py-12">
          <CalendarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No bookings found</h3>
          <p className="text-gray-600 mb-6">
            {searchTerm || filterStatus !== 'all' 
              ? 'Try adjusting your search or filter criteria'
              : 'Start by booking your first activity!'
            }
          </p>
          {!searchTerm && filterStatus === 'all' && (
            <Button onClick={() => window.location.href = '/activities'}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Browse Activities
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {sortedBookings.map((booking) => (
            <Card key={booking.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          {booking.activity_name}
                        </h3>
                        <div className="flex items-center text-sm text-gray-600 mb-2">
                          <MapPinIcon className="h-4 w-4 mr-1" />
                          {booking.venue_name}
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <UserIcon className="h-4 w-4 mr-1" />
                          {booking.child_name}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-gray-900 mb-1">
                          £{booking.total_amount.toFixed(2)}
                        </p>
                        <div className="space-y-1">
                          {getStatusBadge(booking.status)}
                          {getPaymentStatusBadge(booking.payment_status)}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center">
                        <CalendarIcon className="h-4 w-4 mr-2 text-gray-500" />
                        <span className="text-gray-600">
                          {new Date(booking.start_date).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <ClockIcon className="h-4 w-4 mr-2 text-gray-500" />
                        <span className="text-gray-600">
                          {booking.start_time} - {booking.end_time}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-gray-600">
                          Booked: {new Date(booking.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 mt-4 lg:mt-0 lg:ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedBooking(booking);
                        setShowDetailModal(true);
                      }}
                    >
                      <EyeIcon className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleExportSingleBookingToCalendar(booking.id)}
                    >
                      <CalendarIcon className="h-4 w-4 mr-1" />
                      Calendar
                    </Button>
                    
                    {booking.status === 'confirmed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedBooking(booking);
                          setShowRescheduleModal(true);
                        }}
                      >
                        <PencilIcon className="h-4 w-4 mr-1" />
                        Reschedule
                      </Button>
                    )}
                    
                    {/* Edit Options Button - Show if activity supports early drop-off or late pick-up */}
                    {(booking.status === 'pending' || booking.status === 'confirmed') && 
                     (booking.activity.earlyDropoff || booking.activity.latePickup) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-teal-600 hover:text-teal-700"
                        onClick={() => handleOpenOptionsModal(booking)}
                      >
                        <PlusIcon className="h-4 w-4 mr-1" />
                        Edit Options
                      </Button>
                    )}
                    
                    {booking.status === 'pending' || booking.status === 'confirmed' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => {
                          setSelectedBooking(booking);
                          setShowCancelModal(true);
                        }}
                      >
                        <TrashIcon className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
        </div>
        
        {/* Calendar Widget */}
        <div className="lg:col-span-1">
          <CalendarWidget 
            events={bookings.map(booking => ({
              id: booking.id,
              title: booking.activity_name,
              description: booking.activity?.description || '',
              startDate: booking.start_date,
              endDate: booking.start_date, // Assuming single day events
              startTime: booking.start_time,
              endTime: booking.end_time,
              location: booking.venue_name,
              price: booking.total_amount,
              type: 'booking' as const
            }))}
            showAddButton={true}
          />
        </div>
      </div>

      {/* Booking Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Booking Details"
        size="lg"
      >
        {selectedBooking && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Activity Information</h4>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">Activity:</span> {selectedBooking.activity_name}</p>
                  <p><span className="font-medium">Venue:</span> {selectedBooking.venue_name}</p>
                  <p><span className="font-medium">Child:</span> {selectedBooking.child_name}</p>
                  <p><span className="font-medium">Date:</span> {new Date(selectedBooking.start_date).toLocaleDateString()}</p>
                  <p><span className="font-medium">Time:</span> {selectedBooking.start_time} - {selectedBooking.end_time}</p>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Booking Information</h4>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">Booking ID:</span> {selectedBooking.id}</p>
                  <p><span className="font-medium">Status:</span> {getStatusBadge(selectedBooking.status)}</p>
                  <p><span className="font-medium">Payment Status:</span> {getPaymentStatusBadge(selectedBooking.payment_status)}</p>
                  <p><span className="font-medium">Amount:</span> £{selectedBooking.total_amount.toFixed(2)}</p>
                  <p><span className="font-medium">Booked:</span> {new Date(selectedBooking.created_at).toLocaleString()}</p>
                </div>
              </div>
            </div>

            {selectedBooking.notes && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Notes</h4>
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                  {selectedBooking.notes}
                </p>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowDetailModal(false)}
              >
                Close
              </Button>
              {selectedBooking.status === 'confirmed' && (
                <Button
                  onClick={() => {
                    setShowDetailModal(false);
                    setShowRescheduleModal(true);
                  }}
                >
                  <PencilIcon className="h-4 w-4 mr-2" />
                  Reschedule
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Cancel Confirmation Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel Booking"
      >
        {selectedBooking && (
          <div className="space-y-4">
            <p className="text-gray-600">
              Are you sure you want to cancel your booking for <strong>{selectedBooking.activity_name}</strong>?
            </p>
            <p className="text-sm text-gray-500">
              This action cannot be undone. You may be eligible for a refund depending on the cancellation policy.
            </p>
            
            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowCancelModal(false)}
              >
                Keep Booking
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700"
                onClick={handleCancelBooking}
              >
                Cancel Booking
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reschedule Modal */}
      <Modal
        isOpen={showRescheduleModal}
        onClose={() => setShowRescheduleModal(false)}
        title="Reschedule Booking"
      >
        {selectedBooking && (
          <RescheduleForm
            booking={selectedBooking}
            onSubmit={handleRescheduleBooking}
            onCancel={() => setShowRescheduleModal(false)}
          />
        )}
      </Modal>

      {/* Booking Options Modal */}
      <Modal
        isOpen={showOptionsModal}
        onClose={() => setShowOptionsModal(false)}
        title="Edit Booking Options"
      >
        {editingBookingOptions && (
          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">{editingBookingOptions.activity_name}</h3>
              <p className="text-sm text-gray-600">
                {editingBookingOptions.child_name} • {new Date(editingBookingOptions.start_date).toLocaleDateString()} • {editingBookingOptions.start_time}
              </p>
            </div>

            {/* Early Drop-off Option */}
            {editingBookingOptions.activity.earlyDropoff && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">Early Drop-off</h4>
                    <p className="text-sm text-gray-600">
                      {editingBookingOptions.activity.earlyDropoffStartTime} - {editingBookingOptions.activity.earlyDropoffEndTime}
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-gray-900">
                      £{editingBookingOptions.activity.earlyDropoffPrice?.toFixed(2) || '0.00'}
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tempEarlyDropoff}
                        onChange={(e) => setTempEarlyDropoff(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Late Pick-up Option */}
            {editingBookingOptions.activity.latePickup && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">Late Pick-up</h4>
                    <p className="text-sm text-gray-600">
                      {editingBookingOptions.activity.latePickupStartTime} - {editingBookingOptions.activity.latePickupEndTime}
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-gray-900">
                      £{editingBookingOptions.activity.latePickupPrice?.toFixed(2) || '0.00'}
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tempLatePickup}
                        onChange={(e) => setTempLatePickup(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Total Cost Display */}
            <div className="border-t pt-4">
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-900">Total Cost:</span>
                <span className="text-lg font-semibold text-gray-900">
                  £{(() => {
                    let total = editingBookingOptions.total_amount;
                    if (tempEarlyDropoff && editingBookingOptions.activity.earlyDropoffPrice) {
                      total += editingBookingOptions.activity.earlyDropoffPrice;
                    }
                    if (tempLatePickup && editingBookingOptions.activity.latePickupPrice) {
                      total += editingBookingOptions.activity.latePickupPrice;
                    }
                    return total.toFixed(2);
                  })()}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowOptionsModal(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-teal-600 hover:bg-teal-700"
                onClick={handleSaveBookingOptions}
              >
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

// Reschedule Form Component
interface RescheduleFormProps {
  booking: Booking;
  onSubmit: (newDate: string, newTime: string) => void;
  onCancel: () => void;
}

const RescheduleForm: React.FC<RescheduleFormProps> = ({ booking, onSubmit, onCancel }) => {
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newDate || !newTime) {
      toast.error('Please select both date and time');
      return;
    }

    setLoading(true);
    try {
      await onSubmit(newDate, newTime);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          New Date
        </label>
        <input
          type="date"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          New Time
        </label>
        <input
          type="time"
          value={newTime}
          onChange={(e) => setNewTime(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Current booking:</strong> {new Date(booking.start_date).toLocaleDateString()} at {booking.start_time}
        </p>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading}
        >
          {loading ? 'Rescheduling...' : 'Reschedule Booking'}
        </Button>
      </div>
    </form>
  );
};

export default MyBookingsPage;
