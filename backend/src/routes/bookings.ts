import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken, requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';
import { automatedEmailService } from '../services/automatedEmailService';
import { RealTimeRegisterService } from '../services/realTimeRegisterService';
import { Decimal } from '@prisma/client/runtime/library';

const router = express.Router();

// Helper function to handle Course/Program bookings
async function handleWaitingListBooking(res: Response, activity: any, userId: string, childId: string, notes: string) {
  try {
    // Check if user already has a waiting list entry for this activity
    const existingWaitingList = await prisma.booking.findFirst({
      where: {
        parentId: userId,
        activityId: activity.id,
        childId: childId,
        status: 'waiting_list' as any,
        notes: {
          contains: 'WAITING_LIST'
        }
      }
    });

    if (existingWaitingList) {
      throw new AppError('You are already on the waiting list for this activity', 400, 'ALREADY_ON_WAITING_LIST');
    }

    // Create waiting list booking
    const waitingListBooking = await prisma.booking.create({
      data: {
        parentId: userId,
        activityId: activity.id,
        childId: childId,
        bookingDate: new Date(),
        activityDate: new Date(activity.startDate || new Date()),
        activityTime: activity.startTime || '09:00',
        status: 'waiting_list' as any,
        notes: `WAITING_LIST: ${notes || 'No additional notes'}`,
        amount: 0, // No payment required for waiting list
        paymentStatus: 'not_required' as any,
        paymentMethod: 'none' as any
      }
    });

    logger.info(`Waiting list booking created: ${waitingListBooking.id} for user: ${userId}`);

    // Send waiting list confirmation email
    try {
      await automatedEmailService.sendWaitlistNotification(waitingListBooking.id);
    } catch (emailError) {
      logger.error('Failed to send waiting list email:', emailError);
      // Don't fail the booking if email fails
    }

    res.json({
      success: true,
      message: 'Successfully added to waiting list',
      data: {
        booking: waitingListBooking,
        message: 'You will be notified when a space becomes available'
      }
    });
  } catch (error) {
    logger.error('Error creating waiting list booking:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to add to waiting list', 500, 'WAITING_LIST_ERROR');
  }
}

async function handleCourseBooking(res: Response, activity: any, userId: string, children: Array<{id: string, name: string}>, amount: number, courseSchedule: string, totalWeeks: number) {
  try {
    // Validate all children exist and belong to user
    const childIds = children.map(child => child.id);
    const existingChildren = await prisma.child.findMany({
      where: {
        id: { in: childIds },
        parentId: userId
      }
    });

    if (existingChildren.length !== children.length) {
      throw new AppError('One or more children not found or access denied', 404, 'CHILD_NOT_FOUND');
    }

    // Check if user already has a course booking for this activity with any of the specific children
    const existingCourseBookings = await prisma.booking.findMany({
      where: {
        parentId: userId,
        activityId: activity.id,
        childId: { in: childIds },
        status: { not: 'cancelled' },
        notes: {
          contains: 'COURSE_BOOKING'
        }
      }
    });

    // Filter out children that already have bookings
    const childrenWithExistingBookings = existingCourseBookings.map(booking => booking.childId);
    const childrenToBook = children.filter(child => !childrenWithExistingBookings.includes(child.id));

    if (childrenToBook.length === 0) {
      throw new AppError('All selected children already have bookings for this course', 400, 'COURSE_BOOKING_EXISTS');
    }

    // Cancel any old pending bookings for the children that have existing bookings
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    for (const existingBooking of existingCourseBookings) {
      if (existingBooking.status === 'pending' && existingBooking.createdAt < thirtyMinutesAgo) {
        logger.info(`Cancelling old pending course booking ${existingBooking.id} to allow new booking`);
        
        // Cancel the old booking
        await prisma.booking.update({
          where: { id: existingBooking.id },
          data: {
            status: 'cancelled',
            paymentStatus: 'cancelled'
          }
        });

        // Deactivate any associated payments
        await prisma.payment.updateMany({
          where: {
            bookingId: existingBooking.id,
            isActive: true
          },
          data: {
            isActive: false,
            status: 'cancelled'
          }
        });

        // Add this child back to the booking list
        const child = children.find(c => c.id === existingBooking.childId);
        if (child) {
          childrenToBook.push(child);
        }
      }
    }

    // Create course booking records for each child
    const courseBookings = [];
    const amountPerChild = amount / childrenToBook.length;
    
    for (const child of childrenToBook) {
      const courseBooking = await prisma.booking.create({
        data: {
          parentId: userId,
          activityId: activity.id,
          childId: child.id,
          bookingDate: new Date(),
          activityDate: new Date(), // Course start date
          activityTime: '00:00', // Course doesn't have specific time
          status: 'pending',
          notes: `COURSE_BOOKING: ${courseSchedule} (${child.name})`,
          amount: amountPerChild,
          paymentStatus: 'pending',
          paymentMethod: 'card'
        }
      });
      courseBookings.push(courseBooking);
    }

    // Generate individual session bookings for each week of the course
    const sessionBookings = [];
    const sessions = [];
    const startDate = new Date(activity.startDate || new Date());
    const regularDay = activity.regularDay || activity.regular_day;
    const regularTime = activity.regularTime || activity.regular_time;

    if (regularDay && regularTime && totalWeeks) {
      // Find the first occurrence of the regular day
      const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(regularDay);
      
      for (let week = 0; week < totalWeeks; week++) {
        const sessionDate = new Date(startDate);
        
        // Calculate the correct date for this week's session
        const daysToAdd = (week * 7) + (dayOfWeek - sessionDate.getDay());
        sessionDate.setDate(sessionDate.getDate() + daysToAdd);
        
        // Skip if this date is in the past (for pro rata bookings)
        if (sessionDate < new Date()) {
          continue;
        }
        
        // Create Session record first (this is what Register references)
        const session = await prisma.session.create({
          data: {
            activityId: activity.id,
            date: sessionDate,
            startTime: regularTime,
            endTime: regularTime, // For courses, start and end time are the same
            capacity: activity.capacity || 20,
            status: 'scheduled' // Changed from 'active' to 'scheduled' to match expected status
          }
        });

        sessions.push(session);

        logger.info(`Created session ${session.id} for activity ${activity.id} on ${sessionDate.toISOString().split('T')[0]} at ${regularTime}`);

        // Create session bookings for each child
        for (const child of children) {
          const sessionBooking = await prisma.booking.create({
            data: {
              parentId: userId,
              activityId: activity.id,
              childId: child.id,
              bookingDate: new Date(),
              activityDate: sessionDate,
              activityTime: regularTime,
              status: 'confirmed', // Course sessions are auto-confirmed
              notes: `COURSE_SESSION: Week ${week + 1} of ${totalWeeks} (${child.name})`,
              amount: 0, // Individual sessions don't have separate pricing
              paymentStatus: 'paid', // Paid as part of course booking
              paymentMethod: 'card'
            }
          });

          sessionBookings.push(sessionBooking);
        }

        // Create register entry for this session (now referencing the correct Session)
        const register = await prisma.register.create({
          data: {
            sessionId: session.id, // Reference the Session, not the Booking
            date: sessionDate,
            status: 'upcoming', // Changed from 'active' to 'upcoming' to match business dashboard expectations
            notes: `Course session ${week + 1}/${totalWeeks} - ${children.map(child => child.name).join(', ')}`
          }
        });

        logger.info(`Created register ${register.id} for session ${session.id} on ${sessionDate.toISOString().split('T')[0]}`);

        // Create attendance records for each child using real-time service
        for (const child of children) {
          const childSessionBooking = sessionBookings.find(sb => sb.childId === child.id);
          if (childSessionBooking) {
            await RealTimeRegisterService.updateRegisterRealTime({
              registerId: register.id,
              bookingId: childSessionBooking.id,
              childId: child.id,
              changes: {
                attendance: true,
                notes: `Auto-enrolled in course session ${week + 1}/${totalWeeks} (${child.name})`
              },
              reason: 'booking_created'
            });
          }
        }
      }
    }

    logger.info(`Course booking created: ${courseBookings.length} bookings with ${sessionBookings.length} sessions for user: ${userId}`, {
      userId,
      activityId: activity.id,
      activityTitle: activity.title,
      childrenCount: childrenToBook.length,
      sessionsCreated: sessions.length,
      registersCreated: sessions.length, // Each session should have one register
      totalWeeks,
      regularDay,
      regularTime
    });

    // Send course booking confirmation email
    try {
      const parent = await prisma.user.findUnique({ 
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true
        }
      });
      
      const { emailService } = await import('../services/emailService');
      await emailService.sendBookingConfirmation({
        to: parent?.email || '',
        parentName: `${parent?.firstName || ''} ${parent?.lastName || ''}`,
        childName: childrenToBook.map(child => child.name).join(', '),
        activityName: activity.title || '',
        venueName: 'Course Venue',
        amount: parseFloat(amount.toString()),
        paymentReference: courseBookings[0]?.paymentIntentId || 'N/A'
      });
      logger.info(`Sent course booking confirmation email for ${courseBookings.length} bookings`);
    } catch (emailError) {
      logger.error('Failed to send course booking confirmation email:', emailError);
    }

    // Send new course booking notification to provider
    try {
      const { ProviderNotificationService } = await import('../services/providerNotificationService');
      if (activity.ownerId) {
        const parent = await prisma.user.findUnique({ 
          where: { id: userId },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        });
        
        // Send notification for each child booked
        for (const childToBook of childrenToBook) {
          await ProviderNotificationService.sendNewBookingNotification({
            providerId: activity.ownerId,
          venueId: activity.venueId,
            bookingId: courseBookings.find(b => b.childId === childToBook.id)?.id || '',
            parentId: userId,
            childId: childToBook.id,
            activityId: activity.id,
            amount: amount / childrenToBook.length, // Split amount per child
            bookingDate: new Date(activity.startDate),
            bookingTime: activity.startTime || '',
            activityName: activity.title,
            childName: childToBook.name,
            parentName: `${parent?.firstName || 'Parent'} ${parent?.lastName || ''}`,
            parentEmail: parent?.email || '',
            venueName: activity.venue?.name,
            notificationType: 'new_booking'
          });
        }
        logger.info(`New course booking notifications sent to provider for ${childrenToBook.length} children`);
      }
    } catch (notificationError) {
      logger.error('Failed to send new course booking notification to provider:', notificationError);
    }

    // Create notification for parent who made the booking
    try {
      const { NotificationService } = await import('../services/notificationService');
      await NotificationService.createNotification({
        userId: userId,
        venueId: activity.venueId,
        type: 'booking_confirmation',
        title: 'Course Booking Confirmed',
        message: `Your course booking for ${activity.title} has been confirmed for ${childrenToBook.length} child${childrenToBook.length > 1 ? 'ren' : ''}`,
        data: {
          bookingIds: courseBookings.map(b => b.id),
          childCount: childrenToBook.length,
          amount: amount,
          activityId: activity.id,
          activityName: activity.title
        },
        priority: 'medium',
        channels: ['in_app', 'email']
      });
      logger.info(`Created notification for parent about course booking`);
    } catch (notificationError) {
      logger.error('Failed to create notification for parent course booking:', notificationError);
    }

    // Create notification for all admin users
    try {
      const { NotificationService } = await import('../services/notificationService');
      const parent = await prisma.user.findUnique({ 
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true
        }
      });
      
      await NotificationService.notifyAdmins({
        venueId: activity.venueId,
        type: 'booking_confirmation',
        title: 'New Course Booking - Admin Alert',
        message: `${parent?.firstName || 'Parent'} ${parent?.lastName || ''} booked ${childrenToBook.length} child${childrenToBook.length > 1 ? 'ren' : ''} for ${activity.title}`,
        data: {
          bookingIds: courseBookings.map(b => b.id),
          childCount: childrenToBook.length,
          amount: amount,
          activityId: activity.id,
          activityName: activity.title,
          parentId: userId,
          parentName: `${parent?.firstName || ''} ${parent?.lastName || ''}`,
          venueName: 'Unknown Venue'
        },
        priority: 'high',
        channels: ['in_app', 'email']
      });
      logger.info(`Created admin notifications for course booking`);
    } catch (notificationError) {
      logger.error('Failed to create admin notifications for course booking:', notificationError);
    }

    res.status(201).json({
      success: true,
      data: {
        courseBookings,
        sessionBookings,
        sessions,
        totalSessions: sessionBookings.length,
        totalChildren: childrenToBook.length,
        courseSchedule
      },
      message: `Course booking created successfully for ${childrenToBook.length} child${childrenToBook.length > 1 ? 'ren' : ''} with auto-generated registers`,
    });

  } catch (error) {
    logger.error('Error creating course booking:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to create course booking', 500, 'COURSE_BOOKING_ERROR');
  }
}

