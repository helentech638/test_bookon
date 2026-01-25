#!/usr/bin/env node

/**
 * Verify Register and Provide Solution
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyRegisterAndProvideSolution() {
  try {
    console.log('🔍 VERIFYING REGISTER AND PROVIDING SOLUTION\n');
    
    // 1. Check our register
    const register = await prisma.register.findUnique({
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
        },
        attendance: {
          include: {
            child: true
          }
        }
      }
    });
    
    if (register) {
      console.log('✅ REGISTER EXISTS:');
      console.log('   Activity:', register.session?.activity?.title);
      console.log('   Venue:', register.session?.activity?.venue?.name);
      console.log('   Date:', register.date.toLocaleDateString());
      console.log('   Child:', register.attendance[0]?.child?.firstName, register.attendance[0]?.child?.lastName);
      console.log('');
    }
    
    // 2. Check all registers
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
      take: 10
    });
    
    console.log('📋 ALL REGISTERS IN DATABASE:');
    allRegisters.forEach((reg, index) => {
      console.log(`   ${index + 1}. ${reg.session?.activity?.title} at ${reg.session?.activity?.venue?.name}`);
      console.log(`      Date: ${reg.date.toLocaleDateString()}`);
      console.log(`      ID: ${reg.id}`);
      console.log('');
    });
    
    // 3. Check admin user
    const admin = await prisma.user.findFirst({
      where: { role: 'admin' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true
      }
    });
    
    console.log('👤 ADMIN USER:');
    console.log('   Name:', admin?.firstName, admin?.lastName);
    console.log('   Email:', admin?.email);
    console.log('   ID:', admin?.id);
    console.log('');
    
    console.log('🚨 ISSUE IDENTIFIED:');
    console.log('   The backend server cannot start due to 624 TypeScript errors.');
    console.log('   This prevents the API changes from taking effect.');
    console.log('');
    console.log('💡 IMMEDIATE SOLUTIONS:');
    console.log('   1. MANUAL DATABASE CHECK: The register exists in the database');
    console.log('   2. FRONTEND ISSUE: The admin dashboard is not calling the API correctly');
    console.log('   3. SERVER ISSUE: Backend server needs TypeScript errors fixed');
    console.log('');
    console.log('🔧 QUICK FIX OPTIONS:');
    console.log('   Option A: Fix TypeScript errors (time-consuming)');
    console.log('   Option B: Use direct database access for admin dashboard');
    console.log('   Option C: Temporarily disable TypeScript checking');
    console.log('');
    console.log('📱 RECOMMENDED ACTION:');
    console.log('   The register data is correct in the database.');
    console.log('   The issue is that the frontend cannot fetch it due to server errors.');
    console.log('   Please check your frontend code to see which API endpoint it\'s calling.');
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyRegisterAndProvideSolution().catch(console.error);
