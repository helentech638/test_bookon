#!/usr/bin/env node

/**
 * Fix Payment Status and Create Register
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixPaymentStatusAndCreateRegister() {
  try {
    console.log('🔧 FIXING PAYMENT STATUS AND CREATING REGISTER\n');
    
    const bookingId = 'a6462f16-15f7-4e78-88e0-c380d59420cd';
    
    // 1. Update payment status to 'paid'
    console.log('1️⃣ Updating payment status to "paid"...');
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: { 
        paymentStatus: 'paid',
        paymentIntentId: 'pi_admin_fix_' + Date.now()
      }
    });
    console.log('✅ Payment status updated to:', updatedBooking.paymentStatus);
    
    // 2. Get booking with relations
    console.log('\n2️⃣ Getting booking details...');
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        activity: { include: { venue: true } },
        child: true,
        parent: true
      }
    });
    
    console.log('✅ Booking details retrieved');
    console.log('   Activity:', booking?.activity?.title);
    console.log('   Child:', booking?.child?.firstName, booking?.child?.lastName);
    
    // 3. Create session
    console.log('\n3️⃣ Creating/finding session...');
    let session = await prisma.session.findFirst({
      where: {
        activityId: booking.activityId,
        date: booking.activityDate,
      }
    });
    
    if (!session) {
      session = await prisma.session.create({
        data: {
          activityId: booking.activityId,
          date: booking.activityDate,
          startTime: '00:00:00',
          endTime: '01:00:00',
          capacity: 20,
          bookingsCount: 0
        }
      });
      console.log('✅ Session created:', session.id);
    } else {
      console.log('✅ Session exists:', session.id);
    }
    
    // 4. Create register
    console.log('\n4️⃣ Creating/finding register...');
    let register = await prisma.register.findFirst({
      where: { sessionId: session.id }
    });
    
    if (!register) {
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
    
    // 5. Create attendance
    console.log('\n5️⃣ Creating attendance record...');
    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        registerId: register.id,
        childId: booking.childId,
        bookingId: booking.id
      }
    });
    
    if (!existingAttendance) {
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
      console.log('✅ Attendance record already exists');
    }
    
    // 6. Final verification
    console.log('\n6️⃣ FINAL VERIFICATION:');
    const finalBooking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        status: true,
        paymentStatus: true,
        paymentIntentId: true
      }
    });
    
    const finalRegister = await prisma.register.findFirst({
      where: { sessionId: session.id },
      include: {
        attendance: { include: { child: true } }
      }
    });
    
    console.log('   Booking Status:', finalBooking?.status);
    console.log('   Payment Status:', finalBooking?.paymentStatus);
    console.log('   Register ID:', finalRegister?.id);
    console.log('   Attendance Records:', finalRegister?.attendance.length);
    
    if (finalRegister?.attendance.length > 0) {
      console.log('   Child in Register:', finalRegister.attendance[0].child?.firstName, finalRegister.attendance[0].child?.lastName);
    }
    
    console.log('\n🎉 SUCCESS!');
    console.log('   ✅ Payment status: PAID');
    console.log('   ✅ Register created');
    console.log('   ✅ Attendance record created');
    console.log('');
    console.log('📱 NEXT STEP:');
    console.log('   Please refresh your business dashboard at https://bookon.app/business/registers');
    console.log('   The register should now be visible!');
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixPaymentStatusAndCreateRegister().catch(console.error);
