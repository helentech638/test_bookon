-- Fix Booking status constraints to include TFC statuses
-- This migration adds proper enum constraints for booking statuses

-- First, let's check if we need to update any existing data
-- Update any existing 'pending' status to 'confirmed' if payment is 'paid'
UPDATE bookings 
SET status = 'confirmed' 
WHERE status = 'pending' AND payment_status = 'paid';

-- Update any existing 'pending' status to 'tfc_pending' if payment_method is 'tfc'
UPDATE bookings 
SET status = 'tfc_pending' 
WHERE status = 'pending' AND payment_method = 'tfc';

-- Add constraints for status field
ALTER TABLE bookings ADD CONSTRAINT check_booking_status 
CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'tfc_pending', 'expired'));

-- Add constraints for payment_status field  
ALTER TABLE bookings ADD CONSTRAINT check_payment_status
CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'pending_payment', 'part_paid', 'cancelled'));

-- Add constraints for payment_method field
ALTER TABLE bookings ADD CONSTRAINT check_payment_method
CHECK (payment_method IN ('card', 'tfc', 'wallet', 'cash', 'bank_transfer'));

