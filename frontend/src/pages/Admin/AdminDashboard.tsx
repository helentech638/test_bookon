import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  CalendarDaysIcon, 
  UsersIcon, 
  CurrencyPoundIcon, 
  ChartBarIcon,
  PlusIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  ClockIcon,
  MapPinIcon,
  UserGroupIcon,
  UserIcon,
  CogIcon,
  BellIcon,
  DocumentTextIcon,
  AcademicCapIcon,
  BuildingOfficeIcon,
  CreditCardIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  MegaphoneIcon,
  ComputerDesktopIcon,
  ClipboardDocumentListIcon,
  ChatBubbleLeftRightIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ChevronDownIcon,
  ArrowPathIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import toast from 'react-hot-toast';
import { authService } from '../../services/authService';
import { buildApiUrl } from '../../config/api';
import AdminLayout from '../../components/layout/AdminLayout';
import { formatPrice } from '../../utils/formatting';

interface AdminStats {
  totalVenues: number;
  totalActivities: number;
  totalBookings: number;
  totalRevenue: number;
  pendingBookings: number;
  activeVenues: number;
  upcomingActivities: number;
  monthlyGrowth: number;
  totalUsers: number;
}

// New interfaces for the redesigned dashboard
interface DashboardSnapshot {
  activities_running: number;
  attendees_today: number;
  parents_registered: number;
  payments_total: number;
  refunds_total: number;
  credits_total: number;
}

interface UpcomingActivity {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  venue_name: string;
  capacity: number;
  booked: number;
  waitlist_count: number;
}

interface FinanceSummary {
  income: number;
  refunds: number;
  credits: number;
  timeseries: Array<{
    date: string;
    value: number;
  }>;
}

interface Notification {
  id: string;
  type: 'booking' | 'cancellation' | 'waitlist' | 'refund';
  title: string;
  created_at: string;
  action_url: string;
  read: boolean;
}

interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  status: 'active' | 'inactive' | 'pending';
  totalActivities: number;
  totalBookings: number;
  revenue: number;
  lastActivity: string;
}

interface Activity {
  id: string;
  name: string;
  venue_name: string;
  category: string;
  price: number;
  status: 'active' | 'inactive' | 'draft';
  current_capacity: number;
  max_capacity: number;
  nextSession: string;
}