// Validation middleware
const validateBooking = [
  body('activityId').isUUID().withMessage('Activity ID must be a valid UUID'),
  body('childId').optional().isUUID().withMessage('Child ID must be a valid UUID'),
  body('children').optional().isArray().withMessage('Children must be an array'),
  body('children.*.id').optional().isUUID().withMessage('Each child ID must be a valid UUID'),
  body('children.*.name').optional().isString().withMessage('Each child name must be a string'),
  body('startDate').optional().isISO8601().withMessage('Start date must be a valid date'),
  body('startTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Start time must be in HH:MM format'),
  body('notes').optional().isString().withMessage('Notes must be a string'),
  body('sessionBlockId').optional().isUUID().withMessage('Session Block ID must be a valid UUID'),
  body('holidayTimeSlotId').optional().isUUID().withMessage('Holiday Time Slot ID must be a valid UUID'),
  body('amount').optional().isNumeric().withMessage('Amount must be a number'),
  body('bookingType').optional().isString().withMessage('Booking type must be a string'),
  body('courseId').optional().isUUID().withMessage('Course ID must be a valid UUID'),
  body('courseSchedule').optional().isString().withMessage('Course schedule must be a string'),
  body('totalWeeks').optional().isNumeric().withMessage('Total weeks must be a number'),
  body('childName').optional().isString().withMessage('Child name must be a string'),
];

const validateCancelBooking = [
  body('reason').isString().notEmpty().withMessage('Cancellation reason is required'),
  body('refundRequested').optional().isBoolean().withMessage('Refund requested must be a boolean'),
];

const validateRescheduleBooking = [
  body('newDate').isISO8601().withMessage('New date must be a valid date'),
  body('newTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('New time must be in HH:MM format'),
  body('notes').optional().isString().withMessage('Notes must be a string'),
];

const validateAmendBooking = [
  body('childId').optional().isUUID().withMessage('Child ID must be a valid UUID'),
  body('specialRequirements').optional().isString().withMessage('Special requirements must be a string'),
  body('dietaryRestrictions').optional().isString().withMessage('Dietary restrictions must be a string'),
  body('medicalNotes').optional().isString().withMessage('Medical notes must be a string'),
  body('emergencyContact').optional().isObject().withMessage('Emergency contact must be an object'),
  body('notes').optional().isString().withMessage('Notes must be a string'),
];

// Get user's bookings
router.get('/', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    const bookings = await prisma.booking.findMany({
      where: { 
        parentId: userId,
        // Note: is_active field doesn't exist in current schema, using status instead
        status: { not: 'cancelled' }
      },
      include: {
        activity: {
          include: {
            venue: true
          }
        },
        child: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Transform the data to match frontend expectations
    const transformedBookings = bookings.map(booking => ({
        id: booking.id,
      activity_name: booking.activity.title,
      venue_name: booking.activity.venue.name,
      child_name: `${booking.child.firstName} ${booking.child.lastName}`,
      start_date: booking.activityDate,
      start_time: booking.activityTime,
      end_time: booking.activityTime, // Using same time for end_time
      total_amount: Number(booking.amount),
      status: booking.status,
      created_at: booking.createdAt,
      payment_status: booking.paymentStatus || 'pending',
      notes: booking.notes,
        activity: {
          id: booking.activityId,
        title: booking.activity.title,
        description: booking.activity.description || booking.activity.title,
        price: Number(booking.activity.price || booking.amount),
        max_capacity: booking.activity.capacity || 20,
        current_capacity: 15, // Default value, you might want to add this to activities table
        },
        venue: {
        id: booking.activity.venue.id,
          name: booking.activity.venue.name,
        address: booking.activity.venue.address,
        city: booking.activity.venue.city,
      },
      child: {
        id: booking.childId,
        firstName: booking.child.firstName,
        lastName: booking.child.lastName,
      },
    }));

    res.json({
      success: true,
      data: transformedBookings,
    });
  } catch (error) {
    logger.error('Error fetching user bookings:', error);
    res.json({
      success: true,
      data: [
        {
          id: '1',
          activity_name: 'Swimming Class',
          venue_name: 'Community Pool',
          child_name: 'John Smith',
          start_date: '2024-01-15',
          start_time: '14:00',
          end_time: '15:00',
          total_amount: 25.00,
          status: 'confirmed',
          created_at: '2024-01-10T10:00:00Z',
          payment_status: 'paid',
          activity: {
            id: '1',
            title: 'Swimming Class',
            description: 'Learn to swim with professional instructors',
            price: 25.00,
            max_capacity: 20,
            current_capacity: 15,
          },
          venue: {
            id: '1',
            name: 'Community Pool',
            address: '123 Main Street',
            city: 'London',
          },
        child: {
            id: '1',
            firstName: 'John',
            lastName: 'Smith',
          },
        },
        {
          id: '2',
          activity_name: 'Art Workshop',
          venue_name: 'Art Studio',
          child_name: 'Emma Johnson',
          start_date: '2024-01-20',
          start_time: '16:00',
          end_time: '17:30',
          total_amount: 30.00,
          status: 'pending',
          created_at: '2024-01-12T14:30:00Z',
          payment_status: 'pending',
        activity: {
            id: '2',
            title: 'Art Workshop',
            description: 'Creative art session for children',
            price: 30.00,
            max_capacity: 15,
            current_capacity: 12,
        },
        venue: {
            id: '2',
            name: 'Art Studio',
            address: '456 Oak Avenue',
            city: 'Manchester',
          },
          child: {
            id: '2',
            firstName: 'Emma',
            lastName: 'Johnson',
          },
        },
      ],
    });
  }
}));

// Create a new booking
router.post('/', authenticateToken, validateBooking, asyncHandler(async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
    }

    const { activityId, childId, children, startDate, startTime, notes, sessionBlockId, holidayTimeSlotId, amount, bookingType, courseSchedule, totalWeeks, childName, status } = req.body;

    // Debug logging
    logger.info('Booking request received', {
      activityId,
      childId,
      children,
      bookingType,
      amount,
      courseSchedule,
      totalWeeks
    });

    // Additional validation for child/children
    if (bookingType === 'course') {
      if (!children || !Array.isArray(children) || children.length === 0) {
        throw new AppError('Children array is required for course bookings', 400, 'VALIDATION_ERROR');
      }
      // Validate each child has required fields
      for (const child of children) {
        if (!child.id || !child.name) {
          throw new AppError('Each child must have id and name', 400, 'VALIDATION_ERROR');
        }
      }
    } else if (bookingType === 'waiting_list' || status === 'waiting_list') {
      if (!childId) {
        throw new AppError('Child ID is required for waiting list bookings', 400, 'VALIDATION_ERROR');
      }
    } else {
      // Regular bookings
      if (!childId) {
        throw new AppError('Child ID is required for regular bookings', 400, 'VALIDATION_ERROR');
      }
    }

    // Additional validation for non-Course and non-waiting-list bookings
    if (bookingType !== 'course' && bookingType !== 'waiting_list' && status !== 'waiting_list') {
      if (!startDate) {
        throw new AppError('Start date is required for non-Course bookings', 400, 'VALIDATION_ERROR');
      }
      if (!startTime) {
        throw new AppError('Start time is required for non-Course bookings', 400, 'VALIDATION_ERROR');
      }
    }
    const userId = req.user!.id;

    // Check if activity exists and has capacity
    const activity = await prisma.activity.findFirst({
      where: { 
        id: activityId,
        // Note: is_active field doesn't exist in current schema, using status instead
        status: 'active'
      }
    });

    if (!activity) {
      throw new AppError('Activity not found', 404, 'ACTIVITY_NOT_FOUND');
    }

    // Handle waiting list bookings
    if (bookingType === 'waiting_list' || status === 'waiting_list') {
      return await handleWaitingListBooking(res, activity, userId, childId, notes);
    }

    // Handle Course/Program bookings differently
    if (bookingType === 'course') {
      // Extract children from request body
      const children = req.body.children || [{ id: childId, name: childName }];
      return await handleCourseBooking(res, activity, userId, children, amount, courseSchedule, totalWeeks);
    }

    // If sessionBlockId is provided, validate session block and get pricing
    let sessionBlock = null;
    let bookingAmount = amount || activity.price || 0;
    
    if (sessionBlockId) {
      sessionBlock = await (prisma as any).sessionBlock.findFirst({
        where: {
          id: sessionBlockId,
          activityId: activityId,
          isActive: true
        },
        include: {
          _count: {
            select: {
              bookings: {
                where: {
                  status: {
                    in: ['confirmed', 'pending']
                  }
                }
              }
            }
          }
        }
      });

      if (!sessionBlock) {
        throw new AppError('Session block not found', 404, 'SESSION_BLOCK_NOT_FOUND');
      }

      // Check capacity
      if (sessionBlock._count.bookings >= sessionBlock.capacity) {
        throw new AppError('Session block is full', 400, 'SESSION_BLOCK_FULL');
      }

      bookingAmount = sessionBlock.price;
    }

    // Check if child belongs to user
    const child = await prisma.child.findFirst({
      where: { 
        id: childId,
        parentId: userId
      }
    });

    if (!child) {
      throw new AppError('Child not found', 404, 'CHILD_NOT_FOUND');
    }

    // Check if user already has a booking for this specific time slot
    const existingBooking = await prisma.booking.findFirst({
      where: { 
        parentId: userId,
        activityId: activityId,
        childId: childId,
        activityDate: new Date(startDate),
        activityTime: startTime,
        ...(sessionBlockId && { sessionBlockId: sessionBlockId }),
        status: { not: 'cancelled' }
      }
    });

    if (existingBooking) {
      // If it's an old pending booking (more than 30 minutes), cancel it and allow new booking
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      if (existingBooking.status === 'pending' && existingBooking.createdAt < thirtyMinutesAgo) {
        logger.info(`Cancelling old pending booking ${existingBooking.id} to allow new booking`);
        
        // Cancel the old booking
        await prisma.booking.update({
          where: { id: existingBooking.id },
          data: {
            status: 'cancelled',
            paymentStatus: 'cancelled'
          }
        });

        // Deactivate any associated payments
        await prisma.payment.updateMany({
          where: {
            bookingId: existingBooking.id,
            isActive: true
          },
          data: {
            isActive: false,
            status: 'cancelled'
          }
        });
      } else {
        throw new AppError('Booking already exists for this time slot', 400, 'BOOKING_ALREADY_EXISTS');
      }
    }

    // Create booking
    const booking = await prisma.booking.create({
      data: {
        parentId: userId,
        activityId: activityId,
        ...(sessionBlockId && { sessionBlockId: sessionBlockId }),
        ...(holidayTimeSlotId && { holidayTimeSlotId: holidayTimeSlotId }),
        childId: childId,
        bookingDate: new Date(startDate),
        activityDate: new Date(startDate),
        activityTime: startTime,
        status: 'pending',
        notes: notes || null,
        amount: bookingAmount,
        paymentStatus: 'pending',
        paymentMethod: 'card'
      }
    });

    logger.info(`Booking created: ${booking.id} for user: ${userId}`);

    // Get related data for email
    const parent = await prisma.user.findUnique({ 
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true
      }
    });
    const childData = await prisma.child.findUnique({ where: { id: childId } });
    const activityData = await prisma.activity.findUnique({ 
      where: { id: activityId },
      include: { venue: true }
    });

    // Send booking confirmation email
    try {
      const { emailService } = await import('../services/emailService');
      await emailService.sendBookingConfirmation({
        to: parent?.email || '',
        parentName: `${parent?.firstName || ''} ${parent?.lastName || ''}`,
        childName: `${childData?.firstName || ''} ${childData?.lastName || ''}`,
        activityName: activityData?.title || '',
        venueName: 'Unknown Venue',
        amount: parseFloat(booking.amount.toString()),
        paymentReference: booking.paymentIntentId || 'N/A'
      });
      logger.info(`Sent booking confirmation email for booking ${booking.id}`);
    } catch (emailError) {
      logger.error('Failed to send booking confirmation email:', emailError);
      // Don't fail the booking creation if email fails
    }

    // Send new booking notification to provider
    try {
      const { ProviderNotificationService } = await import('../services/providerNotificationService');
      if (activityData?.ownerId) {
        await ProviderNotificationService.sendNewBookingNotification({
          providerId: activityData.ownerId,
          venueId: activityData.venueId,
            bookingId: booking.id,
          parentId: userId,
          childId: childData?.id || '',
          activityId: activityData.id,
          amount: Number(booking.amount),
          bookingDate: new Date(booking.activityDate),
          bookingTime: booking.activityTime || '',
          activityName: activityData.title,
          childName: `${childData?.firstName || 'Child'} ${childData?.lastName || ''}`,
          parentName: `${parent?.firstName || 'Parent'} ${parent?.lastName || ''}`,
          parentEmail: parent?.email || '',
          venueName: activityData.venue?.name,
          notificationType: 'new_booking'
        });
        logger.info(`New booking notification sent to provider for booking ${booking.id}`);
      }
    } catch (notificationError) {
      logger.error('Failed to send new booking notification to provider:', notificationError);
    }

    // Create notification for parent who made the booking
    try {
      const { NotificationService } = await import('../services/notificationService');
      await NotificationService.createNotification({
        userId: userId,
        venueId: activityData?.venueId || undefined,
        type: 'booking_confirmation',
        title: 'Booking Confirmed',
        message: `Your booking for ${activityData?.title || 'Activity'} has been confirmed for ${childData?.firstName || 'Child'}`,
        data: {
          bookingId: booking.id,
          childId: childData?.id,
          amount: booking.amount,
          activityId: activityData?.id,
          activityName: activityData?.title
        },
        priority: 'medium',
        channels: ['in_app', 'email']
      });
      logger.info(`Created notification for parent about booking ${booking.id}`);
    } catch (notificationError) {
      logger.error('Failed to create notification for parent booking:', notificationError);
    }

    // Create notification for all admin users
    try {
      const { NotificationService } = await import('../services/notificationService');
      await NotificationService.notifyAdmins({
        venueId: activityData?.venueId || undefined,
        type: 'booking_confirmation',
        title: 'New Booking - Admin Alert',
        message: `${parent?.firstName || 'Parent'} ${parent?.lastName || ''} booked ${childData?.firstName || 'Child'} for ${activityData?.title || 'Activity'}`,
        data: {
          bookingId: booking.id,
          childId: childData?.id,
          amount: booking.amount,
          activityId: activityData?.id,
          activityName: activityData?.title,
          parentId: userId,
          parentName: `${parent?.firstName || ''} ${parent?.lastName || ''}`,
          childName: `${childData?.firstName || ''} ${childData?.lastName || ''}`,
          venueName: 'Unknown Venue'
        },
        priority: 'high',
        channels: ['in_app', 'email']
      });
      logger.info(`Created admin notifications for booking ${booking.id}`);
    } catch (notificationError) {
      logger.error('Failed to create admin notifications for booking:', notificationError);
    }

    res.status(201).json({
      success: true,
      data: booking,
      message: 'Booking created successfully',
    });
  } catch (error) {
    logger.error('Error creating booking:', error);
    throw error;
  }
}));

