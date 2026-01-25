import React, { useState } from 'react';
import { CalendarDaysIcon, CloudArrowDownIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import { CalendarEvent } from '../services/calendarService';
import { calendarService } from '../services/calendarService';
import { googleCalendarService } from '../services/googleCalendarService';
import toast from 'react-hot-toast';

interface CalendarIntegrationProps {
  event: CalendarEvent;
  className?: string;
  buttonText?: string;
  showOptions?: boolean;
}

export const CalendarIntegration: React.FC<CalendarIntegrationProps> = ({
  event,
  className = '',
  buttonText = 'Add to Calendar',
  showOptions = true
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleDownloadICal = () => {
    try {
      calendarService.downloadICalFile(event);
      toast.success('Calendar file downloaded!');
      setIsOpen(false);
    } catch (error) {
      toast.error('Failed to download calendar file');
    }
  };

  const handleOpenInGoogle = () => {
    try {
      calendarService.openInExternalCalendar(event, 'google');
      toast.success('Opening in Google Calendar...');
      setIsOpen(false);
    } catch (error) {
      toast.error('Failed to open in Google Calendar');
    }
  };

  const handleOpenInOutlook = () => {
    try {
      calendarService.openInExternalCalendar(event, 'outlook');
      toast.success('Opening in Outlook...');
      setIsOpen(false);
    } catch (error) {
      toast.error('Failed to open in Outlook');
    }
  };

  const handleOpenInYahoo = () => {
    try {
      calendarService.openInExternalCalendar(event, 'yahoo');
      toast.success('Opening in Yahoo Calendar...');
      setIsOpen(false);
    } catch (error) {
      toast.error('Failed to open in Yahoo Calendar');
    }
  };

  const handleAddToGoogleCalendar = async () => {
    try {
      await googleCalendarService.initialize();
      const signedIn = await googleCalendarService.signIn();
      
      if (signedIn) {
        await googleCalendarService.createEvent(event);
        toast.success('Event added to Google Calendar!');
      } else {
        toast.error('Failed to sign in to Google Calendar');
      }
      setIsOpen(false);
    } catch (error) {
      console.error('Error adding to Google Calendar:', error);
      toast.error('Failed to add to Google Calendar');
    }
  };

  const handleAddToCalendar = async () => {
    try {
      await calendarService.addToCalendar(event);
      toast.success('Added to calendar!');
      setIsOpen(false);
    } catch (error) {
      toast.error('Failed to add to calendar');
    }
  };

  if (!showOptions) {
    return (
      <button
        onClick={handleAddToCalendar}
        className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 ${className}`}
      >
        <CalendarDaysIcon className="w-4 h-4 mr-2" />
        {buttonText}
      </button>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
      >
        <CalendarDaysIcon className="w-4 h-4 mr-2" />
        {buttonText}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-20">
            <div className="py-1">
              <div className="px-4 py-2 text-sm text-gray-700 border-b">
                <strong>Add to Calendar</strong>
              </div>
              
              <button
                onClick={handleAddToGoogleCalendar}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <CalendarDaysIcon className="w-4 h-4 mr-3 text-blue-600" />
                <div>
                  <div className="font-medium">Add to Google Calendar</div>
                  <div className="text-xs text-gray-500">Direct integration</div>
                </div>
              </button>

              <button
                onClick={handleAddToCalendar}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <CloudArrowDownIcon className="w-4 h-4 mr-3 text-teal-600" />
                <div>
                  <div className="font-medium">Download .ics file</div>
                  <div className="text-xs text-gray-500">Works with all calendar apps</div>
                </div>
              </button>

              <button
                onClick={handleOpenInGoogle}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <GlobeAltIcon className="w-4 h-4 mr-3 text-blue-600" />
                <div>
                  <div className="font-medium">Google Calendar (Web)</div>
                  <div className="text-xs text-gray-500">Open in browser</div>
                </div>
              </button>

              <button
                onClick={handleOpenInOutlook}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <GlobeAltIcon className="w-4 h-4 mr-3 text-blue-500" />
                <div>
                  <div className="font-medium">Outlook</div>
                  <div className="text-xs text-gray-500">Open in browser</div>
                </div>
              </button>

              <button
                onClick={handleOpenInYahoo}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <GlobeAltIcon className="w-4 h-4 mr-3 text-purple-600" />
                <div>
                  <div className="font-medium">Yahoo Calendar</div>
                  <div className="text-xs text-gray-500">Open in browser</div>
                </div>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CalendarIntegration;
