import { Request, Response } from 'express';
import request from 'supertest';
import express from 'express';

// Mock Prisma
const mockPrisma = {
  booking: {
    findMany: jest.fn(),
  },
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

// Mock authentication middleware
jest.mock('../middleware/auth', () => ({
  authenticateToken: (req: Request, res: Response, next: Function) => {
    req.user = { id: 'user-123' };
    next();
  },
}));

// Mock asyncHandler
jest.mock('../middleware/asyncHandler', () => ({
  asyncHandler: (fn: Function) => fn,
}));

// Import the routes
import paymentsRouter from '../routes/payments';

describe('Fix Missing Registers Endpoint', () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/payments', paymentsRouter);
  });

  describe('POST /payments/fix-missing-registers', () => {
    it('should fix missing registers for confirmed bookings', async () => {
      const mockBookings = [
        {
          id: 'booking-1',
          activityId: 'activity-1',
          activityDate: new Date('2024-01-15'),
          activityTime: '10:00',
          childId: 'child-1',
          activity: {
            id: 'activity-1',
            title: 'Swimming Lesson',
          },
          child: {
            id: 'child-1',
            firstName: 'Jane',
            lastName: 'Doe',
          },
        },
        {
          id: 'booking-2',
          activityId: 'activity-2',
          activityDate: new Date('2024-01-16'),
          activityTime: '11:00',
          childId: 'child-2',
          activity: {
            id: 'activity-2',
            title: 'Football Training',
          },
          child: {
            id: 'child-2',
            firstName: 'John',
            lastName: 'Smith',
          },
        },
      ];

      // Mock: Find confirmed bookings
      mockPrisma.booking.findMany.mockResolvedValue(mockBookings);

      // Mock: No existing sessions
      mockPrisma.session.findFirst.mockResolvedValue(null);
      
      // Mock: Session creation
      mockPrisma.session.create
        .mockResolvedValueOnce({
          id: 'session-1',
          activityId: 'activity-1',
          date: new Date('2024-01-15'),
          startTime: '10:00',
          endTime: '10:00',
          status: 'active',
          capacity: 20,
        })
        .mockResolvedValueOnce({
          id: 'session-2',
          activityId: 'activity-2',
          date: new Date('2024-01-16'),
          startTime: '11:00',
          endTime: '11:00',
          status: 'active',
          capacity: 20,
        });

      // Mock: No existing registers
      mockPrisma.register.findFirst.mockResolvedValue(null);
      
      // Mock: Register creation
      mockPrisma.register.create
        .mockResolvedValueOnce({
          id: 'register-1',
          sessionId: 'session-1',
          date: new Date('2024-01-15'),
          status: 'upcoming',
          notes: 'Auto-created for booking booking-1',
        })
        .mockResolvedValueOnce({
          id: 'register-2',
          sessionId: 'session-2',
          date: new Date('2024-01-16'),
          status: 'upcoming',
          notes: 'Auto-created for booking booking-2',
        });

      // Mock: No existing attendance
      mockPrisma.attendance.findFirst.mockResolvedValue(null);
      
      // Mock: Attendance creation
      mockPrisma.attendance.create
        .mockResolvedValueOnce({
          id: 'attendance-1',
          registerId: 'register-1',
          childId: 'child-1',
          bookingId: 'booking-1',
          present: false,
          notes: 'Auto-enrolled for Swimming Lesson',
        })
        .mockResolvedValueOnce({
          id: 'attendance-2',
          registerId: 'register-2',
          childId: 'child-2',
          bookingId: 'booking-2',
          present: false,
          notes: 'Auto-enrolled for Football Training',
        });

      const response = await request(app)
        .post('/payments/fix-missing-registers')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Successfully created registers for 2 bookings',
        data: { fixed: 2 },
      });

      // Verify bookings were found
      expect(mockPrisma.booking.findMany).toHaveBeenCalledWith({
        where: {
          parentId: 'user-123',
          status: 'confirmed',
          paymentStatus: 'paid',
        },
        include: {
          activity: true,
          child: true,
        },
      });

      // Verify sessions were created
      expect(mockPrisma.session.create).toHaveBeenCalledTimes(2);
      
      // Verify registers were created
      expect(mockPrisma.register.create).toHaveBeenCalledTimes(2);
      
      // Verify attendance records were created
      expect(mockPrisma.attendance.create).toHaveBeenCalledTimes(2);
    });

    it('should handle no bookings to fix', async () => {
      // Mock: No confirmed bookings
      mockPrisma.booking.findMany.mockResolvedValue([]);

      const response = await request(app)
        .post('/payments/fix-missing-registers')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Successfully created registers for 0 bookings',
        data: { fixed: 0 },
      });

      // Verify no sessions, registers, or attendance were created
      expect(mockPrisma.session.create).not.toHaveBeenCalled();
      expect(mockPrisma.register.create).not.toHaveBeenCalled();
      expect(mockPrisma.attendance.create).not.toHaveBeenCalled();
    });

    it('should handle partial failures gracefully', async () => {
      const mockBookings = [
        {
          id: 'booking-1',
          activityId: 'activity-1',
          activityDate: new Date('2024-01-15'),
          activityTime: '10:00',
          childId: 'child-1',
          activity: {
            id: 'activity-1',
            title: 'Swimming Lesson',
          },
          child: {
            id: 'child-1',
            firstName: 'Jane',
            lastName: 'Doe',
          },
        },
        {
          id: 'booking-2',
          activityId: 'activity-2',
          activityDate: new Date('2024-01-16'),
          activityTime: '11:00',
          childId: 'child-2',
          activity: {
            id: 'activity-2',
            title: 'Football Training',
          },
          child: {
            id: 'child-2',
            firstName: 'John',
            lastName: 'Smith',
          },
        },
      ];

      // Mock: Find confirmed bookings
      mockPrisma.booking.findMany.mockResolvedValue(mockBookings);

      // Mock: First booking succeeds, second fails
      mockPrisma.session.findFirst
        .mockResolvedValueOnce(null) // First booking: no existing session
        .mockRejectedValueOnce(new Error('Database error')); // Second booking: error

      // Mock: Session creation for first booking
      mockPrisma.session.create.mockResolvedValueOnce({
        id: 'session-1',
        activityId: 'activity-1',
        date: new Date('2024-01-15'),
        startTime: '10:00',
        endTime: '10:00',
        status: 'active',
        capacity: 20,
      });

      // Mock: Register creation for first booking
      mockPrisma.register.findFirst.mockResolvedValueOnce(null);
      mockPrisma.register.create.mockResolvedValueOnce({
        id: 'register-1',
        sessionId: 'session-1',
        date: new Date('2024-01-15'),
        status: 'upcoming',
        notes: 'Auto-created for booking booking-1',
      });

      // Mock: Attendance creation for first booking
      mockPrisma.attendance.findFirst.mockResolvedValueOnce(null);
      mockPrisma.attendance.create.mockResolvedValueOnce({
        id: 'attendance-1',
        registerId: 'register-1',
        childId: 'child-1',
        bookingId: 'booking-1',
        present: false,
        notes: 'Auto-enrolled for Swimming Lesson',
      });

      const response = await request(app)
        .post('/payments/fix-missing-registers')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Successfully created registers for 1 bookings',
        data: { fixed: 1 },
      });

      // Verify error was logged for the failed booking
      const { logger } = require('../utils/logger');
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to fix register for booking booking-2:',
        expect.any(Error)
      );
    });

    it('should handle database errors gracefully', async () => {
      // Mock: Database error when finding bookings
      mockPrisma.booking.findMany.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post('/payments/fix-missing-registers')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        message: 'Failed to fix missing registers',
        code: 'REGISTER_FIX_ERROR',
      });

      // Verify error was logged
      const { logger } = require('../utils/logger');
      expect(logger.error).toHaveBeenCalledWith(
        'Error fixing missing registers:',
        expect.any(Error)
      );
    });
  });
});
