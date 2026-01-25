import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useBasket } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { 
  ShoppingCartIcon, 
  TrashIcon, 
  ArrowLeftIcon,
  CreditCardIcon,
  TagIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const CartPage: React.FC = () => {
  const { items, removeFromBasket, clearBasket, getTotalPrice, getTotalItems } = useBasket();
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleRemoveItem = (id: string) => {
    removeFromBasket(id);
    toast.success('Item removed from basket');
  };

  const handleClearBasket = () => {
    clearBasket();
    toast.success('Basket cleared');
  };

  const handleCheckout = () => {
    if (!user) {
      toast.error('Please sign in to continue');
      navigate('/login');
      return;
    }
    
    if (items.length === 0) {
      toast.error('Your basket is empty');
      return;
    }

    // Navigate to checkout with basket items
    navigate('/checkout', { 
      state: { 
        basketItems: items,
        totalPrice: getTotalPrice(),
        totalItems: getTotalItems()
      } 
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              to="/activities"
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Shopping Basket</h1>
              <p className="text-gray-600">{getTotalItems()} items in your basket</p>
            </div>
          </div>
          
          {items.length > 0 && (
            <Button
              onClick={handleClearBasket}
              variant="outline"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <TrashIcon className="h-4 w-4 mr-2" />
              Clear Basket
            </Button>
          )}
        </div>

        {items.length === 0 ? (
          /* Empty Cart */
          <Card className="p-12 text-center">
            <ShoppingCartIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">Your basket is empty</h3>
            <p className="text-gray-600 mb-6">
              Add some activities to your basket to get started.
            </p>
            <Link
              to="/activities"
              className="bg-teal-600 text-white px-6 py-3 rounded-lg hover:bg-teal-700 transition-colors"
            >
              Browse Activities
            </Link>
          </Card>
        ) : (
          /* Cart Items */
          <div className="space-y-6">
            {items.map((item) => (
              <Card key={item.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {item.activityName}
                    </h3>
                    <div className="space-y-1 text-sm text-gray-600">
                      <p><strong>Venue:</strong> {item.venueName}</p>
                      <p><strong>Date:</strong> {new Date(item.date).toLocaleDateString()}</p>
                      <p><strong>Time:</strong> {item.time}</p>
                      <p><strong>Children:</strong> {item.children.map(child => child.name).join(', ')}</p>
                      
                      {/* Show pro-rata information if available */}
                      {(item as any).bookingType === 'course' && (item as any).pricePerChild && (
                        <div className="mt-2 p-2 bg-blue-50 rounded-md">
                          <p className="text-xs text-blue-700">
                            <strong>Pro-rata pricing:</strong> £{(item as any).pricePerChild.toFixed(2)} per child
                            {item.children.length > 1 && (
                              <span className="ml-1">
                                (Total: £{item.price.toFixed(2)})
                              </span>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-semibold text-gray-900">
                        £{item.price.toFixed(2)}
                      </p>
                      {(item as any).bookingType === 'course' && (item as any).pricePerChild && item.children.length > 1 && (
                        <p className="text-xs text-gray-500">
                          £{(item as any).pricePerChild.toFixed(2)} × {item.children.length}
                        </p>
                      )}
                    </div>
                    
                    <Button
                      onClick={() => handleRemoveItem(item.id)}
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}

            {/* Cart Summary */}
            <Card className="p-6 bg-gray-50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Order Summary</h3>
                <span className="text-sm text-gray-600">{getTotalItems()} items</span>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">£{getTotalPrice().toFixed(2)}</span>
                </div>
                
                {/* Credit Balance Usage */}
                <div className="flex justify-between text-teal-600">
                  <span>Credit Balance</span>
                  <span>£0.00</span>
                </div>
                
                {/* Discount Code */}
                <div className="flex justify-between">
                  <span className="text-gray-600">Discount</span>
                  <span className="font-medium">£0.00</span>
                </div>
                
                <div className="border-t pt-3">
                  <div className="flex justify-between">
                    <span className="text-lg font-semibold text-gray-900">Total</span>
                    <span className="text-lg font-semibold text-gray-900">
                      £{getTotalPrice().toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 space-y-3">
                <Button
                  onClick={handleCheckout}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white py-3"
                >
                  <CreditCardIcon className="h-5 w-5 mr-2" />
                  Proceed to Checkout
                </Button>
                
                <Link
                  to="/activities"
                  className="block w-full text-center text-teal-600 hover:text-teal-700 py-2"
                >
                  Continue Shopping
                </Link>
              </div>
            </Card>
          </div>
        )}
    </div>
  );
};

export default CartPage;
