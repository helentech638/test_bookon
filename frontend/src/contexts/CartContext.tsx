import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface BasketItem {
  id: string;
  activityId: string;
  activityName: string;
  venueName: string;
  date: string;
  time: string;
  price: number;
  children: Array<{
    id: string;
    name: string;
  }>;
  // Additional fields for different booking types
  bookingType?: 'course' | 'activity' | 'holiday_club' | 'wraparound_care';
  pricePerChild?: number; // For pro-rata pricing
  courseSchedule?: string; // For course bookings
  totalWeeks?: number; // For course bookings
  sessionId?: string; // For activity bookings
  timeSlotId?: string; // For activity bookings
  sessionName?: string; // For activity bookings
  holidayTimeSlotId?: string; // For holiday club bookings
}

// Keep CartItem for backward compatibility
export interface CartItem extends BasketItem {}

interface BasketContextType {
  items: BasketItem[];
  addToBasket: (item: BasketItem) => void;
  removeFromBasket: (id: string) => void;
  clearBasket: () => void;
  getTotalPrice: () => number;
  getTotalItems: () => number;
}

const BasketContext = createContext<BasketContextType | undefined>(undefined);

export const useBasket = () => {
  const context = useContext(BasketContext);
  if (context === undefined) {
    throw new Error('useBasket must be used within a BasketProvider');
  }
  return context;
};

interface BasketProviderProps {
  children: ReactNode;
}

// localStorage key for basket persistence
const BASKET_STORAGE_KEY = 'bookon_basket_items';

// Helper functions for localStorage
const saveBasketToStorage = (items: BasketItem[]) => {
  try {
    localStorage.setItem(BASKET_STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.warn('Failed to save basket to localStorage:', error);
  }
};

const loadBasketFromStorage = (): BasketItem[] => {
  try {
    const saved = localStorage.getItem(BASKET_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.warn('Failed to load basket from localStorage:', error);
  }
  return [];
};

export const BasketProvider: React.FC<BasketProviderProps> = ({ children }) => {
  const [items, setItems] = useState<BasketItem[]>(() => loadBasketFromStorage()); // Initialize from localStorage

  // Load basket from localStorage on component mount
  useEffect(() => {
    const savedItems = loadBasketFromStorage();
    if (savedItems.length > 0) {
      setItems(savedItems);
    }
  }, []);

  // Save basket to localStorage whenever items change
  useEffect(() => {
    if (items.length > 0) {
      saveBasketToStorage(items);
    } else {
      // Clear localStorage when basket is empty
      localStorage.removeItem(BASKET_STORAGE_KEY);
    }
  }, [items]);

  const addToBasket = (item: BasketItem) => {
    setItems(prev => {
      const newItems = [...prev, item];
      return newItems;
    });
  };

  const removeFromBasket = (id: string) => {
    setItems(prev => {
      const newItems = prev.filter(item => item.id !== id);
      return newItems;
    });
  };

  const clearBasket = () => {
    setItems([]);
    localStorage.removeItem(BASKET_STORAGE_KEY);
  };

  const getTotalPrice = () => {
    return items.reduce((total, item) => total + item.price, 0);
  };

  const getTotalItems = () => {
    return items.reduce((total, item) => total + item.children.length, 0);
  };

  const value: BasketContextType = {
    items,
    addToBasket,
    removeFromBasket,
    clearBasket,
    getTotalPrice,
    getTotalItems,
  };

  return (
    <BasketContext.Provider value={value}>
      {children}
    </BasketContext.Provider>
  );
};
