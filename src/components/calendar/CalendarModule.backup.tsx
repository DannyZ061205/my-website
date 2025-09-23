'use client';

import React, { useState, useRef, useEffect } from 'react';
import { CalendarEvent, Urgency, EventColor } from '@/types';
import { EventContextMenu } from './EventContextMenu';
import { DeleteRecurringModal } from './DeleteRecurringModal';

interface CalendarModuleProps {
  className?: string;
  onToggleLeftPanel?: () => void;
  onToggleRightPanel?: () => void;
  leftPanelVisible?: boolean;
  rightPanelVisible?: boolean;
  showOnlyToday?: boolean;
  onEditEvent?: (event: CalendarEvent) => void;
  events?: CalendarEvent[];
  onUpdateEvents?: (events: CalendarEvent[]) => void;
  selectedEventId?: string;
}

interface EventProps {
  event: CalendarEvent;
  onSelect: (event: CalendarEvent) => void;
  onEdit: (event: CalendarEvent) => void;
  onDragStart: (event: CalendarEvent, e: React.MouseEvent) => void;
  onResizeStart: (event: CalendarEvent, edge: 'top' | 'bottom', e: React.MouseEvent) => void;
  onContextMenu: (event: CalendarEvent, e: React.MouseEvent) => void;
  style: React.CSSProperties;
  isSelected?: boolean;
}

const eventColors: Record<EventColor, { normal: string; dimmed: string }> = {
  blue: {
    normal: 'bg-blue-500 border-blue-600 bg-opacity-100',
    dimmed: 'bg-blue-300 border-blue-400 bg-opacity-80'
  },
  purple: {
    normal: 'bg-purple-500 border-purple-600 bg-opacity-100',
    dimmed: 'bg-purple-300 border-purple-400 bg-opacity-80'
  },
  green: {
    normal: 'bg-green-500 border-green-600 bg-opacity-100',
    dimmed: 'bg-green-300 border-green-400 bg-opacity-80'
  },
  yellow: {
    normal: 'bg-yellow-500 border-yellow-600 bg-opacity-100',
    dimmed: 'bg-yellow-300 border-yellow-400 bg-opacity-80'
  },
  pink: {
    normal: 'bg-pink-500 border-pink-600 bg-opacity-100',
    dimmed: 'bg-pink-300 border-pink-400 bg-opacity-80'
  },
  gray: {
    normal: 'bg-gray-500 border-gray-600 bg-opacity-100',
    dimmed: 'bg-gray-300 border-gray-400 bg-opacity-80'
  },
};

const urgencyIndicators: Record<Urgency, string> = {
  red: '!!!',
  orange: '!!',
  green: '!'
};

// --- helpers to fix the :15 drift -------------------------------------------------
const STEP_MIN = 15;

/** Snap a date's minutes to the grid. */
function snapTime(d: Date, mode: 'floor' | 'ceil' | 'round' = 'round', step = STEP_MIN) {
  const t = new Date(d);
  const mins = t.getHours() * 60 + t.getMinutes();
  let snapped: number;

  if (mode === 'floor') snapped = Math.floor(mins / step) * step;
  else if (mode === 'ceil') snapped = Math.ceil(mins / step) * step;
  else snapped = Math.round(mins / step) * step;

  const h = Math.min(23, Math.floor(snapped / 60));
  const m = Math.min(59, snapped % 60);
  t.setHours(h, m, 0, 0);
  return t;
}
// ----------------------------------------------------------------------------------

