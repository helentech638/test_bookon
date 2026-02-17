import { toast } from 'react-hot-toast';
import { buildApiUrl } from '../config/api';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role?: 'parent' | 'business';
  businessName?: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'parent' | 'staff' | 'admin' | 'business';
  phone?: string;
  businessName?: string;
  address?: string;
  dateOfBirth?: string;
  profileImage?: string;
  isActive: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    token: string;
    refreshToken: string;
  };
  message: string;
}

class AuthService {
  private tokenKey = 'bookon_token';
  private refreshTokenKey = 'bookon_refresh_token';
  private userKey = 'bookon_user';

  // Get stored token
  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  // Get stored refresh token
  getRefreshToken(): string | null {
    return localStorage.getItem(this.refreshTokenKey);
  }

  // Get stored user
  getUser(): User | null {
    const userStr = localStorage.getItem(this.userKey);
    return userStr ? JSON.parse(userStr) : null;
  }

  // Set authentication data
  setAuth(token: string, refreshToken: string, user: User): void {
    localStorage.setItem(this.tokenKey, token);
    localStorage.setItem(this.refreshTokenKey, refreshToken);
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }

  // Clear authentication data
  clearAuth(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.refreshTokenKey);
    localStorage.removeItem(this.userKey);
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    const token = this.getToken();
    const user = this.getUser();
    return !!(token && user);
  }

  // Verify token with backend and auto-refresh if needed
  async verifyToken(): Promise<boolean> {
    const token = this.getToken();
    if (!token) return false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(buildApiUrl('/auth/me'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // If token is expired, try to refresh
      if (response.status === 401) {
        console.log('Token expired, attempting refresh...');
        try {
          await this.refreshToken();
          return true; // Refresh successful
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          this.clearAuth();
          return false;
        }
      }

      return response.ok;
    } catch (error) {
      console.error('Token verification failed:', error);
      return false;
    }
  }

  // Check if user has specific role
  hasRole(role: string): boolean {
    const user = this.getUser();
    return user?.role === role;
  }

  // Make authenticated API request with automatic token refresh
  async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const token = this.getToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    // Add authorization header
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // If token is expired, try to refresh and retry
      if (response.status === 401) {
        console.log('Token expired during API call, attempting refresh...');
        try {
          await this.refreshToken();
          const newToken = this.getToken();
          if (newToken) {
            // Retry the request with new token
            const newHeaders = {
              ...headers,
              'Authorization': `Bearer ${newToken}`,
            };
            return await fetch(url, {
              ...options,
              headers: newHeaders,
            });
          }
        } catch (refreshError) {
          console.error('Token refresh failed during API call:', refreshError);
          this.clearAuth();
          throw new Error('Authentication expired');
        }
      }

      return response;
    } catch (error) {
      console.error('Authenticated fetch error:', error);
      throw error;
    }
  }

  // Register user
  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    try {
      const response = await fetch(buildApiUrl('/auth/register'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 400) {
          // Extract detailed error message from validation
          const errorMessage = data.message || data.error || data.errors?.[0]?.msg || 'Invalid registration data';
          throw new Error(errorMessage);
        } else if (response.status === 409) {
          throw new Error('Email already exists. Please use a different email or try logging in.');
        } else if (response.status === 500) {
          throw new Error('Server error. Please try again later.');
        } else {
          throw new Error(data.message || 'Registration failed. Please try again.');
        }
      }

      if (data.success) {
        return data;
      } else {
        throw new Error(data.message || 'Registration failed. Please try again.');
      }
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  // Login user
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await fetch(buildApiUrl('/auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Login failed');
      }

      if (data.success && data.data) {
        // Handle the backend response structure
        const accessToken = data.data.tokens?.accessToken || data.data.token;
        const refreshToken = data.data.tokens?.refreshToken || data.data.refreshToken;
        const user = data.data.user;

        if (!accessToken || !refreshToken || !user) {
          throw new Error('Invalid response: missing tokens or user data');
        }

        this.setAuth(accessToken, refreshToken, user);
        return data;
      } else {
        throw new Error(data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error(error instanceof Error ? error.message : 'Login failed');
      throw error;
    }
  }

  // Logout user
  async logout(): Promise<void> {
    try {
      const token = this.getToken();
      if (token) {
        await fetch(buildApiUrl('/auth/logout'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearAuth();
      toast.success('Logged out successfully');
    }
  }

  // Refresh token
  async refreshToken(): Promise<string | null> {
    try {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch(buildApiUrl('/auth/refresh'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Token refresh failed');
      }

      if (data.success && data.data) {
        const user = this.getUser();
        if (user) {
          // Handle both possible response structures
          const accessToken = data.data.tokens?.accessToken || data.data.token;
          const refreshToken = data.data.tokens?.refreshToken || data.data.refreshToken;

          if (accessToken && refreshToken) {
            this.setAuth(accessToken, refreshToken, user);
            return accessToken;
          }
        }
      }

      throw new Error('Token refresh failed');
    } catch (error) {
      console.error('Token refresh error:', error);
      this.clearAuth();
      throw error;
    }
  }

  // Get authenticated user profile
  async getProfile(): Promise<User> {
    try {
      const token = this.getToken();
      if (!token) {
        throw new Error('No token available');
      }

      const response = await fetch(buildApiUrl('/auth/me'), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to get profile');
      }

      if (data.success && data.data) {
        // Update stored user data
        localStorage.setItem(this.userKey, JSON.stringify(data.data));
        return data.data;
      }

      throw new Error('Failed to get profile');
    } catch (error) {
      console.error('Get profile error:', error);
      throw error;
    }
  }

  // Update user profile
  async updateProfile(updates: Partial<User>): Promise<User> {
    try {
      const token = this.getToken();
      if (!token) {
        throw new Error('No token available');
      }

      const response = await fetch(buildApiUrl('/auth/me'), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to update profile');
      }

      if (data.success && data.data) {
        // Update stored user data
        localStorage.setItem(this.userKey, JSON.stringify(data.data));
        toast.success('Profile updated successfully!');
        return data.data;
      }

      throw new Error('Failed to update profile');
    } catch (error) {
      console.error('Update profile error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update profile');
      throw error;
    }
  }

  // Change password
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      const token = this.getToken();
      if (!token) {
        throw new Error('No token available');
      }

      const response = await fetch(buildApiUrl('/auth/change-password'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to change password');
      }

      if (data.success) {
        toast.success('Password changed successfully!');
      } else {
        throw new Error('Failed to change password');
      }
    } catch (error) {
      console.error('Change password error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to change password');
      throw error;
    }
  }
}

export const authService = new AuthService();
export default authService;
