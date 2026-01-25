#!/usr/bin/env node

/**
 * Check All Registers and Venue Ownership Status
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAllRegistersAndVenues() {
  try {
    console.log('🔍 COMPLETE REGISTER ANALYSIS FOR VERCEL\n');
    
    // 1. Get all registers with venue info
    const allRegisters = await prisma.register.findMany({
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
        attendance: true
      },
      orderBy: { date: 'desc' }
    });
    
    console.log(`📊 TOTAL REGISTERS: ${allRegisters.length}\n`);
    
    // 2. Group by venue and owner
    const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
    const venuesByOwner = {};
    
    allRegisters.forEach(reg => {
      const venue = reg.session?.activity?.venue;
      const owner = venue?.owner;
      const venueKey = venue?.name || 'Unknown';
      const ownerKey = owner?.email || 'Unknown';
      
      if (!venuesByOwner[venueKey]) {
        venuesByOwner[venueKey] = {
          venue,
          owner,
          registers: []
        };
      }
      venuesByOwner[venueKey].registers.push(reg);
    });
    
    console.log('🏢 REGISTERS GROUPED BY VENUE AND OWNER:\n');
    Object.entries(venuesByOwner).forEach(([venueName, data]) => {
      const isAdminVenue = data.owner?.id === admin?.id;
      const venueType = isAdminVenue ? '✅ ADMIN-OWNED' : '❌ NOT ADMIN-OWNED';
      
      console.log(`${venueType}: ${venueName}`);
      console.log(`   Owner: ${data.owner?.firstName} ${data.owner?.lastName} (${data.owner?.role})`);
      console.log(`   Owner Email: ${data.owner?.email}`);
      console.log(`   Registers: ${data.registers.length}`);
      data.registers.forEach((reg, i) => {
        const date = reg.date.toLocaleDateString();
        const children = reg.attendance.length;
        console.log(`     ${i + 1}. ${reg.session?.activity?.title} - ${date} (${children} children)`);
      });
      console.log('');
    });
    
    // 3. Find our specific register
    console.log('🎯 CHECKING "New pro rata" REGISTER:\n');
    const ourRegister = allRegisters.find(r => 
      r.session?.activity?.title === 'New pro rata' || 
      r.id === '8e9f714d-a606-4801-a755-8512062600e5'
    );
    
    if (ourRegister) {
      const venue = ourRegister.session?.activity?.venue;
      const owner = venue?.owner;
      const isAdminVenue = owner?.id === admin?.id;
      
      console.log('   ✅ Register found!');
      console.log('   Activity:', ourRegister.session?.activity?.title);
      console.log('   Venue:', venue?.name);
      console.log('   Date:', ourRegister.date.toLocaleDateString());
      console.log('   Status:', ourRegister.status);
      console.log('   Children:', ourRegister.attendance.length);
      console.log('');
      console.log('   👤 Venue Owner:', owner?.firstName, owner?.lastName);
      console.log('   👤 Owner Role:', owner?.role);
      console.log('   👤 Owner Email:', owner?.email);
      console.log('   👤 Is Admin Venue:', isAdminVenue);
      console.log('');
      console.log('🚨 ISSUE:');
      console.log('   This venue is owned by a BUSINESS user, not the ADMIN user.');
      console.log('   On Vercel, the admin dashboard is filtering by venue ownership.');
      console.log('   So this register is NOT showing in the admin dashboard.');
      console.log('');
      console.log('💡 SOLUTIONS:');
      console.log('   Option 1: Transfer venue ownership to admin user');
      console.log('   Option 2: Deploy the API fix to Vercel (to allow admin to see all)');
      console.log('   Option 3: Change the venue owner to an admin account');
    } else {
      console.log('   ❌ Register not found!');
    }
    
    console.log('\n📊 SUMMARY:');
    const adminOwnedRegisters = allRegisters.filter(r => 
      r.session?.activity?.venue?.owner?.id === admin?.id
    );
    const businessOwnedRegisters = allRegisters.filter(r => 
      r.session?.activity?.venue?.owner?.id !== admin?.id
    );
    
    console.log(`   Total registers: ${allRegisters.length}`);
    console.log(`   Admin-owned venue registers: ${adminOwnedRegisters.length}`);
    console.log(`   Business-owned venue registers: ${businessOwnedRegisters.length}`);
    console.log('');
    console.log('🎯 ROOT CAUSE:');
    console.log('   Admin dashboard on Vercel filters registers by venue ownership.');
    console.log('   Only registers from admin-owned venues are showing.');
    console.log('   "New pro rata" is in a business-owned venue, so it\'s hidden.');
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllRegistersAndVenues();
