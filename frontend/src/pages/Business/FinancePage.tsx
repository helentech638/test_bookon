import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  CurrencyPoundIcon,
  CreditCardIcon,
  BanknotesIcon,
  ArrowTrendingUpIcon,
  ChartBarIcon,
  PlusIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  CalendarDaysIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import RevenueChart from '../../components/charts/RevenueChart';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import BusinessLayout from '../../components/layout/BusinessLayout';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/authService';
import { buildApiUrl } from '../../config/api';
import toast from 'react-hot-toast';

interface Transaction {
  id: string;
  parentName: string;
  childName: string;
  activity: string;
  venue: string;
  amount: number;
  paymentMethod: string;
  status: string;
  date: string;
  time: string;
  createdAt: string;
}

interface FinanceStats {
  totalRevenue: number;
  cardPayments: number;
  tfcPayments: number;
  creditPayments: number;
}

interface Discount {
  id: string;
  name: string;
  code: string;
  type: string;
  value: number;
  minAmount?: number;
  maxUses?: number;
  usedCount: number;
  isActive: boolean;
  expiresAt?: string;
  venue?: string;
  createdAt: string;
}

interface Credit {
  id: string;
  amount: number;
  reason: string;
  status: string;
  parentName: string;
  childName: string;
  activityName?: string;
  createdAt: string;
  expiresAt?: string;
}

interface Refund {
  id: string;
  amount: number;
  reason: string;
  status: string;
  parentName: string;
  childName: string;
  activityName?: string;
  paymentMethod: string;
  createdAt: string;
  processedAt?: string;
}

interface ReportData {
  grossRevenue: number;
  discountsApplied: number;
  netRevenue: number;
  totalTransactions: number;
  averageTransactionValue: number;
  revenueTrend: Array<{
    date: string;
    amount: number;
  }>;
}

