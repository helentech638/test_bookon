import React, { useState, useEffect } from 'react';
import { 
  ChartBarIcon,
  CalendarDaysIcon,
  CurrencyPoundIcon,
  UserGroupIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowDownTrayIcon,
  DocumentArrowDownIcon
} from '@heroicons/react/24/outline';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/authService';
import { buildApiUrl } from '../../config/api';
import toast from 'react-hot-toast';

interface BookingReport {
  id: string;
  childName?: string;
  child_name?: string;
  activity_name?: string;
  activity: string | {
    id: string;
    title: string;
    description?: string;
    price?: number;
    max_capacity?: number;
    current_capacity?: number;
  };
  venue_name?: string;
  venue: string | {
    id: string;
    name: string;
    address?: string;
    city?: string;
  };
  date?: string;
  start_date?: string;
  time?: string;
  start_time?: string;
  amount?: number;
  total_amount?: number;
  status: string;
  paymentStatus?: string;
  payment_status?: string;
  createdAt?: string;
  created_at?: string;
}

interface ReportStats {
  totalBookings: number;
  totalSpent: number;
  completedBookings: number;
  cancelledBookings: number;
  pendingBookings: number;
  averageBookingValue: number;
  mostPopularActivity: string;
  mostUsedVenue: string;
}

interface MonthlyData {
  month: string;
  bookings: number;
  amount: number;
}

