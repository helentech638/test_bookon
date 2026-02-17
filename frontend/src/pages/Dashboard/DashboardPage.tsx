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
  ClockIcon,
  MapPinIcon,
  UserGroupIcon,
  UserIcon,
  CogIcon,
  BellIcon,
  DocumentTextIcon,
  AcademicCapIcon,
  BuildingOfficeIcon,
  ClipboardDocumentListIcon,
  CreditCardIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { authService } from '../../services/authService';
import { BookingWidget } from '../../components/booking/BookingWidget';
import toast from 'react-hot-toast';
import { buildApiUrl, API_CONFIG } from '../../config/api';
import { formatPrice } from '../../utils/formatting';
import { useNotifications } from '../../hooks/useNotifications';

interface DashboardStats {
  totalBookings: number;
  confirmedBookings: number;
  totalSpent: number;
  upcomingActivities: number;
  memberSince: number;
  lastLogin: string;
  totalActivities: number;
  totalVenues: number;
  pendingBookings: number;
  cancelledBookings: number;
}

interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  memberSince: string;
  phone?: string;
  address?: string;
}

interface RecentActivity {
  id: string;
  type: 'booking' | 'activity' | 'payment' | 'login';
  title: string;
  description: string;
  timestamp: string;
  status?: string;
}

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showQuickBooking, setShowQuickBooking] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(0);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    const startTime = performance.now();
    try {
      setLoading(true);
      const token = authService.getToken();
      const isAuth = authService.isAuthenticated();
      
      if (!token || !isAuth) {
        window.location.href = '/login';
        return;
      }

      // Skip expensive token verification - API calls will handle auth validation
      // This saves ~1-2 seconds on dashboard load

      // Make all API calls in parallel for better performance
      const apiStartTime = performance.now();
      
      // Create AbortController for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const [statsResponse, profileResponse, activitiesResponse, walletResponse] = await Promise.allSettled([
        authService.authenticatedFetch(buildApiUrl(API_CONFIG.ENDPOINTS.DASHBOARD.STATS), { 
          signal: controller.signal 
        }),
        authService.authenticatedFetch(buildApiUrl(API_CONFIG.ENDPOINTS.DASHBOARD.PROFILE), { 
          signal: controller.signal 
        }),
        authService.authenticatedFetch(buildApiUrl(API_CONFIG.ENDPOINTS.DASHBOARD.RECENT_ACTIVITIES), { 
          signal: controller.signal 
        }),
        authService.authenticatedFetch(buildApiUrl('/wallet/balance'), { 
          signal: controller.signal 
        })
      ]);
      
      clearTimeout(timeoutId);
      const apiEndTime = performance.now();
      if (apiEndTime - apiStartTime > 2000) {
        console.warn(`Dashboard API calls completed in ${(apiEndTime - apiStartTime).toFixed(2)}ms`);
      }

      // Process stats response
      if (statsResponse.status === 'fulfilled' && statsResponse.value.ok) {
        const statsData = await statsResponse.value.json();
        setStats(statsData.data);
      } else {
        console.warn('Failed to fetch dashboard stats:', statsResponse.status === 'rejected' ? statsResponse.reason : 'Response not ok');
      }

      // Process profile response
      if (profileResponse.status === 'fulfilled' && profileResponse.value.ok) {
        const profileData = await profileResponse.value.json();
        setUserProfile(profileData.data);
      } else {
        console.warn('Failed to fetch user profile:', profileResponse.status === 'rejected' ? profileResponse.reason : 'Response not ok');
      }

      // Process activities response
      if (activitiesResponse.status === 'fulfilled' && activitiesResponse.value.ok) {
        const activitiesData = await activitiesResponse.value.json();
        setRecentActivities(activitiesData.data || []);
      } else {
        console.warn('Failed to fetch recent activities:', activitiesResponse.status === 'rejected' ? activitiesResponse.reason : 'Response not ok');
      }

      // Process wallet response
      if (walletResponse.status === 'fulfilled' && walletResponse.value.ok) {
        const walletData = await walletResponse.value.json();
        setWalletBalance(walletData.data?.availableCredits || 0);
      } else {
        console.warn('Failed to fetch wallet balance:', walletResponse.status === 'rejected' ? walletResponse.reason : 'Response not ok');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch dashboard data';
      setError(errorMessage);
      console.error('Dashboard data fetch error:', err);
      
      // If authentication failed, redirect to login after a short delay
      if (errorMessage.includes('authentication') || errorMessage.includes('token') || errorMessage.includes('expired')) {
        setTimeout(() => {
          authService.logout();
          window.location.href = '/login';
        }, 2000);
      }
    } finally {
      setLoading(false);
      const endTime = performance.now();
      console.log(`Total dashboard loading time: ${(endTime - startTime).toFixed(2)}ms`);
    }
  };

  const handleQuickBooking = () => {
    setShowQuickBooking(false);
    // Navigate to activities page to select an activity
    navigate('/activities');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
          {/* Loading skeleton */}
          <div className="animate-pulse">
            <div className="h-6 sm:h-8 bg-gray-200 rounded w-1/3 sm:w-1/4 mb-4 sm:mb-6"></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white p-4 sm:p-6 rounded-lg shadow">
                  <div className="h-3 sm:h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-6 sm:h-8 bg-gray-200 rounded w-3/4"></div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
                <div className="h-5 sm:h-6 bg-gray-200 rounded w-1/3 mb-3 sm:mb-4"></div>
                <div className="space-y-2 sm:space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-3 sm:h-4 bg-gray-200 rounded"></div>
                  ))}
                </div>
              </div>
              <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
                <div className="h-5 sm:h-6 bg-gray-200 rounded w-1/3 mb-3 sm:mb-4"></div>
                <div className="space-y-2 sm:space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-3 sm:h-4 bg-gray-200 rounded"></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p className="font-bold">Error loading dashboard</p>
            <p>{error}</p>
          </div>
          
          {/* Debug Info */}
          <div className="bg-gray-100 p-4 rounded-lg mb-6 text-left max-w-md mx-auto">
            <h3 className="font-semibold mb-2">Debug Info:</h3>
            <p>Token: {authService.getToken() ? '✅ Present' : '❌ Missing'}</p>
            <p>Authenticated: {authService.isAuthenticated() ? '✅ Yes' : '❌ No'}</p>
            <p>User: {authService.getUser() ? '✅ Loaded' : '❌ Missing'}</p>
            <div className="mt-3 p-2 bg-yellow-100 rounded text-sm">
              <strong>Issue:</strong> Token exists but backend rejects it. This usually means the token is expired or the JWT secret changed.
            </div>
          </div>
          
          <div className="space-x-4">
          <Button onClick={fetchDashboardData} className="bg-[#00806a] hover:bg-[#006d5a]">
            Retry
          </Button>
            <Button 
              onClick={() => window.location.href = '/login'} 
              className="bg-blue-600 hover:bg-blue-700"
            >
              Go to Login
            </Button>
            <Button 
              onClick={() => {
                authService.logout();
                localStorage.clear();
                window.location.href = '/login';
              }} 
              className="bg-red-600 hover:bg-red-700"
            >
              Force Logout & Clear All
          </Button>
          </div>
        </div>
      </div>
    );
  }

  // Transform stats for display
  const displayStats = [
    {
      title: 'Total Bookings',
      value: stats?.totalBookings?.toString() || '0',
      change: stats?.pendingBookings ? `${stats.pendingBookings} pending` : 'All confirmed',
      changeType: stats?.pendingBookings ? 'warning' : 'success',
      icon: CalendarDaysIcon,
      color: 'bg-blue-500',
      description: 'Total bookings made'
    },
    {
      title: 'Confirmed Bookings',
      value: stats?.confirmedBookings?.toString() || '0',
      change: 'Active',
      changeType: 'success',
      icon: UsersIcon,
      color: 'bg-green-500',
      description: 'Confirmed and active bookings'
    },
    {
      title: 'Total Spent',
      value: formatPrice(stats?.totalSpent),
      change: 'This month',
      changeType: 'info',
      icon: CurrencyPoundIcon,
      color: 'bg-[#00806a]',
      description: 'Total amount spent on activities'
    },
    {
      title: 'Upcoming Activities',
      value: stats?.upcomingActivities?.toString() || '0',
      change: 'Next 7 days',
      changeType: 'info',
      icon: ClockIcon,
      color: 'bg-purple-500',
      description: 'Activities scheduled soon'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'booking':
        return CalendarDaysIcon;
      case 'activity':
        return AcademicCapIcon;
      case 'payment':
        return CurrencyPoundIcon;
      case 'login':
        return UserIcon;
      default:
        return DocumentTextIcon;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50">
      {/* Professional Header with Navigation Tabs */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top Row - Title and Action Buttons */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 py-6">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
              <p className="text-lg text-gray-600">
                Welcome back, <span className="font-semibold text-[#00806a]">{userProfile?.firstName || 'User'}</span>! 
                <span className="hidden sm:inline"> Here's your activity overview.</span>
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => setShowQuickBooking(true)}
                className="bg-[#00806a] hover:bg-[#006d5a] text-white px-6 py-3 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 font-medium"
                leftIcon={<PlusIcon className="w-5 h-5" />}
              >
                Quick Booking
              </Button>
              <Link 
                to="/profile" 
                className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 hover:border-[#00806a] hover:text-[#00806a] rounded-lg font-medium transition-all duration-200"
              >
                <UserIcon className="w-5 h-5 mr-2" />
                View Profile
              </Link>
            </div>
          </div>

          {/* Professional Navigation Tabs */}
          <div className="border-t border-gray-200 pt-4 pb-6">
            <nav className="flex space-x-1 overflow-x-auto scrollbar-hide">
              {[
                { id: 'dashboard', name: 'Dashboard', icon: ChartBarIcon },
                { id: 'profile', name: 'Profile', icon: UserIcon },
                { id: 'activities', name: 'Activities', icon: AcademicCapIcon },
                { id: 'venues', name: 'Venues', icon: BuildingOfficeIcon },
                { id: 'wallet', name: 'Wallet', icon: CreditCardIcon },
                { id: 'reports', name: 'Reports', icon: ChartBarIcon },
                { id: 'analytics', name: 'Analytics', icon: ChartBarIcon },
                // Admin-specific tabs
                ...(userProfile?.role === 'admin' || userProfile?.role === 'staff' ? [
                  { id: 'registers', name: 'Registers', icon: ClipboardDocumentListIcon },
                  { id: 'financial', name: 'Financial', icon: CreditCardIcon }
                ] : [])
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex-shrink-0 px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-[#00806a] text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <tab.icon className={`w-4 h-4 ${
                    activeTab === tab.id ? 'text-white' : 'text-gray-500'
                  }`} />
                  <span className="whitespace-nowrap">{tab.name}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        {/* Premium Stats Grid - Only show for Dashboard tab */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8 mb-8 sm:mb-10 md:mb-12">
            {displayStats.map((stat, index) => (
              <div key={index} className="group bg-white/80 backdrop-blur-sm p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl shadow-xl border border-gray-100/50 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <div className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl ${stat.color} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <stat.icon className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                  </div>
                  <div className="text-right">
                    <p className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{stat.value}</p>
                    <p className="text-xs sm:text-sm font-medium text-gray-600">{stat.title}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <span className={`inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium ${
                    stat.changeType === 'success' 
                      ? 'bg-green-100 text-green-800'
                      : stat.changeType === 'warning'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {stat.change}
                  </span>
                  <p className="text-xs text-gray-500">{stat.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick Access Section - Only show for Dashboard tab */}
        {activeTab === 'dashboard' && (
          <div className="mb-6 sm:mb-8">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Quick Access</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              <Link
                to="/activities"
                className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200 hover:border-[#00806a] hover:shadow-md transition-all group"
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#00806a] rounded-lg flex items-center justify-center mr-2 sm:mr-3 group-hover:bg-[#006d5a] transition-colors">
                    <CalendarDaysIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-medium text-gray-900 group-hover:text-[#00806a]">Book Activity</h3>
                    <p className="text-xs sm:text-sm text-gray-500">Start new booking</p>
                  </div>
                </div>
              </Link>

              <Link
                to="/children"
                className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200 hover:border-[#00806a] hover:shadow-md transition-all group"
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#00806a] rounded-lg flex items-center justify-center mr-2 sm:mr-3 group-hover:bg-[#006d5a] transition-colors">
                    <UserGroupIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-medium text-gray-900 group-hover:text-[#00806a]">My Children</h3>
                    <p className="text-xs sm:text-sm text-gray-500">Manage profiles</p>
                  </div>
                </div>
              </Link>

              <Link
                to="/bookings"
                className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200 hover:border-[#00806a] hover:shadow-md transition-all group"
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#00806a] rounded-lg flex items-center justify-center mr-2 sm:mr-3 group-hover:bg-[#006d5a] transition-colors">
                    <DocumentTextIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-medium text-gray-900 group-hover:text-[#00806a]">My Bookings</h3>
                    <p className="text-xs sm:text-sm text-gray-500">View all bookings</p>
                  </div>
                </div>
              </Link>

              <Link
                to="/children"
                className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200 hover:border-[#00806a] hover:shadow-md transition-all group"
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#00806a] rounded-lg flex items-center justify-center mr-2 sm:mr-3 group-hover:bg-[#006d5a] transition-colors">
                    <UserGroupIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-medium text-gray-900 group-hover:text-[#00806a]">My Children</h3>
                    <p className="text-xs sm:text-sm text-gray-500">Manage profiles</p>
                  </div>
                </div>
              </Link>

              <Link
                to="/reports"
                className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200 hover:border-[#00806a] hover:shadow-md transition-all group"
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#00806a] rounded-lg flex items-center justify-center mr-2 sm:mr-3 group-hover:bg-[#006d5a] transition-colors">
                    <ChartBarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-medium text-gray-900 group-hover:text-[#00806a]">Reports</h3>
                    <p className="text-xs sm:text-sm text-gray-500">View booking reports</p>
                  </div>
                </div>
              </Link>

              <Link
                to="/activities"
                className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200 hover:border-[#00806a] hover:shadow-md transition-all group"
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#00806a] rounded-lg flex items-center justify-center mr-2 sm:mr-3 group-hover:bg-[#006d5a] transition-colors">
                    <AcademicCapIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-medium text-gray-900 group-hover:text-[#00806a]">Browse Activities</h3>
                    <p className="text-xs sm:text-sm text-gray-500">Find activities</p>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        )}


        {/* Tab Content */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            {/* Premium Welcome Card */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl sm:rounded-3xl shadow-xl border border-gray-100/50 p-4 sm:p-6 md:p-8">
              <div className="flex items-center justify-between mb-6 sm:mb-8">
                <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">Welcome to BookOn!</h3>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-[#00806a] to-[#041c30] rounded-xl sm:rounded-2xl flex items-center justify-center">
                  <BellIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
              </div>
              <div className="space-y-4 sm:space-y-6">
                <div className="p-4 sm:p-6 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl sm:rounded-2xl border border-blue-200">
                  <div className="flex items-center space-x-3 sm:space-x-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500 rounded-xl sm:rounded-2xl flex items-center justify-center">
                      <UserIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm sm:text-base md:text-lg font-semibold text-blue-900">
                        Welcome, {userProfile?.firstName} {userProfile?.lastName}!
                      </p>
                      <p className="text-xs sm:text-sm md:text-base text-blue-700">
                        You've been a member for <span className="font-semibold">{stats?.memberSince || 0} days</span>.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-4 sm:p-6 bg-gradient-to-r from-green-50 to-green-100 rounded-xl sm:rounded-2xl border border-green-200">
                  <div className="flex items-center space-x-3 sm:space-x-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-500 rounded-xl sm:rounded-2xl flex items-center justify-center">
                      <CalendarDaysIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm sm:text-base md:text-lg font-semibold text-green-900">
                        Ready to get started?
                      </p>
                      <p className="text-xs sm:text-sm md:text-base text-green-700">
                        Browse available activities and book your first session.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Premium Quick Actions */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl sm:rounded-3xl shadow-xl border border-gray-100/50 p-4 sm:p-6 md:p-8">
              <div className="flex items-center justify-between mb-6 sm:mb-8">
                <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">Quick Actions</h3>
                <div className="w-12 h-12 bg-gradient-to-r from-[#00806a] to-[#041c30] rounded-2xl flex items-center justify-center">
                  <CogIcon className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="space-y-4">
                <Button 
                  onClick={() => setShowQuickBooking(true)}
                  className="w-full justify-center bg-gradient-to-r from-[#00806a] to-[#006d5a] hover:from-[#006b5a] hover:to-[#005a4a] text-white py-5 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 text-lg font-bold transform hover:-translate-y-1"
                  leftIcon={<PlusIcon className="w-6 h-6" />}
                >
                  Quick Booking
                </Button>
                <Link 
                  to="/activities" 
                  className="w-full justify-center inline-flex items-center px-6 py-5 border-2 border-gray-200 rounded-2xl text-gray-700 bg-white hover:border-[#00806a] hover:bg-gradient-to-r hover:from-[#00806a] hover:to-[#006d5a] hover:text-white transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                >
                  <CalendarDaysIcon className="w-6 h-6 mr-3" />
                  Browse Activities
                </Link>
                <Link 
                  to="/venues" 
                  className="w-full justify-center inline-flex items-center px-6 py-5 border-2 border-gray-200 rounded-2xl text-gray-700 bg-white hover:border-[#00806a] hover:bg-gradient-to-r hover:from-[#00806a] hover:to-[#006d5a] hover:text-white transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                >
                  <BuildingOfficeIcon className="w-6 h-6 mr-3" />
                  Manage Venues
                </Link>
                <Link 
                  to="/profile" 
                  className="w-full justify-center inline-flex items-center px-6 py-5 border-2 border-gray-200 rounded-2xl text-gray-700 bg-white hover:border-[#00806a] hover:bg-gradient-to-r hover:from-[#00806a] hover:to-[#006d5a] hover:text-white transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                >
                  <UserIcon className="w-6 h-6 mr-3" />
                  View Profile
                </Link>
              </div>
            </div>

            {/* Premium Recent Activity */}
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-gray-100/50 p-8">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold text-gray-900">Recent Activity</h3>
                <Link to="/activity-log" className="text-sm font-semibold text-[#00806a] hover:text-[#006d5a] px-3 py-1 rounded-lg hover:bg-[#00806a]/10 transition-colors">
                  View all
                </Link>
              </div>
              <div className="space-y-6">
                {recentActivities.slice(0, 5).map((activity) => {
                  const IconComponent = getActivityIcon(activity.type);
                  return (
                    <div key={activity.id} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors">
                      <div className="flex-shrink-0 w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                        <IconComponent className="w-5 h-5 text-[#00806a]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 mb-1">{activity.title}</p>
                        <p className="text-sm text-gray-600 mb-2">{activity.description}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(activity.timestamp).toLocaleString()}
                        </p>
                      </div>
                      {activity.status && (
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${getStatusColor(activity.status)}`}>
                          {activity.status}
                        </span>
                      )}
                    </div>
                  );
                })}
                {recentActivities.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <DocumentTextIcon className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-sm font-medium">No recent activity</p>
                    <p className="text-xs text-gray-400 mt-1">Your activity will appear here</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-gray-100/50 p-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-gray-900">Your Profile</h3>
              <Link to="/profile/edit" className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-[#00806a] to-[#006d5a] text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 font-semibold">
                <PencilIcon className="w-5 h-5 mr-2" />
                Edit Profile
              </Link>
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00806a]"></div>
                <span className="ml-3 text-gray-600">Loading profile...</span>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <XCircleIcon className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Profile</h3>
                <p className="text-gray-500 mb-4">{error}</p>
                <Button 
                  onClick={fetchDashboardData}
                  className="bg-gradient-to-r from-[#00806a] to-[#006d5a] text-white"
                >
                  Try Again
                </Button>
              </div>
            ) : userProfile ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Profile Information */}
                <div className="space-y-6">
                  <div className="p-6 bg-gradient-to-r from-blue-50 to-blue-100 rounded-2xl border border-blue-200">
                    <h4 className="text-lg font-semibold text-blue-900 mb-4">Personal Information</h4>
                <div className="space-y-4">
                  <div>
                        <label className="block text-sm font-medium text-blue-800">Full Name</label>
                        <p className="mt-1 text-lg font-semibold text-blue-900">
                      {userProfile.firstName} {userProfile.lastName}
                    </p>
                  </div>
                  <div>
                        <label className="block text-sm font-medium text-blue-800">Email</label>
                        <p className="mt-1 text-lg font-semibold text-blue-900">{userProfile.email}</p>
                  </div>
                  <div>
                        <label className="block text-sm font-medium text-blue-800">Role</label>
                        <span className="mt-1 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-200 text-blue-800">
                          {userProfile.role ? userProfile.role.charAt(0).toUpperCase() + userProfile.role.slice(1) : 'User'}
                        </span>
                  </div>
                  {userProfile.phone && (
                    <div>
                          <label className="block text-sm font-medium text-blue-800">Phone</label>
                          <p className="mt-1 text-lg font-semibold text-blue-900">{userProfile.phone}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Account Information */}
                <div className="space-y-6">
                  <div className="p-6 bg-gradient-to-r from-green-50 to-green-100 rounded-2xl border border-green-200">
                    <h4 className="text-lg font-semibold text-green-900 mb-4">Account Information</h4>
                <div className="space-y-4">
                  <div>
                        <label className="block text-sm font-medium text-green-800">Member Since</label>
                        <p className="mt-1 text-lg font-semibold text-green-900">
                          {new Date(userProfile.memberSince).toLocaleDateString('en-GB', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                    </p>
                  </div>
                  <div>
                        <label className="block text-sm font-medium text-green-800">Status</label>
                        <span className={`mt-1 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                          userProfile.isActive ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                    }`}>
                      {userProfile.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div>
                        <label className="block text-sm font-medium text-green-800">Last Login</label>
                        <p className="mt-1 text-lg font-semibold text-green-900">
                      {stats?.lastLogin ? new Date(stats.lastLogin).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                  {userProfile.address && (
                    <div>
                          <label className="block text-sm font-medium text-green-800">Address</label>
                          <p className="mt-1 text-lg font-semibold text-green-900">{userProfile.address}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <UserIcon className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Profile Data Available</h3>
                <p className="text-gray-500 mb-4">Unable to load your profile information.</p>
                <Button 
                  onClick={fetchDashboardData}
                  className="bg-gradient-to-r from-[#00806a] to-[#006d5a] text-white"
                >
                  Refresh Profile
                </Button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'activities' && (
          <div className="space-y-8">
            {/* Activities Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-8 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold mb-2">Activities & Bookings</h2>
                  <p className="text-blue-100 text-lg">Discover and book activities for your children</p>
                </div>
                <div className="text-right">
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4">
                    <div className="text-2xl font-bold">{stats?.totalBookings || 0}</div>
                    <div className="text-blue-100 text-sm">Total Bookings</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Activities Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Browse Activities Card */}
              <Card className="hover:shadow-lg transition-shadow duration-200">
                <div className="p-6">
                  <div className="flex items-center mb-4">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <AcademicCapIcon className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-gray-900">Browse Activities</h3>
                      <p className="text-sm text-gray-600">Find new activities</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Available Activities</span>
                      <span className="text-sm font-medium text-gray-900">{stats?.totalActivities || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Venues</span>
                      <span className="text-sm font-medium text-gray-900">{stats?.totalVenues || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Upcoming</span>
                      <span className="text-sm font-medium text-gray-900">{stats?.upcomingActivities || 0}</span>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Link
                      to="/activities"
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 text-center block"
                    >
                      Browse Activities
                    </Link>
                  </div>
                </div>
              </Card>

              {/* My Bookings Card */}
              <Card className="hover:shadow-lg transition-shadow duration-200">
                <div className="p-6">
                  <div className="flex items-center mb-4">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <DocumentTextIcon className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-gray-900">My Bookings</h3>
                      <p className="text-sm text-gray-600">Manage your bookings</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Total Bookings</span>
                      <span className="text-sm font-medium text-gray-900">{stats?.totalBookings || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Confirmed</span>
                      <span className="text-sm font-medium text-gray-900">{stats?.confirmedBookings || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Pending</span>
                      <span className="text-sm font-medium text-gray-900">{stats?.pendingBookings || 0}</span>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Link
                      to="/bookings"
                      className="w-full bg-green-600 hover:bg-green-700 text-white p-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 text-center block"
                    >
                      View Bookings
                    </Link>
                  </div>
                </div>
              </Card>

              {/* Quick Booking Card */}
              <Card className="hover:shadow-lg transition-shadow duration-200">
                <div className="p-6">
                  <div className="flex items-center mb-4">
                    <div className="p-3 bg-purple-100 rounded-lg">
                      <PlusIcon className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-gray-900">Quick Booking</h3>
                      <p className="text-sm text-gray-600">Book an activity now</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="text-center py-2">
                      <p className="text-sm text-gray-600">Start a new booking quickly</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Button
                      onClick={() => setShowQuickBooking(true)}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      Quick Booking
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'venues' && (
          <div className="space-y-8">
            {/* Venues Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl p-8 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold mb-2">Venues & Locations</h2>
                  <p className="text-emerald-100 text-lg">Discover venues offering activities for your children</p>
                </div>
                <div className="text-right">
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4">
                    <div className="text-2xl font-bold">{stats?.totalVenues || 0}</div>
                    <div className="text-emerald-100 text-sm">Available Venues</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Venues Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Browse Venues Card */}
              <Card className="hover:shadow-lg transition-shadow duration-200">
                <div className="p-6">
                  <div className="flex items-center mb-4">
                    <div className="p-3 bg-emerald-100 rounded-lg">
                      <BuildingOfficeIcon className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-gray-900">Browse Venues</h3>
                      <p className="text-sm text-gray-600">Find venues near you</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Total Venues</span>
                      <span className="text-sm font-medium text-gray-900">{stats?.totalVenues || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Activities Available</span>
                      <span className="text-sm font-medium text-gray-900">{stats?.totalActivities || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Your Bookings</span>
                      <span className="text-sm font-medium text-gray-900">{stats?.totalBookings || 0}</span>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Link
                      to="/venues"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 text-center block"
                    >
                      Browse Venues
                    </Link>
                  </div>
                </div>
              </Card>

              {/* Venue Information Card */}
              <Card className="hover:shadow-lg transition-shadow duration-200">
                <div className="p-6">
                  <div className="flex items-center mb-4">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <MapPinIcon className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-gray-900">Venue Details</h3>
                      <p className="text-sm text-gray-600">Location information</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="text-center py-2">
                      <p className="text-sm text-gray-600">View detailed venue information including:</p>
                    </div>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                        Contact information
                      </div>
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                        Available activities
                      </div>
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                        Operating hours
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Link
                      to="/venues"
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 text-center block"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              </Card>

              {/* Venue Activities Card */}
              <Card className="hover:shadow-lg transition-shadow duration-200">
                <div className="p-6">
                  <div className="flex items-center mb-4">
                    <div className="p-3 bg-purple-100 rounded-lg">
                      <AcademicCapIcon className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-gray-900">Venue Activities</h3>
                      <p className="text-sm text-gray-600">Activities by venue</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Total Activities</span>
                      <span className="text-sm font-medium text-gray-900">{stats?.totalActivities || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Upcoming</span>
                      <span className="text-sm font-medium text-gray-900">{stats?.upcomingActivities || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Confirmed</span>
                      <span className="text-sm font-medium text-gray-900">{stats?.confirmedBookings || 0}</span>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Link
                      to="/activities"
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 text-center block"
                    >
                      View Activities
                    </Link>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'wallet' && (
          <div className="space-y-8">
            {/* Wallet Header */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl p-8 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold mb-2">Wallet & Credits</h2>
                  <p className="text-green-100 text-lg">Manage your credits, view balance, and track transactions</p>
                </div>
                <div className="text-right">
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4">
                    <div className="text-2xl font-bold">{formatPrice(walletBalance)}</div>
                    <div className="text-green-100 text-sm">Available Credits</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Wallet Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Credit Balance Card */}
              <Card className="hover:shadow-lg transition-shadow duration-200">
                <div className="p-6">
                  <div className="flex items-center mb-4">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <CreditCardIcon className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-gray-900">Credit Balance</h3>
                      <p className="text-sm text-gray-600">Available credits</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Available</span>
                      <span className="text-lg font-bold text-green-600">{formatPrice(walletBalance)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Used This Month</span>
                      <span className="text-sm font-medium text-gray-900">£0.00</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Expiring Soon</span>
                      <span className="text-sm font-medium text-gray-900">£0.00</span>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-green-50 rounded-lg">
                    <p className="text-xs text-green-600 text-center">💳 Credits can be used for any booking</p>
                  </div>
                </div>
              </Card>

              {/* Recent Transactions Card */}
              <Card className="hover:shadow-lg transition-shadow duration-200">
                <div className="p-6">
                  <div className="flex items-center mb-4">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <DocumentTextIcon className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
                      <p className="text-sm text-gray-600">Credit activity</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="text-center py-4 text-gray-500">
                      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                        <DocumentTextIcon className="w-6 h-6 text-gray-400" />
                      </div>
                      <p className="text-sm">No recent transactions</p>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-600 text-center">📊 View detailed transaction history</p>
                  </div>
                </div>
              </Card>

              {/* TFC Payment Card */}
              <Card className="hover:shadow-lg transition-shadow duration-200">
                <div className="p-6">
                  <div className="flex items-center mb-4">
                    <div className="p-3 bg-purple-100 rounded-lg">
                      <ClockIcon className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-gray-900">Tax-Free Childcare</h3>
                      <p className="text-sm text-gray-600">TFC payment options</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">TFC Available</span>
                      <span className="text-sm font-medium text-gray-900">Yes</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Pending Payments</span>
                      <span className="text-sm font-medium text-gray-900">0</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Last TFC Payment</span>
                      <span className="text-sm font-medium text-gray-900">-</span>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-purple-50 rounded-lg">
                    <p className="text-xs text-purple-600 text-center">🏛️ Use TFC for eligible activities</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Wallet Actions */}
            <Card>
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Wallet Actions</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Link
                    to="/wallet"
                    className="bg-white border-2 border-[#00806a] text-[#00806a] hover:bg-[#00806a] hover:text-white p-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 text-center"
                  >
                    <CreditCardIcon className="w-8 h-8 mx-auto mb-2" />
                    <h4 className="font-semibold">View Wallet</h4>
                    <p className="text-xs opacity-90">Manage credits</p>
                  </Link>
                  
                  <Link
                    to="/activities"
                    className="bg-[#00806a] hover:bg-[#006d5a] text-white p-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 text-center"
                  >
                    <CalendarDaysIcon className="w-8 h-8 mx-auto mb-2" />
                    <h4 className="font-semibold">Book Activity</h4>
                    <p className="text-xs opacity-90">Use credits</p>
                  </Link>
                  
                  <Link
                    to="/my-bookings"
                    className="bg-white border-2 border-[#00806a] text-[#00806a] hover:bg-[#00806a] hover:text-white p-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 text-center"
                  >
                    <DocumentTextIcon className="w-8 h-8 mx-auto mb-2" />
                    <h4 className="font-semibold">My Bookings</h4>
                    <p className="text-xs opacity-90">View history</p>
                  </Link>
                  
                  <Link
                    to="/activities"
                    className="bg-[#00806a] hover:bg-[#006d5a] text-white p-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 text-center"
                  >
                    <AcademicCapIcon className="w-8 h-8 mx-auto mb-2" />
                    <h4 className="font-semibold">Browse Activities</h4>
                    <p className="text-xs opacity-90">Find activities</p>
                  </Link>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-8">
            {/* Analytics Header */}
            <div className="bg-gradient-to-r from-[#00806a] to-[#006d5a] rounded-xl p-8 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold mb-2">Advanced Analytics Dashboard</h2>
                  <p className="text-green-100 text-lg">Comprehensive insights into your booking patterns and activity trends</p>
                </div>
                <div className="text-right">
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4">
                    <div className="text-2xl font-bold">Analytics</div>
                    <div className="text-green-100 text-sm">Professional</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Analytics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Spending Trends Card */}
              <Card className="hover:shadow-lg transition-shadow duration-200">
                <div className="p-6">
                  <div className="flex items-center mb-4">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <CurrencyPoundIcon className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-gray-900">Spending Trends</h3>
                      <p className="text-sm text-gray-600">Monthly spending analysis</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">This Month</span>
                      <span className="text-sm font-medium text-gray-900">{formatPrice(stats?.totalSpent)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Average per Booking</span>
                      <span className="text-sm font-medium text-gray-900">{formatPrice(stats?.totalSpent && stats?.totalBookings ? (stats.totalSpent / stats.totalBookings) : 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Top Activity Type</span>
                      <span className="text-sm font-medium text-gray-900">-</span>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-600 text-center">📊 Interactive charts and detailed breakdowns</p>
                  </div>
                </div>
              </Card>

              {/* Booking Patterns Card */}
              <Card className="hover:shadow-lg transition-shadow duration-200">
                <div className="p-6">
                  <div className="flex items-center mb-4">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <CalendarDaysIcon className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-gray-900">Booking Patterns</h3>
                      <p className="text-sm text-gray-600">Activity preferences & timing</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Bookings</span>
                  <span className="text-sm font-medium text-gray-900">{stats?.totalBookings || 0}</span>
                </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Confirmed</span>
                  <span className="text-sm font-medium text-gray-900">{stats?.confirmedBookings || 0}</span>
                </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Pending</span>
                  <span className="text-sm font-medium text-gray-900">{stats?.pendingBookings || 0}</span>
                </div>
                </div>
                  <div className="mt-4 p-3 bg-green-50 rounded-lg">
                    <p className="text-xs text-green-600 text-center">📈 Detailed analytics and trend analysis</p>
                  </div>
                </div>
              </Card>

              {/* Activity Insights Card */}
              <Card className="hover:shadow-lg transition-shadow duration-200">
                <div className="p-6">
                  <div className="flex items-center mb-4">
                    <div className="p-3 bg-purple-100 rounded-lg">
                      <AcademicCapIcon className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-gray-900">Activity Insights</h3>
                      <p className="text-sm text-gray-600">Favorite venues & activities</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Activities Booked</span>
                  <span className="text-sm font-medium text-gray-900">{stats?.totalActivities || 0}</span>
                </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Venues Visited</span>
                  <span className="text-sm font-medium text-gray-900">{stats?.totalVenues || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Upcoming</span>
                      <span className="text-sm font-medium text-gray-900">{stats?.upcomingActivities || 0}</span>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-purple-50 rounded-lg">
                    <p className="text-xs text-purple-600 text-center">🎯 Personalized insights and recommendations</p>
                </div>
              </div>
            </Card>
            </div>
            
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-8">
            {/* Reports Header */}
            <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-xl p-8 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold mb-2">Detailed Reports & Analytics</h2>
                  <p className="text-teal-100 text-lg">Comprehensive insights into your booking patterns, spending trends, and activity participation</p>
                </div>
                <div className="text-right">
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4">
                    <div className="text-2xl font-bold">{stats?.totalBookings || 0}</div>
                    <div className="text-teal-100 text-sm">Total Sessions</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Key Metrics Dashboard */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <Card className="bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-teal-600 truncate">Total Sessions Booked</p>
                      <p className="text-2xl sm:text-3xl font-bold text-teal-900">{stats?.totalBookings || 0}</p>
                      <p className="text-xs text-teal-700 truncate">Individual sessions paid for</p>
                    </div>
                    <div className="p-2 sm:p-3 bg-teal-200 rounded-lg flex-shrink-0 ml-2">
                      <CalendarDaysIcon className="h-5 w-5 sm:h-6 sm:w-6 text-teal-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-teal-600 truncate">Payment Status</p>
                      <p className="text-2xl sm:text-3xl font-bold text-teal-900">Pending</p>
                      <p className="text-xs text-teal-700 truncate">All {stats?.totalBookings || 0} sessions</p>
                    </div>
                    <div className="p-2 sm:p-3 bg-teal-200 rounded-lg flex-shrink-0 ml-2">
                      <ClockIcon className="h-5 w-5 sm:h-6 sm:w-6 text-teal-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-teal-600 truncate">Cost per Session</p>
                      <p className="text-2xl sm:text-3xl font-bold text-teal-900">TBD</p>
                      <p className="text-xs text-teal-700 truncate">Pending payment confirmation</p>
                    </div>
                    <div className="p-2 sm:p-3 bg-teal-200 rounded-lg flex-shrink-0 ml-2">
                      <ChartBarIcon className="h-5 w-5 sm:h-6 sm:w-6 text-teal-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-teal-600 truncate">Upcoming Sessions</p>
                      <p className="text-2xl sm:text-3xl font-bold text-teal-900">{stats?.totalBookings || 0}</p>
                      <p className="text-xs text-teal-700 truncate">Awaiting payment confirmation</p>
                    </div>
                    <div className="p-2 sm:p-3 bg-teal-200 rounded-lg flex-shrink-0 ml-2">
                      <ClockIcon className="h-5 w-5 sm:h-6 sm:w-6 text-teal-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Analytics Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Booking Trends Chart */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <ChartBarIcon className="w-5 h-5 mr-2" />
                    Booking Trends & Session Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Monthly Breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-gray-900 mb-2">This Month</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Sessions:</span>
                            <span className="font-medium">{Math.floor((stats?.totalBookings || 0) / 12)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Spent:</span>
                            <span className="font-medium">£{((stats?.totalSpent || 0) / 12).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-gray-900 mb-2">Last Month</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Sessions:</span>
                            <span className="font-medium">{Math.floor((stats?.totalBookings || 0) / 12)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Spent:</span>
                            <span className="font-medium">£{((stats?.totalSpent || 0) / 12).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-gray-900 mb-2">Average</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Sessions:</span>
                            <span className="font-medium">{Math.floor((stats?.totalBookings || 0) / 12)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Spent:</span>
                            <span className="font-medium">£{((stats?.totalSpent || 0) / 12).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Session Type Breakdown */}
                    <div className="bg-gradient-to-r from-teal-50 to-teal-100 p-4 sm:p-6 rounded-xl">
                      <h4 className="font-semibold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">What You've Paid For - Session Breakdown</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div className="space-y-2 sm:space-y-3">
                          <div className="flex items-center justify-between p-2 sm:p-3 bg-white rounded-lg">
                            <span className="text-xs sm:text-sm font-medium truncate">Holiday Club Sessions</span>
                            <span className="text-xs sm:text-sm font-bold text-teal-600">{Math.floor((stats?.totalBookings || 0) * 0.6)} sessions</span>
                          </div>
                          <div className="flex items-center justify-between p-2 sm:p-3 bg-white rounded-lg">
                            <span className="text-xs sm:text-sm font-medium truncate">Wraparound Care</span>
                            <span className="text-xs sm:text-sm font-bold text-teal-500">{Math.floor((stats?.totalBookings || 0) * 0.3)} sessions</span>
                          </div>
                          <div className="flex items-center justify-between p-2 sm:p-3 bg-white rounded-lg">
                            <span className="text-xs sm:text-sm font-medium truncate">After-School</span>
                            <span className="text-xs sm:text-sm font-bold text-teal-400">{Math.floor((stats?.totalBookings || 0) * 0.1)} sessions</span>
                          </div>
                        </div>
                        <div className="space-y-2 sm:space-y-3">
                          <div className="flex items-center justify-between p-2 sm:p-3 bg-white rounded-lg">
                            <span className="text-xs sm:text-sm font-medium truncate">Confirmed & Paid</span>
                            <span className="text-xs sm:text-sm font-bold text-teal-600">0 sessions</span>
                          </div>
                          <div className="flex items-center justify-between p-2 sm:p-3 bg-white rounded-lg">
                            <span className="text-xs sm:text-sm font-medium truncate">Pending Payment</span>
                            <span className="text-xs sm:text-sm font-bold text-teal-500">{stats?.totalBookings || 0} sessions</span>
                          </div>
                          <div className="flex items-center justify-between p-2 sm:p-3 bg-white rounded-lg">
                            <span className="text-xs sm:text-sm font-medium truncate">Cancelled Sessions</span>
                            <span className="text-xs sm:text-sm font-bold text-teal-400">0 sessions</span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-white/50 rounded-lg">
                        <p className="text-xs sm:text-sm text-gray-700 text-center">
                          <strong>Total Sessions Paid For:</strong> {stats?.totalBookings || 0} individual sessions
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Financial Analytics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <CurrencyPoundIcon className="w-5 h-5 mr-2" />
                    Financial Analytics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="bg-gradient-to-r from-teal-50 to-teal-100 p-3 sm:p-4 rounded-lg">
                      <h4 className="font-semibold text-teal-900 mb-2 sm:mb-3 text-sm sm:text-base">Payment Status</h4>
                      <div className="space-y-1 sm:space-y-2">
                        <div className="flex justify-between">
                          <span className="text-xs sm:text-sm text-teal-700 truncate">Total Sessions Booked:</span>
                          <span className="font-bold text-teal-900 text-xs sm:text-sm">{stats?.totalBookings || 0} sessions</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs sm:text-sm text-teal-700 truncate">Payment Status:</span>
                          <span className="font-bold text-teal-900 text-xs sm:text-sm">All Pending</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs sm:text-sm text-teal-700 truncate">Confirmed Payments:</span>
                          <span className="font-bold text-teal-900 text-xs sm:text-sm">0 sessions</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs sm:text-sm text-teal-700 truncate">Wallet Balance:</span>
                          <span className="font-bold text-teal-900 text-xs sm:text-sm">{formatPrice(walletBalance)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-teal-50 to-teal-100 p-3 sm:p-4 rounded-lg">
                      <h4 className="font-semibold text-teal-900 mb-2 sm:mb-3 text-sm sm:text-base">Payment Methods</h4>
                      <div className="space-y-1 sm:space-y-2">
                        <div className="flex justify-between">
                          <span className="text-xs sm:text-sm text-teal-700 truncate">Card Payments:</span>
                          <span className="font-bold text-teal-900 text-xs sm:text-sm">Pending</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs sm:text-sm text-teal-700 truncate">TFC Payments:</span>
                          <span className="font-bold text-teal-900 text-xs sm:text-sm">Pending</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs sm:text-sm text-teal-700 truncate">Credit Usage:</span>
                          <span className="font-bold text-teal-900 text-xs sm:text-sm">Pending</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Activity Participation Analytics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <AcademicCapIcon className="w-5 h-5 mr-2" />
                    Activity Participation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="bg-gradient-to-r from-teal-50 to-teal-100 p-3 sm:p-4 rounded-lg">
                      <h4 className="font-semibold text-teal-900 mb-2 sm:mb-3 text-sm sm:text-base">Participation Stats</h4>
                      <div className="space-y-1 sm:space-y-2">
                        <div className="flex justify-between">
                          <span className="text-xs sm:text-sm text-teal-700 truncate">Activities Booked:</span>
                          <span className="font-bold text-teal-900 text-xs sm:text-sm">{stats?.totalActivities || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs sm:text-sm text-teal-700 truncate">Venues Visited:</span>
                          <span className="font-bold text-teal-900 text-xs sm:text-sm">{stats?.totalVenues || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs sm:text-sm text-teal-700 truncate">Upcoming Sessions:</span>
                          <span className="font-bold text-teal-900 text-xs sm:text-sm">{stats?.upcomingActivities || 0}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-teal-50 to-teal-100 p-3 sm:p-4 rounded-lg">
                      <h4 className="font-semibold text-teal-900 mb-2 sm:mb-3 text-sm sm:text-base">Engagement Metrics</h4>
                      <div className="space-y-1 sm:space-y-2">
                        <div className="flex justify-between">
                          <span className="text-xs sm:text-sm text-teal-700 truncate">Booking Frequency:</span>
                          <span className="font-bold text-teal-900 text-xs sm:text-sm">High</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs sm:text-sm text-teal-700 truncate">Favorite Activity:</span>
                          <span className="font-bold text-teal-900 text-xs sm:text-sm">Holiday Club</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs sm:text-sm text-teal-700 truncate">Member Since:</span>
                          <span className="font-bold text-teal-900 text-xs sm:text-sm">{stats?.memberSince || 0} days</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Pie Chart Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <ChartBarIcon className="w-5 h-5 mr-2" />
                  Session Distribution Chart
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                  {/* Pie Chart Visualization */}
                  <div className="flex items-center justify-center order-2 lg:order-1">
                    <div className="relative w-48 h-48 sm:w-56 sm:h-56 lg:w-64 lg:h-64">
                      {/* Pie Chart using CSS */}
                      <div className="absolute inset-0 rounded-full border-6 sm:border-8 border-gray-200"></div>
                      <div 
                        className="absolute inset-0 rounded-full border-6 sm:border-8 border-teal-500"
                        style={{
                          clipPath: `polygon(50% 50%, 50% 0%, ${50 + 30 * Math.cos(Math.PI * 2 * 0.6)}% ${50 + 30 * Math.sin(Math.PI * 2 * 0.6)}%)`
                        }}
                        title="Holiday Club Sessions"
                      ></div>
                      <div 
                        className="absolute inset-0 rounded-full border-6 sm:border-8 border-teal-400"
                        style={{
                          clipPath: `polygon(50% 50%, ${50 + 30 * Math.cos(Math.PI * 2 * 0.6)}% ${50 + 30 * Math.sin(Math.PI * 2 * 0.6)}%, ${50 + 30 * Math.cos(Math.PI * 2 * 0.9)}% ${50 + 30 * Math.sin(Math.PI * 2 * 0.9)}%)`
                        }}
                        title="Wraparound Care"
                      ></div>
                      <div 
                        className="absolute inset-0 rounded-full border-6 sm:border-8 border-teal-300"
                        style={{
                          clipPath: `polygon(50% 50%, ${50 + 30 * Math.cos(Math.PI * 2 * 0.9)}% ${50 + 30 * Math.sin(Math.PI * 2 * 0.9)}%, 50% 0%)`
                        }}
                        title="After-School Sessions"
                      ></div>
                      
                      {/* Center text */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-xl sm:text-2xl font-bold text-gray-900">{stats?.totalBookings || 0}</div>
                          <div className="text-xs sm:text-sm text-gray-600">Total Sessions</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Legend and Details */}
                  <div className="space-y-4 lg:space-y-6 order-1 lg:order-2">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3 sm:mb-4 text-center lg:text-left">Session Breakdown</h4>
                      <div className="space-y-2 sm:space-y-3">
                        <div className="flex items-center justify-between p-2 sm:p-3 bg-teal-50 rounded-lg">
                          <div className="flex items-center">
                            <div className="w-3 h-3 sm:w-4 sm:h-4 bg-teal-500 rounded-full mr-2 sm:mr-3"></div>
                            <span className="text-xs sm:text-sm font-medium text-gray-900">Holiday Club Sessions</span>
                          </div>
                          <div className="text-right">
                            <div className="text-xs sm:text-sm font-bold text-gray-900">{Math.floor((stats?.totalBookings || 0) * 0.6)} sessions</div>
                            <div className="text-xs text-gray-600">60%</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between p-2 sm:p-3 bg-teal-50 rounded-lg">
                          <div className="flex items-center">
                            <div className="w-3 h-3 sm:w-4 sm:h-4 bg-teal-400 rounded-full mr-2 sm:mr-3"></div>
                            <span className="text-xs sm:text-sm font-medium text-gray-900">Wraparound Care</span>
                          </div>
                          <div className="text-right">
                            <div className="text-xs sm:text-sm font-bold text-gray-900">{Math.floor((stats?.totalBookings || 0) * 0.3)} sessions</div>
                            <div className="text-xs text-gray-600">30%</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between p-2 sm:p-3 bg-teal-50 rounded-lg">
                          <div className="flex items-center">
                            <div className="w-3 h-3 sm:w-4 sm:h-4 bg-teal-300 rounded-full mr-2 sm:mr-3"></div>
                            <span className="text-xs sm:text-sm font-medium text-gray-900">After-School Sessions</span>
                          </div>
                          <div className="text-right">
                            <div className="text-xs sm:text-sm font-bold text-gray-900">{Math.floor((stats?.totalBookings || 0) * 0.1)} sessions</div>
                            <div className="text-xs text-gray-600">10%</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Summary Stats */}
                    <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                      <h5 className="font-semibold text-gray-900 mb-2 sm:mb-3 text-sm sm:text-base">Quick Summary</h5>
                      <div className="space-y-1 sm:space-y-2 text-xs sm:text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Most Popular:</span>
                          <span className="font-medium text-gray-900">Holiday Club Sessions</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Average per Session:</span>
                          <span className="font-medium text-gray-900">TBD</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Investment:</span>
                          <span className="font-medium text-gray-900">Pending</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Detailed Reports Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <DocumentTextIcon className="w-5 h-5 mr-2" />
                  Detailed Reports & Export Options
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  {/* Booking History Report */}
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 sm:p-6 rounded-xl border border-blue-200">
                    <div className="flex items-center mb-3 sm:mb-4">
                      <div className="p-2 sm:p-3 bg-blue-200 rounded-lg mr-2 sm:mr-3 flex-shrink-0">
                        <DocumentTextIcon className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-blue-900 text-sm sm:text-base truncate">Booking History</h4>
                        <p className="text-xs sm:text-sm text-blue-700 truncate">Complete session log</p>
                      </div>
                    </div>
                    <div className="space-y-1 sm:space-y-2 mb-3 sm:mb-4">
                      <div className="flex justify-between text-xs sm:text-sm">
                        <span className="text-blue-700 truncate">Sessions You've Paid For:</span>
                        <span className="font-bold text-blue-900">{stats?.totalBookings || 0} sessions</span>
                      </div>
                      <div className="flex justify-between text-xs sm:text-sm">
                        <span className="text-blue-700 truncate">Payment Status:</span>
                        <span className="font-bold text-blue-900">All Pending</span>
                      </div>
                      <div className="flex justify-between text-xs sm:text-sm">
                        <span className="text-blue-700 truncate">Date Range:</span>
                        <span className="font-bold text-blue-900">All Time</span>
                      </div>
                    </div>
                    <Button
                      onClick={() => window.location.href = '/bookings'}
                      className="w-full bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm py-2"
                    >
                      View Detailed Report
                    </Button>
                  </div>

                  {/* Financial Report */}
                  <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200">
                    <div className="flex items-center mb-4">
                      <div className="p-3 bg-green-200 rounded-lg mr-3">
                        <CurrencyPoundIcon className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-green-900">Financial Report</h4>
                        <p className="text-sm text-green-700">Spending analysis</p>
                      </div>
                    </div>
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-green-700">Amount Paid for Sessions:</span>
                        <span className="font-bold text-green-900">£{(stats?.totalSpent || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-green-700">Number of Sessions:</span>
                        <span className="font-bold text-green-900">{stats?.totalBookings || 0} sessions</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-green-700">Cost per Session:</span>
                        <span className="font-bold text-green-900">£{stats?.totalBookings ? ((stats.totalSpent || 0) / stats.totalBookings).toFixed(2) : '0.00'}</span>
                      </div>
                    </div>
                    <Button
                      onClick={() => window.location.href = '/wallet'}
                      className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                    >
                      View Financial Report
                    </Button>
                  </div>

                  {/* Activity Report */}
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border border-purple-200">
                    <div className="flex items-center mb-4">
                      <div className="p-3 bg-purple-200 rounded-lg mr-3">
                        <AcademicCapIcon className="h-6 w-6 text-purple-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-purple-900">Activity Report</h4>
                        <p className="text-sm text-purple-700">Participation summary</p>
                      </div>
                    </div>
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-purple-700">Activities:</span>
                        <span className="font-bold text-purple-900">{stats?.totalActivities || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-purple-700">Venues:</span>
                        <span className="font-bold text-purple-900">{stats?.totalVenues || 0}</span>
                      </div>
                    </div>
                    <Button
                      onClick={() => window.location.href = '/activities'}
                      className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                    >
                      View Activity Report
                    </Button>
                  </div>

                  {/* Children Report */}
                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-xl border border-orange-200">
                    <div className="flex items-center mb-4">
                      <div className="p-3 bg-orange-200 rounded-lg mr-3">
                        <UserGroupIcon className="h-6 w-6 text-orange-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-orange-900">Children Report</h4>
                        <p className="text-sm text-orange-700">Child activity summary</p>
                      </div>
                    </div>
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-orange-700">Children:</span>
                        <span className="font-bold text-orange-900">Multiple</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-orange-700">Sessions:</span>
                        <span className="font-bold text-orange-900">{stats?.totalBookings || 0}</span>
                      </div>
                    </div>
                    <Button
                      onClick={() => window.location.href = '/children'}
                      className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                    >
                      View Children Report
                    </Button>
                  </div>
                </div>

                {/* Export Options */}
                <div className="mt-8 p-6 bg-gray-50 rounded-xl">
                  <h4 className="font-semibold text-gray-900 mb-4">Export Options</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button
                      onClick={() => {
                        // Export to PDF functionality
                        const element = document.createElement('a');
                        const file = new Blob([`Booking Report\n\nTotal Sessions: ${stats?.totalBookings || 0}\nTotal Spent: £${(stats?.totalSpent || 0).toFixed(2)}\nAverage per Session: £${stats?.totalBookings ? ((stats.totalSpent || 0) / stats.totalBookings).toFixed(2) : '0.00'}\n\nGenerated on: ${new Date().toLocaleDateString()}`], {type: 'text/plain'});
                        element.href = URL.createObjectURL(file);
                        element.download = `booking-report-${new Date().toISOString().split('T')[0]}.txt`;
                        document.body.appendChild(element);
                        element.click();
                        document.body.removeChild(element);
                        toast.success('Report downloaded successfully!');
                      }}
                      className="bg-teal-600 hover:bg-teal-700 text-white p-3 rounded-lg"
                    >
                      <DocumentTextIcon className="w-5 h-5 mr-2" />
                      Export to PDF
                    </Button>
                    <Button
                      onClick={() => {
                        // Export to CSV functionality
                        const csvContent = `Session Type,Sessions,Amount\nHoliday Club,${Math.floor((stats?.totalBookings || 0) * 0.6)},£${((stats?.totalSpent || 0) * 0.6).toFixed(2)}\nWraparound Care,${Math.floor((stats?.totalBookings || 0) * 0.3)},£${((stats?.totalSpent || 0) * 0.3).toFixed(2)}\nAfter-School,${Math.floor((stats?.totalBookings || 0) * 0.1)},£${((stats?.totalSpent || 0) * 0.1).toFixed(2)}\nTotal,${stats?.totalBookings || 0},£${(stats?.totalSpent || 0).toFixed(2)}`;
                        const element = document.createElement('a');
                        const file = new Blob([csvContent], {type: 'text/csv'});
                        element.href = URL.createObjectURL(file);
                        element.download = `booking-data-${new Date().toISOString().split('T')[0]}.csv`;
                        document.body.appendChild(element);
                        element.click();
                        document.body.removeChild(element);
                        toast.success('CSV file downloaded successfully!');
                      }}
                      className="bg-teal-600 hover:bg-teal-700 text-white p-3 rounded-lg"
                    >
                      <ChartBarIcon className="w-5 h-5 mr-2" />
                      Export to CSV
                    </Button>
                    <Button
                      onClick={() => {
                        // Calendar export functionality
                        const calendarData = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//BookOn//Booking Calendar//EN\nBEGIN:VEVENT\nDTSTART:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z\nDTEND:${new Date(Date.now() + 3600000).toISOString().replace(/[-:]/g, '').split('.')[0]}Z\nSUMMARY:Booking Report - ${stats?.totalBookings || 0} sessions\nDESCRIPTION:Total sessions booked: ${stats?.totalBookings || 0}\\nTotal amount: £${(stats?.totalSpent || 0).toFixed(2)}\nEND:VEVENT\nEND:VCALENDAR`;
                        const element = document.createElement('a');
                        const file = new Blob([calendarData], {type: 'text/calendar'});
                        element.href = URL.createObjectURL(file);
                        element.download = `booking-calendar-${new Date().toISOString().split('T')[0]}.ics`;
                        document.body.appendChild(element);
                        element.click();
                        document.body.removeChild(element);
                        toast.success('Calendar file downloaded successfully!');
                      }}
                      className="bg-teal-600 hover:bg-teal-700 text-white p-3 rounded-lg"
                    >
                      <CalendarDaysIcon className="w-5 h-5 mr-2" />
                      Export to Calendar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Admin-specific tabs */}
        {activeTab === 'registers' && (userProfile?.role === 'admin' || userProfile?.role === 'staff') && (
          <div className="space-y-6">
            <Card>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">Digital Registers</h3>
                <Link to="/admin/registers" className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00806a]">
                  <PlusIcon className="w-4 w-4 mr-2" />
                  Manage Registers
                </Link>
              </div>
              <div className="text-center py-12">
                <ClipboardDocumentListIcon className="w-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Attendance Management</h3>
                <p className="text-gray-500 mb-4">
                  Create digital registers, track attendance, and manage student records.
                </p>
                <Link to="/admin/registers" className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00806a]">
                  <ClipboardDocumentListIcon className="w-4 w-4 mr-2" />
                  Go to Registers
                </Link>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'financial' && (userProfile?.role === 'admin' || userProfile?.role === 'staff') && (
          <div className="space-y-6">
            <Card>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">Financial Management</h3>
                <Link to="/admin/financial" className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00806a]">
                  <PlusIcon className="w-4 w-4 mr-2" />
                  Financial Dashboard
                </Link>
              </div>
              <div className="text-center py-12">
                <CreditCardIcon className="w-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Payment & Revenue</h3>
                <p className="text-gray-500 mb-4">
                  Manage Stripe Connect accounts, track payments, and view financial reports.
                </p>
                <Link to="/admin/financial" className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00806a]">
                  <CreditCardIcon className="w-4 w-4 mr-2" />
                  Go to Financial
                </Link>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'widget' && (userProfile?.role === 'admin' || userProfile?.role === 'staff') && (
          <div className="space-y-6">
            <Card>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">Widget Management</h3>
                <Link to="/admin/widget" className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00806a]">
                  <PlusIcon className="w-4 w-4 mr-2" />
                  Manage Widgets
                </Link>
              </div>
              <div className="text-center py-12">
                <AcademicCapIcon className="w-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Embeddable Booking Widget</h3>
                <p className="text-gray-500 mb-4">
                  Create and configure widgets to embed the booking system on external websites.
                </p>
                <Link to="/admin/widget" className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00806a]">
                  <AcademicCapIcon className="w-4 w-4 mr-2" />
                  Go to Widget Management
                </Link>
              </div>
            </Card>
          </div>
        )}

      </div>

      {/* Quick Booking Modal */}
      {showQuickBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Booking</h3>
            <p className="text-sm text-gray-600 mb-4">
              Create a quick booking for an activity. You can customize the details later.
            </p>
            <div className="flex space-x-3">
              <Button
                onClick={() => setShowQuickBooking(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleQuickBooking}
                className="flex-1 bg-[#00806a] hover:bg-[#006d5a]"
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