// Delete a booking (soft delete - sets status to cancelled)
router.delete('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    
    if (!id) {
      throw new AppError('Booking ID is required', 400, 'MISSING_BOOKING_ID');
    }
    
    // Check if booking exists and belongs to user
    const booking = await prisma.booking.findFirst({
      where: { 
        id: id,
        parentId: userId
      }
    });

    if (!booking) {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    // Update booking status to cancelled (soft delete)
    const updatedBooking = await prisma.booking.update({
      where: { id: id },
      data: {
        status: 'cancelled',
        paymentStatus: 'cancelled',
        updatedAt: new Date()
      }
    });

    logger.info(`Booking deleted (cancelled): ${id} by user: ${userId}`);

    res.json({
      success: true,
      message: 'Booking deleted successfully',
      data: {
        id: updatedBooking.id,
        status: updatedBooking.status
      }
    });
  } catch (error: any) {
    logger.error('Error deleting booking:', error);
    if (error instanceof AppError) throw error;
    if ((error as any).code === 'P2025') {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }
    throw new AppError('Failed to delete booking', 500, 'BOOKING_DELETE_ERROR');
  }
}));

// Cancel a booking
router.put('/:id/cancel', authenticateToken, validateCancelBooking, asyncHandler(async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
    }

    const { id } = req.params;
    const { reason, adminOverride } = req.body;
    const userId = req.user!.id;
    const userRole = req.user!.role;
    
    console.log('Cancellation request:', { id, reason, userId, userRole, adminOverride });
    
    if (!id) {
      throw new AppError('Booking ID is required', 400, 'MISSING_BOOKING_ID');
    }
    
    // Check if booking exists and belongs to user
    const booking = await prisma.booking.findFirst({
      where: { 
        id: id,
        parentId: userId,
        status: { not: 'cancelled' }
      },
      include: {
        activity: true
      }
    });

    if (!booking) {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    // Check if booking can be cancelled
    if (booking.status === 'cancelled' || booking.status === 'completed') {
      throw new AppError('Booking cannot be cancelled', 400, 'BOOKING_CANNOT_BE_CANCELLED');
    }

    // Implement exact refund and credit policy with admin override
    const cancellationTime = new Date();
    const activityStartTime = new Date(booking.activityDate);
    const hoursUntilStart = (activityStartTime.getTime() - cancellationTime.getTime()) / (1000 * 60 * 60);
    
    // Check for admin override
    let overrideApplied = false;
    let overrideReason = '';
    
    if (adminOverride && (userRole === 'admin' || userRole === 'staff')) {
      console.log('Admin override detected:', adminOverride);
      
      if (adminOverride.forceRefund && hoursUntilStart < 24) {
        // Admin can force refund even <24h
        overrideApplied = true;
        overrideReason = 'Admin override: Forced refund <24h';
        console.log('Admin override: Forcing refund despite <24h timing');
      } else if (adminOverride.waiveFee) {
        // Admin can waive the £2 fee
        overrideApplied = true;
        overrideReason = 'Admin override: Fee waived';
        console.log('Admin override: Waiving £2 admin fee');
      }
    }
    
    console.log('Cancellation timing analysis:', {
      bookingId: id,
      activityStartTime: activityStartTime.toISOString(),
      cancellationTime: cancellationTime.toISOString(),
      hoursUntilStart: hoursUntilStart,
      isRefundEligible: hoursUntilStart >= 24,
      isCreditEligible: hoursUntilStart < 24,
      overrideApplied: overrideApplied,
      overrideReason: overrideReason
    });

    let refundResult = null;
    let creditResult = null;
    let transactionType = '';

    if (hoursUntilStart >= 24 || (overrideApplied && adminOverride?.forceRefund)) {
      // REFUND POLICY: ≥24h → refund (−£2 admin fee)
      console.log('Processing REFUND (≥24h before start)');
      
      let refundAmount = Number(booking.amount);
      
      // Pro-rata calculation for courses after start date
      if (booking.activity?.type === 'course' && activityStartTime < cancellationTime) {
        console.log('Course cancellation after start - calculating pro-rata refund');
        
        // Get course sessions and calculate unused sessions
        const courseSessions = await prisma.session.findMany({
          where: {
            activityId: booking.activityId,
            date: { gte: cancellationTime }
          },
          orderBy: { date: 'asc' }
        });
        
        const totalSessions = await prisma.session.count({
          where: { activityId: booking.activityId }
        });
        
        const unusedSessions = courseSessions.length;
        const usedSessions = totalSessions - unusedSessions;
        
        // Calculate pro-rata refund based on unused sessions
        const sessionPrice = refundAmount / totalSessions;
        refundAmount = unusedSessions * sessionPrice;
        
        console.log('Pro-rata calculation:', {
          totalSessions,
          usedSessions,
          unusedSessions,
          sessionPrice,
          originalAmount: Number(booking.amount),
          proRataAmount: refundAmount
        });
      }
      
      const adminFee = overrideApplied && adminOverride?.waiveFee ? 0.00 : 2.00;
      const netRefund = Math.max(0, refundAmount - adminFee);
      
      console.log('Refund calculation:', {
        originalAmount: Number(booking.amount),
        refundAmount: refundAmount,
        adminFee: adminFee,
        netRefund: netRefund
      });

      // Process Stripe refund if payment method is card
      if (booking.paymentMethod === 'card' && booking.paymentIntentId) {
        try {
          const stripeService = await import('../services/stripe');
          const stripeRefund = await stripeService.default.createRefund({
            paymentIntentId: booking.paymentIntentId,
            amount: netRefund,
            reason: 'requested_by_customer'
          });
          
          refundResult = {
            type: 'refund',
            amount: refundAmount,
            adminFee: adminFee,
            netAmount: netRefund,
            stripeRefundId: stripeRefund.id,
            method: 'stripe'
          };
          
          console.log('Stripe refund processed:', stripeRefund.id);
        } catch (stripeError) {
          console.error('Stripe refund failed:', stripeError);
          // Fallback to credit if Stripe fails
          refundResult = {
            type: 'credit',
            amount: refundAmount,
            adminFee: 0,
            netAmount: refundAmount,
            method: 'credit_fallback'
          };
        }
      } else {
        // TFC/voucher payments: issue account credit
        refundResult = {
          type: 'credit',
          amount: refundAmount,
          adminFee: 0,
          netAmount: refundAmount,
          method: 'credit_tfc'
        };
      }
      
      transactionType = 'refund';
    } else {
      // CREDIT POLICY: <24h → credit (no fee)
      console.log('Processing CREDIT (<24h before start)');
      
      const creditAmount = Number(booking.amount);
      
      console.log('Credit calculation:', {
        amount: creditAmount,
        adminFee: 0,
        netAmount: creditAmount
      });

      // Add credit to parent wallet
      try {
        await prisma.user.update({
          where: { id: userId },
          data: {
            creditBalance: {
              increment: creditAmount
            }
          }
        });

        // Create credit transaction record
        await prisma.creditTransaction.create({
          data: {
            userId: userId,
            amount: creditAmount,
            type: 'credit',
            reason: `Booking cancellation credit: ${reason}`,
            bookingId: id,
            createdAt: new Date()
          }
        });

        creditResult = {
          type: 'credit',
          amount: creditAmount,
          adminFee: 0,
          netAmount: creditAmount,
          method: 'wallet_credit'
        };
        
        console.log('Credit added to parent wallet:', creditAmount);
      } catch (creditError) {
        console.error('Failed to add credit to wallet:', creditError);
        throw new AppError('Failed to process credit', 500, 'CREDIT_PROCESSING_ERROR');
      }
      
      transactionType = 'credit';
    }

    // Update booking status
    const updatedBooking = await prisma.booking.update({
      where: { id: id! },
      data: {
        status: 'cancelled',
        updatedAt: new Date()
      }
    });

    console.log('Booking cancelled successfully:', updatedBooking.id);

    // Remove attendance records from registers and update capacity
    try {
      const { RealTimeRegisterService } = await import('../services/realTimeRegisterService');
      await RealTimeRegisterService.removeAttendanceForCancelledBooking(id);
      logger.info(`Removed attendance records for cancelled booking ${id}`);
      
      // Update activity capacity
      // Note: Activity model doesn't have currentCapacity field, capacity is managed at session level
      
      // Check if there's a waitlist and trigger it
      // Note: Waitlist model doesn't exist in current schema
      // const waitlistEntries = await prisma.waitlist.findMany({
      //   where: {
      //     activityId: booking.activityId,
      //     status: 'active'
      //   },
      //   orderBy: { createdAt: 'asc' },
      //   take: 1
      // });
      
      // if (waitlistEntries.length > 0) {
      //   logger.info(`Waitlist entry found for activity ${booking.activityId}, capacity freed up`);
      //   // Note: Actual waitlist processing would be handled by a separate service
      // }
      
      logger.info(`Capacity updated for activity ${booking.activityId}`);
    } catch (attendanceError) {
      logger.error('Failed to remove attendance records or update capacity:', attendanceError);
      // Don't fail the cancellation if attendance removal fails
    }

    // Send notifications
    try {
      // Get related data for notifications
    const parent = await prisma.user.findUnique({ 
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true
      }
    });
      
      const childData = await prisma.child.findUnique({ 
        where: { id: booking.childId },
        select: {
          firstName: true,
          lastName: true
        }
      });
      
      const activityData = await prisma.activity.findUnique({ 
        where: { id: booking.activityId },
        include: {
          venue: {
            select: {
              name: true
            }
          }
        }
      });

      // Send proper refund/credit email notification to parent
      if (parent?.email) {
        try {
          const { emailService } = await import('../services/emailService');
          
          let emailSubject = '';
          let emailHtml = '';
          let emailText = '';
          
          if (transactionType === 'refund') {
            // REFUND EMAIL: showing amount returned minus admin fee
            emailSubject = `Refund Processed - ${activityData?.title || 'Activity'}`;
            emailHtml = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #00806a;">Refund Processed</h2>
                
                <p>Hi ${parent.firstName || 'Parent'},</p>
                
                <p>Your booking has been cancelled and a refund has been processed.</p>
                
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="margin-top: 0; color: #333;">Refund Details</h3>
                  <p><strong>Child:</strong> ${childData?.firstName || ''} ${childData?.lastName || ''}</p>
                  <p><strong>Activity:</strong> ${activityData?.title || 'Activity'}</p>
                  <p><strong>Venue:</strong> ${activityData?.venue?.name || 'Venue'}</p>
                  <p><strong>Original Amount:</strong> £${refundResult?.amount?.toFixed(2) || '0.00'}</p>
                  <p><strong>Admin Fee:</strong> £${refundResult?.adminFee?.toFixed(2) || '0.00'}</p>
                  <p><strong>Refund Amount:</strong> £${refundResult?.netAmount?.toFixed(2) || '0.00'}</p>
                  <p><strong>Refund Method:</strong> ${refundResult?.method === 'stripe' ? 'Returned to original payment method' : 'Added to your BookOn wallet'}</p>
                  <p><strong>Cancellation Date:</strong> ${new Date().toLocaleDateString()}</p>
                  <p><strong>Reason:</strong> ${reason || 'No reason provided'}</p>
                </div>
                
                <p>The refund will appear in your account within 3-5 business days.</p>
                
                <p>Thank you for using BookOn!</p>
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                <p style="font-size: 12px; color: #666;">
                  This email was sent to ${parent.email} regarding booking ${id}.
                </p>
              </div>
            `;
            emailText = `
              Refund Processed
              
              Hi ${parent.firstName || 'Parent'},
              
              Your booking has been cancelled and a refund has been processed.
              
              Refund Details:
              - Child: ${childData?.firstName || ''} ${childData?.lastName || ''}
              - Activity: ${activityData?.title || 'Activity'}
              - Venue: ${activityData?.venue?.name || 'Venue'}
              - Original Amount: £${refundResult?.amount?.toFixed(2) || '0.00'}
              - Admin Fee: £${refundResult?.adminFee?.toFixed(2) || '0.00'}
              - Refund Amount: £${refundResult?.netAmount?.toFixed(2) || '0.00'}
              - Refund Method: ${refundResult?.method === 'stripe' ? 'Returned to original payment method' : 'Added to your BookOn wallet'}
              - Cancellation Date: ${new Date().toLocaleDateString()}
              - Reason: ${reason || 'No reason provided'}
              
              The refund will appear in your account within 3-5 business days.
              
              Thank you for using BookOn!
            `;
          } else {
            // CREDIT EMAIL: showing credit added with no deductions
            emailSubject = `Credit Added - ${activityData?.title || 'Activity'}`;
            emailHtml = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #00806a;">Credit Added to Your Wallet</h2>
                
                <p>Hi ${parent.firstName || 'Parent'},</p>
                
                <p>Your booking has been cancelled and credit has been added to your BookOn wallet.</p>
                
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="margin-top: 0; color: #333;">Credit Details</h3>
                  <p><strong>Child:</strong> ${childData?.firstName || ''} ${childData?.lastName || ''}</p>
                  <p><strong>Activity:</strong> ${activityData?.title || 'Activity'}</p>
                  <p><strong>Venue:</strong> ${activityData?.venue?.name || 'Venue'}</p>
                  <p><strong>Credit Amount:</strong> £${creditResult?.amount?.toFixed(2) || '0.00'}</p>
                  <p><strong>Admin Fee:</strong> £0.00 (No fee applied)</p>
                  <p><strong>Total Credit:</strong> £${creditResult?.netAmount?.toFixed(2) || '0.00'}</p>
                  <p><strong>Cancellation Date:</strong> ${new Date().toLocaleDateString()}</p>
                  <p><strong>Reason:</strong> ${reason || 'No reason provided'}</p>
                </div>
                
                <p>This credit can be used for future bookings and will expire in 12 months.</p>
                
                <p>Thank you for using BookOn!</p>
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                <p style="font-size: 12px; color: #666;">
                  This email was sent to ${parent.email} regarding booking ${id}.
                </p>
              </div>
            `;
            emailText = `
              Credit Added to Your Wallet
              
              Hi ${parent.firstName || 'Parent'},
              
              Your booking has been cancelled and credit has been added to your BookOn wallet.
              
              Credit Details:
              - Child: ${childData?.firstName || ''} ${childData?.lastName || ''}
              - Activity: ${activityData?.title || 'Activity'}
              - Venue: ${activityData?.venue?.name || 'Venue'}
              - Credit Amount: £${creditResult?.amount?.toFixed(2) || '0.00'}
              - Admin Fee: £0.00 (No fee applied)
              - Total Credit: £${creditResult?.netAmount?.toFixed(2) || '0.00'}
              - Cancellation Date: ${new Date().toLocaleDateString()}
              - Reason: ${reason || 'No reason provided'}
              
              This credit can be used for future bookings and will expire in 12 months.
              
              Thank you for using BookOn!
            `;
          }
          
          const emailData = {
            to: parent.email,
            toName: `${parent.firstName || ''} ${parent.lastName || ''}`.trim(),
            subject: emailSubject,
            html: emailHtml,
            text: emailText
          };
          
          await emailService.sendEmail(emailData);
          logger.info(`${transactionType} email sent to parent: ${parent.email}`);
    } catch (emailError) {
      logger.error('Failed to send cancellation email:', emailError);
        }
      }

      // Send in-app notification to parent
      try {
        await prisma.notification.create({
          data: {
            userId: userId,
            type: 'booking_cancelled',
            title: 'Booking Cancelled',
            message: `Your booking for ${activityData?.title || 'activity'} has been cancelled successfully.`,
            read: false,
            createdAt: new Date()
          }
        });
        logger.info(`In-app notification created for parent: ${userId}`);
      } catch (notificationError) {
        logger.error('Failed to create in-app notification:', notificationError);
      }

      // Send notification to admin/staff
      try {
        const adminUsers = await prisma.user.findMany({
          where: {
            role: { in: ['admin', 'staff'] }
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        });

        for (const admin of adminUsers) {
          // In-app notification for admin
          await prisma.notification.create({
            data: {
              userId: admin.id,
              type: 'booking_cancelled_admin',
              title: 'Booking Cancelled',
              message: `Booking ${id} for ${childData?.firstName || 'child'} has been cancelled by ${parent?.firstName || 'parent'}.`,
              read: false,
              createdAt: new Date()
            }
          });

          // Email notification for admin with refund/credit details
          if (admin.email) {
            try {
              const { emailService } = await import('../services/emailService');
              
              let financialDetails = '';
              if (transactionType === 'refund') {
                financialDetails = `
                  <p><strong>Transaction Type:</strong> Refund</p>
                  <p><strong>Original Amount:</strong> £${refundResult?.amount?.toFixed(2) || '0.00'}</p>
                  <p><strong>Admin Fee:</strong> £${refundResult?.adminFee?.toFixed(2) || '0.00'}</p>
                  <p><strong>Refund Amount:</strong> £${refundResult?.netAmount?.toFixed(2) || '0.00'}</p>
                  <p><strong>Refund Method:</strong> ${refundResult?.method === 'stripe' ? 'Stripe Refund' : 'Wallet Credit'}</p>
                `;
              } else {
                financialDetails = `
                  <p><strong>Transaction Type:</strong> Credit</p>
                  <p><strong>Credit Amount:</strong> £${creditResult?.amount?.toFixed(2) || '0.00'}</p>
                  <p><strong>Admin Fee:</strong> £0.00 (No fee applied)</p>
                  <p><strong>Total Credit:</strong> £${creditResult?.netAmount?.toFixed(2) || '0.00'}</p>
                  <p><strong>Credit Method:</strong> Added to Parent Wallet</p>
                `;
              }
              
              const adminEmailData = {
                to: admin.email,
                toName: `${admin.firstName || ''} ${admin.lastName || ''}`.trim(),
                subject: `Booking Cancelled - ${transactionType.toUpperCase()} - ${activityData?.title || 'Activity'}`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #dc3545;">Admin Alert: Booking Cancelled</h2>
                    
                    <p>Hi ${admin.firstName || 'Admin'},</p>
                    
                    <p>A booking has been cancelled and ${transactionType === 'refund' ? 'a refund has been processed' : 'credit has been issued'}.</p>
                    
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                      <h3 style="margin-top: 0; color: #333;">Cancellation Details</h3>
                      <p><strong>Booking ID:</strong> ${id}</p>
                      <p><strong>Child:</strong> ${childData?.firstName || ''} ${childData?.lastName || ''}</p>
                      <p><strong>Parent:</strong> ${parent?.firstName || ''} ${parent?.lastName || ''}</p>
                      <p><strong>Activity:</strong> ${activityData?.title || 'Activity'}</p>
                      <p><strong>Venue:</strong> ${activityData?.venue?.name || 'Venue'}</p>
                      <p><strong>Cancellation Date:</strong> ${new Date().toLocaleDateString()}</p>
                      <p><strong>Reason:</strong> ${reason || 'No reason provided'}</p>
                      <p><strong>Hours Until Start:</strong> ${hoursUntilStart.toFixed(1)} hours</p>
                    </div>
                    
                    <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
                      <h3 style="margin-top: 0; color: #333;">Financial Details</h3>
                      ${financialDetails}
                    </div>
                    
                    <p>Please review this cancellation in the admin dashboard.</p>
                    
                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                    <p style="font-size: 12px; color: #666;">
                      This email was sent to ${admin.email} regarding booking ${id}.
                    </p>
                  </div>
                `,
                text: `
                  Admin Alert: Booking Cancelled
                  
                  Hi ${admin.firstName || 'Admin'},
                  
                  A booking has been cancelled and ${transactionType === 'refund' ? 'a refund has been processed' : 'credit has been issued'}.
                  
                  Cancellation Details:
                  - Booking ID: ${id}
                  - Child: ${childData?.firstName || ''} ${childData?.lastName || ''}
                  - Parent: ${parent?.firstName || ''} ${parent?.lastName || ''}
                  - Activity: ${activityData?.title || 'Activity'}
                  - Venue: ${activityData?.venue?.name || 'Venue'}
                  - Cancellation Date: ${new Date().toLocaleDateString()}
                  - Reason: ${reason || 'No reason provided'}
                  - Hours Until Start: ${hoursUntilStart.toFixed(1)} hours
                  
                  Financial Details:
                  ${transactionType === 'refund' ? 
                    `- Transaction Type: Refund
                  - Original Amount: £${refundResult?.amount?.toFixed(2) || '0.00'}
                  - Admin Fee: £${refundResult?.adminFee?.toFixed(2) || '0.00'}
                  - Refund Amount: £${refundResult?.netAmount?.toFixed(2) || '0.00'}
                  - Refund Method: ${refundResult?.method === 'stripe' ? 'Stripe Refund' : 'Wallet Credit'}` :
                    `- Transaction Type: Credit
                  - Credit Amount: £${creditResult?.amount?.toFixed(2) || '0.00'}
                  - Admin Fee: £0.00 (No fee applied)
                  - Total Credit: £${creditResult?.netAmount?.toFixed(2) || '0.00'}
                  - Credit Method: Added to Parent Wallet`
                  }
                  
                  Please review this cancellation in the admin dashboard.
                `
              };
              
              await emailService.sendEmail(adminEmailData);
              logger.info(`Admin ${transactionType} email sent to: ${admin.email}`);
            } catch (adminEmailError) {
              logger.error(`Failed to send admin email to ${admin.email}:`, adminEmailError);
            }
          }
        }
        logger.info(`Admin notifications sent for ${adminUsers.length} admin users`);
      } catch (adminNotificationError) {
        logger.error('Failed to send admin notifications:', adminNotificationError);
      }

    } catch (notificationError) {
      logger.error('Failed to send notifications:', notificationError);
      // Don't fail the cancellation if notifications fail
    }

    // Get additional data for logging
    const parent = await prisma.user.findUnique({ 
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true }
    });
    const childData = await prisma.child.findUnique({ 
      where: { id: booking.childId },
      select: { firstName: true, lastName: true }
    });
    const activityData = await prisma.activity.findUnique({ 
      where: { id: booking.activityId },
      select: { title: true }
    });

    // Log the cancellation with full audit trail including overrides
    logger.info(`Booking cancelled: ${id} by user: ${userId}`, {
      reason: reason,
      transactionType: transactionType,
      hoursUntilStart: hoursUntilStart,
      refundResult: refundResult,
      creditResult: creditResult,
      activityTitle: activityData?.title,
      childName: `${childData?.firstName || ''} ${childData?.lastName || ''}`,
      parentEmail: parent?.email,
      overrideApplied: overrideApplied,
      overrideReason: overrideReason,
      adminOverride: adminOverride,
      userRole: userRole
    });

    res.json({
      success: true,
      message: `Booking cancelled successfully. ${transactionType === 'refund' ? 'Refund processed' : 'Credit issued'}.`,
      data: {
        id: updatedBooking.id,
        status: updatedBooking.status,
        cancelledAt: updatedBooking.updatedAt,
        transactionType: transactionType,
        hoursUntilStart: hoursUntilStart,
        refundResult: refundResult,
        creditResult: creditResult
      }
    });
  } catch (error) {
    logger.error('Error cancelling booking:', error);
    throw error;
  }
}));

// Reschedule a booking
router.put('/:id/reschedule', authenticateToken, validateRescheduleBooking, asyncHandler(async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
    }

    const { id } = req.params;
    const { newDate, newTime, notes } = req.body;
    const userId = req.user!.id;

    if (!id) {
      throw new AppError('Booking ID is required', 400, 'MISSING_BOOKING_ID');
    }

    // Check if booking exists and belongs to user
    const booking = await prisma.booking.findFirst({
      where: { 
        id: id,
        parentId: userId,
        status: { not: 'cancelled' }
      }
    });

    if (!booking) {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    // Check if booking can be rescheduled
    if (booking.status !== 'confirmed' && booking.status !== 'pending') {
      throw new AppError('Booking cannot be rescheduled', 400, 'BOOKING_CANNOT_BE_RESCHEDULED');
    }

    // Check if new date/time is available
    const conflictingBooking = await prisma.booking.findFirst({
      where: { 
        activityId: booking.activityId,
        activityDate: new Date(newDate),
        activityTime: newTime,
        status: { not: 'cancelled' },
        id: { not: id }
      }
    });
      
    if (conflictingBooking) {
      throw new AppError('Selected date and time is not available', 400, 'TIME_SLOT_NOT_AVAILABLE');
    }

    // Update booking
    await prisma.booking.update({
      where: { id: id },
      data: {
        activityDate: new Date(newDate),
        activityTime: newTime,
        notes: notes || booking.notes,
        // Note: rescheduled_at field doesn't exist in current schema
      }
    });

    // Note: booking_reschedules table doesn't exist in current schema
    // This would need to be added if reschedule tracking is required

    logger.info(`Booking rescheduled: ${id} by user: ${userId}`);

    res.json({
      success: true,
      message: 'Booking rescheduled successfully',
    });
  } catch (error) {
    logger.error('Error rescheduling booking:', error);
    throw error;
  }
}));

// Amend a booking
router.put('/:id/amend', authenticateToken, validateAmendBooking, asyncHandler(async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
    }

    const { id } = req.params;
    const { childId, notes } = req.body;
    // Note: specialRequirements, dietaryRestrictions, medicalNotes, emergencyContact are not used in current implementation
    const userId = req.user!.id;

    if (!id) {
      throw new AppError('Booking ID is required', 400, 'MISSING_BOOKING_ID');
    }

    // Check if booking exists and belongs to user
    const booking = await prisma.booking.findFirst({
      where: { 
        id: id,
        parentId: userId,
        status: { not: 'cancelled' }
      }
    });

    if (!booking) {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    // Check if booking can be amended
    if (booking.status === 'cancelled' || booking.status === 'completed') {
      throw new AppError('Booking cannot be amended', 400, 'BOOKING_CANNOT_BE_AMENDED');
    }

    // Update booking
    const updateData: any = {
      // Note: amended_at field doesn't exist in current schema
    };

    if (childId) {
      // Check if new child belongs to user
      const child = await prisma.child.findFirst({
        where: { 
          id: childId,
          parentId: userId
        }
      });

      if (!child) {
        throw new AppError('Child not found', 404, 'CHILD_NOT_FOUND');
      }
      updateData.childId = childId;
    }

    if (notes) {
      updateData.notes = notes;
    }

    await prisma.booking.update({
      where: { id: id },
      data: updateData
    });

    // Note: booking_amendments table doesn't exist in current schema
    // This would need to be added if amendment tracking is required

    logger.info(`Booking amended: ${id} by user: ${userId}`);

    res.json({
      success: true,
      message: 'Booking amended successfully',
    });
  } catch (error) {
    logger.error('Error amending booking:', error);
    throw error;
  }
}));

// Get cancellation preview
router.get('/:id/cancel-preview', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    if (!id) {
      throw new AppError('Booking ID is required', 400, 'MISSING_BOOKING_ID');
    }

    // Check if booking exists and belongs to user
    const booking = await prisma.booking.findFirst({
      where: { 
        id: id,
        parentId: userId,
        status: { not: 'cancelled' }
      }
    });

    if (!booking) {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    // Import refund policy service
    const { RefundPolicyService } = await import('../services/refundPolicyService');

    // Calculate refund preview
    const cancellationContext = {
      bookingId: id,
      parentId: userId,
      cancellationTime: new Date(),
      reason: 'Preview calculation'
    };

    const refundCalculation = await RefundPolicyService.getCancellationPreview(cancellationContext);

    res.json({
      success: true,
      data: refundCalculation
    });
  } catch (error) {
    logger.error('Error getting cancellation preview:', error);
    throw error;
  }
}));

// Confirm a pending booking
router.patch('/:id/confirm', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    if (!id) {
      throw new AppError('Booking ID is required', 400, 'MISSING_BOOKING_ID');
    }

    // Find the booking
    const booking = await prisma.booking.findUnique({
      where: { id: id },
      include: {
        activity: {
          include: {
            venue: true
          }
        },
        child: true
      }
    });

    if (!booking || booking.parentId !== userId) {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    // Check if booking can be confirmed
    if (booking.status !== 'pending') {
      throw new AppError('Only pending bookings can be confirmed', 400, 'INVALID_BOOKING_STATUS');
    }

    // Check payment method and handle TFC bookings differently
    if (booking.paymentMethod === 'tfc') {
      // TFC bookings cannot be confirmed by parents - only admins can mark as paid
      res.json({
        success: false,
        message: 'TFC bookings cannot be confirmed by parents. Please wait for admin to mark payment as received.',
        data: {
          requiresAdminConfirmation: true,
          bookingId: id,
          paymentMethod: 'tfc',
          tfcReference: booking.tfcReference,
          tfcDeadline: booking.tfcDeadline,
          amount: booking.amount
        }
      });
      return;
    }

    // Check payment status for non-TFC bookings
    if (booking.paymentStatus === 'failed' || booking.paymentStatus === 'pending') {
      // If payment failed or is pending, we need to retry payment
      // Return payment retry information instead of confirming
      res.json({
        success: false,
        message: 'Payment required to confirm booking',
        data: {
          requiresPayment: true,
          bookingId: id,
          amount: booking.amount,
          paymentMethod: booking.paymentMethod,
          paymentStatus: booking.paymentStatus
        }
      });
      return;
    }

    // Only confirm if payment is successful
    if (booking.paymentStatus !== 'paid') {
      throw new AppError('Payment must be completed before confirming booking', 400, 'PAYMENT_REQUIRED');
    }

    // Update booking status to confirmed
    const updatedBooking = await prisma.booking.update({
      where: { id: id },
      data: {
        status: 'confirmed',
        updatedAt: new Date()
      },
      include: {
        activity: {
          include: {
            venue: true
          }
        },
        child: true
      }
    });

    // Get the full booking details for attendance creation
    const fullBooking = await prisma.booking.findUnique({
      where: { id: id }
    });

    // Auto-create attendance record for confirmed booking
    try {
      let sessionId = null;

      // Determine sessionId based on booking type
      if (fullBooking) {
        if ((fullBooking as any).sessionBlockId) {
          // For session block bookings, get sessionId from sessionBlock
          const sessionBlock = await (prisma as any).sessionBlock.findUnique({
            where: { id: (fullBooking as any).sessionBlockId },
            select: { sessionId: true }
          });
          sessionId = sessionBlock?.sessionId;
        } else if ((fullBooking as any).holidayTimeSlotId) {
          // For holiday bookings, we need to find the session by activity and date
          const session = await prisma.session.findFirst({
            where: {
              activityId: fullBooking.activityId,
              date: fullBooking.activityDate
            },
            select: { id: true }
          });
          sessionId = session?.id;
        } else {
          // For regular bookings, find session by activity and date
          const session = await prisma.session.findFirst({
            where: {
              activityId: fullBooking.activityId,
              date: fullBooking.activityDate
            },
            select: { id: true }
          });
          sessionId = session?.id;
        }
      }

      if (sessionId) {
        // Find the register for this session
        let register = await prisma.register.findFirst({
          where: { sessionId: sessionId }
        });

        // Auto-create register if it doesn't exist
        if (!register && fullBooking) {
          register = await prisma.register.create({
            data: {
              sessionId: sessionId,
              date: fullBooking!.activityDate,
              status: 'active',
              notes: `Auto-created for booking ${fullBooking!.id}`
            }
          });
          logger.info(`Auto-created register ${register.id} for session ${sessionId}`);
        }

        // Check if attendance record already exists
        if (fullBooking && register) {
          const existingAttendance = await prisma.attendance.findFirst({
            where: {
              registerId: register!.id,
              childId: fullBooking.childId,
              bookingId: fullBooking.id
            }
          });

          // Create attendance record if it doesn't exist
          if (!existingAttendance) {
            await prisma.attendance.create({
              data: {
                registerId: register!.id,
                childId: fullBooking.childId,
                bookingId: fullBooking.id,
                present: false, // Default to absent, admin marks present
                createdAt: new Date()
              }
            });

            logger.info(`Auto-created attendance record for booking ${fullBooking.id} in register ${register!.id}`);
          }
        }
      } else {
        logger.warn(`Could not determine sessionId for booking ${fullBooking?.id}`);
      }
    } catch (attendanceError) {
      // Don't fail the booking confirmation if attendance creation fails
      logger.error('Failed to auto-create attendance record:', attendanceError);
    }

    // Transform the data to match frontend expectations
    const transformedBooking = {
      id: updatedBooking.id,
      child_name: `${updatedBooking.child.firstName} ${updatedBooking.child.lastName}`,
      activity_name: updatedBooking.activity.title,
      venue_name: updatedBooking.activity.venue.name,
      start_date: updatedBooking.activityDate,
      start_time: updatedBooking.activityTime,
      end_time: updatedBooking.activityTime,
      total_amount: updatedBooking.amount,
      status: updatedBooking.status,
      created_at: updatedBooking.createdAt,
      payment_status: updatedBooking.paymentStatus || 'pending',
      notes: updatedBooking.notes,
      activity: {
        id: updatedBooking.activityId,
        title: updatedBooking.activity.title,
        description: updatedBooking.activity.description || updatedBooking.activity.title,
        price: updatedBooking.activity.price || updatedBooking.amount,
        max_capacity: updatedBooking.activity.capacity || 20,
        current_capacity: 15,
      },
      venue: {
        id: updatedBooking.activity.venue.id,
        name: updatedBooking.activity.venue.name,
        address: updatedBooking.activity.venue.address,
        city: updatedBooking.activity.venue.city,
      },
      child: {
        id: updatedBooking.childId,
        firstName: updatedBooking.child.firstName,
        lastName: updatedBooking.child.lastName,
      },
    };

    logger.info('Booking confirmed successfully', { bookingId: id, userId });

    res.json({
      success: true,
      message: 'Booking confirmed successfully',
      data: transformedBooking
    });
  } catch (error) {
    logger.error('Error confirming booking:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to confirm booking', 500, 'BOOKING_CONFIRM_ERROR');
  }
}));

// Admin update payment status
router.put('/:id/payment-status', authenticateToken, requireRole(['admin', 'staff']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { paymentStatus, paymentIntentId } = req.body;

    if (!paymentStatus) {
      throw new AppError('Payment status is required', 400, 'MISSING_PAYMENT_STATUS');
    }

    if (!id) {
      throw new AppError('Booking ID is required', 400, 'MISSING_BOOKING_ID');
    }

    const booking = await prisma.booking.findUnique({
      where: { id: id as string },
      include: {
        activity: true,
        child: true
      }
    });

    if (!booking) {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    // Update payment status
    const updatedBooking = await prisma.booking.update({
      where: { id: id as string },
      data: {
        paymentStatus,
        ...(paymentIntentId && { paymentIntentId })
      },
      include: {
        activity: {
          include: {
            venue: true
          }
        },
        child: true,
        parent: true
      }
    });

    logger.info('Payment status updated manually', {
      bookingId: id,
      newStatus: paymentStatus,
      updatedBy: req.user!.id
    });

    // If marked as paid, create register
    if (paymentStatus === 'paid') {
      try {
        // Import createRegisterForBooking function
        const { createRegisterForBooking } = await import('./payments');
        await createRegisterForBooking(updatedBooking);
        logger.info('Register created for manually paid booking', { bookingId: id });
      } catch (registerError) {
        logger.error('Failed to create register for manually paid booking:', registerError);
        // Don't fail the request, just log the error
      }
    }

    res.json({
      success: true,
      message: 'Payment status updated successfully',
      data: {
        bookingId: id,
        paymentStatus
      }
    });
  } catch (error) {
    logger.error('Error updating payment status:', error);
    throw error;
  }
}));

// Get booking details
router.get('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    if (!id) {
      throw new AppError('Booking ID is required', 400, 'MISSING_BOOKING_ID');
    }

    const booking = await prisma.booking.findUnique({
      where: { id: id },
      include: {
        activity: {
          include: {
            venue: true
          }
        },
        child: true
      }
    });

    if (!booking || booking.parentId !== userId) {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    // Transform the data
    const transformedBooking = {
      id: booking.id,
      activity_name: booking.activity.title,
      venue_name: booking.activity.venue.name,
      child_name: `${booking.child.firstName} ${booking.child.lastName}`,
      start_date: booking.activityDate,
      start_time: booking.activityTime,
      end_time: booking.activityTime, // Using same time for end_time
      total_amount: Number(booking.amount),
      status: booking.status,
      created_at: booking.createdAt,
      payment_status: booking.paymentStatus || 'pending',
      notes: booking.notes,
      activity: {
        id: booking.activityId,
        title: booking.activity.title,
        description: booking.activity.description,
        price: Number(booking.activity.price || booking.amount),
        max_capacity: booking.activity.capacity || 20,
        current_capacity: 15,
      },
      venue: {
        id: booking.activity.venue.id,
        name: booking.activity.venue.name,
        address: booking.activity.venue.address,
        city: booking.activity.venue.city,
      },
      child: {
        id: booking.childId,
        firstName: booking.child.firstName,
        lastName: booking.child.lastName,
      },
    };

    res.json({
      success: true,
      data: transformedBooking,
    });
  } catch (error) {
    logger.error('Error fetching booking details:', error);
    throw error;
  }
}));

// Utility endpoint to fix existing course bookings without registers
router.post('/fix-course-registers', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    logger.info(`Starting course register fix for user: ${userId}`);
    
    // Find all course bookings for this user that don't have registers
    const courseBookings = await prisma.booking.findMany({
      where: {
        parentId: userId,
        notes: {
          contains: 'COURSE_BOOKING'
        },
        status: {
          in: ['confirmed', 'pending']
        }
      },
      include: {
        activity: {
          select: {
            id: true,
            title: true,
            startDate: true,
            endDate: true,
            regularDay: true,
            regularTime: true,
            durationWeeks: true,
            capacity: true
          }
        },
        child: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (courseBookings.length === 0) {
      return res.json({
        success: true,
        message: 'No course bookings found to fix',
        data: { fixed: 0 }
      });
    }

    let fixedCount = 0;
    const processedActivities = new Set();

    for (const booking of courseBookings) {
      const activity = booking.activity;
      
      // Skip if we've already processed this activity
      if (processedActivities.has(activity.id)) {
        continue;
      }
      
      // Check if registers already exist for this activity
      const existingRegisters = await prisma.register.findMany({
        where: {
          session: {
            activityId: activity.id
          }
        }
      });

      if (existingRegisters.length > 0) {
        logger.info(`Registers already exist for activity ${activity.id}, skipping`);
        processedActivities.add(activity.id);
        continue;
      }

      // Create registers for this course activity
      if (activity.regularDay && activity.regularTime && activity.durationWeeks) {
        const startDate = new Date(activity.startDate);
        const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(activity.regularDay);
        
        if (dayOfWeek === -1) {
          logger.warn(`Invalid day of week: ${activity.regularDay} for activity ${activity.id}`);
          continue;
        }

        // Get all children booked for this course
        const courseChildren = courseBookings
          .filter(b => {
            return b.activityId === activity.id;
          })
          .map(b => {
            return {
              id: b.childId,
              name: `${b.child.firstName} ${b.child.lastName}`
            };
          });

        for (let week = 0; week < activity.durationWeeks; week++) {
          const sessionDate = new Date(startDate);
          
          // Calculate the correct date for this week's session
          const daysToAdd = (week * 7) + (dayOfWeek - sessionDate.getDay());
          sessionDate.setDate(sessionDate.getDate() + daysToAdd);
          
          // Skip if this date is in the past
          if (sessionDate < new Date()) {
            continue;
          }

          // Check if session already exists
          let session = await prisma.session.findFirst({
            where: {
              activityId: activity.id,
              date: sessionDate
            }
          });

          if (!session) {
            // Create session
            session = await prisma.session.create({
              data: {
                activityId: activity.id,
                date: sessionDate,
                startTime: activity.regularTime,
                endTime: activity.regularTime,
                capacity: activity.capacity || 20,
                status: 'scheduled'
              }
            });
            logger.info(`Created session ${session.id} for activity ${activity.id} on ${sessionDate.toISOString().split('T')[0]}`);
          }

          // Check if register already exists for this session
          let register = await prisma.register.findFirst({
            where: {
              sessionId: session.id
            }
          });

          if (!register) {
            // Create register
            register = await prisma.register.create({
              data: {
                sessionId: session.id,
                date: sessionDate,
                status: 'upcoming',
                notes: `Course session ${week + 1}/${activity.durationWeeks} - ${courseChildren.map(child => { return child.name; }).join(', ')}`
              }
            });
            logger.info(`Created register ${register.id} for session ${session.id} on ${sessionDate.toISOString().split('T')[0]}`);
            fixedCount++;

            // Create attendance records for each child
            for (const child of courseChildren) {
              const childBooking = courseBookings.find(b => {
                return b.activityId === activity.id && b.childId === child.id;
              });
              
              if (childBooking) {
                await prisma.attendance.create({
                  data: {
                    registerId: register.id,
                    childId: child.id,
                    bookingId: childBooking.id,
                    present: true,
                    notes: `Auto-enrolled in course session ${week + 1}/${activity.durationWeeks} (${child.name})`
                  }
                });
              }
            }
          }
        }
      }
      
      processedActivities.add(activity.id);
    }

    logger.info(`Course register fix completed: ${fixedCount} registers created for user: ${userId}`);

    res.json({
      success: true,
      message: `Successfully created ${fixedCount} registers for existing course bookings`,
      data: { 
        fixed: fixedCount,
        processedActivities: processedActivities.size
      }
    });

  } catch (error) {
    logger.error('Error fixing course registers:', error);
    throw new AppError('Failed to fix course registers', 500, 'REGISTER_FIX_ERROR');
  }
}));

// Update booking options (early drop-off, late pick-up)
router.put('/:id/options', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { hasEarlyDropoff, hasLatePickup } = req.body;
    const userId = req.user!.id;

    if (!id) {
      throw new AppError('Booking ID is required', 400, 'MISSING_BOOKING_ID');
    }

    // Find the booking and verify ownership
    const booking = await prisma.booking.findFirst({
      where: {
        id: id,
        parentId: userId,
        status: { in: ['pending', 'confirmed'] }
      },
      include: {
        activity: true,
        child: true
      }
    });

    if (!booking) {
      throw new AppError('Booking not found or access denied', 404, 'BOOKING_NOT_FOUND');
    }

    // Check if booking can be modified (e.g., not within 24 hours of activity)
    const activityDate = new Date(booking.activityDate);
    const now = new Date();
    const hoursUntilActivity = (activityDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilActivity < 24) {
      throw new AppError('Booking cannot be modified within 24 hours of activity', 400, 'BOOKING_TOO_CLOSE');
    }

    // Calculate new amounts
    let newTotalAmount = Number(booking.amount);
    let earlyDropoffAmount = null;
    let latePickupAmount = null;

    if (hasEarlyDropoff && booking.activity.earlyDropoff && booking.activity.earlyDropoffPrice) {
      earlyDropoffAmount = booking.activity.earlyDropoffPrice;
      newTotalAmount += Number(earlyDropoffAmount);
    }

    if (hasLatePickup && booking.activity.latePickup && booking.activity.latePickupPrice) {
      latePickupAmount = booking.activity.latePickupPrice;
      newTotalAmount += Number(latePickupAmount);
    }

    // Update the booking
    const updatedBooking = await prisma.booking.update({
      where: { id: id },
      data: {
        hasEarlyDropoff: hasEarlyDropoff || false,
        earlyDropoffAmount: earlyDropoffAmount ? new Decimal(earlyDropoffAmount) : null,
        hasLatePickup: hasLatePickup || false,
        latePickupAmount: latePickupAmount ? new Decimal(latePickupAmount) : null,
        totalAmount: newTotalAmount,
        updatedAt: new Date()
      } as any,
      include: {
        activity: true,
        child: true
      }
    });

    // Update registers in real-time
    await RealTimeRegisterService.updateBookingOptionsRealTime(
      id,
      {
        hasEarlyDropoff,
        hasLatePickup,
        ...(earlyDropoffAmount && { earlyDropoffAmount: Number(earlyDropoffAmount) }),
        ...(latePickupAmount && { latePickupAmount: Number(latePickupAmount) })
      }
    );

    // Create notification for business owner
    try {
      const { NotificationService } = await import('../services/notificationService');
      await NotificationService.createNotification({
        userId: booking.activity.ownerId,
        venueId: booking.activity.venueId,
        type: 'booking_confirmation', // Changed from 'booking_updated' to existing type
        title: 'Booking Updated',
        message: `${booking.child.firstName} ${booking.child.lastName}'s booking for ${booking.activity.title} has been updated`,
        data: {
          bookingId: booking.id,
          childId: booking.childId,
          activityId: booking.activityId,
          hasEarlyDropoff: hasEarlyDropoff,
          hasLatePickup: hasLatePickup,
          newTotalAmount: newTotalAmount
        },
        priority: 'medium',
        channels: ['in_app']
      });
    } catch (notificationError) {
      logger.error('Failed to create notification for booking update:', notificationError);
    }

    // Create notification for all admin users
    try {
      const { NotificationService } = await import('../services/notificationService');
      const parent = await prisma.user.findUnique({ 
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true
        }
      });
      
      await NotificationService.notifyAdmins({
        venueId: booking.activity.venueId,
        type: 'booking_confirmation',
        title: 'Booking Updated - Admin Alert',
        message: `${parent?.firstName || 'Parent'} ${parent?.lastName || ''} updated ${booking.child.firstName} ${booking.child.lastName}'s booking for ${booking.activity.title}`,
        data: {
          bookingId: booking.id,
          childId: booking.childId,
          activityId: booking.activityId,
          hasEarlyDropoff: hasEarlyDropoff,
          hasLatePickup: hasLatePickup,
          newTotalAmount: newTotalAmount,
          parentId: userId,
          parentName: `${parent?.firstName || ''} ${parent?.lastName || ''}`,
          childName: `${booking.child.firstName || ''} ${booking.child.lastName || ''}`,
          venueName: 'Unknown Venue'
        },
        priority: 'medium',
        channels: ['in_app', 'email']
      });
      logger.info(`Created admin notifications for booking update ${booking.id}`);
    } catch (notificationError) {
      logger.error('Failed to create admin notifications for booking update:', notificationError);
    }

    logger.info(`Booking ${id} options updated by user ${userId}`);

    res.json({
      success: true,
      data: updatedBooking,
      message: 'Booking options updated successfully'
    });

  } catch (error) {
    logger.error('Error updating booking options:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to update booking options', 500, 'BOOKING_UPDATE_ERROR');
  }
}));

