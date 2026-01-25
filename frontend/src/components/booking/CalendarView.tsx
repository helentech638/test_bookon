import React, { useState, useEffect } from 'react';
import { 
  ChevronLeftIcon, 
  ChevronRightIcon,
  CalendarDaysIcon
} from '@heroicons/react/24/outline';

interface CalendarViewProps {
  availableDates: string[];
  selectedDates: string[];
  onDateSelect: (date: string) => void;
  onDateDeselect: (date: string) => void;
  excludedDates?: string[];
  className?: string;
  defaultMonth?: Date; // Add default month prop
}

const CalendarView: React.FC<CalendarViewProps> = ({
  availableDates,
  selectedDates,
  onDateSelect,
  onDateDeselect,
  excludedDates = [],
  className = '',
  defaultMonth
}) => {
  const [currentMonth, setCurrentMonth] = useState(defaultMonth || new Date());
  const [monthDates, setMonthDates] = useState<Date[]>([]);

  // Update current month when defaultMonth prop changes
  useEffect(() => {
    if (defaultMonth) {
      setCurrentMonth(defaultMonth);
    }
  }, [defaultMonth]);

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

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const isDateAvailable = (date: Date) => {
    const dateStr = formatDate(date);
    return availableDates.includes(dateStr) && !excludedDates.includes(dateStr);
  };

  const isDateSelected = (date: Date) => {
    return selectedDates.includes(formatDate(date));
  };

  // Check if a date is part of a consecutive selection group
  const getDateGroupInfo = (date: Date) => {
    const dateStr = formatDate(date);
    if (!isDateSelected(date)) return { isStart: false, isEnd: false, isMiddle: false };
    
    const sortedSelectedDates = selectedDates.sort();
    const currentIndex = sortedSelectedDates.indexOf(dateStr);
    
    if (currentIndex === -1) return { isStart: false, isEnd: false, isMiddle: false };
    
    const prevDate = currentIndex > 0 ? sortedSelectedDates[currentIndex - 1] : null;
    const nextDate = currentIndex < sortedSelectedDates.length - 1 ? sortedSelectedDates[currentIndex + 1] : null;
    
    // Check if dates are consecutive
    const isConsecutiveWithPrev = prevDate && 
      new Date(dateStr).getTime() - new Date(prevDate).getTime() === 24 * 60 * 60 * 1000;
    const isConsecutiveWithNext = nextDate && 
      new Date(nextDate).getTime() - new Date(dateStr).getTime() === 24 * 60 * 60 * 1000;
    
    return {
      isStart: !isConsecutiveWithPrev,
      isEnd: !isConsecutiveWithNext,
      isMiddle: isConsecutiveWithPrev && isConsecutiveWithNext
    };
  };

  const handleDateClick = (date: Date) => {
    const dateStr = formatDate(date);
    
    if (!isDateAvailable(date)) return;
    
    if (isDateSelected(date)) {
      onDateDeselect(dateStr);
    } else {
      onDateSelect(dateStr);
    }
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

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className={`bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden ${className}`}>
      {/* Calendar Header */}
      <div className="flex items-center justify-between p-6 bg-gradient-to-r from-teal-50 to-emerald-50 border-b border-gray-100">
        <button
          onClick={goToPreviousMonth}
          className="p-2 hover:bg-white/50 rounded-lg transition-all duration-200 hover:shadow-sm"
        >
          <ChevronLeftIcon className="h-5 w-5 text-gray-600" />
        </button>
        
        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-3">
          <CalendarDaysIcon className="h-6 w-6 text-teal-600" />
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>
        
        <button
          onClick={goToNextMonth}
          className="p-2 hover:bg-white/50 rounded-lg transition-all duration-200 hover:shadow-sm"
        >
          <ChevronRightIcon className="h-5 w-5 text-gray-600" />
        </button>
      </div>

      {/* Day Names Header */}
      <div className="grid grid-cols-7 bg-teal-50/30">
        {dayNames.map(day => (
          <div key={day} className="p-4 text-center text-sm font-semibold text-teal-700 uppercase tracking-wide">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
        {monthDates.map((date, index) => {
          const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
          const isAvailable = isDateAvailable(date);
          const isSelected = isDateSelected(date);
          const isToday = formatDate(date) === formatDate(new Date());
          const groupInfo = getDateGroupInfo(date);
          
          // Determine styling based on selection group
          let selectionClasses = '';
          if (isSelected) {
            if (groupInfo.isStart && groupInfo.isEnd) {
              // Single selected date
              selectionClasses = 'bg-teal-500 text-white rounded-lg';
            } else if (groupInfo.isStart) {
              // Start of group
              selectionClasses = 'bg-teal-500 text-white rounded-l-lg';
            } else if (groupInfo.isEnd) {
              // End of group
              selectionClasses = 'bg-teal-500 text-white rounded-r-lg';
            } else {
              // Middle of group
              selectionClasses = 'bg-teal-500 text-white';
            }
          }
          
          return (
            <button
              key={index}
              onClick={() => handleDateClick(date)}
              disabled={!isAvailable}
              className={`
                relative p-4 text-center border-r border-b border-gray-100 transition-all duration-200
                ${!isCurrentMonth ? 'text-gray-300 bg-gray-50/30' : 'text-gray-800'}
                ${isAvailable && !isSelected ? 'bg-teal-50 hover:bg-teal-100 cursor-pointer border-teal-200' : ''}
                ${!isAvailable ? 'cursor-not-allowed bg-gray-100/50' : ''}
                ${selectionClasses}
                ${isToday && !isSelected ? 'bg-yellow-100 text-yellow-800 font-semibold border-yellow-300' : ''}
                ${!isCurrentMonth ? 'opacity-40' : ''}
                ${isAvailable && !isSelected ? 'hover:shadow-sm hover:border-teal-300' : ''}
              `}
            >
              <div className="text-sm font-medium">{date.getDate()}</div>
              {isToday && !isSelected && (
                <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-yellow-600 rounded-full"></div>
              )}
              {isSelected && (
                <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full"></div>
              )}
            </button>
          );
        })}
      </div>

      {/* Premium Legend */}
      <div className="p-6 bg-gradient-to-r from-gray-50 to-teal-50/30 border-t border-gray-100">
        <div className="flex items-center justify-center gap-8 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-teal-500 rounded-lg"></div>
            <span className="text-gray-700 font-medium">Selected</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-100 border-2 border-yellow-300 rounded-lg"></div>
            <span className="text-gray-700 font-medium">Today</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-teal-50 border-2 border-teal-200 rounded-lg"></div>
            <span className="text-gray-700 font-medium">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-100 border-2 border-gray-300 rounded-lg"></div>
            <span className="text-gray-700 font-medium">Unavailable</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarView;
