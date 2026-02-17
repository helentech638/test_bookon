// Utility functions for authentication management
import { buildApiUrl } from '../config/api';

export const clearAllAuthData = () => {
  // Clear all authentication-related data
  localStorage.removeItem('bookon_token');
  localStorage.removeItem('bookon_refresh_token');
  localStorage.removeItem('bookon_user');
  
  // Clear any other potential auth data
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes('auth') || key.includes('token') || key.includes('user'))) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => localStorage.removeItem(key));
  
  console.log('All authentication data cleared');
};

export const forceLogout = () => {
  clearAllAuthData();
  window.location.href = '/login';
};

export const checkTokenValidity = async (token: string): Promise<boolean> => {
  if (!token) return false;
  
  try {
    const response = await fetch(buildApiUrl('/dashboard/profile'), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return response.ok;
  } catch (error) {
    console.error('Token validation failed:', error);
    return false;
  }
};

// Add to window for easy access in console
if (typeof window !== 'undefined') {
  (window as any).clearAuth = clearAllAuthData;
  (window as any).forceLogout = forceLogout;
}