const FinancePage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('transactions');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportRange, setReportRange] = useState('month');
  const [filters, setFilters] = useState({
    search: '',
    paymentMethod: '',
    status: ''
  });

  // Set active tab based on current route
  useEffect(() => {
    const path = location.pathname;
    if (path === '/business/finance') {
      setActiveTab('transactions');
    } else if (path === '/business/finance/transactions') {
      setActiveTab('transactions');
    } else if (path === '/business/finance/discounts') {
      setActiveTab('discounts');
    } else if (path === '/business/finance/credits') {
      setActiveTab('credits');
    } else if (path === '/business/finance/refunds') {
      setActiveTab('refunds');
    } else if (path === '/business/finance/reports') {
      setActiveTab('reports');
    }
  }, [location.pathname]);

  useEffect(() => {
    if (activeTab === 'transactions') {
      fetchTransactions();
    } else if (activeTab === 'discounts') {
      fetchDiscounts();
    } else if (activeTab === 'credits') {
      fetchCredits();
    } else if (activeTab === 'refunds') {
      fetchRefunds();
    } else if (activeTab === 'reports') {
      fetchReports();
    }
  }, [activeTab, filters, reportRange]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const token = authService.getToken();
      
      if (!token) {
        return;
      }

      const queryParams = new URLSearchParams({
        page: '1',
        limit: '50',
        ...(filters.search && { search: filters.search }),
        ...(filters.paymentMethod && { paymentMethod: filters.paymentMethod }),
        ...(filters.status && { status: filters.status })
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const response = await fetch(buildApiUrl(`/business/finance/transactions?${queryParams}`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }

      const data = await response.json();
      
      if (data.success) {
        setTransactions(data.data.transactions || []);
        setStats(data.data.stats || null);
      } else {
        throw new Error(data.message || 'Failed to fetch transactions');
      }
    } catch (error) {
      console.error('Transactions fetch error:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        setError('Transactions loading timeout - please refresh');
        toast.error('Transactions loading timeout - please refresh');
      } else {
        setError(error instanceof Error ? error.message : 'Failed to load transactions');
        toast.error('Failed to load transactions');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchDiscounts = async () => {
    try {
      setLoading(true);
      const token = authService.getToken();
      
      if (!token) {
        return;
      }

      const response = await fetch(buildApiUrl('/business/finance/discounts'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch discounts');
      }

      const data = await response.json();
      
      if (data.success) {
        setDiscounts(data.data.discounts || []);
      } else {
        throw new Error(data.message || 'Failed to fetch discounts');
      }
    } catch (error) {
      console.error('Discounts fetch error:', error);
      setError(error instanceof Error ? error.message : 'Failed to load discounts');
      toast.error('Failed to load discounts');
    } finally {
      setLoading(false);
    }
  };

  const fetchCredits = async () => {
    try {
      setLoading(true);
      const token = authService.getToken();
      
      if (!token) {
        return;
      }

      const response = await fetch(buildApiUrl('/business/finance/credits'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch credits');
      }

      const data = await response.json();
      
      if (data.success) {
        setCredits(data.data.credits || []);
      } else {
        throw new Error(data.message || 'Failed to fetch credits');
      }
    } catch (error) {
      console.error('Credits fetch error:', error);
      setError(error instanceof Error ? error.message : 'Failed to load credits');
      toast.error('Failed to load credits');
    } finally {
      setLoading(false);
    }
  };

  const fetchRefunds = async () => {
    try {
      setLoading(true);
      const token = authService.getToken();
      
      if (!token) {
        return;
      }

      const response = await fetch(buildApiUrl('/business/finance/refunds'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch refunds');
      }

      const data = await response.json();
      
      if (data.success) {
        setRefunds(data.data.refunds || []);
      } else {
        throw new Error(data.message || 'Failed to fetch refunds');
      }
    } catch (error) {
      console.error('Refunds fetch error:', error);
      setError(error instanceof Error ? error.message : 'Failed to load refunds');
      toast.error('Failed to load refunds');
    } finally {
      setLoading(false);
    }
  };

  const fetchReports = async () => {
    try {
      setLoading(true);
      const token = authService.getToken();
      
      if (!token) {
        return;
      }

      const response = await fetch(buildApiUrl(`/business/finance/reports?range=${reportRange}`), {
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
        setReportData(data.data);
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

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const tabs = [
    { id: 'transactions', name: 'Transactions', icon: CreditCardIcon },
    { id: 'discounts', name: 'Discounts', icon: BanknotesIcon },
    { id: 'credits', name: 'Credits', icon: ArrowTrendingUpIcon },
    { id: 'refunds', name: 'Refunds', icon: CreditCardIcon },
    { id: 'reports', name: 'Reports', icon: ChartBarIcon }
  ];


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Paid': return 'bg-green-100 text-green-800';
      case 'Pending': return 'bg-yellow-100 text-yellow-800';
      case 'Failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentMethodColor = (method: string) => {
    switch (method) {
      case 'Card': return 'bg-blue-100 text-blue-800';
      case 'Tax-Free Childcare': return 'bg-purple-100 text-purple-800';
      case 'Credit': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const renderTransactions = () => (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-white p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CurrencyPoundIcon className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">£{stats?.totalRevenue?.toFixed(2) || '0.00'}</p>
            </div>
          </div>
        </Card>
        <Card className="bg-white p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CreditCardIcon className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Card Payments</p>
              <p className="text-2xl font-bold text-gray-900">£{stats?.cardPayments?.toFixed(2) || '0.00'}</p>
            </div>
          </div>
        </Card>
        <Card className="bg-white p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <BanknotesIcon className="h-8 w-8 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">TFC Payments</p>
              <p className="text-2xl font-bold text-gray-900">£{stats?.tfcPayments?.toFixed(2) || '0.00'}</p>
            </div>
          </div>
        </Card>
        <Card className="bg-white p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ArrowTrendingUpIcon className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Credit Used</p>
              <p className="text-2xl font-bold text-gray-900">£{stats?.creditPayments?.toFixed(2) || '0.00'}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-white p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-64">
            <input
              type="text"
              placeholder="Search transactions..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
            />
          </div>
          <select 
            value={filters.paymentMethod}
            onChange={(e) => handleFilterChange('paymentMethod', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
          >
            <option value="">All Payment Methods</option>
            <option value="card">Card</option>
            <option value="tax_free_childcare">Tax-Free Childcare</option>
            <option value="credit">Credit</option>
          </select>
          <select 
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
          >
            <option value="">All Status</option>
            <option value="succeeded">Paid</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
          <Button className="bg-[#00806a] hover:bg-[#006d5a] text-white">
            <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </Card>

      {/* Transactions Table */}
      <Card className="bg-white">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Recent Transactions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Parent / Child
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Activity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    Loading transactions...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    No transactions found
                  </td>
                </tr>
              ) : (
                transactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{transaction.parentName}</div>
                        <div className="text-sm text-gray-500">{transaction.childName}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transaction.activity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      £{transaction.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPaymentMethodColor(transaction.paymentMethod)}`}>
                        {transaction.paymentMethod}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(transaction.status)}`}>
                        {transaction.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {transaction.date} {transaction.time}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Button
                        onClick={() => {/* View transaction */}}
                        className="text-[#00806a] hover:text-[#006d5a]"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );

  const renderDiscounts = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Discounts</h2>
        <Button className="bg-[#00806a] hover:bg-[#006d5a] text-white">
          <PlusIcon className="w-4 h-4 mr-2" />
          Create Discount
        </Button>
      </div>

      {loading ? (
        <Card className="bg-white p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00806a]"></div>
            <span className="ml-2 text-gray-600">Loading discounts...</span>
          </div>
        </Card>
      ) : error ? (
        <Card className="bg-white p-6">
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">{error}</p>
            <Button 
              onClick={fetchDiscounts}
              className="bg-[#00806a] hover:bg-[#006d5a] text-white"
            >
              Try Again
            </Button>
          </div>
        </Card>
      ) : discounts.length === 0 ? (
        <Card className="bg-white p-6">
          <div className="text-center py-8">
            <BanknotesIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No discounts</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating your first discount.</p>
            <div className="mt-6">
              <Button className="bg-[#00806a] hover:bg-[#006d5a] text-white">
                <PlusIcon className="w-4 h-4 mr-2" />
                Create Discount
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="bg-white">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Active Discounts</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Discount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {discounts.map((discount) => (
                  <tr key={discount.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{discount.name}</div>
                        {discount.venue && (
                          <div className="text-sm text-gray-500">{discount.venue}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                        {discount.code}
                      </code>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {discount.type === 'percentage' ? 'Percentage' : 'Fixed Amount'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {discount.type === 'percentage' ? `${discount.value}%` : `£${discount.value}`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {discount.usedCount}{discount.maxUses ? ` / ${discount.maxUses}` : ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        discount.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {discount.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Button
                        onClick={() => {/* Edit discount */}}
                        className="text-[#00806a] hover:text-[#006d5a] mr-3"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );

  const renderCredits = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Credits</h2>
        <Button className="bg-[#00806a] hover:bg-[#006d5a] text-white">
          <PlusIcon className="w-4 h-4 mr-2" />
          Issue Credit
        </Button>
      </div>

      {loading ? (
        <Card className="bg-white p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00806a]"></div>
            <span className="ml-2 text-gray-600">Loading credits...</span>
          </div>
        </Card>
      ) : error ? (
        <Card className="bg-white p-6">
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">{error}</p>
            <Button 
              onClick={fetchCredits}
              className="bg-[#00806a] hover:bg-[#006d5a] text-white"
            >
              Try Again
            </Button>
          </div>
        </Card>
      ) : credits.length === 0 ? (
        <Card className="bg-white p-6">
          <div className="text-center py-8">
            <ArrowTrendingUpIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No credits issued</h3>
            <p className="mt-1 text-sm text-gray-500">Issue credits to parents for refunds or compensation.</p>
            <div className="mt-6">
              <Button className="bg-[#00806a] hover:bg-[#006d5a] text-white">
                <PlusIcon className="w-4 h-4 mr-2" />
                Issue Credit
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="bg-white">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Issued Credits</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Parent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Child
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reason
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Issued
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {credits.map((credit) => (
                  <tr key={credit.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {credit.parentName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {credit.childName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      £{credit.amount}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="max-w-xs truncate" title={credit.reason}>
                        {credit.reason}
                      </div>
                      {credit.activityName && (
                        <div className="text-xs text-gray-500 mt-1">
                          Activity: {credit.activityName}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        credit.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : credit.status === 'used'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {credit.status.charAt(0).toUpperCase() + credit.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(credit.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Button
                        onClick={() => {/* View credit details */}}
                        className="text-[#00806a] hover:text-[#006d5a] mr-3"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );

  const renderRefunds = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Refunds</h2>
        <Button className="bg-[#00806a] hover:bg-[#006d5a] text-white">
          <PlusIcon className="w-4 h-4 mr-2" />
          Process Refund
        </Button>
      </div>

      {loading ? (
        <Card className="bg-white p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00806a]"></div>
            <span className="ml-2 text-gray-600">Loading refunds...</span>
          </div>
        </Card>
      ) : error ? (
        <Card className="bg-white p-6">
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">{error}</p>
            <Button 
              onClick={fetchRefunds}
              className="bg-[#00806a] hover:bg-[#006d5a] text-white"
            >
              Try Again
            </Button>
          </div>
        </Card>
      ) : refunds.length === 0 ? (
        <Card className="bg-white p-6">
          <div className="text-center py-8">
            <CreditCardIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No refunds processed</h3>
            <p className="mt-1 text-sm text-gray-500">Process refunds for cancelled bookings or customer issues.</p>
            <div className="mt-6">
              <Button className="bg-[#00806a] hover:bg-[#006d5a] text-white">
                <PlusIcon className="w-4 h-4 mr-2" />
                Process Refund
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="bg-white">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Processed Refunds</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Parent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Child
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Method
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reason
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Processed
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {refunds.map((refund) => (
                  <tr key={refund.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {refund.parentName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {refund.childName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      £{refund.amount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {refund.paymentMethod}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="max-w-xs truncate" title={refund.reason}>
                        {refund.reason}
                      </div>
                      {refund.activityName && (
                        <div className="text-xs text-gray-500 mt-1">
                          Activity: {refund.activityName}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        refund.status === 'completed' 
                          ? 'bg-green-100 text-green-800' 
                          : refund.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : refund.status === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {refund.status.charAt(0).toUpperCase() + refund.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {refund.processedAt 
                        ? new Date(refund.processedAt).toLocaleDateString()
                        : new Date(refund.createdAt).toLocaleDateString()
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Button
                        onClick={() => {/* View refund details */}}
                        className="text-[#00806a] hover:text-[#006d5a] mr-3"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );

  const renderReports = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Reports</h2>
        <div className="flex space-x-2">
          <select 
            value={reportRange}
            onChange={(e) => setReportRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a]"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
          </select>
          <Button className="bg-[#00806a] hover:bg-[#006d5a] text-white">
            <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {loading ? (
        <Card className="bg-white p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00806a]"></div>
            <span className="ml-2 text-gray-600">Loading reports...</span>
          </div>
        </Card>
      ) : error ? (
        <Card className="bg-white p-6">
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">{error}</p>
            <Button 
              onClick={fetchReports}
              className="bg-[#00806a] hover:bg-[#006d5a] text-white"
            >
              Try Again
            </Button>
          </div>
        </Card>
      ) : !reportData ? (
        <Card className="bg-white p-6">
          <div className="text-center py-8">
            <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No report data</h3>
            <p className="mt-1 text-sm text-gray-500">Report data will appear here once you have transactions.</p>
          </div>
        </Card>
      ) : (
        <>
          {/* Report Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-white p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CurrencyPoundIcon className="h-8 w-8 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Gross Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">£{reportData.grossRevenue.toLocaleString()}</p>
                </div>
              </div>
            </Card>
            <Card className="bg-white p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <BanknotesIcon className="h-8 w-8 text-red-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Discounts Applied</p>
                  <p className="text-2xl font-bold text-gray-900">£{reportData.discountsApplied.toLocaleString()}</p>
                </div>
              </div>
            </Card>
            <Card className="bg-white p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ArrowTrendingUpIcon className="h-8 w-8 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Net Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">£{reportData.netRevenue.toLocaleString()}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Additional Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-white p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CreditCardIcon className="h-8 w-8 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Transactions</p>
                  <p className="text-2xl font-bold text-gray-900">{reportData.totalTransactions}</p>
                </div>
              </div>
            </Card>
            <Card className="bg-white p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ChartBarIcon className="h-8 w-8 text-indigo-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Average Transaction</p>
                  <p className="text-2xl font-bold text-gray-900">£{reportData.averageTransactionValue.toLocaleString()}</p>
                </div>
              </div>
            </Card>
          </div>

          <Card className="bg-white p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Revenue Trends</h3>
            <RevenueChart 
              data={reportData.revenueTrend} 
              title=""
              height={256}
            />
          </Card>
        </>
      )}
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'transactions': return renderTransactions();
      case 'discounts': return renderDiscounts();
      case 'credits': return renderCredits();
      case 'refunds': return renderRefunds();
      case 'reports': return renderReports();
      default: return renderTransactions();
    }
  };

  return (
    <BusinessLayout user={user}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-[#00806a] text-[#00806a]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {renderTabContent()}
      </div>
    </BusinessLayout>
  );
};

export default FinancePage;
