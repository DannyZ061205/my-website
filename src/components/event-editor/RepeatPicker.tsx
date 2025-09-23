'use client';

import React, { useState } from 'react';

interface RepeatPickerProps {
  value: string;
  eventDate: string; // ISO date string
  onChange: (value: string) => void;
  onClose: () => void;
  onHover?: (label: string | null) => void;
  className?: string;
}

export const RepeatPicker: React.FC<RepeatPickerProps> = ({
  value,
  eventDate,
  onChange,
  onClose,
  onHover,
  className = ''
}) => {
  const [selectedOption, setSelectedOption] = useState(value || 'none');

  // Get day and date info from event
  const date = new Date(eventDate);
  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
  const dayOfMonth = date.getDate();
  const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Calculate which week of month (1st, 2nd, 3rd, 4th, last)
  const weekOfMonth = Math.ceil(dayOfMonth / 7);
  const weekOrdinal = weekOfMonth === 1 ? '1st' : weekOfMonth === 2 ? '2nd' : weekOfMonth === 3 ? '3rd' : weekOfMonth === 4 ? '4th' : 'last';

  const repeatOptions = [
    { value: 'none', label: 'Does not repeat', rrule: '' },
    { value: 'daily', label: 'Every day', rrule: 'FREQ=DAILY' },
    { value: 'weekday', label: 'Every weekday', rrule: 'FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR' },
    { value: 'weekend', label: 'Every weekend day', rrule: 'FREQ=DAILY;BYDAY=SA,SU' },
    { value: 'weekly', label: `Every week on ${dayOfWeek}`, rrule: `FREQ=WEEKLY;BYDAY=${getDayAbbreviation(date.getDay())}` },
    { value: 'biweekly', label: `Every 2 weeks on ${dayOfWeek}`, rrule: `FREQ=WEEKLY;INTERVAL=2;BYDAY=${getDayAbbreviation(date.getDay())}` },
    { value: 'monthly', label: `Every month on the ${dayOfMonth}${getOrdinalSuffix(dayOfMonth)}`, rrule: `FREQ=MONTHLY;BYMONTHDAY=${dayOfMonth}` },
    { value: 'yearly', label: `Every year on ${monthDay}`, rrule: `FREQ=YEARLY` }
  ];

  function getOrdinalSuffix(day: number): string {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  }

  function getDayAbbreviation(dayIndex: number): string {
    const days = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    return days[dayIndex];
  }

  const handleSelect = (option: typeof repeatOptions[0]) => {
    setSelectedOption(option.value);
    // Pass the RRULE string for the selected option
    onChange(option.rrule);
    // Close the dropdown after selection
    onClose();
  };

  // Note: Click outside is handled by usePortalDropdown in PortalRepeatPicker
  // Removing duplicate handler to prevent conflicts

  // Note: Escape key is handled by usePortalDropdown in PortalRepeatPicker
  // Removing duplicate handler to prevent conflicts

  return (
    <div
      className={`repeat-picker bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden ${className}`}
      style={{ width: '240px' }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onMouseLeave={() => {
        if (onHover) onHover(null);
      }}
    >
      <div className="max-h-64 overflow-y-auto scrollbar-hide">
        <style jsx>{`
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}</style>
        {repeatOptions.map((option, index, array) => (
          <div
            key={option.value}
            onClick={(e) => {
              e.stopPropagation();
              handleSelect(option);
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            onMouseEnter={() => {
              if (onHover) onHover(option.label);
            }}
            onMouseLeave={() => {
              if (onHover) onHover(null);
            }}
            className={`px-2 cursor-pointer ${
              index === 0 ? 'pt-2 pb-1' :
              index === array.length - 1 ? 'py-1 pb-2' :
              'py-1'
            }`}
          >
            <div className={`flex items-center px-2 py-2 rounded-md transition-colors ${
              selectedOption === option.value
                ? 'bg-blue-50'
                : 'hover:bg-gray-100'
            }`}>
              <span className="text-gray-700 text-sm flex-1">
                {option.label}
              </span>
              {selectedOption === option.value && (
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};