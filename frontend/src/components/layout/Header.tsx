import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bars3Icon, XMarkIcon, UserCircleIcon, ArrowRightOnRectangleIcon, BellIcon, ShoppingCartIcon } from '@heroicons/react/24/outline';
import { useNotifications } from '../../hooks/useNotifications';
import { useBasket } from '../../contexts/CartContext';

interface HeaderProps {
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: 'parent' | 'staff' | 'admin' | 'business';
  } | null;
  onLogout?: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { notificationCount } = useNotifications();
  const { getTotalItems } = useBasket();

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    }
    navigate('/login');
  };

  return (
    <header className="bg-white shadow-lg border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14 sm:h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 group">
              <img 
                src="https://res.cloudinary.com/dfxypnsvt/image/upload/v1757098381/bookonlogo_aq6lq3.png" 
                alt="BookOn Logo" 
                className="h-8 sm:h-10 w-auto transition-transform group-hover:scale-105" 
              />
            </Link>
          </div>

          {/* Navigation Links - Desktop */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link 
              to="/" 
              className="text-gray-600 hover:text-[#00806a] px-3 py-2 text-sm font-medium transition-colors duration-200"
            >
              Home
            </Link>
            <Link 
              to="/venues" 
              className="text-gray-600 hover:text-[#00806a] px-3 py-2 text-sm font-medium transition-colors duration-200"
            >
              Venues
            </Link>
            <Link 
              to="/activities" 
              className="text-gray-600 hover:text-[#00806a] px-3 py-2 text-sm font-medium transition-colors duration-200"
            >
              Activities
            </Link>
            {user && (
              <Link 
                to="/dashboard" 
                className="text-gray-600 hover:text-[#00806a] px-3 py-2 text-sm font-medium transition-colors duration-200"
              >
                Dashboard
              </Link>
            )}
          </nav>

          {/* Right side - Auth button and mobile menu button */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Basket Icon */}
            <Link
              to="/basket"
              className="relative p-2 text-gray-600 hover:text-[#00806a] transition-colors duration-200"
            >
              <ShoppingCartIcon className="h-5 w-5" />
              {/* Basket badge */}
              {getTotalItems() > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-teal-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                  {getTotalItems() > 99 ? '99+' : getTotalItems()}
                </span>
              )}
            </Link>

            {/* Auth button */}
            {user ? (
              <div className="hidden sm:flex items-center space-x-3">
                {/* Notification Bell */}
                <Link
                  to="/notifications"
                  className="relative p-2 text-gray-600 hover:text-[#00806a] transition-colors duration-200"
                >
                  <BellIcon className="h-5 w-5" />
                  {/* Notification badge */}
                  {notificationCount.unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                      {notificationCount.unreadCount > 99 ? '99+' : notificationCount.unreadCount}
                    </span>
                  )}
                </Link>
                
                {/* Profile/Admin Link - Admin users go to /admin, others to /profile */}
                <Link
                  to={user.role === 'admin' ? '/admin' : '/profile'}
                  className="flex items-center space-x-2 text-gray-600 hover:text-[#00806a] px-3 py-2 text-sm font-medium transition-colors duration-200"
                >
                  <UserCircleIcon className="h-5 w-5" />
                  <span className="hidden lg:block">
                    {user.role === 'admin' ? 'Admin' : user.firstName}
                  </span>
                </Link>
                
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 text-gray-600 hover:text-red-600 px-3 py-2 text-sm font-medium transition-colors duration-200"
                >
                  <ArrowRightOnRectangleIcon className="h-5 w-5" />
                  <span className="hidden lg:block">Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="hidden sm:flex items-center space-x-3">
                <Link
                  to="/login"
                  className="text-gray-600 hover:text-[#00806a] px-3 py-2 text-sm font-medium transition-colors duration-200"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="bg-gradient-to-r from-[#041c30] to-[#00806a] text-white px-3 sm:px-4 py-2 rounded-lg text-sm font-medium hover:from-[#052a42] hover:to-[#006b5a] transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  Get Started
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="sm:hidden p-2 rounded-lg text-gray-400 hover:text-gray-500 hover:bg-gray-100 transition-colors duration-200"
            >
              {isMobileMenuOpen ? (
                <XMarkIcon className="h-5 w-5" />
              ) : (
                <Bars3Icon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="sm:hidden">
          <div className="px-3 pt-2 pb-3 space-y-1 bg-white border-t border-gray-100 shadow-lg">
            <Link
              to="/"
              className="text-gray-600 hover:text-[#00806a] block px-3 py-2 text-base font-medium rounded-lg hover:bg-gray-50 transition-colors duration-200"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              to="/venues"
              className="text-gray-600 hover:text-[#00806a] block px-3 py-2 text-base font-medium rounded-lg hover:bg-gray-50 transition-colors duration-200"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Venues
            </Link>
            <Link
              to="/activities"
              className="text-gray-600 hover:text-[#00806a] block px-3 py-2 text-base font-medium rounded-lg hover:bg-gray-50 transition-colors duration-200"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Activities
            </Link>
            {user && (
              <Link
                to="/dashboard"
                className="text-gray-600 hover:text-[#00806a] block px-3 py-2 text-base font-medium rounded-lg hover:bg-gray-50 transition-colors duration-200"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Dashboard
              </Link>
            )}
            
            {/* Mobile auth section */}
            <div className="border-t border-gray-100 pt-3 mt-3">
              {/* Basket Icon for Mobile */}
              <Link
                to="/basket"
                className="flex items-center space-x-2 text-gray-600 hover:text-[#00806a] px-3 py-2 text-base font-medium rounded-lg hover:bg-gray-50 transition-colors duration-200"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <ShoppingCartIcon className="h-5 w-5" />
                <span>Basket</span>
                {getTotalItems() > 0 && (
                  <span className="ml-auto h-4 w-4 bg-teal-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                    {getTotalItems() > 99 ? '99+' : getTotalItems()}
                  </span>
                )}
              </Link>

              {user ? (
                <div className="space-y-2">
                  {/* Notification Bell for Mobile */}
                  <Link
                    to="/notifications"
                    className="flex items-center space-x-2 text-gray-600 hover:text-[#00806a] px-3 py-2 text-base font-medium rounded-lg hover:bg-gray-50 transition-colors duration-200"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <BellIcon className="h-5 w-5" />
                    <span>Notifications</span>
                    {notificationCount.unreadCount > 0 && (
                      <span className="ml-auto h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                        {notificationCount.unreadCount > 99 ? '99+' : notificationCount.unreadCount}
                      </span>
                    )}
                  </Link>
                  
                  {/* Profile/Admin Link - Admin users go to /admin, others to /profile */}
                  <Link
                    to={user.role === 'admin' ? '/admin' : '/profile'}
                    className="flex items-center space-x-2 text-gray-600 hover:text-[#00806a] px-3 py-2 text-base font-medium rounded-lg hover:bg-gray-50 transition-colors duration-200"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <UserCircleIcon className="h-5 w-5" />
                    <span>{user.role === 'admin' ? 'Admin' : 'Profile'}</span>
                  </Link>
                  
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsMobileMenuOpen(false);
                    }}
                    className="flex items-center space-x-2 text-gray-600 hover:text-red-600 px-3 py-2 text-base font-medium rounded-lg hover:bg-gray-50 transition-colors duration-200 w-full text-left"
                  >
                    <ArrowRightOnRectangleIcon className="h-5 w-5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Link
                    to="/login"
                    className="text-gray-600 hover:text-[#00806a] block px-3 py-2 text-base font-medium rounded-lg hover:bg-gray-50 transition-colors duration-200"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    className="bg-gradient-to-r from-[#041c30] to-[#00806a] text-white px-3 py-2 rounded-lg text-base font-medium hover:from-[#052a42] hover:to-[#006b5a] transition-all duration-200 shadow-md hover:shadow-lg block text-center"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Get Started
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
