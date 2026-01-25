import React, { useState, useEffect } from 'react';
import { 
  BellIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
  SparklesIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import toast from 'react-hot-toast';
import { authService } from '../../services/authService';
import { buildApiUrl } from '../../config/api';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  actionUrl?: string;
}

const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAsRead, setMarkingAsRead] = useState<string | null>(null);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const token = authService.getToken();
      if (!token) return;

      const response = await fetch(buildApiUrl('/notifications'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.data || []);
      } else {
        throw new Error('Failed to fetch notifications');
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      setMarkingAsRead(notificationId);
      const token = authService.getToken();
      if (!token) return;

      const response = await fetch(buildApiUrl('/notifications/mark-read'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notificationIds: [notificationId] })
      });

      if (response.ok) {
        setNotifications(prev => 
          prev.map(notif => 
            notif.id === notificationId ? { ...notif, read: true } : notif
          )
        );
        toast.success('Notification marked as read');
      } else {
        throw new Error('Failed to mark notification as read');
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('Failed to mark notification as read');
    } finally {
      setMarkingAsRead(null);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
      if (unreadIds.length === 0) return;

      const token = authService.getToken();
      if (!token) return;

      const response = await fetch(buildApiUrl('/notifications/mark-read'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notificationIds: unreadIds })
      });

      if (response.ok) {
        setNotifications(prev => 
          prev.map(notif => ({ ...notif, read: true }))
        );
        toast.success('All notifications marked as read');
      } else {
        throw new Error('Failed to mark all notifications as read');
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      toast.error('Failed to mark all notifications as read');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'booking':
        return <CheckCircleIcon className="h-5 w-5 text-teal-500" />;
      case 'cancellation':
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />;
      case 'payment':
        return <CheckCircleIcon className="h-5 w-5 text-teal-500" />;
      default:
        return <InformationCircleIcon className="h-5 w-5 text-teal-500" />;
    }
  };

  const getNotificationGradient = (type: string) => {
    switch (type) {
      case 'booking':
        return 'from-teal-50 to-emerald-50 border-l-teal-500';
      case 'cancellation':
        return 'from-red-50 to-pink-50 border-l-red-500';
      case 'payment':
        return 'from-teal-50 to-teal-100 border-l-teal-500';
      default:
        return 'from-gray-50 to-slate-50 border-l-teal-500';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown date';
    
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid date string:', dateString);
      return 'Invalid date';
    }
    
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    return date.toLocaleDateString();
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gradient-to-r from-teal-200 to-teal-300 rounded-lg w-1/4 mb-6"></div>
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-gradient-to-r from-white to-teal-50 rounded-xl shadow-sm border border-teal-100"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Premium Header */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-teal-500/10 to-teal-600/10 rounded-2xl blur-xl"></div>
          <div className="relative bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-teal-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-teal-500 to-teal-600 rounded-full blur-sm opacity-30"></div>
                  <div className="relative bg-gradient-to-r from-teal-500 to-teal-600 p-3 rounded-full">
                    <BellIcon className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-teal-700 bg-clip-text text-transparent">
                    Notifications
                  </h1>
                  <p className="text-gray-600 mt-1">Stay updated with your latest activities</p>
                </div>
              </div>
              {unreadCount > 0 && (
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-500 rounded-full blur-sm opacity-50 animate-pulse"></div>
                    <span className="relative inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-lg">
                      {unreadCount} unread
                    </span>
                  </div>
                  <Button
                    onClick={markAllAsRead}
                    className="bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                    size="sm"
                  >
                    <SparklesIcon className="h-4 w-4 mr-2" />
                    Mark all as read
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notifications List */}
        {notifications.length === 0 ? (
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-teal-500/5 to-teal-600/5 rounded-2xl blur-xl"></div>
            <Card className="relative bg-white/80 backdrop-blur-sm border-teal-100 shadow-lg">
              <CardContent className="text-center py-16">
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-gradient-to-r from-teal-500/20 to-teal-600/20 rounded-full blur-lg"></div>
                  <div className="relative bg-gradient-to-r from-teal-100 to-teal-200 p-6 rounded-full mx-auto w-20 h-20 flex items-center justify-center">
                    <BellIcon className="h-10 w-10 text-teal-500" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">All caught up!</h3>
                <p className="text-gray-600 max-w-md mx-auto">
                  You're all up to date! We'll notify you when there's something new to see.
                </p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification, index) => (
              <div
                key={notification.id}
                className="group relative animate-in slide-in-from-bottom-4 duration-500"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-teal-500/5 to-teal-600/5 rounded-xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <Card
                  className={`relative bg-white/90 backdrop-blur-sm border-l-4 ${getNotificationGradient(notification.type)} ${
                    !notification.read ? 'ring-2 ring-teal-100 shadow-lg hover:shadow-xl' : 'shadow-sm hover:shadow-md'
                  } transition-all duration-300 transform group-hover:scale-[1.02] border border-teal-100`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        <div className="relative">
                          <div className={`absolute inset-0 rounded-full blur-sm ${
                            !notification.read ? 'bg-teal-500/30' : 'bg-gray-400/20'
                          }`}></div>
                          <div className={`relative p-2 rounded-full ${
                            !notification.read ? 'bg-gradient-to-r from-teal-500 to-teal-600' : 'bg-gray-100'
                          }`}>
                            {getNotificationIcon(notification.type)}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className={`text-lg font-semibold ${
                              !notification.read ? 'text-gray-900' : 'text-gray-700'
                            }`}>
                              {notification.title}
                            </h3>
                            {!notification.read && (
                              <div className="relative">
                                <div className="absolute inset-0 bg-teal-500 rounded-full blur-sm opacity-50 animate-pulse"></div>
                                <div className="relative h-3 w-3 bg-gradient-to-r from-teal-500 to-teal-600 rounded-full"></div>
                              </div>
                            )}
                          </div>
                          <p className="text-gray-600 mb-3 leading-relaxed">
                            {notification.message}
                          </p>
                          <div className="flex items-center space-x-2 text-sm text-gray-500">
                            <ClockIcon className="h-4 w-4" />
                            <span>{formatDate(notification.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      {!notification.read && (
                        <div className="ml-4">
                          <Button
                            onClick={() => markAsRead(notification.id)}
                            disabled={markingAsRead === notification.id}
                            className="bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                            size="sm"
                          >
                            {markingAsRead === notification.id ? (
                              <div className="flex items-center space-x-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                <span>Marking...</span>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2">
                                <CheckCircleIcon className="h-4 w-4" />
                                <span>Mark as read</span>
                              </div>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