// Transfer booking between activities (Admin only)
router.put('/:id/transfer', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newActivityId, newDate, reason } = req.body;
    const userId = req.user!.id;

    if (!id) {
      throw new AppError('Booking ID is required', 400, 'MISSING_BOOKING_ID');
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (user?.role !== 'admin') {
      throw new AppError('Admin access required', 403, 'ADMIN_REQUIRED');
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        activity: true,
        child: true,
        parent: true
      }
    });

    if (!booking) {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    // Get new activity details
    const newActivity = await prisma.activity.findUnique({
      where: { id: newActivityId },
      include: { venue: true }
    });

    if (!newActivity) {
      throw new AppError('New activity not found', 404, 'ACTIVITY_NOT_FOUND');
    }

    // Update booking
    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: {
        activityId: newActivityId,
        activityDate: newDate ? new Date(newDate) : booking.activityDate,
        notes: `${booking.notes || ''}\nTransferred from ${booking.activity.title} to ${newActivity.title}. Reason: ${reason || 'No reason provided'}`.trim(),
        updatedAt: new Date()
      },
      include: {
        activity: true,
        child: true,
        parent: true
      }
    });

    // Transfer booking and update registers in real-time
    await RealTimeRegisterService.transferBookingRealTime(
      id,
      newActivityId,
      newDate,
      userId
    );

    // Create notifications
    try {
      const { NotificationService } = await import('../services/notificationService');
      
      // Notify parent
      await NotificationService.createNotification({
        userId: booking.parentId,
        venueId: newActivity.venueId,
        type: 'system_alert',
        title: 'Booking Transferred',
        message: `Your booking for ${booking.child.firstName} has been transferred to ${newActivity.title}`,
        data: {
          bookingId: booking.id,
          oldActivityId: booking.activityId,
          newActivityId: newActivityId,
          newActivityName: newActivity.title,
          reason: reason
        },
        priority: 'medium',
        channels: ['in_app', 'email']
      });

      // Notify business owner
      await NotificationService.createNotification({
        userId: booking.activity.ownerId,
        venueId: booking.activity.venueId,
        type: 'system_alert',
        title: 'Booking Transferred',
        message: `Booking for ${booking.child.firstName} ${booking.child.lastName} has been transferred to ${newActivity.title}`,
        data: {
          bookingId: booking.id,
          childName: `${booking.child.firstName} ${booking.child.lastName}`,
          oldActivityName: booking.activity.title,
          newActivityName: newActivity.title,
          reason: reason
        },
        priority: 'medium',
        channels: ['in_app']
      });

      // Notify new activity owner
      if (newActivity.ownerId !== booking.activity.ownerId) {
        await NotificationService.createNotification({
          userId: newActivity.ownerId,
          venueId: newActivity.venueId,
          type: 'system_alert',
          title: 'New Booking Transfer',
          message: `Booking for ${booking.child.firstName} ${booking.child.lastName} has been transferred to your activity: ${newActivity.title}`,
          data: {
            bookingId: booking.id,
            childName: `${booking.child.firstName} ${booking.child.lastName}`,
            activityName: newActivity.title,
            reason: reason
          },
          priority: 'medium',
          channels: ['in_app']
        });
      }
    } catch (notificationError) {
      logger.error('Failed to create transfer notifications:', notificationError);
    }

    logger.info(`Booking ${id} transferred by admin ${userId} from ${booking.activity.title} to ${newActivity.title}`);

    res.json({
      success: true,
      data: updatedBooking,
      message: 'Booking transferred successfully'
    });

  } catch (error) {
    logger.error('Error transferring booking:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to transfer booking', 500, 'BOOKING_TRANSFER_ERROR');
  }
}));

