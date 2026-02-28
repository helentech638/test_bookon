import React, { useState } from 'react';
import { ClockIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import TFCInstructionPanel from './TFCInstructionPanel';

interface TFCConfig {
  enabled: boolean;
  providerName: string;
  providerNumber: string;
  holdPeriodDays: number;
  instructionText: string;
  bankDetails: {
    accountName: string;
    sortCode: string;
    accountNumber: string;
  };
}

interface TFCPaymentOptionProps {
  selected: boolean;
  onSelect: () => void;
  amount: number;
  venueId: string;
  onTFCSelected: (data: {
    paymentReference: string;
    deadline: Date;
    amount: number;
  }) => void;
  disabled?: boolean;
}

const TFCPaymentOption: React.FC<TFCPaymentOptionProps> = ({
  selected,
  onSelect,
  amount,
  venueId,
  onTFCSelected,
  disabled = false
}) => {
  const [showInstructionPanel, setShowInstructionPanel] = useState(false);
  const [tfcConfig, setTfcConfig] = useState<TFCConfig | null>(null);
  const [loading, setLoading] = useState(false);

  const handleTFCSelect = async () => {
    if (disabled) return;

    setLoading(true);
    try {
      // Fetch TFC configuration for this venue
      const token = localStorage.getItem('bookon_token');
      const response = await fetch(`/api/v1/tfc/config/${venueId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTfcConfig(data.data);
        setShowInstructionPanel(true);
      } else {
        throw new Error('Failed to load TFC configuration');
      }
    } catch (error) {
      console.error('Error loading TFC config:', error);
      alert('Failed to load Tax-Free Childcare options. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleProceed = () => {
    if (!tfcConfig) return;

    // Generate payment reference
    const paymentReference = `TFC-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Calculate deadline
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + tfcConfig.holdPeriodDays);

    // Call parent callback
    onTFCSelected({
      paymentReference,
      deadline,
      amount
    });

    // Close instruction panel and select TFC
    setShowInstructionPanel(false);
    onSelect();
  };

  const handleCancel = () => {
    setShowInstructionPanel(false);
  };

  const handleCopyReference = () => {
    // This could trigger analytics or logging
    console.log('TFC reference copied');
  };

  if (showInstructionPanel && tfcConfig) {
    return (
      <TFCInstructionPanel
        config={tfcConfig}
        paymentReference={`TFC-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`}
        amount={amount}
        deadline={new Date(Date.now() + tfcConfig.holdPeriodDays * 24 * 60 * 60 * 1000)}
        onCopyReference={handleCopyReference}
        onProceed={handleProceed}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={handleTFCSelect}
      disabled={disabled || loading}
      className={`w-full p-4 border rounded-md text-left transition-colors ${selected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 hover:border-gray-400'
        } ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <div className="flex items-center">
        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
          <ClockIcon className="w-4 h-4 text-green-600" />
        </div>
        <div className="flex-1">
          <div className="font-medium text-gray-900">Tax-Free Childcare</div>
          <div className="text-sm text-gray-500">
            Pay via your HMRC account (booking held pending payment)
          </div>
          {loading && (
            <div className="text-sm text-blue-600 mt-1">
              Loading payment options...
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="font-medium text-gray-900">
            £{amount.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">
            Pending
          </div>
        </div>
      </div>

      {/* TFC Benefits */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="flex items-center space-x-4 text-xs text-gray-600">
          <div className="flex items-center space-x-1">
            <ExclamationTriangleIcon className="w-3 h-3" />
            <span>5-day hold period</span>
          </div>
          <div className="flex items-center space-x-1">
            <ClockIcon className="w-3 h-3" />
            <span>Manual confirmation</span>
          </div>
        </div>
      </div>
    </button>
  );
};

export default TFCPaymentOption;