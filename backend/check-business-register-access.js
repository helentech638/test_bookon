#!/usr/bin/env node

/**
 * Check Business Register Access Issue
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkBusinessRegisterAccess() {
  try {
    console.log('🔍 CHECKING BUSINESS REGISTER ACCESS ISSUE\n');
    
    const registerId = 'a1d6349a-1125-456f-9708-420269c02ace';
    
    // 1. Get register with venue info
    const register = await prisma.register.findUnique({
      where: { id: registerId },
      include: {
        session: {
          include: {
            activity: {
              include: {
                venue: {
                  select: {
                    id: true,
                    name: true,
                    ownerId: true
                  }
                }
              }
            }
          }
        }
      }
    });
    
    if (register) {
      console.log('📝 REGISTER VENUE DETAILS:');
      console.log('   Register ID:', register.id);
      console.log('   Activity:', register.session?.activity?.title);
      console.log('   Venue:', register.session?.activity?.venue?.name);
      console.log('   Venue ID:', register.session?.activity?.venue?.id);
      console.log('   Venue Owner ID:', register.session?.activity?.venue?.ownerId);
    }
    
    // 2. Get all business users
    const businessUsers = await prisma.user.findMany({
      where: { 
        OR: [
          { role: 'business' },
          { role: 'admin' },
          { businessName: { not: null } }
        ]
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        businessName: true
      }
    });
    
    console.log('\n👥 BUSINESS USERS:');
    businessUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.firstName} ${user.lastName}`);
      console.log(`      Email: ${user.email}`);
      console.log(`      Role: ${user.role}`);
      console.log(`      Business: ${user.businessName || 'N/A'}`);
      console.log(`      User ID: ${user.id}`);
      console.log('');
    });
    
    // 3. Check which venues each business user owns
    for (const user of businessUsers) {
      const venues = await prisma.venue.findMany({
        where: { ownerId: user.id },
        select: {
          id: true,
          name: true,
          ownerId: true
        }
      });
      
      console.log(`🏢 VENUES OWNED BY ${user.firstName} ${user.lastName}:`);
      if (venues.length === 0) {
        console.log('   No venues owned');
      } else {
        venues.forEach((venue, index) => {
          console.log(`   ${index + 1}. ${venue.name} (ID: ${venue.id})`);
        });
      }
      console.log('');
    }
    
    // 4. Check if our register's venue matches any business user
    if (register?.session?.activity?.venue) {
      const venueOwnerId = register.session.activity.venue.ownerId;
      const venueOwner = businessUsers.find(user => user.id === venueOwnerId);
      
      console.log('🔗 VENUE OWNERSHIP CHECK:');
      console.log('   Venue Owner ID:', venueOwnerId);
      if (venueOwner) {
        console.log('   ✅ Venue Owner Found:', venueOwner.firstName, venueOwner.lastName);
        console.log('   Role:', venueOwner.role);
        console.log('   Business:', venueOwner.businessName);
      } else {
        console.log('   ❌ Venue Owner NOT FOUND in business users');
      }
    }
    
    // 5. Test business register API query
    if (register?.session?.activity?.venue) {
      const venueId = register.session.activity.venue.id;
      
      console.log('\n🧪 TESTING BUSINESS REGISTER API QUERY:');
      
      const businessRegisters = await prisma.register.findMany({
        where: {
          session: {
            activity: {
              venueId: venueId
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
        }
      });
      
      console.log(`   Registers for venue ${register.session.activity.venue.name}: ${businessRegisters.length}`);
      
      if (businessRegisters.length > 0) {
        console.log('   Recent registers:');
        businessRegisters.slice(0, 3).forEach((reg, index) => {
          console.log(`     ${index + 1}. ${reg.session?.activity?.title} - ${reg.date.toLocaleDateString()}`);
        });
      }
    }
    
    // 6. Check total registers vs business registers
    const totalRegisters = await prisma.register.count();
    console.log('\n📊 REGISTER COUNTS:');
    console.log('   Total Registers (All):', totalRegisters);
    
    if (register?.session?.activity?.venue) {
      const venueRegisters = await prisma.register.count({
        where: {
          session: {
            activity: {
              venueId: register.session.activity.venue.id
            }
          }
        }
      });
      console.log(`   Registers for ${register.session.activity.venue.name}:`, venueRegisters);
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkBusinessRegisterAccess().catch(console.error);
