import { CalendarEvent } from '../services/calendarService';

// Type declarations for Google API
declare global {
  interface Window {
    gapi: any;
  }
}

export interface GoogleCalendarConfig {
  clientId: string;
  apiKey: string;
  discoveryDocs: string[];
  scopes: string;
}

export class GoogleCalendarService {
  private gapi: any = null;
  private isInitialized = false;
  private config: GoogleCalendarConfig;

  constructor(config: GoogleCalendarConfig) {
    this.config = config;
  }

  /**
   * Initialize Google Calendar API
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      // Load Google API script if not already loaded
      if (!window.gapi) {
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = () => {
          window.gapi.load('client:auth2', () => {
            this.gapi = window.gapi;
            this.setupClient();
            resolve();
          });
        };
        script.onerror = reject;
        document.head.appendChild(script);
      } else {
        this.gapi = window.gapi;
        this.setupClient();
        resolve();
      }
    });
  }

  private async setupClient(): Promise<void> {
    try {
      await this.gapi.client.init({
        apiKey: this.config.apiKey,
        clientId: this.config.clientId,
        discoveryDocs: this.config.discoveryDocs,
        scope: this.config.scopes
      });
      this.isInitialized = true;
    } catch (error) {
      console.error('Error initializing Google Calendar API:', error);
      throw error;
    }
  }

  /**
   * Sign in to Google Calendar
   */
  async signIn(): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const authInstance = this.gapi.auth2.getAuthInstance();
      const user = await authInstance.signIn();
      return user.isSignedIn();
    } catch (error) {
      console.error('Error signing in to Google Calendar:', error);
      return false;
    }
  }

  /**
   * Sign out of Google Calendar
   */
  async signOut(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      const authInstance = this.gapi.auth2.getAuthInstance();
      await authInstance.signOut();
    } catch (error) {
      console.error('Error signing out of Google Calendar:', error);
    }
  }

  /**
   * Check if user is signed in
   */
  isSignedIn(): boolean {
    if (!this.isInitialized) return false;
    
    try {
      const authInstance = this.gapi.auth2.getAuthInstance();
      return authInstance.isSignedIn.get();
    } catch (error) {
      return false;
    }
  }

  /**
   * Get user's calendar list
   */
  async getCalendarList(): Promise<any[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const response = await this.gapi.client.calendar.calendarList.list();
      return response.result.items || [];
    } catch (error) {
      console.error('Error fetching calendar list:', error);
      throw error;
    }
  }

  /**
   * Create an event in Google Calendar
   */
  async createEvent(event: CalendarEvent, calendarId: string = 'primary'): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.isSignedIn()) {
      const signedIn = await this.signIn();
      if (!signedIn) {
        throw new Error('User must be signed in to create calendar events');
      }
    }

    const googleEvent = {
      summary: event.title,
      description: event.description || '',
      start: {
        dateTime: event.startDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      end: {
        dateTime: event.endDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      location: event.location || '',
      source: {
        title: 'BookOn',
        url: event.url || window.location.origin
      }
    };

    try {
      const response = await this.gapi.client.calendar.events.insert({
        calendarId: calendarId,
        resource: googleEvent
      });
      return response.result;
    } catch (error) {
      console.error('Error creating Google Calendar event:', error);
      throw error;
    }
  }

  /**
   * Get events from Google Calendar
   */
  async getEvents(calendarId: string = 'primary', timeMin?: Date, timeMax?: Date): Promise<any[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.isSignedIn()) {
      const signedIn = await this.signIn();
      if (!signedIn) {
        throw new Error('User must be signed in to fetch calendar events');
      }
    }

    const params: any = {
      calendarId: calendarId,
      singleEvents: true,
      orderBy: 'startTime'
    };

    if (timeMin) {
      params.timeMin = timeMin.toISOString();
    }
    if (timeMax) {
      params.timeMax = timeMax.toISOString();
    }

    try {
      const response = await this.gapi.client.calendar.events.list(params);
      return response.result.items || [];
    } catch (error) {
      console.error('Error fetching Google Calendar events:', error);
      throw error;
    }
  }

  /**
   * Update an event in Google Calendar
   */
  async updateEvent(eventId: string, event: CalendarEvent, calendarId: string = 'primary'): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.isSignedIn()) {
      throw new Error('User must be signed in to update calendar events');
    }

    const googleEvent = {
      summary: event.title,
      description: event.description || '',
      start: {
        dateTime: event.startDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      end: {
        dateTime: event.endDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      location: event.location || ''
    };

    try {
      const response = await this.gapi.client.calendar.events.update({
        calendarId: calendarId,
        eventId: eventId,
        resource: googleEvent
      });
      return response.result;
    } catch (error) {
      console.error('Error updating Google Calendar event:', error);
      throw error;
    }
  }

  /**
   * Delete an event from Google Calendar
   */
  async deleteEvent(eventId: string, calendarId: string = 'primary'): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.isSignedIn()) {
      throw new Error('User must be signed in to delete calendar events');
    }

    try {
      await this.gapi.client.calendar.events.delete({
        calendarId: calendarId,
        eventId: eventId
      });
    } catch (error) {
      console.error('Error deleting Google Calendar event:', error);
      throw error;
    }
  }
}

// Default configuration - these should be moved to environment variables
const defaultConfig: GoogleCalendarConfig = {
  clientId: process.env.REACT_APP_GOOGLE_CLIENT_ID || '',
  apiKey: process.env.REACT_APP_GOOGLE_API_KEY || '',
  discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
  scopes: 'https://www.googleapis.com/auth/calendar'
};

export const googleCalendarService = new GoogleCalendarService(defaultConfig);
