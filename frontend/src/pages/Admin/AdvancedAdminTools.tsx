import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  CogIcon,
  ClipboardDocumentListIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  UsersIcon,
  BuildingOfficeIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckIcon,
  XMarkIcon,
  EyeIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { authService } from '../../services/authService';
import { buildApiUrl } from '../../config/api';
import AdminLayout from '../../components/layout/AdminLayout';

interface SystemConfig {
  app: {
    name: string;
    version: string;
    environment: string;
  };
  features: {
    emailNotifications: boolean;
    smsNotifications: boolean;
    paymentProcessing: boolean;
    analytics: boolean;
  };
  limits: {
    maxVenuesPerUser: number;
    maxActivitiesPerVenue: number;
    maxBookingsPerUser: number;
    fileUploadSize: string;
  };
  integrations: {
    stripe: boolean;
    emailService: string;
    analytics: string;
  };
}

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details: string;
  ipAddress: string;
  timestamp: string;
}

interface BulkOperation {
  id: string;
  type: 'user_update' | 'venue_update' | 'booking_update';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalItems: number;
  processedItems: number;
  failedItems: number;
  createdAt: string;
  completedAt?: string;
}

const AdvancedAdminTools: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'bulk' | 'config' | 'audit'>('bulk');
  const [loading, setLoading] = useState(false);

  // Bulk Operations State
  const [bulkOperations, setBulkOperations] = useState<BulkOperation[]>([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkFormData, setBulkFormData] = useState({
    type: 'user_update',
    targetIds: '',
    updates: {
      role: '',
      isActive: ''
    }
  });

  // System Config State
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SystemConfig | null>(null);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditFilters, setAuditFilters] = useState({
    action: '',
    resourceType: '',
    userId: '',
    dateFrom: '',
    dateTo: ''
  });

  useEffect(() => {
    if (activeTab === 'bulk') {
      fetchBulkOperations();
    } else if (activeTab === 'config') {
      fetchSystemConfig();
    } else if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab]);

  const fetchBulkOperations = async () => {
    setLoading(true);
    try {
      const token = authService.getToken();
      if (!token) {
        toast.error('No authentication token');
        setBulkOperations([]);
        return;
      }

      const response = await fetch(buildApiUrl('/admin/bulk-operations'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Handle the new API response structure
        const operations = data.data?.bulkOperations || [];
        setBulkOperations(Array.isArray(operations) ? operations : []);
      } else {
        toast.error('Failed to fetch bulk operations');
        setBulkOperations([]);
      }
    } catch (error) {
      toast.error('Error fetching bulk operations');
      setBulkOperations([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSystemConfig = async () => {
    setLoading(true);
    try {
      const token = authService.getToken();
      const response = await fetch(buildApiUrl('/admin/system-config'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSystemConfig(data.data);
        setEditingConfig(data.data);
      } else {
        toast.error('Failed to fetch system configuration');
      }
    } catch (error) {
      toast.error('Error fetching system configuration');
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const token = authService.getToken();
      const queryParams = new URLSearchParams({
        ...auditFilters
      });

      const response = await fetch(buildApiUrl(`/admin/audit-logs?${queryParams}`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Handle the new API response structure
        const logs = data.data?.auditLogs || [];
        setAuditLogs(Array.isArray(logs) ? logs : []);
      } else {
        toast.error('Failed to fetch audit logs');
        setAuditLogs([]);
      }
    } catch (error) {
      toast.error('Error fetching audit logs');
      setAuditLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkOperation = async () => {
    if (!bulkFormData.targetIds.trim()) {
      toast.error('Please enter target IDs');
      return;
    }

    try {
      const targetIds = bulkFormData.targetIds.split(',').map(id => id.trim()).filter(id => id);

      const token = authService.getToken();
      const response = await fetch(buildApiUrl('/admin/bulk-user-update'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userIds: targetIds,
          updates: bulkFormData.updates
        })
      });

      if (response.ok) {
        const data = await response.json();

        // Add to local state
        const newOperation: BulkOperation = {
          id: `bulk_${Date.now()}`,
          type: 'user_update',
          status: 'processing',
          totalItems: targetIds.length,
          processedItems: 0,
          failedItems: 0,
          createdAt: new Date().toISOString()
        };

        setBulkOperations(prev => [newOperation, ...prev]);
        toast.success('Bulk operation started successfully');
        setShowBulkModal(false);
        setBulkFormData({
          type: 'user_update',
          targetIds: '',
          updates: { role: '', isActive: '' }
        });
      } else {
        toast.error('Failed to start bulk operation');
      }
    } catch (error) {
      toast.error('Error starting bulk operation');
    }
  };

  const handleConfigSave = async () => {
    if (!editingConfig) return;

    try {
      // For now, just update local state
      // In production, this would make an API call
      setSystemConfig(editingConfig);
      toast.success('System configuration updated successfully');
      setShowConfigModal(false);
    } catch (error) {
      toast.error('Error updating system configuration');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckIcon className="w-4 h-4" />;
      case 'processing':
        return <ChartBarIcon className="w-4 h-4" />;
      case 'pending':
        return <ClockIcon className="w-4 h-4" />;
      case 'failed':
        return <XMarkIcon className="w-4 h-4" />;
      default:
        return <ClockIcon className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionLabel = (action: string) => {
    return action.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const getResourceTypeIcon = (type: string) => {
    switch (type) {
      case 'user':
        return <UsersIcon className="w-4 h-4" />;
      case 'venue':
        return <BuildingOfficeIcon className="w-4 h-4" />;
      case 'booking':
        return <ClipboardDocumentListIcon className="w-4 h-4" />;
      case 'activity':
        return <ChartBarIcon className="w-4 h-4" />;
      default:
        return <DocumentTextIcon className="w-4 h-4" />;
    }
  };

  return (
    <AdminLayout title="Advanced Admin Tools">
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Advanced Admin Tools</h1>
                <p className="text-sm sm:text-base text-gray-600">Bulk operations, system configuration, and audit logging</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200 mb-6 sm:mb-8">
            <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto scrollbar-hide">
              {[
                { id: 'bulk', name: 'Bulk Operations', icon: UsersIcon },
                { id: 'config', name: 'System Config', icon: CogIcon },
                { id: 'audit', name: 'Audit Logs', icon: ShieldCheckIcon }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-1 sm:space-x-2 whitespace-nowrap flex-shrink-0 ${activeTab === tab.id
                    ? 'border-[#00806a] text-[#00806a]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.name}</span>
                  <span className="sm:hidden">{tab.name.split(' ')[0]}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          {activeTab === 'bulk' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Bulk Operations</h2>
                <Button
                  onClick={() => setShowBulkModal(true)}
                  className="bg-[#00806a] hover:bg-[#006d5a] text-white w-full sm:w-auto"
                >
                  <UsersIcon className="w-4 h-4 mr-2" />
                  New Bulk Operation
                </Button>
              </div>

              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00806a] mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading bulk operations...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {bulkOperations.map((operation) => (
                    <Card key={operation.id} className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            <UsersIcon className="w-8 h-8 text-[#00806a]" />
                          </div>
                          <div>
                            <h3 className="text-lg font-medium text-gray-900">
                              {getActionLabel(operation.type)}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {operation.totalItems} items • {operation.processedItems} processed • {operation.failedItems} failed
                            </p>
                            <p className="text-xs text-gray-400">
                              Started: {formatDate(operation.createdAt)}
                              {operation.completedAt && ` • Completed: ${formatDate(operation.completedAt)}`}
                            </p>
                          </div>
                        </div>

                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(operation.status)}`}>
                          {getStatusIcon(operation.status)}
                          <span className="ml-1 capitalize">{operation.status}</span>
                        </span>
                      </div>

                      {operation.status === 'processing' && (
                        <div className="mt-4">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-[#00806a] h-2 rounded-full transition-all duration-300"
                              style={{ width: `${(operation.processedItems / operation.totalItems) * 100}%` }}
                            ></div>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            Progress: {operation.processedItems} / {operation.totalItems}
                          </p>
                        </div>
                      )}
                    </Card>
                  ))}

                  {bulkOperations.length === 0 && (
                    <Card className="p-12 text-center">
                      <UsersIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No bulk operations yet</h3>
                      <p className="text-gray-500 mb-4">Start managing multiple items at once with bulk operations.</p>
                      <Button
                        onClick={() => setShowBulkModal(true)}
                        className="bg-[#00806a] hover:bg-[#006d5a] text-white"
                      >
                        <UsersIcon className="w-4 h-4 mr-2" />
                        Start First Operation
                      </Button>
                    </Card>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'config' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">System Configuration</h2>
                <Button
                  onClick={() => setShowConfigModal(true)}
                  variant="outline"
                  className="text-[#00806a] border-[#00806a] hover:bg-[#00806a] hover:text-white"
                >
                  <CogIcon className="w-4 h-4 mr-2" />
                  Edit Configuration
                </Button>
              </div>

              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00806a] mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading system configuration...</p>
                </div>
              ) : systemConfig ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Application Settings</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">App Name</span>
                        <span className="text-sm font-medium text-gray-900">{systemConfig.app.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Version</span>
                        <span className="text-sm font-medium text-gray-900">{systemConfig.app.version}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Environment</span>
                        <span className="text-sm font-medium text-gray-900">{systemConfig.app.environment}</span>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Feature Flags</h3>
                    <div className="space-y-3">
                      {Object.entries(systemConfig.features).map(([key, value]) => (
                        <div key={key} className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">
                            {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                            {value ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card className="p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">System Limits</h3>
                    <div className="space-y-3">
                      {Object.entries(systemConfig.limits).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-sm text-gray-600">
                            {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                          </span>
                          <span className="text-sm font-medium text-gray-900">{value}</span>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card className="p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Integrations</h3>
                    <div className="space-y-3">
                      {Object.entries(systemConfig.integrations).map(([key, value]) => (
                        <div key={key} className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">
                            {key.charAt(0).toUpperCase() + key.slice(1)}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                            {typeof value === 'boolean' ? (value ? 'Connected' : 'Disconnected') : value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              ) : (
                <Card className="p-12 text-center">
                  <CogIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Configuration not loaded</h3>
                  <p className="text-gray-500">Unable to load system configuration.</p>
                </Card>
              )}
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">Audit Logs</h2>
                <Button
                  onClick={fetchAuditLogs}
                  variant="outline"
                  className="text-[#00806a] border-[#00806a] hover:bg-[#00806a] hover:text-white"
                >
                  <EyeIcon className="w-4 h-4 mr-2" />
                  Refresh Logs
                </Button>
              </div>

              {/* Audit Filters */}
              <Card className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
                    <select
                      value={auditFilters.action}
                      onChange={(e) => setAuditFilters(prev => ({ ...prev, action: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a] focus:border-[#00806a]"
                    >
                      <option value="">All Actions</option>
                      <option value="user_role_updated">User Role Updated</option>
                      <option value="venue_created">Venue Created</option>
                      <option value="bulk_user_update">Bulk User Update</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Resource Type</label>
                    <select
                      value={auditFilters.resourceType}
                      onChange={(e) => setAuditFilters(prev => ({ ...prev, resourceType: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a] focus:border-[#00806a]"
                    >
                      <option value="">All Types</option>
                      <option value="user">User</option>
                      <option value="venue">Venue</option>
                      <option value="booking">Booking</option>
                      <option value="activity">Activity</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
                    <input
                      type="text"
                      placeholder="Filter by user..."
                      value={auditFilters.userId}
                      onChange={(e) => setAuditFilters(prev => ({ ...prev, userId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a] focus:border-[#00806a]"
                    />
                  </div>

                  <div className="flex items-end">
                    <Button
                      onClick={() => setAuditFilters({ action: '', resourceType: '', userId: '', dateFrom: '', dateTo: '' })}
                      variant="outline"
                      className="w-full"
                    >
                      Clear Filters
                    </Button>
                  </div>
                </div>
              </Card>

              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00806a] mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading audit logs...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {auditLogs.map((log) => (
                    <Card key={log.id} className="p-6">
                      <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0 mt-1">
                          {getResourceTypeIcon(log.resourceType)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="text-lg font-medium text-gray-900">
                                {getActionLabel(log.action)}
                              </h3>
                              <p className="text-sm text-gray-600 mt-1">{log.details}</p>

                              <div className="flex items-center space-x-4 mt-3 text-xs text-gray-500">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  {log.resourceType ? (log.resourceType.charAt(0).toUpperCase() + log.resourceType.slice(1)) : 'Unknown'}
                                </span>
                                <span>ID: {log.resourceId}</span>
                                <span>IP: {log.ipAddress}</span>
                                <span>{formatDate(log.timestamp)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}

                  {auditLogs.length === 0 && (
                    <Card className="p-12 text-center">
                      <ShieldCheckIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No audit logs found</h3>
                      <p className="text-gray-500">No audit logs match your current filters.</p>
                    </Card>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bulk Operation Modal */}
        {showBulkModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-2/3 max-w-2xl shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">New Bulk Operation</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Operation Type</label>
                    <select
                      value={bulkFormData.type}
                      onChange={(e) => setBulkFormData(prev => ({ ...prev, type: e.target.value as any }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a] focus:border-[#00806a]"
                    >
                      <option value="user_update">User Update</option>
                      <option value="venue_update">Venue Update</option>
                      <option value="booking_update">Booking Update</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Target IDs (comma-separated)</label>
                    <textarea
                      rows={3}
                      value={bulkFormData.targetIds}
                      onChange={(e) => setBulkFormData(prev => ({ ...prev, targetIds: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a] focus:border-[#00806a]"
                      placeholder="Enter IDs separated by commas (e.g., user1, user2, user3)"
                    />
                  </div>

                  {bulkFormData.type === 'user_update' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                        <select
                          value={bulkFormData.updates.role}
                          onChange={(e) => setBulkFormData(prev => ({
                            ...prev,
                            updates: { ...prev.updates, role: e.target.value }
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a] focus:border-[#00806a]"
                        >
                          <option value="">No change</option>
                          <option value="user">User</option>
                          <option value="venue_owner">Venue Owner</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <select
                          value={bulkFormData.updates.isActive}
                          onChange={(e) => setBulkFormData(prev => ({
                            ...prev,
                            updates: { ...prev.updates, isActive: e.target.value }
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a] focus:border-[#00806a]"
                        >
                          <option value="">No change</option>
                          <option value="true">Active</option>
                          <option value="false">Inactive</option>
                        </select>
                      </div>
                    </div>
                  )}

                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                    <div className="flex">
                      <ExclamationTriangleIcon className="w-5 h-5 text-yellow-400" />
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-yellow-800">Warning</h3>
                        <p className="text-sm text-yellow-700 mt-1">
                          Bulk operations affect multiple items and cannot be easily undone. Please review your changes carefully.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                  <Button
                    onClick={() => setShowBulkModal(false)}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleBulkOperation}
                    className="bg-[#00806a] hover:bg-[#006d5a] text-white"
                    disabled={!bulkFormData.targetIds.trim()}
                  >
                    <UsersIcon className="w-4 h-4 mr-2" />
                    Start Operation
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* System Config Modal */}
        {showConfigModal && editingConfig && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-4/5 max-w-4xl shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Edit System Configuration</h3>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Application Settings</h4>
                    <div>
                      <label htmlFor="config-app-name" className="block text-sm font-medium text-gray-700 mb-1">App Name</label>
                      <input
                        type="text"
                        id="config-app-name"
                        value={editingConfig.app.name}
                        placeholder="App Name"
                        onChange={(e) => setEditingConfig(prev => prev ? {
                          ...prev,
                          app: { ...prev.app, name: e.target.value }
                        } : null)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a] focus:border-[#00806a]"
                      />
                    </div>

                    <div>
                      <label htmlFor="config-app-version" className="block text-sm font-medium text-gray-700 mb-1">Version</label>
                      <input
                        type="text"
                        id="config-app-version"
                        value={editingConfig.app.version}
                        placeholder="1.0.0"
                        onChange={(e) => setEditingConfig(prev => prev ? {
                          ...prev,
                          app: { ...prev.app, version: e.target.value }
                        } : null)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00806a] focus:border-[#00806a]"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Feature Flags</h4>
                    {Object.entries(editingConfig.features).map(([key, value]) => (
                      <label key={key} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={(e) => setEditingConfig(prev => prev ? {
                            ...prev,
                            features: { ...prev.features, [key]: e.target.checked }
                          } : null)}
                          className="h-4 w-4 text-[#00806a] focus:ring-[#00806a] border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-900">
                          {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                  <Button
                    onClick={() => setShowConfigModal(false)}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleConfigSave}
                    className="bg-[#00806a] hover:bg-[#006d5a] text-white"
                  >
                    <CogIcon className="w-4 h-4 mr-2" />
                    Save Configuration
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdvancedAdminTools;