const Event: React.FC<EventProps> = ({ event, onSelect, onEdit, onDragStart, onResizeStart, onContextMenu, style, isSelected = false }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [mouseDownPos, setMouseDownPos] = useState<{ x: number; y: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [justCreated, setJustCreated] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Add entrance animation for new events
  useEffect(() => {
    if (event.id && event.id.includes(Date.now().toString().slice(-6))) {
      setJustCreated(true);
      const timer = setTimeout(() => setJustCreated(false), 400);
      return () => clearTimeout(timer);
    }
  }, [event.id]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Check if clicking on resize handles
    const target = e.target as HTMLElement;
    if (target.classList.contains('resize-handle')) {
      return; // Let the resize handle's own mouseDown handler take over
    }

    // Check if the click is within the actual event time bounds
    const eventElement = e.currentTarget as HTMLElement;
    const eventRect = eventElement.getBoundingClientRect();
    const clickY = e.clientY - eventRect.top;

    // Get the actual event duration and height
    const start = new Date(event.start);
    const end = new Date(event.end);
    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    const actualHeight = durationHours * 64; // 64px per hour

    // If click is beyond the actual event time, don't capture it
    if (clickY > actualHeight) {
      return; // Let the click bubble up to create a new event
    }

    e.preventDefault();
    e.stopPropagation();
    setMouseDownPos({ x: e.clientX, y: e.clientY });
    onDragStart(event, e);
  };

  const handleClick = (e: React.MouseEvent) => {
    // Check if clicking on resize handles
    const target = e.target as HTMLElement;
    if (target.classList.contains('resize-handle')) {
      return; // Don't trigger edit when clicking resize handles
    }

    // Check if the click is within the actual event time bounds
    const eventElement = e.currentTarget as HTMLElement;
    const eventRect = eventElement.getBoundingClientRect();
    const clickY = e.clientY - eventRect.top;

    // Get the actual event duration and height
    const start = new Date(event.start);
    const end = new Date(event.end);
    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    const actualHeight = durationHours * 64; // 64px per hour

    // If click is beyond the actual event time, don't handle it
    if (clickY > actualHeight) {
      return;
    }

    // Only trigger edit if we didn't drag (mouse didn't move much)
    if (mouseDownPos) {
      const dragDistance = Math.sqrt(
        Math.pow(e.clientX - mouseDownPos.x, 2) +
        Math.pow(e.clientY - mouseDownPos.y, 2)
      );

      // If mouse moved less than 5 pixels, consider it a click not a drag
      if (dragDistance < 5 && !isResizing) {
        e.stopPropagation();
        onSelect(event);
      }
    } else {
      if (!isResizing) {
        e.stopPropagation();
        onSelect(event);
      }
    }

    setMouseDownPos(null);
    setIsResizing(false);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(event);
  };

  const handleResizeMouseDown = (edge: 'top' | 'bottom') => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    onResizeStart(event, edge, e);
  };

  // Check if event should be dimmed
  const now = new Date();
  const eventStart = new Date(event.start);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const isToday = eventStart >= todayStart && eventStart < todayEnd;
  const shouldDim = !isToday; // Dim everything except today

  const eventColor = event.color
    ? (shouldDim ? eventColors[event.color].dimmed : eventColors[event.color].normal)
    : (shouldDim ? eventColors.blue.dimmed : eventColors.blue.normal);

  const urgencyBorder = event.urgency === 'red' ? 'border-l-red-600 border-l-4' :
                        event.urgency === 'orange' ? 'border-l-orange-600 border-l-4' :
                        event.urgency === 'green' ? 'border-l-green-600 border-l-4' :
                        'border-l-4';

  const startTime = new Date(event.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const endTime = new Date(event.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  // Calculate if event duration is less than 1 hour
  const durationMs = new Date(event.end).getTime() - new Date(event.start).getTime();
  const durationHours = durationMs / (1000 * 60 * 60);
  const needsGradient = durationHours < 1;

  return (
    <div
      className={`absolute rounded-lg shadow-sm text-white text-xs font-medium transition-all duration-200 ease-in-out ${eventColor} ${urgencyBorder} ${
        isSelected ? 'shadow-lg transform scale-[1.02] z-30 ring-2 ring-blue-400 ring-opacity-50' :
        isHovered ? 'shadow-md transform scale-[1.02] z-20' : 'hover:shadow-sm hover:z-10'
      } ${justCreated ? 'event-pop-in' : ''} ${isDeleting ? 'event-pop-out' : ''} group overflow-hidden cursor-pointer`}
      style={style}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(event, e);
      }}
      onMouseEnter={(e) => {
        setIsHovered(true);
        // Add a subtle bounce when hovering
        if (!isSelected) {
          const element = e.currentTarget as HTMLElement;
          element.style.transform = 'scale(1.02) translateY(-1px)';
        }
      }}
      onMouseLeave={(e) => {
        setIsHovered(false);
        if (!isSelected) {
          const element = e.currentTarget as HTMLElement;
          element.style.transform = '';
        }
      }}
      title={`${event.title}\n${startTime} - ${endTime}`}
    >
      {/* Top resize handle */}
      <div
        className={`resize-handle absolute top-0 left-0 right-0 h-2 cursor-n-resize ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-all duration-200 z-10 event-handle`}
        onMouseDown={handleResizeMouseDown('top')}
        style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.3), transparent)' }}
      />

      {/* Event content container with relative positioning for gradient */}
      <div className="relative h-full">
        <div className="p-2 cursor-move h-full flex flex-col overflow-hidden">
          <div className="flex items-center gap-1 mb-1 flex-shrink-0">
            {event.urgency && (
              <span className="text-[10px] font-bold pointer-events-none">
                {event.urgency === 'red' ? '⚠' : event.urgency === 'orange' ? '●' : '○'}
              </span>
            )}
            <div className="font-semibold truncate pointer-events-none">{event.title}</div>
          </div>
          <div className="text-xs opacity-90 pointer-events-none flex-shrink-0">{startTime} - {endTime}</div>
          {event.description && (
            <div className="text-[10px] opacity-80 mt-1 overflow-hidden">
              {event.description}
            </div>
          )}
        </div>

        {/* Gradient fade overlay at bottom - only for events less than 1 hour */}
        {needsGradient && (
          <div
            className="absolute bottom-0 left-0 right-0 h-4 pointer-events-none"
            style={{
              background: `linear-gradient(to top, ${eventColor.includes('bg-blue') ? 'rgba(59, 130, 246, 0.4)' :
                                                     eventColor.includes('bg-purple') ? 'rgba(147, 51, 234, 0.4)' :
                                                     eventColor.includes('bg-green') ? 'rgba(34, 197, 94, 0.4)' :
                                                     eventColor.includes('bg-yellow') ? 'rgba(234, 179, 8, 0.4)' :
                                                     eventColor.includes('bg-pink') ? 'rgba(236, 72, 153, 0.4)' :
                                                     'rgba(107, 114, 128, 0.4)'}, transparent)`
            }}
          />
        )}
      </div>

      {/* Bottom resize handle */}
      <div
        className={`resize-handle absolute bottom-0 left-0 right-0 h-2 cursor-s-resize ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-all duration-200 z-10 event-handle`}
        onMouseDown={handleResizeMouseDown('bottom')}
        style={{ background: 'linear-gradient(to top, rgba(255,255,255,0.3), transparent)' }}
      />
    </div>
  );
};

