import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService } from '../services/authService';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'parent' | 'staff' | 'admin' | 'business';
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const token = authService.getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      // Verify token using centralized auth service (uses configured API base URL)
      const isValid = await authService.verifyToken();

      if (isValid) {
        // Token is valid, get user data
        const userData = localStorage.getItem('bookon_user');
        if (userData) {
          setUser(JSON.parse(userData));
        }
      } else {
        // Token is invalid, clear auth data
        console.log('Token invalid, clearing auth data');
        authService.clearAuth();
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      // Clear auth data on error
      authService.clearAuth();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await authService.login({ email, password });
      if (response.success && response.data?.user) {
        const userData = response.data.user;
        setUser(userData);
        // Store user data in localStorage
        localStorage.setItem('bookon_user', JSON.stringify(userData));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    localStorage.removeItem('bookon_user');
  };

  useEffect(() => {
    // First try to restore user from localStorage
    const storedUser = localStorage.getItem('bookon_user');
    
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        setIsLoading(false);
        return;
      } catch (error) {
        console.error('Failed to parse stored user:', error);
        localStorage.removeItem('bookon_user');
      }
    }
    // If no stored user, check auth with backend
    checkAuth();
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    checkAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
