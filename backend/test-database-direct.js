#!/usr/bin/env node

/**
 * Direct Database Test for Register Creation Flow
 */

console.log('🧪 Testing Register Creation Flow - Database Check...\n');

async function testDatabaseDirectly() {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    console.log('1️⃣ Connecting to database...');
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    console.log('\n2️⃣ Checking confirmed bookings...');
    const confirmedBookings = await prisma.booking.count({
      where: {
        status: 'confirmed',
        paymentStatus: 'paid'
      }
    });
    console.log(`✅ Found ${confirmedBookings} confirmed bookings`);
    
    console.log('\n3️⃣ Checking sessions...');
    const sessionCount = await prisma.session.count();
    console.log(`✅ Found ${sessionCount} sessions`);
    
    console.log('\n4️⃣ Checking registers...');
    const registerCount = await prisma.register.count();
    console.log(`✅ Found ${registerCount} registers`);
    
    console.log('\n5️⃣ Checking attendance records...');
    const attendanceCount = await prisma.attendance.count();
    console.log(`✅ Found ${attendanceCount} attendance records`);
    
    console.log('\n6️⃣ Looking for orphaned bookings (confirmed but no register)...');
    
    // Get some confirmed bookings to check
    const sampleBookings = await prisma.booking.findMany({
      where: {
        status: 'confirmed',
        paymentStatus: 'paid'
      },
      take: 5,
      include: {
        activity: {
          select: {
            title: true
          }
        },
        child: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });
    
    console.log(`Found ${sampleBookings.length} sample confirmed bookings:`);
    
    let orphanedCount = 0;
    for (const booking of sampleBookings) {
      // Check if there's a register for this booking
      const hasRegister = await prisma.register.findFirst({
        where: {
          session: {
            activityId: booking.activityId,
            date: booking.activityDate
          }
        }
      });
      
      if (!hasRegister) {
        orphanedCount++;
        console.log(`   ❌ ${booking.activity?.title} - ${booking.child?.firstName} ${booking.child?.lastName} (${booking.activityDate}) - NO REGISTER`);
      } else {
        console.log(`   ✅ ${booking.activity?.title} - ${booking.child?.firstName} ${booking.child?.lastName} (${booking.activityDate}) - HAS REGISTER`);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Confirmed bookings: ${confirmedBookings}`);
    console.log(`   Sessions: ${sessionCount}`);
    console.log(`   Registers: ${registerCount}`);
    console.log(`   Attendance records: ${attendanceCount}`);
    console.log(`   Orphaned bookings (in sample): ${orphanedCount}/${sampleBookings.length}`);
    
    if (orphanedCount > 0) {
      console.log(`\n🔧 Action needed: ${orphanedCount} bookings need registers created`);
      console.log(`   Run: POST /payments/fix-missing-registers`);
    } else {
      console.log(`\n✅ All sample bookings have registers!`);
    }
    
    await prisma.$disconnect();
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Check your DATABASE_URL environment variable');
    console.log('   2. Make sure your database is running');
    console.log('   3. Verify database permissions');
  }
}

// Run the test
testDatabaseDirectly().catch(console.error);