const MonthViewPopup: React.FC<{
  isVisible: boolean;
  currentDate: Date;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  viewRef: React.RefObject<HTMLDivElement | null>;
  isPinned: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onMonthChange: (date: Date) => void;
  onDateClick: (date: Date) => void;
  onClose: () => void;
}> = ({ isVisible, currentDate, buttonRef, viewRef, isPinned, onMouseEnter, onMouseLeave, onMonthChange, onDateClick, onClose }) => {
  const [fixedPosition, setFixedPosition] = React.useState<{ left: number; top: number } | null>(null);
  const [displayMonth, setDisplayMonth] = React.useState(currentDate);

  React.useEffect(() => {
    if (isVisible && buttonRef.current && !fixedPosition) {
      const rect = buttonRef.current.getBoundingClientRect();
      setFixedPosition({
        left: rect.left + rect.width / 2 - 150,
        top: rect.bottom + 15
      });
    }
    if (!isVisible) {
      setFixedPosition(null);
      setDisplayMonth(currentDate); // Reset to current date when closed
    }
  }, [isVisible, buttonRef, fixedPosition, currentDate]);

  if (!isVisible || !fixedPosition) return null;

  const year = displayMonth.getFullYear();
  const month = displayMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - ((firstDay.getDay() + 6) % 7));

  const days = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    days.push(date);
  }

  const today = new Date();
  const todayStr = today.toDateString();

  return (
    <div
      ref={viewRef}
      className="fixed z-50 bg-blue-800 text-white rounded-lg shadow-2xl p-4 month-view-appear"
      style={{
        left: `${fixedPosition.left}px`,
        top: `${fixedPosition.top}px`,
        width: '300px',
        pointerEvents: 'auto'
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="text-lg font-semibold">
          {displayMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              const newDate = new Date(displayMonth);
              newDate.setFullYear(newDate.getFullYear() - 1);
              setDisplayMonth(newDate);
            }}
            className="p-1 hover:bg-blue-700 rounded transition-all duration-200 btn-playful"
            title="Previous year"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => {
              const newDate = new Date(displayMonth);
              newDate.setMonth(newDate.getMonth() - 1);
              setDisplayMonth(newDate);
            }}
            className="p-1 hover:bg-blue-700 rounded transition-all duration-200 btn-playful"
            title="Previous month"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => {
              const newDate = new Date(displayMonth);
              newDate.setMonth(newDate.getMonth() + 1);
              setDisplayMonth(newDate);
            }}
            className="p-1 hover:bg-blue-700 rounded transition-all duration-200 btn-playful"
            title="Next month"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={() => {
              const newDate = new Date(displayMonth);
              newDate.setFullYear(newDate.getFullYear() + 1);
              setDisplayMonth(newDate);
            }}
            className="p-1 hover:bg-blue-700 rounded transition-all duration-200 btn-playful"
            title="Next year"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-xs">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
          <div key={day} className="text-center py-1 text-blue-200 font-medium">{day}</div>
        ))}

        {days.map((date, index) => {
          const isCurrentMonth = date.getMonth() === month;
          const isToday = date.toDateString() === todayStr;
          const isSelected = date.toDateString() === currentDate.toDateString();

          return (
            <div
              key={index}
              className={`text-center py-1 text-xs cursor-pointer hover:bg-blue-700 rounded transition-all duration-200 btn-playful ${
                !isCurrentMonth ? 'text-blue-300 hover:bg-blue-700/50' :
                isSelected ? 'bg-blue-600 text-white rounded' :
                isToday ? 'bg-white text-blue-800 rounded hover:bg-blue-100 celebrate' :
                'text-white'
              }`}
              onClick={() => {
                onDateClick(date);
                onClose();
              }}
            >
              {date.getDate()}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const CalendarModule: React.FC<CalendarModuleProps> = ({
  className = '',
  showOnlyToday = false,
  onEditEvent,
  events: externalEvents,
  onUpdateEvents,
  selectedEventId
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [highlightedDate, setHighlightedDate] = useState<Date | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const timeColumnRef = useRef<HTMLDivElement>(null);
  const [userTimezone, setUserTimezone] = useState<{ city: string; offset: string }>({
    city: 'NYC',
    offset: 'GMT-4'
  });
  const [internalEvents, setInternalEvents] = useState<CalendarEvent[]>([
    {
      id: '1',
      title: 'Team Meeting',
      start: new Date(2025, 0, 20, 10, 0).toISOString(),
      end: new Date(2025, 0, 20, 11, 0).toISOString(),
      timezone: 'America/New_York',
      urgency: 'orange',
    },
    {
      id: '2',
      title: 'Project Review',
      start: new Date(2025, 0, 20, 14, 0).toISOString(),
      end: new Date(2025, 0, 20, 15, 30).toISOString(),
      timezone: 'America/New_York',
      urgency: 'red',
    },
    {
      id: '3',
      title: 'Lunch Break',
      start: new Date(2025, 0, 21, 12, 0).toISOString(),
      end: new Date(2025, 0, 21, 13, 0).toISOString(),
      timezone: 'America/New_York',
      urgency: 'green',
    },
  ]);


  // Use external events if provided, otherwise use internal
  const events = externalEvents || internalEvents;
  const setEvents = onUpdateEvents || setInternalEvents;

  const [isMonthViewVisible, setIsMonthViewVisible] = useState(false);
  const [isMonthViewPinned, setIsMonthViewPinned] = useState(false);
  const monthButtonRef = useRef<HTMLButtonElement>(null);
  const monthViewRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; time: Date } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ x: number; y: number; time: Date } | null>(null);
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);
  const [dragOffset, setDragOffset] = useState<{ minutes: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeEdge, setResizeEdge] = useState<'top' | 'bottom' | null>(null);
  const [resizedEvent, setResizedEvent] = useState<CalendarEvent | null>(null);
  const [resizePreview, setResizePreview] = useState<{ start: Date; end: Date } | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    event: CalendarEvent;
    position: { x: number; y: number };
  } | null>(null);
  const [clipboard, setClipboard] = useState<{ event: CalendarEvent; isCut: boolean } | null>(null);
  const [focusedEventId, setFocusedEventId] = useState<string | null>(null);
  const [deleteModalEvent, setDeleteModalEvent] = useState<CalendarEvent | null>(null);

  // Swipe state
  const [touchStart, setTouchStart] = useState<{ x: number; time: number } | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwipeTransitioning, setIsSwipeTransitioning] = useState(false);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const weekDays = showOnlyToday
    ? [['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][currentDate.getDay() === 0 ? 6 : currentDate.getDay() - 1]]
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Get the start of the week (Monday) or just today if in narrow view
  const startOfWeek = new Date(currentDate);
  startOfWeek.setDate(currentDate.getDate() - ((currentDate.getDay() + 6) % 7));

  const weekDates = showOnlyToday
    ? [new Date(currentDate)]
    : Array.from({ length: 7 }, (_, i) => {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        return date;
      });

  const today = new Date();
  const todayDateString = today.toDateString();

  const goToToday = () => {
    setCurrentDate(new Date());
    scrollToCurrentTime();
  };

  const scrollToCurrentTime = () => {
    if (scrollContainerRef.current) {
      const currentHour = new Date().getHours();
      const hourHeight = 64; // Height of each hour row
      const scrollPosition = currentHour * hourHeight - 200; // Center it a bit
      scrollContainerRef.current.scrollTo({
        top: Math.max(0, scrollPosition),
        behavior: 'smooth'
      });
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentDate(newDate);
  };

  // Touch event handlers for swipe gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, time: Date.now() });
    setIsSwipeTransitioning(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStart.x;

    // Only allow horizontal swipes, prevent vertical scrolling while swiping
    if (Math.abs(deltaX) > 10) {
      e.preventDefault();
      setSwipeOffset(deltaX);
    }
  };

  const handleTouchEnd = () => {
    if (!touchStart) return;

    const swipeThreshold = 100; // Minimum swipe distance to trigger navigation
    const swipeVelocity = Math.abs(swipeOffset) / (Date.now() - touchStart.time);

    // Check if swipe was significant enough
    if (Math.abs(swipeOffset) > swipeThreshold || swipeVelocity > 0.5) {
      setIsSwipeTransitioning(true);

      if (swipeOffset > 0) {
        // Swiped right - go to previous week
        navigateWeek('prev');
      } else {
        // Swiped left - go to next week
        navigateWeek('next');
      }
    }

    // Reset with animation
    setIsSwipeTransitioning(true);
    setTimeout(() => {
      setSwipeOffset(0);
      setIsSwipeTransitioning(false);
    }, 300);

    setTouchStart(null);
  };

  const navigateYear = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setFullYear(currentDate.getFullYear() + (direction === 'next' ? 1 : -1));
    setCurrentDate(newDate);
  };

  const formatTime = (hour: number) => {
    if (hour === 0) return '12AM';
    if (hour < 12) return `${hour}AM`;
    if (hour === 12) return '12PM';
    return `${hour - 12}PM`;
  };

  /**
   * Get the exact (unsnapped) time from a mouse Y position.
   * We snap later using snapTime() so the start uses floor and the end uses ceil.
   */
  const getTimeFromPosition = (y: number, dayIndex: number): Date => {
    if (!scrollContainerRef.current || !calendarRef.current) return new Date();

    const scrollRect = scrollContainerRef.current.getBoundingClientRect();
    const scrollTop = scrollContainerRef.current.scrollTop;

    // position within scrollable content
    const relativeY = y - scrollRect.top + scrollTop;
    const hourHeight = 64;

    const totalHours = relativeY / hourHeight;
    const totalMinutes = Math.max(0, Math.min(24 * 60 - 1, Math.round(totalHours * 60)));

    const hour = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    const date = new Date(weekDates[dayIndex]);
    date.setHours(hour, minutes, 0, 0);
    return date;
  };

  const handleMouseDown = (e: React.MouseEvent, dayIndex: number) => {
    if (e.button !== 0) return; // Only left click

    // Clear selection when clicking on empty space
    setFocusedEventId(null);

    // SNAP START TIME DOWN to grid -> fixes the "+15 min" start drift
    const time = snapTime(getTimeFromPosition(e.clientY, dayIndex), 'floor');
    setDragStart({ x: e.clientX, y: e.clientY, time });
    setIsDragging(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isResizing && resizedEvent && resizeEdge) {
      // Handle event resizing
      const rect = calendarRef.current?.getBoundingClientRect();
      if (!rect) return;

      const relativeX = e.clientX - rect.left;
      const dayColumnWidth = rect.width / weekDates.length;
      const dayIndex = Math.floor(relativeX / dayColumnWidth);

      if (dayIndex >= 0 && dayIndex < weekDates.length) {
        const mouseTime = getTimeFromPosition(e.clientY, dayIndex);
        const currentStart = new Date(resizedEvent.start);
        const currentEnd = new Date(resizedEvent.end);

        if (resizeEdge === 'top') {
          // Resizing from top - adjust start time
          const newStart = snapTime(mouseTime, 'round');
          // Don't allow start to go past end
          if (newStart < currentEnd) {
            setResizePreview({ start: newStart, end: currentEnd });
          }
        } else {
          // Resizing from bottom - adjust end time
          const newEnd = snapTime(mouseTime, 'round');
          // Don't allow end to go before start
          if (newEnd > currentStart) {
            setResizePreview({ start: currentStart, end: newEnd });
          }
        }
      }
      return;
    }

    if (!isDragging) return;

    if (draggedEvent && dragOffset !== null) {
      // Moving an existing event
      const rect = calendarRef.current?.getBoundingClientRect();
      if (!rect) return;

      const relativeX = e.clientX - rect.left;
      const dayColumnWidth = rect.width / weekDates.length;
      const dayIndex = Math.floor(relativeX / dayColumnWidth);

      if (dayIndex >= 0 && dayIndex < weekDates.length) {
        const mouseTime = getTimeFromPosition(e.clientY, dayIndex);
        const newStartTime = new Date(mouseTime);
        newStartTime.setMinutes(newStartTime.getMinutes() - dragOffset.minutes);

        // for moving an event, rounding feels best
        const snapped = snapTime(newStartTime, 'round');
        setDragEnd({ x: e.clientX, y: e.clientY, time: snapped });
      }
    } else if (dragStart) {
      // Creating a new event
      const rect = calendarRef.current?.getBoundingClientRect();
      if (!rect) return;

      const relativeX = e.clientX - rect.left;
      const dayColumnWidth = rect.width / weekDates.length;
      const dayIndex = Math.floor(relativeX / dayColumnWidth);

      if (dayIndex >= 0 && dayIndex < weekDates.length) {
        // keep raw time and snap later for preview & commit
        const time = getTimeFromPosition(e.clientY, dayIndex);
        setDragEnd({ x: e.clientX, y: e.clientY, time });
      }
    }
  };

  const handleMouseUp = () => {
    if (isResizing && resizedEvent && resizePreview) {
      // Apply the resize
      setEvents(events.map(e =>
        e.id === resizedEvent.id
          ? { ...e, start: resizePreview.start.toISOString(), end: resizePreview.end.toISOString() }
          : e
      ));
    }

    if (isDragging) {
      if (draggedEvent && dragEnd) {
        // Update existing event position
        const originalStart = new Date(draggedEvent.start);
        const originalEnd = new Date(draggedEvent.end);
        const duration = originalEnd.getTime() - originalStart.getTime();

        const newStart = dragEnd.time;
        const newEnd = new Date(newStart.getTime() + duration);

        setEvents(events.map(e =>
          e.id === draggedEvent.id
            ? { ...e, start: newStart.toISOString(), end: newEnd.toISOString() }
            : e
        ));
      } else if (dragStart && dragEnd) {
        // Calculate drag distance to determine if this was a drag or just a click
        const dragDistanceY = Math.abs(dragEnd.y - dragStart.y);
        const dragDistanceX = Math.abs(dragEnd.x - dragStart.x);
        const totalDragDistance = Math.sqrt(dragDistanceX * dragDistanceX + dragDistanceY * dragDistanceY);

        // Only create event if user actually dragged (more than 10 pixels)
        if (totalDragDistance > 10) {
          // Add a subtle vibration for tactile feedback (if supported)
          if (navigator.vibrate) {
            navigator.vibrate(50);
          }
          // Always use the actual drag positions for visual feedback
          const rawStart = new Date(Math.min(dragStart.time.getTime(), dragEnd.time.getTime()));
          const rawEnd = new Date(Math.max(dragStart.time.getTime(), dragEnd.time.getTime()));

          let startTime = snapTime(rawStart, 'floor');
          let endTime = snapTime(rawEnd, 'ceil');

          // Calculate the duration
          const duration = endTime.getTime() - startTime.getTime();

          // If duration is less than 15 minutes, set to 15 minutes minimum
          if (duration < 15 * 60 * 1000) {
            endTime = new Date(startTime.getTime() + 15 * 60 * 1000);
          }

          const newEvent: CalendarEvent = {
            id: Date.now().toString(),
            title: 'New Event',
            start: startTime.toISOString(),
            end: endTime.toISOString(),
            timezone: 'America/New_York',
            color: 'blue',
          };

          // Add with celebration animation
          setEvents([...events, newEvent]);

          // Add a little celebration for the first event
          if (events.length === 0) {
            // Create confetti effect
            const colors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899'];
            for (let i = 0; i < 12; i++) {
              setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.className = 'confetti-particle';
                confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                confetti.style.left = Math.random() * 100 + '%';
                confetti.style.top = Math.random() * 20 + '%';
                document.body.appendChild(confetti);
                setTimeout(() => confetti.remove(), 3000);
              }, i * 50);
            }
          }

          // Set the new event as focused so keyboard shortcuts work immediately
          setFocusedEventId(newEvent.id);

          // Automatically open the event editor for the new event
          if (onEditEvent) {
            onEditEvent(newEvent);
          }
        }
        // If it was just a click (no meaningful drag), don't create an event
      }
    }

    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
    setDraggedEvent(null);
    setDragOffset(null);
    setIsResizing(false);
    setResizeEdge(null);
    setResizedEvent(null);
    setResizePreview(null);
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    // Set focus and open editor on single click
    setFocusedEventId(event.id);
    if (onEditEvent) {
      onEditEvent(event);
    }
  };

  const handleEditEvent = (event: CalendarEvent) => {
    // Also handle double-click (same as single click)
    setFocusedEventId(event.id);
    if (onEditEvent) {
      onEditEvent(event);
    }
  };

  const handleEventDragStart = (event: CalendarEvent, e: React.MouseEvent) => {
    setDraggedEvent(event);
    setIsDragging(true);

    const eventElement = e.currentTarget as HTMLElement;
    const eventRect = eventElement.getBoundingClientRect();

    const clickOffsetY = e.clientY - eventRect.top;
    const clickOffsetPercentage = clickOffsetY / eventRect.height;

    const eventStart = new Date(event.start);
    const eventEnd = new Date(event.end);
    const eventDurationMinutes = (eventEnd.getTime() - eventStart.getTime()) / (1000 * 60);
    const offsetMinutes = Math.round(clickOffsetPercentage * eventDurationMinutes);

    setDragOffset({ minutes: offsetMinutes });
    setDragStart({ x: e.clientX, y: e.clientY, time: eventStart });
  };

  const handleEventResizeStart = (event: CalendarEvent, edge: 'top' | 'bottom', e: React.MouseEvent) => {
    setResizedEvent(event);
    setResizeEdge(edge);
    setIsResizing(true);
    setResizePreview({ start: new Date(event.start), end: new Date(event.end) });
  };

  // Context menu handlers
  const handleEventContextMenu = (event: CalendarEvent, e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({
      event,
      position: { x: e.clientX, y: e.clientY }
    });
  };

  const handleCut = (event: CalendarEvent) => {
    setClipboard({ event, isCut: true });
    // Optionally, visually indicate the cut event
    setEvents(events.map(e => e.id === event.id ? { ...e, opacity: 0.5 } as CalendarEvent : e));
  };

  const handleCopy = (event: CalendarEvent) => {
    setClipboard({ event, isCut: false });
  };

  const handleDuplicate = (event: CalendarEvent) => {
    // Place the duplicate directly after the original event ends
    const originalEnd = new Date(event.end);
    const originalStart = new Date(event.start);
    const duration = originalEnd.getTime() - originalStart.getTime();

    const newEventId = `${event.id}-copy-${Date.now()}`;
    const newEvent: CalendarEvent = {
      ...event,
      id: newEventId,
      title: `${event.title} (copy)`,
      // Start exactly where the original ends (accounting for the 1px gap)
      start: originalEnd.toISOString(),
      end: new Date(originalEnd.getTime() + duration).toISOString()
    };
    setEvents([...events, newEvent]);
    // Select the new duplicated event instead of keeping the original selected
    setFocusedEventId(newEventId);
  };

  const handleDelete = (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    // Check if this event is part of a recurrence group
    if (event.recurrenceGroupId) {
      // Show the delete modal for events in a recurrence group
      setDeleteModalEvent(event);
    } else {
      // Direct delete for non-recurring events
      performDelete(eventId);
    }
  };

  const performDelete = (eventId: string) => {
    // Add deletion animation
    const eventElement = document.querySelector(`[data-event-id="${eventId}"]`);
    if (eventElement) {
      eventElement.classList.add('event-pop-out');
      setTimeout(() => {
        setEvents(events.filter(e => e.id !== eventId));
        if (onEditEvent && selectedEventId === eventId) {
          // Close the event editor if this event is being edited
          onEditEvent(null as any);
        }
      }, 300);
    } else {
      setEvents(events.filter(e => e.id !== eventId));
      if (onEditEvent && selectedEventId === eventId) {
        onEditEvent(null as any);
      }
    }
  };

  const handleDeleteRecurring = (option: 'single' | 'following' | 'all') => {
    if (!deleteModalEvent) return;

    const eventDate = new Date(deleteModalEvent.start);
    const recurrenceGroupId = deleteModalEvent.recurrenceGroupId;

    if (option === 'single') {
      // Delete only this specific occurrence
      performDelete(deleteModalEvent.id);
    } else if (option === 'following') {
      // Delete this and all future occurrences in the group
      const updatedEvents = events.filter(e => {
        if (e.recurrenceGroupId === recurrenceGroupId) {
          const eDate = new Date(e.start);
          return eDate < eventDate;
        }
        return true;
      });
      setEvents(updatedEvents);
    } else if (option === 'all') {
      // Delete all occurrences in the recurrence group
      const updatedEvents = events.filter(e => e.recurrenceGroupId !== recurrenceGroupId);
      setEvents(updatedEvents);
    }

    setDeleteModalEvent(null);
    setContextMenu(null);
  };

  const getEventPosition = (event: CalendarEvent, dayIndex: number) => {
    const start = new Date(event.start);
    const end = new Date(event.end);
    const dayDate = weekDates[dayIndex];

    if (start.toDateString() !== dayDate.toDateString()) return null;

    const hourHeight = 64; // Each hour row is 64px tall
    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;
    const duration = endHour - startHour;

    // Add small gap between adjacent events (1px top and bottom)
    const gapSize = 1;
    const adjustedTop = startHour * hourHeight + gapSize;
    const adjustedHeight = duration * hourHeight - (gapSize * 2);

    return {
      top: `${adjustedTop}px`,
      height: `${Math.max(adjustedHeight, 10)}px`, // Minimum height of 10px
      left: '2px',
      right: '2px',
    };
  };

  const monthYear = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  useEffect(() => {
    scrollToCurrentTime();

    // Get user's timezone and location
    const getTimezoneInfo = () => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const now = new Date();
      const offset = -now.getTimezoneOffset() / 60;
      const offsetStr = offset >= 0 ? `GMT+${offset}` : `GMT${offset}`;

      // Map common timezones to city abbreviations
      const cityMap: Record<string, string> = {
        'America/New_York': 'NYC',
        'America/Chicago': 'CHI',
        'America/Los_Angeles': 'LAX',
        'America/Denver': 'DEN',
        'America/Phoenix': 'PHX',
        'America/Toronto': 'TOR',
        'Europe/London': 'LON',
        'Europe/Paris': 'PAR',
        'Europe/Berlin': 'BER',
        'Asia/Tokyo': 'TYO',
        'Asia/Shanghai': 'SHA',
        'Asia/Hong_Kong': 'HKG',
        'Asia/Singapore': 'SIN',
        'Asia/Dubai': 'DXB',
        'Australia/Sydney': 'SYD',
        'Australia/Melbourne': 'MEL',
        'Pacific/Auckland': 'AKL',
        'America/Sao_Paulo': 'SAO',
        'America/Mexico_City': 'MEX',
        'Europe/Moscow': 'MOW',
        'Asia/Seoul': 'SEL',
        'Asia/Mumbai': 'BOM',
        'Africa/Johannesburg': 'JNB',
        'Africa/Cairo': 'CAI',
      };

      const city = cityMap[timezone] || timezone.split('/').pop()?.slice(0, 3).toUpperCase() || 'UTC';

      setUserTimezone({ city, offset: offsetStr });
    };

    getTimezoneInfo();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Work with either context menu event or focused event
      const targetEvent = contextMenu?.event ||
        (focusedEventId ? events.find(e => e.id === focusedEventId) : null);

      if (!targetEvent) return;

      const isMac = navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

      // Cut: Cmd/Ctrl + X
      if (cmdKey && e.key === 'x') {
        e.preventDefault();
        handleCut(targetEvent);
        setContextMenu(null);
      }
      // Copy: Cmd/Ctrl + C
      else if (cmdKey && e.key === 'c') {
        e.preventDefault();
        handleCopy(targetEvent);
        setContextMenu(null);
      }
      // Duplicate: Cmd/Ctrl + D
      else if (cmdKey && e.key === 'd') {
        e.preventDefault();
        handleDuplicate(targetEvent);
        setContextMenu(null);
      }
      // Delete: Delete or Backspace key
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        // Check if full-screen editor is open - if so, don't handle the delete
        const fullScreenEditor = document.getElementById('event-editor-portal');
        if (fullScreenEditor) {
          return; // Let the editor handle the delete key
        }

        // Check if the user is typing in any input, textarea, or contenteditable element
        const activeElement = document.activeElement;
        if (activeElement && (
          activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.getAttribute('contenteditable') === 'true'
        )) {
          return; // Let the input field handle the delete key
        }

        e.preventDefault();
        handleDelete(targetEvent.id);
        setContextMenu(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu, focusedEventId, events]);

  return (
    <div className={`h-full bg-white flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-blue-200">
        <div className="flex items-center gap-2">
          <button
            ref={monthButtonRef}
            onClick={() => {
              setIsMonthViewPinned(!isMonthViewPinned);
              setIsMonthViewVisible(!isMonthViewPinned);
            }}
            onMouseEnter={() => {
              if (!isMonthViewPinned) setIsMonthViewVisible(true);
            }}
            onMouseLeave={() => {
              if (!isMonthViewPinned) {
                setTimeout(() => {
                  if (!monthViewRef.current?.matches(':hover')) {
                    setIsMonthViewVisible(false);
                  }
                }, 100);
              }
            }}
            className={`text-xl font-bold text-blue-900 transition-all duration-200 px-3 py-1.5 rounded-lg btn-playful ${
              isMonthViewPinned
                ? 'bg-blue-100 text-blue-700 shadow-inner'
                : 'hover:text-blue-600 hover:bg-blue-50'
            }`}
          >
            {monthYear}
          </button>

          {!showOnlyToday && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigateWeek('prev')}
                className="p-1 text-blue-400 hover:text-blue-600 transition-all duration-200 nav-button btn-playful"
                aria-label="Previous week"
                title="Previous week"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => navigateWeek('next')}
                className="p-1 text-blue-400 hover:text-blue-600 transition-all duration-200 nav-button btn-playful"
                aria-label="Next week"
                title="Next week"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {!showOnlyToday && (
          <button
            data-today-button
            onClick={goToToday}
            className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-white border-2 border-blue-500 rounded-lg hover:bg-blue-50 transition-all duration-200 btn-playful button-press"
          >
            Today
          </button>
        )}
      </div>

      {/* Calendar Grid with Fixed Time Column */}
      <div className="flex-1 overflow-hidden flex">
        {/* Fixed Time Column */}
        <div className="w-16 flex-shrink-0 bg-white border-r border-blue-200">
          <div className="h-[60px] border-b border-blue-200 flex flex-col justify-center items-center bg-white">
            <div className="text-xs font-bold text-blue-600">{userTimezone.city}</div>
            <div className="text-[10px] text-blue-500">({userTimezone.offset})</div>
          </div>
          <div
            ref={timeColumnRef}
            className="overflow-hidden"
            style={{
              height: 'calc(100% - 60px)'
            }}
          >
            <div style={{ minHeight: '1536px' }}>
              {hours.map((hour) => (
                <div key={hour} className="h-16 text-xs text-blue-500 relative border-b border-blue-200 group bg-white">
                  {hour !== 0 && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap transition-all duration-200 group-hover:scale-110 group-hover:text-blue-600 group-hover:font-medium">
                      {formatTime(hour)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scrollable Content - vertical only, NO horizontal scroll */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth"
          style={{
            scrollbarWidth: 'thin'
          }}
          onScroll={(e) => {
            // Direct DOM manipulation for instant sync
            const scrollTop = e.currentTarget.scrollTop;
            if (timeColumnRef.current) {
              const timeContent = timeColumnRef.current.firstElementChild as HTMLElement;
              if (timeContent) {
                timeContent.style.transform = `translateY(${-scrollTop}px)`;
              }
            }
          }}
        >
          <div
            className="w-full"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div
              ref={calendarRef}
              className="relative w-full"
              style={{
                transform: `translateX(${swipeOffset}px)`,
                transition: isSwipeTransitioning ? 'transform 0.3s ease-out' : 'none'
              }}
            >
              {/* Date Headers */}
              <div className="sticky top-0 z-10 bg-white border-b border-blue-200 flex h-[60px] w-full">
              {weekDates.map((date, index) => {
                const isToday = date.toDateString() === todayDateString;
                const isHighlighted = highlightedDate && date.toDateString() === highlightedDate.toDateString();
                return (
                  <div
                    key={index}
                    className={`flex-1 p-2 text-center border-r border-blue-100 last:border-r-0 relative transition-all duration-500 ${
                      isHighlighted ? 'bg-blue-100/50' : ''
                    }`}
                  >
                    <div className="text-xs text-blue-500 font-medium">{weekDays[index]}</div>
                    <div className={`text-lg font-semibold transition-all duration-500 ${
                      isHighlighted ? 'text-blue-700 scale-105 celebrate' : isToday ? 'text-blue-700' : 'text-blue-900'
                    }`}>
                      {date.getDate()}
                    </div>
                  </div>
                );
              })}
                </div>

                {/* Time Grid */}
                <div className="relative" style={{ minHeight: '1536px' }}>
              {hours.map((hour) => (
                <div key={hour} className="flex">
                  {weekDates.map((date, dayIndex) => {
                    const isToday = date.toDateString() === todayDateString;
                    return (
                      <div
                        key={dayIndex}
                        className={`flex-1 border-r border-b border-blue-100 last:border-r-0 relative transition-all duration-300 hover:bg-blue-50 ${
                          isToday ? 'bg-blue-50/30' : ''
                        }`}
                        style={{ height: '64px' }}
                        onMouseDown={(e) => handleMouseDown(e, dayIndex)}
                      >
                        {/* Current time indicator */}
                        {isToday && hour === new Date().getHours() && (
                          <div className="absolute left-0 right-0 h-0.5 bg-red-500 z-20" style={{
                            top: `${(new Date().getMinutes() / 60) * 64}px`
                          }}>
                            <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-red-500 rounded-full"></div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

                {/* Empty state */}
            {events.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="empty-state p-8 text-center empty-state-float">
                  <div className="mb-4">
                    <svg className="w-16 h-16 mx-auto text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3a1 1 0 011-1h6a1 1 0 011 1v4m4 0v10a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h12zM9 11h6M9 15h6" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-600 mb-2">Your calendar is waiting for magic ✨</h3>
                  <p className="text-gray-500 mb-4">Drag anywhere to create your first event and bring it to life!</p>
                  <div className="flex justify-center gap-2">
                    <span className="inline-block w-2 h-2 bg-blue-400 rounded-full loading-dot"></span>
                    <span className="inline-block w-2 h-2 bg-purple-400 rounded-full loading-dot"></span>
                    <span className="inline-block w-2 h-2 bg-green-400 rounded-full loading-dot"></span>
                  </div>
                </div>
              </div>
            )}

                {/* Events layer */}
            <div className="absolute inset-0 pointer-events-none">
              {weekDates.map((_, dayIndex) => {
                const totalWidth = calendarRef.current?.offsetWidth || 800;
                const dayColumnWidth = totalWidth / weekDates.length;
                const left = dayIndex * dayColumnWidth;

                return (
                  <div key={dayIndex} className="absolute top-0 bottom-0" style={{ left: `${left}px`, width: `${dayColumnWidth}px` }}>
                    {events.map((event) => {
                      const position = getEventPosition(event, dayIndex);
                      if (!position) return null;
                      const isBeingDragged = draggedEvent?.id === event.id;
                      const isBeingResized = resizedEvent?.id === event.id;

                      return (
                        <div
                          key={event.id}
                          data-event-id={event.id}
                          className="absolute pointer-events-auto"
                          style={{ ...position, opacity: isBeingDragged || isBeingResized ? 0.3 : 1 }}
                        >
                          <Event
                            event={isBeingResized && resizePreview ? { ...event, start: resizePreview.start.toISOString(), end: resizePreview.end.toISOString() } : event}
                            onSelect={handleSelectEvent}
                            onEdit={handleEditEvent}
                            onDragStart={handleEventDragStart}
                            onResizeStart={handleEventResizeStart}
                            onContextMenu={handleEventContextMenu}
                            style={{ width: '100%', height: '100%' }}
                            isSelected={selectedEventId === event.id || focusedEventId === event.id}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
                </div>
              </div>

                {/* Resize Preview */}
                {isResizing && resizedEvent && resizePreview && (() => {
              const dayIndex = weekDates.findIndex(date =>
                date.toDateString() === new Date(resizedEvent.start).toDateString()
              );
              if (dayIndex < 0) return null;

              const position = getEventPosition(
                { ...resizedEvent, start: resizePreview.start.toISOString(), end: resizePreview.end.toISOString() },
                dayIndex
              );
              if (!position) return null;

              const totalWidth = calendarRef.current?.offsetWidth || 800;
              const dayColumnWidth = totalWidth / weekDates.length;
              const left = (dayIndex * dayColumnWidth) + 2;

              const color = resizedEvent.color || 'blue';
              const resizeColor = color === 'purple'
                ? 'bg-purple-400/50 border-purple-500'
                : color === 'green'
                ? 'bg-green-400/50 border-green-500'
                : color === 'yellow'
                ? 'bg-yellow-400/50 border-yellow-500'
                : color === 'pink'
                ? 'bg-pink-400/50 border-pink-500'
                : color === 'gray'
                ? 'bg-gray-400/50 border-gray-500'
                : 'bg-blue-400/50 border-blue-500';

              // Add urgency border if present
              const urgencyBorder = resizedEvent.urgency === 'red' ? 'border-l-red-600' :
                                    resizedEvent.urgency === 'orange' ? 'border-l-orange-600' :
                                    resizedEvent.urgency === 'green' ? 'border-l-green-600' :
                                    '';

              return (
                <div
                  className={`absolute ${resizeColor} ${urgencyBorder} border-l-4 rounded pointer-events-none opacity-70 event-creating`}
                  style={{
                    left: `${left}px`,
                    top: position.top,
                    width: `${dayColumnWidth - 4}px`,
                    height: position.height
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs text-white font-medium">
                      Resizing
                    </span>
                  </div>
                </div>
              );
            })()}

                {/* Drag Preview */}
                {isDragging && dragEnd && (() => {
              const rect = calendarRef.current?.getBoundingClientRect();
              const scrollRect = scrollContainerRef.current?.getBoundingClientRect();
              if (!rect || !scrollRect) return null;

              const relativeX = dragEnd.x - rect.left;
              const dayColumnWidth = showOnlyToday ? rect.width : 200;
              const dayIndex = Math.floor(relativeX / dayColumnWidth);

              if (dayIndex < 0 || dayIndex >= weekDates.length) return null;

              const left = (dayIndex * dayColumnWidth) + 2;
              const width = dayColumnWidth - 4;

              let top: number, height: number;

              if (draggedEvent) {
                const newTime = dragEnd.time;
                const originalStart = new Date(draggedEvent.start);
                const originalEnd = new Date(draggedEvent.end);
                const duration = (originalEnd.getTime() - originalStart.getTime()) / (1000 * 60 * 60);

                const startHour = newTime.getHours() + newTime.getMinutes() / 60;
                top = startHour * 64;
                height = duration * 64;
              } else if (dragStart) {
                // Show the actual drag range for visual feedback
                const rawStart = new Date(Math.min(dragStart.time.getTime(), dragEnd.time.getTime()));
                const rawEnd = new Date(Math.max(dragStart.time.getTime(), dragEnd.time.getTime()));

                // Snap to grid but don't enforce minimum duration for preview
                const startTime = snapTime(rawStart, 'floor');
                const endTime = snapTime(rawEnd, 'ceil');

                const startHour = startTime.getHours() + startTime.getMinutes() / 60;
                const endHour = endTime.getHours() + endTime.getMinutes() / 60;

                top = startHour * 64;
                // Show at least a thin line (8px) even for very short drags
                height = Math.max((endHour - startHour) * 64, 8);
              } else {
                return null;
              }

              // Check if the new position should be dimmed
              const now = new Date();
              const dragTime = draggedEvent ? dragEnd.time : (dragStart && dragEnd ?
                new Date(Math.min(dragStart.time.getTime(), dragEnd.time.getTime())) : now);
              const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

              const isToday = dragTime >= todayStart && dragTime < todayEnd;
              const shouldDim = !isToday; // Dim everything except today

              const color = draggedEvent?.color ?? 'blue';
              const bgColor = shouldDim
                ? (color === 'purple'
                  ? 'bg-purple-300/50 border-purple-400'
                  : color === 'green'
                  ? 'bg-green-300/50 border-green-400'
                  : color === 'yellow'
                  ? 'bg-yellow-300/50 border-yellow-400'
                  : color === 'pink'
                  ? 'bg-pink-300/50 border-pink-400'
                  : color === 'gray'
                  ? 'bg-gray-300/50 border-gray-400'
                  : 'bg-blue-300/50 border-blue-400')
                : (color === 'purple'
                  ? 'bg-purple-400/50 border-purple-500'
                  : color === 'green'
                  ? 'bg-green-400/50 border-green-500'
                  : color === 'yellow'
                  ? 'bg-yellow-400/50 border-yellow-500'
                  : color === 'pink'
                  ? 'bg-pink-400/50 border-pink-500'
                  : color === 'gray'
                  ? 'bg-gray-400/50 border-gray-500'
                  : 'bg-blue-400/50 border-blue-500');

              return (
                <div
                  className={`absolute ${bgColor} border-l-4 rounded pointer-events-none opacity-70 event-creating`}
                  style={{ left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` }}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs text-white font-medium">
                      {draggedEvent ? 'Moving' : 'Creating'}
                    </span>
                  </div>
                </div>
              );
            })()}
            </div>
          </div>
        </div>
      </div>

      <MonthViewPopup
        isVisible={isMonthViewVisible || isMonthViewPinned}
        currentDate={currentDate}
        buttonRef={monthButtonRef}
        viewRef={monthViewRef}
        isPinned={isMonthViewPinned}
        onMouseEnter={() => {
          if (!isMonthViewPinned) setIsMonthViewVisible(true);
        }}
        onMouseLeave={() => {
          if (!isMonthViewPinned) {
            setTimeout(() => {
              if (!monthButtonRef.current?.matches(':hover')) {
                setIsMonthViewVisible(false);
              }
            }, 100);
          }
        }}
        onMonthChange={setCurrentDate}
        onDateClick={(date) => {
          setCurrentDate(date);
          setHighlightedDate(date);
          // Add a little celebration when navigating to a new date
          if (navigator.vibrate) {
            navigator.vibrate(30);
          }
          // Clear highlight after animation
          setTimeout(() => setHighlightedDate(null), 3000);
        }}
        onClose={() => {
          setIsMonthViewPinned(false);
          setIsMonthViewVisible(false);
        }}
      />

      {/* Context Menu */}
      {contextMenu && (
        <EventContextMenu
          event={contextMenu.event}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onCut={handleCut}
          onCopy={handleCopy}
          onDuplicate={handleDuplicate}
          onDelete={(event) => handleDelete(event.id)}
        />
      )}

      {/* Delete Recurring Modal */}
      {deleteModalEvent && (
        <DeleteRecurringModal
          event={deleteModalEvent}
          onClose={() => setDeleteModalEvent(null)}
          onDelete={handleDeleteRecurring}
        />
      )}
    </div>
  );
};