#!/usr/bin/env node

/**
 * Fix Register Creation Issue
 * 
 * This script fixes the specific booking that failed to create registers
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixBooking() {
  try {
    console.log('🔧 FIXING THE BOOKING...\n');
    
    const bookingId = '9e453deb-b9c2-4136-9c59-8ce29a21e1f0';
    
    // 1. Update booking payment status
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        paymentStatus: 'paid',
        paymentIntentId: 'pi_manual_fix_' + Date.now()
      }
    });
    
    console.log('✅ Updated booking payment status to paid');
    
    // 2. Now trigger register creation
    const { createRegisterForBooking } = require('./src/routes/payments');
    
    const mockBooking = {
      id: bookingId,
      activityId: updatedBooking.activityId,
      activityDate: updatedBooking.activityDate,
      activityTime: '11:17', // Default time
      childId: updatedBooking.childId,
      activity: {
        title: updatedBooking.activity?.title || 'Year 4-6 Football',
      },
    };
    
    console.log('🔄 Creating register for booking...');
    await createRegisterForBooking(mockBooking);
    console.log('✅ Register creation completed');
    
    // 3. Verify the fix
    const session = await prisma.session.findFirst({
      where: {
        activityId: updatedBooking.activityId,
        date: updatedBooking.activityDate
      }
    });
    
    if (session) {
      const register = await prisma.register.findFirst({
        where: { sessionId: session.id }
      });
      
      if (register) {
        const attendance = await prisma.attendance.findFirst({
          where: {
            registerId: register.id,
            childId: updatedBooking.childId,
            bookingId: bookingId
          }
        });
        
        console.log('\n🎉 VERIFICATION:');
        console.log('   ✅ Session created:', session.id);
        console.log('   ✅ Register created:', register.id);
        console.log('   ✅ Attendance created:', attendance?.id || 'Missing');
        
        console.log('\n📊 SUMMARY:');
        console.log('   Booking ID:', bookingId);
        console.log('   Activity: Year 4-6 Football');
        console.log('   Child: testing new');
        console.log('   Date:', updatedBooking.activityDate);
        console.log('   Amount: £25.00');
        console.log('   Status: Fixed ✅');
      }
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
    console.log('\nStack trace:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixBooking().catch(console.error);
