const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAdminRole() {
  const adminUser = await prisma.user.findFirst({ where: { role: 'admin' } });
  console.log('Admin User:');
  console.log('  Email:', adminUser?.email);
  console.log('  Role:', adminUser?.role);
  console.log('  FirstName:', adminUser?.firstName);
  console.log('  LastName:', adminUser?.lastName);
  console.log('  ID:', adminUser?.id);
  
  // Check total registers vs what admin can see
  const allRegisters = await prisma.register.count();
  const registersFromHolidayClub = await prisma.register.findMany({
    where: {
      session: {
        activity: {
          venue: { name: 'holiday club 123' }
        }
      }
    }
  });
  
  console.log('\nTotal registers in database:', allRegisters);
  console.log('Registers from "holiday club 123":', registersFromHolidayClub.length);
  console.log('Register ID from holiday club:', registersFromHolidayClub[0]?.id);
  
  await prisma.$disconnect();
}

checkAdminRole();
