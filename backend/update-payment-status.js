#!/usr/bin/env node

/**
 * Manual Payment Status Update Tool
 * 
 * This script allows you to manually update payment status from pending to paid
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updatePaymentStatus() {
  try {
    console.log('🔧 MANUAL PAYMENT STATUS UPDATE TOOL\n');
    
    // 1. Show all pending bookings
    const pendingBookings = await prisma.booking.findMany({
      where: { 
        status: 'confirmed',
        paymentStatus: 'pending'
      },
      include: {
        activity: true,
        child: true,
        parent: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log('📋 PENDING BOOKINGS:');
    if (pendingBookings.length === 0) {
      console.log('   ✅ No pending bookings found');
      return;
    }
    
    pendingBookings.forEach((booking, index) => {
      console.log(`   ${index + 1}. ${booking.child?.firstName} ${booking.child?.lastName}`);
      console.log(`      Activity: ${booking.activity?.title}`);
      console.log(`      Amount: £${booking.amount}`);
      console.log(`      Date: ${booking.activityDate}`);
      console.log(`      Booking ID: ${booking.id}`);
      console.log(`      Created: ${booking.createdAt}`);
      console.log('');
    });
    
    // 2. Update all pending bookings to paid (one by one to avoid unique constraint)
    console.log('🔄 Updating payment status to "paid"...');
    
    let updatedCount = 0;
    for (const booking of pendingBookings) {
      try {
        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            paymentStatus: 'paid',
            paymentIntentId: 'pi_manual_' + booking.id + '_' + Date.now()
          }
        });
        updatedCount++;
        console.log(`   ✅ Updated: ${booking.child?.firstName} ${booking.child?.lastName}`);
      } catch (error) {
        console.log(`   ❌ Failed to update: ${booking.child?.firstName} ${booking.child?.lastName} - ${error.message}`);
      }
    }
    
    console.log(`✅ Updated ${updatedCount} out of ${pendingBookings.length} bookings to paid status`);
    
    // 3. Show updated bookings
    const updatedBookings = await prisma.booking.findMany({
      where: { 
        status: 'confirmed',
        paymentStatus: 'paid'
      },
      include: {
        activity: true,
        child: true
      },
      orderBy: { updatedAt: 'desc' },
      take: 5
    });
    
    console.log('\n📊 RECENTLY UPDATED BOOKINGS:');
    updatedBookings.forEach((booking, index) => {
      console.log(`   ${index + 1}. ${booking.child?.firstName} ${booking.child?.lastName}`);
      console.log(`      Activity: ${booking.activity?.title}`);
      console.log(`      Amount: £${booking.amount}`);
      console.log(`      Status: ${booking.status}`);
      console.log(`      Payment Status: ${booking.paymentStatus}`);
      console.log('');
    });
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the update
updatePaymentStatus().catch(console.error);
