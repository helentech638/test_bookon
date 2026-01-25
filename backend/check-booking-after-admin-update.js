#!/usr/bin/env node

/**
 * Check Booking Status After Admin Update
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkBookingAndRegister() {
  try {
    console.log('🔍 CHECKING BOOKING STATUS AFTER ADMIN UPDATE\n');
    
    // Check both possible booking IDs
    const booking1 = await prisma.booking.findFirst({
      where: { id: { contains: 'd59420cd' } },
      include: { 
        activity: { 
          include: { venue: true } 
        }, 
        child: true 
      }
    });
    
    const booking2 = await prisma.booking.findFirst({
      where: { id: { contains: 'a6462f16' } },
      include: { 
        activity: { 
          include: { venue: true } 
        }, 
        child: true 
      }
    });
    
    const booking = booking1 || booking2;
    
    if (booking) {
      console.log('📋 BOOKING FOUND:');
      console.log('   ID:', booking.id);
      console.log('   Activity:', booking.activity?.title);
      console.log('   Child:', booking.child?.firstName, booking.child?.lastName);
      console.log('   Venue:', booking.activity?.venue?.name);
      console.log('   Status:', booking.status);
      console.log('   Payment Status:', booking.paymentStatus);
      console.log('');
      
      // Check for register
      const register = await prisma.register.findFirst({
        where: {
          session: {
            activityId: booking.activityId,
            date: booking.activityDate
          }
        },
        include: {
          session: { 
            include: { activity: true } 
          },
          attendance: { 
            include: { child: true } 
          }
        }
      });
      
      if (register) {
        console.log('✅ REGISTER EXISTS:');
        console.log('   Register ID:', register.id);
        console.log('   Session ID:', register.sessionId);
        console.log('   Attendance Records:', register.attendance.length);
        register.attendance.forEach((att, index) => {
          console.log(`     ${index + 1}. ${att.child?.firstName} ${att.child?.lastName}`);
        });
        console.log('');
        console.log('🎉 SUCCESS! Register should now be visible in business dashboard.');
        console.log('   Please refresh your business dashboard to see the register.');
      } else {
        console.log('❌ NO REGISTER FOUND');
        console.log('   Even though payment status is updated, register was not created.');
        console.log('   This suggests the automatic register creation did not trigger.');
        console.log('');
        console.log('🔧 SOLUTION: Run the register creation script...');
      }
      
    } else {
      console.log('❌ BOOKING NOT FOUND');
      console.log('   Let me check recent bookings...');
      
      const recentBookings = await prisma.booking.findMany({
        where: {
          OR: [
            { child: { firstName: { contains: 'Hafiz' } } },
            { child: { firstName: { contains: 'Hania' } } },
            { activity: { title: { contains: 'pro rata' } } }
          ]
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          activity: true,
          child: true
        }
      });
      
      console.log('   Recent matching bookings:');
      recentBookings.forEach((b, index) => {
        console.log(`     ${index + 1}. ${b.id}`);
        console.log(`        Child: ${b.child?.firstName} ${b.child?.lastName}`);
        console.log(`        Activity: ${b.activity?.title}`);
        console.log(`        Status: ${b.status} | Payment: ${b.paymentStatus}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkBookingAndRegister().catch(console.error);
