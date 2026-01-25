import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  PencilIcon,
  TrashIcon,
  ArchiveBoxIcon,
  EyeIcon,
  CalendarDaysIcon,
  MapPinIcon,
  ClockIcon,
  UserGroupIcon,
  CurrencyPoundIcon,
  ChevronDownIcon,
  XMarkIcon,
  PlayIcon,
  PauseIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import toast from 'react-hot-toast';
import { authService } from '../../services/authService';
import { buildApiUrl } from '../../config/api';
import AdminLayout from '../../components/layout/AdminLayout';
import { formatPrice, formatInteger } from '../../utils/formatting';
import { calendarService } from '../../services/calendarService';

interface Course {
  id: string;
  templateId?: string;
  venueId: string;
  name: string;
  type: string;
  years: string;
  price: number;
  capacity: number;
  startDate: string;
  endDate: string;
  weekday?: string;
  time?: string;
  extras?: {
    early_dropoff: boolean;
    late_pickup: boolean;
  };
  status: string;
  createdAt: string;
  updatedAt: string;
  template?: {
    name: string;
    type: string;
    years: string;
  };
  venue: {
    name: string;
    address: string;
    city: string;
  };
  creator: {
    firstName: string;
    lastName: string;
  };
}

const CoursesPage: React.FC = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterYears, setFilterYears] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterVenue, setFilterVenue] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSessionsModal, setShowSessionsModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      navigate('/login');
      return;
    }

    if (!authService.hasRole('admin')) {
      navigate('/dashboard');
      return;
    }

    fetchCourses();
  }, [navigate]);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const startTime = performance.now();
      const token = authService.getToken();
      if (!token) return;

      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterType !== 'all') params.append('type', filterType);
      if (filterYears !== 'all') params.append('years', filterYears);
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (filterVenue !== 'all') params.append('venueId', filterVenue);

      const response = await fetch(buildApiUrl(`/courses?${params.toString()}`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Validate and sanitize course data
        const validatedCourses = Array.isArray(data.data) ? data.data.map((course: any) => ({
          ...course,
          price: typeof course.price === 'string' ? parseFloat(course.price) || 0 : course.price || 0,
          capacity: typeof course.capacity === 'string' ? parseInt(course.capacity) || 0 : course.capacity || 0,
        })) : [];
        setCourses(validatedCourses);
        
        const endTime = performance.now();
        const loadTime = endTime - startTime;
        console.log(`Courses loaded in ${loadTime.toFixed(2)}ms`);
      } else {
        throw new Error('Failed to fetch courses');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch courses');
      console.error('Courses fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchCourses();
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchTerm, filterType, filterYears, filterStatus, filterVenue]);

  const handlePublishCourse = async (courseId: string) => {
    try {
      const token = authService.getToken();
      if (!token) return;

      const response = await fetch(buildApiUrl(`/courses/${courseId}/publish`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessions: [] // TODO: Generate sessions from course schedule
        })
      });

      if (response.ok) {
        toast.success('Course published successfully');
        fetchCourses();
      } else {
        throw new Error('Failed to publish course');
      }
    } catch (error) {
      console.error('Publish course error:', error);
      toast.error('Failed to publish course');
    }
  };

  const handleArchiveCourse = async (courseId: string) => {
    try {
      const token = authService.getToken();
      if (!token) return;

      const response = await fetch(buildApiUrl(`/courses/${courseId}/archive`), {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        toast.success('Course archived successfully');
        fetchCourses();
      } else {
        throw new Error('Failed to archive course');
      }
    } catch (error) {
      console.error('Archive course error:', error);
      toast.error('Failed to archive course');
    }
  };

  const handleDeleteCourse = async () => {
    if (!courseToDelete) return;

    try {
      const token = authService.getToken();
      if (!token) return;

      const response = await fetch(buildApiUrl(`/courses/${courseToDelete.id}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        toast.success('Course deleted successfully');
        fetchCourses();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete course');
      }
    } catch (error) {
      console.error('Delete course error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete course');
    } finally {
      setShowDeleteConfirm(false);
      setCourseToDelete(null);
    }
  };

  const handleExportCourseToCalendar = (course: Course) => {
    try {
      const event = {
        id: course.id,
        title: course.name,
        description: '',
        startDate: new Date(course.startDate),
        endDate: new Date(course.endDate),
        location: course.venue?.name || '',
        url: window.location.origin
      };
      
      // Use the calendar service to download the iCal file
      const iCalContent = calendarService.generateICalContent(event);
      const blob = new Blob([iCalContent], { type: 'text/calendar' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${course.name.toLowerCase().replace(/\s+/g, '-')}-schedule.ics`;
      link.click();
      URL.revokeObjectURL(url);
      
      toast.success('Course schedule exported to calendar');
    } catch (err) {
      toast.error('Failed to export course to calendar');
      console.error('Error exporting course to calendar:', err);
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'after_school': return 'After-School';
      case 'breakfast': return 'Breakfast';
      case 'holiday': return 'Holiday Club';
      case 'other': return 'Other';
      default: return type;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Draft
          </span>
        );
      case 'published':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <PlayIcon className="h-3 w-3 mr-1" />
            Published
          </span>
        );
      case 'archived':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <ArchiveBoxIcon className="h-3 w-3 mr-1" />
            Archived
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  const CourseCard = ({ course }: { course: Course }) => (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{course.name}</h3>
            <div className="flex items-center space-x-2 mb-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                {getTypeLabel(course.type)}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {course.years}
              </span>
              {getStatusBadge(course.status)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center text-sm text-gray-600">
            <CurrencyPoundIcon className="h-4 w-4 mr-2 text-gray-400" />
            <span>{formatPrice(course.price)} per session</span>
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <UserGroupIcon className="h-4 w-4 mr-2 text-gray-400" />
            <span>{formatInteger(course.capacity)} capacity</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center text-sm text-gray-600">
            <MapPinIcon className="h-4 w-4 mr-2 text-gray-400" />
            <span>{course.venue.name}</span>
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <CalendarDaysIcon className="h-4 w-4 mr-2 text-gray-400" />
            <span>{new Date(course.startDate).toLocaleDateString('en-GB')} - {new Date(course.endDate).toLocaleDateString('en-GB')}</span>
          </div>
        </div>

        {course.time && (
          <div className="flex items-center text-sm text-gray-600 mb-4">
            <ClockIcon className="h-4 w-4 mr-2 text-gray-400" />
            <span>{course.time}</span>
          </div>
        )}

        {course.template && (
          <div className="mb-4 p-2 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Created from template:</p>
            <p className="text-sm font-medium text-gray-700">{course.template.name}</p>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex flex-wrap gap-2 justify-between items-center">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedCourse(course);
                  setShowSessionsModal(true);
                }}
              >
                <EyeIcon className="h-4 w-4 mr-1" />
                Sessions
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportCourseToCalendar(course)}
              >
                <CalendarIcon className="h-4 w-4 mr-1" />
                Calendar
              </Button>
              {course.status === 'draft' && (
                <Button
                  size="sm"
                  onClick={() => handlePublishCourse(course.id)}
                >
                  <PlayIcon className="h-4 w-4 mr-1" />
                  Publish
                </Button>
              )}
            </div>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedCourse(course);
                  setShowEditModal(true);
                }}
                className="px-2"
              >
                <PencilIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleArchiveCourse(course.id)}
                className="px-2"
              >
                <ArchiveBoxIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCourseToDelete(course);
                  setShowDeleteConfirm(true);
                }}
                className="px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <AdminLayout title="Courses">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading courses...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Courses">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Courses</h1>
            <p className="text-gray-600">Manage courses created from templates or manually</p>
          </div>
          <div className="mt-4 sm:mt-0">
            <Button onClick={() => setShowCreateModal(true)}>
              <PlusIcon className="h-4 w-4 mr-2" />
              New Course
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search courses..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              {/* Filters */}
              <div className="flex items-center space-x-4">
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center"
                >
                  <FunnelIcon className="h-4 w-4 mr-2" />
                  Filters
                  <ChevronDownIcon className={`h-4 w-4 ml-2 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                </Button>
              </div>
            </div>

            {/* Filter Options */}
            {showFilters && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    >
                      <option value="all">All Types</option>
                      <option value="after_school">After-School</option>
                      <option value="breakfast">Breakfast</option>
                      <option value="holiday">Holiday Club</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Year Group</label>
                    <select
                      value={filterYears}
                      onChange={(e) => setFilterYears(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    >
                      <option value="all">All Years</option>
                      <option value="Y1-Y2">Y1-Y2</option>
                      <option value="Y3-Y4">Y3-Y4</option>
                      <option value="Y5-Y6">Y5-Y6</option>
                      <option value="Y7+">Y7+</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    >
                      <option value="all">All Status</option>
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
                    <select
                      value={filterVenue}
                      onChange={(e) => setFilterVenue(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    >
                      <option value="all">All Venues</option>
                      {/* TODO: Add venue options */}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Courses Grid */}
        {courses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <CalendarDaysIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No courses found</h3>
              <p className="text-gray-600 mb-6">
                {searchTerm || filterType !== 'all' || filterYears !== 'all' || filterStatus !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Get started by creating your first course'
                }
              </p>
              <div className="flex justify-center space-x-4">
                <Button onClick={() => setShowCreateModal(true)}>
                  <PlusIcon className="h-4 w-4 mr-2" />
                  New Course
                </Button>
                <Button variant="outline" onClick={() => navigate('/admin/templates')}>
                  <CalendarDaysIcon className="h-4 w-4 mr-2" />
                  Browse Templates
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && courseToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Delete Course</h2>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete "{courseToDelete.name}"? This action cannot be undone.
              </p>
              <div className="flex space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDeleteCourse}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default CoursesPage;
