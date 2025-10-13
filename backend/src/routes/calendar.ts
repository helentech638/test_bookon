import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import { prisma, safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';
import { calendarService, BookingCalendarEvent } from '../utils/calendarService';

const router = Router();

// Export booking calendar (iCal format) - for individual bookings
router.get('/booking/:bookingId/calendar', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user!.id;
    
    logger.info('Exporting booking calendar', { 
      user: req.user?.email,
      bookingId,
      userId 
    });

    const booking = await safePrismaQuery(async (client) => {
      return await client.booking.findFirst({
        where: {
          id: bookingId,
          parentId: userId // Ensure user can only access their own bookings
        },
        include: {
          activity: {
            include: {
              venue: true
            }
          },
          parent: true,
          child: true
        }
      });
    });

    if (!booking) {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    const calendarEvent: BookingCalendarEvent = {
      id: booking.id,
      title: `${booking.activity.name} - ${booking.child.firstName}`,
      description: `Activity: ${booking.activity.name}\nChild: ${booking.child.firstName} ${booking.child.lastName}\nVenue: ${booking.activity.venue.name}`,
      startDate: new Date(`${booking.activityDate.toISOString().split('T')[0]}T${booking.activityTime.split('-')[0]}`),
      endDate: new Date(`${booking.activityDate.toISOString().split('T')[0]}T${booking.activityTime.split('-')[1]}`),
      location: booking.activity.venue.name,
      attendees: [{
        name: booking.parent.firstName + ' ' + booking.parent.lastName,
        email: booking.parent.email
      }]
    };

    const calendarContent = calendarService.generateBookingCalendar(calendarEvent);
    const filename = calendarService.getCalendarFilename(`booking-${bookingId}`);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(calendarContent);

    logger.info('Booking calendar exported', { 
      bookingId,
      filename 
    });
  } catch (error) {
    logger.error('Error exporting booking calendar:', error);
    throw error;
  }
}));

// Export all bookings calendar for a parent
router.get('/parent/:parentId/calendar', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { parentId } = req.params;
    const userId = req.user!.id;
    
    // Ensure user can only access their own bookings or is admin
    if (parentId !== userId && req.user?.role !== 'admin') {
      throw new AppError('Access denied', 403, 'ACCESS_DENIED');
    }

    const bookings = await safePrismaQuery(async (client) => {
      return await client.booking.findMany({
        where: {
          parentId: parentId,
          status: {
            in: ['confirmed', 'pending']
          }
        },
        include: {
          activity: {
            include: {
              venue: true
            }
          },
          parent: true,
          child: true
        },
        orderBy: {
          activityDate: 'asc'
        }
      });
    });

    const calendarEvents: BookingCalendarEvent[] = bookings.map(booking => ({
      id: booking.id,
      title: `${booking.activity.name} - ${booking.child.firstName}`,
      description: `Activity: ${booking.activity.name}\nChild: ${booking.child.firstName} ${booking.child.lastName}\nVenue: ${booking.activity.venue.name}`,
      startDate: new Date(`${booking.activityDate.toISOString().split('T')[0]}T${booking.activityTime.split('-')[0]}`),
      endDate: new Date(`${booking.activityDate.toISOString().split('T')[0]}T${booking.activityTime.split('-')[1]}`),
      location: booking.activity.venue.name,
      attendees: [{
        name: booking.parent.firstName + ' ' + booking.parent.lastName,
        email: booking.parent.email
      }]
    }));

    const calendarContent = calendarService.generateMultipleBookingsCalendar(
      calendarEvents, 
      `${bookings[0]?.parent.firstName}'s BookOn Bookings`
    );
    const filename = calendarService.getCalendarFilename(`bookings-${parentId}`);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(calendarContent);

    logger.info('Parent bookings calendar exported', { 
      parentId,
      bookingCount: bookings.length,
      filename 
    });
  } catch (error) {
    logger.error('Error exporting parent bookings calendar:', error);
    throw error;
  }
}));

// Export venue bookings calendar
router.get('/venue/:venueId/calendar', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { venueId } = req.params;
    const userId = req.user!.id;
    const { startDate, endDate } = req.query;
    
    // Only admins can export venue calendars
    if (req.user?.role !== 'admin') {
      throw new AppError('Admin access required', 403, 'ADMIN_REQUIRED');
    }

    const whereClause: any = {
      activity: {
        venueId: venueId
      },
      status: {
        in: ['confirmed', 'pending']
      }
    };

    if (startDate && endDate) {
      whereClause.activityDate = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      };
    }

    const bookings = await safePrismaQuery(async (client) => {
      return await client.booking.findMany({
        where: whereClause,
        include: {
          activity: {
            include: {
              venue: true
            }
          },
          parent: true,
          child: true
        },
        orderBy: {
          activityDate: 'asc'
        }
      });
    });

    const calendarEvents: BookingCalendarEvent[] = bookings.map(booking => ({
      id: booking.id,
      title: `${booking.activity.name} - ${booking.child.firstName} ${booking.child.lastName}`,
      description: `Activity: ${booking.activity.name}\nChild: ${booking.child.firstName} ${booking.child.lastName}\nParent: ${booking.parent.firstName} ${booking.parent.lastName}\nEmail: ${booking.parent.email}`,
      startDate: new Date(`${booking.activityDate.toISOString().split('T')[0]}T${booking.activityTime.split('-')[0]}`),
      endDate: new Date(`${booking.activityDate.toISOString().split('T')[0]}T${booking.activityTime.split('-')[1]}`),
      location: booking.activity.venue.name,
      attendees: [{
        name: booking.parent.firstName + ' ' + booking.parent.lastName,
        email: booking.parent.email
      }]
    }));

    const venue = bookings[0]?.activity.venue;
    const calendarContent = calendarService.generateMultipleBookingsCalendar(
      calendarEvents, 
      `${venue?.name} - BookOn Bookings`
    );
    const filename = calendarService.getCalendarFilename(`venue-${venueId}`);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(calendarContent);

    logger.info('Venue bookings calendar exported', { 
      venueId,
      bookingCount: bookings.length,
      filename 
    });
  } catch (error) {
    logger.error('Error exporting venue bookings calendar:', error);
    throw error;
  }
}));

export default router;
