import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import BusinessLayout from '../../components/layout/BusinessLayout';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

const RegisterEditPage: React.FC = () => {
  const { registerId } = useParams<{ registerId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <BusinessLayout user={user}>
      {/* Mobile Layout */}
      <div className="block md:hidden">
        <div className="bg-white min-h-screen">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <button
              onClick={() => navigate(`/business/registers/${registerId}`)}
              className="p-2"
            >
              <ArrowLeftIcon className="h-6 w-6 text-gray-600" />
            </button>
            <h1 className="text-lg font-bold text-gray-900">Edit Register</h1>
            <div className="w-10"></div>
          </div>

          {/* Coming Soon Content */}
          <div className="px-4 py-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ArrowLeftIcon className="h-8 w-8 text-gray-400" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Edit Register</h2>
              <p className="text-gray-600 mb-6">
                Register editing functionality is coming soon. For now, you can view the register details.
              </p>
              <button
                onClick={() => navigate(`/business/registers/${registerId}`)}
                className="w-full bg-teal-600 text-white font-medium py-3 px-4 rounded-lg hover:bg-teal-700 transition-colors"
              >
                View Register
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:block">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/business/registers/${registerId}`)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Edit Register</h1>
                <p className="text-gray-600">Modify register details and settings</p>
              </div>
            </div>
          </div>

          {/* Coming Soon Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
            <div className="text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <ArrowLeftIcon className="h-10 w-10 text-gray-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Edit Register</h2>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                Register editing functionality is coming soon. For now, you can view the register details and manage attendance.
              </p>
              <button
                onClick={() => navigate(`/business/registers/${registerId}`)}
                className="bg-teal-600 text-white font-medium py-3 px-8 rounded-lg hover:bg-teal-700 transition-colors"
              >
                View Register
              </button>
            </div>
          </div>
        </div>
      </div>
    </BusinessLayout>
  );
};

export default RegisterEditPage;