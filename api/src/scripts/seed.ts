// @ts-nocheck
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  try {
    // Clear existing data (in correct order due to foreign keys)
    console.log('🧹 Clearing existing data...');
    
    await prisma.booking.deleteMany();
    await prisma.activity.deleteMany();
    await prisma.venue.deleteMany();
    await prisma.child.deleteMany();
    await prisma.user.deleteMany();

    console.log('✅ Existing data cleared');

    // Create users
    console.log('👥 Creating users...');
    
    const adminPasswordHash = await bcrypt.hash('admin123', 12);
    const parentPasswordHash = await bcrypt.hash('parent123', 12);
    const staffPasswordHash = await bcrypt.hash('staff123', 12);

    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@bookon.com',
        password_hash: adminPasswordHash,
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        isActive: true,
        emailVerified: true,
      },
    });

    const parentUser = await prisma.user.create({
      data: {
        email: 'parent@bookon.com',
        password_hash: parentPasswordHash,
        firstName: 'John',
        lastName: 'Smith',
        role: 'parent',
        isActive: true,
        emailVerified: true,
      },
    });

    await prisma.user.create({
      data: {
        email: 'staff@bookon.com',
        password_hash: staffPasswordHash,
        firstName: 'Jane',
        lastName: 'Doe',
        role: 'staff',
        isActive: true,
        emailVerified: true,
      },
    });

    console.log('✅ Users created');

    // Create children
    console.log('👶 Creating children...');
    
    const child1 = await prisma.child.create({
      data: {
        firstName: 'Emma',
        lastName: 'Smith',
        dateOfBirth: new Date('2015-03-15'),
        parentId: parentUser.id,
      },
    });

    const child2 = await prisma.child.create({
      data: {
        firstName: 'Oliver',
        lastName: 'Smith',
        dateOfBirth: new Date('2017-08-22'),
        parentId: parentUser.id,
      },
    });

    console.log('✅ Children created');

    // Create venues
    console.log('🏢 Creating venues...');
    
    const venue1 = await prisma.venue.create({
      data: {
        name: 'Community Sports Center',
        address: '123 Sports Lane, London',
        description: 'Modern sports facility with multiple courts and equipment',
        capacity: 100,
        ownerId: adminUser.id,
        isActive: true,
      },
    });

    const venue2 = await prisma.venue.create({
      data: {
        name: 'Arts & Crafts Studio',
        address: '456 Creative Street, Manchester',
        description: 'Spacious studio for arts and crafts activities',
        capacity: 50,
        ownerId: adminUser.id,
        isActive: true,
      },
    });

    const venue3 = await prisma.venue.create({
      data: {
        name: 'Swimming Pool Complex',
        address: '789 Water Way, Birmingham',
        description: 'Olympic-sized pool with changing facilities',
        capacity: 200,
        ownerId: adminUser.id,
        isActive: true,
      },
    });

    console.log('✅ Venues created');

    // Create activities
    console.log('🎯 Creating activities...');
    
    const activity1 = await prisma.activity.create({
      data: {
        title: 'Football Training',
        description: 'Learn basic football skills and teamwork',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        startTime: '15:00',
        endTime: '16:30',
        capacity: 20,
        price: 15.00,
        venueId: venue1.id,
        ownerId: adminUser.id,
        isActive: true,
      },
    });

    const activity2 = await prisma.activity.create({
      data: {
        title: 'Art & Painting',
        description: 'Creative painting and drawing sessions',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        startTime: '16:30',
        endTime: '17:30',
        capacity: 15,
        price: 12.00,
        venueId: venue2.id,
        ownerId: adminUser.id,
        isActive: true,
      },
    });

    const activity3 = await prisma.activity.create({
      data: {
        title: 'Swimming Lessons',
        description: 'Learn to swim with certified instructors',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        startTime: '14:00',
        endTime: '14:45',
        capacity: 12,
        price: 18.00,
        venueId: venue3.id,
        ownerId: adminUser.id,
        isActive: true,
      },
    });

    const activity4 = await prisma.activity.create({
      data: {
        title: 'Basketball Training',
        description: 'Develop basketball skills and fitness',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        startTime: '17:00',
        endTime: '18:15',
        capacity: 16,
        price: 15.00,
        venueId: venue1.id,
        ownerId: adminUser.id,
        isActive: true,
      },
    });

    const activity5 = await prisma.activity.create({
      data: {
        title: 'Pottery Workshop',
        description: 'Hands-on pottery making and glazing',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        startTime: '10:00',
        endTime: '12:00',
        capacity: 10,
        price: 25.00,
        venueId: venue2.id,
        ownerId: adminUser.id,
        isActive: true,
      },
    });

    console.log('✅ Activities created');

    // Create bookings
    console.log('📅 Creating bookings...');
    
    await prisma.booking.create({
      data: {
        activityId: activity1.id,
        childId: child1.id,
        parentId: parentUser.id,
        status: 'confirmed',
        amount: 15.00,
        bookingDate: new Date(),
        activityDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        activityTime: '15:00',
      },
    });

    await prisma.booking.create({
      data: {
        activityId: activity2.id,
        childId: child1.id,
        parentId: parentUser.id,
        status: 'pending',
        amount: 12.00,
        bookingDate: new Date(),
        activityDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
        activityTime: '16:30',
      },
    });

    await prisma.booking.create({
      data: {
        activityId: activity3.id,
        childId: child2.id,
        parentId: parentUser.id,
        status: 'confirmed',
        amount: 18.00,
        bookingDate: new Date(),
        activityDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
        activityTime: '14:00',
      },
    });

    await prisma.booking.create({
      data: {
        activityId: activity4.id,
        childId: child1.id,
        parentId: parentUser.id,
        status: 'completed',
        amount: 15.00,
        bookingDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        activityDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        activityTime: '17:00',
      },
    });

    await prisma.booking.create({
      data: {
        activityId: activity5.id,
        childId: child2.id,
        parentId: parentUser.id,
        status: 'cancelled',
        amount: 25.00,
        bookingDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
        activityDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        activityTime: '10:00',
      },
    });

    console.log('✅ Bookings created');

    // Create additional sample data for better testing
    console.log('📊 Creating additional sample data...');
    
    // Create more children for different parents
    const parent2 = await prisma.user.create({
      data: {
        email: 'sarah@bookon.com',
        password_hash: await bcrypt.hash('sarah123', 12),
        firstName: 'Sarah',
        lastName: 'Johnson',
        role: 'parent',
        isActive: true,
        emailVerified: true,
      },
    });

    const child3 = await prisma.child.create({
      data: {
        firstName: 'Sophie',
        lastName: 'Johnson',
        dateOfBirth: new Date('2016-11-08'),
        parentId: parent2.id,
      },
    });

    // Create more bookings
    await prisma.booking.create({
      data: {
        activityId: activity1.id,
        childId: child3.id,
        parentId: parent2.id,
        status: 'confirmed',
        amount: 15.00,
        bookingDate: new Date(),
        activityDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 21 days from now
        activityTime: '15:00',
      },
    });

    await prisma.booking.create({
      data: {
        activityId: activity2.id,
        childId: child3.id,
        parentId: parent2.id,
        status: 'pending',
        amount: 12.00,
        bookingDate: new Date(),
        activityDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000), // 28 days from now
        activityTime: '16:30',
      },
    });

    console.log('✅ Additional sample data created');

    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`👥 Users: ${await prisma.user.count()}`);
    console.log(`👶 Children: ${await prisma.child.count()}`);
    console.log(`🏢 Venues: ${await prisma.venue.count()}`);
    console.log(`🎯 Activities: ${await prisma.activity.count()}`);
    console.log(`📅 Bookings: ${await prisma.booking.count()}`);
    
    console.log('\n🔑 Test Accounts:');
    console.log('Admin: admin@bookon.com / admin123');
    console.log('Parent: parent@bookon.com / parent123');
    console.log('Staff: staff@bookon.com / staff123');
    console.log('Parent 2: sarah@bookon.com / sarah123');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