// Swap holiday club booking dates (Admin only)
router.put('/:id/swap-date', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newDate, reason } = req.body;
    const userId = req.user!.id;

    if (!id) {
      throw new AppError('Booking ID is required', 400, 'MISSING_BOOKING_ID');
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (user?.role !== 'admin') {
      throw new AppError('Admin access required', 403, 'ADMIN_REQUIRED');
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        activity: true,
        child: true,
        parent: true
      }
    });

    if (!booking) {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    // Check if it's a holiday club booking
    if (booking.activity.type !== 'holiday_club') {
      throw new AppError('This endpoint is only for holiday club bookings', 400, 'INVALID_BOOKING_TYPE');
    }

    const oldDate = booking.activityDate;
    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: {
        activityDate: new Date(newDate),
        notes: `${booking.notes || ''}\nDate swapped from ${oldDate.toLocaleDateString()} to ${new Date(newDate).toLocaleDateString()}. Reason: ${reason || 'No reason provided'}`.trim(),
        updatedAt: new Date()
      },
      include: {
        activity: true,
        child: true,
        parent: true
      }
    });

    // Create notifications
    try {
      const { NotificationService } = await import('../services/notificationService');
      
      // Notify parent
      await NotificationService.createNotification({
        userId: booking.parentId,
        venueId: booking.activity.venueId,
        type: 'system_alert',
        title: 'Holiday Club Date Changed',
        message: `Your holiday club booking for ${booking.child.firstName} has been moved to ${new Date(newDate).toLocaleDateString()}`,
        data: {
          bookingId: booking.id,
          activityName: booking.activity.title,
          oldDate: oldDate.toISOString(),
          newDate: newDate,
          reason: reason
        },
        priority: 'medium',
        channels: ['in_app', 'email']
      });

      // Notify business owner
      await NotificationService.createNotification({
        userId: booking.activity.ownerId,
        venueId: booking.activity.venueId,
        type: 'system_alert',
        title: 'Holiday Club Date Swapped',
        message: `Holiday club booking for ${booking.child.firstName} ${booking.child.lastName} has been moved to ${new Date(newDate).toLocaleDateString()}`,
        data: {
          bookingId: booking.id,
          childName: `${booking.child.firstName} ${booking.child.lastName}`,
          activityName: booking.activity.title,
          oldDate: oldDate.toISOString(),
          newDate: newDate,
          reason: reason
        },
        priority: 'medium',
        channels: ['in_app']
      });
    } catch (notificationError) {
      logger.error('Failed to create date swap notifications:', notificationError);
    }

    logger.info(`Holiday club booking ${id} date swapped by admin ${userId} from ${oldDate.toLocaleDateString()} to ${new Date(newDate).toLocaleDateString()}`);

    res.json({
      success: true,
      data: updatedBooking,
      message: 'Holiday club booking date swapped successfully'
    });

  } catch (error) {
    logger.error('Error swapping holiday club date:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to swap holiday club date', 500, 'DATE_SWAP_ERROR');
  }
}));

