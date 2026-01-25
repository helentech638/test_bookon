import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { 
  ChartBarIcon, 
  DocumentArrowDownIcon, 
  TableCellsIcon,
  CurrencyPoundIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ArrowLeftIcon,
  HomeIcon
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import { buildApiUrl } from '../../config/api';
import { toast } from 'react-hot-toast';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface MasterReportData {
  reportPeriod: {
    from: string;
    to: string;
    generatedAt: string;
  };
  summary: {
    totalFranchises: number;
    totalVenues: number;
    totalParents: number;
    totalBookings: number;
    totalRevenue: number;
    totalFranchiseFees: number;
    totalRefunds: number;
    totalCredits: number;
  };
  franchises: Array<{
    id: string;
    name: string;
    venueCount: number;
    totalRevenue: number;
    totalBookings: number;
    totalFranchiseFees: number;
    netRevenue: number;
    averageBookingValue: number;
  }>;
  venues: Array<{
    id: string;
    name: string;
    address: string;
    city: string;
    businessAccountName: string;
    activityCount: number;
    totalRevenue: number;
    totalBookings: number;
    netRevenue: number;
    averageBookingValue: number;
    capacityUtilization: number;
  }>;
  parents: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    childrenCount: number;
    totalSpent: number;
    totalBookings: number;
    totalRefunds: number;
    totalCredits: number;
    netSpent: number;
    averageBookingValue: number;
    lastBookingDate: string | null;
  }>;
  financials: {
    totalRevenue: number;
    totalRefunds: number;
    totalCredits: number;
    totalFranchiseFees: number;
    netRevenue: number;
    revenueByPaymentMethod: {
      card: number;
      tfc: number;
      credit: number;
    };
  };
  bookings: {
    totalBookings: number;
    confirmedBookings: number;
    pendingBookings: number;
    cancelledBookings: number;
    averageBookingValue: number;
    peakBookingDay?: string;
    peakBookingTime?: string;
  };
  payments: {
    cardRevenue: number;
    tfcRevenue: number;
    creditRevenue: number;
    otherRevenue: number;
    paidCount: number;
    pendingCount: number;
    failedCount: number;
    refundedCount: number;
  };
}

