import { PrismaClient } from '@prisma/client';
import { createRegisterForBooking } from '../routes/payments';
import { AppError } from '../middleware/errorHandler';

// Mock Prisma client
const mockPrisma = {
  session: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  register: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  attendance: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
} as any;

// Mock the prisma instance
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Register Creation Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createRegisterForBooking', () => {
    const mockBooking = {
      id: 'booking-123',
      activityId: 'activity-123',
      activityDate: new Date('2024-01-15'),
      activityTime: '10:00',
      childId: 'child-123',
      activity: {
        title: 'Test Activity',
      },
    };

    it('should create session, register, and attendance when none exist', async () => {
      // Mock: No existing session
      mockPrisma.session.findFirst.mockResolvedValue(null);
      
      // Mock: Session creation
      const mockSession = {
        id: 'session-123',
        activityId: 'activity-123',
        date: new Date('2024-01-15'),
        startTime: '10:00',
        endTime: '10:00',
        status: 'active',
        capacity: 20,
      };
      mockPrisma.session.create.mockResolvedValue(mockSession);

      // Mock: No existing register
      mockPrisma.register.findFirst.mockResolvedValue(null);
      
      // Mock: Register creation
      const mockRegister = {
        id: 'register-123',
        sessionId: 'session-123',
        date: new Date('2024-01-15'),
        status: 'upcoming',
        notes: `Auto-created for booking ${mockBooking.id}`,
      };
      mockPrisma.register.create.mockResolvedValue(mockRegister);

      // Mock: No existing attendance
      mockPrisma.attendance.findFirst.mockResolvedValue(null);
      
      // Mock: Attendance creation
      const mockAttendance = {
        id: 'attendance-123',
        registerId: 'register-123',
        childId: 'child-123',
        bookingId: 'booking-123',
        present: false,
        notes: 'Auto-enrolled for Test Activity',
      };
      mockPrisma.attendance.create.mockResolvedValue(mockAttendance);

      // Execute the function
      await createRegisterForBooking(mockBooking);

      // Verify session creation
      expect(mockPrisma.session.findFirst).toHaveBeenCalledWith({
        where: {
          activityId: 'activity-123',
          date: new Date('2024-01-15'),
        },
      });

      expect(mockPrisma.session.create).toHaveBeenCalledWith({
        data: {
          activityId: 'activity-123',
          date: new Date('2024-01-15'),
          startTime: '10:00',
          endTime: '10:00',
          status: 'active',
          capacity: 20,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      });

      // Verify register creation
      expect(mockPrisma.register.findFirst).toHaveBeenCalledWith({
        where: { sessionId: 'session-123' },
      });

      expect(mockPrisma.register.create).toHaveBeenCalledWith({
        data: {
          sessionId: 'session-123',
          date: new Date('2024-01-15'),
          status: 'upcoming',
          notes: `Auto-created for booking ${mockBooking.id}`,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      });

      // Verify attendance creation
      expect(mockPrisma.attendance.findFirst).toHaveBeenCalledWith({
        where: {
          registerId: 'register-123',
          childId: 'child-123',
          bookingId: 'booking-123',
        },
      });

      expect(mockPrisma.attendance.create).toHaveBeenCalledWith({
        data: {
          registerId: 'register-123',
          childId: 'child-123',
          bookingId: 'booking-123',
          present: false,
          notes: 'Auto-enrolled for Test Activity',
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should use existing session when it exists', async () => {
      // Mock: Existing session
      const existingSession = {
        id: 'existing-session-123',
        activityId: 'activity-123',
        date: new Date('2024-01-15'),
      };
      mockPrisma.session.findFirst.mockResolvedValue(existingSession);

      // Mock: No existing register
      mockPrisma.register.findFirst.mockResolvedValue(null);
      
      // Mock: Register creation
      const mockRegister = {
        id: 'register-123',
        sessionId: 'existing-session-123',
        date: new Date('2024-01-15'),
        status: 'upcoming',
        notes: `Auto-created for booking ${mockBooking.id}`,
      };
      mockPrisma.register.create.mockResolvedValue(mockRegister);

      // Mock: No existing attendance
      mockPrisma.attendance.findFirst.mockResolvedValue(null);
      
      // Mock: Attendance creation
      mockPrisma.attendance.create.mockResolvedValue({
        id: 'attendance-123',
        registerId: 'register-123',
        childId: 'child-123',
        bookingId: 'booking-123',
        present: false,
        notes: 'Auto-enrolled for Test Activity',
      });

      // Execute the function
      await createRegisterForBooking(mockBooking);

      // Verify session was not created
      expect(mockPrisma.session.create).not.toHaveBeenCalled();

      // Verify register was created with existing session
      expect(mockPrisma.register.create).toHaveBeenCalledWith({
        data: {
          sessionId: 'existing-session-123',
          date: new Date('2024-01-15'),
          status: 'upcoming',
          notes: `Auto-created for booking ${mockBooking.id}`,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should use existing register when it exists', async () => {
      // Mock: Existing session
      const existingSession = {
        id: 'existing-session-123',
        activityId: 'activity-123',
        date: new Date('2024-01-15'),
      };
      mockPrisma.session.findFirst.mockResolvedValue(existingSession);

      // Mock: Existing register
      const existingRegister = {
        id: 'existing-register-123',
        sessionId: 'existing-session-123',
        date: new Date('2024-01-15'),
        status: 'upcoming',
      };
      mockPrisma.register.findFirst.mockResolvedValue(existingRegister);

      // Mock: No existing attendance
      mockPrisma.attendance.findFirst.mockResolvedValue(null);
      
      // Mock: Attendance creation
      mockPrisma.attendance.create.mockResolvedValue({
        id: 'attendance-123',
        registerId: 'existing-register-123',
        childId: 'child-123',
        bookingId: 'booking-123',
        present: false,
        notes: 'Auto-enrolled for Test Activity',
      });

      // Execute the function
      await createRegisterForBooking(mockBooking);

      // Verify register was not created
      expect(mockPrisma.register.create).not.toHaveBeenCalled();

      // Verify attendance was created with existing register
      expect(mockPrisma.attendance.create).toHaveBeenCalledWith({
        data: {
          registerId: 'existing-register-123',
          childId: 'child-123',
          bookingId: 'booking-123',
          present: false,
          notes: 'Auto-enrolled for Test Activity',
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should skip attendance creation when it already exists', async () => {
      // Mock: Existing session
      const existingSession = {
        id: 'existing-session-123',
        activityId: 'activity-123',
        date: new Date('2024-01-15'),
      };
      mockPrisma.session.findFirst.mockResolvedValue(existingSession);

      // Mock: Existing register
      const existingRegister = {
        id: 'existing-register-123',
        sessionId: 'existing-session-123',
        date: new Date('2024-01-15'),
        status: 'upcoming',
      };
      mockPrisma.register.findFirst.mockResolvedValue(existingRegister);

      // Mock: Existing attendance
      const existingAttendance = {
        id: 'existing-attendance-123',
        registerId: 'existing-register-123',
        childId: 'child-123',
        bookingId: 'booking-123',
        present: false,
      };
      mockPrisma.attendance.findFirst.mockResolvedValue(existingAttendance);

      // Execute the function
      await createRegisterForBooking(mockBooking);

      // Verify attendance was not created
      expect(mockPrisma.attendance.create).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      // Mock: Database error
      mockPrisma.session.findFirst.mockRejectedValue(new Error('Database connection failed'));

      // Execute the function - should not throw
      await expect(createRegisterForBooking(mockBooking)).resolves.not.toThrow();

      // Verify error was logged (mocked logger)
      const { logger } = require('../utils/logger');
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to create register for booking:',
        expect.any(Error)
      );
    });

    it('should handle missing activity title gracefully', async () => {
      const bookingWithoutActivityTitle = {
        ...mockBooking,
        activity: null,
      };

      // Mock: No existing session
      mockPrisma.session.findFirst.mockResolvedValue(null);
      
      // Mock: Session creation
      mockPrisma.session.create.mockResolvedValue({
        id: 'session-123',
        activityId: 'activity-123',
        date: new Date('2024-01-15'),
        startTime: '10:00',
        endTime: '10:00',
        status: 'active',
        capacity: 20,
      });

      // Mock: No existing register
      mockPrisma.register.findFirst.mockResolvedValue(null);
      
      // Mock: Register creation
      mockPrisma.register.create.mockResolvedValue({
        id: 'register-123',
        sessionId: 'session-123',
        date: new Date('2024-01-15'),
        status: 'upcoming',
        notes: `Auto-created for booking ${mockBooking.id}`,
      });

      // Mock: No existing attendance
      mockPrisma.attendance.findFirst.mockResolvedValue(null);
      
      // Mock: Attendance creation
      mockPrisma.attendance.create.mockResolvedValue({
        id: 'attendance-123',
        registerId: 'register-123',
        childId: 'child-123',
        bookingId: 'booking-123',
        present: false,
        notes: 'Auto-enrolled for Activity',
      });

      // Execute the function
      await createRegisterForBooking(bookingWithoutActivityTitle);

      // Verify attendance was created with fallback activity title
      expect(mockPrisma.attendance.create).toHaveBeenCalledWith({
        data: {
          registerId: 'register-123',
          childId: 'child-123',
          bookingId: 'booking-123',
          present: false,
          notes: 'Auto-enrolled for Activity',
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      });
    });
  });
});
