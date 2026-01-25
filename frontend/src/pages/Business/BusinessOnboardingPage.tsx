import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { toast } from 'react-hot-toast';
import { buildApiUrl } from '../../config/api';
import { 
  BuildingOfficeIcon,
  GlobeAltIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  DocumentTextIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

interface BusinessOnboardingData {
  businessName: string;
  tradingName: string;
  companyRegistrationNumber: string;
  businessType: string;
  businessDescription: string;
  websiteUrl: string;
  businessPhone: string;
  businessEmail: string;
  businessAddress: string;
  businessCity: string;
  businessPostcode: string;
  businessCountry: string;
}

const BusinessOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<BusinessOnboardingData>({
    businessName: '',
    tradingName: '',
    companyRegistrationNumber: '',
    businessType: '',
    businessDescription: '',
    websiteUrl: '',
    businessPhone: '',
    businessEmail: '',
    businessAddress: '',
    businessCity: '',
    businessPostcode: '',
    businessCountry: 'United Kingdom'
  });

  const businessTypes = [
    'Sole Trader',
    'Limited Company (Ltd)',
    'Public Limited Company (PLC)',
    'Partnership',
    'Limited Liability Partnership (LLP)',
    'Charity',
    'Community Interest Company (CIC)',
    'Franchise',
    'Other'
  ];

  const handleInputChange = (field: keyof BusinessOnboardingData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(formData.businessName && formData.businessType);
      case 2:
        return !!(formData.businessPhone && formData.businessEmail);
      case 3:
        return !!(formData.businessAddress && formData.businessCity && formData.businessPostcode);
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 4));
    } else {
      toast.error('Please fill in all required fields');
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      toast.error('Please complete all required fields');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('bookon_token');
      const response = await fetch(buildApiUrl('/auth/business-onboarding'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to complete onboarding');
      }

      toast.success('Business profile completed successfully!');
      navigate('/business/dashboard');
    } catch (error: any) {
      console.error('Onboarding error:', error);
      toast.error(error.message || 'Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <BuildingOfficeIcon className="w-16 h-16 text-[#00806a] mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900">Business Information</h2>
              <p className="text-gray-600 mt-2">Tell us about your business</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Business Name *
              </label>
              <Input
                value={formData.businessName}
                onChange={(e) => handleInputChange('businessName', e.target.value)}
                placeholder="Enter your business name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Trading Name (if different)
              </label>
              <Input
                value={formData.tradingName}
                onChange={(e) => handleInputChange('tradingName', e.target.value)}
                placeholder="Enter trading name if different"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Business Type *
              </label>
              <Select
                value={formData.businessType}
                onChange={(e) => handleInputChange('businessType', e.target.value)}
                required
              >
                <option value="">Select business type</option>
                {businessTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Registration Number
              </label>
              <Input
                value={formData.companyRegistrationNumber}
                onChange={(e) => handleInputChange('companyRegistrationNumber', e.target.value)}
                placeholder="Enter company registration number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Business Description
              </label>
              <Textarea
                value={formData.businessDescription}
                onChange={(e) => handleInputChange('businessDescription', e.target.value)}
                placeholder="Describe your business and services"
                rows={4}
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <PhoneIcon className="w-16 h-16 text-[#00806a] mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900">Contact Information</h2>
              <p className="text-gray-600 mt-2">How can parents reach you?</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Business Phone Number *
              </label>
              <Input
                value={formData.businessPhone}
                onChange={(e) => handleInputChange('businessPhone', e.target.value)}
                placeholder="Enter business phone number"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Business Email *
              </label>
              <Input
                type="email"
                value={formData.businessEmail}
                onChange={(e) => handleInputChange('businessEmail', e.target.value)}
                placeholder="Enter business email address"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Website URL
              </label>
              <Input
                value={formData.websiteUrl}
                onChange={(e) => handleInputChange('websiteUrl', e.target.value)}
                placeholder="https://your-website.com"
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <MapPinIcon className="w-16 h-16 text-[#00806a] mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900">Business Address</h2>
              <p className="text-gray-600 mt-2">Where is your business located?</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Address *
              </label>
              <Textarea
                value={formData.businessAddress}
                onChange={(e) => handleInputChange('businessAddress', e.target.value)}
                placeholder="Enter your business address"
                rows={3}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  City *
                </label>
                <Input
                  value={formData.businessCity}
                  onChange={(e) => handleInputChange('businessCity', e.target.value)}
                  placeholder="Enter city"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Postcode *
                </label>
                <Input
                  value={formData.businessPostcode}
                  onChange={(e) => handleInputChange('businessPostcode', e.target.value)}
                  placeholder="Enter postcode"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Country
              </label>
              <Select
                value={formData.businessCountry}
                onChange={(e) => handleInputChange('businessCountry', e.target.value)}
              >
                <option value="United Kingdom">United Kingdom</option>
                <option value="United States">United States</option>
                <option value="Canada">Canada</option>
                <option value="Australia">Australia</option>
                <option value="Other">Other</option>
              </Select>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900">Review & Complete</h2>
              <p className="text-gray-600 mt-2">Please review your business information</p>
            </div>

            <div className="bg-gray-50 p-6 rounded-lg space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Business Information</h3>
                <p><span className="font-medium">Name:</span> {formData.businessName}</p>
                {formData.tradingName && <p><span className="font-medium">Trading Name:</span> {formData.tradingName}</p>}
                <p><span className="font-medium">Type:</span> {formData.businessType}</p>
                {formData.companyRegistrationNumber && <p><span className="font-medium">Registration:</span> {formData.companyRegistrationNumber}</p>}
                {formData.businessDescription && <p><span className="font-medium">Description:</span> {formData.businessDescription}</p>}
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Contact Information</h3>
                <p><span className="font-medium">Phone:</span> {formData.businessPhone}</p>
                <p><span className="font-medium">Email:</span> {formData.businessEmail}</p>
                {formData.websiteUrl && <p><span className="font-medium">Website:</span> {formData.websiteUrl}</p>}
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Address</h3>
                <p>{formData.businessAddress}</p>
                <p>{formData.businessCity}, {formData.businessPostcode}</p>
                <p>{formData.businessCountry}</p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-center">
              Complete Your Business Profile
            </CardTitle>
            <div className="flex justify-center mt-4">
              <div className="flex space-x-2">
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      step <= currentStep
                        ? 'bg-[#00806a] text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {step}
                  </div>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {renderStep()}

            <div className="flex justify-between mt-8">
              <Button
                onClick={handlePrevious}
                disabled={currentStep === 1}
                variant="outline"
              >
                Previous
              </Button>

              {currentStep < 4 ? (
                <Button onClick={handleNext}>
                  Next
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="bg-[#00806a] hover:bg-[#006d5a]"
                >
                  {loading ? 'Completing...' : 'Complete Setup'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BusinessOnboardingPage;





