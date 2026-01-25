#!/usr/bin/env node

/**
 * Manual Test Script for Register Creation Flow
 * 
 * This script helps you manually test the register creation functionality
 * without running the full test suite.
 */

const { PrismaClient } = require('@prisma/client');

// Initialize Prisma client
const prisma = new PrismaClient();

async function testRegisterCreation() {
  console.log('🧪 Testing Register Creation Flow...\n');

  try {
    // 1. Check for confirmed bookings without registers
    console.log('1️⃣ Checking for confirmed bookings without registers...');
    
    const orphanedBookings = await prisma.$queryRaw`
      SELECT b.id, b.activity_id, b.activity_date, a.title, c.first_name, c.last_name
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
      )
      LIMIT 5;
    `;

    console.log(`Found ${orphanedBookings.length} bookings without registers:`);
    orphanedBookings.forEach((booking, index) => {
      console.log(`   ${index + 1}. ${booking.title} - ${booking.first_name} ${booking.last_name} (${booking.activity_date})`);
    });

    if (orphanedBookings.length === 0) {
      console.log('✅ All confirmed bookings have registers!');
      return;
    }

    // 2. Test the fix endpoint
    console.log('\n2️⃣ Testing register creation for first booking...');
    
    const testBooking = orphanedBookings[0];
    console.log(`Testing with booking: ${testBooking.title} - ${testBooking.first_name} ${testBooking.last_name}`);

    // Import the function
    const { createRegisterForBooking } = require('../src/routes/payments');
    
    // Create a mock booking object
    const mockBooking = {
      id: testBooking.id,
      activityId: testBooking.activity_id,
      activityDate: new Date(testBooking.activity_date),
      activityTime: '10:00', // Default time
      childId: testBooking.child_id,
      activity: {
        title: testBooking.title,
      },
    };

    // Test register creation
    await createRegisterForBooking(mockBooking);
    console.log('✅ Register creation function executed successfully');

    // 3. Verify register was created
    console.log('\n3️⃣ Verifying register was created...');
    
    const createdSession = await prisma.session.findFirst({
      where: {
        activityId: testBooking.activity_id,
        date: new Date(testBooking.activity_date),
      },
    });

    if (createdSession) {
      console.log(`✅ Session created: ${createdSession.id}`);
      
      const createdRegister = await prisma.register.findFirst({
        where: {
          sessionId: createdSession.id,
        },
      });

      if (createdRegister) {
        console.log(`✅ Register created: ${createdRegister.id}`);
        
        const createdAttendance = await prisma.attendance.findFirst({
          where: {
            registerId: createdRegister.id,
            childId: testBooking.child_id,
            bookingId: testBooking.id,
          },
        });

        if (createdAttendance) {
          console.log(`✅ Attendance created: ${createdAttendance.id}`);
        } else {
          console.log('❌ Attendance not created');
        }
      } else {
        console.log('❌ Register not created');
      }
    } else {
      console.log('❌ Session not created');
    }

    // 4. Check remaining orphaned bookings
    console.log('\n4️⃣ Checking remaining orphaned bookings...');
    
    const remainingOrphaned = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM bookings b
      WHERE b.status = 'confirmed' 
      AND b.payment_status = 'paid'
      AND NOT EXISTS (
        SELECT 1 FROM registers r
        JOIN sessions s ON r.session_id = s.id
        WHERE s.activity_id = b.activity_id
        AND s.date = b.activity_date
      );
    `;

    console.log(`Remaining orphaned bookings: ${remainingOrphaned[0].count}`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testRegisterCreation().catch(console.error);
