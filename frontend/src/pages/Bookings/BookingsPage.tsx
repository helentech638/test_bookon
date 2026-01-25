import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  EyeIcon,
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
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { bookingService, Booking } from '../../services/bookingService';
import { formatPrice } from '../../utils/formatting';

const BookingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedVenue, setSelectedVenue] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState<Booking | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Helper functions to safely extract display values
  const getActivityName = (activity: string | { id: string; title: string; description?: string; price?: number; max_capacity?: number; current_capacity?: number; } | any): string => {
    if (typeof activity === 'string') return activity;
    if (activity && typeof activity === 'object' && activity.title) return activity.title;
    return 'Unknown Activity';
  };

  const getVenueName = (venue: string | { id: string; name: string; address?: string; city?: string; } | any): string => {
    if (typeof venue === 'string') return venue;
    if (venue && typeof venue === 'object' && venue.name) return venue.name;
    return 'Unknown Venue';
  };

  const getChildName = (booking: Booking): string => {
    return booking.childName || booking.child_name || 'Loading...';
  };

  const getBookingDate = (booking: Booking): string => {
    return booking.date || booking.start_date || 'Loading...';
  };

  const getBookingTime = (booking: Booking): string => {
    return booking.time || booking.start_time || 'Loading...';
  };

  const getBookingAmount = (booking: Booking): number => {
    return booking.amount || booking.total_amount || 0;
  };

  const getPaymentStatus = (booking: Booking): string => {
    return booking.paymentStatus || booking.payment_status || 'pending';
  };

  const getCreatedAt = (booking: Booking): string => {
    return booking.createdAt || booking.created_at || 'Loading...';
  };

  // Load bookings on component mount
  useEffect(() => {
    loadBookings();
  }, []);

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const loadBookings = async () => {
    try {
      setLoading(true);
      const data = await bookingService.getBookings();
      setBookings(data);
      setError(null);
    } catch (err) {
      setError('Failed to load bookings');
      console.error('Error loading bookings:', err);
    } finally {
      setLoading(false);
    }
  };


  const statuses = ['all', 'confirmed', 'pending', 'cancelled', 'completed'];
  const venues = ['all', 'Aqua Sports Centre', 'City Football Club', 'Creative Arts Studio', 'Star Dance Academy', 'Discovery Science Centre', 'Harmony Music School'];

  // Use real bookings from API
  const displayBookings = bookings;

  const filteredBookings = displayBookings.filter(booking => {
    const activityName = getActivityName(booking.activity);
    const venueName = getVenueName(booking.venue);
    
    const matchesSearch = 
      (booking.bookingNumber?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (booking.childName || booking.child_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      activityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      venueName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || booking.status === selectedStatus;
    const matchesVenue = selectedVenue === 'all' || venueName === selectedVenue;
    
    return matchesSearch && matchesStatus && matchesVenue;
  });

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (timeString: string) => {
    return timeString;
  };

  // Action handlers
  const handleViewBooking = (bookingId: string) => {
    navigate(`/bookings/${bookingId}`);
  };

  const handleEditBooking = (bookingId: string) => {
    navigate(`/bookings/${bookingId}/edit`);
  };

  const handleConfirmBooking = async (bookingId: string) => {
    try {
      const response = await bookingService.confirmBooking(bookingId);
      
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
          // Navigate to payment page with booking ID
          window.location.href = `/payment/${bookingId}`;
        }, 2000);
        return;
      }
      
      // Reload bookings to get updated status
      await loadBookings();
      setSuccessMessage('Booking confirmed successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      // Check if the error indicates TFC admin confirmation is required
      if (err?.response?.data?.data?.requiresAdminConfirmation) {
        setError('This is a Tax-Free Childcare booking. Please wait for admin to confirm payment. Check your email for payment instructions.');
      } else if (err?.response?.data?.data?.requiresPayment) {
        setError('Payment required to confirm booking. Redirecting to payment...');
        setTimeout(() => {
          window.location.href = `/payment/${bookingId}`;
        }, 2000);
      } else {
        setError('Failed to confirm booking');
        console.error('Error confirming booking:', err);
      }
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    try {
      await bookingService.cancelBooking(bookingId, 'Cancelled by user');
      // Reload bookings to get updated status
      await loadBookings();
      setSuccessMessage('Booking cancelled successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError('Failed to cancel booking');
      console.error('Error cancelling booking:', err);
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    try {
      await bookingService.deleteBooking(bookingId);
      // Reload bookings to get updated list
      await loadBookings();
      setShowDeleteModal(false);
      setBookingToDelete(null);
      setSuccessMessage('Booking deleted successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError('Failed to delete booking');
      console.error('Error deleting booking:', err);
    }
  };

  const openDeleteModal = (booking: Booking) => {
    setBookingToDelete(booking);
    setShowDeleteModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00806a] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading bookings...</p>
          <div className="mt-4 space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-20 bg-gray-200 rounded-lg mx-auto" style={{ width: isMobile ? '90%' : '600px' }}></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <ExclamationTriangleIcon className="h-12 w-12 mx-auto" />
          </div>
          <p className="text-gray-900 text-lg font-medium mb-2">Error Loading Bookings</p>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={loadBookings} variant="outline">
            Try Again
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
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
              <p className="text-gray-600">Manage and track all your activity bookings</p>
            </div>
            <Link to="/bookings/new" className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#00806a] hover:bg-[#006d5a] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00806a]">
              <PlusIcon className="w-4 h-4 mr-2" />
              New Booking
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <div className="mb-8">
          <div className={`flex flex-col gap-4 ${isMobile ? 'space-y-3' : 'lg:flex-row'}`}>
            {/* Search Bar */}
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search bookings, children, or activities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00806a] focus:border-[#00806a]"
                  style={{ fontSize: isMobile ? '16px' : '14px' }} // Prevent zoom on iOS
                />
              </div>
            </div>

            {/* Filter Toggle */}
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center ${isMobile ? 'w-full justify-center py-3' : ''}`}
            >
              <FunnelIcon className="w-4 h-4 mr-2" />
              Filters
            </Button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <Card className="mt-4 p-6">
              <div className={`grid gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'}`}>
                {/* Status Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a] focus:border-[#00806a]"
                  >
                    {statuses.map(status => (
                      <option key={status} value={status}>
                        {status === 'all' ? 'All Statuses' : status.charAt(0).toUpperCase() + status.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Venue Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Venue</label>
                  <select
                    value={selectedVenue}
                    onChange={(e) => setSelectedVenue(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a] focus:border-[#00806a]"
                  >
                    {venues.map(venue => (
                      <option key={venue} value={venue}>
                        {venue === 'all' ? 'All Venues' : venue}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Clear Filters */}
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedStatus('all');
                      setSelectedVenue('all');
                    }}
                    className="w-full"
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>

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

        {/* Results Count */}
        <div className="mb-6">
          <p className="text-gray-600">
            Showing {filteredBookings.length} of {displayBookings.length} bookings
          </p>
        </div>

        {/* Bookings Table */}
        <Card>
          <div className="overflow-x-auto">
            {isMobile ? (
              // Mobile card layout
              <div className="space-y-4 p-4">
                {filteredBookings.map((booking) => (
                  <div key={booking.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{booking.childName || booking.child_name || 'Loading...'}</h3>
                        <p className="text-sm text-gray-600">{getActivityName(booking.activity)}</p>
                        <p className="text-sm text-gray-500">{getVenueName(booking.venue)}</p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(booking.status || 'pending')}`}>
                          {getStatusIcon(booking.status || 'pending')}
                          <span className="ml-1">{(booking.status || 'pending').charAt(0).toUpperCase() + (booking.status || 'pending').slice(1)}</span>
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Date:</span>
                        <p className="font-medium">{booking.date ? formatDate(booking.date) : 'Loading...'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Time:</span>
                        <p className="font-medium">{booking.time ? formatTime(booking.time) : 'Loading...'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Amount:</span>
                        <p className="font-medium">{formatPrice(booking.amount || 0)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Payment:</span>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(booking.paymentStatus || 'pending')}`}>
                          {(booking.paymentStatus || 'pending').charAt(0).toUpperCase() + (booking.paymentStatus || 'pending').slice(1)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewBooking(booking.id)}
                        className="flex-1 justify-center py-2"
                      >
                        <EyeIcon className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      {(booking.status || 'pending') === 'pending' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditBooking(booking.id)}
                            className="flex-1 justify-center py-2"
                          >
                            <PencilIcon className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleConfirmBooking(booking.id)}
                            className="flex-1 justify-center py-2 text-green-600 border-green-300 hover:bg-green-50"
                          >
                            <CheckIcon className="w-4 h-4 mr-1" />
                            Confirm
                          </Button>
                        </>
                      )}
                      {(booking.status || 'pending') === 'confirmed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancelBooking(booking.id)}
                          className="flex-1 justify-center py-2 text-red-600 border-red-300 hover:bg-red-50"
                        >
                          <XMarkIcon className="w-4 h-4 mr-1" />
                          Cancel
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDeleteModal(booking)}
                        className="flex-1 justify-center py-2 text-red-600 border-red-300 hover:bg-red-50"
                      >
                        <TrashIcon className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Desktop table layout
              <div className="min-w-full">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                        Booking Details
                      </th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[180px]">
                        Activity & Venue
                      </th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                        Date & Time
                      </th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                        Amount
                      </th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                        Status
                      </th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredBookings.map((booking) => (
                      <tr key={booking.id} className="hover:bg-gray-50">
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#00806a] rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-white text-xs sm:text-sm font-medium">
                                {booking.childName ? booking.childName.split(' ').map(n => n[0]).join('') : '?'}
                              </span>
                            </div>
                            <div className="ml-2 sm:ml-3 min-w-0 flex-1">
                              <div className="text-sm font-medium text-gray-900 truncate">
                                {booking.childName || booking.child_name || 'Unknown Child'}
                              </div>
                              <div className="text-xs sm:text-sm text-gray-500 truncate">
                                {booking.bookingNumber || `#${booking.id?.slice(-8)}`}
                              </div>
                              <div className="text-xs text-gray-400">
                                Booked {(booking.createdAt || booking.created_at) ? formatDate(booking.createdAt || booking.created_at || '') : 'Recently'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">{getActivityName(booking.activity)}</div>
                            <div className="text-xs sm:text-sm text-gray-500 truncate">{getVenueName(booking.venue)}</div>
                            {booking.notes && (
                              <div className="text-xs text-gray-400 mt-1 flex items-center">
                                <DocumentTextIcon className="w-3 h-3 mr-1 flex-shrink-0" />
                                <span className="truncate">
                                  {booking.notes.length > 30 ? `${booking.notes.substring(0, 30)}...` : booking.notes}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {(booking.date || booking.start_date) ? formatDate(booking.date || booking.start_date || '') : 'TBD'}
                          </div>
                          <div className="text-xs sm:text-sm text-gray-500">
                            {(booking.time || booking.start_time) ? formatTime(booking.time || booking.start_time || '') : 'TBD'}
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{formatPrice(booking.amount || booking.total_amount || 0)}</div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(booking.paymentStatus || booking.payment_status || 'pending')}`}>
                            {(booking.paymentStatus || booking.payment_status || 'pending').charAt(0).toUpperCase() + (booking.paymentStatus || booking.payment_status || 'pending').slice(1)}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(booking.status || 'pending')}`}>
                            {getStatusIcon(booking.status || 'pending')}
                            <span className="ml-1">{(booking.status || 'pending').charAt(0).toUpperCase() + (booking.status || 'pending').slice(1)}</span>
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex flex-wrap gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewBooking(booking.id)}
                              className="inline-flex items-center px-2 py-1 border border-gray-300 rounded text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
                            >
                              <EyeIcon className="w-3 h-3 mr-1" />
                              View
                            </Button>
                            {(booking.status || 'pending') === 'pending' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditBooking(booking.id)}
                                  className="inline-flex items-center px-2 py-1 border border-gray-300 rounded text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
                                >
                                  <PencilIcon className="w-3 h-3 mr-1" />
                                  Edit
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleConfirmBooking(booking.id)}
                                  className="text-green-600 border-green-300 hover:bg-green-50 inline-flex items-center px-2 py-1 rounded text-xs"
                                >
                                  <CheckIcon className="w-3 h-3 mr-1" />
                                  Confirm
                                </Button>
                              </>
                            )}
                            {(booking.status || 'pending') === 'confirmed' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCancelBooking(booking.id)}
                                className="text-red-600 border-red-300 hover:bg-red-50 inline-flex items-center px-2 py-1 rounded text-xs"
                              >
                                <XMarkIcon className="w-3 h-3 mr-1" />
                                Cancel
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDeleteModal(booking)}
                              className="text-red-600 border-red-300 hover:bg-red-50 inline-flex items-center px-2 py-1 rounded text-xs"
                            >
                              <TrashIcon className="w-3 h-3 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>

        {/* No Results */}
        {filteredBookings.length === 0 && (
          <Card className="text-center py-12">
            <div className="text-gray-500">
              <p className="text-lg font-medium mb-2">No bookings found</p>
              <p className="text-sm">Try adjusting your search criteria or filters</p>
            </div>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 text-center">
            <div className="w-12 h-12 bg-[#00806a] rounded-lg flex items-center justify-center mx-auto mb-4">
              <PlusIcon className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Create New Booking</h3>
            <p className="text-gray-600 mb-4">Book an activity for your child</p>
            <Link to="/bookings/new" className="inline-flex items-center justify-center w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#00806a] hover:bg-[#006d5a] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00806a]">
              New Booking
            </Link>
          </Card>

          <Card className="p-6 text-center">
            <div className="w-12 h-12 bg-[#041c30] rounded-lg flex items-center justify-center mx-auto mb-4">
              <DocumentTextIcon className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">View Reports</h3>
            <p className="text-gray-600 mb-4">Generate booking reports and analytics</p>
            <Link to="/reports" className="inline-flex items-center justify-center w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00806a]">
              View Reports
            </Link>
          </Card>

        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && bookingToDelete && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <TrashIcon className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mt-4">Delete Booking</h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500">
                  Are you sure you want to delete the booking for <strong>{bookingToDelete.childName || 'this child'}</strong>?
                  This action cannot be undone.
                </p>
              </div>
              <div className="flex justify-center space-x-4 mt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setBookingToDelete(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleDeleteBooking(bookingToDelete.id)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingsPage;
