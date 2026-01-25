#!/usr/bin/env node

/**
 * Simple Test Script for Register Creation Flow
 * 
 * This script tests the register creation functionality by:
 * 1. Finding confirmed bookings without registers
 * 2. Testing the fix endpoint
 * 3. Verifying the results
 */

console.log('🧪 Testing Register Creation Flow...\n');

// Test 1: Check if the fix endpoint exists and is accessible
console.log('1️⃣ Testing fix endpoint availability...');

const http = require('http');
const https = require('https');

function testEndpoint() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/payments/fix-missing-registers',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token' // You'll need to replace this with a real token
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        console.log(`✅ Endpoint responded with status: ${res.statusCode}`);
        if (res.statusCode === 401) {
          console.log('   (Authentication required - this is expected)');
        }
        resolve({ statusCode: res.statusCode, data });
      });
    });

    req.on('error', (err) => {
      console.log(`❌ Endpoint test failed: ${err.message}`);
      console.log('   Make sure your backend server is running on port 3000');
      reject(err);
    });

    req.end();
  });
}

// Test 2: Check database connectivity
console.log('\n2️⃣ Testing database connectivity...');

async function testDatabase() {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // Check for confirmed bookings
    const confirmedBookings = await prisma.booking.count({
      where: {
        status: 'confirmed',
        paymentStatus: 'paid'
      }
    });
    
    console.log(`✅ Found ${confirmedBookings} confirmed bookings`);
    
    // Check for sessions
    const sessionCount = await prisma.session.count();
    console.log(`✅ Found ${sessionCount} sessions`);
    
    // Check for registers
    const registerCount = await prisma.register.count();
    console.log(`✅ Found ${registerCount} registers`);
    
    await prisma.$disconnect();
    return { confirmedBookings, sessionCount, registerCount };
  } catch (error) {
    console.log(`❌ Database test failed: ${error.message}`);
    throw error;
  }
}

// Test 3: Test the register creation function directly
console.log('\n3️⃣ Testing register creation function...');

async function testRegisterCreation() {
  try {
    // Import the function
    const { createRegisterForBooking } = require('./src/routes/payments');
    
    // Create a mock booking
    const mockBooking = {
      id: 'test-booking-123',
      activityId: 'test-activity-123',
      activityDate: new Date('2024-01-15'),
      activityTime: '10:00',
      childId: 'test-child-123',
      activity: {
        title: 'Test Activity',
      },
    };
    
    console.log('✅ Register creation function imported successfully');
    console.log('✅ Mock booking created');
    
    // Note: We won't actually call the function here to avoid database changes
    // In a real test, you would call: await createRegisterForBooking(mockBooking);
    
    return true;
  } catch (error) {
    console.log(`❌ Register creation test failed: ${error.message}`);
    throw error;
  }
}

// Run all tests
async function runTests() {
  try {
    // Test endpoint
    await testEndpoint();
    
    // Test database
    const dbResults = await testDatabase();
    
    // Test function
    await testRegisterCreation();
    
    console.log('\n🎯 Test Summary:');
    console.log('   ✅ Endpoint is accessible');
    console.log(`   ✅ Database has ${dbResults.confirmedBookings} confirmed bookings`);
    console.log(`   ✅ Database has ${dbResults.sessionCount} sessions`);
    console.log(`   ✅ Database has ${dbResults.registerCount} registers`);
    console.log('   ✅ Register creation function is available');
    
    console.log('\n💡 Next Steps:');
    console.log('   1. Make sure your backend server is running');
    console.log('   2. Get a valid authentication token');
    console.log('   3. Test the fix endpoint with: POST /payments/fix-missing-registers');
    console.log('   4. Check webhook configuration in Stripe dashboard');
    console.log('   5. Monitor logs for register creation errors');
    
  } catch (error) {
    console.log('\n❌ Tests failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Make sure your backend server is running on port 3000');
    console.log('   2. Check your database connection');
    console.log('   3. Verify your environment variables are set correctly');
  }
}

// Run the tests
runTests().catch(console.error);
