import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

const FALLBACK_API_BASE_URL = 'https://bookon-api.vercel.app/api/v1';

const normalizeApiBaseUrl = (rawUrl?: string): string => {
  const candidate = (rawUrl || '').trim() || FALLBACK_API_BASE_URL;
  const withoutTrailingSlash = candidate.replace(/\/+$/, '');

  if (/\/api\/v1$/i.test(withoutTrailingSlash)) {
    return withoutTrailingSlash;
  }

  return `${withoutTrailingSlash}/api/v1`;
};

const resolvedApiBaseUrl = normalizeApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL
);

// API Configuration
export const API_CONFIG = {
  BASE_URL: resolvedApiBaseUrl,
  ENDPOINTS: {
    AUTH: {
      LOGIN: '/auth/login',
      REGISTER: '/auth/register',
      REFRESH: '/auth/refresh',
      LOGOUT: '/auth/logout',
    },
    DASHBOARD: {
      STATS: '/dashboard/stats',
      PROFILE: '/dashboard/profile',
      RECENT_ACTIVITIES: '/dashboard/recent-activities',
    },
    ADMIN: {
      STATS: '/admin/stats',
      VENUES: '/admin/venues',
      ACTIVITIES: '/admin/activities',
      RECENT_BOOKINGS: '/admin/recent-bookings',
      USERS: '/admin/users',
      SYSTEM_CONFIG: '/admin/system-config',
      AUDIT_LOGS: '/admin/audit-logs',
      BULK_USER_UPDATE: '/admin/bulk-user-update',
      BOOKINGS: '/admin/bookings',
      EMAIL_TEMPLATES: '/admin/email-templates',
      BROADCAST_MESSAGE: '/admin/broadcast-message',
      EXPORT_HISTORY: '/admin/export/history',
      EXPORT: '/admin/export',
      EXPORT_SCHEDULE: '/admin/export/schedule',
      FINANCIAL_REPORTS: '/admin/financial-reports',
      NOTIFICATIONS: '/admin/notifications',
      PAYMENT_SETTINGS: '/admin/payment-settings',
      VENUE_PAYMENT_ACCOUNTS: '/admin/venue-payment-accounts',
    },
    VENUES: '/venues',
    ACTIVITIES: '/activities',
    CHILDREN: '/children',
    BOOKINGS: '/bookings',
    REGISTERS: '/registers',
    PAYMENTS: '/payments',
    NOTIFICATIONS: '/notifications',
  },
};

// Create axios instance
const createApiClient = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: API_CONFIG.BASE_URL,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor to add auth token
  instance.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('bookon_token');
      const refreshToken = localStorage.getItem('bookon_refresh_token');

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Add refresh token to headers for automatic token refresh
      if (refreshToken) {
        config.headers['X-Refresh-Token'] = refreshToken;
      }

      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor to handle common errors and token refresh
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        console.log('401 error detected, attempting token refresh...');

        // Try to refresh the token
        const refreshToken = localStorage.getItem('bookon_refresh_token');
        if (refreshToken) {
          try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/auth/refresh`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ refreshToken }),
            });

            if (response.ok) {
              const data = await response.json();
              if (data.success && data.data?.tokens) {
                console.log('Token refreshed successfully');
                localStorage.setItem('bookon_token', data.data.tokens.accessToken);
                localStorage.setItem('bookon_refresh_token', data.data.tokens.refreshToken);

                // Retry the original request with new token
                originalRequest.headers.Authorization = `Bearer ${data.data.tokens.accessToken}`;
                return instance(originalRequest);
              }
            }
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);
          }
        }

        // If refresh fails or no refresh token, clear auth and redirect
        console.log('Token refresh failed, redirecting to login...');
        localStorage.removeItem('bookon_token');
        localStorage.removeItem('bookon_refresh_token');
        localStorage.removeItem('bookon_user');

        // Show user-friendly message before redirect
        if (window.confirm('Your session has expired. Please log in again.')) {
          window.location.href = '/login';
        } else {
          window.location.href = '/login';
        }
      }

      return Promise.reject(error);
    }
  );

  return instance;
};

// Export the API client instance
export const api = createApiClient();

// Helper function to build full API URLs
export const buildApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

// Helper function to build full API URLs with parameters
export const buildApiUrlWithParams = (endpoint: string, params: Record<string, string>): string => {
  const url = new URL(`${API_CONFIG.BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });
  return url.toString();
};
