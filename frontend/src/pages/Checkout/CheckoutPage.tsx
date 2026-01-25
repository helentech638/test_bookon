import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useBasket } from '../../contexts/CartContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { 
  CreditCardIcon, 
  TagIcon, 
  CheckIcon,
  XMarkIcon,
  ArrowLeftIcon,
  CurrencyPoundIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import authService from '../../services/authService';
import { buildApiUrl } from '../../config/api';

interface CheckoutData {
  basketItems: any[];
  totalPrice: number;
  totalItems: number;
}

interface DiscountCode {
    code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minAmount?: number;
  valid: boolean;
}

const CheckoutPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { clearBasket } = useBasket();
  
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [creditBalance, setCreditBalance] = useState<number>(0);
  const [useCreditBalance, setUseCreditBalance] = useState<boolean>(false);
  const [discountCode, setDiscountCode] = useState<string>('');
  const [appliedDiscount, setAppliedDiscount] = useState<DiscountCode | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (location.state?.basketItems) {
      setCheckoutData(location.state);
      fetchCreditBalance();
    } else {
      toast.error('No items found for checkout');
      navigate('/basket');
    }
  }, [location.state, navigate]);

  const fetchCreditBalance = async () => {
    try {
      const token = authService.getToken();
      if (!token) return;

      const response = await fetch(buildApiUrl('/user/credit-balance'), {
          headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCreditBalance(data.balance || 0);
      }
    } catch (error) {
      console.error('Error fetching credit balance:', error);
    }
  };

  const validateDiscountCode = async (code: string) => {
    if (!code.trim()) return;

    try {
      setLoading(true);
      const token = authService.getToken();
      
      const response = await fetch(buildApiUrl('/discounts/validate'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: code.trim(),
          amount: checkoutData?.totalPrice || 0
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.valid) {
          setAppliedDiscount(data.discount);
          toast.success(`Discount code "${code}" applied!`);
        } else {
          setAppliedDiscount(null);
          toast.error(data.message || 'Invalid discount code');
        }
      } else {
        setAppliedDiscount(null);
        toast.error('Invalid discount code');
      }
    } catch (error) {
      console.error('Error validating discount code:', error);
      toast.error('Error validating discount code');
    } finally {
      setLoading(false);
    }
  };

  const removeDiscountCode = () => {
    setAppliedDiscount(null);
    setDiscountCode('');
    toast.success('Discount code removed');
  };

  const calculateDiscountAmount = () => {
    if (!appliedDiscount || !checkoutData) return 0;
    
    const subtotal = checkoutData.totalPrice;
    if (appliedDiscount.type === 'percentage') {
      return (subtotal * appliedDiscount.value) / 100;
    } else {
      return Math.min(appliedDiscount.value, subtotal);
    }
  };

  const calculateFinalTotal = () => {
    if (!checkoutData) return 0;
    
    const subtotal = checkoutData.totalPrice;
    const discountAmount = calculateDiscountAmount();
    const creditAmount = useCreditBalance ? Math.min(creditBalance, subtotal - discountAmount) : 0;
    
    return Math.max(0, subtotal - discountAmount - creditAmount);
  };

  const handleCheckout = async () => {
    if (!checkoutData || !user) return;

    try {
      setProcessing(true);
      const token = authService.getToken();

      // Create bookings first (following course checkout pattern)
      const bookingIds: string[] = [];
      
      // Prepare all booking requests
      const bookingRequests: Promise<any>[] = [];
      
      for (const item of checkoutData.basketItems) {
        if (item.bookingType === 'course') {
          // Course bookings need all children in one request
          const bookingPayload = {
            activityId: item.activityId,
            children: item.children,
            bookingType: 'course',
            amount: item.price,
            courseSchedule: item.courseSchedule,
            totalWeeks: item.totalWeeks
          };

          console.log('Sending course booking payload:', bookingPayload);

          const bookingRequest = Promise.race([
            fetch(buildApiUrl('/bookings'), {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(bookingPayload),
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Request timeout')), 30000)
            )
          ]).then(async (response: any) => {
            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.message || 'Failed to create course booking');
            }
            return response.json();
          });

          bookingRequests.push(bookingRequest);
        } else {
          // Regular bookings (activity, holiday_club, wraparound_care) - create booking for each child
          for (const child of item.children) {
            // Parse time to get start time (before the dash)
            const timeParts = item.time.split(' - ');
            const startTime = timeParts[0] || '09:00';
            
            // Ensure date is in ISO format
            const startDate = new Date(item.date).toISOString();
            
            const bookingPayload = {
              activityId: item.activityId,
              childId: child.id,
              childName: child.name,
              bookingType: item.bookingType || 'activity',
              amount: item.price / item.children.length, // Split price among children
              startDate: startDate,
              startTime: startTime,
              // Send sessionBlockId for activities and wraparound care that use session blocks
              ...((item.bookingType === 'activity' || item.bookingType === 'wraparound_care') && item.sessionBlockId && { sessionBlockId: item.sessionBlockId }),
              // Send holidayTimeSlotId for holiday club bookings
              ...(item.bookingType === 'holiday_club' && item.holidayTimeSlotId && { holidayTimeSlotId: item.holidayTimeSlotId })
            };


            const bookingRequest = Promise.race([
              fetch(buildApiUrl('/bookings'), {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(bookingPayload),
              }),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Request timeout')), 30000)
              )
            ]).then(async (response: any) => {
              if (!response.ok) {
                const errorData = await response.json();
                console.error('Booking creation failed:', errorData);
                throw new Error(errorData.message || 'Failed to create booking');
              }
              const result = await response.json();
              return result;
            }).catch(error => {
              console.error('Booking request error:', error);
              throw error;
            });

            bookingRequests.push(bookingRequest);
          }
        }
      }

      // Execute all booking requests in parallel
      if (bookingRequests.length === 0) {
        throw new Error('No booking requests to execute');
      }
      
      const bookingResults = await Promise.allSettled(bookingRequests);
      
      // Process results
      for (const result of bookingResults) {
        if (result.status === 'fulfilled') {
          const bookingData = result.value;
          if (bookingData.success && bookingData.data) {
            // Handle different booking response structures
            if (bookingData.data.courseBookings) {
              bookingIds.push(...bookingData.data.courseBookings.map((b: any) => b.id));
            } else if (bookingData.data.id) {
              bookingIds.push(bookingData.data.id);
            } else if (Array.isArray(bookingData.data)) {
              bookingIds.push(...bookingData.data.map((b: any) => b.id));
            }
          }
        } else {
          console.error('Booking request failed:', result.reason);
          throw new Error(result.reason.message || 'Failed to create booking');
        }
      }

      if (bookingIds.length === 0) {
        throw new Error('No bookings were created');
      }


      // If final total is 0 (covered by credits/discounts), process directly
      if (calculateFinalTotal() === 0) {
        // Update bookings with payment status
        for (const bookingId of bookingIds) {
          await fetch(buildApiUrl(`/bookings/${bookingId}/confirm-payment`), {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              paymentMethod: 'credit',
              amount: calculateFinalTotal()
            }),
          });
        }

        clearBasket();
        toast.success('Checkout successful!');
        navigate('/checkout/success', {
          state: {
            success: true,
            message: 'Your bookings have been confirmed!',
            bookingIds: bookingIds,
            totalAmount: checkoutData.totalPrice,
            discountAmount: calculateDiscountAmount(),
            creditAmount: useCreditBalance ? Math.min(creditBalance, checkoutData.totalPrice - calculateDiscountAmount()) : 0
          }
        });
      } else {
        // Create payment intent for card payment (following course checkout pattern)
      const finalAmount = calculateFinalTotal();
        
        
        const paymentResponse = await fetch(buildApiUrl('/payments/create-intent'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            amount: finalAmount,
            bookingIds: bookingIds,
            paymentMethod: 'card',
            successUrl: `${window.location.origin}/checkout/success`,
            cancelUrl: `${window.location.origin}/basket`,
            metadata: {
              type: 'basket_checkout',
              itemCount: checkoutData.basketItems.length,
              subtotal: checkoutData.totalPrice,
              discountAmount: calculateDiscountAmount(),
              creditAmount: useCreditBalance ? Math.min(creditBalance, checkoutData.totalPrice - calculateDiscountAmount()) : 0,
              discountCode: appliedDiscount?.code || ''
            }
          })
        });

        if (!paymentResponse.ok) {
          throw new Error('Failed to create payment intent');
        }

        const paymentData = await paymentResponse.json();
        
        // Navigate to payment page with payment intent
        navigate('/checkout/payment', {
          state: {
            paymentIntent: paymentData.data,
            checkoutData: checkoutData,
            discountData: appliedDiscount,
            creditAmount: useCreditBalance ? Math.min(creditBalance, checkoutData.totalPrice - calculateDiscountAmount()) : 0,
            bookingIds: bookingIds
          }
        });
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error(error instanceof Error ? error.message : 'Checkout failed');
    } finally {
      setProcessing(false);
    }
  };

  if (!checkoutData) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Loading...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
        <button
              onClick={() => navigate('/basket')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
              <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
        </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Checkout</h1>
              <p className="text-gray-600">Complete your booking</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Order Summary */}
          <div className="space-y-6">
        <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>
              
              <div className="space-y-4">
                {checkoutData.basketItems.map((item, index) => (
                  <div key={index} className="border-b pb-4 last:border-b-0">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{item.activityName}</h3>
                        <p className="text-sm text-gray-600">{item.venueName}</p>
                        <p className="text-sm text-gray-600">
                          {new Date(item.date).toLocaleDateString()} at {item.time}
                        </p>
                        
                        {/* Show children names */}
                        <div className="mt-2">
                          <p className="text-sm font-medium text-gray-700">
                            {item.children.length} child{item.children.length > 1 ? 'ren' : ''}:
                          </p>
                          <div className="ml-2 space-y-1">
                            {item.children.map((child: any, childIndex: number) => (
                              <p key={childIndex} className="text-sm text-gray-600">
                                • {child.name}
                              </p>
                            ))}
              </div>
            </div>

                        {/* Show pro-rata information if available */}
                        {(item as any).bookingType === 'course' && (item as any).pricePerChild && (
                          <div className="mt-2 p-2 bg-blue-50 rounded-md">
                            <p className="text-xs text-blue-700">
                              Pro-rata pricing: £{(item as any).pricePerChild.toFixed(2)} per child
                              {item.children.length > 1 && (
                                <span className="ml-1">
                                  (Total: £{item.price.toFixed(2)})
                                </span>
                              )}
                            </p>
                          </div>
                        )}
                </div>
                <div className="text-right">
                        <span className="font-medium text-gray-900">£{item.price.toFixed(2)}</span>
                        {(item as any).bookingType === 'course' && (item as any).pricePerChild && item.children.length > 1 && (
                          <p className="text-xs text-gray-500">
                            £{(item as any).pricePerChild.toFixed(2)} × {item.children.length}
                          </p>
                        )}
              </div>
            </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Payment Options */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Options</h2>
              
              {/* Credit Balance */}
              {creditBalance > 0 && (
                <div className="mb-4">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useCreditBalance}
                      onChange={(e) => setUseCreditBalance(e.target.checked)}
                      className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-900">
                        Use Credit Balance
                      </span>
                      <p className="text-sm text-gray-600">
                        Available: £{creditBalance.toFixed(2)}
                      </p>
                    </div>
                    <CurrencyPoundIcon className="h-5 w-5 text-teal-600" />
                  </label>
                </div>
              )}

              {/* Discount Code */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-900">
                  Discount Code
                </label>
                <div className="flex space-x-2">
                  <Input
                    type="text"
                    placeholder="Enter discount code"
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => validateDiscountCode(discountCode)}
                    disabled={loading || !discountCode.trim()}
                    variant="outline"
                    className="px-4"
                  >
                    {loading ? 'Validating...' : 'Apply'}
                  </Button>
                </div>
                
                {appliedDiscount && (
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <CheckIcon className="h-5 w-5 text-green-600" />
                      <span className="text-sm font-medium text-green-800">
                        {appliedDiscount.code} applied
                      </span>
                    </div>
                    <button
                      onClick={removeDiscountCode}
                      className="text-green-600 hover:text-green-800"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                )}
            </div>
          </Card>
          </div>

        {/* Payment Summary */}
          <div>
            <Card className="p-6 sticky top-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Summary</h2>
              
          <div className="space-y-3">
            <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">£{checkoutData.totalPrice.toFixed(2)}</span>
            </div>
            
                {appliedDiscount && (
              <div className="flex justify-between text-green-600">
                    <span>Discount ({appliedDiscount.code})</span>
                    <span>-£{calculateDiscountAmount().toFixed(2)}</span>
              </div>
            )}
            
                {useCreditBalance && (
                  <div className="flex justify-between text-teal-600">
                    <span>Credit Balance</span>
                    <span>-£{Math.min(creditBalance, checkoutData.totalPrice - calculateDiscountAmount()).toFixed(2)}</span>
              </div>
            )}
            
            <div className="border-t pt-3">
                  <div className="flex justify-between">
                    <span className="text-lg font-semibold text-gray-900">Total</span>
                    <span className="text-lg font-semibold text-gray-900">
                      £{calculateFinalTotal().toFixed(2)}
                    </span>
              </div>
            </div>
          </div>
              
          <Button
                onClick={handleCheckout}
                disabled={processing || calculateFinalTotal() < 0}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white py-3 mt-6"
              >
                {processing ? (
                  'Creating Bookings...'
                ) : (
                  <>
            <CreditCardIcon className="h-5 w-5 mr-2" />
                    Complete Payment
                  </>
                )}
          </Button>
              
              {calculateFinalTotal() === 0 && (
                <p className="text-sm text-gray-600 text-center mt-2">
                  Payment covered by credit balance and discounts
                </p>
              )}
            </Card>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;