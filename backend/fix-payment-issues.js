const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupPaymentIssues() {
  try {
    console.log('🔍 Starting comprehensive payment cleanup...');
    
    // 1. Find all pending payments
    const pendingPayments = await prisma.payment.findMany({
      where: {
        status: 'pending',
        isActive: true
      },
      include: {
        booking: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`Found ${pendingPayments.length} pending payments`);

    // 2. Group by booking ID
    const paymentsByBooking = {};
    pendingPayments.forEach(payment => {
      if (!paymentsByBooking[payment.bookingId]) {
        paymentsByBooking[payment.bookingId] = [];
      }
      paymentsByBooking[payment.bookingId].push(payment);
    });

    // 3. Keep only the latest payment for each booking, deactivate others
    let cleanedCount = 0;
    for (const [bookingId, payments] of Object.entries(paymentsByBooking)) {
      if (payments.length > 1) {
        console.log(`📋 Booking ${bookingId} has ${payments.length} pending payments`);
        
        // Keep the latest one, deactivate others
        const sortedPayments = payments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const keepPayment = sortedPayments[0];
        const removePayments = sortedPayments.slice(1);
        
        for (const payment of removePayments) {
          await prisma.payment.update({
            where: { id: payment.id },
            data: { isActive: false }
          });
          cleanedCount++;
          console.log(`  ❌ Deactivated payment ${payment.id}`);
        }
        
        console.log(`  ✅ Kept payment ${keepPayment.id}`);
      }
    }

    // 4. Clean up old pending bookings (more than 30 minutes old)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const oldPendingBookings = await prisma.booking.findMany({
      where: {
        status: 'pending',
        paymentStatus: 'pending',
        createdAt: {
          lt: thirtyMinutesAgo
        }
      }
    });

    let cancelledBookings = 0;
    if (oldPendingBookings.length > 0) {
      console.log(`\n🕐 Found ${oldPendingBookings.length} old pending bookings`);
      
      for (const booking of oldPendingBookings) {
        // Cancel the booking
        await prisma.booking.update({
          where: { id: booking.id },
          data: { 
            status: 'cancelled',
            paymentStatus: 'cancelled'
          }
        });

        // Deactivate any associated payments
        await prisma.payment.updateMany({
          where: {
            bookingId: booking.id,
            isActive: true
          },
          data: {
            isActive: false,
            status: 'cancelled'
          }
        });

        cancelledBookings++;
        console.log(`  🗑️ Cancelled old booking ${booking.id}`);
      }
    }

    // 5. Clean up any failed payments that are still active
    const failedPayments = await prisma.payment.findMany({
      where: {
        status: 'failed',
        isActive: true
      }
    });

    let deactivatedFailed = 0;
    if (failedPayments.length > 0) {
      console.log(`\n❌ Found ${failedPayments.length} failed payments still active`);
      
      for (const payment of failedPayments) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { isActive: false }
        });
        deactivatedFailed++;
        console.log(`  🚫 Deactivated failed payment ${payment.id}`);
      }
    }

    console.log(`\n🎉 Cleanup Summary:`);
    console.log(`  - Deactivated ${cleanedCount} duplicate payments`);
    console.log(`  - Cancelled ${cancelledBookings} old pending bookings`);
    console.log(`  - Deactivated ${deactivatedFailed} failed payments`);
    console.log(`\n✅ Payment cleanup complete! You can now try booking again.`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupPaymentIssues();