interface RecentBooking {
  id: string;
  activity_name: string;
  venue_name: string;
  customer_name: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  created_at: string;
  user: {
    name: string;
  };
  activity: {
    name: string;
  };
  venue: {
    name: string;
  };
  totalAmount: number;
}

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);

  // New state for redesigned dashboard
  const [dashboardSnapshot, setDashboardSnapshot] = useState<DashboardSnapshot | null>(null);
  const [upcomingActivities, setUpcomingActivities] = useState<UpcomingActivity[]>([]);
  const [financeSummary, setFinanceSummary] = useState<FinanceSummary | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('today');
  const [showNotifications, setShowNotifications] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Check authentication first
    if (!authService.isAuthenticated()) {
      navigate('/login');
      return;
    }
    
    // Check if user has admin role
    if (!authService.hasRole('admin')) {
      navigate('/dashboard');
      return;
    }
    
    fetchAdminData();
  }, [navigate]);

  // Real-time updates for notifications
  useEffect(() => {
    if (!authService.isAuthenticated()) return;

    // Poll for notification updates every 30 seconds
    const notificationInterval = setInterval(() => {
      fetchNotifications();
    }, 30000);

    // Poll for dashboard updates every 2 minutes
    const dashboardInterval = setInterval(() => {
      fetchDashboardSnapshot();
    }, 120000);

    return () => {
      clearInterval(notificationInterval);
      clearInterval(dashboardInterval);
    };
  }, []);

  // New function to fetch dashboard snapshot data
  const fetchDashboardSnapshot = async () => {
    try {
      const token = authService.getToken();
      if (!token) return;

      const response = await fetch(buildApiUrl(`/dashboard/admin-snapshot?range=${dateRange}`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDashboardSnapshot(data.data);
      }
    } catch (error) {
      console.error('Error fetching dashboard snapshot:', error);
    }
  };

  // New function to fetch upcoming activities
  const fetchUpcomingActivities = async () => {
    try {
      const token = authService.getToken();
      if (!token) return;

      const response = await fetch(buildApiUrl('/activities/upcoming?limit=5'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUpcomingActivities(data.data);
      }
    } catch (error) {
      console.error('Error fetching upcoming activities:', error);
    }
  };

  // New function to fetch finance summary
  const fetchFinanceSummary = async () => {
    try {
      const token = authService.getToken();
      if (!token) return;

      const response = await fetch(buildApiUrl(`/finance/summary?range=${dateRange}`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setFinanceSummary(data.data);
      }
    } catch (error) {
      console.error('Error fetching finance summary:', error);
    }
  };

  // New function to fetch notifications
  const fetchNotifications = async () => {
    try {
      const token = authService.getToken();
      if (!token) return;

      const response = await fetch(buildApiUrl('/notifications?limit=10&unread=false'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.data);
        setUnreadNotifications(data.data.filter((n: Notification) => !n.read).length);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  // New function to refresh all dashboard data with performance optimization
  const refreshDashboardData = async () => {
    setIsRefreshing(true);
    const startTime = performance.now();
    
    try {
      await Promise.all([
        fetchDashboardSnapshot(),
        fetchUpcomingActivities(),
        fetchFinanceSummary(),
        fetchNotifications()
      ]);
      
      const endTime = performance.now();
      const loadTime = endTime - startTime;
      
      // Log performance metrics
      console.log(`Dashboard data refreshed in ${loadTime.toFixed(2)}ms`);
      
      // Show success message if refresh took longer than expected
      if (loadTime > 1000) {
        console.warn('Dashboard refresh took longer than expected:', loadTime.toFixed(2) + 'ms');
      }
    } catch (error) {
      console.error('Error refreshing dashboard data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const token = authService.getToken();
      
      const user = authService.getUser();
      console.log('AdminDashboard: Token check', { 
        hasToken: !!token, 
        tokenLength: token?.length,
        isAuthenticated: authService.isAuthenticated(),
        user: user,
        userRole: user?.role,
        userEmail: user?.email,
        hasAdminRole: authService.hasRole('admin')
      });
      
      if (!token) {
        console.warn('AdminDashboard: No token found, redirecting to login');
        navigate('/login');
        return;
      }

      if (!authService.hasRole('admin')) {
        console.warn('AdminDashboard: User does not have admin role, redirecting to dashboard');
        navigate('/dashboard');
        return;
      }

      // Fetch both old and new data
      await Promise.all([
        fetchOldAdminData(token),
        refreshDashboardData()
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch admin data');
      console.error('Admin data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Renamed the original function
  const fetchOldAdminData = async (token: string) => {
    try {
      // Make all API calls in parallel for better performance
      const [statsResponse, venuesResponse, activitiesResponse, bookingsResponse] = await Promise.allSettled([
      fetch(buildApiUrl('/admin/stats'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }),
      fetch(buildApiUrl('/admin/venues'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }),
      fetch(buildApiUrl('/admin/activities'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }),
      fetch(buildApiUrl('/admin/recent-bookings'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
    ]);

      // Process stats with better error handling
      if (statsResponse.status === 'fulfilled' && statsResponse.value.ok) {
        try {
          const statsData = await statsResponse.value.json();
          setStats(statsData.data);
        } catch (parseError) {
          console.warn('Failed to parse stats data, using defaults');
          setStats({
            totalUsers: 0,
            totalVenues: 0,
            totalActivities: 0,
            totalBookings: 0,
            totalRevenue: 0,
            pendingBookings: 0,
            activeVenues: 0,
            upcomingActivities: 0,
            monthlyGrowth: 0
          });
        }
      } else {
        console.warn('Failed to fetch stats, using defaults');
        setStats({
          totalUsers: 0,
          totalVenues: 0,
          totalActivities: 0,
          totalBookings: 0,
          totalRevenue: 0,
          pendingBookings: 0,
          activeVenues: 0,
          upcomingActivities: 0,
          monthlyGrowth: 0
        });
      }

      // Process venues with better error handling
      if (venuesResponse.status === 'fulfilled' && venuesResponse.value.ok) {
        try {
          const venuesData = await venuesResponse.value.json();
          setVenues(venuesData.data || []);
        } catch (parseError) {
          console.warn('Failed to parse venues data');
          setVenues([]);
        }
      } else {
        console.warn('Failed to fetch venues');
        setVenues([]);
      }

      // Process activities
      if (activitiesResponse.status === 'fulfilled' && activitiesResponse.value.ok) {
        const activitiesData = await activitiesResponse.value.json();
        setActivities(activitiesData.data || []);
      } else {
        console.warn('Failed to fetch activities');
        setActivities([]);
      }

      // Process bookings
      if (bookingsResponse.status === 'fulfilled' && bookingsResponse.value.ok) {
        const bookingsData = await bookingsResponse.value.json();
        setRecentBookings(bookingsData.data || []);
      } else {
        console.warn('Failed to fetch bookings');
        setRecentBookings([]);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch admin data');
      console.error('Admin data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVenueAction = async (venueId: string, action: 'activate' | 'deactivate' | 'delete') => {
    try {
      const token = authService.getToken();
      if (!token) return;

      let method = 'PUT';
      let endpoint = buildApiUrl(`/admin/venues/${venueId}`);
      
      if (action === 'delete') {
        method = 'DELETE';
      }

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: action !== 'delete' ? JSON.stringify({ status: action === 'activate' ? 'active' : 'inactive' }) : undefined,
      });

      if (response.ok) {
        toast.success(`Venue ${action}d successfully`);
        fetchAdminData(); // Refresh data
      } else {
        throw new Error(`Failed to ${action} venue`);
      }
    } catch (error) {
      console.error(`Error ${action}ing venue:`, error);
      toast.error(`Failed to ${action} venue`);
    }
  };

  const handleActivityAction = async (activityId: string, action: 'activate' | 'deactivate' | 'delete') => {
    try {
      const token = authService.getToken();
      if (!token) return;

      let method = 'PUT';
      let endpoint = buildApiUrl(`/admin/activities/${activityId}`);
      
      if (action === 'delete') {
        method = 'DELETE';
      }

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: action !== 'delete' ? JSON.stringify({ status: action === 'activate' ? 'active' : 'inactive' }) : undefined,
      });

      if (response.ok) {
        toast.success(`Activity ${action}d successfully`);
        fetchAdminData(); // Refresh data
      } else {
        throw new Error(`Failed to ${action} activity`);
      }
    } catch (error) {
      console.error(`Error ${action}ing activity:`, error);
      toast.error(`Failed to ${action} activity`);
    }
  };

  const handleViewItem = (item: any) => {
    setSelectedItem(item);
    setShowViewModal(true);
  };

  const handleEditItem = (item: any) => {
    setSelectedItem(item);
    setShowEditModal(true);
  };

  const handleDeleteItem = (item: any) => {
    setItemToDelete(item);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    
    try {
      // Use specific venue delete function if it's a venue
      if (activeTab === 'venues') {
        await handleVenueAction(itemToDelete.id, 'delete');
      } else {
        const token = authService.getToken();
        if (!token) return;

        const response = await fetch(buildApiUrl(`/admin/${activeTab}/${itemToDelete.id}`), {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          toast.success(`${activeTab.slice(0, -1)} deleted successfully`);
          fetchAdminData();
        } else {
          throw new Error(`Failed to delete ${activeTab.slice(0, -1)}`);
        }
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(`Failed to delete ${activeTab.slice(0, -1)}`);
    } finally {
      setShowDeleteConfirm(false);
      setItemToDelete(null);
    }
  };

  const handleExport = () => {
    const data = activeTab === 'activities' ? activities : 
                 activeTab === 'venues' ? venues : 
                 activeTab === 'bookings' ? recentBookings : [];
    
    const csvContent = "data:text/csv;charset=utf-8," + 
      Object.keys(data[0] || {}).join(",") + "\n" +
      data.map(row => Object.values(row).join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${activeTab}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(`${activeTab} exported successfully`);
  };


  const getStatusBadge = (status: string | undefined | null) => {
    if (!status) {
    return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          Unknown
        </span>
      );
    }

    const statusClasses = {
      active: 'bg-green-100 text-green-800',
      confirmed: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      inactive: 'bg-red-100 text-red-800',
      cancelled: 'bg-red-100 text-red-800',
      draft: 'bg-gray-100 text-gray-800'
    };
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClasses[status as keyof typeof statusClasses] || statusClasses.draft}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const AddActivityModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Add New Activity</h2>
        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Activity Name</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Enter activity name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option>Sports</option>
              <option>Arts & Crafts</option>
              <option>Music</option>
              <option>Education</option>
              <option>Outdoor</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option>Community Pool</option>
              <option>Art Studio</option>
              <option>Sports Complex</option>
              <option>Music School</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price (£)</label>
            <input
              type="number"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="25.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Capacity</label>
            <input
              type="number"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Activity description..."
            />
          </div>
          <div className="flex space-x-3 pt-4">
            <Button
              type="button"
              onClick={() => setShowAddModal(false)}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Create Activity
          </Button>
          </div>
        </form>
        </div>
      </div>
    );

  const ViewModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">View Details</h2>
          <button
            onClick={() => setShowViewModal(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {selectedItem && (
          <div className="space-y-4">
            {activeTab === 'activities' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Activity Name</label>
                  <p className="text-gray-900">{selectedItem.name || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <p className="text-gray-900">{selectedItem.category || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
                  <p className="text-gray-900">{selectedItem.venue_name || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                  <p className="text-gray-900">£{selectedItem.price || 0}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                  <p className="text-gray-900">{selectedItem.current_capacity || 0}/{selectedItem.max_capacity || 0}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  {getStatusBadge(selectedItem.status)}
                </div>
              </>
            )}
            
            {activeTab === 'venues' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Venue Name</label>
                  <p className="text-gray-900">{selectedItem.name || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <p className="text-gray-900">{selectedItem.address || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <p className="text-gray-900">{selectedItem.city || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Activities</label>
                  <p className="text-gray-900">{selectedItem.totalActivities || 0}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Revenue</label>
                  <p className="text-gray-900">£{selectedItem.revenue || 0}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  {getStatusBadge(selectedItem.status)}
                </div>
              </>
            )}
            
            {activeTab === 'bookings' && (
              <>
            <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                  <p className="text-gray-900">{selectedItem.customer_name || 'N/A'}</p>
            </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Activity</label>
                  <p className="text-gray-900">{selectedItem.activity_name || 'N/A'}</p>
            </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
                  <p className="text-gray-900">{selectedItem.venue_name || 'N/A'}</p>
          </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                  <p className="text-gray-900">£{selectedItem.totalAmount || 0}</p>
        </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  {getStatusBadge(selectedItem.status)}
      </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <p className="text-gray-900">{new Date(selectedItem.created_at).toLocaleDateString()}</p>
                </div>
              </>
            )}
          </div>
        )}
        
        <div className="flex space-x-3 pt-4">
          <Button
            onClick={() => setShowViewModal(false)}
            variant="outline"
            className="flex-1"
          >
            Close
          </Button>
          <Button
            onClick={() => {
              setShowViewModal(false);
              handleEditItem(selectedItem);
            }}
            className="flex-1"
          >
            Edit
          </Button>
        </div>
      </div>
    </div>
  );

  const DeleteConfirmModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center mb-4">
          <div className="p-2 bg-red-100 rounded-lg mr-3">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Confirm Delete</h2>
        </div>
        
        <p className="text-gray-600 mb-6">
          Are you sure you want to delete this {activeTab.slice(0, -1)}? This action cannot be undone.
        </p>
        
        <div className="flex space-x-3">
          <Button
            onClick={() => setShowDeleteConfirm(false)}
            variant="outline"
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={confirmDelete}
            className="flex-1 bg-red-600 hover:bg-red-700"
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
       case 'dashboard':
         return (
           <div className="space-y-6">
             <div className="flex items-center justify-between">
               <div>
                 <h2 className="text-2xl font-bold text-gray-900">Dashboard Overview</h2>
                 <p className="text-gray-600">Welcome to the admin panel</p>
               </div>
               <div className="flex items-center space-x-2">
                 <span className="text-sm text-gray-500">Last updated: {new Date().toLocaleTimeString()}</span>
                 <Button onClick={fetchAdminData} size="sm" variant="outline">
                   <ArrowUpIcon className="h-4 w-4 mr-1" />
                   Refresh
                 </Button>
               </div>
             </div>
            
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800">{error}</p>
              </div>
            ) : (
              <div className="space-y-6">
        {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <UsersIcon className="h-6 w-6 text-blue-600" />
                  </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">Total Users</p>
                          <p className="text-2xl font-bold text-gray-900">{stats?.totalUsers || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <MapPinIcon className="h-6 w-6 text-green-600" />
        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">Total Venues</p>
                          <p className="text-2xl font-bold text-gray-900">{stats?.totalVenues || 0}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
            <CardContent className="p-6">
                      <div className="flex items-center">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <CalendarDaysIcon className="h-6 w-6 text-purple-600" />
                </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">Total Activities</p>
                          <p className="text-2xl font-bold text-gray-900">{stats?.totalActivities || 0}</p>
              </div>
              </div>
            </CardContent>
          </Card>

                  <Card>
            <CardContent className="p-6">
                      <div className="flex items-center">
                        <div className="p-2 bg-yellow-100 rounded-lg">
                          <CurrencyPoundIcon className="h-6 w-6 text-yellow-600" />
                </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                          <p className="text-2xl font-bold text-gray-900">£{stats?.totalRevenue?.toLocaleString() || 0}</p>
              </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Activity */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <ClockIcon className="h-5 w-5 mr-2 text-gray-600" />
                      Recent Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {recentBookings.slice(0, 5).map((booking) => (
                        <div key={booking.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center">
                            <div className="p-2 bg-blue-100 rounded-lg mr-3">
                              <CalendarDaysIcon className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{booking.activity_name || 'Unknown Activity'}</p>
                              <p className="text-sm text-gray-500">{booking.venue_name || 'Unknown Venue'}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-gray-900">£{booking.totalAmount || 0}</p>
                            {getStatusBadge(booking.status)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        );

       case 'activities':
         return (
           <div className="space-y-6">
             <div className="flex items-center justify-between">
               <h2 className="text-2xl font-bold text-gray-900">Activities Management</h2>
               <Button onClick={() => setShowAddModal(true)}>
                 <PlusIcon className="h-4 w-4 mr-2" />
                 Add Activity
               </Button>
             </div>

            {/* Search and Filters */}
            <div className="mb-6 flex items-center space-x-4">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search activities..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="outline">
                <FunnelIcon className="h-4 w-4 mr-2" />
                Filter
              </Button>
            </div>

            {/* Activities Table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Activity</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Venue</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Capacity</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {activities.map((activity) => (
                        <tr key={activity.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{activity.name || 'Unknown Activity'}</div>
                              <div className="text-sm text-gray-500">{activity.category || 'Uncategorized'}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{activity.venue_name || 'Unknown Venue'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">£{activity.price || 0}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {activity.current_capacity || 0}/{activity.max_capacity || 0}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(activity.status)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center space-x-2">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleViewItem(activity)}
                              >
                                <EyeIcon className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleEditItem(activity)}
                              >
                                <PencilIcon className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="text-red-600 hover:text-red-700"
                                onClick={() => handleDeleteItem(activity)}
                              >
                                <TrashIcon className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              </div>
            </CardContent>
          </Card>
          </div>
        );

      case 'venues':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Venues Management</h2>
              <div className="flex space-x-3">
                <Button variant="outline" onClick={handleExport}>
                  <FunnelIcon className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button onClick={() => navigate('/admin/venues/new')}>
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Add Venue
                </Button>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="mb-6 flex items-center space-x-4">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search venues..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="outline">
                <FunnelIcon className="h-4 w-4 mr-2" />
                Filter
              </Button>
            </div>

            {/* Venues Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {venues.map((venue) => (
                <Card key={venue.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <div className="p-2 bg-green-100 rounded-lg mr-3">
                          <MapPinIcon className="h-5 w-5 text-green-600" />
                </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{venue.name}</h3>
                          <p className="text-sm text-gray-500">{venue.city}</p>
              </div>
                      </div>
                      {getStatusBadge(venue.status)}
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <p className="text-sm text-gray-600">{venue.address}</p>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Activities: {venue.totalActivities}</span>
                        <span className="text-gray-500">Bookings: {venue.totalBookings}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-500">Revenue: </span>
                        <span className="font-medium text-green-600">£{venue.revenue?.toLocaleString() || 0}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => handleViewItem(venue)}
                      >
                        <EyeIcon className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => handleEditItem(venue)}
                      >
                        <PencilIcon className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-red-600 hover:text-red-700"
                        onClick={() => {
                          setItemToDelete(venue);
                          setShowDeleteConfirm(true);
                        }}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
              </div>
            </CardContent>
          </Card>
              ))}
            </div>
          </div>
        );

      case 'bookings':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-gray-900">Bookings Management</h1>
              <div className="flex space-x-3">
                <Button variant="outline" onClick={handleExport}>
                  <FunnelIcon className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button variant="outline">
                  <ClockIcon className="h-4 w-4 mr-2" />
                  Calendar View
                </Button>
                <Button onClick={() => navigate('/admin/bookings')}>
                  <PlusIcon className="h-4 w-4 mr-2" />
                  New Booking
                </Button>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="mb-6 flex items-center space-x-4">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search bookings..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="outline">
                <FunnelIcon className="h-4 w-4 mr-2" />
                Filter
              </Button>
            </div>

            {/* Bookings Table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Activity</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Venue</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {recentBookings.map((booking) => (
                        <tr key={booking.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                                <UserIcon className="h-4 w-4 text-blue-600" />
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900">{booking.customer_name}</div>
                                <div className="text-sm text-gray-500">{booking.user?.name}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{booking.activity_name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{booking.venue_name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">£{booking.totalAmount}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(booking.status)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(booking.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center space-x-2">
                              <Button size="sm" variant="outline">
                                <EyeIcon className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="outline">
                                <PencilIcon className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'registers':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-gray-900">Attendance Registers</h1>
              <div className="flex space-x-3">
                <Button variant="outline">
                  <FunnelIcon className="h-4 w-4 mr-2" />
                  Export Reports
                </Button>
                <Button onClick={() => navigate('/admin/registers')}>
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Create Register
                </Button>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <Card>
            <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg mr-3">
                      <UsersIcon className="h-5 w-5 text-blue-600" />
                </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Students</p>
                      <p className="text-2xl font-bold text-gray-900">156</p>
              </div>
              </div>
            </CardContent>
          </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-green-100 rounded-lg mr-3">
                      <CheckCircleIcon className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Present Today</p>
                      <p className="text-2xl font-bold text-gray-900">142</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-red-100 rounded-lg mr-3">
                      <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Absent Today</p>
                      <p className="text-2xl font-bold text-gray-900">14</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-yellow-100 rounded-lg mr-3">
                      <ClockIcon className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Late Arrivals</p>
                      <p className="text-2xl font-bold text-gray-900">8</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <div className="p-2 bg-blue-100 rounded-lg mr-3">
                        <DocumentTextIcon className="h-5 w-5 text-blue-600" />
                </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Swimming Class</h3>
                        <p className="text-sm text-gray-500">Today, 3:00 PM</p>
              </div>
                    </div>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Active</span>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Total Students:</span>
                      <span className="font-medium">12</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Present:</span>
                      <span className="font-medium text-green-600">10</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Absent:</span>
                      <span className="font-medium text-red-600">2</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Late:</span>
                      <span className="font-medium text-yellow-600">1</span>
                    </div>
                  </div>

              <div className="flex space-x-2">
                    <Button size="sm" className="flex-1">
                      <EyeIcon className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    <Button size="sm" variant="outline">
                      <PencilIcon className="h-4 w-4" />
                    </Button>
              </div>
            </CardContent>
          </Card>

              <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <div className="p-2 bg-green-100 rounded-lg mr-3">
                        <DocumentTextIcon className="h-5 w-5 text-green-600" />
                </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Art Workshop</h3>
                        <p className="text-sm text-gray-500">Tomorrow, 2:00 PM</p>
              </div>
                    </div>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">Scheduled</span>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Total Students:</span>
                      <span className="font-medium">8</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Registered:</span>
                      <span className="font-medium text-blue-600">8</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Waitlist:</span>
                      <span className="font-medium text-yellow-600">2</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Instructor:</span>
                      <span className="font-medium">Sarah Johnson</span>
                    </div>
                  </div>

              <div className="flex space-x-2">
                    <Button size="sm" className="flex-1">
                      <EyeIcon className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    <Button size="sm" variant="outline">
                      <PencilIcon className="h-4 w-4" />
                    </Button>
              </div>
            </CardContent>
          </Card>

              <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <div className="p-2 bg-purple-100 rounded-lg mr-3">
                        <DocumentTextIcon className="h-5 w-5 text-purple-600" />
                </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Football Training</h3>
                        <p className="text-sm text-gray-500">Yesterday, 4:00 PM</p>
              </div>
                    </div>
                    <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-full">Completed</span>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Total Students:</span>
                      <span className="font-medium">15</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Present:</span>
                      <span className="font-medium text-green-600">14</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Absent:</span>
                      <span className="font-medium text-red-600">1</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Attendance:</span>
                      <span className="font-medium text-green-600">93%</span>
                    </div>
                  </div>

              <div className="flex space-x-2">
                    <Button size="sm" className="flex-1">
                      <EyeIcon className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    <Button size="sm" variant="outline">
                      <PencilIcon className="h-4 w-4" />
                    </Button>
              </div>
            </CardContent>
          </Card>
        </div>
          </div>
        );

      case 'payments':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-gray-900">Payments & Transactions</h1>
              <Button onClick={() => navigate('/admin/financial')}>
                <PlusIcon className="h-4 w-4 mr-2" />
                Process Payment
              </Button>
            </div>

            {/* Payment Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <Card>
              <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-green-100 rounded-lg mr-3">
                      <CurrencyPoundIcon className="h-5 w-5 text-green-600" />
                  </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                      <p className="text-2xl font-bold text-gray-900">£{stats?.totalRevenue?.toLocaleString() || 0}</p>
                </div>
                  </div>
              </CardContent>
            </Card>

              <Card>
              <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg mr-3">
                      <CreditCardIcon className="h-5 w-5 text-blue-600" />
                  </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Pending Payments</p>
                      <p className="text-2xl font-bold text-gray-900">£{stats?.pendingBookings ? stats.pendingBookings * 25 : 0}</p>
                </div>
                  </div>
              </CardContent>
            </Card>

              <Card>
              <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-yellow-100 rounded-lg mr-3">
                      <ClockIcon className="h-5 w-5 text-yellow-600" />
                  </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">This Month</p>
                      <p className="text-2xl font-bold text-gray-900">£{(stats?.totalRevenue || 0) * 0.3}</p>
                </div>
                  </div>
              </CardContent>
            </Card>

              <Card>
              <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-purple-100 rounded-lg mr-3">
                      <ChartBarIcon className="h-5 w-5 text-purple-600" />
                  </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Growth</p>
                      <p className="text-2xl font-bold text-green-600">+12%</p>
                </div>
                </div>
              </CardContent>
            </Card>
        </div>

            {/* Recent Transactions */}
          <Card>
            <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                  {recentBookings.slice(0, 5).map((booking) => (
                    <div key={booking.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <div className="p-2 bg-green-100 rounded-lg mr-3">
                          <CurrencyPoundIcon className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{booking.customer_name}</p>
                          <p className="text-sm text-gray-500">{booking.activity_name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">£{booking.totalAmount}</p>
                        <p className="text-sm text-gray-500">{new Date(booking.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
                </div>
        );

      case 'communications':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-gray-900">Communications</h1>
              <Button>
                <PlusIcon className="h-4 w-4 mr-2" />
                Send Message
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Email Templates */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <MegaphoneIcon className="h-5 w-5 mr-2" />
                    Email Templates
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <h4 className="font-medium text-gray-900">Welcome Email</h4>
                      <p className="text-sm text-gray-500">Sent to new users upon registration</p>
                    </div>
                    <div className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <h4 className="font-medium text-gray-900">Booking Confirmation</h4>
                      <p className="text-sm text-gray-500">Sent when a booking is confirmed</p>
                    </div>
                    <div className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <h4 className="font-medium text-gray-900">Reminder Email</h4>
                      <p className="text-sm text-gray-500">Sent 24 hours before activity</p>
                    </div>
                  </div>
            </CardContent>
          </Card>

              {/* Broadcast Messages */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                    <ChatBubbleLeftRightIcon className="h-5 w-5 mr-2" />
                    Broadcast Messages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h4 className="font-medium text-blue-900">System Maintenance</h4>
                      <p className="text-sm text-blue-700">Scheduled maintenance on Sunday, 2:00 AM</p>
                      <p className="text-xs text-blue-600 mt-2">Sent to all users • 2 hours ago</p>
                </div>
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <h4 className="font-medium text-green-900">New Activities Available</h4>
                      <p className="text-sm text-green-700">Check out our new swimming and art classes!</p>
                      <p className="text-xs text-green-600 mt-2">Sent to parents • 1 day ago</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case 'settings':
        return (
          <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">System Settings</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* General Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>General Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Site Name</label>
                    <input
                      type="text"
                      defaultValue="BookOn"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Contact Email</label>
                    <input
                      type="email"
                      defaultValue="admin@bookon.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                      <option>UTC</option>
                      <option>Europe/London</option>
                      <option>America/New_York</option>
                    </select>
                  </div>
                  <Button className="w-full">Save Changes</Button>
                </CardContent>
              </Card>

              {/* Notification Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Notification Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Email Notifications</p>
                      <p className="text-sm text-gray-500">Receive email notifications for important events</p>
                    </div>
                    <input type="checkbox" defaultChecked className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">SMS Notifications</p>
                      <p className="text-sm text-gray-500">Receive SMS notifications for urgent matters</p>
                </div>
                    <input type="checkbox" className="h-4 w-4 text-blue-600" />
                </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Booking Reminders</p>
                      <p className="text-sm text-gray-500">Send reminders before scheduled activities</p>
              </div>
                    <input type="checkbox" defaultChecked className="h-4 w-4 text-blue-600" />
                  </div>
                  <Button className="w-full">Save Preferences</Button>
            </CardContent>
          </Card>
        </div>
      </div>
        );

      case 'tfc-queue':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-gray-900">TFC Payment Queue</h1>
              <Button onClick={() => navigate('/admin/tfc-queue')}>
                <ClockIcon className="h-4 w-4 mr-2" />
                View Full Queue
              </Button>
            </div>

            {/* TFC Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg mr-3">
                      <ClockIcon className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Pending TFC</p>
                      <p className="text-2xl font-bold text-gray-900">12</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-orange-100 rounded-lg mr-3">
                      <ExclamationTriangleIcon className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Urgent</p>
                      <p className="text-2xl font-bold text-gray-900">3</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-red-100 rounded-lg mr-3">
                      <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Expired</p>
                      <p className="text-2xl font-bold text-gray-900">1</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-green-100 rounded-lg mr-3">
                      <CurrencyPoundIcon className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Value</p>
                      <p className="text-2xl font-bold text-gray-900">£480</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent TFC Bookings */}
            <Card>
              <CardHeader>
                <CardTitle>Recent TFC Bookings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      <div>
                        <p className="font-medium">Emma Johnson</p>
                        <p className="text-sm text-gray-600">Swimming Lessons - £25.00</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">TFC-20250101-123456</p>
                      <p className="text-xs text-gray-600">2 days left</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <div>
                        <p className="font-medium">James Smith</p>
                        <p className="text-sm text-gray-600">Football Training - £30.00</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">TFC-20250101-123457</p>
                      <p className="text-xs text-gray-600">4 days left</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 text-center">
                  <Button variant="outline" onClick={() => navigate('/admin/tfc-queue')}>
                    View All TFC Bookings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'provider-settings':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-gray-900">Provider Settings</h1>
              <Button onClick={() => navigate('/admin/provider-settings')}>
                <CogIcon className="h-4 w-4 mr-2" />
                Manage Settings
              </Button>
            </div>

            {/* Provider Settings Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-green-100 rounded-lg mr-3">
                      <CurrencyPoundIcon className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">TFC Enabled</p>
                      <p className="text-2xl font-bold text-gray-900">3</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg mr-3">
                      <ClockIcon className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Avg Hold Period</p>
                      <p className="text-2xl font-bold text-gray-900">5 days</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-orange-100 rounded-lg mr-3">
                      <CurrencyPoundIcon className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Avg Admin Fee</p>
                      <p className="text-2xl font-bold text-gray-900">£2.00</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button onClick={() => navigate('/admin/provider-settings')} className="h-20">
                    <div className="text-center">
                      <CogIcon className="h-6 w-6 mx-auto mb-2" />
                      <span className="text-sm">Configure TFC Settings</span>
                    </div>
                  </Button>
                  <Button onClick={() => navigate('/admin/provider-settings')} variant="outline" className="h-20">
                    <div className="text-center">
                      <CurrencyPoundIcon className="h-6 w-6 mx-auto mb-2" />
                      <span className="text-sm">Manage Refund Policies</span>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-gray-900">Notification Management</h1>
              <Button onClick={() => navigate('/admin/notifications')}>
                <BellIcon className="h-4 w-4 mr-2" />
                Manage Notifications
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <BellIcon className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Notifications</p>
                      <p className="text-2xl font-bold text-gray-900">24</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <CheckCircleIcon className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Sent Today</p>
                      <p className="text-2xl font-bold text-gray-900">8</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-3 bg-yellow-100 rounded-lg">
                      <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Pending</p>
                      <p className="text-2xl font-bold text-gray-900">3</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Recent Notifications</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Click "Manage Notifications" to view and manage all notifications.</p>
              </CardContent>
            </Card>
          </div>
        );

      case 'webhooks':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-gray-900">Webhook Management</h1>
              <Button onClick={() => navigate('/admin/webhooks')}>
                <MegaphoneIcon className="h-4 w-4 mr-2" />
                Manage Webhooks
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <MegaphoneIcon className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Events</p>
                      <p className="text-2xl font-bold text-gray-900">156</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <CheckCircleIcon className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Successful</p>
                      <p className="text-2xl font-bold text-gray-900">142</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-3 bg-red-100 rounded-lg">
                      <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Failed</p>
                      <p className="text-2xl font-bold text-gray-900">14</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Webhook Events</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Click "Manage Webhooks" to view and manage all webhook events.</p>
              </CardContent>
            </Card>
          </div>
        );

      case 'widget':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-gray-900">Widget Management</h1>
              <Button onClick={() => navigate('/admin/widget')}>
                <ComputerDesktopIcon className="h-4 w-4 mr-2" />
                Manage Widgets
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <ComputerDesktopIcon className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Active Widgets</p>
                      <p className="text-2xl font-bold text-gray-900">3</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <ChartBarIcon className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Views</p>
                      <p className="text-2xl font-bold text-gray-900">1,247</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-3 bg-purple-100 rounded-lg">
                      <ClipboardDocumentListIcon className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Bookings</p>
                      <p className="text-2xl font-bold text-gray-900">89</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Widget Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Click "Manage Widgets" to view and manage all widget configurations and analytics.</p>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return (
          <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
            <p className="text-gray-600">Welcome to the admin panel</p>
          </div>
        );
    }
  };

  // New Dashboard Header Component
  const DashboardHeader = () => (
    <div className="sticky top-0 z-40 bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <div className="flex items-center space-x-2">
            <select
              value={dateRange}
              onChange={(e) => {
                setDateRange(e.target.value as 'today' | 'week' | 'month');
                refreshDashboardData();
              }}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
            <button
              onClick={refreshDashboardData}
              disabled={isRefreshing}
              className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
              aria-label="Refresh dashboard data"
            >
              <ArrowPathIcon className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Notification Bell */}
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 rounded-full"
            aria-label={`You have ${unreadNotifications} unread notifications`}
          >
            <BellIcon className="h-6 w-6" />
            {unreadNotifications > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {unreadNotifications}
              </span>
            )}
          </button>
          
          {/* Profile Menu */}
          <div className="relative">
            <button className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 rounded-lg p-2">
              <div className="h-8 w-8 bg-teal-500 rounded-full flex items-center justify-center">
                <UserIcon className="h-5 w-5 text-white" />
              </div>
              <span className="text-sm font-medium">{authService.getUser()?.firstName}</span>
              <ChevronDownIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Notifications Panel */}
      {showNotifications && (
        <div className="absolute right-4 top-16 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
              <button
                onClick={() => setShowNotifications(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length > 0 ? (
              notifications.map((notification) => (
                <div key={notification.id} className="p-4 border-b border-gray-100 hover:bg-gray-50">
                  <div className="flex items-start space-x-3">
                    <div className={`h-2 w-2 rounded-full mt-2 ${
                      notification.type === 'booking' ? 'bg-green-500' :
                      notification.type === 'cancellation' ? 'bg-red-500' :
                      notification.type === 'waitlist' ? 'bg-yellow-500' :
                      'bg-blue-500'
                    }`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                      <p className="text-xs text-gray-500">{new Date(notification.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500">
                <BellIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>You're all caught up 🎉</p>
              </div>
            )}
          </div>
          {notifications.length > 0 && (
            <div className="p-4 border-t border-gray-200">
              <button className="w-full text-sm text-teal-600 hover:text-teal-700 font-medium">
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // New Snapshot Cards Component - Premium Design
  const SnapshotCards = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 p-4 lg:p-6">
      {/* Activities Running Today */}
      <Card className="group hover:shadow-xl transition-all duration-300 cursor-pointer bg-gradient-to-br from-white to-teal-50 border-0 shadow-lg hover:scale-105">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-3 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                <CalendarDaysIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Activities Running</p>
                <p className="text-3xl font-bold text-gray-900">
                  {dashboardSnapshot?.activities_running || 0}
                </p>
                <p className="text-sm text-teal-600 font-medium">
                  {dashboardSnapshot?.attendees_today || 0} children
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse"></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Parents Registered */}
      <Card className="group hover:shadow-xl transition-all duration-300 cursor-pointer bg-gradient-to-br from-white to-blue-50 border-0 shadow-lg hover:scale-105">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                <UsersIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Parents Registered</p>
                <p className="text-3xl font-bold text-gray-900">
                  {dashboardSnapshot?.parents_registered || 0}
                </p>
                <p className="text-sm text-blue-600 font-medium">Active accounts</p>
              </div>
            </div>
            <div className="text-right">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payments Collected Today */}
      <Card className="group hover:shadow-xl transition-all duration-300 cursor-pointer bg-gradient-to-br from-white to-green-50 border-0 shadow-lg hover:scale-105">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                <CurrencyPoundIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Payments Collected</p>
                <p className="text-3xl font-bold text-gray-900">
                  {formatPrice(dashboardSnapshot?.payments_total)}
                </p>
                <p className="text-sm text-green-600 font-medium">Settled today</p>
              </div>
            </div>
            <div className="text-right">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Refunds / Credits Issued */}
      <Card className="group hover:shadow-xl transition-all duration-300 cursor-pointer bg-gradient-to-br from-white to-red-50 border-0 shadow-lg hover:scale-105">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-3 bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                <ArrowPathIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Refunds & Credits</p>
                <p className="text-3xl font-bold text-gray-900">
                  {formatPrice((dashboardSnapshot?.refunds_total || 0) + (dashboardSnapshot?.credits_total || 0))}
                </p>
                <p className="text-sm text-red-600 font-medium">Issued today</p>
              </div>
            </div>
            <div className="text-right">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Upcoming Activities Component
  const UpcomingActivities = () => (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">Upcoming Activities</CardTitle>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/admin/activities')}
          >
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {upcomingActivities.length > 0 ? (
          <div className="space-y-4">
            {upcomingActivities.map((activity) => {
              const booked = activity.booked || 0;
              const capacity = activity.capacity || 0;
              const capacityPercentage = capacity > 0 ? (booked / capacity) * 100 : 0;
              const isFull = capacityPercentage >= 100;
              const isNearFull = capacityPercentage >= 80;
              
              return (
                <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-semibold text-gray-900 text-sm">{activity.name}</h4>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        isFull ? 'bg-red-100 text-red-800' :
                        isNearFull ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {isFull ? 'Full' : `${booked}/${capacity}`}
                      </span>
                    </div>
                    <div className="flex items-center space-x-4 mt-1">
                      <div className="flex items-center text-xs text-gray-500">
                        <ClockIcon className="h-3 w-3 mr-1" />
                        {new Date(activity.start_time).toLocaleDateString('en-GB', { 
                          weekday: 'short', 
                          month: 'short', 
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                      <div className="flex items-center text-xs text-gray-500">
                        <MapPinIcon className="h-3 w-3 mr-1" />
                        {activity.venue_name}
                      </div>
                    </div>
                  </div>
                  {activity.waitlist_count > 0 && (
                    <div className="ml-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                        {activity.waitlist_count} waitlist
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <CalendarDaysIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 mb-4">No upcoming activities</p>
            <Button onClick={() => navigate('/admin/activities')} size="sm">
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Activity
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // Finance Summary Component
  const FinanceSummary = () => (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">Finance Summary</CardTitle>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/admin/payments')}
          >
            View Details
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {financeSummary ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg mr-3">
                  <CurrencyPoundIcon className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Income</p>
                  <p className="text-lg font-bold text-green-600">{formatPrice(financeSummary.income)}</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div className="flex items-center">
                <div className="p-2 bg-red-100 rounded-lg mr-3">
                  <ArrowPathIcon className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Refunds</p>
                  <p className="text-lg font-bold text-red-600">{formatPrice(financeSummary.refunds)}</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg mr-3">
                  <CreditCardIcon className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Credits</p>
                  <p className="text-lg font-bold text-blue-600">{formatPrice(financeSummary.credits)}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <CurrencyPoundIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 mb-4">No financial data available</p>
            <Button onClick={() => navigate('/admin/payments')} size="sm">
              View Transactions
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // Notifications Feed Component
  const NotificationsFeed = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">Recent Notifications</CardTitle>
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {/* Mark all as read */}}
            >
              Mark All Read
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/admin/notifications')}
            >
              View All
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {notifications.length > 0 ? (
          <div className="space-y-3">
            {notifications.slice(0, 5).map((notification) => (
              <div key={notification.id} className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                <div className={`h-2 w-2 rounded-full mt-2 flex-shrink-0 ${
                  notification.type === 'booking' ? 'bg-green-500' :
                  notification.type === 'cancellation' ? 'bg-red-500' :
                  notification.type === 'waitlist' ? 'bg-yellow-500' :
                  'bg-blue-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                  <p className="text-xs text-gray-500">{new Date(notification.created_at).toLocaleString()}</p>
                </div>
                {notification.action_url && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => navigate(notification.action_url)}
                  >
                    View
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <BellIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 mb-4">You're all caught up 🎉</p>
            <p className="text-sm text-gray-400">No new notifications</p>
          </div>
        )}
      </CardContent>
    </Card>
  );


  return (
    <AdminLayout title="Admin Dashboard">
      <div className="space-y-6">
        <SnapshotCards />
        
        {/* Main Dashboard Content - Responsive Layout */}
        <div className="space-y-6">
          {/* Desktop: Two-column grid beneath snapshots */}
          <div className="hidden lg:grid lg:grid-cols-2 lg:gap-6">
            <UpcomingActivities />
            <FinanceSummary />
          </div>
          
          {/* Tablet: Stacked layout */}
          <div className="hidden md:block lg:hidden space-y-6">
            <UpcomingActivities />
            <FinanceSummary />
          </div>
          
          {/* Mobile: Stacked layout */}
          <div className="md:hidden space-y-6">
            <UpcomingActivities />
            <FinanceSummary />
          </div>
          
          {/* Notifications Feed - Full width under both */}
          <NotificationsFeed />
          
        </div>
        
        {/* Modals */}
        {showAddModal && <AddActivityModal />}
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
