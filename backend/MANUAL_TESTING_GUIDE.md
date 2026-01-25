# Manual Testing Guide: Register Creation Flow

## Overview
This guide helps you manually test the register creation flow to identify why registers might not be created automatically when completing bookings.

## Prerequisites
- Backend server running
- Database accessible
- Stripe webhook endpoint configured
- Test user account with booking permissions

## Test Scenarios

### 1. Test Register Creation Function Directly

**Endpoint:** `POST /payments/fix-missing-registers`

**Steps:**
1. Create a test booking with status 'confirmed' and paymentStatus 'paid'
2. Ensure no register exists for this booking
3. Call the fix endpoint
4. Verify register, session, and attendance are created

**Expected Result:**
```json
{
  "success": true,
  "message": "Successfully created registers for 1 bookings",
  "data": { "fixed": 1 }
}
```

### 2. Test Payment Webhook Flow

**Steps:**
1. Create a test payment with Stripe test mode
2. Simulate payment success webhook
3. Check if register is created automatically
4. Verify booking status changes to 'confirmed'

**Webhook Payload Example:**
```json
{
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_test_123",
      "amount": 2000,
      "currency": "gbp",
      "status": "succeeded"
    }
  }
}
```

### 3. Test Course Booking Register Creation

**Endpoint:** `POST /bookings/fix-course-registers`

**Steps:**
1. Create a course booking with multiple sessions
2. Call the course register fix endpoint
3. Verify registers are created for all sessions

### 4. Database Verification

**Check these tables after each test:**

```sql
-- Check if session was created
SELECT * FROM sessions 
WHERE activity_id = 'your-activity-id' 
AND date = '2024-01-15';

-- Check if register was created
SELECT * FROM registers 
WHERE session_id = 'your-session-id';

-- Check if attendance was created
SELECT * FROM attendance 
WHERE register_id = 'your-register-id' 
AND child_id = 'your-child-id';
```

## Common Issues and Solutions

### Issue 1: Webhook Not Reaching Server
**Symptoms:**
- Payment succeeds but booking status remains 'pending'
- No register created

**Solutions:**
1. Check Stripe webhook configuration
2. Verify webhook endpoint URL is accessible
3. Check server logs for webhook errors
4. Test webhook endpoint manually

### Issue 2: Database Constraint Violations
**Symptoms:**
- Webhook received but register creation fails
- Error logs show constraint violations

**Solutions:**
1. Check foreign key relationships
2. Verify all required fields are present
3. Check for duplicate records
4. Review database schema

### Issue 3: Silent Failures
**Symptoms:**
- No error logs but registers not created
- Payment succeeds but no register

**Solutions:**
1. Add more detailed logging
2. Check error handling in createRegisterForBooking
3. Verify database connection
4. Test with smaller data sets

## Debugging Commands

### Check Recent Bookings
```sql
SELECT b.*, a.title, c.first_name, c.last_name 
FROM bookings b
JOIN activities a ON b.activity_id = a.id
JOIN children c ON b.child_id = c.id
WHERE b.status = 'confirmed' 
AND b.payment_status = 'paid'
ORDER BY b.created_at DESC
LIMIT 10;
```

### Check Missing Registers
```sql
SELECT b.id, b.activity_id, b.activity_date, a.title
FROM bookings b
JOIN activities a ON b.activity_id = a.id
WHERE b.status = 'confirmed' 
AND b.payment_status = 'paid'
AND NOT EXISTS (
  SELECT 1 FROM registers r
  JOIN sessions s ON r.session_id = s.id
  WHERE s.activity_id = b.activity_id
  AND s.date = b.activity_date
);
```

### Check Webhook Logs
```bash
# Check recent webhook events
grep "webhook" /var/log/your-app.log | tail -20

# Check payment processing logs
grep "payment.*success" /var/log/your-app.log | tail -10
```

## Test Data Setup

### Create Test User
```sql
INSERT INTO users (id, email, first_name, last_name, password_hash, role, is_active)
VALUES ('test-user-123', 'test@example.com', 'Test', 'User', 'hashed_password', 'parent', true);
```

### Create Test Activity
```sql
INSERT INTO activities (id, title, description, start_date, end_date, start_time, end_time, capacity, price, venue_id, owner_id, created_by, status, is_active)
VALUES ('test-activity-123', 'Test Swimming', 'Test activity', '2024-01-01', '2024-12-31', '10:00', '11:00', 20, 25.00, 'venue-id', 'test-user-123', 'test-user-123', 'active', true);
```

### Create Test Booking
```sql
INSERT INTO bookings (id, parent_id, activity_id, child_id, activity_date, activity_time, status, amount, payment_status, payment_method)
VALUES ('test-booking-123', 'test-user-123', 'test-activity-123', 'test-child-123', '2024-01-15', '10:00', 'confirmed', 25.00, 'paid', 'card');
```

## Monitoring and Alerts

### Set up Log Monitoring
```bash
# Monitor register creation errors
tail -f /var/log/your-app.log | grep "Failed to create register"

# Monitor webhook errors  
tail -f /var/log/your-app.log | grep "webhook.*error"
```

### Database Monitoring
```sql
-- Check for orphaned bookings (confirmed but no register)
SELECT COUNT(*) as orphaned_bookings
FROM bookings b
WHERE b.status = 'confirmed' 
AND b.payment_status = 'paid'
AND NOT EXISTS (
  SELECT 1 FROM registers r
  JOIN sessions s ON r.session_id = s.id
  WHERE s.activity_id = b.activity_id
  AND s.date = b.activity_date
);
```

## Success Criteria

✅ **Test Passes When:**
- Payment webhook triggers register creation
- All confirmed bookings have corresponding registers
- Sessions, registers, and attendance records are properly linked
- Error handling works correctly
- Fix endpoints can recover missing registers

❌ **Test Fails When:**
- Registers are not created after payment success
- Database constraints prevent creation
- Webhook processing fails silently
- Fix endpoints don't work for existing bookings