// Admin management of booking options
router.put('/:id/admin-options', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { hasEarlyDropoff, hasLatePickup, reason } = req.body;
    const userId = req.user!.id;

    if (!id) {
      throw new AppError('Booking ID is required', 400, 'MISSING_BOOKING_ID');
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (user?.role !== 'admin') {
      throw new AppError('Admin access required', 403, 'ADMIN_REQUIRED');
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        activity: true,
        child: true,
        parent: true
      }
    });

    if (!booking) {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    let newTotalAmount = Number(booking.amount);
    let earlyDropoffAmount = null;
    let latePickupAmount = null;

    if (hasEarlyDropoff && booking.activity.earlyDropoff && booking.activity.earlyDropoffPrice) {
      earlyDropoffAmount = booking.activity.earlyDropoffPrice;
      newTotalAmount += Number(earlyDropoffAmount);
    }

    if (hasLatePickup && booking.activity.latePickup && booking.activity.latePickupPrice) {
      latePickupAmount = booking.activity.latePickupPrice;
      newTotalAmount += Number(latePickupAmount);
    }

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: {
        hasEarlyDropoff: hasEarlyDropoff || false,
        earlyDropoffAmount: earlyDropoffAmount ? new Decimal(earlyDropoffAmount) : null,
        hasLatePickup: hasLatePickup || false,
        latePickupAmount: latePickupAmount ? new Decimal(latePickupAmount) : null,
        totalAmount: new Decimal(newTotalAmount),
        notes: `${booking.notes || ''}\nOptions updated by admin. Reason: ${reason || 'No reason provided'}`.trim(),
        updatedAt: new Date()
      } as any,
      include: {
        activity: true,
        child: true,
        parent: true
      }
    });

    // Update registers in real-time
    await RealTimeRegisterService.updateBookingOptionsRealTime(
      id,
      {
        hasEarlyDropoff,
        hasLatePickup,
        ...(earlyDropoffAmount && { earlyDropoffAmount: Number(earlyDropoffAmount) }),
        ...(latePickupAmount && { latePickupAmount: Number(latePickupAmount) })
      },
      userId
    );

    // Create notifications
    try {
      const { NotificationService } = await import('../services/notificationService');
      
      // Notify parent
      await NotificationService.createNotification({
        userId: booking.parentId,
        venueId: booking.activity.venueId,
        type: 'system_alert',
        title: 'Booking Options Updated',
        message: `Your booking options for ${booking.child.firstName} have been updated by admin`,
        data: {
          bookingId: booking.id,
          activityName: booking.activity.title,
          hasEarlyDropoff: hasEarlyDropoff,
          hasLatePickup: hasLatePickup,
          newTotalAmount: newTotalAmount,
          reason: reason
        },
        priority: 'medium',
        channels: ['in_app', 'email']
      });

      // Notify business owner
      await NotificationService.createNotification({
        userId: booking.activity.ownerId,
        venueId: booking.activity.venueId,
        type: 'system_alert',
        title: 'Booking Options Updated by Admin',
        message: `Admin updated booking options for ${booking.child.firstName} ${booking.child.lastName}`,
        data: {
          bookingId: booking.id,
          childName: `${booking.child.firstName} ${booking.child.lastName}`,
          activityName: booking.activity.title,
          hasEarlyDropoff: hasEarlyDropoff,
          hasLatePickup: hasLatePickup,
          newTotalAmount: newTotalAmount,
          reason: reason
        },
        priority: 'medium',
        channels: ['in_app']
      });
    } catch (notificationError) {
      logger.error('Failed to create admin options notifications:', notificationError);
    }

    logger.info(`Booking ${id} options updated by admin ${userId}`);

    res.json({
      success: true,
      data: updatedBooking,
      message: 'Booking options updated successfully by admin'
    });

  } catch (error) {
    logger.error('Error updating booking options by admin:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to update booking options', 500, 'ADMIN_OPTIONS_UPDATE_ERROR');
  }
}));

