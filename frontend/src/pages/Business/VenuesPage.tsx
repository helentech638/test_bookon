import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import BusinessLayout from '../../components/layout/BusinessLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
  BuildingOfficeIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  PhoneIcon,
  EnvelopeIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import authService from '../../services/authService';
import { buildApiUrl } from '../../config/api';

interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  postcode: string;
  phone?: string;
  email?: string;
  capacity: number;
  facilities?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const VenuesPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (user?.id) {
      fetchVenues();
    }
  }, [user?.id]);

  const fetchVenues = async () => {
    try {
      if (!user?.id) return;

      setLoading(true);
      const token = authService.getToken();
      if (!token) {
        navigate('/login');
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      const response = await fetch(buildApiUrl(`/venues?ownerId=${user.id}`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error('Failed to fetch venues');
      }

      const data = await response.json();
      if (data.success) {
        // Transform API data to match our interface
        const transformedVenues: Venue[] = (data.data || []).map((venue: any) => ({
          id: venue.id,
          name: venue.name,
          address: venue.address || '',
          city: venue.city || '',
          postcode: venue.postcode || '',
          phone: venue.phone,
          email: venue.email,
          capacity: venue.capacity || 0,
          facilities: venue.facilities || [],
          isActive: venue.isActive !== undefined ? venue.isActive : true,
          createdAt: venue.createdAt,
          updatedAt: venue.updatedAt
        }));
        setVenues(transformedVenues);
      } else {
        throw new Error(data.message || 'Failed to fetch venues');
      }
    } catch (error) {
      console.error('Error fetching venues:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        toast.error('Venues loading timeout - please refresh');
      } else {
        toast.error('Failed to load venues');
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredVenues = venues.filter(venue => {
    const matchesSearch = venue.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      venue.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      venue.city.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && venue.isActive) ||
      (statusFilter === 'inactive' && !venue.isActive);

    return matchesSearch && matchesStatus;
  });

  const handleDeleteVenue = async (venueId: string) => {
    if (window.confirm('Are you sure you want to delete this venue?')) {
      try {
        const token = authService.getToken();
        if (!token) {
          navigate('/login');
          return;
        }

        const response = await fetch(buildApiUrl(`/venues/${venueId}`), {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to delete venue');
        }

        const data = await response.json();
        if (data.success) {
          setVenues(prev => prev.filter(v => v.id !== venueId));
          toast.success('Venue deleted successfully');
        } else {
          throw new Error(data.message || 'Failed to delete venue');
        }
      } catch (error) {
        console.error('Error deleting venue:', error);
        toast.error('Failed to delete venue');
      }
    }
  };

  const handleToggleStatus = async (venueId: string) => {
    try {
      const token = authService.getToken();
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch(buildApiUrl(`/business/venues/${venueId}/toggle`), {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to toggle venue status');
      }

      const data = await response.json();
      if (data.success) {
        const updatedVenue = data.data;
        setVenues(prev => prev.map(v =>
          v.id === venueId ? {
            ...v,
            isActive: updatedVenue.isActive,
            updatedAt: updatedVenue.updatedAt
          } : v
        ));
        toast.success('Venue status updated');
      } else {
        throw new Error(data.message || 'Failed to update venue');
      }
    } catch (error) {
      console.error('Error updating venue:', error);
      toast.error('Failed to update venue');
    }
  };

  if (loading) {
    return (
      <BusinessLayout user={user}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-64 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
      </BusinessLayout>
    );
  }

  return (
    <BusinessLayout user={user}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Venues</h1>
            <p className="text-gray-600 mt-1">Manage your business venues and locations</p>
          </div>
          <Button
            className="flex items-center gap-2"
            onClick={() => navigate('/business/venue-setup')}
          >
            <PlusIcon className="h-5 w-5" />
            Add Venue
          </Button>
        </div>

        {/* Filters */}
        <Card className="p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search venues..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00806a] focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00806a] focus:border-transparent"
                title="Filter by status"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                }}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </Card>

        {/* Venues Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVenues.map((venue) => (
            <Card key={venue.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <BuildingOfficeIcon className="h-8 w-8 text-[#00806a]" />
                  <div>
                    <h3 className="font-semibold text-gray-900">{venue.name}</h3>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${venue.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                        }`}>
                        {venue.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <span className="text-xs text-gray-500">Capacity: {venue.capacity}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-start gap-2">
                  <MapPinIcon className="h-4 w-4 text-gray-400 mt-0.5" />
                  <div className="text-sm text-gray-600">
                    <p>{venue.address}</p>
                    <p>{venue.city}, {venue.postcode}</p>
                  </div>
                </div>

                {venue.phone && (
                  <div className="flex items-center gap-2">
                    <PhoneIcon className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600">{venue.phone}</span>
                  </div>
                )}

                {venue.email && (
                  <div className="flex items-center gap-2">
                    <EnvelopeIcon className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600">{venue.email}</span>
                  </div>
                )}
              </div>

              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Facilities:</p>
                <div className="flex flex-wrap gap-1">
                  {(venue.facilities || []).map((facility, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                    >
                      {facility}
                    </span>
                  ))}
                  {(!venue.facilities || venue.facilities.length === 0) && (
                    <span className="text-sm text-gray-500 italic">No facilities listed</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-xs text-gray-500">
                  Updated {new Date(venue.updatedAt).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-1 text-gray-400 hover:text-gray-600" title="View details">
                    <EyeIcon className="h-4 w-4" />
                  </button>
                  <button className="p-1 text-gray-400 hover:text-blue-600" title="Edit venue">
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteVenue(venue.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                    title="Delete venue"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {filteredVenues.length === 0 && (
          <Card className="p-12 text-center">
            <BuildingOfficeIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No venues found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || statusFilter !== 'all'
                ? 'Try adjusting your search criteria'
                : 'Get started by adding your first venue'
              }
            </p>
            <Button>
              <PlusIcon className="h-5 w-5 mr-2" />
              Add Venue
            </Button>
          </Card>
        )}
      </div>
    </BusinessLayout>
  );
};

export default VenuesPage;
