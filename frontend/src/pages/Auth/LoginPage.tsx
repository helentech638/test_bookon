import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { EyeIcon, EyeSlashIcon, CheckCircleIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  // Handle registration success message
  useEffect(() => {
    if (location.state?.message) {
      toast.success(location.state.message);
      if (location.state.email) {
        setEmail(location.state.email);
      }
    }
  }, [location.state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      const success = await login(email, password);
      if (success) {
        toast.success('Login successful!');
        
        // Get user data from localStorage to check role
        const userData = JSON.parse(localStorage.getItem('bookon_user') || '{}');
        
        // Redirect based on user role
        if (userData.role === 'admin') {
          navigate('/admin');
        } else if (userData.role === 'business') {
          navigate('/business/dashboard');
        } else {
          navigate('/dashboard'); // Default for parent role
        }
      } else {
        toast.error('Login failed. Please check your credentials.');
      }
    } catch (error) {
      toast.error('Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Illustration */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Calendar Icon */}
        <div className="absolute top-20 right-20 text-green-100 opacity-20">
          <CalendarDaysIcon className="w-32 h-32" />
        </div>
        {/* Checkmark Icon */}
        <div className="absolute bottom-20 left-20 text-green-100 opacity-20">
          <CheckCircleIcon className="w-24 h-24" />
        </div>
        {/* Floating dots */}
        <div className="absolute top-1/3 left-1/4 w-3 h-3 bg-green-200 rounded-full opacity-30 animate-pulse"></div>
        <div className="absolute top-2/3 right-1/3 w-2 h-2 bg-green-300 rounded-full opacity-40 animate-pulse delay-1000"></div>
        <div className="absolute bottom-1/3 right-1/4 w-4 h-4 bg-green-200 rounded-full opacity-20 animate-pulse delay-2000"></div>
      </div>

      <div className="relative z-10 flex min-h-screen">
        {/* Left Side - Branding */}
        <div className="hidden lg:flex lg:w-1/2 p-12 flex-col justify-center">
          <div className="max-w-md">
            <div className="flex items-center mb-8">
              <img src="https://res.cloudinary.com/dfxypnsvt/image/upload/v1757098381/bookonlogo_aq6lq3.png" alt="BookOn Logo" className="h-12 w-auto" />
            </div>
            
            <h2 className="text-4xl font-bold mb-6 leading-tight text-teal-600">
              Simple. Seamless. Bookings.
            </h2>
            
            <p className="text-xl text-teal-600 mb-8 leading-relaxed">
              Streamline your school clubs and activities with our intuitive booking platform. 
              Manage schedules, track attendance, and simplify administration.
            </p>
            
            <div className="space-y-4">
              <div className="flex items-center">
                <CheckCircleIcon className="w-6 h-6 text-teal-600 mr-3 flex-shrink-0" />
                <span className="text-teal-600">Easy-to-use interface for staff and parents</span>
              </div>
              <div className="flex items-center">
                <CheckCircleIcon className="w-6 h-6 text-teal-600 mr-3 flex-shrink-0" />
                <span className="text-teal-600">Secure and GDPR compliant</span>
              </div>
              <div className="flex items-center">
                <CheckCircleIcon className="w-6 h-6 text-teal-600 mr-3 flex-shrink-0" />
                <span className="text-teal-600">Real-time updates and notifications</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="lg:hidden text-center mb-8">
              <div className="flex items-center justify-center mb-4">
                <img src="https://res.cloudinary.com/dfxypnsvt/image/upload/v1757098381/bookonlogo_aq6lq3.png" alt="BookOn Logo" className="h-12 w-auto" />
              </div>
              <p className="text-lg text-gray-600">Simple. Seamless. Bookings.</p>
            </div>

            {/* Login Form */}
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Welcome back
                </h2>
                <p className="text-gray-600">
                  Manage your school clubs, activities & bookings
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00806a] focus:border-[#00806a] transition-colors duration-200"
                    placeholder="Enter your email"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00806a] focus:border-[#00806a] transition-colors duration-200"
                      placeholder="Enter your password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="w-5 h-5" />
                      ) : (
                        <EyeIcon className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      className="h-4 w-4 text-[#00806a] focus:ring-[#00806a] border-gray-300 rounded"
                    />
                    <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                      Remember me
                    </label>
                  </div>
                  <Link
                    to="/forgot-password"
                    className="text-sm text-[#00806a] hover:text-[#006d5a] font-medium"
                  >
                    Forgot password?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#00806a] hover:bg-[#006d5a] text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#00806a] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>

              {/* Reassurance Line */}
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-500">
                  Secure login — GDPR compliant & trusted by schools & clubs.
                </p>
              </div>

              {/* Divider */}
              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">New to BookOn?</span>
                  </div>
                </div>
              </div>

              {/* Sign Up Link */}
              <div className="mt-6 text-center">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center w-full px-4 py-3 border border-[#00806a] text-[#00806a] font-semibold rounded-lg hover:bg-[#00806a] hover:text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#00806a] focus:ring-offset-2"
                >
                  Create Account
                </Link>
              </div>
            </div>

            {/* Trust Indicators */}
            <div className="mt-8 text-center">
              <div className="flex items-center justify-center space-x-6 text-sm text-gray-500">
                <div className="flex items-center">
                  <CheckCircleIcon className="w-4 h-4 text-green-500 mr-1" />
                  <span>GDPR Compliant</span>
                </div>
                <div className="flex items-center">
                  <CheckCircleIcon className="w-4 h-4 text-green-500 mr-1" />
                  <span>SSL Secure</span>
                </div>
                <div className="flex items-center">
                  <CheckCircleIcon className="w-4 h-4 text-green-500 mr-1" />
                  <span>UK Based</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
