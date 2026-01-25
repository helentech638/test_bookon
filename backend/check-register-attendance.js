const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRegisterAttendance() {
  const register = await prisma.register.findUnique({
    where: { id: '8e9f714d-a606-4801-a755-8512062600e5' },
    include: {
      session: true,
      attendance: true
    }
  });
  
  console.log('Register has attendance:', register?.attendance?.length || 0);
  console.log('Register status:', register?.status);
  console.log('Session ID:', register?.sessionId);
  
  // Check if there's ANY filter that would exclude this
  const matchingRegisters = await prisma.register.findMany({
    where: {
      date: register?.date,
      status: 'active'
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
      },
      attendance: true
    },
    orderBy: { date: 'desc' },
    take: 5
  });
  
  console.log('\nOther registers from same date:');
  matchingRegisters.forEach(r => {
    console.log(`- ${r.session?.activity?.venue?.name}: ${r.session?.activity?.title} (${r.attendance?.length || 0} children)`);
  });
  
  await prisma.$disconnect();
}

checkRegisterAttendance();
