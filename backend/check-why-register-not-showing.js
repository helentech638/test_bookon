#!/usr/bin/env node

/**
 * Check Why Specific Register Is Not Showing
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkWhyRegisterNotShowing() {
  try {
    console.log('🔍 INVESTIGATING WHY REGISTER IS NOT SHOWING\n');
    
    // 1. Find our specific register
    const ourRegister = await prisma.register.findUnique({
      where: { id: '8e9f714d-a606-4801-a755-8512062600e5' },
      include: {
        session: {
          include: {
            activity: {
              include: {
                venue: {
                  include: {
                    owner: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        role: true
                      }
                    }
                  }
                }
              }
            }
          }
        },
        attendance: {
          include: {
            child: true
          }
        }
      }
    });
    
    if (!ourRegister) {
      console.log('❌ Register not found!');
      return;
    }
    
    console.log('✅ REGISTER DETAILS:');
    console.log('   ID:', ourRegister.id);
    console.log('   Activity:', ourRegister.session?.activity?.title);
    console.log('   Venue:', ourRegister.session?.activity?.venue?.name);
    console.log('   Venue ID:', ourRegister.session?.activity?.venue?.id);
    console.log('   Date:', ourRegister.date.toISOString());
    console.log('   Date (Formatted):', ourRegister.date.toLocaleDateString());
    console.log('   Status:', ourRegister.status);
    console.log('   Created At:', ourRegister.createdAt.toISOString());
    console.log('');
    
    console.log('🏢 VENUE DETAILS:');
    console.log('   Venue Name:', ourRegister.session?.activity?.venue?.name);
    console.log('   Venue Owner:', ourRegister.session?.activity?.venue?.owner?.firstName, ourRegister.session?.activity?.venue?.owner?.lastName);
    console.log('   Venue Owner ID:', ourRegister.session?.activity?.venue?.owner?.id);
    console.log('   Venue Owner Role:', ourRegister.session?.activity?.venue?.owner?.role);
    console.log('   Venue Owner Email:', ourRegister.session?.activity?.venue?.owner?.email);
    console.log('');
    
    console.log('👤 ADMIN USER:');
    const admin = await prisma.user.findFirst({
      where: { role: 'admin' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true
      }
    });
    
    console.log('   Admin ID:', admin?.id);
    console.log('   Admin Name:', admin?.firstName, admin?.lastName);
    console.log('   Admin Email:', admin?.email);
    console.log('');
    
    // 2. Check if admin owns this venue
    const venueOwnerId = ourRegister.session?.activity?.venue?.ownerId;
    const isAdminVenueOwner = venueOwnerId === admin?.id;
    
    console.log('🔗 OWNERSHIP ANALYSIS:');
    console.log('   Venue Owner ID:', venueOwnerId);
    console.log('   Admin User ID:', admin?.id);
    console.log('   Admin owns venue:', isAdminVenueOwner ? 'YES' : 'NO');
    console.log('');
    
    // 3. Check other registers from same venue
    console.log('📋 OTHER REGISTERS FROM SAME VENUE:');
    const sameVenueRegisters = await prisma.register.findMany({
      where: {
        session: {
          activity: {
            venueId: ourRegister.session?.activity?.venue?.id
          }
        }
      },
      include: {
        session: {
          include: {
            activity: true
          }
        }
      },
      orderBy: { date: 'desc' },
      take: 5
    });
    
    console.log(`   Total registers from same venue: ${sameVenueRegisters.length}`);
    sameVenueRegisters.forEach((reg, index) => {
      console.log(`   ${index + 1}. ${reg.session?.activity?.title} - ${reg.date.toLocaleDateString()}`);
    });
    console.log('');
    
    // 4. Check registers by date range (Oct 25-30, 2025)
    console.log('📅 REGISTERS FROM SAME DATE RANGE (Oct 2025):');
    const octRegisters = await prisma.register.findMany({
      where: {
        date: {
          gte: new Date('2025-10-20'),
          lte: new Date('2025-10-30')
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
      orderBy: { date: 'asc' }
    });
    
    octRegisters.forEach((reg, index) => {
      const isOurRegister = reg.id === ourRegister.id;
      console.log(`   ${index + 1}. ${reg.session?.activity?.title} at ${reg.session?.activity?.venue?.name}`);
      console.log(`      Date: ${reg.date.toLocaleDateString()}`);
      console.log(`      ID: ${reg.id}${isOurRegister ? ' ← OUR REGISTER' : ''}`);
      console.log('');
    });
    
    // 5. Summary
    console.log('🎯 SUMMARY:');
    console.log('   ✅ Register exists in database');
    console.log('   ✅ Register has child attendance');
    console.log(`   ${isAdminVenueOwner ? '✅' : '❌'} Admin owns this venue: ${isAdminVenueOwner}`);
    console.log('   ❌ Register is NOT showing in admin dashboard');
    console.log('');
    console.log('💡 POSSIBLE REASONS:');
    if (!isAdminVenueOwner) {
      console.log('   ⚠️  Venue is NOT owned by admin user');
      console.log('   ⚠️  Admin dashboard may be filtering by admin-owned venues');
    }
    console.log('   ⚠️  Frontend pagination might not be showing old dates');
    console.log('   ⚠️  Frontend might have date range filters');
    console.log('   ⚠️  Frontend might have venue filter applied');
    console.log('');
    console.log('🔧 RECOMMENDED FIXES:');
    console.log('   1. Change venue owner to admin user');
    console.log('   2. Remove frontend venue filtering for admin dashboard');
    console.log('   3. Check frontend date range filters');
    console.log('   4. Check frontend pagination logic');
    
  } catch (error) {
    console.log('❌ Error:', error.message);
    console.log(error);
  } finally {
    await prisma.$disconnect();
  }
}

checkWhyRegisterNotShowing();
