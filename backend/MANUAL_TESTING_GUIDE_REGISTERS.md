are you # Manual Testing Guide: Register Creation Flow

## 🧪 **COMPLETE MANUAL TESTING FLOW**

This guide will help you manually test the register creation system to verify it's working correctly.

## 📋 **PRE-TEST SETUP**

### **1. Prerequisites**
- ✅ Backend server running (`npm start` or `npm run dev`)
- ✅ Database connected and accessible
- ✅ Stripe webhook endpoint configured
- ✅ Test user account with booking permissions
- ✅ Test activity/session data in database

### **2. Test Data Requirements**
You'll need:
- A confirmed booking with `status: 'confirmed'` and `paymentStatus: 'paid'`
- An activity with sessions
- A child profile
- A parent user account

## 🔄 **TESTING FLOW OPTIONS**

### **OPTION A: Test Complete Booking Flow (Recommended)**

#### **Step 1: Create a Test Booking**
```bash
# 1. Start your backend server
npm start

# 2. Create a test booking via API or admin panel
POST /bookings
{
  "activityId": "your-activity-id",
  "childId": "your-child-id", 
  "parentId": "your-parent-id",
  "activityDate": "2025-10-26",
  "activityTime": "10:00",
  "amount": 25.00,
  "paymentMethod": "card"
}
```

#### **Step 2: Process Payment (Simulate Stripe Webhook)**
```bash
# Simulate successful payment webhook
POST /payments/webhook
{
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_test_123",
      "amount": 2500,
      "status": "succeeded",
      "metadata": {
        "bookingId": "your-booking-id"
      }
    }
  }
}
```

#### **Step 3: Verify Register Creation**
```bash
# Check if register was created automatically
GET /registers?activityId=your-activity-id&date=2025-10-26

# Check if attendance record was created
GET /registers/register-id/attendance
```

### **OPTION B: Test Fix Endpoint (Quick Test)**

#### **Step 1: Check for Orphaned Bookings**
```bash
# Query database for confirmed bookings without registers
# You can use this SQL query:
SELECT b.id, b.activity_id, b.activity_date, a.title, c.firstName, c.lastName
FROM bookings b
JOIN activities a ON b.activity_id = a.id  
JOIN children c ON b.child_id = c.id
WHERE b.status = 'confirmed' 
AND b.payment_status = 'paid'
AND NOT EXISTS (
  SELECT 1 FROM registers r
  JOIN sessions s ON r.session_id = s.id
  WHERE s.activity_id = b.activity_id
  AND s.date = b.activity_date
);
```

#### **Step 2: Run Fix Endpoint**
```bash
# Use the fix endpoint to create missing registers
POST /payments/fix-missing-registers
Authorization: Bearer YOUR_AUTH_TOKEN
Content-Type: application/json
```

#### **Step 3: Verify Fix Results**
```bash
# Check if registers were created
GET /registers?activityId=your-activity-id&date=2025-10-26

# Verify attendance records
GET /registers/register-id/attendance
```

### **OPTION C: Test Individual Components**

#### **Step 1: Test Register Creation Function**
```bash
# Test the createRegisterForBooking function directly
# You can create a simple test script:

node -e "
const { createRegisterForBooking } = require('./src/routes/payments');
const testBooking = {
  id: 'test-booking-123',
  activityId: 'your-activity-id',
  activityDate: new Date('2025-10-26'),
  activityTime: '10:00',
  childId: 'your-child-id',
  activity: { title: 'Test Activity' }
};

createRegisterForBooking(testBooking)
  .then(result => console.log('✅ Register created:', result))
  .catch(error => console.log('❌ Error:', error.message));
"
```

## 🔍 **VERIFICATION CHECKLIST**

### **What to Check After Each Test:**

#### **1. Database Verification**
```sql
-- Check if session exists
SELECT * FROM sessions WHERE activity_id = 'your-activity-id' AND date = '2025-10-26';

-- Check if register exists  
SELECT * FROM registers WHERE session_id = (SELECT id FROM sessions WHERE activity_id = 'your-activity-id' AND date = '2025-10-26');

-- Check if attendance exists
SELECT * FROM attendance WHERE booking_id = 'your-booking-id';
```

#### **2. API Response Verification**
```bash
# Check register endpoint
GET /registers/register-id
# Should return register with attendance data

# Check booking status
GET /bookings/your-booking-id  
# Should show status: 'confirmed', paymentStatus: 'paid'
```

#### **3. Log Verification**
Check your server logs for:
- ✅ "Register created successfully" messages
- ✅ "Attendance record created" messages  
- ❌ Any error messages about register creation

## 📊 **EXPECTED RESULTS**

### **Successful Test Results:**
1. **Session Created**: A session record exists for the activity and date
2. **Register Created**: A register record exists for the session
3. **Attendance Created**: An attendance record exists linking the child to the register
4. **Booking Status**: Booking remains 'confirmed' with 'paid' status
5. **No Errors**: No error messages in logs

### **Common Issues to Watch For:**
1. **Missing Session**: Session not created for the activity/date
2. **Missing Register**: Register not created for the session
3. **Missing Attendance**: Attendance record not created
4. **Database Errors**: Foreign key constraint violations
5. **Permission Errors**: Authentication/authorization issues

## 🛠️ **TROUBLESHOOTING GUIDE**

### **If Register Creation Fails:**

#### **Check 1: Database Connection**
```bash
# Test database connectivity
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.\$connect()
  .then(() => console.log('✅ Database connected'))
  .catch(err => console.log('❌ Database error:', err.message))
  .finally(() => prisma.\$disconnect());
"
```

#### **Check 2: Service Availability**
```bash
# Check if services are properly exported
node -e "
try {
  const { createRegisterForBooking } = require('./src/routes/payments');
  console.log('✅ createRegisterForBooking available');
} catch (error) {
  console.log('❌ Service not available:', error.message);
}
"
```

#### **Check 3: Webhook Configuration**
- Verify Stripe webhook endpoint is configured
- Check webhook logs in Stripe dashboard
- Ensure webhook events are reaching your server

#### **Check 4: Environment Variables**
```bash
# Check required environment variables
echo $DATABASE_URL
echo $STRIPE_SECRET_KEY
echo $STRIPE_WEBHOOK_SECRET
```

## 📝 **TEST REPORT TEMPLATE**

### **Test Results Documentation:**
```
Test Date: ___________
Tester: ___________
Backend Version: ___________

Test Scenario: ___________
Booking ID: ___________
Activity ID: ___________
Child ID: ___________

Results:
□ Session Created: Yes/No
□ Register Created: Yes/No  
□ Attendance Created: Yes/No
□ Booking Status: ___________
□ Error Messages: ___________

Notes:
___________
___________
```

## 🎯 **QUICK TEST COMMANDS**

### **One-Line Tests:**

```bash
# Test 1: Check for orphaned bookings
node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.booking.count({ where: { status: 'confirmed', paymentStatus: 'paid' } }).then(count => { console.log('Confirmed bookings:', count); prisma.\$disconnect(); });"

# Test 2: Check register count
node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.register.count().then(count => { console.log('Total registers:', count); prisma.\$disconnect(); });"

# Test 3: Check attendance count  
node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.attendance.count().then(count => { console.log('Total attendance records:', count); prisma.\$disconnect(); });"
```

## 📞 **SUPPORT**

If you encounter any issues during testing:
1. **Check server logs** for error messages
2. **Verify database connectivity** 
3. **Test individual components** using the one-line commands
4. **Share test results** using the template above

**Ready to test? Start with Option B (Fix Endpoint) for the quickest verification!**