const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<BookingReport[]>([]);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('6months');

  useEffect(() => {
    fetchReports();
  }, [selectedPeriod]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const token = authService.getToken();
      
      if (!token) {
        return;
      }

      // Fetch bookings data
      const response = await fetch(buildApiUrl('/bookings'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch reports');
      }

      const data = await response.json();
      
      if (data.success) {
        const bookingsData = data.data || [];
        setBookings(bookingsData);
        
        // Calculate stats from bookings data
        const calculatedStats = calculateStats(bookingsData);
        setStats(calculatedStats);
        
        // Calculate monthly data
        const monthly = calculateMonthlyData(bookingsData);
        setMonthlyData(monthly);
      } else {
        throw new Error(data.message || 'Failed to fetch reports');
      }
    } catch (error) {
      console.error('Reports fetch error:', error);
      setError(error instanceof Error ? error.message : 'Failed to load reports');
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (bookings: BookingReport[]): ReportStats => {
    const totalBookings = bookings.length;
    // Fix total spent calculation - use correct field names from backend
    const totalSpent = bookings.reduce((sum, booking) => {
      const amount = booking.total_amount || booking.amount || 0;
      return sum + Number(amount);
    }, 0);
    
    const completedBookings = bookings.filter(b => b.status === 'completed').length;
    const cancelledBookings = bookings.filter(b => b.status === 'cancelled').length;
    const pendingBookings = bookings.filter(b => b.status === 'pending').length;
    const averageBookingValue = totalBookings > 0 ? totalSpent / totalBookings : 0;

    // Find most popular activity - use correct field names
    const activityCounts: { [key: string]: number } = {};
    bookings.forEach(booking => {
      const activity = booking.activity_name || 
        (typeof booking.activity === 'string' ? booking.activity : 
        (booking.activity && typeof booking.activity === 'object' && 'title' in booking.activity) ? 
          (booking.activity as { title: string }).title : 'Unknown');
      activityCounts[activity] = (activityCounts[activity] || 0) + 1;
    });
    const mostPopularActivity = Object.keys(activityCounts).reduce((a, b) => 
      activityCounts[a] > activityCounts[b] ? a : b, 'None'
    );

    // Find most used venue - use correct field names
    const venueCounts: { [key: string]: number } = {};
    bookings.forEach(booking => {
      const venue = booking.venue_name || 
        (typeof booking.venue === 'string' ? booking.venue : 
        (booking.venue && typeof booking.venue === 'object' && 'name' in booking.venue) ? 
          (booking.venue as { name: string }).name : 'Unknown');
      venueCounts[venue] = (venueCounts[venue] || 0) + 1;
    });
    const mostUsedVenue = Object.keys(venueCounts).reduce((a, b) => 
      venueCounts[a] > venueCounts[b] ? a : b, 'None'
    );

    return {
      totalBookings,
      totalSpent,
      completedBookings,
      cancelledBookings,
      pendingBookings,
      averageBookingValue,
      mostPopularActivity,
      mostUsedVenue
    };
  };

  const calculateMonthlyData = (bookings: BookingReport[]): MonthlyData[] => {
    const monthlyMap: { [key: string]: { bookings: number; amount: number } } = {};
    
    bookings.forEach(booking => {
      // Use correct field names from backend
      const dateString = booking.start_date || booking.date || booking.created_at || booking.createdAt;
      if (!dateString) return; // Skip if no date available
      
      const date = new Date(dateString);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = { bookings: 0, amount: 0 };
      }
      
      const amount = Number(booking.total_amount || booking.amount || 0);
      
      monthlyMap[monthKey].bookings += 1;
      monthlyMap[monthKey].amount += amount;
    });

    return Object.entries(monthlyMap)
      .map(([month, data]) => ({
        month,
        bookings: data.bookings,
        amount: data.amount
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6); // Last 6 months
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const exportReports = () => {
    const csvContent = [
      ['Child Name', 'Activity', 'Venue', 'Date', 'Time', 'Amount', 'Status', 'Payment Status'],
      ...bookings.map(booking => [
        booking.child_name || booking.childName || '',
        booking.activity_name || 
          (typeof booking.activity === 'string' ? booking.activity : 
          (booking.activity && typeof booking.activity === 'object' && 'title' in booking.activity) ? 
            (booking.activity as { title: string }).title : ''),
        booking.venue_name || 
          (typeof booking.venue === 'string' ? booking.venue : 
          (booking.venue && typeof booking.venue === 'object' && 'name' in booking.venue) ? 
            (booking.venue as { name: string }).name : ''),
        formatDate(booking.start_date || booking.date || booking.created_at || booking.createdAt || ''),
        booking.start_time || booking.time || '',
        booking.total_amount || booking.amount || 0,
        booking.status || '',
        booking.payment_status || booking.paymentStatus || ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `booking-reports-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    toast.success('Reports exported successfully');
  };

  const exportReportsPDF = () => {
    // Create a simple PDF-like HTML content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Booking Reports - ${new Date().toLocaleDateString()}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .stats { display: flex; justify-content: space-around; margin-bottom: 30px; }
          .stat-box { text-align: center; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Booking Reports</h1>
          <p>Generated on ${new Date().toLocaleDateString()}</p>
        </div>
        
        <div class="stats">
          <div class="stat-box">
            <h3>${stats?.totalBookings || 0}</h3>
            <p>Total Bookings</p>
          </div>
          <div class="stat-box">
            <h3>${formatPrice(stats?.totalSpent || 0)}</h3>
            <p>Total Spent</p>
          </div>
          <div class="stat-box">
            <h3>${stats?.completedBookings || 0}</h3>
            <p>Completed</p>
          </div>
          <div class="stat-box">
            <h3>${formatPrice(stats?.averageBookingValue || 0)}</h3>
            <p>Average Value</p>
          </div>
        </div>
        
        <h2>Recent Bookings</h2>
        <table>
          <thead>
            <tr>
              <th>Child & Activity</th>
              <th>Venue</th>
              <th>Date & Time</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${bookings.slice(0, 20).map(booking => `
              <tr>
                <td>
                  <strong>${booking.child_name || booking.childName || ''}</strong><br>
                  ${booking.activity_name || 
                    (typeof booking.activity === 'string' ? booking.activity : 
                    (booking.activity && typeof booking.activity === 'object' && 'title' in booking.activity) ? 
                      (booking.activity as { title: string }).title : '')}
                </td>
                <td>${booking.venue_name || 
                  (typeof booking.venue === 'string' ? booking.venue : 
                  (booking.venue && typeof booking.venue === 'object' && 'name' in booking.venue) ? 
                    (booking.venue as { name: string }).name : '')}</td>
                <td>
                  ${formatDate(booking.start_date || booking.date || booking.created_at || booking.createdAt || '')}<br>
                  ${booking.start_time || booking.time || ''}
                </td>
                <td>${formatPrice(booking.total_amount || booking.amount || 0)}</td>
                <td>${booking.status || 'pending'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="footer">
          <p>Report generated by BookOn System</p>
        </div>
      </body>
      </html>
    `;

    // Open in new window for printing/saving as PDF
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
    
    toast.success('PDF report opened for printing');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00806a] mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading reports...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="text-red-600 mb-4">
              <XCircleIcon className="h-12 w-12 mx-auto" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Reports</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={fetchReports} className="bg-[#00806a] text-white">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
              <p className="mt-2 text-gray-600">View your booking activity and spending insights</p>
            </div>
            <div className="flex space-x-3">
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a] focus:border-[#00806a]"
              >
                <option value="3months">Last 3 months</option>
                <option value="6months">Last 6 months</option>
                <option value="1year">Last year</option>
                <option value="all">All time</option>
              </select>
              <Button
                onClick={exportReports}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                <span>Export CSV</span>
              </Button>
              <Button
                onClick={exportReportsPDF}
                className="flex items-center space-x-2 bg-[#00806a] text-white hover:bg-[#006b5a]"
              >
                <DocumentArrowDownIcon className="h-4 w-4" />
                <span>Export PDF</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CalendarDaysIcon className="h-8 w-8 text-[#00806a]" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Bookings</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.totalBookings}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CurrencyPoundIcon className="h-8 w-8 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Spent</p>
                  <p className="text-2xl font-semibold text-gray-900">{formatPrice(stats.totalSpent)}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CheckCircleIcon className="h-8 w-8 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Completed</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.completedBookings}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ClockIcon className="h-8 w-8 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Average Value</p>
                  <p className="text-2xl font-semibold text-gray-900">{formatPrice(stats.averageBookingValue)}</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Insights */}
        {stats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Insights</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Most Popular Activity:</span>
                  <span className="font-medium">{stats.mostPopularActivity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Most Used Venue:</span>
                  <span className="font-medium">{stats.mostUsedVenue}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Cancelled Bookings:</span>
                  <span className="font-medium text-red-600">{stats.cancelledBookings}</span>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Overview</h3>
              <div className="space-y-2">
                {monthlyData.map((month, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{month.month}</span>
                    <div className="text-right">
                      <div className="text-sm font-medium">{month.bookings} bookings</div>
                      <div className="text-xs text-gray-500">{formatPrice(month.amount)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Recent Bookings */}
        <Card className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Recent Bookings</h3>
            <span className="text-sm text-gray-500">{bookings.length} total bookings</span>
          </div>
          
          {bookings.length === 0 ? (
            <div className="text-center py-8">
              <CalendarDaysIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No bookings found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Child & Activity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Venue
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {bookings.slice(0, 10).map((booking) => (
                    <tr key={booking.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{booking.child_name || booking.childName}</div>
                          <div className="text-sm text-gray-500">
                            {booking.activity_name || 
                              (typeof booking.activity === 'string' ? booking.activity : 
                              (booking.activity && typeof booking.activity === 'object' && 'title' in booking.activity) ? 
                                (booking.activity as { title: string }).title : 'Unknown')}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {booking.venue_name || 
                            (typeof booking.venue === 'string' ? booking.venue : 
                            (booking.venue && typeof booking.venue === 'object' && 'name' in booking.venue) ? 
                              (booking.venue as { name: string }).name : 'Unknown')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatDate(booking.start_date || booking.date || booking.created_at || booking.createdAt || '')}</div>
                        <div className="text-sm text-gray-500">{booking.start_time || booking.time}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{formatPrice(booking.total_amount || booking.amount || 0)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          booking.status === 'completed' ? 'bg-green-100 text-green-800' :
                          booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                          booking.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {booking.status || 'pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ReportsPage;
