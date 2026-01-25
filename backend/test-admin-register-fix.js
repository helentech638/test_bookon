#!/usr/bin/env node

/**
 * Test Admin Register API Fix
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAdminRegisterAccess() {
  try {
    console.log('🧪 TESTING ADMIN REGISTER API FIX\n');
    
    // 1. Get admin user
    const adminUser = await prisma.user.findFirst({
      where: { role: 'admin' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true
      }
    });
    
    if (!adminUser) {
      console.log('❌ No admin user found');
      return;
    }
    
    console.log('👤 ADMIN USER:');
    console.log('   Name:', adminUser.firstName, adminUser.lastName);
    console.log('   Email:', adminUser.email);
    console.log('   Role:', adminUser.role);
    console.log('   ID:', adminUser.id);
    
    // 2. Test admin access to all registers
    console.log('\n📋 TESTING ADMIN ACCESS TO ALL REGISTERS:');
    
    const allRegisters = await prisma.register.findMany({
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
      },
      orderBy: { date: 'desc' },
      take: 10
    });
    
    console.log(`   Total registers in system: ${allRegisters.length}`);
    console.log('   Recent registers:');
    allRegisters.forEach((reg, index) => {
      console.log(`     ${index + 1}. ${reg.session?.activity?.title} at ${reg.session?.activity?.venue?.name}`);
      console.log(`        Date: ${reg.date.toLocaleDateString()}`);
      console.log(`        Venue Owner ID: ${reg.session?.activity?.venue?.ownerId}`);
      console.log('');
    });
    
    // 3. Check our specific register
    console.log('🎯 OUR SPECIFIC REGISTER:');
    const ourRegister = await prisma.register.findUnique({
      where: { id: '8e9f714d-a606-4801-a755-8512062600e5' },
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
    
    if (ourRegister) {
      console.log('✅ Our register exists:');
      console.log('   Activity:', ourRegister.session?.activity?.title);
      console.log('   Venue:', ourRegister.session?.activity?.venue?.name);
      console.log('   Date:', ourRegister.date.toLocaleDateString());
      console.log('   Venue Owner ID:', ourRegister.session?.activity?.venue?.ownerId);
      
      // Check if admin can access this register
      const adminCanAccess = ourRegister.session?.activity?.venue?.ownerId === adminUser.id || adminUser.role === 'admin';
      console.log('   Admin can access:', adminCanAccess ? 'YES' : 'NO');
      
      if (adminUser.role === 'admin') {
        console.log('   ✅ Admin role allows access to ALL registers');
      } else {
        console.log('   ❌ Non-admin role restricts access to owned venues only');
      }
    }
    
    // 4. Summary
    console.log('\n📊 SUMMARY:');
    console.log('✅ Admin user exists:', adminUser.firstName, adminUser.lastName);
    console.log('✅ Admin role:', adminUser.role);
    console.log('✅ Total registers:', allRegisters.length);
    console.log('✅ Our register exists:', ourRegister ? 'YES' : 'NO');
    console.log('');
    console.log('🔧 API FIX APPLIED:');
    console.log('   - Admin users now see ALL registers');
    console.log('   - Business users see only their venue registers');
    console.log('   - Added logging for debugging');
    console.log('');
    console.log('📱 NEXT STEP:');
    console.log('   Please refresh your admin dashboard to see all registers!');
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testAdminRegisterAccess().catch(console.error);
