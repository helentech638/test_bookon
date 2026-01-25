import { api } from '../config/api';

export interface Booking {
  id: string;
  bookingNumber?: string;
  childName: string;
  activity: string | {
    id: string;
    title: string;
    description?: string;
    price?: number;
    max_capacity?: number;
    current_capacity?: number;
  };
  venue: string | {
    id: string;
    name: string;
    address?: string;
    city?: string;
  };
  date: string;
  time: string;
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed';
  amount: number;
  paymentStatus: 'paid' | 'pending' | 'refunded' | 'failed';
  createdAt: string;
  notes?: string;
  // API response fields
  child_name?: string;
  activity_name?: string;
  venue_name?: string;
  start_date?: string;
  start_time?: string;
  total_amount?: number;
  payment_status?: string;
  created_at?: string;
}

export interface CreateBookingData {
  childId: number;
  activityId: number;
  venueId: number;
  date: string;
  time: string;
  notes?: string;
}

export interface UpdateBookingData {
  date?: string;
  time?: string;
  notes?: string;
}

class BookingService {
  // Get all bookings for the current user
  async getBookings(): Promise<Booking[]> {
    try {
      const response = await api.get('/bookings');
      return response.data.data; // API returns { success: true, data: [...] }
    } catch (error) {
      console.error('Error fetching bookings:', error);
      throw error;
    }
  }

  // Get a specific booking by ID
  async getBooking(id: string): Promise<Booking> {
    try {
      const response = await api.get(`/bookings/${id}`);
      return response.data.data; // API returns { success: true, data: {...} }
    } catch (error) {
      console.error('BookingService: Error fetching booking:', error);
      throw error;
    }
  }

  // Create a new booking
  async createBooking(data: CreateBookingData): Promise<Booking> {
    try {
      const response = await api.post('/bookings', data);
      return response.data.data; // API returns { success: true, data: {...} }
    } catch (error) {
      console.error('Error creating booking:', error);
      throw error;
    }
  }

  // Update a booking
  async updateBooking(id: string, data: UpdateBookingData): Promise<Booking> {
    try {
      const response = await api.put(`/bookings/${id}`, data);
      return response.data.data; // API returns { success: true, data: {...} }
    } catch (error) {
      console.error('Error updating booking:', error);
      throw error;
    }
  }

  // Confirm a pending booking
  async confirmBooking(id: string): Promise<Booking | { requiresPayment: boolean; bookingId: string; amount: number; paymentMethod: string; paymentStatus: string } | { requiresAdminConfirmation: boolean; bookingId: string; paymentMethod: string; tfcReference: string; tfcDeadline: string; amount: number }> {
    try {
      const response = await api.patch(`/bookings/${id}/confirm`);
      
      // If payment is required, return the payment retry data
      if (!response.data.success && response.data.data?.requiresPayment) {
        return response.data.data;
      }
      
      // If TFC admin confirmation is required, return the TFC data
      if (!response.data.success && response.data.data?.requiresAdminConfirmation) {
        return response.data.data;
      }
      
      return response.data.data; // API returns { success: true, data: {...} }
    } catch (error: any) {
      console.error('Error confirming booking:', error);
      
      // If the error response contains payment requirement info, return it
      if (error.response?.data?.data?.requiresPayment) {
        return error.response.data.data;
      }
      
      // If the error response contains TFC admin confirmation info, return it
      if (error.response?.data?.data?.requiresAdminConfirmation) {
        return error.response.data.data;
      }
      
      throw error;
    }
  }

  // Cancel a confirmed booking
  async cancelBooking(id: string, reason: string = 'Cancelled by user'): Promise<Booking> {
    try {
      console.log('BookingService: Attempting to cancel booking:', { id, reason });
      
      // Validate booking ID
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid booking ID');
      }
      
      // Try the main booking cancellation endpoint first
      try {
        const response = await api.put(`/bookings/${id}/cancel`, { reason });
        console.log('BookingService: Cancellation response:', response.data);
        
        // Handle the response format
        if (response.data.success && response.data.data) {
          return response.data.data; // API returns { success: true, data: {...} }
        } else {
          // If the response doesn't have the expected format, create a mock booking
          return {
            id,
            status: 'cancelled',
            amount: 0,
            paymentStatus: 'refunded',
            createdAt: new Date().toISOString(),
            childName: 'Unknown',
            activity: 'Unknown',
            venue: 'Unknown',
            date: new Date().toISOString(),
            time: '00:00'
          } as Booking;
        }
      } catch (bookingError: any) {
        console.log('BookingService: Main endpoint failed, trying cancellations endpoint:', bookingError.response?.status);
        
        // If the main endpoint fails with 404, try the cancellations endpoint
        if (bookingError.response?.status === 404) {
          console.log('BookingService: Trying cancellations endpoint as fallback');
          const cancellationResponse = await api.post('/cancellations/request', {
            bookingId: id,
            reason
          });
          
          console.log('BookingService: Cancellation fallback response:', cancellationResponse.data);
          
          // Return a mock booking object since the cancellations endpoint doesn't return booking data
          return {
            id,
            status: 'cancelled',
            amount: 0,
            paymentStatus: 'refunded',
            createdAt: new Date().toISOString(),
            childName: 'Unknown',
            activity: 'Unknown',
            venue: 'Unknown',
            date: new Date().toISOString(),
            time: '00:00'
          } as Booking;
        }
        
        // Re-throw the original error if it's not a 404
        throw bookingError;
      }
    } catch (error: any) {
      console.error('BookingService: Error cancelling booking:', {
        bookingId: id,
        reason,
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data
      });
      
      // Provide more specific error messages
      if (error.response?.status === 404) {
        throw new Error('Booking not found or cancellation endpoint not available');
      } else if (error.response?.status === 401) {
        throw new Error('Authentication required. Please log in again.');
      } else if (error.response?.status === 403) {
        throw new Error('You do not have permission to cancel this booking');
      } else if (error.response?.status === 400) {
        const errorMessage = error.response?.data?.message || 'Invalid cancellation request';
        throw new Error(errorMessage);
      } else {
        throw new Error(error.message || 'Failed to cancel booking');
      }
    }
  }

  // Delete a booking
  async deleteBooking(id: string): Promise<void> {
    try {
      await api.delete(`/bookings/${id}`);
    } catch (error) {
      console.error('Error deleting booking:', error);
      throw error;
    }
  }

  // Get bookings by status
  async getBookingsByStatus(status: string): Promise<Booking[]> {
    try {
      const response = await api.get(`/bookings?status=${status}`);
      return response.data.data; // API returns { success: true, data: [...] }
    } catch (error) {
      console.error('Error fetching bookings by status:', error);
      throw error;
    }
  }

  // Get bookings by venue
  async getBookingsByVenue(venueId: number): Promise<Booking[]> {
    try {
      const response = await api.get(`/bookings?venueId=${venueId}`);
      return response.data.data; // API returns { success: true, data: [...] }
    } catch (error) {
      console.error('Error fetching bookings by venue:', error);
      throw error;
    }
  }

  // Search bookings
  async searchBookings(query: string): Promise<Booking[]> {
    try {
      const response = await api.get(`/bookings/search?q=${encodeURIComponent(query)}`);
      return response.data.data; // API returns { success: true, data: [...] }
    } catch (error) {
      console.error('Error searching bookings:', error);
      throw error;
    }
  }
}

export const bookingService = new BookingService();
