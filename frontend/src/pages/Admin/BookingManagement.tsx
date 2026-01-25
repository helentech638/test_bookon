import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { authService } from '../../services/authService';
import { 
  MagnifyingGlassIcon, 
  FunnelIcon, 
  EyeIcon, 
  CheckIcon, 
  XMarkIcon,
  ClockIcon,
  CurrencyPoundIcon
} from '@heroicons/react/24/outline';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import ResponsiveTable from '../../components/ui/ResponsiveTable';
import MobileFilters from '../../components/ui/MobileFilters';
import { buildApiUrl } from '../../config/api';
import AdminLayout from '../../components/layout/AdminLayout';

interface Booking {
  id: string;
  status: string;
  totalAmount: number;
  bookingDate: string;
  createdAt: string;
  paymentStatus?: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  activity: {
    id: string;
    name: string;
  };
  venue: {
    id: string;
    name: string;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const BookingManagement: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    venue_id: '',
    activity_id: '',
    user_id: '',
    date_from: '',
    date_to: '',
    search: ''
  });
  const [venues, setVenues] = useState<Array<{ id: string; name: string }>>([]);
  const [activities, setActivities] = useState<Array<{ id: string; name: string }>>([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchBookings();
    fetchVenues();
    fetchActivities();
  }, [pagination.page, filters]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const token = authService.getToken();
      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...filters
      });

      const response = await fetch(buildApiUrl(`/admin/bookings?${queryParams}`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Add safety checks for data structure
        if (data && data.data) {
          setBookings(data.data.bookings || []);
          if (data.data.pagination) {
            setPagination({
              page: data.data.pagination.page || 1,
              limit: data.data.pagination.limit || 20,
              total: data.data.pagination.total || 0,
              pages: data.data.pagination.pages || 0
            });
          }
        } else {
          // Fallback to empty data if structure is unexpected
          setBookings([]);
          setPagination({
            page: 1,
            limit: 20,
            total: 0,
            pages: 0
          });
        }
      } else {
        toast.error('Failed to fetch bookings');
        // Set default pagination on error
        setPagination({
          page: 1,
          limit: 20,
          total: 0,
          pages: 0
        });
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast.error('Error fetching bookings');
      // Set default pagination on error
      setPagination({
        page: 1,
        limit: 20,
        total: 0,
        pages: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchVenues = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch(buildApiUrl('/admin/venues'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setVenues(data.data);
      }
    } catch (error) {
      console.error('Error fetching venues:', error);
    }
  };

  const fetchActivities = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch(buildApiUrl('/admin/activities'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setActivities(data.data);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
    }
  };

  const updateBookingStatus = async (bookingId: string, newStatus: string) => {
    try {
      const token = authService.getToken();
      const response = await fetch(buildApiUrl(`/admin/bookings/${bookingId}/status`), {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        toast.success('Booking status updated successfully');
        fetchBookings(); // Refresh the list
      } else {
        toast.error('Failed to update booking status');
      }
    } catch (error) {
      toast.error('Error updating booking status');
    }
  };

  const updatePaymentStatus = async (bookingId: string, paymentStatus: string) => {
    try {
      const token = authService.getToken();
      const response = await fetch(buildApiUrl(`/bookings/${bookingId}/payment-status`), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          paymentStatus,
          paymentIntentId: `pi_manual_${Date.now()}`
        })
      });

      if (response.ok) {
        toast.success('Payment status updated successfully');
        fetchBookings();
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Failed to update payment status');
      }
    } catch (error) {
      toast.error('Error updating payment status');
      console.error('Payment status update error:', error);
    }
  };

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      venue_id: '',
      activity_id: '',
      user_id: '',
      date_from: '',
      date_to: '',
      search: ''
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const filterFields = [
    {
      key: 'status',
      label: 'Status',
      type: 'select' as const,
      options: [
        { value: 'pending', label: 'Pending' },
        { value: 'confirmed', label: 'Confirmed' },
        { value: 'cancelled', label: 'Cancelled' },
        { value: 'completed', label: 'Completed' }
      ]
    },
    {
      key: 'venue_id',
      label: 'Venue',
      type: 'select' as const,
      options: venues.map(venue => ({ value: venue.id, label: venue.name }))
    },
    {
      key: 'activity_id',
      label: 'Activity',
      type: 'select' as const,
      options: activities.map(activity => ({ value: activity.id, label: activity.name }))
    },
    {
      key: 'date_from',
      label: 'Date From',
      type: 'date' as const
    },
    {
      key: 'date_to',
      label: 'Date To',
      type: 'date' as const
    }
  ];

  const tableColumns = [
    {
      key: 'bookingDetails',
      label: 'Booking Details',
      mobileLabel: 'Booking',
      render: (value: any, row: Booking) => (
        <div>
          <div className="text-sm font-medium text-gray-900">
            #{row.id.slice(-8)}
          </div>
          <div className="text-sm text-gray-500">
            {formatDate(row.bookingDate)}
          </div>
          <div className="text-xs text-gray-400">
            {formatDate(row.createdAt)}
          </div>
        </div>
      )
    },
    {
      key: 'user',
      label: 'User',
      mobileLabel: 'Customer',
      render: (value: any, row: Booking) => (
        <div>
          <div className="text-sm font-medium text-gray-900">
            {row.user.name}
          </div>
          <div className="text-sm text-gray-500">
            {row.user.email}
          </div>
        </div>
      )
    },
    {
      key: 'activity',
      label: 'Activity & Venue',
      mobileLabel: 'Activity',
      render: (value: any, row: Booking) => (
        <div>
          <div className="text-sm font-medium text-gray-900">
            {row.activity.name}
          </div>
          <div className="text-sm text-gray-500">
            {row.venue.name}
          </div>
        </div>
      )
    },
    {
      key: 'totalAmount',
      label: 'Amount',
      mobileLabel: 'Amount',
      render: (value: number, row: Booking) => (
        <div>
          <div className="text-sm font-medium text-gray-900">
            {formatPrice(value)}
          </div>
          {row.paymentStatus === 'pending' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 mt-1">
              <ClockIcon className="w-3 h-3 mr-1" />
              Pending
            </span>
          )}
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      mobileLabel: 'Status',
      render: (value: string) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(value)}`}>
          {getStatusIcon(value)}
          <span className="ml-1 capitalize">{value}</span>
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      mobileLabel: 'Actions',
      render: (value: any, row: Booking) => (
        <div className="flex flex-col space-y-2">
          {/* Booking Status Actions */}
          <div className="flex space-x-2">
            {row.status === 'pending' && (
              <>
                <Button
                  onClick={() => updateBookingStatus(row.id, 'confirmed')}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckIcon className="w-4 h-4 mr-1" />
                  Confirm
                </Button>
                <Button
                  onClick={() => updateBookingStatus(row.id, 'cancelled')}
                  size="sm"
                  variant="outline"
                  className="text-red-600 border-red-600 hover:bg-red-50"
                >
                  <XMarkIcon className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              </>
            )}
            {row.status === 'confirmed' && (
              <Button
                onClick={() => updateBookingStatus(row.id, 'completed')}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <CheckIcon className="w-4 h-4 mr-1" />
                Complete
              </Button>
            )}
          </div>
          {/* Payment Status Actions */}
          {row.paymentStatus === 'pending' && (
            <Button
              onClick={() => updatePaymentStatus(row.id, 'paid')}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CurrencyPoundIcon className="w-4 h-4 mr-1" />
              Mark as Paid
            </Button>
          )}
        </div>
      )
    }
  ];

  return (
    <AdminLayout title="Booking Management">
      <div className="space-y-6">
        <div>
          <p className="text-gray-600">Manage and monitor all bookings across venues</p>
        </div>

        {/* Search Bar */}
        <Card>
          <div className="p-4">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by user name, activity, or venue..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>
        </Card>

        {/* Mobile Filters */}
        <MobileFilters
          filters={filterFields}
          values={filters}
          onChange={handleFilterChange}
          onReset={clearFilters}
          onApply={() => {}}
        />

        {/* Bookings Table */}
        <ResponsiveTable
          columns={tableColumns}
          data={bookings}
          loading={loading}
          emptyMessage="No bookings found"
          emptyIcon={ClockIcon}
        />

        {/* Pagination */}
        {pagination.pages > 1 && (
          <Card>
            <div className="p-4">
              <div className="flex flex-col sm:flex-row items-center justify-between space-y-3 sm:space-y-0">
                <div className="text-sm text-gray-700">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} results
                </div>
                <div className="flex space-x-2">
                  <Button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    variant="outline"
                    size="sm"
                  >
                    Previous
                  </Button>
                  <span className="px-3 py-2 text-sm text-gray-700">
                    Page {pagination.page} of {pagination.pages}
                  </span>
                  <Button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page === pagination.pages}
                    variant="outline"
                    size="sm"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

export default BookingManagement;
