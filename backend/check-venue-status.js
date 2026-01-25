const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkVenueStatus() {
  const venue = await prisma.venue.findFirst({
    where: { name: 'holiday club 123' },
    include: { owner: true }
  });
  
  console.log('Venue:', venue?.name);
  console.log('Active:', venue?.isActive);
  console.log('Owner:', venue?.owner?.firstName, venue?.owner?.lastName);
  console.log('Owner Role:', venue?.owner?.role);
  console.log('Owner Email:', venue?.owner?.email);
  
  const register = await prisma.register.findUnique({
    where: { id: '8e9f714d-a606-4801-a755-8512062600e5' }
  });
  
  console.log('Register Status:', register?.status);
  
  await prisma.$disconnect();
}

checkVenueStatus();
