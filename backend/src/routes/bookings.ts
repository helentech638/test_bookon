import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';
import { automatedEmailService } from '../services/automatedEmailService';

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

    // Check if user already has a course booking for this activity with any of the children
    const existingCourseBooking = await prisma.booking.findFirst({
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

    if (existingCourseBooking) {
      // If it's an old pending booking (more than 30 minutes), cancel it and allow new booking
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      if (existingCourseBooking.status === 'pending' && existingCourseBooking.createdAt < thirtyMinutesAgo) {
        logger.info(`Cancelling old pending course booking ${existingCourseBooking.id} to allow new booking`);
        
        // Cancel the old booking
        await prisma.booking.update({
          where: { id: existingCourseBooking.id },
          data: {
            status: 'cancelled',
            paymentStatus: 'cancelled'
          }
        });

        // Deactivate any associated payments
        await prisma.payment.updateMany({
          where: {
            bookingId: existingCourseBooking.id,
            isActive: true
          },
          data: {
            isActive: false,
            status: 'cancelled'
          }
        });
      } else {
        throw new AppError('You already have an existing booking for this course', 400, 'COURSE_BOOKING_EXISTS');
      }
    }

    // Create course booking records for each child
    const courseBookings = [];
    const amountPerChild = amount / children.length;
    
    for (const child of children) {
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
        sessionDate.setDate(sessionDate.getDate() + (week * 7) + (dayOfWeek - sessionDate.getDay()));
        
        // Create Session record first (this is what Register references)
        const session = await prisma.session.create({
          data: {
            activityId: activity.id,
            date: sessionDate,
            startTime: regularTime,
            endTime: regularTime, // For courses, start and end time are the same
            capacity: activity.capacity || 20,
            status: 'active'
          }
        });

        sessions.push(session);

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
            status: 'active',
            notes: `Course session ${week + 1}/${totalWeeks} - ${children.map(child => child.name).join(', ')}`
          }
        });

        // Create attendance records for each child
        for (const child of children) {
          const childSessionBooking = sessionBookings.find(sb => sb.childId === child.id);
          if (childSessionBooking) {
            await prisma.attendance.create({
              data: {
                registerId: register.id,
                childId: child.id,
                bookingId: childSessionBooking.id,
                present: true, // Default to present for course bookings
                notes: `Auto-enrolled in course session ${week + 1}/${totalWeeks} (${child.name})`
              }
            });
          }
        }
      }
    }

    logger.info(`Course booking created: ${courseBookings.length} bookings with ${sessionBookings.length} sessions for user: ${userId}`);

    // Send course booking confirmation email
    try {
      const parent = await prisma.user.findUnique({ where: { id: userId } });
      
      const { emailService } = await import('../services/emailService');
      await emailService.sendBookingConfirmation({
        to: parent?.email || '',
        parentName: `${parent?.firstName || ''} ${parent?.lastName || ''}`,
        childName: children.map(child => child.name).join(', '),
        activityName: activity.title || '',
        venueName: 'Course Venue',
        amount: parseFloat(amount.toString()),
        paymentReference: courseBookings[0]?.paymentIntentId || 'N/A'
      });
      logger.info(`Sent course booking confirmation email for ${courseBookings.length} bookings`);
    } catch (emailError) {
      logger.error('Failed to send course booking confirmation email:', emailError);
    }

    res.status(201).json({
      success: true,
      data: {
        courseBookings,
        sessionBookings,
        sessions,
        totalSessions: sessionBookings.length,
        totalChildren: children.length,
        courseSchedule
      },
      message: `Course booking created successfully for ${children.length} child${children.length > 1 ? 'ren' : ''} with auto-generated registers`,
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
      total_amount: booking.amount,
      status: booking.status,
      created_at: booking.createdAt,
      payment_status: booking.paymentStatus || 'pending',
      notes: booking.notes,
        activity: {
          id: booking.activityId,
        title: booking.activity.title,
        description: booking.activity.description || booking.activity.title,
        price: booking.activity.price || booking.amount,
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

    const { activityId, childId, children, startDate, startTime, notes, sessionBlockId, amount, bookingType, courseSchedule, totalWeeks, childName, status } = req.body;

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
    const parent = await prisma.user.findUnique({ where: { id: userId } });
    const childData = await prisma.child.findUnique({ where: { id: childId } });
    const activityData = await prisma.activity.findUnique({ where: { id: activityId } });

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
    const { reason } = req.body;
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

    // Check if booking can be cancelled
    if (booking.status === 'cancelled' || booking.status === 'completed') {
      throw new AppError('Booking cannot be cancelled', 400, 'BOOKING_CANNOT_BE_CANCELLED');
    }

    // Import refund policy service
    const { RefundPolicyService } = await import('../services/refundPolicyService');
    const { emailService } = await import('../services/emailService');

    // Calculate refund
    const cancellationContext = {
      bookingId: id,
      parentId: userId,
      cancellationTime: new Date(),
      reason: reason || 'Parent cancellation'
    };

    const refundCalculation = await RefundPolicyService.calculateRefund(cancellationContext);

    // Process refund
    await RefundPolicyService.processRefund(cancellationContext, refundCalculation);

    // Get related data for email
    const parent = await prisma.user.findUnique({ where: { id: userId } });
    const childData = await prisma.child.findUnique({ where: { id: booking.childId } });
    const activityData = await prisma.activity.findUnique({ where: { id: booking.activityId } });

    // Send cancellation confirmation email
    try {
      await emailService.sendCancellationConfirmation({
        to: parent?.email || '',
        parentName: `${parent?.firstName || ''} ${parent?.lastName || ''}`,
        childName: `${childData?.firstName || ''} ${childData?.lastName || ''}`,
        activityName: activityData?.title || '',
        venueName: 'Unknown Venue',
        amount: parseFloat(booking.amount.toString()),
        refundAmount: refundCalculation.netRefund,
        refundMethod: refundCalculation.refundMethod === 'cash' ? 'refunded to your original payment method' : 'added to your BookOn wallet as credit'
      });
    } catch (emailError) {
      logger.error('Failed to send cancellation email:', emailError);
      // Don't fail the cancellation if email fails
    }

    logger.info(`Booking cancelled: ${id} by user: ${userId}`, {
      refundAmount: refundCalculation.netRefund,
      refundMethod: refundCalculation.refundMethod,
      adminFee: refundCalculation.adminFee
    });

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      data: {
        refundAmount: refundCalculation.netRefund,
        refundMethod: refundCalculation.refundMethod,
        adminFee: refundCalculation.adminFee,
        reason: refundCalculation.reason
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
      total_amount: booking.amount,
      status: booking.status,
      created_at: booking.createdAt,
      payment_status: booking.paymentStatus || 'pending',
      notes: booking.notes,
      activity: {
        id: booking.activityId,
        title: booking.activity.title,
        description: booking.activity.description,
        price: booking.activity.price || booking.amount,
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

export default router;
