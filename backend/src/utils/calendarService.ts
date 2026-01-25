import ical from 'ical-generator';
import { Activity, Session, Venue } from '@prisma/client';

export interface BookingCalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  attendees?: Array<{
    name: string;
    email: string;
  }>;
  organizer?: {
    name: string;
    email: string;
  };
}

export class CalendarService {
  /**
   * Generate iCal content for a course with all its sessions
   */
  generateCourseCalendar(activity: Activity & { sessions: Session[], venue: Venue }): string {
    const calendar = ical({
      name: `${activity.title} - BookOn`,
      description: `Course sessions for ${activity.title}`,
      timezone: 'Europe/London',
      prodId: {
        company: 'BookOn',
        product: 'Booking System',
        language: 'EN'
      }
    });

    // Add each session as an event
    activity.sessions.forEach(session => {
      const event = calendar.createEvent({
        start: new Date(`${session.date.toISOString().split('T')[0]}T${session.startTime}`),
        end: new Date(`${session.date.toISOString().split('T')[0]}T${session.endTime}`),
        summary: activity.title,
        description: activity.description || `Session for ${activity.title}`,
        location: activity.venue.name,
        url: `${process.env['FRONTEND_URL']}/activities/${activity.id}`,
        status: 'CONFIRMED',
        busyStatus: 'BUSY'
      });

      // Add organizer info if available
      if (process.env['ADMIN_EMAIL']) {
        event.organizer({
          name: 'BookOn Admin',
          email: process.env['ADMIN_EMAIL']
        });
      }
    });

    return calendar.toString();
  }

  /**
   * Generate iCal content for a single booking
   */
  generateBookingCalendar(booking: BookingCalendarEvent): string {
    const calendar = ical({
      name: `${booking.title} - BookOn`,
      description: booking.description || `Booking: ${booking.title}`,
      timezone: 'Europe/London',
      prodId: {
        company: 'BookOn',
        product: 'Booking System',
        language: 'EN'
      }
    });

    const event = calendar.createEvent({
      start: booking.startDate,
      end: booking.endDate,
      summary: booking.title,
      description: booking.description,
      location: booking.location,
      status: 'CONFIRMED',
      busyStatus: 'BUSY',
      uid: booking.id
    });

    // Add attendees if provided
    if (booking.attendees && booking.attendees.length > 0) {
      booking.attendees.forEach(attendee => {
        event.attendee({
          name: attendee.name,
          email: attendee.email,
          status: 'ACCEPTED'
        });
      });
    }

    // Add organizer if provided
    if (booking.organizer) {
      event.organizer({
        name: booking.organizer.name,
        email: booking.organizer.email
      });
    }

    return calendar.toString();
  }

  /**
   * Generate iCal content for multiple bookings
   */
  generateMultipleBookingsCalendar(bookings: BookingCalendarEvent[], calendarName: string = 'BookOn Bookings'): string {
    const calendar = ical({
      name: calendarName,
      description: 'Your BookOn bookings',
      timezone: 'Europe/London',
      prodId: {
        company: 'BookOn',
        product: 'Booking System',
        language: 'EN'
      }
    });

    bookings.forEach(booking => {
      const event = calendar.createEvent({
        start: booking.startDate,
        end: booking.endDate,
        summary: booking.title,
        description: booking.description,
        location: booking.location,
        status: 'CONFIRMED',
        busyStatus: 'BUSY',
        uid: booking.id
      });

      // Add attendees if provided
      if (booking.attendees && booking.attendees.length > 0) {
        booking.attendees.forEach(attendee => {
          event.attendee({
            name: attendee.name,
            email: attendee.email,
            status: 'ACCEPTED'
          });
        });
      }

      // Add organizer if provided
      if (booking.organizer) {
        event.organizer({
          name: booking.organizer.name,
          email: booking.organizer.email
        });
      }
    });

    return calendar.toString();
  }

  /**
   * Get suggested filename for calendar export
   */
  getCalendarFilename(prefix: string = 'bookon'): string {
    const now = new Date();
    const timestamp = now.toISOString().split('T')[0];
    return `${prefix}-${timestamp}.ics`;
  }
}

export const calendarService = new CalendarService();

