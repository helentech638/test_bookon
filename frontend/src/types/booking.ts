export interface HolidayTimeSlot {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  price: number;
  capacity: number;
  bookingsCount: number;
  isActive: boolean;
}

export interface SessionBlock {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  price: number;
  capacity: number;
  bookingsCount: number;
  isActive: boolean;
}

export interface Activity {
  id: string;
  name: string;
  description?: string;
  category: string;
  type?: string;
  venue_id: string;
  excludeDates?: string[];
  max_capacity: number;
  current_capacity: number;
  price: number;
  duration: number;
  age_range?: {
    min: number;
    max: number;
  };
  skill_level?: string;
  instructor?: string;
  schedule?: any;
  images?: string[];
  tags?: string[];
  rating?: number;
  reviewCount?: number;
  is_active: boolean;
  start_date?: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  startDate?: string;
  endDate?: string;
  // Holiday Club specific fields
  holidayTimeSlots?: HolidayTimeSlot[];
  // Wraparound Care specific fields
  sessionBlocks?: SessionBlock[];
  isWraparoundCare?: boolean;
  yearGroups?: string[];
  // Course/Program specific fields
  regular_day?: string;
  regular_time?: string;
  duration_weeks?: number;
  regularDay?: string;
  regularTime?: string;
  durationWeeks?: number;
  // General activity scheduling fields
  daysOfWeek?: string[];
  proRataBooking?: boolean;
  holidaySessions?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Venue {
  id: string;
  name: string;
  description?: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
  website?: string;
  capacity?: number;
  amenities?: string[];
  images?: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Child {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender?: 'male' | 'female' | 'other';
  medical_info?: string;
  emergency_contact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  user_id: string;
  activity_id: string;
  venue_id: string;
  child_id: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  amount: number;
  currency: string;
  booking_date: string;
  activity_date: string;
  activity_time: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  booking_id: string;
  stripe_payment_intent_id?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed' | 'cancelled';
  payment_method?: any;
  paid_at?: string;
  created_at: string;
  updated_at: string;
}

export interface BookingFormData {
  activity_id: string;
  child_id: string;
  date: string;
  time: string;
  notes?: string;
}

export interface BookingResponse {
  success: boolean;
  message: string;
  data: {
    booking: Booking;
    payment?: Payment;
  };
}

export interface ActivitySearchParams {
  venue_id?: string;
  category?: string;
  date?: string;
  age_range?: {
    min: number;
    max: number;
  };
  price_min?: number;
  price_max?: number;
  available_only?: boolean;
}

export interface VenueSearchParams {
  city?: string;
  state?: string;
  has_activities?: boolean;
  available_dates?: string[];
}
