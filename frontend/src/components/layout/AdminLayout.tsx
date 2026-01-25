import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ComputerDesktopIcon,
  CalendarDaysIcon,
  MapPinIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  CurrencyPoundIcon,
  BellIcon,
  MegaphoneIcon,
  ChatBubbleLeftRightIcon,
  CogIcon,
  ClockIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  BuildingOfficeIcon,
  CreditCardIcon,
  ExclamationTriangleIcon,
  DocumentDuplicateIcon,
  LinkIcon,
  ChartBarIcon,
  BanknotesIcon,
  TagIcon,
  PlusIcon,
  Bars3Icon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { Button } from '../ui/Button';
import { authService } from '../../services/authService';

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, title }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigationItems = [
    { id: 'dashboard', name: 'Dashboard', icon: ComputerDesktopIcon, path: '/admin' },
    { id: 'templates', name: 'Templates', icon: DocumentDuplicateIcon, path: '/admin/templates' },
    { id: 'courses', name: 'Courses', icon: CalendarDaysIcon, path: '/admin/courses' },
    { id: 'activities', name: 'Activities', icon: CalendarDaysIcon, path: '/admin/activities' },
    { id: 'activity-types', name: 'Activity Types', icon: TagIcon, path: '/admin/activity-types' },
    { id: 'venues', name: 'Venues', icon: MapPinIcon, path: '/admin/venues' },
    { id: 'venue-setup', name: 'Venue Setup', icon: LinkIcon, path: '/admin/venue-setup' },
    { id: 'franchise-fee-settings', name: 'Franchise Fee Settings', icon: BanknotesIcon, path: '/admin/franchise-fee-settings' },
    { id: 'finance-reporting', name: 'Finance Reporting', icon: ChartBarIcon, path: '/admin/finance-reporting' },
    { id: 'bookings', name: 'Bookings', icon: ClipboardDocumentListIcon, path: '/admin/bookings' },
    { id: 'registers', name: 'Registers', icon: DocumentTextIcon, path: '/admin/registers' },
    { id: 'payments', name: 'Payments', icon: CurrencyPoundIcon, path: '/admin/payments' },
    { id: 'tfc-queue', name: 'TFC Queue', icon: ClockIcon, path: '/admin/tfc-queue' },
    { id: 'provider-settings', name: 'Provider Settings', icon: BuildingOfficeIcon, path: '/admin/provider-settings' },
    { id: 'wallet-management', name: 'Wallet Management', icon: CreditCardIcon, path: '/admin/wallet-management' },
    { id: 'notifications', name: 'Notifications', icon: BellIcon, path: '/admin/notifications' },
    { id: 'webhooks', name: 'Webhooks', icon: MegaphoneIcon, path: '/admin/webhooks' },
    { id: 'bank-feed', name: 'Bank Feed', icon: BanknotesIcon, path: '/admin/bank-feed' },
    { id: 'widget', name: 'Widget Management', icon: ComputerDesktopIcon, path: '/admin/widget' },
    { id: 'communications', name: 'Communications', icon: ChatBubbleLeftRightIcon, path: '/admin/communications' },
    { id: 'finance', name: 'Finance', icon: CurrencyPoundIcon, path: '/admin/finance' },
    { id: 'master-reports', name: 'Master Reports', icon: ChartBarIcon, path: '/admin/master-reports' },
    { id: 'create-activity', name: 'Create Activity', icon: PlusIcon, path: '/admin/create-activity' },
    { id: 'register-management', name: 'Register Management', icon: ClipboardDocumentListIcon, path: '/admin/register-management' },
    { id: 'tfc-pending-queue', name: 'TFC Pending Queue', icon: ClockIcon, path: '/admin/tfc-pending-queue' },
    { id: 'audit-logs', name: 'Audit Logs', icon: ShieldCheckIcon, path: '/admin/audit-logs' },
    { id: 'data-retention', name: 'Data Retention', icon: ExclamationTriangleIcon, path: '/admin/data-retention' },
    { id: 'settings', name: 'System Settings', icon: CogIcon, path: '/admin/settings' },
  ];

  const handleLogout = async () => {
    try {
      await authService.logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      navigate('/login');
    }
  };

  const isActiveRoute = (path: string) => {
    return location.pathname === path;
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 via-white to-green-50">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Premium Side Panel */}
      <div className={`fixed inset-y-0 left-0 z-50 w-80 sm:w-72 bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white flex flex-col shadow-2xl border-r border-gray-700/50 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Premium Logo and Header */}
        <div className="p-6 border-b border-gray-700/50 flex-shrink-0 bg-gradient-to-r from-gray-800 to-gray-900">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-lg">B</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">BookOn</h2>
              <p className="text-xs text-gray-400 font-medium">Admin Panel</p>
            </div>
          </div>
        </div>

        {/* Premium Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 custom-scrollbar">
          <div className="px-3 sm:px-4 space-y-1 sm:space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = isActiveRoute(item.path);
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    navigate(item.path);
                    setSidebarOpen(false); // Close sidebar on mobile after navigation
                  }}
                  className={`group w-full flex items-center px-3 sm:px-4 py-2.5 sm:py-3 text-sm font-medium rounded-xl transition-all duration-300 touch-manipulation ${
                    isActive
                      ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-500/25 transform scale-105'
                      : 'text-gray-300 hover:bg-gray-700/50 hover:text-white hover:shadow-md hover:transform hover:scale-102'
                  }`}
                >
                  <div className={`mr-3 sm:mr-4 h-5 w-5 flex-shrink-0 transition-colors ${
                    isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="truncate font-medium text-sm sm:text-sm">{item.name}</span>
                  {isActive && (
                    <div className="ml-auto w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Premium Logout Button */}
        <div className="p-3 sm:p-4 border-t border-gray-700/50 flex-shrink-0 bg-gradient-to-r from-gray-800 to-gray-900">
          <Button
            onClick={handleLogout}
            className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-medium py-2.5 sm:py-3 rounded-xl shadow-lg hover:shadow-red-500/25 transition-all duration-300 hover:transform hover:scale-105 border-0 touch-manipulation"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </Button>
        </div>
      </div>

      {/* Premium Main Content */}
      <div className="flex-1 overflow-y-auto bg-gradient-to-br from-gray-50 via-white to-green-50 custom-scrollbar-light">
        <div className="bg-white/80 backdrop-blur-sm min-h-full shadow-inner">
          {/* Mobile Header */}
          <div className="lg:hidden bg-white border-b border-gray-200 px-3 sm:px-4 py-3 flex items-center justify-between sticky top-0 z-30">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green-500 touch-manipulation"
            >
              <Bars3Icon className="h-6 w-6" />
            </button>
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-lg flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-xs sm:text-sm">B</span>
              </div>
              <span className="text-base sm:text-lg font-semibold text-gray-900">BookOn Admin</span>
            </div>
            <div className="w-10"></div> {/* Spacer for centering */}
          </div>

          <div className="p-3 sm:p-4 lg:p-8">
            <div className="mb-4 sm:mb-6 lg:mb-8">
              <h1 className="text-xl sm:text-2xl lg:text-4xl font-bold bg-gradient-to-r from-gray-900 via-green-600 to-gray-900 bg-clip-text text-transparent mb-2">
                {title}
              </h1>
              <div className="w-12 sm:w-16 lg:w-24 h-1 bg-gradient-to-r from-green-500 to-green-600 rounded-full"></div>
            </div>
            <div className="bg-white/90 backdrop-blur-sm rounded-lg sm:rounded-xl lg:rounded-2xl shadow-xl border border-gray-100/50 p-3 sm:p-4 lg:p-6 overflow-hidden">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
