import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/layout/Layout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { 
  ClockIcon,
  UserIcon,
  CalendarIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  CurrencyPoundIcon,
  CreditCardIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { buildApiUrl } from '../config/api';
import { authService } from '../services/authService';

interface ActivityLogEntry {
  id: string;
  type: 'booking' | 'payment' | 'cancellation' | 'wallet' | 'child' | 'profile';
  action: string;
  description: string;
  timestamp: string;
  childName?: string;
  activityName?: string;
  amount?: number;
  metadata?: any;
  status?: 'success' | 'error' | 'warning' | 'info';
}

const ActivityLogPage: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');

  useEffect(() => {
    fetchActivityLogs();
  }, []);

  const fetchActivityLogs = async () => {
    try {
      setLoading(true);
      const token = authService.getToken();
      if (!token) {
        toast.error('Please log in to view activity logs');
        return;
      }

      // Fetch parent's bookings and wallet transactions
      const [bookingsResponse, walletResponse] = await Promise.all([
        fetch(buildApiUrl('/bookings'), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch(buildApiUrl('/wallet/transactions'), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
      ]);

      const activityLogs: ActivityLogEntry[] = [];

      // Process bookings
      if (bookingsResponse.ok) {
        const bookingsData = await bookingsResponse.json();
        if (bookingsData.success && bookingsData.data) {
          bookingsData.data.forEach((booking: any) => {
            // Booking created
            activityLogs.push({
              id: `booking-${booking.id}`,
              type: 'booking',
              action: 'Booking Created',
              description: `Booked ${booking.activity?.title || 'activity'} for ${booking.child?.firstName || 'child'}`,
              timestamp: booking.createdAt,
              childName: booking.child?.firstName,
              activityName: booking.activity?.title,
              amount: booking.amount,
              status: 'success'
            });

            // Payment status
            if (booking.paymentStatus === 'paid') {
              activityLogs.push({
                id: `payment-${booking.id}`,
                type: 'payment',
                action: 'Payment Completed',
                description: `Payment of £${booking.amount} processed successfully`,
                timestamp: booking.updatedAt,
                amount: booking.amount,
                status: 'success'
              });
            }

            // Cancellation
            if (booking.status === 'cancelled') {
              activityLogs.push({
                id: `cancel-${booking.id}`,
                type: 'cancellation',
                action: 'Booking Cancelled',
                description: `Cancelled booking for ${booking.activity?.title || 'activity'}`,
                timestamp: booking.updatedAt,
                childName: booking.child?.firstName,
                activityName: booking.activity?.title,
                status: 'warning'
              });
            }
          });
        }
      }

      // Process wallet transactions
      if (walletResponse.ok) {
        const walletData = await walletResponse.json();
        if (walletData.success && walletData.data) {
          walletData.data.forEach((transaction: any) => {
            activityLogs.push({
              id: `wallet-${transaction.id}`,
              type: 'wallet',
              action: transaction.type === 'credit' ? 'Wallet Credit Added' : 'Wallet Payment',
              description: transaction.description || `${transaction.type} transaction`,
              timestamp: transaction.createdAt,
              amount: transaction.amount,
              status: 'success'
            });
          });
        }
      }

      // Sort by timestamp (newest first)
      activityLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLogs(activityLogs);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      toast.error('Failed to load activity logs');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };


  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (log.childName && log.childName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (log.activityName && log.activityName.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = typeFilter === 'all' || log.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
    
    // Date filter logic
    let matchesDate = true;
    if (dateFilter !== 'all') {
      const logDate = new Date(log.timestamp);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      switch (dateFilter) {
        case 'today':
          matchesDate = logDate >= today;
          break;
        case 'yesterday':
          matchesDate = logDate >= yesterday && logDate < today;
          break;
        case 'week':
          matchesDate = logDate >= weekAgo;
          break;
        case 'month':
          matchesDate = logDate >= new Date(now.getFullYear(), now.getMonth(), 1);
          break;
      }
    }
    
    return matchesSearch && matchesType && matchesStatus && matchesDate;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'info':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircleIcon className="h-4 w-4" />;
      case 'error':
        return <XCircleIcon className="h-4 w-4" />;
      case 'warning':
        return <ExclamationTriangleIcon className="h-4 w-4" />;
      case 'info':
        return <EyeIcon className="h-4 w-4" />;
      default:
        return <ClockIcon className="h-4 w-4" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'booking':
        return <CalendarIcon className="h-4 w-4" />;
      case 'payment':
        return <CreditCardIcon className="h-4 w-4" />;
      case 'cancellation':
        return <XCircleIcon className="h-4 w-4" />;
      case 'wallet':
        return <CurrencyPoundIcon className="h-4 w-4" />;
      case 'child':
        return <UserGroupIcon className="h-4 w-4" />;
      case 'profile':
        return <UserIcon className="h-4 w-4" />;
      default:
        return <ClockIcon className="h-4 w-4" />;
    }
  };

  const handleExportLogs = async () => {
    try {
      // Mock export - replace with actual API call
      toast.success('Activity logs exported successfully');
    } catch (error) {
      console.error('Error exporting logs:', error);
      toast.error('Failed to export logs');
    }
  };

  if (loading) {
    return (
      <Layout user={user}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-64 mb-6"></div>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-white p-6 rounded-lg shadow">
                  <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-300 rounded w-1/2 mb-4"></div>
                  <div className="h-3 bg-gray-300 rounded w-full mb-2"></div>
                  <div className="h-3 bg-gray-300 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Activity Log</h1>
            <p className="text-gray-600 mt-1">View and track all system activities</p>
          </div>
          <Button 
            variant="outline"
            onClick={handleExportLogs}
            className="flex items-center gap-2"
          >
            <ArrowDownTrayIcon className="h-5 w-5" />
            Export Logs
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card className="p-6">
            <div className="flex items-center">
              <ClockIcon className="h-8 w-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Activities</p>
                <p className="text-2xl font-bold text-gray-900">{logs.length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center">
              <CheckCircleIcon className="h-8 w-8 text-green-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Successful</p>
                <p className="text-2xl font-bold text-gray-900">
                  {logs.filter(l => l.status === 'success').length}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-8 w-8 text-yellow-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Warnings</p>
                <p className="text-2xl font-bold text-gray-900">
                  {logs.filter(l => l.status === 'warning').length}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center">
              <XCircleIcon className="h-8 w-8 text-red-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Errors</p>
                <p className="text-2xl font-bold text-gray-900">
                  {logs.filter(l => l.status === 'error').length}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search activities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00806a] focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00806a] focus:border-transparent"
              >
                <option value="all">All Types</option>
                <option value="booking">Booking</option>
                <option value="payment">Payment</option>
                <option value="cancellation">Cancellation</option>
                <option value="wallet">Wallet</option>
                <option value="child">Child</option>
                <option value="profile">Profile</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00806a] focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
                <option value="info">Info</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00806a] focus:border-transparent"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm('');
                  setTypeFilter('all');
                  setStatusFilter('all');
                  setDateFilter('all');
                }}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </Card>

        {/* Activity Logs List */}
        <div className="space-y-4">
          {filteredLogs.map((log) => (
            <Card key={log.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    {getTypeIcon(log.type)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{log.action}</h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(log.status || 'info')}`}>
                          {getStatusIcon(log.status || 'info')}
                          <span className="ml-1">{log.status}</span>
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          log.type === 'booking' ? 'bg-blue-100 text-blue-800' :
                          log.type === 'payment' ? 'bg-green-100 text-green-800' :
                          log.type === 'cancellation' ? 'bg-red-100 text-red-800' :
                          log.type === 'wallet' ? 'bg-purple-100 text-purple-800' :
                          log.type === 'child' ? 'bg-indigo-100 text-indigo-800' :
                          log.type === 'profile' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {log.type.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{log.description}</p>
                      {log.childName && (
                        <p className="text-sm text-gray-500 mb-1">
                          Child: {log.childName}
                        </p>
                      )}
                      {log.activityName && (
                        <p className="text-sm text-gray-500 mb-1">
                          Activity: {log.activityName}
                        </p>
                      )}
                      {log.amount && (
                        <p className="text-sm text-gray-500 mb-1">
                          Amount: £{log.amount.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-sm text-gray-500">
                    <span>{new Date(log.timestamp).toLocaleString()}</span>
                    {log.metadata && (
                      <span>Metadata: {JSON.stringify(log.metadata)}</span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {filteredLogs.length === 0 && (
          <Card className="p-12 text-center">
            <ClockIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No activities found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || typeFilter !== 'all' || statusFilter !== 'all' || dateFilter !== 'all'
                ? 'Try adjusting your search criteria'
                : 'No activity logs available yet'
              }
            </p>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default ActivityLogPage;
