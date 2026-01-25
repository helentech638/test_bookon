#!/usr/bin/env node

/**
 * Transfer Venue Ownership to Admin
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function transferVenueOwnership() {
  try {
    console.log('🔄 TRANSFERRING VENUE OWNERSHIP TO ADMIN\n');
    
    const venueId = 'b8f1bcd1-f053-40ba-bbab-e574903ac8e7'; // holiday club 123
    const adminId = 'ad2cfe59-8976-4362-8300-4105d7bd0697'; // Admin User
    
    // 1. Get current venue details
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      include: {
        activities: {
          include: {
            sessions: {
              include: {
                registers: true
              }
            }
          }
        }
      }
    });
    
    if (!venue) {
      console.log('❌ Venue not found');
      return;
    }
    
    console.log('📋 VENUE DETAILS:');
    console.log('   Name:', venue.name);
    console.log('   Current Owner ID:', venue.ownerId);
    console.log('   Activities:', venue.activities.length);
    console.log('   Sessions:', venue.activities.reduce((sum, act) => sum + act.sessions.length, 0));
    console.log('   Registers:', venue.activities.reduce((sum, act) => sum + act.sessions.reduce((s, sess) => s + sess.registers.length, 0), 0));
    
    // 2. Get admin user details
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        role: true
      }
    });
    
    if (!admin) {
      console.log('❌ Admin user not found');
      return;
    }
    
    console.log('\n👤 ADMIN USER:');
    console.log('   Name:', admin.firstName, admin.lastName);
    console.log('   Email:', admin.email);
    console.log('   Role:', admin.role);
    
    // 3. Transfer ownership
    console.log('\n🔄 TRANSFERRING OWNERSHIP...');
    const updatedVenue = await prisma.venue.update({
      where: { id: venueId },
      data: { ownerId: adminId }
    });
    
    console.log('✅ Venue ownership transferred successfully');
    console.log('   New Owner ID:', updatedVenue.ownerId);
    
    // 4. Verify the change
    console.log('\n✅ VERIFICATION:');
    const verifyVenue = await prisma.venue.findUnique({
      where: { id: venueId },
      include: {
        owner: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            role: true
          }
        }
      }
    });
    
    console.log('   Venue:', verifyVenue.name);
    console.log('   Owner:', verifyVenue.owner.firstName, verifyVenue.owner.lastName);
    console.log('   Owner Role:', verifyVenue.owner.role);
    console.log('   Owner Email:', verifyVenue.owner.email);
    
    // 5. Check if register is now visible to admin
    console.log('\n📋 CHECKING REGISTER VISIBILITY:');
    const adminRegisters = await prisma.register.findMany({
      where: {
        session: {
          activity: {
            venue: {
              ownerId: adminId
            }
          }
        }
      },
      include: {
        session: {
          include: {
            activity: {
              include: {
                venue: true
              }
            }
          }
        }
      },
      orderBy: { date: 'desc' }
    });
    
    console.log(`   Admin can now see ${adminRegisters.length} registers from owned venues:`);
    adminRegisters.forEach((reg, index) => {
      console.log(`     ${index + 1}. ${reg.session?.activity?.title} at ${reg.session?.activity?.venue?.name}`);
      console.log(`        Date: ${reg.date.toLocaleDateString()}`);
    });
    
    console.log('\n🎉 SUCCESS!');
    console.log('   ✅ Venue ownership transferred to admin');
    console.log('   ✅ Register should now be visible in admin dashboard');
    console.log('');
    console.log('📱 NEXT STEP:');
    console.log('   Please refresh your admin dashboard to see the register!');
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

transferVenueOwnership().catch(console.error);
