#!/usr/bin/env node

/**
 * Thorough Investigation of Register Issue
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function investigateRegisterIssue() {
  try {
    console.log('🔍 THOROUGH INVESTIGATION OF REGISTER ISSUE\n');
    
    // 1. Check the register we created
    const registerId = 'a1d6349a-1125-456f-9708-420269c02ace';
    const register = await prisma.register.findUnique({
      where: { id: registerId },
      include: {
        session: {
          include: {
            activity: true
          }
        },
        attendance: {
          include: {
            child: true,
            booking: true
          }
        }
      }
    });
    
    if (register) {
      console.log('📝 REGISTER DETAILS:');
      console.log('   ID:', register.id);
      console.log('   Date:', register.date);
      console.log('   Status:', register.status);
      console.log('   Session ID:', register.sessionId);
      console.log('   Activity:', register.session?.activity?.title);
      console.log('   Session Date:', register.session?.date);
      console.log('   Attendance Records:', register.attendance?.length || 0);
      
      if (register.attendance && register.attendance.length > 0) {
        register.attendance.forEach((att, index) => {
          console.log(`   Attendance ${index + 1}:`);
          console.log(`     Child: ${att.child?.firstName} ${att.child?.lastName}`);
          console.log(`     Booking: ${att.booking?.id}`);
          console.log(`     Present: ${att.present}`);
        });
      }
    } else {
      console.log('❌ Register not found!');
    }
    
    // 2. Check total register count
    const totalRegisters = await prisma.register.count();
    console.log('\n📊 TOTAL REGISTERS:', totalRegisters);
    
    // 3. Check registers by status
    const registersByStatus = await prisma.register.groupBy({
      by: ['status'],
      _count: {
        id: true
      }
    });
    
    console.log('\n📈 REGISTERS BY STATUS:');
    registersByStatus.forEach(group => {
      console.log(`   ${group.status}: ${group._count.id}`);
    });
    
    // 4. Check recent registers
    const recentRegisters = await prisma.register.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        session: {
          include: {
            activity: true
          }
        }
      }
    });
    
    console.log('\n🕒 RECENT REGISTERS:');
    recentRegisters.forEach((reg, index) => {
      console.log(`   ${index + 1}. ${reg.session?.activity?.title} - ${reg.date} (${reg.status})`);
    });
    
    // 5. Check if there are any issues with the session
    const sessionId = 'b20fd0b5-6175-4771-9f09-4657568d9f0e';
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        activity: true,
        registers: true
      }
    });
    
    if (session) {
      console.log('\n📅 SESSION DETAILS:');
      console.log('   ID:', session.id);
      console.log('   Activity:', session.activity?.title);
      console.log('   Date:', session.date);
      console.log('   Start Time:', session.startTime);
      console.log('   End Time:', session.endTime);
      console.log('   Registers Count:', session.registers?.length || 0);
    }
    
    // 6. Check the specific booking
    const bookingId = '9e453deb-b9c2-4136-9c59-8ce29a21e1f0';
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        activity: true,
        child: true,
        parent: true
      }
    });
    
    if (booking) {
      console.log('\n📋 BOOKING DETAILS:');
      console.log('   ID:', booking.id);
      console.log('   Activity:', booking.activity?.title);
      console.log('   Child:', booking.child?.firstName, booking.child?.lastName);
      console.log('   Date:', booking.activityDate);
      console.log('   Status:', booking.status);
      console.log('   Payment Status:', booking.paymentStatus);
      console.log('   Payment Intent ID:', booking.paymentIntentId);
    }
    
    // 7. Check if there are any API issues
    console.log('\n🔧 CHECKING API ENDPOINTS:');
    
    // Check if the register endpoint would work
    const allRegisters = await prisma.register.findMany({
      take: 3,
      include: {
        session: {
          include: {
            activity: {
              include: {
                venue: true
              }
            }
          }
        },
        attendance: {
          include: {
            child: true,
            booking: true
          }
        }
      }
    });
    
    console.log('\n📋 SAMPLE REGISTERS FOR API:');
    allRegisters.forEach((reg, index) => {
      console.log(`   ${index + 1}. Register ID: ${reg.id}`);
      console.log(`      Activity: ${reg.session?.activity?.title}`);
      console.log(`      Venue: ${reg.session?.activity?.venue?.name || 'No venue'}`);
      console.log(`      Date: ${reg.date}`);
      console.log(`      Status: ${reg.status}`);
      console.log(`      Attendance: ${reg.attendance?.length || 0} records`);
    });
    
  } catch (error) {
    console.log('❌ Error:', error.message);
    console.log('Stack trace:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

investigateRegisterIssue().catch(console.error);
