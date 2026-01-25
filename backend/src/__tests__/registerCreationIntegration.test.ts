import { PrismaClient } from '@prisma/client';
import { createRegisterForBooking } from '../routes/payments';
import { AppError } from '../middleware/errorHandler';

// Integration test for the complete register creation flow
describe('Register Creation Integration Test', () => {
  let prisma: PrismaClient;
  let testUser: any;
  let testChild: any;
  let testActivity: any;
  let testVenue: any;
  let testBooking: any;

  beforeAll(async () => {
    // Initialize Prisma client for testing
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL || 'postgresql://bookon_user:bookon_password@localhost:5432/bookon_test',
        },
      },
    });

    // Clean up test data
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Create test data for each test
    await createTestData();
  });

  afterEach(async () => {
    // Clean up test data after each test
    await cleanupTestData();
  });

  async function cleanupTestData() {
    // Delete in reverse order of dependencies
    await prisma.attendance.deleteMany({
      where: {
        booking: {
          parent: {
            email: 'test@example.com',
          },
        },
      },
    });

    await prisma.register.deleteMany({
      where: {
        session: {
          activity: {
            owner: {
              email: 'test@example.com',
            },
          },
        },
      },
    });

    await prisma.session.deleteMany({
      where: {
        activity: {
          owner: {
            email: 'test@example.com',
          },
        },
      },
    });

    await prisma.booking.deleteMany({
      where: {
        parent: {
          email: 'test@example.com',
        },
      },
    });

    await prisma.child.deleteMany({
      where: {
        parent: {
          email: 'test@example.com',
        },
      },
    });

    await prisma.activity.deleteMany({
      where: {
        owner: {
          email: 'test@example.com',
        },
      },
    });

    await prisma.venue.deleteMany({
      where: {
        owner: {
          email: 'test@example.com',
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        email: 'test@example.com',
      },
    });
  }

  async function createTestData() {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        password_hash: 'hashed_password',
        role: 'parent',
        isActive: true,
      },
    });

    // Create test venue
    testVenue = await prisma.venue.create({
      data: {
        name: 'Test Venue',
        address: '123 Test Street',
        ownerId: testUser.id,
        isActive: true,
      },
    });

    // Create test activity
    testActivity = await prisma.activity.create({
      data: {
        title: 'Test Swimming Lesson',
        description: 'A test swimming lesson',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        startTime: '10:00',
        endTime: '11:00',
        capacity: 20,
        price: 25.00,
        venueId: testVenue.id,
        ownerId: testUser.id,
        createdBy: testUser.id,
        status: 'active',
        isActive: true,
      },
    });

    // Create test child
    testChild = await prisma.child.create({
      data: {
        firstName: 'Test',
        lastName: 'Child',
        dateOfBirth: new Date('2015-01-01'),
        school: 'Test School',
        parentId: testUser.id,
      },
    });

    // Create test booking
    testBooking = await prisma.booking.create({
      data: {
        parentId: testUser.id,
        activityId: testActivity.id,
        childId: testChild.id,
        activityDate: new Date('2024-01-15'),
        activityTime: '10:00',
        status: 'confirmed',
        amount: 25.00,
        paymentStatus: 'paid',
        paymentMethod: 'card',
      },
    });
  }

  describe('Complete Register Creation Flow', () => {
    it('should create session, register, and attendance for a new booking', async () => {
      // Verify no session exists initially
      const initialSession = await prisma.session.findFirst({
        where: {
          activityId: testActivity.id,
          date: new Date('2024-01-15'),
        },
      });
      expect(initialSession).toBeNull();

      // Verify no register exists initially
      const initialRegister = await prisma.register.findFirst({
        where: {
          session: {
            activityId: testActivity.id,
            date: new Date('2024-01-15'),
          },
        },
      });
      expect(initialRegister).toBeNull();

      // Verify no attendance exists initially
      const initialAttendance = await prisma.attendance.findFirst({
        where: {
          childId: testChild.id,
          bookingId: testBooking.id,
        },
      });
      expect(initialAttendance).toBeNull();

      // Execute register creation
      await createRegisterForBooking(testBooking);

      // Verify session was created
      const createdSession = await prisma.session.findFirst({
        where: {
          activityId: testActivity.id,
          date: new Date('2024-01-15'),
        },
      });
      expect(createdSession).toBeTruthy();
      expect(createdSession?.startTime).toBe('10:00');
      expect(createdSession?.endTime).toBe('10:00');
      expect(createdSession?.status).toBe('active');
      expect(createdSession?.capacity).toBe(20);

      // Verify register was created
      const createdRegister = await prisma.register.findFirst({
        where: {
          sessionId: createdSession?.id,
        },
      });
      expect(createdRegister).toBeTruthy();
      expect(createdRegister?.status).toBe('upcoming');
      expect(createdRegister?.notes).toContain(`Auto-created for booking ${testBooking.id}`);

      // Verify attendance was created
      const createdAttendance = await prisma.attendance.findFirst({
        where: {
          registerId: createdRegister?.id,
          childId: testChild.id,
          bookingId: testBooking.id,
        },
      });
      expect(createdAttendance).toBeTruthy();
      expect(createdAttendance?.present).toBe(false);
      expect(createdAttendance?.notes).toContain('Auto-enrolled for Test Swimming Lesson');
    });

    it('should reuse existing session when creating register', async () => {
      // Create a session first
      const existingSession = await prisma.session.create({
        data: {
          activityId: testActivity.id,
          date: new Date('2024-01-15'),
          startTime: '10:00',
          endTime: '11:00',
          status: 'active',
          capacity: 20,
        },
      });

      // Execute register creation
      await createRegisterForBooking(testBooking);

      // Verify no new session was created
      const sessions = await prisma.session.findMany({
        where: {
          activityId: testActivity.id,
          date: new Date('2024-01-15'),
        },
      });
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe(existingSession.id);

      // Verify register was created for existing session
      const createdRegister = await prisma.register.findFirst({
        where: {
          sessionId: existingSession.id,
        },
      });
      expect(createdRegister).toBeTruthy();
    });

    it('should reuse existing register when creating attendance', async () => {
      // Create session and register first
      const existingSession = await prisma.session.create({
        data: {
          activityId: testActivity.id,
          date: new Date('2024-01-15'),
          startTime: '10:00',
          endTime: '11:00',
          status: 'active',
          capacity: 20,
        },
      });

      const existingRegister = await prisma.register.create({
        data: {
          sessionId: existingSession.id,
          date: new Date('2024-01-15'),
          status: 'upcoming',
          notes: 'Existing register',
        },
      });

      // Execute register creation
      await createRegisterForBooking(testBooking);

      // Verify no new register was created
      const registers = await prisma.register.findMany({
        where: {
          sessionId: existingSession.id,
        },
      });
      expect(registers).toHaveLength(1);
      expect(registers[0].id).toBe(existingRegister.id);

      // Verify attendance was created for existing register
      const createdAttendance = await prisma.attendance.findFirst({
        where: {
          registerId: existingRegister.id,
          childId: testChild.id,
          bookingId: testBooking.id,
        },
      });
      expect(createdAttendance).toBeTruthy();
    });

    it('should skip attendance creation when it already exists', async () => {
      // Create session, register, and attendance first
      const existingSession = await prisma.session.create({
        data: {
          activityId: testActivity.id,
          date: new Date('2024-01-15'),
          startTime: '10:00',
          endTime: '11:00',
          status: 'active',
          capacity: 20,
        },
      });

      const existingRegister = await prisma.register.create({
        data: {
          sessionId: existingSession.id,
          date: new Date('2024-01-15'),
          status: 'upcoming',
          notes: 'Existing register',
        },
      });

      const existingAttendance = await prisma.attendance.create({
        data: {
          registerId: existingRegister.id,
          childId: testChild.id,
          bookingId: testBooking.id,
          present: true,
          notes: 'Existing attendance',
        },
      });

      // Execute register creation
      await createRegisterForBooking(testBooking);

      // Verify no new attendance was created
      const attendanceRecords = await prisma.attendance.findMany({
        where: {
          registerId: existingRegister.id,
          childId: testChild.id,
          bookingId: testBooking.id,
        },
      });
      expect(attendanceRecords).toHaveLength(1);
      expect(attendanceRecords[0].id).toBe(existingAttendance.id);
      expect(attendanceRecords[0].notes).toBe('Existing attendance'); // Should not be overwritten
    });

    it('should handle database errors gracefully', async () => {
      // Mock a database error by disconnecting Prisma
      await prisma.$disconnect();

      // Execute register creation - should not throw
      await expect(createRegisterForBooking(testBooking)).resolves.not.toThrow();

      // Reconnect for cleanup
      await prisma.$connect();
    });
  });

  describe('Data Integrity', () => {
    it('should maintain referential integrity', async () => {
      // Execute register creation
      await createRegisterForBooking(testBooking);

      // Verify all relationships are correct
      const session = await prisma.session.findFirst({
        where: {
          activityId: testActivity.id,
          date: new Date('2024-01-15'),
        },
      });
      expect(session).toBeTruthy();

      const register = await prisma.register.findFirst({
        where: {
          sessionId: session?.id,
        },
      });
      expect(register).toBeTruthy();

      const attendance = await prisma.attendance.findFirst({
        where: {
          registerId: register?.id,
          childId: testChild.id,
          bookingId: testBooking.id,
        },
      });
      expect(attendance).toBeTruthy();

      // Verify the complete chain
      expect(session?.activityId).toBe(testActivity.id);
      expect(register?.sessionId).toBe(session?.id);
      expect(attendance?.registerId).toBe(register?.id);
      expect(attendance?.childId).toBe(testChild.id);
      expect(attendance?.bookingId).toBe(testBooking.id);
    });
  });
});
