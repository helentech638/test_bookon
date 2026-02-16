import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EyeIcon, EyeSlashIcon, ArrowLeftIcon, UserIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { authService } from '../../services/authService';

type RegistrationType = 'parent' | 'business';

const RegisterPage: React.FC = () => {
  const [registrationType, setRegistrationType] = useState<RegistrationType | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    surname: '',
    contactNumber: '',
    email: '',
    password: '',
    confirmPassword: '',
    // Business-specific fields
    businessName: '',
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const navigate = useNavigate();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({ 
      ...prev, 
      [name]: value 
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.firstName) newErrors.firstName = 'First name is required';
    if (!formData.surname) newErrors.surname = 'Surname is required';
    if (!formData.contactNumber) newErrors.contactNumber = 'Contact number is required';
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=\[\]{};':"\\|,.<>\/?])/.test(formData.password)) {
      newErrors.password = 'Password must have uppercase, lowercase, number, and special character (!@#$%^&* etc)';
    }
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    // Business-specific validation
    if (registrationType === 'business' && !formData.businessName) {
      newErrors.businessName = 'Business name is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    try {
      // Call the actual registration API
      const response = await authService.register({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.surname,
        phone: formData.contactNumber,
        role: registrationType === 'business' ? 'business' : 'parent',
        businessName: registrationType === 'business' ? formData.businessName : undefined
      });
      
      if (response.success) {
        // Registration successful - redirect to login page
        navigate('/login', { 
          state: { 
            message: 'Registration successful! Please log in with your credentials.',
            email: formData.email 
          } 
        });
      }
    } catch (error) {
      console.error('Registration failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Registration failed. Please try again.';
      setErrors({ general: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  // If no registration type selected, show selection screen
  if (!registrationType) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50">
        {/* Desktop Header */}
        <div className="hidden md:block bg-white/80 backdrop-blur-sm shadow-lg border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => navigate(-1)}
                  className="p-2 -ml-2 text-gray-600 hover:text-gray-900 transition-colors duration-200"
                >
                  <ArrowLeftIcon className="h-6 w-6" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Create Your Account</h1>
                  <p className="text-gray-600 mt-1">Choose your account type to get started</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <img 
                  src="https://res.cloudinary.com/dfxypnsvt/image/upload/v1757098381/bookonlogo_aq6lq3.png" 
                  alt="BookOn Logo" 
                  className="h-10 w-auto" 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-gray-200 bg-white">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2"
          >
            <ArrowLeftIcon className="h-6 w-6 text-gray-600" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Create Account</h1>
          <div className="w-10"></div>
        </div>

        {/* Registration Type Selection */}
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-[calc(100vh-200px)] px-4 sm:px-6 lg:px-8">
            <div className="w-full max-w-2xl">
              <Card className="p-6 sm:p-8 shadow-xl border-0 bg-white/95 backdrop-blur-sm">
                <div className="text-center mb-8">
                  <img 
                    src="https://res.cloudinary.com/dfxypnsvt/image/upload/v1757098381/bookonlogo_aq6lq3.png" 
                    alt="BookOn Logo" 
                    className="h-12 w-auto mx-auto mb-4" 
                  />
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose Your Account Type</h2>
                  <p className="text-gray-600">Select the option that best describes you</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Parent Option */}
                  <button
                    onClick={() => setRegistrationType('parent')}
                    className="group p-6 border-2 border-gray-200 rounded-xl hover:border-[#00806a] hover:shadow-lg transition-all duration-200 text-left"
                  >
                    <div className="flex items-center mb-4">
                      <div className="p-3 bg-blue-100 group-hover:bg-[#00806a] group-hover:text-white rounded-lg transition-colors duration-200">
                        <UserIcon className="h-6 w-6 text-blue-600 group-hover:text-white" />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 ml-3">Parent</h3>
                    </div>
                    <p className="text-gray-600 mb-4">
                      Book activities for your children and manage their schedules
                    </p>
                    <ul className="text-sm text-gray-500 space-y-1">
                      <li>• Book activities for your children</li>
                      <li>• Manage permissions and medical info</li>
                      <li>• Track attendance and payments</li>
                      <li>• Receive notifications and updates</li>
                    </ul>
                  </button>

                  {/* Business Option */}
                  <button
                    onClick={() => setRegistrationType('business')}
                    className="group p-6 border-2 border-gray-200 rounded-xl hover:border-[#00806a] hover:shadow-lg transition-all duration-200 text-left"
                  >
                    <div className="flex items-center mb-4">
                      <div className="p-3 bg-green-100 group-hover:bg-[#00806a] group-hover:text-white rounded-lg transition-colors duration-200">
                        <BuildingOfficeIcon className="h-6 w-6 text-green-600 group-hover:text-white" />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 ml-3">Business</h3>
                    </div>
                    <p className="text-gray-600 mb-4">
                      Manage your venue, activities, and bookings
                    </p>
                    <ul className="text-sm text-gray-500 space-y-1">
                      <li>• Create and manage activities</li>
                      <li>• Handle bookings and payments</li>
                      <li>• Manage staff and schedules</li>
                      <li>• Access analytics and reports</li>
                    </ul>
                  </button>
                </div>

                {/* Sign In Link */}
                <div className="text-center mt-8">
                  <p className="text-gray-600">
                    Already have an account?{' '}
                    <Link
                      to="/login"
                      className="font-semibold text-[#00806a] hover:text-[#006d5a] transition-colors duration-200"
                    >
                      Sign in here
                    </Link>
                  </p>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Registration form based on selected type
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50">
      {/* Desktop Header */}
      <div className="hidden md:block bg-white/80 backdrop-blur-sm shadow-lg border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setRegistrationType(null)}
                className="p-2 -ml-2 text-gray-600 hover:text-gray-900 transition-colors duration-200"
              >
                <ArrowLeftIcon className="h-6 w-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {registrationType === 'parent' ? 'Parent Registration' : 'Business Registration'}
                </h1>
                <p className="text-gray-600 mt-1">
                  {registrationType === 'parent' 
                    ? 'Create your parent account to book activities' 
                    : 'Create your business account to manage activities'
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <img 
                src="https://res.cloudinary.com/dfxypnsvt/image/upload/v1757098381/bookonlogo_aq6lq3.png" 
                alt="BookOn Logo" 
                className="h-10 w-auto" 
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <button
          onClick={() => setRegistrationType(null)}
          className="p-2 -ml-2"
        >
          <ArrowLeftIcon className="h-6 w-6 text-gray-600" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900">
          {registrationType === 'parent' ? 'Parent Signup' : 'Business Signup'}
        </h1>
        <div className="w-10"></div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-center min-h-[calc(100vh-200px)] px-4 sm:px-6 lg:px-8">
          <div className="w-full max-w-md">
            <Card className="p-6 sm:p-8 shadow-xl border-0 bg-white/95 backdrop-blur-sm">
              <div className="text-center mb-8">
                <img 
                  src="https://res.cloudinary.com/dfxypnsvt/image/upload/v1757098381/bookonlogo_aq6lq3.png" 
                  alt="BookOn Logo" 
                  className="h-12 w-auto mx-auto mb-4" 
                />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {registrationType === 'parent' ? 'Parent Registration' : 'Business Registration'}
                </h2>
                <p className="text-gray-600">
                  {registrationType === 'parent' 
                    ? 'Create your parent account' 
                    : 'Create your business account'
                  }
                </p>
              </div>

              {errors.general && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{errors.general}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Business Name Field - Only for Business */}
                {registrationType === 'business' && (
                  <div>
                    <label htmlFor="businessName" className="block text-sm font-medium text-gray-700 mb-1">
                      Business Name *
                    </label>
                    <input
                      type="text"
                      id="businessName"
                      name="businessName"
                      value={formData.businessName}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#00806a] focus:border-transparent transition-colors duration-200 ${
                        errors.businessName ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Enter your business name"
                    />
                    {errors.businessName && (
                      <p className="mt-1 text-sm text-red-600">{errors.businessName}</p>
                    )}
                  </div>
                )}

                {/* Name Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#00806a] focus:border-transparent transition-colors duration-200 ${
                        errors.firstName ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Enter your first name"
                    />
                    {errors.firstName && (
                      <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="surname" className="block text-sm font-medium text-gray-700 mb-1">
                      Surname *
                    </label>
                    <input
                      type="text"
                      id="surname"
                      name="surname"
                      value={formData.surname}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#00806a] focus:border-transparent transition-colors duration-200 ${
                        errors.surname ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Enter your surname"
                    />
                    {errors.surname && (
                      <p className="mt-1 text-sm text-red-600">{errors.surname}</p>
                    )}
                  </div>
                </div>

                {/* Contact Number */}
                <div>
                  <label htmlFor="contactNumber" className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Number *
                  </label>
                  <input
                    type="tel"
                    id="contactNumber"
                    name="contactNumber"
                    value={formData.contactNumber}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#00806a] focus:border-transparent transition-colors duration-200 ${
                      errors.contactNumber ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter your contact number"
                  />
                  {errors.contactNumber && (
                    <p className="mt-1 text-sm text-red-600">{errors.contactNumber}</p>
                  )}
                </div>

                {/* Email Field */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#00806a] focus:border-transparent transition-colors duration-200 ${
                      errors.email ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter your email address"
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                  )}
                </div>

                {/* Password Fields */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-[#00806a] focus:border-transparent transition-colors duration-200 ${
                        errors.password ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Create a strong password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                      ) : (
                        <EyeIcon className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      id="confirmPassword"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-[#00806a] focus:border-transparent transition-colors duration-200 ${
                        errors.confirmPassword ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Confirm your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showConfirmPassword ? (
                        <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                      ) : (
                        <EyeIcon className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                  )}
                </div>

                {/* Submit Button */}
                <div className="pt-4">
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-[#00806a] to-[#006d5a] hover:from-[#006d5a] hover:to-[#004d3a] text-white py-4 text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    {isLoading ? 'Creating Account...' : 'Create Account'}
                  </Button>
                </div>
              </form>

              {/* Sign In Link */}
              <div className="text-center mt-8">
                <p className="text-gray-600">
                  Already have an account?{' '}
                  <Link
                    to="/login"
                    className="font-semibold text-[#00806a] hover:text-[#006d5a] transition-colors duration-200"
                  >
                    Sign in here
                  </Link>
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;