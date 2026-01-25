import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
  MagnifyingGlassIcon, 
  FunnelIcon, 
  EyeIcon,
  ClockIcon,
  CurrencyPoundIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  CreditCardIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import BusinessLayout from '../../components/layout/BusinessLayout';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/authService';
import { buildApiUrl } from '../../config/api';
import { formatPrice } from '../../utils/formatting';

interface Payment {
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

const PaymentManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const token = authService.getToken();
      
      const response = await fetch(buildApiUrl('/business/finance/transactions'), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch payments');
      }

      const data = await response.json();
      if (data.success) {
        setPayments(data.data.transactions || []);
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  const handleViewPayment = (payment: Payment) => {
    setSelectedPayment(payment);
    setShowViewModal(true);
  };

  const getStatusBadge = (status: string) => {
    const normalizedStatus = status.toLowerCase();
    const styles: { [key: string]: string } = {
      completed: 'bg-green-100 text-green-800',
      succeeded: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800',
      error: 'bg-red-100 text-red-800',
      refunded: 'bg-purple-100 text-purple-800',
    };
    const style = styles[normalizedStatus] || 'bg-gray-100 text-gray-800';
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${style}`}>
        {status}
      </span>
    );
  };

  const getPaymentMethodBadge = (method: string) => {
    const normalizedMethod = method.toLowerCase();
    const styles: { [key: string]: string } = {
      card: 'bg-blue-100 text-blue-800',
      stripe: 'bg-blue-100 text-blue-800',
      credit_card: 'bg-blue-100 text-blue-800',
      tax_free_childcare: 'bg-green-100 text-green-800',
      tfc: 'bg-green-100 text-green-800',
      credit: 'bg-purple-100 text-purple-800',
      voucher: 'bg-purple-100 text-purple-800',
      mixed: 'bg-orange-100 text-orange-800',
    };
    const style = styles[normalizedMethod] || 'bg-gray-100 text-gray-800';
    const displayName = method.replace(/_/g, ' ').toUpperCase();
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${style}`}>
        {displayName}
      </span>
    );
  };

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = 
      payment.activity.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.childName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.parentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.venue.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
    const matchesMethod = paymentMethodFilter === 'all' || payment.paymentMethod === paymentMethodFilter;

    return matchesSearch && matchesStatus && matchesMethod;
  });

  const totalRevenue = payments
    .filter(p => p.status === 'succeeded' || p.status === 'completed')
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const pendingPayments = payments.filter(p => p.status === 'pending' || p.status === 'processing').length;
  const failedPayments = payments.filter(p => p.status === 'failed' || p.status === 'error').length;
  const refundedPayments = payments.filter(p => p.status === 'refunded' || p.status.includes('refund')).length;

  if (loading) {
    return (
      <BusinessLayout user={user}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00806a]"></div>
        </div>
      </BusinessLayout>
    );
  }

  return (
    <BusinessLayout user={user}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Payment Management</h1>
          <div className="flex space-x-3">
            <Button variant="outline" onClick={() => fetchPayments()}>
              <ArrowPathIcon className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="p-6">
            <div className="flex items-center">
              <CurrencyPoundIcon className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">{formatPrice(totalRevenue)}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <ClockIcon className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-gray-900">{pendingPayments}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <XCircleIcon className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Failed</p>
                <p className="text-2xl font-bold text-gray-900">{failedPayments}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <CreditCardIcon className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Refunded</p>
                <p className="text-2xl font-bold text-gray-900">{refundedPayments}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Search and Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search payments..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00806a] focus:border-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <select
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00806a] focus:border-transparent"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>

          <select
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00806a] focus:border-transparent"
            value={paymentMethodFilter}
            onChange={(e) => setPaymentMethodFilter(e.target.value)}
          >
            <option value="all">All Methods</option>
            <option value="stripe">Stripe</option>
            <option value="tfc">TFC</option>
            <option value="voucher">Voucher</option>
            <option value="mixed">Mixed</option>
          </select>
        </div>

        {/* Payments Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Activity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Participant
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
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPayments.length > 0 ? (
                  filteredPayments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{payment.id.substring(0, 8)}...</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{payment.activity}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {payment.childName}
                        </div>
                        <div className="text-sm text-gray-500">{payment.parentName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatPrice(payment.amount)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getPaymentMethodBadge(payment.paymentMethod)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(payment.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(payment.date).toLocaleDateString()}
                        </div>
                        <div className="text-sm text-gray-500">
                          {payment.time}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleViewPayment(payment)}
                          className="text-[#00806a] hover:text-[#006d5a]"
                          title="View Details"
                        >
                          <EyeIcon className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <div className="text-gray-500">
                        No payments found
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* View Modal */}
        {showViewModal && selectedPayment && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Payment Details</h2>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircleIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Payment Information</h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">Payment ID:</span> {selectedPayment.id}</p>
                    <p><span className="font-medium">Amount:</span> {formatPrice(selectedPayment.amount)}</p>
                    <p><span className="font-medium">Method:</span> {getPaymentMethodBadge(selectedPayment.paymentMethod)}</p>
                    <p><span className="font-medium">Status:</span> {getStatusBadge(selectedPayment.status)}</p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Booking Information</h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">Activity:</span> {selectedPayment.activity}</p>
                    <p><span className="font-medium">Child:</span> {selectedPayment.childName}</p>
                    <p><span className="font-medium">Parent:</span> {selectedPayment.parentName}</p>
                    <p><span className="font-medium">Venue:</span> {selectedPayment.venue}</p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Timeline</h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">Date:</span> {new Date(selectedPayment.date).toLocaleDateString()}</p>
                    <p><span className="font-medium">Time:</span> {selectedPayment.time}</p>
                    <p><span className="font-medium">Created:</span> {new Date(selectedPayment.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <Button onClick={() => setShowViewModal(false)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </BusinessLayout>
  );
};

export default PaymentManagementPage;
