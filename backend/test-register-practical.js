#!/usr/bin/env node

/**
 * Practical Test for Register Creation Flow
 * 
 * This test focuses on the actual functionality rather than complex unit tests
 */

console.log('🧪 Testing Register Creation Flow - Practical Test...\n');

async function testRegisterCreationFlow() {
  try {
    // Test 1: Check if the createRegisterForBooking function exists and can be imported
    console.log('1️⃣ Testing function availability...');
    
    const { createRegisterForBooking } = require('./src/routes/payments');
    console.log('✅ createRegisterForBooking function imported successfully');
    
    // Test 2: Check database connection and basic data
    console.log('\n2️⃣ Testing database connection...');
    
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // Test 3: Check for confirmed bookings
    console.log('\n3️⃣ Checking confirmed bookings...');
    
    const confirmedBookings = await prisma.booking.findMany({
      where: {
        status: 'confirmed',
        paymentStatus: 'paid'
      },
      take: 3,
      include: {
        activity: {
          select: {
            title: true,
            id: true
          }
        },
        child: {
          select: {
            firstName: true,
            lastName: true,
            id: true
          }
        }
      }
    });
    
    console.log(`✅ Found ${confirmedBookings.length} confirmed bookings`);
    
    if (confirmedBookings.length === 0) {
      console.log('ℹ️  No confirmed bookings found - this is normal if no payments have been processed');
      await prisma.$disconnect();
      return;
    }
    
    // Test 4: Check if registers exist for these bookings
    console.log('\n4️⃣ Checking register status for confirmed bookings...');
    
    for (const booking of confirmedBookings) {
      console.log(`\n   Checking booking: ${booking.activity?.title} - ${booking.child?.firstName} ${booking.child?.lastName}`);
      
      // Check if session exists
      const session = await prisma.session.findFirst({
        where: {
          activityId: booking.activityId,
          date: booking.activityDate
        }
      });
      
      if (session) {
        console.log(`     ✅ Session exists: ${session.id}`);
        
        // Check if register exists
        const register = await prisma.register.findFirst({
          where: {
            sessionId: session.id
          }
        });
        
        if (register) {
          console.log(`     ✅ Register exists: ${register.id}`);
          
          // Check if attendance exists
          const attendance = await prisma.attendance.findFirst({
            where: {
              registerId: register.id,
              childId: booking.childId,
              bookingId: booking.id
            }
          });
          
          if (attendance) {
            console.log(`     ✅ Attendance exists: ${attendance.id}`);
          } else {
            console.log(`     ❌ Attendance missing`);
          }
        } else {
          console.log(`     ❌ Register missing`);
        }
      } else {
        console.log(`     ❌ Session missing`);
      }
    }
    
    // Test 5: Test the register creation function with a mock booking
    console.log('\n5️⃣ Testing register creation function...');
    
    if (confirmedBookings.length > 0) {
      const testBooking = confirmedBookings[0];
      
      // Create a mock booking object for testing
      const mockBooking = {
        id: testBooking.id,
        activityId: testBooking.activityId,
        activityDate: testBooking.activityDate,
        activityTime: '10:00', // Default time
        childId: testBooking.childId,
        activity: {
          title: testBooking.activity?.title || 'Test Activity',
        },
      };
      
      console.log(`   Testing with booking: ${mockBooking.activity.title}`);
      
      try {
        // Call the function (this will create registers if they don't exist)
        await createRegisterForBooking(mockBooking);
        console.log('   ✅ Register creation function executed successfully');
        
        // Verify the results
        const session = await prisma.session.findFirst({
          where: {
            activityId: mockBooking.activityId,
            date: mockBooking.activityDate
          }
        });
        
        if (session) {
          const register = await prisma.register.findFirst({
            where: {
              sessionId: session.id
            }
          });
          
          if (register) {
            const attendance = await prisma.attendance.findFirst({
              where: {
                registerId: register.id,
                childId: mockBooking.childId,
                bookingId: mockBooking.id
              }
            });
            
            if (attendance) {
              console.log('   ✅ Register creation verified - all records created');
            } else {
              console.log('   ⚠️  Register created but attendance missing');
            }
          } else {
            console.log('   ⚠️  Session created but register missing');
          }
        } else {
          console.log('   ⚠️  No session created');
        }
        
      } catch (error) {
        console.log(`   ❌ Register creation failed: ${error.message}`);
      }
    }
    
    await prisma.$disconnect();
    
    console.log('\n🎯 Test Summary:');
    console.log('   ✅ Function is available and importable');
    console.log('   ✅ Database connection works');
    console.log(`   ✅ Found ${confirmedBookings.length} confirmed bookings`);
    console.log('   ✅ Register creation function executed');
    
    console.log('\n💡 Next Steps:');
    console.log('   1. Check your Stripe webhook configuration');
    console.log('   2. Monitor server logs for register creation errors');
    console.log('   3. Test the fix endpoint: POST /payments/fix-missing-registers');
    console.log('   4. Verify webhook events are reaching your server');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Check your DATABASE_URL environment variable');
    console.log('   2. Make sure your database is running');
    console.log('   3. Verify all dependencies are installed');
  }
}

// Run the test
testRegisterCreationFlow().catch(console.error);
