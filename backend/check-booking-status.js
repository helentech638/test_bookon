#!/usr/bin/env node

/**
 * Check Booking Status for Register Creation
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkBookingStatus() {
  try {
    console.log('🔍 CHECKING BOOKING STATUS FOR REGISTER CREATION\n');
    
    // Find the booking with ID d59420cd
    const booking = await prisma.booking.findFirst({
      where: { 
        OR: [
          { id: 'd59420cd' },
          { id: { contains: 'd59420cd' } }
        ]
      },
      include: {
        activity: {
          include: {
            venue: true
          }
        },
        child: true,
        parent: true
      }
    });
    
    if (booking) {
      console.log('📋 BOOKING FOUND:');
      console.log('   ID:', booking.id);
      console.log('   Activity:', booking.activity?.title);
      console.log('   Child:', booking.child?.firstName, booking.child?.lastName);
      console.log('   Venue:', booking.activity?.venue?.name);
      console.log('   Date:', booking.activityDate);
      console.log('   Status:', booking.status);
      console.log('   Payment Status:', booking.paymentStatus);
      console.log('   Payment Intent ID:', booking.paymentIntentId);
      console.log('');
      
      // Check if register exists
      const register = await prisma.register.findFirst({
        where: {
          session: {
            activityId: booking.activityId,
            date: booking.activityDate
          }
        },
        include: {
          session: {
            include: {
              activity: true
            }
          },
          attendance: {
            include: {
              child: true
            }
          }
        }
      });
      
      if (register) {
        console.log('✅ REGISTER EXISTS:');
        console.log('   Register ID:', register.id);
        console.log('   Session ID:', register.sessionId);
        console.log('   Attendance Records:', register.attendance.length);
        register.attendance.forEach((att, index) => {
          console.log(`     ${index + 1}. ${att.child?.firstName} ${att.child?.lastName} - Present: ${att.present}`);
        });
      } else {
        console.log('❌ NO REGISTER FOUND');
        console.log('   This is why it\'s not showing in business dashboard');
        console.log('');
        console.log('🔧 SOLUTION: Update payment status to "paid" to trigger register creation');
      }
      
    } else {
      console.log('❌ BOOKING NOT FOUND');
      console.log('   Searching for bookings with similar ID...');
      
      const similarBookings = await prisma.booking.findMany({
        where: {
          OR: [
            { id: { contains: 'd59420cd' } },
            { id: { contains: 'd59420' } }
          ]
        },
        include: {
          activity: true,
          child: true
        },
        take: 5
      });
      
      console.log('   Found similar bookings:');
      similarBookings.forEach((b, index) => {
        console.log(`     ${index + 1}. ${b.id} - ${b.child?.firstName} ${b.child?.lastName} - ${b.activity?.title}`);
      });
      
      // Also check recent bookings
      console.log('\n📅 RECENT BOOKINGS:');
      const recentBookings = await prisma.booking.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          activity: true,
          child: true
        }
      });
      
      recentBookings.forEach((b, index) => {
        console.log(`   ${index + 1}. ${b.id} - ${b.child?.firstName} ${b.child?.lastName}`);
        console.log(`      Activity: ${b.activity?.title}`);
        console.log(`      Status: ${b.status} | Payment: ${b.paymentStatus}`);
        console.log(`      Date: ${b.activityDate}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkBookingStatus().catch(console.error);
