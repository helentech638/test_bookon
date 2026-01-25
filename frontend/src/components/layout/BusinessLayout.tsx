import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';
import { 
  HomeIcon,
  CalendarDaysIcon,
  DocumentDuplicateIcon,
  BuildingOfficeIcon,
  CurrencyPoundIcon,
  ChatBubbleLeftRightIcon,
  UsersIcon,
  CogIcon,
  BellIcon,
  Bars3Icon,
  XMarkIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  CreditCardIcon,
  EnvelopeIcon,
  MegaphoneIcon,
  DocumentTextIcon,
  BanknotesIcon,
  ArrowTrendingUpIcon,
  UserGroupIcon,
  PlusIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  Squares2X2Icon,
  BuildingStorefrontIcon,
  UserCircleIcon,
  ClipboardDocumentCheckIcon,
  WrenchScrewdriverIcon,
  ComputerDesktopIcon,
  SpeakerWaveIcon
} from '@heroicons/react/24/outline';
import { Button } from '../ui/Button';
import Footer from './Footer';

interface BusinessLayoutProps {
  children: React.ReactNode;
  user?: any; // Keep for backward compatibility, but will use AuthContext
  onLogout?: () => void;
}

const BusinessLayout: React.FC<BusinessLayoutProps> = ({ children, user: propUser, onLogout }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['operations']));
  const location = useLocation();
  const navigate = useNavigate();
  const { user: contextUser, isLoading } = useAuth();
  const { notificationCount } = useNotifications();

  // Use prop user if provided, otherwise use context user
  const user = propUser || contextUser;

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00806a]"></div>
      </div>
    );
  }

  // Role-based access control - only business users can access business layout
  useEffect(() => {
    if (!isLoading && !user) {
      console.log('BusinessLayout: No user found');
      navigate('/login');
      return;
    }
    
    if (!isLoading && user && user.role !== 'business' && user.role !== 'admin') {
      console.log('BusinessLayout: User role check failed', { user, role: user?.role });
      // Redirect to appropriate dashboard based on user role
      if (user?.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard'); // This will redirect to parent dashboard via DashboardRouter
      }
      return;
    }
  }, [user, isLoading, navigate]);

  // Don't render anything if user is not valid
  if (!isLoading && (!user || (user.role !== 'business' && user.role !== 'admin'))) {
    return null;
  }

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupName)) {
        newSet.delete(groupName);
      } else {
        newSet.add(groupName);
      }
      return newSet;
    });
  };

  // Auto-expand groups that contain the current active item
  useEffect(() => {
    const currentPath = location.pathname;
    
    // Small delay to prevent menu jumping
    const timeoutId = setTimeout(() => {
      const groupsToExpand = new Set(['operations']); // Always start with operations expanded
      
      // Auto-expand groups that contain the current active item
      navigationGroups.forEach(group => {
        const hasActiveItem = group.items.some(item => 
          currentPath === item.href || currentPath.startsWith(item.href + '/')
        );
        
        if (hasActiveItem) {
          groupsToExpand.add(group.id);
        }
      });
      
      // Only update if there are changes to avoid unnecessary re-renders
      const hasChanges = groupsToExpand.size !== expandedGroups.size || 
          !Array.from(groupsToExpand).every(id => expandedGroups.has(id));
      
      if (hasChanges) {
        setExpandedGroups(groupsToExpand);
      }
    }, 50); // Small delay for smooth transition
    
    return () => clearTimeout(timeoutId);
  }, [location.pathname]);

  const navigationItems = [
    {
      name: 'Dashboard',
      href: '/business/dashboard',
      icon: HomeIcon,
      current: location.pathname === '/business/dashboard'
    }
  ];

  const navigationGroups = [
    {
      id: 'operations',
      name: 'Operations',
      icon: BuildingStorefrontIcon,
      items: [
        {
          name: 'Activities',
          href: '/business/activities',
          icon: CalendarDaysIcon,
          current: location.pathname.startsWith('/business/activities')
        },
        {
          name: 'Bookings',
          href: '/business/bookings',
          icon: ClipboardDocumentListIcon,
          current: location.pathname.startsWith('/business/bookings')
        },
        {
          name: 'Session Management',
          href: '/business/sessions',
          icon: UserGroupIcon,
          current: location.pathname.startsWith('/business/sessions')
        },
        {
          name: 'Templates',
          href: '/business/templates',
          icon: DocumentDuplicateIcon,
          current: location.pathname.startsWith('/business/templates')
        },
        {
          name: 'Venues',
          href: '/business/venues',
          icon: BuildingOfficeIcon,
          current: location.pathname.startsWith('/business/venues')
        },
        {
          name: 'Venue Setup',
          href: '/business/venue-setup',
          icon: WrenchScrewdriverIcon,
          current: location.pathname.startsWith('/business/venue-setup')
        },
        {
          name: 'Registers',
          href: '/business/registers',
          icon: ClipboardDocumentListIcon,
          current: location.pathname.startsWith('/business/registers')
        },
        {
          name: 'Register Setup',
          href: '/business/register-setup',
          icon: ClipboardDocumentCheckIcon,
          current: location.pathname.startsWith('/business/register-setup')
        }
      ]
    },
    {
      id: 'finance',
      name: 'Finance & Payments',
      icon: CurrencyPoundIcon,
      items: [
        {
          name: 'Overview',
          href: '/business/finance',
          icon: ChartBarIcon,
          current: location.pathname === '/business/finance'
        },
        {
          name: 'Payment Management',
          href: '/business/payments',
          icon: BanknotesIcon,
          current: location.pathname === '/business/payments'
        },
        {
          name: 'Transactions',
          href: '/business/finance/transactions',
          icon: CreditCardIcon,
          current: location.pathname === '/business/finance/transactions'
        },
        {
          name: 'Discounts',
          href: '/business/finance/discounts',
          icon: BanknotesIcon,
          current: location.pathname === '/business/finance/discounts'
        },
        {
          name: 'Credits',
          href: '/business/finance/credits',
          icon: ArrowTrendingUpIcon,
          current: location.pathname === '/business/finance/credits'
        },
        {
          name: 'Refunds',
          href: '/business/finance/refunds',
          icon: CreditCardIcon,
          current: location.pathname === '/business/finance/refunds'
        },
        {
          name: 'Reports',
          href: '/business/finance/reports',
          icon: ChartBarIcon,
          current: location.pathname === '/business/finance/reports'
        }
      ]
    },
    {
      id: 'communications',
      name: 'Communications',
      icon: ChatBubbleLeftRightIcon,
      items: [
        {
          name: 'Overview',
          href: '/business/communications',
          icon: ChatBubbleLeftRightIcon,
          current: location.pathname === '/business/communications'
        },
        {
          name: 'Automated Emails',
          href: '/business/communications/automated',
          icon: EnvelopeIcon,
          current: location.pathname === '/business/communications/automated'
        },
        {
          name: 'Broadcasts',
          href: '/business/communications/broadcasts',
          icon: MegaphoneIcon,
          current: location.pathname === '/business/communications/broadcasts'
        },
        {
          name: 'Email Log',
          href: '/business/communications/logs',
          icon: DocumentTextIcon,
          current: location.pathname === '/business/communications/logs'
        }
      ]
    },
    {
      id: 'widgets',
      name: 'Widget Management',
      icon: ComputerDesktopIcon,
      items: [
        {
          name: 'Widget Overview',
          href: '/business/widgets',
          icon: ComputerDesktopIcon,
          current: location.pathname.startsWith('/business/widgets')
        },
        {
          name: 'Widget Configuration',
          href: '/business/widgets/config',
          icon: CogIcon,
          current: location.pathname.startsWith('/business/widgets/config')
        },
        {
          name: 'Widget Analytics',
          href: '/business/widgets/analytics',
          icon: ChartBarIcon,
          current: location.pathname.startsWith('/business/widgets/analytics')
        },
        {
          name: 'Embed Codes',
          href: '/business/widgets/embed',
          icon: DocumentTextIcon,
          current: location.pathname.startsWith('/business/widgets/embed')
        }
      ]
    },
    {
      id: 'notifications',
      name: 'Notifications',
      icon: SpeakerWaveIcon,
      items: [
        {
          name: 'Notification Center',
          href: '/business/notifications',
          icon: BellIcon,
          current: location.pathname.startsWith('/business/notifications')
        },
        {
          name: 'Notification Settings',
          href: '/business/notifications/settings',
          icon: CogIcon,
          current: location.pathname.startsWith('/business/notifications/settings')
        },
        {
          name: 'Email Templates',
          href: '/business/notifications/templates',
          icon: EnvelopeIcon,
          current: location.pathname.startsWith('/business/notifications/templates')
        },
        {
          name: 'Notification Logs',
          href: '/business/notifications/logs',
          icon: DocumentTextIcon,
          current: location.pathname.startsWith('/business/notifications/logs')
        }
      ]
    },
    {
      id: 'management',
      name: 'Management',
      icon: UserCircleIcon,
      items: [
        {
          name: 'Users',
          href: '/business/users',
          icon: UsersIcon,
          current: location.pathname.startsWith('/business/users')
        },
        {
          name: 'Settings',
          href: '/business/settings',
          icon: CogIcon,
          current: location.pathname.startsWith('/business/settings')
        }
      ]
    }
  ];

  const isCurrentPath = (href: string) => {
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-green-50">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
          <div className="flex h-16 items-center justify-between px-4 border-b border-gray-700/50">
            <h1 className="text-xl font-bold text-white">BookOn Business</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-gray-400 hover:text-white"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto scrollbar-thin scroll-smooth">
            {/* Standalone Dashboard Item */}
            {navigationItems.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-all duration-300 ${
                  item.current
                    ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-500/25'
                    : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                {item.name}
              </Link>
            ))}
            
            {/* Collapsible Groups */}
            {navigationGroups.map((group) => (
              <div key={group.id} className="space-y-1">
                {/* Group Header */}
                <button
                  onClick={() => toggleGroup(group.id)}
                  className={`group flex items-center w-full px-2 py-2 text-sm font-semibold rounded-md transition-all duration-300 ${
                    group.items.some(item => item.current)
                      ? 'text-green-300 hover:text-green-200 bg-gray-700/50'
                      : 'text-gray-200 hover:text-white hover:bg-gray-700/30'
                  }`}
                >
                  <group.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                  <span className="flex-1 text-left">{group.name}</span>
                  {expandedGroups.has(group.id) ? (
                    <ChevronDownIcon className="h-4 w-4 flex-shrink-0 transition-transform duration-300 ease-in-out" />
                  ) : (
                    <ChevronRightIcon className="h-4 w-4 flex-shrink-0 transition-transform duration-300 ease-in-out" />
                  )}
                </button>
                
                {/* Group Items */}
                <div className={`overflow-hidden transition-all duration-500 ease-in-out ${
                  expandedGroups.has(group.id) ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
                }`}>
                  <div className={`ml-6 space-y-1 pt-1 transition-transform duration-500 ease-in-out ${
                    expandedGroups.has(group.id) ? 'translate-y-0' : '-translate-y-2'
                  }`}>
                    {group.items.map((item) => (
                      <Link
                        key={item.name}
                        to={item.href}
                        className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                          item.current
                            ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-500/25'
                            : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                        }`}
                        onClick={() => setSidebarOpen(false)}
                      >
                        <item.icon className="mr-3 h-4 w-4 flex-shrink-0" />
                        {item.name}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 border-r border-gray-700/50">
          <div className="flex h-16 items-center px-4 border-b border-gray-700/50">
            <h1 className="text-xl font-bold text-white">BookOn Business</h1>
          </div>
          <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto scrollbar-thin scroll-smooth">
            {/* Standalone Dashboard Item */}
            {navigationItems.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-all duration-300 ${
                  item.current
                    ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-500/25'
                    : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                }`}
              >
                <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                {item.name}
              </Link>
            ))}
            
            {/* Collapsible Groups */}
            {navigationGroups.map((group) => (
              <div key={group.id} className="space-y-1">
                {/* Group Header */}
                <button
                  onClick={() => toggleGroup(group.id)}
                  className={`group flex items-center w-full px-2 py-2 text-sm font-semibold rounded-md transition-all duration-300 ${
                    group.items.some(item => item.current)
                      ? 'text-green-300 hover:text-green-200 bg-gray-700/50'
                      : 'text-gray-200 hover:text-white hover:bg-gray-700/30'
                  }`}
                >
                  <group.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                  <span className="flex-1 text-left">{group.name}</span>
                  {expandedGroups.has(group.id) ? (
                    <ChevronDownIcon className="h-4 w-4 flex-shrink-0 transition-transform duration-300 ease-in-out" />
                  ) : (
                    <ChevronRightIcon className="h-4 w-4 flex-shrink-0 transition-transform duration-300 ease-in-out" />
                  )}
                </button>
                
                {/* Group Items */}
                <div className={`overflow-hidden transition-all duration-500 ease-in-out ${
                  expandedGroups.has(group.id) ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
                }`}>
                  <div className={`ml-6 space-y-1 pt-1 transition-transform duration-500 ease-in-out ${
                    expandedGroups.has(group.id) ? 'translate-y-0' : '-translate-y-2'
                  }`}>
                    {group.items.map((item) => (
                      <Link
                        key={item.name}
                        to={item.href}
                        className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                          item.current
                            ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-500/25'
                            : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                        }`}
                      >
                        <item.icon className="mr-3 h-4 w-4 flex-shrink-0" />
                        {item.name}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </nav>
        </div>
      </div>


      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-40 bg-white border-b border-gray-200">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden text-gray-500 hover:text-gray-600"
              >
                <Bars3Icon className="h-6 w-6" />
              </button>
              <h2 className="ml-4 text-lg font-semibold text-gray-900 lg:ml-0">
                {(() => {
                  // Check standalone items first
                  const standaloneItem = navigationItems.find(item => item.current);
                  if (standaloneItem) return standaloneItem.name;
                  
                  // Then check groups
                  for (const group of navigationGroups) {
                    const currentItem = group.items.find(item => item.current);
                    if (currentItem) return currentItem.name;
                  }
                  return 'Dashboard';
                })()}
              </h2>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Quick Actions */}
              <Button
                onClick={() => navigate('/business/activities/new')}
                className="bg-[#00806a] hover:bg-[#006d5a] text-white"
              >
                <PlusIcon className="w-4 h-4 mr-2" />
                New Activity
              </Button>
              
              {/* Notifications */}
              <div className="relative">
                <Link
                  to="/business/notifications"
                  className="text-gray-500 hover:text-gray-600 transition-colors duration-200"
                >
                  <BellIcon className="h-6 w-6" />
                  {/* Notification badge */}
                  {notificationCount.unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                      {notificationCount.unreadCount > 99 ? '99+' : notificationCount.unreadCount}
                    </span>
                  )}
                </Link>
              </div>
              
              {/* User menu */}
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-gray-500">{user?.businessName}</p>
                </div>
                <div className="h-8 w-8 bg-[#00806a] rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="min-h-screen bg-white/80 backdrop-blur-sm custom-scrollbar-light">
          <div className="p-3 sm:p-4 lg:p-8">
            <div className="bg-white/90 backdrop-blur-sm rounded-lg sm:rounded-xl lg:rounded-2xl shadow-xl border border-gray-100/50 p-3 sm:p-4 lg:p-6 overflow-hidden">
              {children}
            </div>
          </div>
        </main>
        
        {/* Footer - positioned at bottom, spans full width */}
        <Footer />
      </div>
    </div>
  );
};

export default BusinessLayout;