const MasterReports: React.FC = () => {
  const navigate = useNavigate();
  const [reportData, setReportData] = useState<MasterReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'franchises' | 'venues' | 'parents' | 'financials'>('summary');
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [franchiseFilter, setFranchiseFilter] = useState('');
  const [venueFilter, setVenueFilter] = useState('');

  useEffect(() => {
    fetchMasterReport();
  }, []);

  const fetchMasterReport = async () => {
    setLoading(true);
    try {
      const token = authService.getToken();
      const params = new URLSearchParams({
        dateFrom,
        dateTo,
        ...(franchiseFilter && { franchiseId: franchiseFilter }),
        ...(venueFilter && { venueId: venueFilter })
      });

      const response = await fetch(buildApiUrl(`/master-reports/master-report?${params}`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch master report');
      }

      const data = await response.json();
      console.log('Master Report Data Received:', data);
      console.log('Payment Data:', data.data?.payments);
      console.log('Franchise Data:', data.data?.franchises);
      console.log('Venue Data:', data.data?.venues);
      setReportData(data.data);
    } catch (error) {
      console.error('Error fetching master report:', error);
      toast.error('Failed to load master report');
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = async (format: 'pdf' | 'excel') => {
    try {
      const token = authService.getToken();
      const params = new URLSearchParams({
        dateFrom,
        dateTo,
        format,
        ...(franchiseFilter && { franchiseId: franchiseFilter }),
        ...(venueFilter && { venueId: venueFilter })
      });

      const response = await fetch(buildApiUrl(`/master-reports/master-report?${params}`), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to download ${format} report`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `master-report-${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success(`${format.toUpperCase()} report downloaded successfully`);
    } catch (error) {
      console.error(`Error downloading ${format} report:`, error);
      toast.error(`Failed to download ${format} report`);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Navigation Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={() => navigate('/admin')}
              className="flex items-center space-x-2"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/admin')}
              className="flex items-center space-x-2"
            >
              <HomeIcon className="w-4 h-4" />
              <span>Dashboard</span>
            </Button>
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Master Reports</h1>
        <p className="text-gray-600">Comprehensive analytics and reporting dashboard</p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Franchise</label>
              <input
                type="text"
                placeholder="Filter by franchise..."
                value={franchiseFilter}
                onChange={(e) => setFranchiseFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
              <input
                type="text"
                placeholder="Filter by venue..."
                value={venueFilter}
                onChange={(e) => setVenueFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex space-x-2">
              <Button onClick={fetchMasterReport} className="bg-blue-600 hover:bg-blue-700">
                Generate Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Download Options */}
      {reportData && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Export Options</h3>
                <p className="text-sm text-gray-600">Download detailed reports in your preferred format</p>
              </div>
              <div className="flex space-x-2">
                <Button
                  onClick={() => downloadReport('pdf')}
                  variant="outline"
                  className="flex items-center"
                >
                  <DocumentArrowDownIcon className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
                <Button
                  onClick={() => downloadReport('excel')}
                  variant="outline"
                  className="flex items-center"
                >
                  <TableCellsIcon className="w-4 h-4 mr-2" />
                  Download Excel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {reportData && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <BuildingOfficeIcon className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Franchises</p>
                    <p className="text-2xl font-semibold text-gray-900">{reportData.summary.totalFranchises}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <UserGroupIcon className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Parents</p>
                    <p className="text-2xl font-semibold text-gray-900">{reportData.summary.totalParents}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <CurrencyPoundIcon className="h-8 w-8 text-yellow-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                    <p className="text-2xl font-semibold text-gray-900">{formatCurrency(reportData.summary.totalRevenue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ArrowTrendingUpIcon className="h-8 w-8 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Franchise Fees</p>
                    <p className="text-2xl font-semibold text-gray-900">{formatCurrency(reportData.summary.totalFranchiseFees)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'summary', label: 'Summary', icon: ChartBarIcon },
                { id: 'franchises', label: 'Franchises', icon: BuildingOfficeIcon },
                { id: 'venues', label: 'Venues', icon: BuildingOfficeIcon },
                { id: 'parents', label: 'Parents', icon: UserGroupIcon },
                { id: 'financials', label: 'Financials', icon: CurrencyPoundIcon }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`group inline-flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className={`mr-2 h-5 w-5 ${
                    activeTab === tab.id ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                  }`} />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          {activeTab === 'summary' && (
            <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Financial Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Total Revenue</span>
                      <span className="font-semibold text-green-600">{formatCurrency(reportData.summary.totalRevenue)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Franchise Fees</span>
                      <span className="font-semibold text-blue-600">{formatCurrency(reportData.summary.totalFranchiseFees)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Total Refunds</span>
                      <span className="font-semibold text-red-600">{formatCurrency(reportData.summary.totalRefunds)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Total Credits</span>
                      <span className="font-semibold text-orange-600">{formatCurrency(reportData.summary.totalCredits)}</span>
                    </div>
                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-900 font-medium">Net Revenue</span>
                        <span className="font-bold text-green-700">
                          {formatCurrency(reportData.summary.totalRevenue - reportData.summary.totalFranchiseFees - reportData.summary.totalRefunds)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Business Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Total Bookings</span>
                      <span className="font-semibold">{reportData.summary.totalBookings}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Average Booking Value</span>
                      <span className="font-semibold">
                        {formatCurrency(reportData.summary.totalBookings > 0 ? reportData.summary.totalRevenue / reportData.summary.totalBookings : 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Venues per Franchise</span>
                      <span className="font-semibold">
                        {reportData.summary.totalFranchises > 0 ? (reportData.summary.totalVenues / reportData.summary.totalFranchises).toFixed(1) : 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Bookings per Parent</span>
                      <span className="font-semibold">
                        {reportData.summary.totalParents > 0 ? (reportData.summary.totalBookings / reportData.summary.totalParents).toFixed(1) : 0}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              {/* Revenue Breakdown Pie Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Revenue by Payment Method</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <Pie
                      data={{
                        labels: ['Card Payments', 'TFC Payments', 'Credit Payments', 'Other'],
                        datasets: [{
                          data: [
                            reportData.payments?.cardRevenue || 0,
                            reportData.payments?.tfcRevenue || 0,
                            reportData.payments?.creditRevenue || 0,
                            reportData.payments?.otherRevenue || 0
                          ],
                          backgroundColor: ['#00806a', '#2C8F7A', '#4CAF50', '#8BC34A'],
                          borderWidth: 2,
                          borderColor: '#fff'
                        }]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'bottom',
                            labels: {
                              padding: 20,
                              usePointStyle: true
                            }
                          },
                          tooltip: {
                            callbacks: {
                              label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${formatCurrency(value)} (${percentage}%)`;
                              }
                            }
                          }
                        }
                      }}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Franchise Performance Bar Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Franchise Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <Bar
                      data={{
                        labels: reportData.franchises?.map(f => f.name) || [],
                        datasets: [{
                          label: 'Revenue (£)',
                          data: reportData.franchises?.map(f => f.totalRevenue) || [],
                          backgroundColor: '#00806a',
                          borderColor: '#006d5a',
                          borderWidth: 1
                        }, {
                          label: 'Bookings',
                          data: reportData.franchises?.map(f => f.totalBookings) || [],
                          backgroundColor: '#2C8F7A',
                          borderColor: '#00806a',
                          borderWidth: 1,
                          yAxisID: 'y1'
                        }]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                          y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            title: {
                              display: true,
                              text: 'Revenue (£)'
                            }
                          },
                          y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            title: {
                              display: true,
                              text: 'Number of Bookings'
                            },
                            grid: {
                              drawOnChartArea: false,
                            },
                          }
                        },
                        plugins: {
                          legend: {
                            position: 'top'
                          },
                          tooltip: {
                            callbacks: {
                              label: function(context) {
                                const label = context.dataset.label || '';
                                const value = context.parsed.y;
                                if (label.includes('Revenue')) {
                                  return `${label}: ${formatCurrency(value)}`;
                                }
                                return `${label}: ${value}`;
                              }
                            }
                          }
                        }
                      }}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Venue Capacity Utilization Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Top Venues by Capacity Utilization</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <Bar
                      data={{
                        labels: reportData.venues?.slice(0, 10).map(v => v.name) || [],
                        datasets: [{
                          label: 'Capacity Utilization (%)',
                          data: reportData.venues?.slice(0, 10).map(v => v.capacityUtilization) || [],
                          backgroundColor: '#2C8F7A',
                          borderColor: '#00806a',
                          borderWidth: 1
                        }]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                          y: {
                            beginAtZero: true,
                            max: 100,
                            title: {
                              display: true,
                              text: 'Capacity Utilization (%)'
                            }
                          }
                        },
                        plugins: {
                          legend: {
                            display: false
                          },
                          tooltip: {
                            callbacks: {
                              label: function(context) {
                                return `Capacity Utilization: ${context.parsed.y.toFixed(1)}%`;
                              }
                            }
                          }
                        }
                      }}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Payment Status Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Payment Status Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <Pie
                      data={{
                        labels: ['Paid', 'Pending', 'Failed', 'Refunded'],
                        datasets: [{
                          data: [
                            reportData.payments?.paidCount || 0,
                            reportData.payments?.pendingCount || 0,
                            reportData.payments?.failedCount || 0,
                            reportData.payments?.refundedCount || 0
                          ],
                          backgroundColor: ['#4CAF50', '#FF9800', '#F44336', '#9C27B0'],
                          borderWidth: 2,
                          borderColor: '#fff'
                        }]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'bottom',
                            labels: {
                              padding: 20,
                              usePointStyle: true
                            }
                          },
                          tooltip: {
                            callbacks: {
                              label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                                return `${label}: ${value} (${percentage}%)`;
                              }
                            }
                          }
                        }
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
            </>
          )}

          {activeTab === 'franchises' && (
            <Card>
              <CardHeader>
                <CardTitle>Franchise Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Venues</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bookings</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Franchise Fees</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Net Revenue</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Booking</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData.franchises.map((franchise) => (
                        <tr key={franchise.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{franchise.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{franchise.venueCount}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(franchise.totalRevenue)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{franchise.totalBookings}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(franchise.totalFranchiseFees)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(franchise.netRevenue)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(franchise.averageBookingValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'venues' && (
            <Card>
              <CardHeader>
                <CardTitle>Venue Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Business Account</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Activities</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bookings</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Utilization</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData.venues.map((venue) => (
                        <tr key={venue.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{venue.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{venue.city}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{venue.businessAccountName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{venue.activityCount}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(venue.totalRevenue)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{venue.totalBookings}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatPercentage(venue.capacityUtilization)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'parents' && (
            <Card>
              <CardHeader>
                <CardTitle>Parent Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parent</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Children</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Spent</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bookings</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Credits</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Net Spent</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Booking</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData.parents.map((parent) => (
                        <tr key={parent.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{parent.firstName} {parent.lastName}</div>
                              <div className="text-sm text-gray-500">{parent.email}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{parent.childrenCount}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(parent.totalSpent)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{parent.totalBookings}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(parent.totalCredits)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(parent.netSpent)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {parent.lastBookingDate ? new Date(parent.lastBookingDate).toLocaleDateString() : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'financials' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Card Payments</span>
                      <span className="font-semibold text-green-600">{formatCurrency(reportData.financials.revenueByPaymentMethod.card)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Tax-Free Childcare</span>
                      <span className="font-semibold text-blue-600">{formatCurrency(reportData.financials.revenueByPaymentMethod.tfc)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Credit Payments</span>
                      <span className="font-semibold text-purple-600">{formatCurrency(reportData.financials.revenueByPaymentMethod.credit)}</span>
                    </div>
                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-900 font-medium">Total Revenue</span>
                        <span className="font-bold text-gray-900">{formatCurrency(reportData.financials.totalRevenue)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Fee Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Franchise Fees</span>
                      <span className="font-semibold text-blue-600">{formatCurrency(reportData.financials.totalFranchiseFees)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Fee Rate</span>
                      <span className="font-semibold">
                        {formatPercentage((reportData.financials.totalFranchiseFees / reportData.financials.totalRevenue) * 100)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Total Refunds</span>
                      <span className="font-semibold text-red-600">{formatCurrency(reportData.financials.totalRefunds)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Total Credits</span>
                      <span className="font-semibold text-orange-600">{formatCurrency(reportData.financials.totalCredits)}</span>
                    </div>
                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-900 font-medium">Net Revenue</span>
                        <span className="font-bold text-green-700">{formatCurrency(reportData.financials.netRevenue)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MasterReports;
