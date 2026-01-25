import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import BusinessLayout from '../../components/layout/BusinessLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { 
  ClipboardDocumentListIcon, 
  PlusIcon, 
  PencilIcon, 
  TrashIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  ClockIcon,
  MapPinIcon
} from '@heroicons/react/24/outline';
import GeneralCreateRegisterModal from '../../components/registers/GeneralCreateRegisterModal';
import toast from 'react-hot-toast';
import authService from '../../services/authService';
import { buildApiUrl } from '../../config/api';

interface Register {
  id: string;
  activityName: string;
  venueName: string;
  date: string;
  time: string;
  instructor: string;
  totalCapacity: number;
  registeredCount: number;
  status: 'upcoming' | 'in-progress' | 'completed' | 'cancelled';
  createdAt: string;
}

const RegistersPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [registers, setRegisters] = useState<Register[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchRegisters();
  }, []);

  const fetchRegisters = async () => {
    try {
      setLoading(true);
      const token = authService.getToken();
      if (!token) {
        toast.error('Please log in to view registers');
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(buildApiUrl('/business/registers'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error('Failed to fetch registers');
      }

      const data = await response.json();
      if (data.success) {
        // Transform API data to match our interface
        const transformedRegisters: Register[] = (data.data.registers || []).map((register: any) => ({
          id: register.id,
          activityName: register.session?.activity?.title || 'Unknown Activity',
          venueName: register.session?.activity?.venue?.name || 'Unknown Venue',
          date: register.session?.date || register.createdAt,
          time: register.session?.startTime || 'Unknown Time',
          instructor: register.session?.activity?.type || 'N/A',
          totalCapacity: register.totalCapacity || 0, // Use transformed value from backend
          registeredCount: register.registeredCount || 0, // Use transformed value from backend
          status: register.status || 'upcoming',
          createdAt: register.createdAt
        }));
        
        setRegisters(transformedRegisters);
      } else {
        throw new Error(data.message || 'Failed to fetch registers');
      }
    } catch (error) {
      console.error('Error fetching registers:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        toast.error('Registers loading timeout - please refresh');
      } else {
        toast.error('Failed to load registers');
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredRegisters = registers.filter(register => {
    const matchesSearch = register.activityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         register.venueName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         register.instructor.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || register.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming':
        return 'bg-[#00806a]/10 text-[#00806a] border border-[#00806a]/30';
      case 'in-progress':
        return 'bg-emerald-100 text-emerald-700 border border-emerald-300';
      case 'completed':
        return 'bg-gray-100 text-gray-700 border border-gray-300';
      case 'cancelled':
        return 'bg-red-100 text-red-700 border border-red-300';
      default:
        return 'bg-gray-100 text-gray-700 border border-gray-300';
    }
  };

  const handleRegisterCreated = () => {
    // Refresh the registers list
    fetchRegisters();
  };

  const handleViewRegister = (registerId: string) => {
    navigate(`/business/registers/${registerId}`);
  };

  const handleEditRegister = (registerId: string) => {
    navigate(`/business/registers/${registerId}/edit`);
  };

  const handleDeleteRegister = async (registerId: string) => {
    if (window.confirm('Are you sure you want to delete this register?')) {
      try {
        const token = authService.getToken();
        if (!token) {
          toast.error('Please log in to delete register');
          return;
        }

        const response = await fetch(buildApiUrl(`/business/registers/${registerId}`), {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          setRegisters(prev => prev.filter(r => r.id !== registerId));
          toast.success('Register deleted successfully');
        } else {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to delete register');
        }
      } catch (error) {
        console.error('Error deleting register:', error);
        toast.error('Failed to delete register');
      }
    }
  };

  if (loading) {
    return (
      <BusinessLayout user={user}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="animate-pulse">
            {/* Header Skeleton */}
            <div className="mb-6">
              <div className="h-8 bg-gray-200 rounded-lg w-64 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-96"></div>
            </div>
            
            {/* Stats Skeleton */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white rounded-lg p-6 border border-gray-200">
                  <div className="h-12 bg-gray-200 rounded-lg mb-3"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              ))}
            </div>
            
            {/* Filters Skeleton */}
            <div className="bg-white p-6 rounded-lg mb-6 border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="h-12 bg-gray-200 rounded-lg"></div>
                <div className="h-12 bg-gray-200 rounded-lg"></div>
                <div className="h-12 bg-gray-200 rounded-lg"></div>
              </div>
            </div>
            
            {/* Square Cards Skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                  <div className="h-12 w-12 bg-gray-200 rounded-lg mb-3"></div>
                  <div className="h-5 bg-gray-200 rounded w-3/4 mb-3"></div>
                  <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3 mb-4"></div>
                  <div className="h-2 bg-gray-200 rounded-full w-full"></div>
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#00806a]">Registers</h1>
            <p className="text-gray-600 mt-1">Manage activity registers and attendance</p>
          </div>
          <Button 
            className="flex items-center gap-2 bg-[#00806a] hover:bg-[#006d5a] text-white"
            onClick={() => setShowCreateModal(true)}
          >
            <PlusIcon className="h-5 w-5" />
            <span className="hidden sm:inline">Create Register</span>
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <Card className="p-4 sm:p-6 bg-gradient-to-br from-[#00806a]/5 to-white border border-[#00806a]/20">
            <div className="flex items-center">
              <div className="bg-[#00806a] rounded-lg p-2">
                <CalendarDaysIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-3">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Total Registers</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{registers.length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 sm:p-6 bg-gradient-to-br from-blue-50 to-white border border-blue-200">
            <div className="flex items-center">
              <div className="bg-blue-500 rounded-lg p-2">
                <ClockIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-3">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Upcoming</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">
                  {registers.filter(r => r.status === 'upcoming').length}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4 sm:p-6 bg-gradient-to-br from-green-50 to-white border border-green-200">
            <div className="flex items-center">
              <div className="bg-green-500 rounded-lg p-2">
                <UserGroupIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-3">
                <p className="text-xs sm:text-sm font-medium text-gray-600">In Progress</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">
                  {registers.filter(r => r.status === 'in-progress').length}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4 sm:p-6 bg-gradient-to-br from-slate-50 to-white border border-slate-200">
            <div className="flex items-center">
              <div className="bg-slate-500 rounded-lg p-2">
                <ClipboardDocumentListIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-3">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Completed</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">
                  {registers.filter(r => r.status === 'completed').length}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4 sm:p-6 mb-6 bg-white border border-gray-200 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search registers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00806a] focus:border-transparent bg-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00806a] focus:border-transparent bg-white"
              >
                <option value="all">All Status</option>
                <option value="upcoming">Upcoming</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                }}
                className="w-full border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </Card>

        {/* Registers List - Square Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredRegisters.map((register) => (
            <Card 
              key={register.id} 
              className="p-6 hover:shadow-lg transition-all duration-300 border border-gray-200 hover:border-[#00806a]/30 group"
            >
              {/* Icon and Title */}
              <div className="mb-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="bg-[#00806a] rounded-lg p-2 group-hover:scale-110 transition-transform">
                    <ClipboardDocumentListIcon className="h-6 w-6 text-white" />
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(register.status)}`}>
                    {register.status.replace('-', ' ')}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2">{register.activityName}</h3>
              </div>

              {/* Details */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPinIcon className="h-4 w-4 text-[#00806a]" />
                  <span className="truncate">{register.venueName}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <UserGroupIcon className="h-4 w-4 text-[#00806a]" />
                  <span className="truncate">{register.instructor}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CalendarDaysIcon className="h-4 w-4 text-[#00806a]" />
                  <span>{new Date(register.date).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <ClockIcon className="h-4 w-4 text-[#00806a]" />
                  <span>{register.time}</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-[#00806a]">
                    {register.registeredCount} / {register.totalCapacity} registered
                  </span>
                  <span className="text-gray-500">{Math.round((register.registeredCount / register.totalCapacity) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-[#00806a] h-full rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min((register.registeredCount / register.totalCapacity) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Created Date */}
              <div className="text-xs text-gray-500 mb-4 pb-4 border-b border-gray-200">
                Created {new Date(register.createdAt).toLocaleDateString()}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-center gap-2 pt-2">
                <button 
                  onClick={() => handleViewRegister(register.id)}
                  className="flex-1 py-2 px-3 bg-[#00806a]/10 text-[#00806a] rounded-lg hover:bg-[#00806a] hover:text-white transition-all font-medium text-sm"
                >
                  <EyeIcon className="h-4 w-4 inline mr-1" />
                  View
                </button>
                <button 
                  onClick={() => handleEditRegister(register.id)}
                  className="p-2 text-gray-600 hover:text-[#00806a] transition-colors"
                  title="Edit"
                >
                  <PencilIcon className="h-5 w-5" />
                </button>
                <button 
                  onClick={() => handleDeleteRegister(register.id)}
                  className="p-2 text-gray-600 hover:text-red-600 transition-colors"
                  title="Delete"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>
            </Card>
          ))}
        </div>

        {filteredRegisters.length === 0 && (
          <Card className="p-8 sm:p-12 text-center bg-white border-2 border-dashed border-gray-300">
            <div className="bg-[#00806a]/10 rounded-full p-4 w-fit mx-auto mb-6">
              <ClipboardDocumentListIcon className="h-12 w-12 text-[#00806a]" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">No registers found</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search criteria or filters'
                : 'Get started by creating your first activity register'
              }
            </p>
              <Button
                onClick={() => setShowCreateModal(true)}
                className="bg-[#00806a] hover:bg-[#006d5a] text-white"
              >
              <PlusIcon className="h-5 w-5 mr-2" />
              Create Register
            </Button>
          </Card>
        )}

        {/* Create Register Modal */}
        <GeneralCreateRegisterModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onRegisterCreated={handleRegisterCreated}
        />
      </div>
    </BusinessLayout>
  );
};

export default RegistersPage;
