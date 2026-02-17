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
  XCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon
} from '@heroicons/react/24/outline';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { authService } from '../../services/authService';
import toast from 'react-hot-toast';
import { buildApiUrl } from '../../config/api';
import { formatPrice } from '../../utils/formatting';
import BusinessLayout from '../../components/layout/BusinessLayout';
import { useAuth } from '../../contexts/AuthContext';

interface BusinessStats {
  activitiesRunningToday: number;
  childrenInActivities: number;
  parentsRegistered: number;
  paymentsCollectedToday: number;
  refundsCreditsIssued: number;
  totalRevenue: number;
  monthlyGrowth: number;
  activeVenues: number;
}

interface UpcomingActivity {
  id: string;
  title: string;
  venue: string;
  time: string;
  date: string;
  participants: number;
  status: 'confirmed' | 'pending' | 'cancelled';
}

interface FinanceData {
  week: string;
  income: number;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'info' | 'warning' | 'success' | 'error';
  read: boolean;
}

const BusinessDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<BusinessStats | null>(null);
  const [upcomingActivities, setUpcomingActivities] = useState<UpcomingActivity[]>([]);
  const [financeData, setFinanceData] = useState<FinanceData[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = authService.getToken();
      
      if (!token) {
        navigate('/login');
        return;
      }

      const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
          return await fetch(url, {
            ...options,
            signal: controller.signal
          });
        } finally {
          clearTimeout(timeoutId);
        }
      };

      // Check onboarding status first
      const onboardingResponse = await fetchWithTimeout(buildApiUrl('/auth/business-profile'), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }, 15000);

      if (onboardingResponse.ok) {
        const onboardingData = await onboardingResponse.json();
        if (!onboardingData.data.user.onboardingCompleted) {
          navigate('/business/onboarding');
          return;
        }
        setOnboardingCompleted(true);
      }

      // Fetch business dashboard data
      let response: Response;
      try {
        response = await fetchWithTimeout(buildApiUrl('/dashboard/business'), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }, 25000);
      } catch (err) {
        // One retry for slow local/dev environments
        if (err instanceof Error && err.name === 'AbortError') {
          response = await fetchWithTimeout(buildApiUrl('/dashboard/business'), {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }, 35000);
        } else {
          throw err;
        }
      }

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const data = await response.json();
      
      if (data.success) {
        setStats(data.data.stats);
        setUpcomingActivities(data.data.upcomingActivities || []);
        setFinanceData(data.data.financeData || []);
        setNotifications(data.data.notifications || []);
        setUnreadNotifications(data.data.unreadNotifications || 0);
      } else {
        throw new Error(data.message || 'Failed to fetch dashboard data');
      }
    } catch (error) {
      console.error('Dashboard fetch error:', error);
      
      // If it's a timeout or network error, show a more helpful message
      if (error instanceof Error && error.name === 'AbortError') {
        setError('Dashboard request timed out. Please try again.');
        toast.error('Dashboard request timed out');
      } else {
        setError(error instanceof Error ? error.message : 'Failed to load dashboard');
        toast.error('Failed to load dashboard data');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleViewRegister = (activityId: string) => {
    // Navigate to registers page - the register should exist for this activity
    navigate(`/business/registers`);
  };

  const handleEditActivity = (activityId: string) => {
    navigate(`/business/activities/${activityId}/edit`);
  };

  const handleViewNotification = (notificationId: string) => {
    // Mark notification as read
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === notificationId ? { ...notif, read: true } : notif
      )
    );
    setUnreadNotifications(prev => Math.max(0, prev - 1));
  };

  if (loading) {
    return (
      <BusinessLayout user={user}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Show skeleton loading */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="bg-white p-6 animate-pulse">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 bg-gray-300 rounded"></div>
                  </div>
                  <div className="ml-4">
                    <div className="h-4 bg-gray-300 rounded w-24 mb-2"></div>
                    <div className="h-6 bg-gray-300 rounded w-16"></div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="bg-white p-6 animate-pulse">
              <div className="h-6 bg-gray-300 rounded w-32 mb-4"></div>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-4 bg-gray-100 rounded-lg">
                    <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            </Card>
            
            <Card className="bg-white p-6 animate-pulse">
              <div className="h-6 bg-gray-300 rounded w-32 mb-4"></div>
              <div className="h-32 bg-gray-200 rounded mb-4"></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="h-16 bg-gray-200 rounded"></div>
                <div className="h-16 bg-gray-200 rounded"></div>
              </div>
            </Card>
          </div>
          
          <div className="text-center mt-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00806a] mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading dashboard data...</p>
          </div>
        </div>
      </BusinessLayout>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={fetchDashboardData} className="bg-[#00806a] hover:bg-[#006d5a]">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <BusinessLayout user={user}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CalendarDaysIcon className="h-8 w-8 text-[#00806a]" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Activities Running Today</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.activitiesRunningToday || 0}
                </p>
                <p className="text-sm text-gray-600">
                  {stats?.childrenInActivities || 0} children
                </p>
              </div>
            </div>
          </Card>

          <Card className="bg-white p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UsersIcon className="h-8 w-8 text-[#00806a]" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Parents Registered</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.parentsRegistered || 0}
                </p>
                <p className="text-sm text-gray-600">this term</p>
              </div>
            </div>
          </Card>

          <Card className="bg-white p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CurrencyPoundIcon className="h-8 w-8 text-[#00806a]" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Payments Collected Today</p>
                <p className="text-2xl font-bold text-gray-900">
                  £{stats?.paymentsCollectedToday || 0}
                </p>
              </div>
            </div>
          </Card>

          <Card className="bg-white p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CreditCardIcon className="h-8 w-8 text-[#00806a]" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Refunds/Credits Issued</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.refundsCreditsIssued || 0}
                </p>
                <p className="text-sm text-gray-600">issued</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upcoming Activities */}
          <Card className="bg-white">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-[#00806a] mb-4">Upcoming Activities</h2>
              <div className="space-y-4">
                {upcomingActivities.length > 0 ? (
                  upcomingActivities.map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <UserGroupIcon className="h-5 w-5 text-gray-500" />
                        <div>
                          <h3 className="font-medium text-gray-900">{activity.title}</h3>
                          <p className="text-sm text-gray-600">{activity.venue}</p>
                          <p className="text-sm text-gray-500">{activity.time}</p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          onClick={() => handleViewRegister(activity.id)}
                          className="bg-[#00806a] hover:bg-[#006d5a] text-white text-sm px-3 py-1"
                        >
                          View Register
                        </Button>
                        <Button
                          onClick={() => handleEditActivity(activity.id)}
                          className="bg-gray-600 hover:bg-gray-700 text-white text-sm px-3 py-1"
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <CalendarDaysIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No upcoming activities</p>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Finance Glimpse */}
          <Card className="bg-white">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-[#00806a] mb-4">Finance Glimpse</h2>
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">Income this week</p>
                <div className="flex items-end space-x-2 h-32">
                  {financeData.map((data, index) => (
                    <div key={index} className="flex-1 flex flex-col items-center">
                      <div 
                        className="bg-[#00806a] rounded-t w-full transition-all duration-300 hover:bg-[#006d5a]"
                        style={{ 
                          height: `${Math.max(20, (data.income / Math.max(...financeData.map(d => d.income))) * 100)}px` 
                        }}
                        title={`${data.week}: £${data.income}`}
                      ></div>
                      <span className="text-xs text-gray-600 mt-2">{data.week}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded">
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-lg font-semibold text-gray-900">£{stats?.totalRevenue || 0}</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded">
                  <p className="text-sm text-gray-600">Monthly Growth</p>
                  <div className="flex items-center justify-center">
                    {stats && stats.monthlyGrowth >= 0 ? (
                      <ArrowTrendingUpIcon className="h-4 w-4 text-green-500 mr-1" />
                    ) : (
                      <ArrowTrendingDownIcon className="h-4 w-4 text-red-500 mr-1" />
                    )}
                    <p className={`text-lg font-semibold ${stats && stats.monthlyGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {stats?.monthlyGrowth || 0}%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Recent Notifications */}
        <Card className="bg-white mt-8">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-[#00806a] mb-4">Recent Notifications</h2>
            <div className="space-y-3">
              {notifications.length > 0 ? (
                notifications.slice(0, 5).map((notification) => (
                  <div 
                    key={notification.id} 
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      notification.read ? 'bg-gray-50' : 'bg-blue-50 border-l-4 border-blue-400'
                    }`}
                    onClick={() => handleViewNotification(notification.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">{notification.title}</h4>
                        <p className="text-sm text-gray-600">{notification.message}</p>
                        <p className="text-xs text-gray-500 mt-1">{notification.timestamp}</p>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <BellIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No recent notifications</p>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </BusinessLayout>
  );
};

export default BusinessDashboard;
