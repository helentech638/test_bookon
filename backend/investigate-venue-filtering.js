#!/usr/bin/env node

/**
 * Investigate Venue Filtering Issue
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function investigateVenueFiltering() {
  try {
    console.log('🔍 INVESTIGATING VENUE FILTERING ISSUE\n');
    
    // 1. Check all venues
    const venues = await prisma.venue.findMany({
      select: {
        id: true,
        name: true,
        ownerId: true
      }
    });
    
    console.log('🏢 ALL VENUES:');
    venues.forEach((venue, index) => {
      console.log(`   ${index + 1}. ${venue.name} (ID: ${venue.id})`);
      console.log(`      Owner ID: ${venue.ownerId}`);
    });
    
    // 2. Check venue ownership
    console.log('\n👥 VENUE OWNERS:');
    for (const venue of venues) {
      const owner = await prisma.user.findUnique({
        where: { id: venue.ownerId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true
        }
      });
      
      if (owner) {
        console.log(`   ${venue.name} → ${owner.firstName} ${owner.lastName} (${owner.role}) - ${owner.email}`);
      } else {
        console.log(`   ${venue.name} → OWNER NOT FOUND`);
      }
    }
    
    // 3. Check registers by venue
    console.log('\n📋 REGISTERS BY VENUE:');
    for (const venue of venues) {
      const registers = await prisma.register.findMany({
        where: {
          session: {
            activity: {
              venueId: venue.id
            }
          }
        },
        include: {
          session: {
            include: {
              activity: {
                select: {
                  title: true
                }
              }
            }
          }
        },
        orderBy: { date: 'desc' },
        take: 3
      });
      
      console.log(`   ${venue.name}: ${registers.length} registers`);
      registers.forEach((reg, index) => {
        console.log(`     ${index + 1}. ${reg.session?.activity?.title} - ${reg.date.toLocaleDateString()}`);
      });
    }
    
    // 4. Check admin user access
    console.log('\n🔐 ADMIN ACCESS CHECK:');
    const adminUser = await prisma.user.findFirst({
      where: { role: 'admin' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true
      }
    });
    
    if (adminUser) {
      console.log(`   Admin User: ${adminUser.firstName} ${adminUser.lastName} (${adminUser.email})`);
      console.log(`   Admin ID: ${adminUser.id}`);
      
      // Check if admin can see all registers
      const allRegisters = await prisma.register.findMany({
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
        orderBy: { date: 'desc' },
        take: 5
      });
      
      console.log(`   Total registers admin can see: ${allRegisters.length}`);
      allRegisters.forEach((reg, index) => {
        console.log(`     ${index + 1}. ${reg.session?.activity?.title} at ${reg.session?.activity?.venue?.name}`);
      });
    }
    
    // 5. Check our specific register
    console.log('\n🎯 OUR SPECIFIC REGISTER CHECK:');
    const ourRegister = await prisma.register.findUnique({
      where: { id: '8e9f714d-a606-4801-a755-8512062600e5' },
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
      }
    });
    
    if (ourRegister) {
      console.log('✅ Our register exists:');
      console.log(`   Activity: ${ourRegister.session?.activity?.title}`);
      console.log(`   Venue: ${ourRegister.session?.activity?.venue?.name}`);
      console.log(`   Date: ${ourRegister.date.toLocaleDateString()}`);
      console.log(`   Venue Owner ID: ${ourRegister.session?.activity?.venue?.ownerId}`);
      
      // Check if this venue owner is an admin
      const venueOwner = await prisma.user.findUnique({
        where: { id: ourRegister.session?.activity?.venue?.ownerId },
        select: {
          firstName: true,
          lastName: true,
          role: true,
          email: true
        }
      });
      
      if (venueOwner) {
        console.log(`   Venue Owner: ${venueOwner.firstName} ${venueOwner.lastName} (${venueOwner.role})`);
        console.log(`   Venue Owner Email: ${venueOwner.email}`);
        
        if (venueOwner.role !== 'admin') {
          console.log('   ⚠️  ISSUE: Venue owner is not an admin!');
          console.log('   This might explain why the register is not visible in admin dashboard.');
        }
      }
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

investigateVenueFiltering().catch(console.error);
