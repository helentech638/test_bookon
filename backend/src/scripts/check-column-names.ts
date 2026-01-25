import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

/**
 * Check actual database column names
 */
async function checkColumnNames() {
  try {
    logger.info('Checking actual database column names...');

    // Check bookings table structure
    const bookingsColumns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'bookings' 
      ORDER BY ordinal_position;
    `;
    
    logger.info('Bookings table columns:', bookingsColumns);

    // Check users table structure
    const usersColumns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position;
    `;
    
    logger.info('Users table columns:', usersColumns);

    // Check activities table structure
    const activitiesColumns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'activities' 
      ORDER BY ordinal_position;
    `;
    
    logger.info('Activities table columns:', activitiesColumns);

    // Check attendance table structure
    const attendanceColumns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'attendance' 
      ORDER BY ordinal_position;
    `;
    
    logger.info('Attendance table columns:', attendanceColumns);

  } catch (error) {
    logger.error('Error checking column names:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
if (require.main === module) {
  checkColumnNames()
    .then(() => {
      logger.info('Column name check completed!');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Column name check failed:', error);
      process.exit(1);
    });
}

export { checkColumnNames };



