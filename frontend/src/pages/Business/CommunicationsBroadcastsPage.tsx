import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import BusinessLayout from '../../components/layout/BusinessLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import BroadcastModal from '../../components/Communications/BroadcastModal';
import { 
  MegaphoneIcon, 
  PlusIcon, 
  PencilIcon, 
  TrashIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlayIcon,
  PauseIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import authService from '../../services/authService';
import { buildApiUrl } from '../../config/api';

interface Broadcast {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'push';
  subject?: string;
  content: string;
  recipients: number;
  sentCount: number;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'paused';
  scheduledAt?: string;
  sentAt?: string;
  createdAt: string;
}

const CommunicationsBroadcastsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchBroadcasts();
  }, []);

  const fetchBroadcasts = async () => {
    try {
      setLoading(true);
      const token = authService.getToken();
      if (!token) {
        navigate('/login');
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

      const response = await fetch(buildApiUrl('/business/communications/broadcasts'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error('Failed to fetch broadcasts');
      }

      const data = await response.json();
      if (data.success) {
        // Transform API data to match our interface
        const transformedBroadcasts: Broadcast[] = (data.data.broadcasts || []).map((broadcast: any) => ({
          id: broadcast.id,
          name: broadcast.name || broadcast.subject || 'Untitled Broadcast',
          type: broadcast.type || 'email',
          subject: broadcast.subject,
          content: broadcast.content || '',
          recipients: broadcast.recipients || 0,
          sentCount: broadcast.sentCount || 0,
          status: broadcast.status || 'draft',
          scheduledAt: broadcast.scheduledAt,
          sentAt: broadcast.sentAt,
          createdAt: broadcast.createdAt
        }));
        setBroadcasts(transformedBroadcasts);
      } else {
        throw new Error(data.message || 'Failed to fetch broadcasts');
      }
    } catch (error) {
      console.error('Error fetching broadcasts:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        toast.error('Broadcasts loading timeout - please refresh');
      } else {
        toast.error('Failed to load broadcasts');
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredBroadcasts = broadcasts.filter(broadcast => {
    const matchesSearch = broadcast.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (broadcast.subject || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         broadcast.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || broadcast.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || broadcast.status === statusFilter;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-100 text-green-800';
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'sending':
        return 'bg-yellow-100 text-yellow-800';
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'paused':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircleIcon className="h-4 w-4" />;
      case 'scheduled':
        return <ClockIcon className="h-4 w-4" />;
      case 'sending':
        return <PlayIcon className="h-4 w-4" />;
      case 'draft':
        return <PencilIcon className="h-4 w-4" />;
      case 'failed':
        return <XCircleIcon className="h-4 w-4" />;
      case 'paused':
        return <PauseIcon className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const handleDeleteBroadcast = async (broadcastId: string) => {
    if (window.confirm('Are you sure you want to delete this broadcast?')) {
      try {
        // Mock delete - replace with actual API call
        setBroadcasts(prev => prev.filter(b => b.id !== broadcastId));
        toast.success('Broadcast deleted successfully');
      } catch (error) {
        console.error('Error deleting broadcast:', error);
        toast.error('Failed to delete broadcast');
      }
    }
  };

  const handlePauseBroadcast = async (broadcastId: string) => {
    try {
      // Mock pause - replace with actual API call
      setBroadcasts(prev => prev.map(b => 
        b.id === broadcastId ? { ...b, status: b.status === 'sending' ? 'paused' : 'sending' } : b
      ));
      toast.success('Broadcast status updated');
    } catch (error) {
      console.error('Error updating broadcast:', error);
      toast.error('Failed to update broadcast');
    }
  };

  const handleSaveBroadcast = async (broadcastData: any) => {
    try {
      const token = authService.getToken();
      if (!token) {
        toast.error('Please log in to create broadcast');
        return;
      }

      const response = await fetch(buildApiUrl('/business/communications/broadcasts'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(broadcastData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create broadcast');
      }

      const data = await response.json();
      if (data.success) {
        toast.success('Broadcast created successfully!');
        fetchBroadcasts(); // Refresh the list
      } else {
        throw new Error(data.message || 'Failed to create broadcast');
      }
    } catch (error) {
      console.error('Error creating broadcast:', error);
      toast.error('Failed to create broadcast');
    }
  };

  if (loading) {
    return (
      <BusinessLayout user={user}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-64 mb-6"></div>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
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
      </BusinessLayout>
    );
  }

  return (
    <BusinessLayout user={user}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Broadcasts</h1>
            <p className="text-gray-600 mt-1">Manage your mass communications and campaigns</p>
          </div>
          <Button 
            className="flex items-center gap-2"
            onClick={() => setShowCreateModal(true)}
          >
            <PlusIcon className="h-5 w-5" />
            Create Broadcast
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card className="p-6">
            <div className="flex items-center">
              <MegaphoneIcon className="h-8 w-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Broadcasts</p>
                <p className="text-2xl font-bold text-gray-900">{broadcasts.length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center">
              <CheckCircleIcon className="h-8 w-8 text-green-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Sent</p>
                <p className="text-2xl font-bold text-gray-900">
                  {broadcasts.filter(b => b.status === 'sent').length}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center">
              <ClockIcon className="h-8 w-8 text-yellow-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Scheduled</p>
                <p className="text-2xl font-bold text-gray-900">
                  {broadcasts.filter(b => b.status === 'scheduled').length}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center">
              <PencilIcon className="h-8 w-8 text-gray-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Drafts</p>
                <p className="text-2xl font-bold text-gray-900">
                  {broadcasts.filter(b => b.status === 'draft').length}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search broadcasts..."
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
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="push">Push Notification</option>
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
                <option value="sent">Sent</option>
                <option value="scheduled">Scheduled</option>
                <option value="sending">Sending</option>
                <option value="draft">Draft</option>
                <option value="failed">Failed</option>
                <option value="paused">Paused</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm('');
                  setTypeFilter('all');
                  setStatusFilter('all');
                }}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </Card>

        {/* Broadcasts List */}
        <div className="space-y-4">
          {filteredBroadcasts.map((broadcast) => (
            <Card key={broadcast.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <MegaphoneIcon className="h-6 w-6 text-purple-500" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{broadcast.name}</h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(broadcast.status)}`}>
                          {getStatusIcon(broadcast.status)}
                          <span className="ml-1">{broadcast.status}</span>
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          broadcast.type === 'email' ? 'bg-blue-100 text-blue-800' :
                          broadcast.type === 'sms' ? 'bg-green-100 text-green-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {broadcast.type.toUpperCase()}
                        </span>
                      </div>
                      {broadcast.subject && (
                        <p className="text-sm text-gray-600 mb-1">Subject: {broadcast.subject}</p>
                      )}
                      <p className="text-sm text-gray-600 line-clamp-2">{broadcast.content}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-sm text-gray-500">
                    <span>{broadcast.sentCount} / {broadcast.recipients} sent</span>
                    {broadcast.scheduledAt && (
                      <span>Scheduled for {new Date(broadcast.scheduledAt).toLocaleDateString()}</span>
                    )}
                    {broadcast.sentAt && (
                      <span>Sent {new Date(broadcast.sentAt).toLocaleDateString()}</span>
                    )}
                    <span>Created {new Date(broadcast.createdAt).toLocaleDateString()}</span>
                  </div>

                  {broadcast.recipients > 0 && (
                    <div className="mt-3">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-[#00806a] h-2 rounded-full" 
                          style={{ width: `${(broadcast.sentCount / broadcast.recipients) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button className="p-2 text-gray-400 hover:text-gray-600">
                    <EyeIcon className="h-4 w-4" />
                  </button>
                  <button className="p-2 text-gray-400 hover:text-blue-600">
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  {(broadcast.status === 'sending' || broadcast.status === 'paused') && (
                    <button 
                      onClick={() => handlePauseBroadcast(broadcast.id)}
                      className="p-2 text-gray-400 hover:text-yellow-600"
                    >
                      {broadcast.status === 'sending' ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
                    </button>
                  )}
                  <button 
                    onClick={() => handleDeleteBroadcast(broadcast.id)}
                    className="p-2 text-gray-400 hover:text-red-600"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {filteredBroadcasts.length === 0 && (
          <Card className="p-12 text-center">
            <MegaphoneIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No broadcasts found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || typeFilter !== 'all' || statusFilter !== 'all' 
                ? 'Try adjusting your search criteria'
                : 'Get started by creating your first broadcast'
              }
            </p>
            <Button>
              <PlusIcon className="h-5 w-5 mr-2" />
              Create Broadcast
            </Button>
          </Card>
        )}

        {/* Create Broadcast Modal */}
        <BroadcastModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSave={handleSaveBroadcast}
        />
      </div>
    </BusinessLayout>
  );
};

export default CommunicationsBroadcastsPage;
