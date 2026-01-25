import { authService } from './authService';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  url?: string;
  attendees?: Array<{
    name: string;
    email: string;
  }>;
}

export class CalendarService {
  /**
   * Generate iCal content for a calendar event
   */
  generateICalContent(event: CalendarEvent): string {
    const formatDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//BookOn//Booking System//EN
BEGIN:VEVENT
UID:${event.id}-${Date.now()}@bookon.app
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(event.startDate)}
DTEND:${formatDate(event.endDate)}
SUMMARY:${event.title}
DESCRIPTION:${event.description || event.title}
LOCATION:${event.location || ''}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;
  }

  /**
   * Generate Google Calendar URL
   */
  generateGoogleCalendarUrl(event: CalendarEvent): string {
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: event.title,
      dates: `${this.formatDateForGoogle(event.startDate)}/${this.formatDateForGoogle(event.endDate)}`,
      details: event.description || event.title,
      location: event.location || '',
      trp: 'false',
      sprop: 'name:BookOn;website:bookon.app'
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  /**
   * Generate Outlook Calendar URL
   */
  generateOutlookCalendarUrl(event: CalendarEvent): string {
    const params = new URLSearchParams({
      path: '/calendar/action/compose',
      rru: 'addevent',
      subject: event.title,
      startdt: event.startDate.toISOString(),
      enddt: event.endDate.toISOString(),
      body: event.description || event.title,
      location: event.location || ''
    });

    return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
  }

  /**
   * Generate Yahoo Calendar URL
   */
  generateYahooCalendarUrl(event: CalendarEvent): string {
    const params = new URLSearchParams({
      v: '60',
      view: 'd',
      type: '20',
      title: event.title,
      st: this.formatDateForYahoo(event.startDate),
      et: this.formatDateForYahoo(event.endDate),
      desc: event.description || event.title,
      in_loc: event.location || ''
    });

    return `https://calendar.yahoo.com/?${params.toString()}`;
  }

  /**
   * Download iCal file
   */
  downloadICalFile(event: CalendarEvent, filename?: string): void {
    try {
      const icalContent = this.generateICalContent(event);
      const blob = new Blob([icalContent], { type: 'text/calendar;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename || `${event.title.toLowerCase().replace(/\s+/g, '-')}-${event.startDate.toISOString().split('T')[0]}.ics`;
      link.click();
      
      // Clean up
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('Error downloading iCal file:', error);
      throw new Error('Failed to download calendar file');
    }
  }

  /**
   * Open calendar in external application
   */
  openInExternalCalendar(event: CalendarEvent, provider: 'google' | 'outlook' | 'yahoo'): void {
    let url: string;
    
    switch (provider) {
      case 'google':
        url = this.generateGoogleCalendarUrl(event);
        break;
      case 'outlook':
        url = this.generateOutlookCalendarUrl(event);
        break;
      case 'yahoo':
        url = this.generateYahooCalendarUrl(event);
        break;
      default:
        throw new Error('Unsupported calendar provider');
    }

    window.open(url, '_blank');
  }

  /**
   * Add event to calendar using Web Calendar API (if available)
   */
  async addToCalendar(event: CalendarEvent): Promise<void> {
    try {
      // Check if Web Calendar API is available
      if ('showSaveFilePicker' in window) {
        // Use File System Access API for better UX
        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: `${event.title}.ics`,
          types: [{
            description: 'iCalendar files',
            accept: {
              'text/calendar': ['.ics']
            }
          }]
        });
        
        const writable = await fileHandle.createWritable();
        await writable.write(this.generateICalContent(event));
        await writable.close();
        return;
      }
    } catch (error) {
      // Fallback to regular download if File System Access API fails
      console.warn('File System Access API not available, falling back to download');
    }

    // Fallback to regular download
    this.downloadICalFile(event);
  }

  /**
   * Format date for Google Calendar
   */
  private formatDateForGoogle(date: Date): string {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }

  /**
   * Format date for Yahoo Calendar
   */
  private formatDateForYahoo(date: Date): string {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }

  /**
   * Get calendar event from booking data
   */
  createEventFromBooking(booking: any): CalendarEvent {
    return {
      id: booking.id,
      title: `${booking.activity?.name || booking.activity?.title} - ${booking.child?.firstName}`,
      description: `Activity: ${booking.activity?.name || booking.activity?.title}\nChild: ${booking.child?.firstName} ${booking.child?.lastName}\nVenue: ${booking.activity?.venue?.name}`,
      startDate: new Date(`${booking.activityDate}T${booking.activityTime?.split('-')[0] || booking.activity?.startTime}`),
      endDate: new Date(`${booking.activityDate}T${booking.activityTime?.split('-')[1] || booking.activity?.endTime}`),
      location: booking.activity?.venue?.name,
      attendees: [{
        name: `${booking.parent?.firstName} ${booking.parent?.lastName}`,
        email: booking.parent?.email
      }]
    };
  }

  /**
   * Get calendar event from activity data
   */
  createEventFromActivity(activity: any, child?: any): CalendarEvent {
    return {
      id: activity.id,
      title: activity.title || activity.name,
      description: `Activity: ${activity.title || activity.name}\nVenue: ${activity.venue?.name}\n${child ? `Child: ${child.firstName} ${child.lastName}` : ''}`,
      startDate: new Date(`${activity.startDate}T${activity.startTime}`),
      endDate: new Date(`${activity.startDate}T${activity.endTime}`),
      location: activity.venue?.name,
      attendees: child ? [{
        name: `${child.firstName} ${child.lastName}`,
        email: child.email || ''
      }] : undefined
    };
  }
}

export const calendarService = new CalendarService();
