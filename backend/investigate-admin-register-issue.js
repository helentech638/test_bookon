#!/usr/bin/env node

/**
 * Investigate Admin Register Issue
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function investigateAdminRegisterIssue() {
  try {
    console.log('🔍 INVESTIGATING ADMIN REGISTER ISSUE\n');
    
    const registerId = '8e9f714d-a606-4801-a755-8512062600e5';
    
    // 1. Check register details
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
        },
        attendance: {
          include: {
            child: true
          }
        }
      }
    });
    
    if (register) {
      console.log('📝 REGISTER DETAILS:');
      console.log('   Register ID:', register.id);
      console.log('   Activity:', register.session?.activity?.title);
      console.log('   Venue:', register.session?.activity?.venue?.name);
      console.log('   Venue ID:', register.session?.activity?.venue?.id);
      console.log('   Venue Owner ID:', register.session?.activity?.venue?.ownerId);
      console.log('   Date:', register.date);
      console.log('   Status:', register.status);
      console.log('   Attendance:', register.attendance.length);
      console.log('');
    }
    
    // 2. Check admin users
    const adminUsers = await prisma.user.findMany({
      where: { 
        OR: [
          { role: 'admin' },
          { role: 'business' }
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
    
    console.log('👥 ADMIN/BUSINESS USERS:');
    adminUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.firstName} ${user.lastName} (${user.role})`);
      console.log(`      Email: ${user.email}`);
      console.log(`      User ID: ${user.id}`);
      console.log('');
    });
    
    // 3. Check venue ownership
    if (register?.session?.activity?.venue) {
      const venueOwnerId = register.session.activity.venue.ownerId;
      const venueOwner = adminUsers.find(user => user.id === venueOwnerId);
      
      console.log('🔗 VENUE OWNERSHIP CHECK:');
      console.log('   Venue Owner ID:', venueOwnerId);
      if (venueOwner) {
        console.log('   ✅ Venue Owner Found:', venueOwner.firstName, venueOwner.lastName);
        console.log('   Role:', venueOwner.role);
      } else {
        console.log('   ❌ Venue Owner NOT FOUND in admin/business users');
        console.log('   This explains why register is not visible in admin dashboard');
      }
    }
    
    // 4. Check notifications
    console.log('\n🔔 CHECKING NOTIFICATIONS:');
    const notifications = await prisma.notification.findMany({
      where: {
        type: { contains: 'register' }
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            role: true
          }
        }
      }
    });
    
    console.log('   Recent register notifications:', notifications.length);
    notifications.forEach((notif, index) => {
      console.log(`     ${index + 1}. ${notif.title}`);
      console.log(`        User: ${notif.user?.firstName} ${notif.user?.lastName} (${notif.user?.role})`);
      console.log(`        Type: ${notif.type}`);
      console.log(`        Created: ${notif.createdAt}`);
      console.log('');
    });
    
    // 5. Check if register is visible to admin users
    console.log('\n🧪 TESTING ADMIN REGISTER API QUERY:');
    for (const adminUser of adminUsers) {
      if (adminUser.role === 'admin') {
        // Admin should see all registers
        const adminRegisters = await prisma.register.findMany({
          where: {
            id: registerId
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
        
        console.log(`   Admin ${adminUser.firstName} ${adminUser.lastName}:`);
        console.log(`     Can see register: ${adminRegisters.length > 0 ? 'YES' : 'NO'}`);
        if (adminRegisters.length > 0) {
          console.log(`     Register: ${adminRegisters[0].session?.activity?.title}`);
        }
      }
    }
    
    // 6. Check business register API query
    if (register?.session?.activity?.venue) {
      const venueId = register.session.activity.venue.id;
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
      
      console.log(`\n   Business registers for venue ${register.session.activity.venue.name}: ${businessRegisters.length}`);
      if (businessRegisters.length > 0) {
        console.log('   Registers:');
        businessRegisters.forEach((reg, index) => {
          console.log(`     ${index + 1}. ${reg.session?.activity?.title} - ${reg.date.toLocaleDateString()}`);
        });
      }
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

investigateAdminRegisterIssue().catch(console.error);
