import { useState, useEffect, useCallback } from 'react';
import { notificationService, NotificationCount, Notification } from '../services/notificationService';
import { authService } from '../services/authService';

export const useNotifications = () => {
  const [notificationCount, setNotificationCount] = useState<NotificationCount>({ unreadCount: 0, totalCount: 0 });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch notification count
  const fetchNotificationCount = useCallback(async () => {
    try {
      setError(null);
      const count = await notificationService.getNotificationCount();
      setNotificationCount(count);
    } catch (err) {
      // Don't set error for 429 (rate limit) errors to avoid UI disruption
      if (err instanceof Error && err.message.includes('429')) {
        console.warn('Notification count request rate limited, will retry later');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to fetch notification count');
      console.error('Error fetching notification count:', err);
    }
  }, []);

  // Fetch notifications
  const fetchNotifications = useCallback(async (limit: number = 10, unreadOnly: boolean = false) => {
    try {
      setLoading(true);
      setError(null);
      const data = await notificationService.getNotifications(limit, unreadOnly);
      setNotifications(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications');
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Mark notifications as read
  const markAsRead = useCallback(async (notificationIds: string[]) => {
    try {
      const success = await notificationService.markAsRead(notificationIds);
      if (success) {
        // Update local state
        setNotifications(prev => 
          prev.map(notification => 
            notificationIds.includes(notification.id) 
              ? { ...notification, read: true }
              : notification
          )
        );
        // Refresh count
        await fetchNotificationCount();
      }
      return success;
    } catch (err) {
      console.error('Error marking notifications as read:', err);
      return false;
    }
  }, [fetchNotificationCount]);

  // Auto-refresh notification count every 60 seconds (only for authenticated users)
  useEffect(() => {
    // Only fetch notifications if user is authenticated
    if (authService.isAuthenticated()) {
      fetchNotificationCount();
      
      const interval = setInterval(() => {
        fetchNotificationCount();
      }, 300000); // 5 minutes (reduced frequency to prevent 429 errors)

      return () => clearInterval(interval);
    }
  }, [fetchNotificationCount]);

  return {
    notificationCount,
    notifications,
    loading,
    error,
    fetchNotificationCount,
    fetchNotifications,
    markAsRead,
    refreshNotifications: fetchNotificationCount
  };
};
