#!/usr/bin/env node

/**
 * Fix Booking Payment Status and Create Register
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixBookingAndCreateRegister() {
  try {
    console.log('🔧 FIXING BOOKING PAYMENT STATUS AND CREATING REGISTER\n');
    
    const bookingId = 'a6462f16-15f7-4e78-88e0-c380d59420cd';
    
    // 1. Update payment status to 'paid'
    console.log('1️⃣ Updating payment status to "paid"...');
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        paymentStatus: 'paid',
        paymentIntentId: 'pi_manual_fix_' + Date.now()
      }
    });
    console.log('✅ Payment status updated to:', updatedBooking.paymentStatus);
    
    // 2. Get booking with all relations
    console.log('\n2️⃣ Getting booking details...');
    const bookingWithRelations = await prisma.booking.findUnique({
      where: { id: bookingId },
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
    
    if (!bookingWithRelations) {
      console.log('❌ Booking not found after update');
      return;
    }
    
    console.log('✅ Booking details retrieved');
    console.log('   Activity:', bookingWithRelations.activity?.title);
    console.log('   Child:', bookingWithRelations.child?.firstName, bookingWithRelations.child?.lastName);
    console.log('   Venue:', bookingWithRelations.activity?.venue?.name);
    
    // 3. Create session if it doesn't exist
    console.log('\n3️⃣ Creating/finding session...');
    let session = await prisma.session.findFirst({
      where: {
        activityId: bookingWithRelations.activityId,
        date: bookingWithRelations.activityDate,
      }
    });
    
    if (!session) {
      console.log('   Creating new session...');
      session = await prisma.session.create({
        data: {
          activityId: bookingWithRelations.activityId,
          date: bookingWithRelations.activityDate,
          startTime: '00:00:00', // Default time
          endTime: '01:00:00',   // Default time
          capacity: 20,           // Default capacity
          bookingsCount: 0
        }
      });
      console.log('✅ Session created:', session.id);
    } else {
      console.log('✅ Session exists:', session.id);
    }
    
    // 4. Create register if it doesn't exist
    console.log('\n4️⃣ Creating/finding register...');
    let register = await prisma.register.findFirst({
      where: { sessionId: session.id }
    });
    
    if (!register) {
      console.log('   Creating new register...');
      register = await prisma.register.create({
        data: {
          sessionId: session.id,
          date: session.date,
          status: 'active'
        }
      });
      console.log('✅ Register created:', register.id);
    } else {
      console.log('✅ Register exists:', register.id);
    }
    
    // 5. Create attendance record
    console.log('\n5️⃣ Creating attendance record...');
    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        registerId: register.id,
        childId: bookingWithRelations.childId,
        bookingId: bookingWithRelations.id
      }
    });
    
    if (!existingAttendance) {
      await prisma.attendance.create({
        data: {
          registerId: register.id,
          childId: bookingWithRelations.childId,
          bookingId: bookingWithRelations.id,
          present: true,
          checkInTime: null,
          checkOutTime: null
        }
      });
      console.log('✅ Attendance record created');
    } else {
      console.log('✅ Attendance record already exists');
    }
    
    // 6. Verify the fix
    console.log('\n6️⃣ VERIFICATION:');
    const finalBooking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        paymentIntentId: true
      }
    });
    
    const finalRegister = await prisma.register.findFirst({
      where: { sessionId: session.id },
      include: {
        attendance: {
          include: {
            child: true
          }
        }
      }
    });
    
    console.log('   Booking Status:', finalBooking?.status);
    console.log('   Payment Status:', finalBooking?.paymentStatus);
    console.log('   Register ID:', finalRegister?.id);
    console.log('   Attendance Records:', finalRegister?.attendance.length);
    
    if (finalRegister?.attendance.length > 0) {
      console.log('   Child in Register:', finalRegister.attendance[0].child?.firstName, finalRegister.attendance[0].child?.lastName);
    }
    
    console.log('\n🎉 SUCCESS! The booking should now appear in the business register dashboard.');
    console.log('   Please refresh your business dashboard to see the register.');
    
  } catch (error) {
    console.log('❌ Error:', error.message);
    console.log('Stack trace:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

fixBookingAndCreateRegister().catch(console.error);
