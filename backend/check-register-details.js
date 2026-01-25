const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRegisterDetails() {
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
      }
    }
  });
  
  console.log('Session:', register.session?.id);
  console.log('Activity:', register.session?.activity?.title);
  console.log('Activity Active:', register.session?.activity?.isActive);
  console.log('Venue:', register.session?.activity?.venue?.name);
  console.log('Activity Type:', register.session?.activity?.type);
  console.log('Session Start:', register.session?.startTime);
  console.log('Session End:', register.session?.endTime);
  
  await prisma.$disconnect();
}

checkRegisterDetails();
