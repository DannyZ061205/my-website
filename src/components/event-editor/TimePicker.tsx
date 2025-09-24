'use client';

import React, { useState, useRef, useEffect } from 'react';

interface TimePickerProps {
  value: string; // Time in ISO format
  onChange: (time: string) => void;
  onClose: () => void;
  onHover?: (time: string | null) => void;
  className?: string;
}

export const TimePicker: React.FC<TimePickerProps> = ({
  value,
  onChange,
  onClose,
  onHover,
  className = ''
}) => {
  // Initialize state with the formatted time value
  const getInitialValue = () => {
    const date = new Date(value);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const h = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    const m = minutes.toString().padStart(2, '0');
    const ampm = hours < 12 ? 'AM' : 'PM';
    return `${h}:${m} ${ampm}`;
  };

  const [inputValue, setInputValue] = useState(getInitialValue);
  const [filteredTimes, setFilteredTimes] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);


  // Generate time options in 15-minute intervals
  const generateTimeOptions = () => {
    const times = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const m = minute.toString().padStart(2, '0');
        const ampm = hour < 12 ? 'AM' : 'PM';
        times.push(`${h}:${m} ${ampm}`);
      }
    }
    return times;
  };

  const allTimes = generateTimeOptions();

  // Initialize filtered times on mount
  useEffect(() => {
    const date = new Date(value);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const h = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    const ampm = hours < 12 ? 'AM' : 'PM';

    // Show nearby times on initial load
    const currentTimeIndex = allTimes.findIndex(t => {
      const [time, period] = t.split(' ');
      const [tHour, tMin] = time.split(':').map(Number);
      return tHour === h && tMin === Math.floor(minutes / 15) * 15 && period === ampm;
    });

    if (currentTimeIndex >= 0) {
      // Show times around the current time
      const startIdx = Math.max(0, currentTimeIndex - 2);
      const endIdx = Math.min(allTimes.length, startIdx + 10);
      setFilteredTimes(allTimes.slice(startIdx, endIdx));
    } else {
      // Default to showing morning times
      setFilteredTimes(allTimes.slice(0, 10));
    }
  }, []); // Only run once on mount

  // Track if this is the initial load
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Filter times based on input
  useEffect(() => {
    // Skip filtering only on the very first load
    if (isInitialLoad) {
      setIsInitialLoad(false);
      return;
    }

    const searchTerm = inputValue.trim().toLowerCase();

    // If input is empty after user interaction, show default times
    if (searchTerm === '') {
      const date = new Date(value);
      const hours = date.getHours();
      const h = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      const ampm = hours < 12 ? 'AM' : 'PM';

      // Find current time in the list
      const currentTimeIndex = allTimes.findIndex(t => {
        const [time, period] = t.split(' ');
        const [tHour] = time.split(':').map(Number);
        return tHour === h && period === ampm;
      });

      if (currentTimeIndex >= 0) {
        const startIdx = Math.max(0, currentTimeIndex - 2);
        const endIdx = Math.min(allTimes.length, startIdx + 10);
        setFilteredTimes(allTimes.slice(startIdx, endIdx));
      } else {
        setFilteredTimes(allTimes.slice(0, 10));
      }
    } else {

      // Check if user typed a specific time format
      const timeMatch = searchTerm.match(/^(\d{1,2}):?(\d{0,2})\s*(am|pm)?$/);

      if (timeMatch) {
        const hours = parseInt(timeMatch[1], 10);
        const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
        const ampm = timeMatch[3];

        if (ampm) {
          // User specified AM/PM, filter accordingly
          const filtered = allTimes.filter(time =>
            time.toLowerCase().includes(searchTerm)
          );
          setFilteredTimes(filtered.length > 0 ? filtered : []);
        } else if (hours >= 1 && hours <= 12) {
          // No AM/PM specified, show both options
          const minuteStr = minutes.toString().padStart(2, '0');
          const amOption = `${hours}:${minuteStr} AM`;
          const pmOption = `${hours}:${minuteStr} PM`;

          // If user typed specific minutes (e.g., "8:23"), only show exact matches
          if (timeMatch[2] && timeMatch[2].length > 0) {
            // User specified exact minutes, only show AM and PM for this exact time
            setFilteredTimes([amOption, pmOption]);
          } else {
            // User only typed hour (e.g., "8"), show multiple options
            const filtered = allTimes.filter(time => {
              const [t, period] = time.split(' ');
              const [h] = t.split(':').map(Number);
              return h === hours;
            });
            setFilteredTimes(filtered.slice(0, 10));
          }
        } else {
          // Hours > 12 or other patterns, use general filtering
          const filtered = allTimes.filter(time => {
            const cleanTime = time.toLowerCase().replace(/[^0-9apm]/g, '');
            const cleanSearch = searchTerm.replace(/[^0-9apm]/g, '');
            return cleanTime.includes(cleanSearch);
          });
          setFilteredTimes(filtered.length > 0 ? filtered.slice(0, 10) : []);
        }
      } else {
        // General text search
        const filtered = allTimes.filter(time =>
          time.toLowerCase().includes(searchTerm)
        );
        setFilteredTimes(filtered.length > 0 ? filtered.slice(0, 10) : allTimes.slice(0, 10));
      }
    }
    setSelectedIndex(0);
  }, [inputValue]);

  // Parse time string and update the date
  const parseAndSetTime = (timeStr: string) => {
    const cleanTime = timeStr.trim().toUpperCase();
    const match = cleanTime.match(/(\d{1,2}):?(\d{0,2})\s*(AM|PM)?/);

    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = match[2] ? parseInt(match[2], 10) : 0;
      const ampm = match[3];

      // Handle AM/PM
      if (ampm === 'PM' && hours !== 12) {
        hours = hours + 12;
      } else if (ampm === 'AM' && hours === 12) {
        hours = 0;
      } else if (!ampm) {
        // If no AM/PM specified and it's ambiguous (1-12),
        // we should have already shown both options in the dropdown
        // The user's selection will have AM/PM specified
      }

      // Validate hours
      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        const newDate = new Date(value);
        newDate.setHours(hours, minutes, 0, 0);
        onChange(newDate.toISOString());
        // Close the dropdown after selection
        onClose();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredTimes.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredTimes[selectedIndex]) {
        parseAndSetTime(filteredTimes[selectedIndex]);
      } else {
        parseAndSetTime(inputValue);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  // Scroll selected item into view within the dropdown only
  useEffect(() => {
    const container = containerRef.current?.querySelector('.scrollbar-hide');
    const selectedElement = container?.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement;

    if (container && selectedElement) {
      // Calculate scroll position manually to avoid page jumps
      const containerRect = container.getBoundingClientRect();
      const elementRect = selectedElement.getBoundingClientRect();

      // Only scroll if element is outside visible area
      if (elementRect.top < containerRect.top) {
        container.scrollTop -= containerRect.top - elementRect.top;
      } else if (elementRect.bottom > containerRect.bottom) {
        container.scrollTop += elementRect.bottom - containerRect.bottom;
      }
    }
  }, [selectedIndex]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Focus input on mount without scrolling
  useEffect(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
      inputRef.current?.select();
    });
  }, []);

  return (
    <div
      ref={containerRef}
      className={`time-picker absolute z-50 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden ${className}`}
      style={{ width: '180px' }}
      onMouseLeave={() => {
        if (onHover) onHover(null);
      }}
    >
      <div className="p-2 border-b border-gray-100">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full px-2 py-1 text-sm text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Type time..."
        />
      </div>
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
        {filteredTimes.map((time, index, array) => (
          <div
            key={time}
            data-index={index}
            onClick={() => parseAndSetTime(time)}
            onMouseEnter={() => {
              setSelectedIndex(index);
              if (onHover) onHover(time);
            }}
            onMouseLeave={() => {
              if (onHover) onHover(null);
            }}
            className={`px-2 cursor-pointer ${
              index === 0 ? 'pt-2' :
              index === array.length - 1 ? 'pb-2' :
              ''
            }`}
          >
            <div className={`px-2 py-2 rounded-md transition-colors ${
              index === selectedIndex
                ? 'bg-blue-50'
                : 'hover:bg-gray-100'
            }`}>
              <span className="text-gray-700 text-sm">{time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};