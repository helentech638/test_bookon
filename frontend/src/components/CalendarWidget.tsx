import React, { useState, useEffect } from 'react';
import { CalendarIcon, PlusIcon, ClockIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { formatPrice } from '../utils/formatting';
import { CalendarIntegration } from './CalendarIntegration';
import { calendarService, CalendarEvent } from '../services/calendarService';

interface CalendarEventData {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  price?: number;
  type: 'booking' | 'course' | 'session';
}

interface CalendarWidgetProps {
  events?: CalendarEventData[];
  className?: string;
  showAddButton?: boolean;
}

export const CalendarWidget: React.FC<CalendarWidgetProps> = ({
  events = [],
  className = '',
  showAddButton = true
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');

  // Get current month's calendar days
  const getCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }
    
    return days;
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.startDate);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  const getEventsForToday = () => {
    const today = new Date();
    return getEventsForDate(today);
  };

  const handleAddToCalendar = (event: CalendarEventData) => {
    const calendarEvent: CalendarEvent = {
      id: event.id,
      title: event.title,
      description: event.description,
      startDate: new Date(event.startDate),
      endDate: new Date(event.endDate),
      location: event.location,
      url: window.location.origin
    };
    
    calendarService.addToCalendar(calendarEvent);
  };

  const handleExportAllEvents = () => {
    const calendarEvents: CalendarEvent[] = events.map(event => ({
      id: event.id,
      title: event.title,
      description: event.description,
      startDate: new Date(event.startDate),
      endDate: new Date(event.endDate),
      location: event.location,
      url: window.location.origin
    }));
    
    // Create a combined calendar file
    const combinedContent = calendarEvents.map(event => 
      calendarService.generateICalContent(event)
    ).join('\n');
    
    const blob = new Blob([combinedContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'my-calendar.ics';
    link.click();
    URL.revokeObjectURL(url);
  };

  const calendarDays = getCalendarDays();
  const todayEvents = getEventsForToday();

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CalendarIcon className="h-5 w-5 text-teal-600" />
            <h3 className="text-lg font-semibold text-gray-900">Calendar</h3>
          </div>
          <div className="flex items-center space-x-2">
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as 'month' | 'week' | 'day')}
              className="text-sm border border-gray-300 rounded-md px-2 py-1"
            >
              <option value="month">Month</option>
              <option value="week">Week</option>
              <option value="day">Day</option>
            </select>
            {showAddButton && (
              <button
                onClick={handleExportAllEvents}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Export All
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Today's Events */}
      {todayEvents.length > 0 && (
        <div className="p-4 border-b border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Today's Events</h4>
          <div className="space-y-2">
            {todayEvents.slice(0, 3).map((event) => (
              <div key={event.id} className="flex items-center justify-between p-2 bg-teal-50 rounded-md">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{event.title}</p>
                  {event.startTime && (
                    <p className="text-xs text-gray-600 flex items-center">
                      <ClockIcon className="h-3 w-3 mr-1" />
                      {event.startTime}
                    </p>
                  )}
                  {event.location && (
                    <p className="text-xs text-gray-600 flex items-center">
                      <MapPinIcon className="h-3 w-3 mr-1" />
                      {event.location}
                    </p>
                  )}
                </div>
                <CalendarIntegration
                  event={{
                    id: event.id,
                    title: event.title,
                    description: event.description,
                    startDate: new Date(event.startDate),
                    endDate: new Date(event.endDate),
                    location: event.location
                  }}
                  buttonText="Add"
                  showOptions={false}
                />
              </div>
            ))}
            {todayEvents.length > 3 && (
              <p className="text-xs text-gray-500 text-center">
                +{todayEvents.length - 3} more events today
              </p>
            )}
          </div>
        </div>
      )}

      {/* Calendar Grid */}
      <div className="p-4">
        {viewMode === 'month' && (
          <>
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
                className="p-1 hover:bg-gray-100 rounded"
              >
                ←
              </button>
              <h4 className="text-lg font-semibold text-gray-900">
                {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h4>
              <button
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
                className="p-1 hover:bg-gray-100 rounded"
              >
                →
              </button>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, index) => {
                const dayEvents = getEventsForDate(day);
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                const isToday = day.toDateString() === new Date().toDateString();
                
                return (
                  <div
                    key={index}
                    className={`min-h-[60px] p-1 border border-gray-100 ${
                      isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                    } ${isToday ? 'bg-teal-50 border-teal-200' : ''}`}
                  >
                    <div className={`text-xs ${isCurrentMonth ? 'text-gray-900' : 'text-gray-400'} ${
                      isToday ? 'font-bold text-teal-600' : ''
                    }`}>
                      {day.getDate()}
                    </div>
                    {dayEvents.length > 0 && (
                      <div className="mt-1 space-y-1">
                        {dayEvents.slice(0, 2).map((event) => (
                          <div
                            key={event.id}
                            className="text-xs bg-teal-100 text-teal-800 px-1 py-0.5 rounded truncate cursor-pointer hover:bg-teal-200"
                            title={event.title}
                          >
                            {event.title}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-xs text-gray-500">
                            +{dayEvents.length - 2}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {viewMode === 'week' && (
          <div className="text-center text-gray-500 py-8">
            Week view coming soon
          </div>
        )}

        {viewMode === 'day' && (
          <div className="text-center text-gray-500 py-8">
            Day view coming soon
          </div>
        )}
      </div>
    </div>
  );
};
