// Centralized API service for consistent URL handling
import { API_CONFIG } from '../config/api';

const API_BASE_URL = API_CONFIG.BASE_URL;

export const api = {
  // Helper function to build full API URLs
  url: (endpoint: string) => {
    if (/^https?:\/\//i.test(endpoint)) {
      return endpoint;
    }

    // Remove leading slash if present to avoid double slashes
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    return `${API_BASE_URL}/${cleanEndpoint}`;
  },

  // Helper function for authenticated requests
  request: async (endpoint: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('bookon_token');
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };

    return fetch(api.url(endpoint), {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });
  },

  // Common HTTP methods
  get: (endpoint: string, options?: RequestInit) => 
    api.request(endpoint, { ...options, method: 'GET' }),
  
  post: (endpoint: string, data?: any, options?: RequestInit) =>
    api.request(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),
  
  put: (endpoint: string, data?: any, options?: RequestInit) =>
    api.request(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),
  
  patch: (endpoint: string, data?: any, options?: RequestInit) =>
    api.request(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),
  
  delete: (endpoint: string, options?: RequestInit) =>
    api.request(endpoint, { ...options, method: 'DELETE' }),
};

export default api;