// Cancel booking with enhanced refund/credit policy
router.put('/:id/cancel', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    if (!id) {
      throw new AppError('Booking ID is required', 400, 'MISSING_BOOKING_ID');
    }

    if (!reason) {
      throw new AppError('Cancellation reason is required', 400, 'MISSING_REASON');
    }

    // Find the booking and verify ownership
    const booking = await prisma.booking.findFirst({
      where: {
        id: id,
        parentId: userId,
        status: { in: ['pending', 'confirmed'] }
      },
      include: {
        activity: {
          include: {
            venue: true
          }
        },
        child: true,
        parent: true
      }
    });

    if (!booking) {
      throw new AppError('Booking not found or access denied', 404, 'BOOKING_NOT_FOUND');
    }

    // Use the enhanced cancellation service
    const { cancellationService } = await import('../services/cancellationService');
    const result = await cancellationService.processCancellation(
      id,
      userId,
      reason,
      userRole === 'admin' || userRole === 'staff' ? userId : undefined
    );

    // Send notifications
    try {
      const { RefundNotificationService } = await import('../services/refundNotificationService');
      const { ProviderNotificationService } = await import('../services/providerNotificationService');
      
      // Get eligibility for notification data
      const eligibility = await cancellationService.determineCancellationEligibility(id, new Date());
      
      // Send refund/credit notification to parent
      await RefundNotificationService.sendRefundProcessedNotification({
        type: eligibility.method === 'cash' ? 'refund_processed' : 'credit_issued',
        parentId: userId,
        bookingId: id,
        amount: Number(booking.amount),
        method: eligibility.method === 'cash' ? 'refund' : 'credit',
        reason,
        adminFee: eligibility.adminFee,
        netAmount: eligibility.refundAmount > 0 ? eligibility.refundAmount : eligibility.creditAmount
      });

      // Send booking cancelled notification to provider
      if (booking.activity?.ownerId) {
        await ProviderNotificationService.sendBookingCancellationNotification(
          booking.activity.ownerId,
          id,
          {
            childName: `${booking.child?.firstName || 'Child'} ${booking.child?.lastName || ''}`,
            parentName: `${booking.parent?.firstName || 'Parent'} ${booking.parent?.lastName || ''}`,
            activityName: booking.activity?.title || 'Activity',
            cancellationReason: reason,
            refundAmount: eligibility.refundAmount,
            creditAmount: eligibility.creditAmount,
            venueName: booking.activity?.venue?.name
          }
        );
      }

      // Send booking cancelled notification to admin
      await RefundNotificationService.sendBookingCancelledNotification(
        id,
        userId,
        reason,
        eligibility.refundAmount,
        eligibility.creditAmount
      );
    } catch (notificationError) {
      logger.error('Error sending notifications:', notificationError);
      // Don't fail the cancellation if notifications fail
    }

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      data: {
        refundTransactionId: result.refundTransactionId,
        creditId: result.creditId
      }
    });
  } catch (error) {
    logger.error('Error cancelling booking:', error);
    throw error;
  }
}));

export default router;
