import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { authService } from '../services/authService';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  read: boolean;
  createdAt: string;
  data?: any;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isConnected: boolean;
  socket: Socket | null;
  isPollingDisabled: boolean;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  connect: () => void;
  disconnect: () => void;
  retryPolling: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [pollingErrors, setPollingErrors] = useState(0);
  const [isPollingDisabled, setIsPollingDisabled] = useState(false);
  const [isVercelProduction] = useState(() => window.location.hostname.includes('vercel.app'));

  // Connect to WebSocket
  const connect = () => {
    if (socket?.connected) return;

    // On Vercel, don't attempt WebSocket connections at all
    if (isVercelProduction) {
      console.log('Running on Vercel - WebSocket disabled, using HTTP polling for notifications');
      setIsConnected(false);
      setIsPollingDisabled(false); // Enable polling instead
      return;
    }

    const token = authService.getToken();
    const user = authService.getUser();

    if (!token || !user) {
      console.warn('No token or user found for WebSocket connection');
      return;
    }

    // Limit connection attempts to prevent infinite loops
    if (connectionAttempts >= 3) {
      console.warn('Max WebSocket connection attempts reached, giving up');
      setIsPollingDisabled(false); // Enable polling as fallback
      return;
    }

    // Skip WebSocket connection if backend doesn't support it
    console.log('Skipping WebSocket connection - backend not configured');
    setIsConnected(false);
    setIsPollingDisabled(false); // Enable HTTP polling instead
    return;
  };

  // Disconnect from WebSocket
  const disconnect = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      const token = authService.getToken();
      if (!token) return;

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api/v1'}/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setNotifications(prev => 
          prev.map(notification => 
            notification.id === notificationId 
              ? { ...notification, read: true }
              : notification
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      const token = authService.getToken();
      if (!token) return;

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api/v1'}/notifications/read-all`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setNotifications(prev => 
          prev.map(notification => ({ ...notification, read: true }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  // Clear all notifications
  const clearNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  // Retry polling after CORS issues are resolved
  const retryPolling = () => {
    if (isVercelProduction) {
      setPollingErrors(0);
      setIsPollingDisabled(false);
      console.log('Retrying notification polling...');
    }
  };

  // Fetch notifications on mount
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const token = authService.getToken();
        if (!token) return;

        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api/v1'}/notifications`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setNotifications(data.data.notifications || []);
            setUnreadCount(data.data.unreadCount || 0);
          }
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };

    fetchNotifications();
  }, []);

  // HTTP polling fallback for Vercel
  useEffect(() => {
    if (!isVercelProduction || isPollingDisabled) return;

    const pollNotifications = async () => {
      try {
        const token = authService.getToken();
        if (!token) return;

        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api/v1'}/notifications`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setNotifications(data.data.notifications || []);
            setUnreadCount(data.data.unreadCount || 0);
            // Reset error count on successful request
            setPollingErrors(0);
          }
        } else if (response.status === 401) {
          // Token expired, stop polling
          console.warn('Authentication failed, stopping notification polling');
          setIsPollingDisabled(true);
        }
      } catch (error) {
        const newErrorCount = pollingErrors + 1;
        setPollingErrors(newErrorCount);
        
        // If we get too many consecutive errors, disable polling temporarily
        if (newErrorCount >= 10) {
          console.warn('Too many notification polling errors, disabling polling temporarily');
          setIsPollingDisabled(true);
          
          // Re-enable polling after 5 minutes
          setTimeout(() => {
            console.log('Re-enabling notification polling');
            setIsPollingDisabled(false);
            setPollingErrors(0);
          }, 300000); // 5 minutes
          return;
        }
        
        // Only log every 10th error to reduce console spam
        if (newErrorCount % 10 === 0) {
          console.warn(`Notification polling error ${newErrorCount}/10 (non-critical):`, error);
        }
      }
    };

    // Poll every 2 minutes on Vercel (reduced frequency to prevent database overload)
    const interval = setInterval(pollNotifications, 120000);
    
    // Initial poll
    pollNotifications();

    return () => clearInterval(interval);
  }, [isVercelProduction, isPollingDisabled, pollingErrors]);

  // Connect to WebSocket when user is authenticated (non-Vercel)
  useEffect(() => {
    if (isVercelProduction) return;

    const user = authService.getUser();
    if (user && authService.isAuthenticated()) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [isVercelProduction]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    isConnected,
    socket,
    isPollingDisabled,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    connect,
    disconnect,
    retryPolling,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationContext;
