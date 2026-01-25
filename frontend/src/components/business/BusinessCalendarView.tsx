import React, { useState, useEffect } from 'react';
import { 
  ChevronLeftIcon, 
  ChevronRightIcon,
  CalendarDaysIcon,
  ClockIcon,
  UserGroupIcon,
  CurrencyPoundIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';

interface Session {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'active' | 'cancelled' | 'completed';
  capacity: number;
  bookingsCount: number;
  price: number;
  activity: {
    id: string;
    title: string;
    type: string;
    venue: {
      name: string;
      address: string;
    };
  };
}

interface BusinessCalendarViewProps {
  sessions: Session[];
  onSessionClick: (session: Session) => void;
  onDateClick?: (date: string) => void;
  className?: string;
}

const BusinessCalendarView: React.FC<BusinessCalendarViewProps> = ({
  sessions,
  onSessionClick,
  onDateClick,
  className = ''
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [monthDates, setMonthDates] = useState<Date[]>([]);
  const [sessionsByDate, setSessionsByDate] = useState<{[key: string]: Session[]}>({});

  // Generate calendar dates for current month
  useEffect(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay()); // Start from Sunday
    
    const dates: Date[] = [];
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay())); // End on Saturday
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }
    
    setMonthDates(dates);
  }, [currentMonth]);

  // Group sessions by date
  useEffect(() => {
    const grouped: {[key: string]: Session[]} = {};
    sessions.forEach(session => {
      const dateKey = session.date;
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(session);
    });
    setSessionsByDate(grouped);
  }, [sessions]);

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      case 'completed': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircleIcon className="w-3 h-3" />;
      case 'cancelled': return <XCircleIcon className="w-3 h-3" />;
      case 'completed': return <CheckCircleIcon className="w-3 h-3" />;
      default: return <ClockIcon className="w-3 h-3" />;
    }
  };

  const getCapacityColor = (bookings: number, capacity: number) => {
    const percentage = (bookings / capacity) * 100;
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 70) return 'text-yellow-600';
    return 'text-green-600';
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Calendar Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <button
          onClick={goToPreviousMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeftIcon className="h-5 w-5 text-gray-600" />
        </button>
        
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <CalendarDaysIcon className="h-5 w-5" />
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>
        
        <button
          onClick={goToNextMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronRightIcon className="h-5 w-5 text-gray-600" />
        </button>
      </div>

      {/* Day Names Header */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {dayNames.map(day => (
          <div key={day} className="p-3 text-center text-sm font-medium text-gray-500 bg-gray-50">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
        {monthDates.map((date, index) => {
          const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
          const isToday = formatDate(date) === formatDate(new Date());
          const dateKey = formatDate(date);
          const daySessions = sessionsByDate[dateKey] || [];
          
          return (
            <div
              key={index}
              className={`
                min-h-[120px] border-r border-b border-gray-200 p-2
                ${!isCurrentMonth ? 'bg-gray-50' : 'bg-white'}
                ${isToday ? 'bg-yellow-50' : ''}
                ${onDateClick ? 'cursor-pointer hover:bg-gray-50' : ''}
              `}
              onClick={() => onDateClick && onDateClick(dateKey)}
            >
              <div className={`text-sm font-medium mb-1 ${
                !isCurrentMonth ? 'text-gray-300' : 'text-gray-900'
              }`}>
                {date.getDate()}
              </div>
              
              {/* Sessions for this date */}
              <div className="space-y-1">
                {daySessions.slice(0, 3).map(session => (
                  <div
                    key={session.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSessionClick(session);
                    }}
                    className={`
                      p-1 rounded text-xs cursor-pointer transition-colors
                      ${getStatusColor(session.status)}
                      hover:shadow-sm
                    `}
                  >
                    <div className="flex items-center gap-1 mb-1">
                      {getStatusIcon(session.status)}
                      <span className="font-medium truncate">
                        {session.activity.title}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span>{session.startTime}</span>
                      <span className={getCapacityColor(session.bookingsCount, session.capacity)}>
                        {session.bookingsCount}/{session.capacity}
                      </span>
                    </div>
                    <div className="text-xs opacity-75">
                      £{session.price.toFixed(2)}
                    </div>
                  </div>
                ))}
                
                {/* Show "more" indicator if there are more than 3 sessions */}
                {daySessions.length > 3 && (
                  <div className="text-xs text-gray-500 text-center py-1">
                    +{daySessions.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="p-4 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
            <span className="text-gray-600">Active</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-100 border border-red-300 rounded"></div>
            <span className="text-gray-600">Cancelled</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-100 border border-blue-300 rounded"></div>
            <span className="text-gray-600">Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded"></div>
            <span className="text-gray-600">Today</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessCalendarView;
