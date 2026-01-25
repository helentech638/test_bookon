#!/usr/bin/env node

/**
 * Create Register for Fixed Booking
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createRegister() {
  try {
    console.log('🔄 Creating register for the fixed booking...\n');
    
    const bookingId = '9e453deb-b9c2-4136-9c59-8ce29a21e1f0';
    
    // Get the booking details
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        activity: true,
        child: true
      }
    });
    
    if (!booking) {
      console.log('❌ Booking not found');
      return;
    }
    
    console.log('📋 Booking details:');
    console.log('   Activity:', booking.activity?.title);
    console.log('   Child:', booking.child?.firstName, booking.child?.lastName);
    console.log('   Date:', booking.activityDate);
    console.log('   Payment Status:', booking.paymentStatus);
    
    // Create session if it doesn't exist
    let session = await prisma.session.findFirst({
      where: {
        activityId: booking.activityId,
        date: booking.activityDate
      }
    });
    
    if (!session) {
      console.log('📅 Creating session...');
      session = await prisma.session.create({
        data: {
          activityId: booking.activityId,
          date: booking.activityDate,
          startTime: '11:17:00',
          endTime: '12:17:00',
          capacity: 20,
          bookingsCount: 0
        }
      });
      console.log('✅ Session created:', session.id);
    } else {
      console.log('✅ Session exists:', session.id);
    }
    
    // Create register if it doesn't exist
    let register = await prisma.register.findFirst({
      where: { sessionId: session.id }
    });
    
    if (!register) {
      console.log('📝 Creating register...');
      register = await prisma.register.create({
        data: {
          sessionId: session.id,
          date: booking.activityDate,
          status: 'active'
        }
      });
      console.log('✅ Register created:', register.id);
    } else {
      console.log('✅ Register exists:', register.id);
    }
    
    // Create attendance record
    const attendance = await prisma.attendance.findFirst({
      where: {
        registerId: register.id,
        childId: booking.childId,
        bookingId: booking.id
      }
    });
    
    if (!attendance) {
      console.log('👥 Creating attendance record...');
      await prisma.attendance.create({
        data: {
          registerId: register.id,
          childId: booking.childId,
          bookingId: booking.id,
          present: true,
          checkInTime: null,
          checkOutTime: null
        }
      });
      console.log('✅ Attendance record created');
    } else {
      console.log('✅ Attendance record exists:', attendance.id);
    }
    
    console.log('\n🎉 REGISTER CREATION COMPLETE!');
    console.log('   Session ID:', session.id);
    console.log('   Register ID:', register.id);
    console.log('   Booking ID:', booking.id);
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createRegister().catch(console.error);
