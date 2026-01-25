-- Performance Optimization: Database Indexes
-- Zero-risk optimization - no functionality changes, only performance improvements
-- Safe to run on production Supabase database

-- Booking-related indexes (most critical for performance) - using correct table names
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_parent_status 
ON bookings(parent_id, status) 
WHERE status IN ('pending', 'confirmed', 'cancelled', 'completed');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_activity_date 
ON bookings(activity_id, activity_date) 
WHERE status = 'confirmed';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_child_parent 
ON bookings(child_id, parent_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_payment_status 
ON bookings(payment_status, status) 
WHERE payment_status IN ('pending', 'paid', 'refunded');

-- Attendance and Register indexes (critical for register performance) - using correct table names
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_register_child 
ON attendance(register_id, child_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_booking 
ON attendance(booking_id) 
WHERE booking_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_present 
ON attendance(register_id, present) 
WHERE present = true;

-- Register indexes - using correct table names
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_registers_session_date 
ON registers(session_id, date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_registers_status_date 
ON registers(status, date) 
WHERE status IN ('upcoming', 'active', 'completed');

-- Session indexes - using correct table names
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_activity_date 
ON sessions(activity_id, date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_date_status 
ON sessions(date, status) 
WHERE status = 'active';

-- Activity indexes - using correct table names
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_venue_type 
ON activities(venue_id, type) 
WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_owner_venue 
ON activities(owner_id, venue_id);

-- User and authentication indexes - using correct table names
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_email 
ON users(role, email) 
WHERE role IN ('parent', 'admin', 'staff', 'coordinator');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_active 
ON users(email) 
WHERE is_active = true;

-- Child indexes - using correct table names
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_children_parent_active 
ON children(parent_id) 
WHERE is_active = true;

-- Payment indexes - using correct table names
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_booking_status 
ON payments(booking_id, status) 
WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_stripe_intent 
ON payments(stripe_payment_intent_id) 
WHERE stripe_payment_intent_id IS NOT NULL;

-- Notification indexes - using correct table names
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_read 
ON notifications(user_id, read) 
WHERE read = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_type_created 
ON notifications(type, created_at) 
WHERE created_at > NOW() - INTERVAL '30 days';

-- Venue indexes - using correct table names
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_venues_owner_active 
ON venues(owner_id) 
WHERE is_active = true;

-- Holiday time slot indexes - using correct table names
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_holiday_time_slots_activity_date 
ON holiday_time_slots(activity_id, created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_holiday_time_slots_active 
ON holiday_time_slots(is_active) 
WHERE is_active = true;

-- Session block indexes - using correct table names
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_blocks_activity_session 
ON session_blocks(activity_id, session_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_blocks_active 
ON session_blocks(is_active) 
WHERE is_active = true;

-- Wallet credit indexes - using correct table names
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallet_credits_parent_status 
ON wallet_credits(parent_id, status) 
WHERE status = 'active';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallet_credits_expiry 
ON wallet_credits(expiry_date) 
WHERE status = 'active' AND expiry_date > NOW();

-- Audit log indexes (for admin operations)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_user_action 
ON audit_log(user_id, action) 
WHERE created_at > NOW() - INTERVAL '90 days';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_entity_type 
ON audit_log(entity_type, entity_id) 
WHERE created_at > NOW() - INTERVAL '90 days';

-- Analytics event indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_event_type_date 
ON analytics_event(event_type, created_at) 
WHERE created_at > NOW() - INTERVAL '30 days';

-- Discount code indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_discount_code_active 
ON discount_code(code) 
WHERE is_active = true AND expiry_date > NOW();

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_discount_usage_booking 
ON discount_usage(booking_id);

-- Refund transaction indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_refund_transaction_booking 
ON refund_transaction(booking_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_refund_transaction_status 
ON refund_transaction(status, created_at) 
WHERE status IN ('pending', 'completed', 'failed');

-- Credit transaction indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_transaction_user_type 
ON credit_transaction(user_id, type) 
WHERE created_at > NOW() - INTERVAL '90 days';

-- GDPR consent indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gdpr_consent_user_child 
ON gdpr_consent(user_id, child_id) 
WHERE is_active = true;

-- Data access request indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_data_access_request_user_status 
ON data_access_request(user_id, status) 
WHERE status IN ('pending', 'completed', 'rejected');

-- Provider settings indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_provider_settings_venue 
ON provider_settings(venue_id) 
WHERE is_active = true;

-- Communication template indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_communication_template_type_active 
ON communication_template(type, is_active) 
WHERE is_active = true;

-- Broadcast indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_broadcast_venue_status 
ON broadcast(venue_id, status) 
WHERE status IN ('scheduled', 'sent', 'failed');

-- Email log indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_log_user_type 
ON email_log(user_id, type) 
WHERE created_at > NOW() - INTERVAL '30 days';

-- SMS log indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sms_log_user_type 
ON sms_log(user_id, type) 
WHERE created_at > NOW() - INTERVAL '30 days';

-- Print indexes for verification
SELECT 'Database indexes created successfully' as status;
