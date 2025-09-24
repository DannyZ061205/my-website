'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { CalendarEvent, EventColor } from '@/types';
import { EventContextMenu } from './EventContextMenu';
import { EditRecurringModal } from './EditRecurringModal';
import { DeleteRecurringModal } from './DeleteRecurringModal';
import { getEventsWithVirtual } from '@/utils/recurrence';

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
  onCloseEvent?: () => void;
  deletingEventIds?: Set<string>;
  calendarEvents?: CalendarEvent[];
  onEventUpdate?: (events: CalendarEvent[]) => void;
  onDeleteEvent?: (eventId: string) => void;
  onToggleShowOnlyToday?: () => void;
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
  isDeleting?: boolean;
  continuesFromPreviousDay?: boolean;
  continuesToNextDay?: boolean;
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

// Urgency indicators - commented out as not currently used
// const urgencyIndicators: Record<Urgency, string> = {
//   red: '!!!',
//   orange: '!!',
//   green: '!'
// };

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

const Event: React.FC<EventProps> = ({ event, onSelect, onEdit, onDragStart, onResizeStart, onContextMenu, style, isSelected = false, isDeleting = false, continuesFromPreviousDay = false, continuesToNextDay = false }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [, setMouseDownPos] = useState<{ x: number; y: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [justCreated, setJustCreated] = useState(false);

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

    // Prevent text selection during drag
    e.preventDefault();
    e.stopPropagation();
    setMouseDownPos({ x: e.clientX, y: e.clientY });

    // Select the event immediately on mousedown to prevent flicker
    onSelect(event);

    onDragStart(event, e);
  };

  const handleClick = (e: React.MouseEvent) => {
    console.log('=== CLICK FIRED ===');
    console.log('Event clicked:', event);
    console.log('onEdit function exists?', !!onEdit);
    console.log('onSelect function exists?', !!onSelect);

    // Check if clicking on resize handles
    const target = e.target as HTMLElement;
    if (target.classList.contains('resize-handle')) {
      console.log('Clicked on resize handle, returning');
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
      console.log('Click beyond event bounds, returning');
      return;
    }

    // Call onSelect first (which will trigger handleSelectEvent)
    if (onSelect) {
      console.log('Calling onSelect from Event handleClick');
      onSelect(event);
    }

    // Don't call onEdit here - let handleSelectEvent do it
    // The flow should be: click -> onSelect -> handleSelectEvent -> onEditEvent

    // Stop propagation to prevent other handlers
    if (!isResizing) {
      e.stopPropagation();
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

  // Get the ring color based on event color
  const ringColor = event.color === 'purple' ? 'ring-purple-400' :
                    event.color === 'green' ? 'ring-green-400' :
                    event.color === 'yellow' ? 'ring-yellow-400' :
                    event.color === 'pink' ? 'ring-pink-400' :
                    event.color === 'gray' ? 'ring-gray-400' :
                    'ring-blue-400';

  const startTime = new Date(event.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const endTime = new Date(event.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  // Calculate if event duration is less than 1 hour
  const durationMs = new Date(event.end).getTime() - new Date(event.start).getTime();
  const durationHours = durationMs / (1000 * 60 * 60);
  const needsGradient = durationHours < 1;

  // Determine border radius based on continuation
  const borderRadius = continuesFromPreviousDay && continuesToNextDay
    ? '' // No rounding on either end
    : continuesFromPreviousDay
    ? 'rounded-b-lg' // Round only bottom
    : continuesToNextDay
    ? 'rounded-t-lg' // Round only top
    : 'rounded-lg'; // Round all corners (default)

  return (
    <div
      className={`absolute ${borderRadius} shadow-sm text-white text-xs font-medium transition-all duration-200 ease-in-out ${eventColor} ${urgencyBorder} ${
        isSelected ? `shadow-lg transform scale-[1.02] z-30 ring-2 ${ringColor} ring-opacity-50` :
        isHovered ? 'transform scale-[1.01] z-10' : 'z-10'
      } ${justCreated ? 'event-pop-in' : ''} ${isDeleting ? 'event-pop-out' : ''} group overflow-hidden cursor-pointer`}
      style={style}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(event, e);
      }}
      onMouseEnter={() => {
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
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
}> = ({ isVisible, currentDate, buttonRef, viewRef, onMouseEnter, onMouseLeave, onDateClick, onClose }) => {
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
  selectedEventId,
  onCloseEvent,
  deletingEventIds: externalDeletingEventIds,
  calendarEvents,
  onEventUpdate,
  onDeleteEvent,
  onToggleShowOnlyToday
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [highlightedDate, setHighlightedDate] = useState<Date | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // const timeColumnRef = useRef<HTMLDivElement>(null); // Commented out - not currently used
  const [userTimezone, setUserTimezone] = useState<{ city: string; offset: string }>({
    city: 'NYC',
    offset: 'GMT-4'
  });
  const [internalEvents, setInternalEvents] = useState<CalendarEvent[]>([]);
  const [internalDeletingEventIds, setInternalDeletingEventIds] = useState<Set<string>>(new Set());

  // Track container dimensions for proper event positioning
  const [containerWidth, setContainerWidth] = useState(0);

  // Merge external and internal deletingEventIds
  const deletingEventIds = new Set([
    ...(externalDeletingEventIds || []),
    ...internalDeletingEventIds
  ]);

  // Track appearing events for animation
  const [appearingEventIds, setAppearingEventIds] = useState<Set<string>>(new Set());
  // Track daily recurring events for wave animation
  const [dailyRecurringAnimIds, setDailyRecurringAnimIds] = useState<Set<string>>(new Set());
  // Track daily recurring events that have completed animation
  const [dailyRecurringCompletedIds, setDailyRecurringCompletedIds] = useState<Set<string>>(new Set());


  // Use external events if provided, otherwise use internal
  const baseEvents = calendarEvents || externalEvents || internalEvents;

  // Helper to ensure we never persist virtual events
  const setEventsFiltered = (newEvents: CalendarEvent[] | ((prev: CalendarEvent[]) => CalendarEvent[])) => {
    const handler = onEventUpdate || onUpdateEvents || setInternalEvents;
    if (typeof newEvents === 'function') {
      (handler as React.Dispatch<React.SetStateAction<CalendarEvent[]>>)((prev: CalendarEvent[]) => {
        const updated = newEvents(prev);
        // Filter out any virtual events - they should never be persisted
        return updated.filter(e => !e.isVirtual);
      });
    } else {
      // Filter out any virtual events - they should never be persisted
      handler(newEvents.filter(e => !e.isVirtual));
    }
  };

  const setEvents = setEventsFiltered;

  const [isMonthViewVisible, setIsMonthViewVisible] = useState(false);
  const [isMonthViewPinned, setIsMonthViewPinned] = useState(false);
  const monthButtonRef = useRef<HTMLButtonElement>(null);
  const monthViewRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; time: Date } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ x: number; y: number; time: Date } | null>(null);
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);
  const [justFinishedDragging, setJustFinishedDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ minutes: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeEdge, setResizeEdge] = useState<'top' | 'bottom' | null>(null);
  const [resizedEvent, setResizedEvent] = useState<CalendarEvent | null>(null);
  const [resizePreview, setResizePreview] = useState<{ start: Date; end: Date } | null>(null);
  const [hideWelcome, setHideWelcome] = useState(false);
  const [hasCreatedFirstEvent, setHasCreatedFirstEvent] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    event: CalendarEvent;
    position: { x: number; y: number };
  } | null>(null);
  const [clipboard, setClipboard] = useState<{ event: CalendarEvent; isCut: boolean } | null>(null);
  const [cutEventId, setCutEventId] = useState<string | null>(null);
  const [lastMousePosition, setLastMousePosition] = useState<{ x: number; y: number; dayIndex: number } | null>(null);

  // Modal for editing recurring events
  const [editRecurringModal, setEditRecurringModal] = useState<{
    event: CalendarEvent;
    action: 'move' | 'resize';
    newStart?: Date;
    newEnd?: Date;
  } | null>(null);

  // Modal for deleting recurring events
  const [deleteRecurringModal, setDeleteRecurringModal] = useState<{
    event: CalendarEvent;
    onDelete: (option: 'single' | 'following' | 'all') => void;
  } | null>(null);
  const mousePositionRef = useRef<{ x: number; y: number; dayIndex: number } | null>(null);
  const [focusedEventId, setFocusedEventId] = useState<string | null>(null);

  // History for undo/redo
  const [history, setHistory] = useState<CalendarEvent[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isSearchHovered, setIsSearchHovered] = useState(false);

  // Swipe state
  const [touchStart, setTouchStart] = useState<{ x: number; time: number } | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwipeTransitioning, setIsSwipeTransitioning] = useState(false);

  // Track if we're in an undo/redo operation
  const [isUndoRedoOperation, setIsUndoRedoOperation] = useState(false);
  // Track if we're moving all recurring events
  const [isMovingAllRecurring, setIsMovingAllRecurring] = useState(false);

  // Track if search bar should be visible based on width
  const [isSearchBarVisible, setIsSearchBarVisible] = useState(true);
  // Track if only time column should be shown
  const [showOnlyTimeColumn, setShowOnlyTimeColumn] = useState(false);
  // Track if header should be simplified for very narrow view
  const [showSimplifiedHeader, setShowSimplifiedHeader] = useState(false);
  // Track if month name should be abbreviated
  const [showAbbreviatedMonth, setShowAbbreviatedMonth] = useState(false);
  // Track navigation buttons opacity based on width
  const [navButtonsOpacity, setNavButtonsOpacity] = useState(1);
  // Track if weekday names should be abbreviated
  const [showAbbreviatedWeekdays, setShowAbbreviatedWeekdays] = useState(false);

  // Track current time for the time indicator
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const updateTime = () => setCurrentTime(new Date());
    const interval = setInterval(updateTime, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const weekDays = showOnlyToday || showOnlyTimeColumn
    ? [['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][currentDate.getDay() === 0 ? 6 : currentDate.getDay() - 1]]
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Get the start of the week (Monday) or just today if in narrow view
  const startOfWeek = new Date(currentDate);
  startOfWeek.setDate(currentDate.getDate() - ((currentDate.getDay() + 6) % 7));

  const weekDates = showOnlyToday || showOnlyTimeColumn
    ? [new Date(currentDate)]
    : Array.from({ length: 7 }, (_, i) => {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        return date;
      });

  const today = new Date();
  const todayDateString = today.toDateString();

  // Generate virtual events for the current view
  const events = useMemo(() => {
    console.log('CalendarModule: Generating events with baseEvents:', baseEvents.map(e => ({
      id: e.id,
      title: e.title,
      start: e.start,
      recurrence: e.recurrence,
      excludedDates: e.excludedDates,
      recurrenceGroupId: e.recurrenceGroupId
    })));

    // Calculate view range - current week plus some buffer
    const viewStart = new Date(weekDates[0]);
    viewStart.setDate(viewStart.getDate() - 7); // 1 week before
    const viewEnd = new Date(weekDates[weekDates.length - 1]);
    viewEnd.setDate(viewEnd.getDate() + 7); // 1 week after

    const startTime = performance.now();
    const generatedEvents = getEventsWithVirtual(baseEvents, viewStart, viewEnd);
    const endTime = performance.now();

    if (endTime - startTime > 50) {
      console.warn(`getEventsWithVirtual took ${(endTime - startTime).toFixed(2)}ms for ${baseEvents.length} base events, generated ${generatedEvents.length} events`);
    }

    return generatedEvents;
  }, [baseEvents, weekDates]);

  // Track when events become daily recurring and trigger wave animation
  const previousEventIdsRef = useRef<Set<string>>(new Set());
  const hasAnimatedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentEventIds = new Set(events.map(e => e.id));
    const newDailyRecurringIds = new Set<string>();

    // Check all events to find newly daily recurring ones
    events.forEach(event => {
      const isDailyRecurring = event.recurrence?.includes('FREQ=DAILY') ||
        (event.isVirtual && event.parentId && baseEvents.find(e => e.id === event.parentId)?.recurrence?.includes('FREQ=DAILY'));

      // Only animate if this is a new event and is daily recurring and hasn't been animated yet
      if (isDailyRecurring && !previousEventIdsRef.current.has(event.id) && !hasAnimatedRef.current.has(event.id)) {
        newDailyRecurringIds.add(event.id);
        hasAnimatedRef.current.add(event.id); // Mark as animated to prevent re-animation
      }
    });

    previousEventIdsRef.current = currentEventIds;

    if (newDailyRecurringIds.size > 0) {
      setDailyRecurringAnimIds(prev => new Set([...prev, ...newDailyRecurringIds]));

      // Mark as completed and remove from animating after animation finishes
      setTimeout(() => {
        setDailyRecurringAnimIds(prev => {
          const next = new Set(prev);
          newDailyRecurringIds.forEach(id => next.delete(id));
          return next;
        });
        setDailyRecurringCompletedIds(prev => new Set([...prev, ...newDailyRecurringIds]));
      }, 900); // Total animation time
    }
  }, [events, baseEvents]); // eslint-disable-line react-hooks/exhaustive-deps

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

    // Prevent text selection during drag
    e.preventDefault();

    // Close the event editor when clicking on blank space
    if (onCloseEvent) {
      onCloseEvent();
    }

    // Don't auto-delete any events - let the user decide
    // Empty events should persist until the user explicitly deletes them

    // Hide welcome message with animation when user starts creating their first event
    if (events.length === 0 && !hideWelcome) {
      setHideWelcome(true);
    }

    // Clear search UI but keep results for highlighting
    if (searchQuery || isSearchFocused || isSearchHovered) {
      setSearchQuery('');
      // Keep searchResults to maintain the red border
      setIsSearchFocused(false);
      setIsSearchHovered(false);
    }

    // Clear focused event only if not from a search
    if (searchResults.length === 0) {
      setFocusedEventId(null);
    }

    // SNAP START TIME DOWN to grid -> fixes the "+15 min" start drift
    const time = snapTime(getTimeFromPosition(e.clientY, dayIndex), 'floor');
    setDragStart({ x: e.clientX, y: e.clientY, time });
    // Don't set isDragging immediately - wait for mouse movement
    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (resizedEvent && resizeEdge) {
      // Handle event resizing - set isResizing only after movement
      if (!isResizing) {
        setIsResizing(true);
      }

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

    if (draggedEvent && dragOffset !== null && dragStart) {
      // Check if we've moved enough to start dragging
      const dragDistance = Math.sqrt(
        Math.pow(e.clientX - dragStart.x, 2) +
        Math.pow(e.clientY - dragStart.y, 2)
      );

      // Only start dragging after moving 5 pixels
      if (dragDistance > 5 && !isDragging) {
        setIsDragging(true);
      }

      if (isDragging) {
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
      }
    } else if (dragStart && !draggedEvent) {
      // Creating a new event
      // Check if we've moved enough to start dragging
      const dragDistance = Math.sqrt(
        Math.pow(e.clientX - dragStart.x, 2) +
        Math.pow(e.clientY - dragStart.y, 2)
      );

      // Only start dragging after moving 5 pixels
      if (dragDistance > 5 && !isDragging) {
        setIsDragging(true);
      }

      if (!isDragging) return;

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
      // Check if this is a recurring event (virtual, base with recurrence, or exception with recurrenceGroupId)
      const isRecurringEvent = (resizedEvent.isVirtual && resizedEvent.parentId) ||
                              (resizedEvent.recurrence && resizedEvent.recurrence !== 'none') ||
                              (resizedEvent.recurrenceGroupId && !resizedEvent.isVirtual);

      if (isRecurringEvent) {
        // Show modal for recurring event
        setEditRecurringModal({
          event: resizedEvent,
          action: 'resize',
          newStart: resizePreview.start,
          newEnd: resizePreview.end
        });
        // Don't continue with normal resize end - let modal handle it
        setIsResizing(false);
        return;
      } else {
        // Regular event resize
        const updatedEvents = baseEvents.map(e =>
          e.id === resizedEvent.id
            ? { ...e, start: resizePreview.start.toISOString(), end: resizePreview.end.toISOString() }
            : e
        );
        addToHistory(updatedEvents, baseEvents);
      }
    }

    if (isDragging) {
      if (draggedEvent && dragEnd) {
        // Update existing event position
        const originalStart = new Date(draggedEvent.start);
        const originalEnd = new Date(draggedEvent.end);
        const duration = originalEnd.getTime() - originalStart.getTime();

        const newStart = dragEnd.time;
        const newEnd = new Date(newStart.getTime() + duration);

        // Check if this is a recurring event (virtual, base with recurrence, or exception with recurrenceGroupId)
        const isRecurringEvent = (draggedEvent.isVirtual && draggedEvent.parentId) ||
                                (draggedEvent.recurrence && draggedEvent.recurrence !== 'none') ||
                                (draggedEvent.recurrenceGroupId && !draggedEvent.isVirtual);

        if (isRecurringEvent) {
          console.log('Dragged event is recurring, opening modal for event:', draggedEvent.id);
          console.log('Original start:', draggedEvent.start, 'New start:', newStart.toISOString());
          // Show modal for recurring event
          setEditRecurringModal({
            event: draggedEvent,
            action: 'move',
            newStart,
            newEnd
          });
          // Don't continue with normal drag end - let modal handle it
          setIsDragging(false);
          return;
        } else {
          // Regular event update
          const updatedEvents = baseEvents.map(e =>
            e.id === draggedEvent.id
              ? { ...e, start: newStart.toISOString(), end: newEnd.toISOString() }
              : e
          );
          addToHistory(updatedEvents, baseEvents);

          // Mark this event as just finished dragging
          setJustFinishedDragging(draggedEvent.id);
          setTimeout(() => {
            setJustFinishedDragging(null);
          }, 100); // Clear after a short delay
        }
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
            title: '', // Start with empty title to trigger auto-focus
            start: startTime.toISOString(),
            end: endTime.toISOString(),
            timezone: 'America/New_York',
            color: 'blue',
            justCreated: true, // Flag to indicate this is a brand new event
          };

          // Add with celebration animation
          addToHistory([...baseEvents, newEvent], baseEvents);

          // Mark event as appearing for animation
          setAppearingEventIds(prev => new Set([...prev, newEvent.id]));

          // Remove from appearing after animation completes
          setTimeout(() => {
            setAppearingEventIds(prev => {
              const next = new Set(prev);
              next.delete(newEvent.id);
              return next;
            });
          }, 250); // Match animation duration

          // Immediately select the new event for editing
          console.log('New event created:', newEvent);

          // Call onEditEvent to show EventEditor
          console.log('onEditEvent function exists:', !!onEditEvent);
          if (onEditEvent) {
            setTimeout(() => {
              console.log('Calling onEditEvent with:', newEvent);
              onEditEvent(newEvent);
            }, 50);
          } else {
            console.log('onEditEvent is not defined!');
          }

          // Add a celebration for the very first event ever (not after deletion)
          if (events.length === 0 && !hasCreatedFirstEvent) {
            setHasCreatedFirstEvent(true);

            // Create more noticeable confetti effect
            const colors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#F97316', '#A855F7'];
            const confettiCount = 30; // More confetti pieces

            for (let i = 0; i < confettiCount; i++) {
              setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.className = 'confetti-particle';

                // Random shapes - squares and circles
                if (Math.random() > 0.5) {
                  confetti.style.borderRadius = '50%';
                  confetti.style.width = '12px';
                  confetti.style.height = '12px';
                } else {
                  confetti.style.width = '10px';
                  confetti.style.height = '14px';
                  confetti.style.transform = `rotate(${Math.random() * 45}deg)`;
                }

                confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                confetti.style.left = Math.random() * 100 + '%';
                confetti.style.top = '-10px'; // Start from above the screen
                confetti.style.zIndex = '9999';
                confetti.style.position = 'fixed';
                confetti.style.pointerEvents = 'none';

                // Add custom animation
                confetti.style.animation = `confettiFall ${2 + Math.random() * 2}s ease-out forwards`;

                document.body.appendChild(confetti);
                setTimeout(() => confetti.remove(), 4000);
              }, i * 30); // Stagger the confetti
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
    console.log('CalendarModule: handleSelectEvent called with:', event);
    console.log('CalendarModule: onEditEvent exists?', !!onEditEvent);
    console.log('CalendarModule: onEditEvent type:', typeof onEditEvent);

    // Set focus and open editor on single click
    setFocusedEventId(event.id);

    // Clear search UI and results when selecting an event
    if (searchQuery || isSearchFocused || isSearchHovered) {
      setSearchQuery('');
      setIsSearchFocused(false);
      setIsSearchHovered(false);
    }
    // Always clear search results when manually selecting an event
    setSearchResults([]);

    // Call onEditEvent to show EventEditor
    if (onEditEvent) {
      console.log('CalendarModule: About to call onEditEvent');
      onEditEvent(event);
      console.log('CalendarModule: onEditEvent called successfully');
    } else {
      console.log('CalendarModule: WARNING - onEditEvent is not defined!');
    }
  };

  const handleEditEvent = (event: CalendarEvent) => {
    console.log('CalendarModule: handleEditEvent called with:', event);
    // Also handle double-click (same as single click)
    setFocusedEventId(event.id);

    // This is already being handled by onEditEvent below
    if (onEditEvent) {
      console.log('CalendarModule: Calling onEditEvent from handleEditEvent');
      onEditEvent(event);
    }
  };

  const handleEventDragStart = (event: CalendarEvent, e: React.MouseEvent) => {
    setDraggedEvent(event);
    // Don't set isDragging yet - wait for actual movement

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

  const handleEventResizeStart = (event: CalendarEvent, edge: 'top' | 'bottom') => {
    setResizedEvent(event);
    setResizeEdge(edge);
    // Don't set isResizing yet - wait for actual movement
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

  // Add to history before making changes
  const addToHistory = (newEvents: CalendarEvent[], currentEvents?: CalendarEvent[]) => {
    // Use provided current events or fall back to baseEvents
    const eventsToStore = currentEvents || baseEvents;

    // Filter out virtual events from both history and new events
    const filteredCurrentEvents = eventsToStore.filter(e => !e.isVirtual);
    const filteredNewEvents = newEvents.filter(e => !e.isVirtual);

    // Create new history entry
    const newHistory = [...history.slice(0, historyIndex + 1), filteredCurrentEvents];
    setHistory(newHistory);
    setHistoryIndex(newHistory.length);

    // Update the events using the update handler
    const handler = onEventUpdate || onUpdateEvents || setInternalEvents;
    handler(filteredNewEvents);
  };

  const handleUndo = () => {
    console.log('Undo triggered - historyIndex:', historyIndex, 'history length:', history.length);

    if (historyIndex === history.length && history.length > 0) {
      // First undo - add current state to history first
      const newHistory = [...history, events];
      setHistory(newHistory);
      const newIndex = history.length - 1;
      setHistoryIndex(newIndex);
      if (newIndex >= 0) {
        const prevEvents = history[newIndex];
        const currentEventIds = new Set(events.map(e => e.id));
        const prevEventIds = new Set(prevEvents.map(e => e.id));

        // Only mark as appearing if event was truly deleted (not in current)
        const appearingIds = [...prevEventIds].filter(id => !currentEventIds.has(id));

        // Set appearing state BEFORE updating events to prevent flicker
        if (appearingIds.length > 0) {
          setAppearingEventIds(new Set(appearingIds));
          // Clear appearing state after animation
          setTimeout(() => {
            setAppearingEventIds(new Set());
          }, 350); // Match animation duration
        }

        const handler = onEventUpdate || onUpdateEvents || setInternalEvents;
        handler(prevEvents);
      }
    } else if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const newEvents = history[newIndex];
      const currentEventIds = new Set(events.map(e => e.id));
      const newEventIds = new Set(newEvents.map(e => e.id));

      // Only mark as appearing if event was truly deleted (not in current)
      const appearingIds = [...newEventIds].filter(id => !currentEventIds.has(id));

      // Set appearing state BEFORE updating events to prevent flicker
      if (appearingIds.length > 0) {
        setAppearingEventIds(new Set(appearingIds));
        // Clear appearing state after animation
        setTimeout(() => {
          setAppearingEventIds(new Set());
        }, 350); // Match animation duration
      }

      const handler = onEventUpdate || onUpdateEvents || setInternalEvents;
      handler(newEvents);
    }
  };

  const handleRedo = () => {
    console.log('Redo triggered - historyIndex:', historyIndex, 'history length:', history.length);

    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const newEvents = history[newIndex];
      const currentEventIds = new Set(events.map(e => e.id));
      const newEventIds = new Set(newEvents.map(e => e.id));

      // Only mark as appearing if event was truly deleted (not in current)
      const appearingIds = [...newEventIds].filter(id => !currentEventIds.has(id));

      // Set appearing state BEFORE updating events to prevent flicker
      if (appearingIds.length > 0) {
        setAppearingEventIds(new Set(appearingIds));
        // Clear appearing state after animation
        setTimeout(() => {
          setAppearingEventIds(new Set());
        }, 350); // Match animation duration
      }

      const handler = onEventUpdate || onUpdateEvents || setInternalEvents;
      handler(newEvents);
    } else if (historyIndex === history.length - 1 && history.length > 0) {
      // Special case: redo to the latest state after history
      setHistoryIndex(history.length);
      // The current events are already the latest state
    }
  };

  const handleCut = (event: CalendarEvent) => {
    setClipboard({ event, isCut: true });
    setCutEventId(event.id); // Track which event is cut for visual feedback
  };

  const handleCopy = (event: CalendarEvent) => {
    setClipboard({ event, isCut: false });
    setCutEventId(null); // Clear cut visual if copying
  };

  const handlePaste = () => {
    if (!clipboard) return;

    // Determine paste position based on mouse position
    let pasteDate = new Date();

    // Use ref for most up-to-date mouse position
    const currentMousePos = mousePositionRef.current || lastMousePosition;

    if (currentMousePos && calendarRef.current && scrollContainerRef.current) {
      // Calculate the time based on current mouse position
      // getTimeFromPosition expects clientY and handles scroll internally
      const pasteTime = getTimeFromPosition(currentMousePos.y, currentMousePos.dayIndex);
      pasteDate = snapTime(pasteTime, 'round');

      // Ensure the pasted time is within valid hours (0-24)
      const hours = pasteDate.getHours();
      if (hours < 0 || hours >= 24) {
        // Fallback to current time if calculation is off
        pasteDate = snapTime(new Date(), 'round');
      }
    } else if (focusedEventId) {
      // Fallback to focused event position
      const focusedEvent = events.find(e => e.id === focusedEventId);
      if (focusedEvent) {
        const focusedEnd = new Date(focusedEvent.end);
        pasteDate = new Date(focusedEnd.getTime() + 15 * 60 * 1000); // 15 minutes after focused event
      }
    } else {
      // Default to current time on first day
      pasteDate = new Date();
      pasteDate = snapTime(pasteDate, 'round');
    }

    const originalStart = new Date(clipboard.event.start);
    const originalEnd = new Date(clipboard.event.end);
    const duration = originalEnd.getTime() - originalStart.getTime();

    const newEvent: CalendarEvent = {
      ...clipboard.event,
      id: `${Date.now()}-${Math.random()}`,
      start: pasteDate.toISOString(),
      end: new Date(pasteDate.getTime() + duration).toISOString()
    };

    let updatedEvents = [...baseEvents];

    if (clipboard.isCut) {
      // Remove original if it was cut
      updatedEvents = updatedEvents.filter(e => e.id !== clipboard.event.id);
      setClipboard(null);
      setCutEventId(null);
    }

    updatedEvents.push(newEvent);
    addToHistory(updatedEvents, baseEvents);
    setFocusedEventId(newEvent.id);

    // Mark event as appearing for animation
    setAppearingEventIds(prev => new Set([...prev, newEvent.id]));

    // Remove from appearing after animation completes
    setTimeout(() => {
      setAppearingEventIds(prev => {
        const next = new Set(prev);
        next.delete(newEvent.id);
        return next;
      });
    }, 350); // Match animation duration
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
      start: originalEnd.toISOString(),
      end: new Date(originalEnd.getTime() + duration).toISOString()
    };

    const updatedEvents = [...baseEvents, newEvent];
    addToHistory(updatedEvents, baseEvents);
    setFocusedEventId(newEventId);

    // Mark event as appearing for animation
    setAppearingEventIds(prev => new Set([...prev, newEventId]));

    // Remove from appearing after animation completes
    setTimeout(() => {
      setAppearingEventIds(prev => {
        const next = new Set(prev);
        next.delete(newEventId);
        return next;
      });
    }, 350); // Match animation duration
  };

  // Navigate between events with arrow keys
  const navigateToEvent = (direction: 'up' | 'down' | 'left' | 'right') => {
    if (!focusedEventId || events.length === 0) {
      // If no event is selected, select the first one
      if (events.length > 0) {
        setFocusedEventId(events[0].id);
        if (onEditEvent) {
          // Pass 'keyboard' source to trigger keyboard-specific transitions
          (onEditEvent as any)(events[0], 'keyboard');
        }
      }
      return;
    }

    const currentEvent = events.find(e => e.id === focusedEventId);
    if (!currentEvent) return;

    const currentStart = new Date(currentEvent.start);
    const currentDayIndex = weekDates.findIndex(d => d.toDateString() === currentStart.toDateString());
    const currentHour = currentStart.getHours() + currentStart.getMinutes() / 60;

    let bestEvent: CalendarEvent | null = null;
    let bestDistance = Infinity;

    for (const event of events) {
      if (event.id === focusedEventId) continue;

      const eventStart = new Date(event.start);
      const eventDayIndex = weekDates.findIndex(d => d.toDateString() === eventStart.toDateString());
      const eventHour = eventStart.getHours() + eventStart.getMinutes() / 60;

      let isCandidate = false;
      let distance = 0;

      switch (direction) {
        case 'left': // Previous day
          if (eventDayIndex < currentDayIndex) {
            distance = Math.abs(eventHour - currentHour) + (currentDayIndex - eventDayIndex) * 24;
            isCandidate = true;
          }
          break;
        case 'right': // Next day
          if (eventDayIndex > currentDayIndex) {
            distance = Math.abs(eventHour - currentHour) + (eventDayIndex - currentDayIndex) * 24;
            isCandidate = true;
          }
          break;
        case 'up': // Earlier in day
          if (eventDayIndex === currentDayIndex && eventHour < currentHour) {
            distance = currentHour - eventHour;
            isCandidate = true;
          }
          break;
        case 'down': // Later in day
          if (eventDayIndex === currentDayIndex && eventHour > currentHour) {
            distance = eventHour - currentHour;
            isCandidate = true;
          }
          break;
      }

      if (isCandidate && distance < bestDistance) {
        bestDistance = distance;
        bestEvent = event;
      }
    }

    if (bestEvent) {
      setFocusedEventId(bestEvent.id);
      // Also select the event to open the editor with keyboard source
      if (onEditEvent) {
        // Pass 'keyboard' source to trigger keyboard-specific transitions
        (onEditEvent as any)(bestEvent, 'keyboard');
      }
      // Scroll to the event within the calendar container only
      const eventElement = document.querySelector(`[data-event-id="${bestEvent.id}"]`) as HTMLElement;
      if (eventElement && scrollContainerRef.current) {
        const scrollContainer = scrollContainerRef.current;
        const eventRect = eventElement.getBoundingClientRect();
        const containerRect = scrollContainer.getBoundingClientRect();

        // Only scroll if event is not fully visible
        if (eventRect.top < containerRect.top || eventRect.bottom > containerRect.bottom) {
          const scrollTop = scrollContainer.scrollTop + (eventRect.top - containerRect.top) - (containerRect.height / 2) + (eventRect.height / 2);
          scrollContainer.scrollTo({
            top: scrollTop,
            behavior: 'smooth'
          });
        }
      }
    } else {
      // No event found in that direction
      // For left/right navigation with no events, close the event editor
      if ((direction === 'left' || direction === 'right') && onCloseEvent) {
        setFocusedEventId(null);
        onCloseEvent();
      }
    }
  };


  // Helper function to check if two events overlap in time
  const eventsOverlap = (event1: CalendarEvent, event2: CalendarEvent): boolean => {
    const start1 = new Date(event1.start).getTime();
    const end1 = new Date(event1.end).getTime();
    const start2 = new Date(event2.start).getTime();
    const end2 = new Date(event2.end).getTime();

    return start1 < end2 && start2 < end1;
  };

  // Calculate conflicts for all events in a day
  const calculateEventConflicts = (dayEvents: CalendarEvent[]): Map<string, { column: number; totalColumns: number }> => {
    const conflicts = new Map<string, { column: number; totalColumns: number }>();

    // Sort events by start time, then by duration (longer events first)
    const sortedEvents = [...dayEvents].sort((a, b) => {
      const startDiff = new Date(a.start).getTime() - new Date(b.start).getTime();
      if (startDiff !== 0) return startDiff;

      const durationA = new Date(a.end).getTime() - new Date(a.start).getTime();
      const durationB = new Date(b.end).getTime() - new Date(b.start).getTime();
      return durationB - durationA;
    });

    // Group overlapping events
    const groups: CalendarEvent[][] = [];

    for (const event of sortedEvents) {
      let placed = false;

      for (const group of groups) {
        // Check if this event overlaps with any event in the group
        if (group.some(e => eventsOverlap(e, event))) {
          group.push(event);
          placed = true;
          break;
        }
      }

      if (!placed) {
        groups.push([event]);
      }
    }

    // Assign columns within each conflict group
    for (const group of groups) {
      const columns = group.length;
      group.forEach((event, index) => {
        conflicts.set(event.id, {
          column: index,
          totalColumns: columns
        });
      });
    }

    return conflicts;
  };

  const getEventPosition = (event: CalendarEvent, dayIndex: number, dayEvents: CalendarEvent[]) => {
    const eventStart = new Date(event.start);
    const eventEnd = new Date(event.end);
    const dayDate = weekDates[dayIndex];

    // Get start and end of the current day
    const dayStart = new Date(dayDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayDate);
    dayEnd.setHours(23, 59, 59, 999);

    // Check if event overlaps with this day
    if (eventEnd <= dayStart || eventStart > dayEnd) return null;

    // Calculate visible portion of the event for this day
    const visibleStart = eventStart > dayStart ? eventStart : dayStart;
    const visibleEnd = eventEnd < dayEnd ? eventEnd : dayEnd;

    const hourHeight = 64; // Each hour row is 64px tall

    // Calculate start and end hours for the visible portion
    const startHour = visibleStart.getHours() + visibleStart.getMinutes() / 60;
    const endHour = visibleEnd < dayEnd
      ? visibleEnd.getHours() + visibleEnd.getMinutes() / 60
      : 24; // If event continues to next day, extend to end of current day

    const duration = endHour - startHour;

    // Calculate conflicts for this day
    const conflicts = calculateEventConflicts(dayEvents);
    const conflict = conflicts.get(event.id);

    // Add small gap between adjacent events (1px top and bottom)
    const gapSize = 1;
    const adjustedTop = startHour * hourHeight + gapSize;
    const adjustedHeight = duration * hourHeight - (gapSize * 2);

    // Calculate horizontal positioning based on conflicts
    const sideGap = 2; // Gap from edges
    const eventGap = 2; // Gap between conflicting events

    if (conflict && conflict.totalColumns > 1) {
      const availableWidth = 100 - (sideGap * 2); // Percentage
      const columnWidth = availableWidth / conflict.totalColumns;
      const leftPosition = sideGap + (conflict.column * columnWidth);

      return {
        top: `${adjustedTop}px`,
        height: `${Math.max(adjustedHeight, 10)}px`, // Minimum height of 10px
        left: `${leftPosition}%`,
        width: `${columnWidth - (eventGap / conflict.totalColumns)}%`,
        isConflicting: true,
        conflictInfo: conflict
      };
    }

    return {
      top: `${adjustedTop}px`,
      height: `${Math.max(adjustedHeight, 10)}px`, // Minimum height of 10px
      left: '2px',
      right: '2px',
      isConflicting: false
    };
  };

  const monthYear = showAbbreviatedMonth
    ? currentDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

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

  // Global mouse tracking for paste
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (calendarRef.current && scrollContainerRef.current) {
        const rect = calendarRef.current.getBoundingClientRect();
        const scrollRect = scrollContainerRef.current.getBoundingClientRect();
        const relativeX = e.clientX - rect.left;

        // Check if mouse is within calendar horizontal bounds
        if (relativeX >= 0 && relativeX <= rect.width) {
          // Check if mouse is within scroll container vertical bounds
          if (e.clientY >= scrollRect.top && e.clientY <= scrollRect.bottom) {
            const dayColumnWidth = rect.width / weekDates.length;
            const dayIndex = Math.floor(relativeX / dayColumnWidth);

            if (dayIndex >= 0 && dayIndex < weekDates.length) {
              const position = {
                x: e.clientX,
                y: e.clientY,
                dayIndex
              };
              mousePositionRef.current = position;
              setLastMousePosition(position);
            }
          }
        }
      }
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, [weekDates.length]);

  // Observe container resize for proper event positioning
  useEffect(() => {
    if (!calendarRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const width = entry.contentRect.width;
        setContainerWidth(width);
        // Hide search bar when width is less than 600px
        setIsSearchBarVisible(width >= 600);
        // Show only today's events when width is less than 250px (single column mode) - reduced from 400px for less sensitivity
        setShowOnlyTimeColumn(width < 250);
        // Simplify header when width is less than 200px to prevent button cutoff - reduced from 350px
        setShowSimplifiedHeader(width < 200);
        // Show abbreviated month when width is less than 450px
        setShowAbbreviatedMonth(width < 135);

        // Show abbreviated weekdays (Mon, Tue, etc -> M, T, etc) when width is less than 300px
        // But not in single day view (below 250px)
        setShowAbbreviatedWeekdays(width < 300 && width >= 250);

        // Gradually hide navigation buttons when width is between 500-600px
        if (width >= 600) {
          setNavButtonsOpacity(1);
        } else if (width >= 500) {
          // Gradual fade from 500px to 600px
          setNavButtonsOpacity((width - 500) / 100);
        } else {
          setNavButtonsOpacity(0);
        }
      }
    });

    resizeObserver.observe(calendarRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

      // Check if we're in an input field
      const activeElement = document.activeElement;
      const inInputField = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.getAttribute('contenteditable') === 'true'
      );

      // Undo/Redo should work even in input fields since they don't conflict with text editing
      if (cmdKey) {
        // Undo: Cmd/Ctrl + Z
        if (e.key === 'z' && !e.shiftKey) {
          // Only prevent default and handle undo if we have history to undo
          if (historyIndex > 0) {
            e.preventDefault();
            e.stopPropagation();
            handleUndo();
            return;
          }
        }
        // Redo: Cmd/Ctrl + Y or Cmd/Ctrl + Shift + Z
        if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
          // Only prevent default and handle redo if we have history to redo
          if (historyIndex < history.length - 1) {
            e.preventDefault();
            e.stopPropagation();
            handleRedo();
            return;
          }
        }
      }

      // Other global shortcuts that should NOT work in input fields
      if (cmdKey && !inInputField) {
        // Paste: Cmd/Ctrl + V
        if (e.key === 'v') {
          e.preventDefault();
          handlePaste();
          return;
        }
        // Search: Cmd/Ctrl + F
        if (e.key === 'f') {
          e.preventDefault();
          // Focus and expand the search bar
          setIsSearchHovered(true);
          setIsSearchFocused(true);

          // Focus the input element
          setTimeout(() => {
            const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
            if (searchInput) {
              searchInput.focus();
              searchInput.select(); // Select any existing text
            }
          }, 100);
          return;
        }
      }

      // Arrow key navigation (without modifiers)
      if (!cmdKey && !e.shiftKey && !e.altKey && !inInputField) {
        switch (e.key) {
          case 'ArrowLeft':
            e.preventDefault();
            navigateToEvent('left');
            return;
          case 'ArrowRight':
            e.preventDefault();
            navigateToEvent('right');
            return;
          case 'ArrowUp':
            e.preventDefault();
            navigateToEvent('up');
            return;
          case 'ArrowDown':
            e.preventDefault();
            navigateToEvent('down');
            return;
        }
      }

      // Event-specific shortcuts
      // Get events with virtual events for the current view
      const viewStart = new Date(weekDates[0]);
      viewStart.setDate(viewStart.getDate() - 7);
      const viewEnd = new Date(weekDates[weekDates.length - 1]);
      viewEnd.setDate(viewEnd.getDate() + 7);
      const eventsWithVirtual = getEventsWithVirtual(baseEvents, viewStart, viewEnd);

      const targetEvent = contextMenu?.event ||
        (focusedEventId ? eventsWithVirtual.find(e => e.id === focusedEventId) : null) ||
        (selectedEventId ? eventsWithVirtual.find(e => e.id === selectedEventId) : null);

      if (!targetEvent) return;

      if (cmdKey && !inInputField) {
        // Cut: Cmd/Ctrl + X
        if (e.key === 'x') {
          e.preventDefault();
          handleCut(targetEvent);
          setContextMenu(null);
        }
        // Copy: Cmd/Ctrl + C
        else if (e.key === 'c') {
          e.preventDefault();
          handleCopy(targetEvent);
          setContextMenu(null);
        }
        // Duplicate: Cmd/Ctrl + D
        else if (e.key === 'd') {
          e.preventDefault();
          handleDuplicate(targetEvent);
          setContextMenu(null);
        }
      }

      // Delete key (without modifiers)
      if (!cmdKey && !e.shiftKey && !e.altKey && !inInputField) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          if (targetEvent) {
            // For recurring events, we need to show the delete modal through the editor
            if (targetEvent.recurrence || targetEvent.recurrenceGroupId) {
              // Open the event editor which will handle the delete modal
              if (onEditEvent) {
                onEditEvent(targetEvent);
                // Trigger delete in the editor after it opens
                setTimeout(() => {
                  const deleteButton = document.querySelector('[data-delete-button]') as HTMLButtonElement;
                  if (deleteButton) deleteButton.click();
                }, 100);
              }
            } else {
              // Non-recurring event - animate deletion
              // Always animate deletion for better UX
              setInternalDeletingEventIds(prev => new Set([...prev, targetEvent.id]));

              // Clear focus immediately for better UX
              setFocusedEventId(null);
              setContextMenu(null);

              // Always handle deletion through history system for proper undo
              // Wait for animation to complete before actually removing
              setTimeout(() => {
                const updatedEvents = baseEvents.filter(e => e.id !== targetEvent.id);
                addToHistory(updatedEvents, baseEvents);

                // Also call external handler if it exists (for UI updates like closing EventEditor)
                if (onDeleteEvent) {
                  onDeleteEvent(targetEvent.id);
                }

                // Clean up the deleting state
                setInternalDeletingEventIds(prev => {
                  const next = new Set(prev);
                  next.delete(targetEvent.id);
                  return next;
                });
              }, 250); // Match animation duration
            }
          }
        }
      }

      if (cmdKey && !inInputField) {
        // Text formatting shortcuts (for when editing)
        if (e.key === 'b') {
          e.preventDefault();
          console.log('Bold text');
          // Would apply to event title/description when editing
        }
        else if (e.key === 'i') {
          e.preventDefault();
          console.log('Italic text');
        }
        else if (e.key === 'u') {
          e.preventDefault();
          console.log('Underline text');
        }
      }

    };

    // Use capture phase to handle undo/redo before other handlers
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [contextMenu, focusedEventId, baseEvents, weekDates, clipboard, history, historyIndex, cutEventId, getEventsWithVirtual, handleUndo, handleRedo, handlePaste, handleCut, handleCopy, handleDuplicate]);

  return (
    <div className={`h-full bg-white flex flex-col overflow-hidden ${className} ${isDragging || isResizing ? 'select-none' : ''}`}>
      <style jsx>{`
        .search-input {
          transition: all 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .search-input::placeholder {
          color: rgb(107 114 128);
          transition: opacity 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .search-collapsed::placeholder {
          opacity: 0;
        }
        .search-expanded::placeholder {
          opacity: 1;
        }
      `}</style>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-blue-200 relative z-10">
        <div className="flex items-center relative">
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
            className={`text-xl font-bold text-blue-900 transition-all duration-200 px-3 py-1.5 rounded-lg btn-playful whitespace-nowrap ${
              isMonthViewPinned
                ? 'bg-blue-100 text-blue-700 shadow-inner'
                : 'hover:text-blue-600 hover:bg-blue-50'
            }`}
          >
            {monthYear}
          </button>

          <div
            className="flex items-center gap-1"
            style={{
              marginLeft: '10px',
              opacity: showSimplifiedHeader || showOnlyToday ? 0 : navButtonsOpacity,
              pointerEvents: navButtonsOpacity < 0.5 ? 'none' : 'auto',
              transition: 'opacity 300ms ease-out'
            }}
          >
            <button
              onClick={() => navigateWeek('prev')}
              className="p-1 text-blue-400 hover:text-blue-600 transition-all duration-200 nav-button btn-playful"
              aria-label="Previous week"
              title="Previous week"
              disabled={showSimplifiedHeader || showOnlyToday}
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
              disabled={showSimplifiedHeader || showOnlyToday}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search Bar - Centered between > button and Today button */}
        <div
          className="flex justify-center items-center absolute"
          style={{
            left: 'calc(50% + 80px)',
            transform: 'translateX(-50%)',
            opacity: isSearchBarVisible ? '1' : '0',
            transition: 'opacity 400ms ease-out',
            pointerEvents: isSearchBarVisible ? 'auto' : 'none'
          }}
        >
            <div
              className="relative w-64 transition-transform duration-300 ease-in-out z-50"
              onMouseEnter={() => setIsSearchHovered(true)}
              onMouseLeave={() => {
                if (!searchQuery) {
                  setIsSearchHovered(false);
                  setIsSearchFocused(false);
                  // Blur the input to remove focus
                  const searchInput = document.querySelector('.search-input') as HTMLInputElement;
                  if (searchInput) {
                    searchInput.blur();
                  }
                }
              }}
            >
              <input
                type="text"
                placeholder={isSearchHovered || isSearchFocused ? "Search events..." : ""}
                value={searchQuery}
                readOnly={!isSearchHovered && !isSearchFocused && !searchQuery}
                onFocus={() => {
                  setIsSearchFocused(true);
                  setIsSearchHovered(true);
                }}
                onBlur={() => {
                  setIsSearchFocused(false);
                  if (!searchQuery) {
                    setIsSearchHovered(false);
                  }
                }}
                onClick={(e) => {
                  if (!isSearchHovered && !isSearchFocused && !searchQuery) {
                    e.preventDefault();
                    setIsSearchHovered(true);
                    // Focus the input after enabling hover
                    setTimeout(() => {
                      (e.target as HTMLInputElement).focus();
                    }, 100);
                  }
                }}
                onChange={(e) => {
                  const query = e.target.value;
                  setSearchQuery(query);

                  if (query.trim()) {
                    // Helper function to strip markdown formatting
                    const stripMarkdown = (text: string): string => {
                      if (!text) return '';

                      // Remove headers (# ## ### etc.)
                      let cleaned = text.replace(/^#{1,6}\s+/gm, '');

                      // Remove bold first (***text*** or ___text___)
                      cleaned = cleaned.replace(/\*\*\*([^*]+)\*\*\*/g, '$1');
                      cleaned = cleaned.replace(/___([^_]+)___/g, '$1');

                      // Remove bold (**text** or __text__)
                      cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
                      cleaned = cleaned.replace(/__([^_]+)__/g, '$1');

                      // Remove italic (*text* or _text_)
                      cleaned = cleaned.replace(/\*([^*\n]+)\*/g, '$1');
                      cleaned = cleaned.replace(/\b_([^_\n]+)_\b/g, '$1');

                      // Remove strikethrough (~~text~~)
                      cleaned = cleaned.replace(/~~([^~]+)~~/g, '$1');

                      // Remove inline code (`text`)
                      cleaned = cleaned.replace(/`([^`]+)`/g, '$1');

                      // Remove code blocks (```text```)
                      cleaned = cleaned.replace(/```[^`]*```/g, '');

                      // Remove links [text](url) or [text][ref]
                      cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
                      cleaned = cleaned.replace(/\[([^\]]+)\]\[[^\]]+\]/g, '$1');

                      // Remove images ![alt](url)
                      cleaned = cleaned.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');

                      // Remove blockquotes (> text)
                      cleaned = cleaned.replace(/^>\s+/gm, '');

                      // Remove list markers (-, *, +, 1.)
                      cleaned = cleaned.replace(/^[\s]*[-*+]\s+/gm, '');
                      cleaned = cleaned.replace(/^[\s]*\d+\.\s+/gm, '');

                      // Remove horizontal rules (---, ***, ___)
                      cleaned = cleaned.replace(/^[-*_]{3,}$/gm, '');

                      // Remove HTML tags if any
                      cleaned = cleaned.replace(/<[^>]+>/g, '');

                      // Remove extra whitespace
                      cleaned = cleaned.replace(/\s+/g, ' ').trim();

                      return cleaned;
                    };

                    const searchLower = query.toLowerCase().trim();
                    const matches = events.filter(event => {
                      // Get clean text without markdown
                      const title = event.title.toLowerCase();
                      const rawDescription = event.description || '';
                      const cleanDescription = stripMarkdown(rawDescription).toLowerCase();

                      // Combine title and clean description for searching
                      const searchableText = `${title} ${cleanDescription}`;

                      // Check if the search query appears anywhere in the text (substring match)
                      // This handles sentences and phrases, not just single words
                      return searchableText.includes(searchLower);
                    }).map(e => e.id);

                    setSearchResults(matches);

                    // Focus on first result if any
                    if (matches.length > 0) {
                      setFocusedEventId(matches[0]);

                      // Scroll to first match
                      const firstEvent = events.find(e => e.id === matches[0]);
                      if (firstEvent && scrollContainerRef.current) {
                        const eventStart = new Date(firstEvent.start);
                        const hour = eventStart.getHours();
                        const scrollPosition = hour * 64 - 100;
                        scrollContainerRef.current.scrollTo({
                          top: Math.max(0, scrollPosition),
                          behavior: 'smooth'
                        });
                      }
                    }
                  } else {
                    setSearchResults([]);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchResults.length > 0) {
                    // Cycle through search results
                    const currentIndex = searchResults.indexOf(focusedEventId || '');
                    const nextIndex = (currentIndex + 1) % searchResults.length;
                    const nextEventId = searchResults[nextIndex];

                    setFocusedEventId(nextEventId);

                    // Scroll to next result
                    const nextEvent = events.find(e => e.id === nextEventId);
                    if (nextEvent && scrollContainerRef.current) {
                      const eventStart = new Date(nextEvent.start);
                      const hour = eventStart.getHours();
                      const scrollPosition = hour * 64 - 100;
                      scrollContainerRef.current.scrollTo({
                        top: Math.max(0, scrollPosition),
                        behavior: 'smooth'
                      });
                    }
                  } else if (e.key === 'Escape') {
                    // Clear search
                    setSearchQuery('');
                    setSearchResults([]);
                    setFocusedEventId(null);
                  }
                }}
                className={`w-full text-sm text-gray-800 bg-white border focus:outline-none search-input ${
                  isSearchHovered || isSearchFocused || searchQuery ? 'search-expanded' : 'search-collapsed'
                }`}
                style={{
                  height: isSearchHovered || isSearchFocused || searchQuery ? '36px' : '28px',
                  padding: isSearchHovered || isSearchFocused || searchQuery ? '6px 32px' : '4px 32px',
                  borderRadius: isSearchHovered || isSearchFocused || searchQuery ? '12px' : '24px',
                  borderColor: isSearchHovered || isSearchFocused || searchQuery ? 'rgb(147, 197, 253)' : 'rgb(191, 219, 254)',
                  boxShadow: isSearchHovered || isSearchFocused || searchQuery ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : '0 0 0 0 rgba(0, 0, 0, 0)',
                  transform: isSearchHovered || isSearchFocused || searchQuery ? 'scale(1.05)' : 'scale(1)',
                  caretColor: isSearchHovered || isSearchFocused || searchQuery ? 'auto' : 'transparent',
                  cursor: isSearchHovered || isSearchFocused || searchQuery ? 'text' : 'pointer',
                  opacity: 1,
                  transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              />
              {/* Search Icon */}
              <button
                onClick={() => {
                  if (!isSearchHovered && !isSearchFocused) {
                    setIsSearchHovered(true);
                    setTimeout(() => {
                      const input = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
                      if (input) {
                        input.focus();
                      }
                    }, 100);
                  }
                }}
                className={`absolute w-4 h-4 z-20 ${
                  isSearchHovered || isSearchFocused || searchQuery
                    ? 'text-blue-400 opacity-100 pointer-events-none'
                    : 'text-blue-500 opacity-70 cursor-pointer hover:text-blue-600'
                }`}
                style={{
                  left: isSearchHovered || isSearchFocused || searchQuery ? '8px' : '10px',
                  top: '52%',
                  transform: `translateY(-50%) scale(${isSearchHovered || isSearchFocused || searchQuery ? '1.1' : '1'})`,
                  transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                <svg
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  className="w-full h-full"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
              {/* Clear button - Only when there's text */}
              {searchQuery && (isSearchHovered || isSearchFocused) && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                    setFocusedEventId(null);
                    setIsSearchFocused(false);
                    setIsSearchHovered(false);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-blue-400 hover:text-blue-600 transition-all duration-300 ease-in-out transform hover:scale-110"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              {searchResults.length > 0 && searchQuery && (isSearchHovered || isSearchFocused) && (
                <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded whitespace-nowrap z-10 shadow-sm">
                  {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found • Press Enter to cycle
                </div>
              )}
            </div>
        </div>

        <div
          style={{
            position: 'absolute',
            right: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            opacity: showSimplifiedHeader || showOnlyToday ? 0 : navButtonsOpacity,
            transition: 'opacity 300ms ease-out',
            pointerEvents: navButtonsOpacity < 0.5 ? 'none' : 'auto',
            zIndex: 10
          }}
        >
          <button
            data-today-button
            onClick={goToToday}
            disabled={showSimplifiedHeader || showOnlyToday}
            className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-white border-2 border-blue-500 rounded-lg hover:bg-blue-50 transition-all duration-200 btn-playful button-press whitespace-nowrap"
          >
            Today
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Fixed timezone header and weekday headers */}
        <div className="flex bg-white border-b border-blue-200" style={{ height: '60px' }}>
          {/* Timezone header - fixed position */}
          <div className={`flex-shrink-0 flex flex-col justify-center items-center bg-white border-r border-blue-200 transition-all duration-300`} style={{ width: '72px' }}>
            <div className="text-xs font-bold text-blue-600">{userTimezone.city}</div>
            <div className="text-[10px] text-blue-500">({userTimezone.offset})</div>
          </div>
          {/* Weekday headers - fixed position */}
          <div className={`flex-1 transition-all duration-300 flex opacity-100`}>
            {weekDates.map((date, index) => {
              const isToday = date.toDateString() === todayDateString;
              const isHighlighted = highlightedDate && date.toDateString() === highlightedDate.toDateString();
              return (
                <div
                  key={index}
                  className={`flex-1 text-center border-r border-blue-100 last:border-r-0 relative transition-all duration-500 ${
                    isHighlighted ? 'bg-blue-100/50' : ''
                  }`}
                  style={{
                    padding: showAbbreviatedWeekdays ? '4px' : '8px'
                  }}
                >
                  <div className={`font-medium ${isToday ? 'text-blue-600 font-semibold' : 'text-blue-500'}`}
                    style={{
                      fontSize: '12px'
                    }}>
                    {showAbbreviatedWeekdays ? weekDays[index].charAt(0) : weekDays[index]}
                  </div>
                  <div className={`transition-all duration-500 ${
                    isHighlighted ? 'text-blue-700 scale-105 celebrate font-bold' : isToday ? 'text-blue-700 font-bold' : 'text-blue-900 font-semibold'
                  }`}
                    style={{
                      fontSize: '18px'
                    }}>
                    {date.getDate()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scrollable Content with both time labels and calendar grid */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth flex scrollbar-hide calendar-scroll-container"
          style={{
            overflowX: 'hidden',
            msOverflowStyle: 'none', // Hide scrollbar for IE and Edge
            scrollbarWidth: 'none', // Hide scrollbar for Firefox
          }}
        >
          {/* Time column that scrolls with content */}
          <div className={`flex-shrink-0 bg-white relative transition-all duration-300`} style={{ width: '72px', minWidth: '72px' }}>
            {/* Time labels with border */}
            <div style={{ minHeight: '1536px', borderRight: '1px solid #DBEAFE' }} className="bg-white">
              {hours.map((hour) => (
                <div key={hour} className="h-16 text-xs text-blue-500 relative bg-white" style={{ height: '64px' }}>
                  {hour !== 0 && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap bg-white px-1.5 min-w-[50px] text-center">
                      {formatTime(hour)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Main calendar content */}
          <div
            className={`transition-all duration-300 ${showOnlyTimeColumn ? 'flex-1 opacity-100' : 'flex-1 opacity-100'}`}
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
              {/* Time Grid */}
                <div className="relative" style={{ minHeight: '1536px' }}>
              {hours.map((hour) => (
                <div key={hour} className="flex relative" style={{ height: '64px' }}>
                  {weekDates.map((date, dayIndex) => {
                    const isToday = date.toDateString() === todayDateString;
                    return (
                      <div
                        key={dayIndex}
                        className={`flex-1 border-r border-b border-blue-200 last:border-r-0 relative ${
                          isToday ? 'bg-blue-50/30' : ''
                        }`}
                        style={{ height: '64px' }}
                        onMouseDown={(e) => handleMouseDown(e, dayIndex)}
                      />
                    );
                  })}
                </div>
              ))}



                {/* Events layer */}
            <div className="absolute inset-0 pointer-events-none" style={{ willChange: 'width' }}>
              {events.map((event) => {
                // Find all days this event spans
                const eventStart = new Date(event.start);
                const eventEnd = new Date(event.end);

                // Render the event on each day it spans
                return weekDates.map((weekDate, dayIndex) => {
                  const dayStart = new Date(weekDate);
                  dayStart.setHours(0, 0, 0, 0);
                  const dayEnd = new Date(weekDate);
                  dayEnd.setHours(23, 59, 59, 999);

                  // Skip if event doesn't overlap with this day
                  if (eventEnd <= dayStart || eventStart > dayEnd) return null;

                  // Get all events that overlap with this day
                  const dayEvents = events.filter(e => {
                    const eStart = new Date(e.start);
                    const eEnd = new Date(e.end);
                    // Event overlaps if it doesn't end before day starts or start after day ends
                    return !(eEnd <= dayStart || eStart > dayEnd);
                  });

                // Check if event continues from previous day or to next day
                // Events ending at exactly midnight (00:00:00) should NOT be considered as continuing
                const continuesFromPreviousDay = eventStart < dayStart;

                // Check if event ends after midnight (not AT midnight)
                const nextDayStart = new Date(dayStart);
                nextDayStart.setDate(nextDayStart.getDate() + 1);
                nextDayStart.setHours(0, 0, 0, 0);

                // Only consider it continuing if it goes past midnight (not just to midnight)
                const continuesToNextDay = eventEnd > nextDayStart;

                const position = getEventPosition(event, dayIndex, dayEvents);
                if (!position) return null;

                // Calculate absolute position within the full calendar
                const dayWidthPercent = 100 / weekDates.length;
                const dayLeftPercent = (dayIndex / weekDates.length) * 100;

                // Convert position within day to absolute position
                let absoluteLeft, absoluteWidth;
                if (position.left && position.left.includes('%')) {
                  const leftPercent = parseFloat(position.left);
                  absoluteLeft = `${dayLeftPercent + (leftPercent * dayWidthPercent / 100)}%`;
                } else if (position.left === '2px') {
                  absoluteLeft = `calc(${dayLeftPercent}% + 2px)`;
                } else {
                  absoluteLeft = `${dayLeftPercent}%`;
                }

                if (position.width && position.width.includes('%')) {
                  const widthPercent = parseFloat(position.width);
                  absoluteWidth = `${widthPercent * dayWidthPercent / 100}%`;
                } else if (position.right === '2px') {
                  absoluteWidth = `calc(${dayWidthPercent}% - 4px)`;
                } else {
                  absoluteWidth = `${dayWidthPercent}%`;
                }

                const isBeingDragged = draggedEvent?.id === event.id && isDragging;
                const isBeingResized = resizedEvent?.id === event.id && isResizing;
                const hasJustFinishedDragging = justFinishedDragging === event.id;
                const isCut = cutEventId === event.id;
                const isSearchHighlight = focusedEventId === event.id && searchResults.length > 0;
                const isDeleting = deletingEventIds.has(event.id);
                const isAppearing = appearingEventIds.has(event.id);

                const isEventSelected = selectedEventId === event.id || focusedEventId === event.id;

                // Check if this is a daily recurring event
                const isDailyRecurring = (() => {
                  // Check if it's a virtual event from a daily recurring parent
                  if (event.isVirtual && event.parentId) {
                    const parentEvent = baseEvents.find(e => e.id === event.parentId);
                    return parentEvent?.recurrence?.includes('FREQ=DAILY');
                  }
                  // Check if it's a base daily recurring event
                  return event.recurrence?.includes('FREQ=DAILY');
                })();

                // Check if this is the base event (first occurrence)
                const isBaseEvent = !event.isVirtual && event.recurrence?.includes('FREQ=DAILY');

                // Check if this is a newly created daily recurring event (not yet tracked)
                const isNewDailyEvent = isDailyRecurring && !isBaseEvent &&
                  !previousEventIdsRef.current.has(event.id) &&
                  !hasAnimatedRef.current.has(event.id);

                // Check if this event was just set to daily recurring (skip base event)
                const isNewlyDailyRecurring = (isDailyRecurring && dailyRecurringAnimIds.has(event.id) && !isBaseEvent) || isNewDailyEvent;
                const isDailyRecurringCompleted = isDailyRecurring && dailyRecurringCompletedIds.has(event.id) && !isBaseEvent;

                // Calculate the opacity for daily recurring events
                const getDailyOpacity = () => {
                  if (!isDailyRecurring) return undefined;
                  if (isBaseEvent) return 1; // Base event always full opacity
                  if (isNewlyDailyRecurring) return 0; // Start at 0 for animation
                  if (isDailyRecurringCompleted) {
                    return 1; // All events at 100% after animation
                  }
                  return 1; // Default to full opacity for existing daily events
                };

                return (
                  <div
                    key={`${event.id}-day-${dayIndex}`}
                    data-event-id={event.id}
                    className={`absolute pointer-events-auto ${isEventSelected ? 'z-30' : 'z-10'} ${isSearchHighlight ? 'rounded-lg' : ''} ${isDeleting ? 'event-dissolving' : ''} ${isAppearing && !isDailyRecurring ? 'event-appearing' : ''} ${isNewlyDailyRecurring ? 'daily-recurring-fade' : ''}`}
                    style={{
                      top: position.top,
                      height: position.height,
                      left: absoluteLeft,
                      width: absoluteWidth,
                      opacity: getDailyOpacity() !== undefined ? getDailyOpacity() : (isNewlyDailyRecurring ? undefined : (isAppearing && !isDailyRecurring ? undefined : ((isBeingDragged || isBeingResized) ? 0.3 : (isCut ? 0.5 : 1)))),
                      transition: (isBeingDragged || isBeingResized || hasJustFinishedDragging || (isAppearing && !isDailyRecurring) || isDeleting || isMovingAllRecurring || isNewlyDailyRecurring) ? 'none' : 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: isSearchHighlight ? '0 0 0 4px #ef4444, 0 0 0 6px rgba(239, 68, 68, 0.5), 0 0 12px rgba(239, 68, 68, 0.4)' : 'none',
                      animationDelay: isNewlyDailyRecurring ? `${Math.max(0, (dayIndex - 1) * 0.08)}s` : undefined
                    }}
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
                      isDeleting={isDeleting}
                      continuesFromPreviousDay={continuesFromPreviousDay}
                      continuesToNextDay={continuesToNextDay}
                    />
                  </div>
                );
                });
              })}
            </div>

              {/* Current time indicator - horizontal line across all days */}
              {(() => {
                const currentHour = currentTime.getHours();
                const currentMinute = currentTime.getMinutes();
                const topPosition = currentHour * 64 + (currentMinute / 60) * 64;

                return (
                  <div
                    className="absolute left-0 right-0 z-20 pointer-events-none"
                    style={{ top: `${topPosition}px` }}
                  >
                    {/* Time badge - positioned at the right edge of time column */}
                    <div className="absolute top-1/2 -translate-y-1/2 bg-red-500 text-white px-1.5 py-0.5 rounded text-xs font-medium shadow-sm whitespace-nowrap"
                         style={{ right: 'calc(100% + 8px)' }}>
                      {currentTime.toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      }).replace(' ', '').toUpperCase()}
                    </div>
                    {/* Red line across entire calendar width */}
                    <div className="absolute left-0 right-0 h-0.5 bg-red-500" />

                    {/* Additional lines for today's column to make it appear thicker */}
                    {weekDates.some(date => date.toDateString() === todayDateString) && (
                      <>
                        {/* Line above - directly touching the main line */}
                        <div
                          className="absolute h-0.5 bg-red-500 -top-0.5"
                          style={{
                            left: `${weekDates.findIndex(date => date.toDateString() === todayDateString) * (100 / weekDates.length)}%`,
                            width: `${100 / weekDates.length}%`
                          }}
                        />
                        {/* Line below - directly touching the main line */}
                        <div
                          className="absolute h-0.5 bg-red-500 top-0.5"
                          style={{
                            left: `${weekDates.findIndex(date => date.toDateString() === todayDateString) * (100 / weekDates.length)}%`,
                            width: `${100 / weekDates.length}%`
                          }}
                        />
                      </>
                    )}
                  </div>
                );
              })()}

                {/* Resize Preview */}
                {isResizing && resizedEvent && resizePreview && (() => {
              const dayIndex = weekDates.findIndex(date =>
                date.toDateString() === new Date(resizedEvent.start).toDateString()
              );
              if (dayIndex < 0) return null;

              // Get all events that overlap with this day
              const dayStart = new Date(weekDates[dayIndex]);
              dayStart.setHours(0, 0, 0, 0);
              const dayEnd = new Date(weekDates[dayIndex]);
              dayEnd.setHours(23, 59, 59, 999);

              const dayEvents = events.filter(e => {
                const eStart = new Date(e.start);
                const eEnd = new Date(e.end);
                // Event overlaps if it doesn't end before day starts or start after day ends
                return !(eEnd <= dayStart || eStart > dayEnd);
              });
              const position = getEventPosition(
                { ...resizedEvent, start: resizePreview.start.toISOString(), end: resizePreview.end.toISOString() },
                dayIndex,
                dayEvents
              );
              if (!position) return null;

              const totalWidth = containerWidth || calendarRef.current?.offsetWidth || 800;
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
              const dayColumnWidth = rect.width / weekDates.length;
              const dayIndex = Math.floor(relativeX / dayColumnWidth);

              if (dayIndex < 0 || dayIndex >= weekDates.length) return null;

              let previewElements = [];

              if (draggedEvent) {
                const newTime = dragEnd.time;
                const originalStart = new Date(draggedEvent.start);
                const originalEnd = new Date(draggedEvent.end);
                const duration = (originalEnd.getTime() - originalStart.getTime()) / (1000 * 60 * 60);

                // Calculate new start and end times based on drag position
                const targetDate = weekDates[dayIndex];
                const newStart = new Date(targetDate);
                newStart.setHours(newTime.getHours(), newTime.getMinutes(), 0, 0);

                const newEnd = new Date(newStart);
                newEnd.setTime(newStart.getTime() + (originalEnd.getTime() - originalStart.getTime()));

                // Check if event spans multiple days
                const startDay = new Date(newStart);
                startDay.setHours(0, 0, 0, 0);
                const endDay = new Date(newEnd);
                endDay.setHours(0, 0, 0, 0);

                // Render preview on each day the event would span
                for (let i = 0; i < weekDates.length; i++) {
                  const currentDay = new Date(weekDates[i]);
                  currentDay.setHours(0, 0, 0, 0);
                  const nextDay = new Date(currentDay);
                  nextDay.setDate(nextDay.getDate() + 1);

                  // Skip if event doesn't overlap with this day
                  if (newEnd <= currentDay || newStart >= nextDay) continue;

                  // Calculate position for this day's portion
                  const dayStart = newStart > currentDay ? newStart : currentDay;
                  const dayEnd = newEnd < nextDay ? newEnd : nextDay;

                  const startHour = dayStart.getHours() + dayStart.getMinutes() / 60;
                  const endHour = dayEnd.getHours() + dayEnd.getMinutes() / 60;

                  // For events continuing to next day, extend to end of day
                  const adjustedEndHour = dayEnd < nextDay ? endHour : 24;

                  const top = (dayStart > currentDay ? startHour : 0) * 64;
                  const height = (adjustedEndHour - (dayStart > currentDay ? startHour : 0)) * 64;
                  const left = (i * dayColumnWidth) + 2;
                  const width = dayColumnWidth - 4;

                  previewElements.push({ dayIndex: i, top, height, left, width });
                }
              } else if (dragStart) {
                // Creating a new event - check if it spans multiple days
                const rawStart = new Date(Math.min(dragStart.time.getTime(), dragEnd.time.getTime()));
                const rawEnd = new Date(Math.max(dragStart.time.getTime(), dragEnd.time.getTime()));

                // Snap to grid but don't enforce minimum duration for preview
                const startTime = snapTime(rawStart, 'floor');
                const endTime = snapTime(rawEnd, 'ceil');

                // Check if creation spans multiple days
                const startDay = new Date(startTime);
                startDay.setHours(0, 0, 0, 0);
                const endDay = new Date(endTime);
                endDay.setHours(0, 0, 0, 0);

                // Render preview on each day the event would span
                for (let i = 0; i < weekDates.length; i++) {
                  const currentDay = new Date(weekDates[i]);
                  currentDay.setHours(0, 0, 0, 0);
                  const nextDay = new Date(currentDay);
                  nextDay.setDate(nextDay.getDate() + 1);

                  // Skip if event doesn't overlap with this day
                  if (endTime <= currentDay || startTime >= nextDay) continue;

                  // Calculate position for this day's portion
                  const dayStart = startTime > currentDay ? startTime : currentDay;
                  const dayEnd = endTime < nextDay ? endTime : nextDay;

                  const startHour = dayStart.getHours() + dayStart.getMinutes() / 60;
                  const endHour = dayEnd.getHours() + dayEnd.getMinutes() / 60;

                  // For events continuing to next day, extend to end of day
                  const adjustedEndHour = dayEnd < nextDay ? endHour : 24;

                  const top = (dayStart > currentDay ? startHour : 0) * 64;
                  const height = Math.max((adjustedEndHour - (dayStart > currentDay ? startHour : 0)) * 64, 8);
                  const left = (i * dayColumnWidth) + 2;
                  const width = dayColumnWidth - 4;

                  previewElements.push({ dayIndex: i, top, height, left, width });
                }
              } else {
                return null;
              }

              // If no preview elements, return null
              if (previewElements.length === 0) return null;

              // Check if the new position should be dimmed
              const now = new Date();
              const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

              const color = draggedEvent?.color ?? 'blue';

              // Render all preview elements
              return (
                <>
                  {previewElements.map((preview, index) => {
                    const previewDate = weekDates[preview.dayIndex];
                    const isToday = previewDate >= todayStart && previewDate < todayEnd;
                    const shouldDim = !isToday;

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

                    // Determine if this is the first or last segment
                    const isFirstSegment = index === 0;
                    const isLastSegment = index === previewElements.length - 1;

                    return (
                      <div
                        key={`preview-${preview.dayIndex}`}
                        className={`absolute ${bgColor} border-l-4 pointer-events-none opacity-70 event-creating ${
                          isFirstSegment && !isLastSegment ? 'rounded-t' :
                          isLastSegment && !isFirstSegment ? 'rounded-b' :
                          'rounded'
                        }`}
                        style={{
                          left: `${preview.left}px`,
                          top: `${preview.top}px`,
                          width: `${preview.width}px`,
                          height: `${preview.height}px`
                        }}
                      >
                        {/* Only show text on the first segment */}
                        {isFirstSegment && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs text-white font-medium">
                              {draggedEvent ? 'Moving' : 'Creating'}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              );
            })()}
              </div>
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
          onDelete={(event) => {
            // Check if this is a recurring event
            const isRecurringEvent =
              (event.isVirtual && event.parentId) ||  // Virtual occurrence
              (event.recurrence && event.recurrence !== 'none') ||  // Base recurring event
              (event.recurrenceGroupId && !event.isVirtual);  // Exception event

            // Clear context menu immediately for better UX
            setContextMenu(null);

            if (isRecurringEvent) {
              // Show delete modal for recurring events
              console.log('Showing delete modal for recurring event:', event.id);
              setDeleteRecurringModal({
                event,
                onDelete: (option: 'single' | 'following' | 'all') => {
                  console.log('Delete recurring with option:', option);

                  // Mark as deleting for animation
                  setInternalDeletingEventIds(prev => new Set([...prev, event.id]));
                  setFocusedEventId(null);

                  setTimeout(() => {
                    if (option === 'single') {
                      // For single deletion, add to excluded dates if it's a virtual event
                      if (event.isVirtual && event.parentId) {
                        const parentEvent = baseEvents.find(e => e.id === event.parentId);
                        if (parentEvent) {
                          const updatedParent = {
                            ...parentEvent,
                            excludedDates: [
                              ...(parentEvent.excludedDates || []),
                              event.start
                            ]
                          };
                          const updatedEvents = baseEvents.map(e =>
                            e.id === parentEvent.id ? updatedParent : e
                          );
                          addToHistory(updatedEvents, baseEvents);
                        }
                      } else {
                        // For base events or exceptions, just remove it
                        const updatedEvents = baseEvents.filter(e => e.id !== event.id);
                        addToHistory(updatedEvents, baseEvents);
                      }
                    } else if (option === 'all') {
                      // Delete the entire series
                      const groupId = event.recurrenceGroupId || event.parentId || event.id;
                      const updatedEvents = baseEvents.filter(e =>
                        e.id !== groupId &&
                        e.recurrenceGroupId !== groupId &&
                        e.parentId !== groupId
                      );
                      addToHistory(updatedEvents, baseEvents);
                    } else if (option === 'following') {
                      // Delete this and following occurrences
                      // This requires updating the recurrence rule to end before this date
                      const eventDate = new Date(event.start);

                      // Find the parent event to get recurrence pattern
                      const parentEvent = event.parentId ? baseEvents.find(e => e.id === event.parentId) : null;
                      const baseRecurringEvent = parentEvent || event;
                      let untilDateTime: Date;

                      if (baseRecurringEvent.recurrence) {
                        if (baseRecurringEvent.recurrence.includes('FREQ=DAILY')) {
                          // For daily events, previous occurrence is exactly 24 hours before
                          untilDateTime = new Date(eventDate.getTime() - 24 * 60 * 60 * 1000);
                        } else if (baseRecurringEvent.recurrence.includes('FREQ=WEEKLY')) {
                          // For weekly events, previous occurrence is exactly 7 days before
                          untilDateTime = new Date(eventDate.getTime() - 7 * 24 * 60 * 60 * 1000);
                        } else if (baseRecurringEvent.recurrence.includes('FREQ=MONTHLY')) {
                          // For monthly events, go back one month
                          untilDateTime = new Date(eventDate);
                          untilDateTime.setMonth(untilDateTime.getMonth() - 1);
                        } else {
                          // Default: just before this occurrence
                          untilDateTime = new Date(eventDate.getTime() - 1000);
                        }
                      } else {
                        // Default: just before this occurrence
                        untilDateTime = new Date(eventDate.getTime() - 1000);
                      }

                      const untilDate = untilDateTime.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

                      if (event.parentId) {
                        const parentEvent = baseEvents.find(e => e.id === event.parentId);
                        if (parentEvent && parentEvent.recurrence) {
                          // Add UNTIL to the recurrence rule
                          const updatedParent = {
                            ...parentEvent,
                            recurrence: parentEvent.recurrence.includes('UNTIL=')
                              ? parentEvent.recurrence.replace(/UNTIL=[^;]+/, `UNTIL=${untilDate}`)
                              : `${parentEvent.recurrence};UNTIL=${untilDate}`
                          };
                          const updatedEvents = baseEvents.map(e =>
                            e.id === parentEvent.id ? updatedParent : e
                          );
                          addToHistory(updatedEvents, baseEvents);
                        }
                      }
                    }

                    // Also call external handler if it exists
                    if (onDeleteEvent) {
                      onDeleteEvent(event.id);
                    }

                    // Clean up the deleting state
                    setInternalDeletingEventIds(prev => {
                      const next = new Set(prev);
                      next.delete(event.id);
                      return next;
                    });
                  }, 250);

                  setDeleteRecurringModal(null);
                }
              });
            } else {
              // Non-recurring event - delete directly with animation
              setInternalDeletingEventIds(prev => new Set([...prev, event.id]));
              setFocusedEventId(null);

              setTimeout(() => {
                const updatedEvents = baseEvents.filter(e => e.id !== event.id);
                addToHistory(updatedEvents, baseEvents);

                if (onDeleteEvent) {
                  onDeleteEvent(event.id);
                }

                setInternalDeletingEventIds(prev => {
                  const next = new Set(prev);
                  next.delete(event.id);
                  return next;
                });
              }, 250);
            }
          }}
        />
      )}

      {/* Edit Recurring Modal */}
      {editRecurringModal && (
        <EditRecurringModal
          event={editRecurringModal.event}
          action={editRecurringModal.action}
          onClose={() => {
            setEditRecurringModal(null);
            // Reset ALL drag and resize states completely
            setResizePreview(null);
            setDragEnd(null);
            setDragStart(null);
            setDragOffset(null);
            setDraggedEvent(null);
            setResizedEvent(null);
            setResizeEdge(null);
            setIsDragging(false);
            setIsResizing(false);
          }}
          onConfirm={(option) => {
            console.log('EditRecurringModal onConfirm called with option:', option);
            const modal = editRecurringModal;
            if (option === 'single') {
              console.log('Processing single event exception for event:', modal.event.id);

              // Check what type of event this is
              const isBaseEvent = modal.event.recurrence && modal.event.recurrence !== 'none' && !modal.event.isVirtual;
              const isExceptionEvent = !modal.event.recurrence && modal.event.recurrenceGroupId && !modal.event.isVirtual;
              const parentId = isBaseEvent ? modal.event.id : modal.event.parentId;

              console.log('Event type - Base:', isBaseEvent, 'Exception:', isExceptionEvent, 'Parent ID:', parentId);

              // If this is already an exception event, just update it directly
              if (isExceptionEvent) {
                console.log('Updating existing exception event directly');
                const updatedEvents = baseEvents.map(e => {
                  if (e.id === modal.event.id) {
                    return {
                      ...e,
                      start: modal.newStart?.toISOString() || e.start,
                      end: modal.newEnd?.toISOString() || e.end,
                    };
                  }
                  return e;
                });
                addToHistory(updatedEvents, baseEvents);
                setEditRecurringModal(null);
                return;
              }

              // Create the exception event with the new times
              // IMPORTANT: Exception events must NOT have recurrence - they are single occurrences
              const exceptionEvent: CalendarEvent = {
                ...modal.event,
                id: `${parentId}-exception-${Date.now()}`,
                start: modal.newStart?.toISOString() || modal.event.start,
                end: modal.newEnd?.toISOString() || modal.event.end,
                isVirtual: false, // This is now a real exception event
                parentId: isBaseEvent ? undefined : parentId, // No parentId for base event exceptions
                recurrenceGroupId: modal.event.recurrenceGroupId || modal.event.id,
                recurrence: undefined, // CRITICAL: Exception events are NOT recurring!
                excludedDates: undefined, // Exception events don't have excluded dates
              };

              console.log('Created exception event:', exceptionEvent);

              // Handle exception creation locally to avoid duplicate processing
              // We should NOT call onUpdateEvents for this as it would trigger handleSaveEvent
              // which has its own exception creation logic, leading to duplicates
              console.log('Handling exception creation locally in CalendarModule');

              const originalDateStr = new Date(modal.event.start).toISOString();
              const originalDate = new Date(originalDateStr).toISOString().split('T')[0];

              const existingException = baseEvents.find(e =>
                e.recurrenceGroupId === modal.event.recurrenceGroupId &&
                !e.isVirtual &&
                !e.recurrence &&
                new Date(e.start).toISOString().split('T')[0] === originalDate
              );

              if (existingException) {
                console.log('Updating existing exception event:', existingException.id);
                // Update the existing exception event instead of creating a new one
                const updatedEvents = baseEvents.map(e => {
                  if (e.id === existingException.id) {
                    return {
                      ...e,
                      start: modal.newStart?.toISOString() || modal.event.start,
                      end: modal.newEnd?.toISOString() || modal.event.end,
                    };
                  }
                  return e;
                });
                addToHistory(updatedEvents, baseEvents);
              } else {
                console.log('Creating new exception event and adding exclusion date');
                // Add exclusion date and create exception event
                const updatedEvents = baseEvents.map(e => {
                  // For base events moving themselves, or virtual events, we need to add exclusion to the parent
                  if (e.id === parentId) {
                    const existingExclusions = e.excludedDates || [];
                    const isAlreadyExcluded = existingExclusions.some(excluded => {
                      const excludedDate = new Date(excluded).toISOString().split('T')[0];
                      const originalDate = new Date(originalDateStr).toISOString().split('T')[0];
                      return excludedDate === originalDate;
                    });

                    return {
                      ...e,
                      excludedDates: isAlreadyExcluded ? existingExclusions : [...existingExclusions, originalDateStr]
                    };
                  }
                  return e;
                });

                // Clear parentId from the exception event
                const finalExceptionEvent = {
                  ...exceptionEvent,
                  parentId: undefined
                };

                updatedEvents.push(finalExceptionEvent);
                addToHistory(updatedEvents, baseEvents);
              }
            } else if (option === 'following') {
              console.log('Processing this and following events for event:', modal.event.id);

              // Check what type of event this is
              const isBaseEvent = modal.event.recurrence && modal.event.recurrence !== 'none' && !modal.event.isVirtual;
              const isVirtualEvent = modal.event.isVirtual && modal.event.parentId;
              // const isExceptionEvent = !modal.event.recurrence && modal.event.recurrenceGroupId && !modal.event.isVirtual; // Not currently used

              let parentId = isBaseEvent ? modal.event.id : modal.event.parentId;

              console.log('Event type detection:', {
                isBaseEvent,
                isVirtualEvent,
                modalEventId: modal.event.id,
                modalEventParentId: modal.event.parentId,
                modalEventRecurrence: modal.event.recurrence,
                modalEventIsVirtual: modal.event.isVirtual,
                determinedParentId: parentId
              });

              // For split series events, we need to handle them specially
              const isSplitSeries = modal.event.id?.includes('-split-');
              if (isSplitSeries) {
                // This is already a split series, we should handle it differently
                parentId = modal.event.id;
              }

              // If this is a virtual event from a split series, find the parent split series
              if (isVirtualEvent && modal.event.parentId?.includes('-split-')) {
                parentId = modal.event.parentId;
                console.log('Virtual event from split series detected:', {
                  virtualEventId: modal.event.id,
                  parentSplitSeriesId: parentId
                });
              }

              // Check if we're moving back to align with another series in the same group
              // const timeDiff = modal.newStart ? modal.newStart.getTime() - new Date(modal.event.start).getTime() : 0; // Not currently used
              const otherSeriesInGroup = baseEvents.filter(e =>
                e.recurrenceGroupId === modal.event.recurrenceGroupId &&
                e.id !== modal.event.id &&
                e.recurrence
              );

              // Check if this move would align with an existing series
              let shouldMergeWithExisting = false;
              let seriestoMergeWith = null;

              for (const series of otherSeriesInGroup) {
                const seriesStart = new Date(series.start);
                const newStart = modal.newStart || new Date(modal.event.start);

                // Extract time components for comparison
                const seriesTime = seriesStart.getHours() * 60 + seriesStart.getMinutes();
                const newTime = newStart.getHours() * 60 + newStart.getMinutes();

                // If moving to the same time as another series in the group, we should merge
                // Also check that this series could actually generate events at the merge point
                if (seriesTime === newTime) {
                  // Verify this series would generate an event on the date we're merging
                  const mergeDate = new Date(modal.event.start);
                  const seriesStartDate = new Date(series.start);

                  // Check if the series pattern would include this date
                  let wouldGenerate = false;
                  if (series.recurrence?.includes('FREQ=DAILY')) {
                    wouldGenerate = true; // Daily always generates
                  } else if (series.recurrence?.includes('FREQ=WEEKLY')) {
                    // Check if it's the same day of week
                    wouldGenerate = mergeDate.getDay() === seriesStartDate.getDay();
                  } else if (series.recurrence?.includes('FREQ=MONTHLY')) {
                    // Check if it's the same day of month
                    wouldGenerate = mergeDate.getDate() === seriesStartDate.getDate();
                  }

                  if (wouldGenerate) {
                    shouldMergeWithExisting = true;
                    seriestoMergeWith = series;
                    break;
                  }
                }
              }

              if (shouldMergeWithExisting && seriestoMergeWith) {
                console.log('Merging split series back with original:', seriestoMergeWith.id);

                // When merging back, simply remove the UNTIL constraint from the original series
                // and delete the split series - this restores the continuous series
                const updatedEvents = baseEvents.map(e => {
                  if (e.id === seriestoMergeWith.id) {
                    // Remove UNTIL constraint to restore full series
                    let updatedRecurrence = e.recurrence || '';
                    updatedRecurrence = updatedRecurrence.replace(/;?UNTIL=[^;]*/g, '');

                    return {
                      ...e,
                      recurrence: updatedRecurrence,
                      // Also clear any excluded dates that might have been added
                      excludedDates: (e.excludedDates || []).filter(date => {
                        // Keep excluded dates that are not related to this merge
                        const excludedDate = new Date(date);
                        const eventDate = new Date(modal.event.start);
                        // Remove exclusions for dates at or after the merge point
                        return excludedDate < eventDate;
                      })
                    };
                  }
                  return e;
                }).filter(e => {
                  // Remove the current split series since we're merging back
                  if (isSplitSeries && e.id === modal.event.id) {
                    return false;
                  }
                  // Also remove any other split series in the same group that would conflict
                  if (e.id?.includes('-split-') && e.recurrenceGroupId === modal.event.recurrenceGroupId) {
                    const splitStart = new Date(e.start);
                    const mergeStart = new Date(modal.event.start);
                    // Remove split series that start at or after the merge point
                    if (splitStart >= mergeStart) {
                      return false;
                    }
                  }
                  return true;
                });

                addToHistory(updatedEvents, baseEvents);
              } else {
                // Normal split behavior - create a new series
                const eventDate = new Date(modal.event.start);

                // Calculate UNTIL date to properly exclude this and following occurrences
                // The key is to set UNTIL to the exact start time of the last occurrence we want to keep

                const baseEvent = baseEvents.find(e => e.id === parentId);
                const recurrencePattern = baseEvent?.recurrence || modal.event.recurrence || '';

                let untilDateTime: Date;

                // Find the previous occurrence's exact time
                if (recurrencePattern.includes('FREQ=DAILY')) {
                  // For daily events, previous occurrence is exactly 24 hours before
                  untilDateTime = new Date(eventDate.getTime() - 24 * 60 * 60 * 1000);
                } else if (recurrencePattern.includes('FREQ=WEEKLY')) {
                  // For weekly events, previous occurrence is exactly 7 days before
                  untilDateTime = new Date(eventDate.getTime() - 7 * 24 * 60 * 60 * 1000);
                } else if (recurrencePattern.includes('FREQ=MONTHLY')) {
                  // For monthly events, go back one month
                  untilDateTime = new Date(eventDate);
                  untilDateTime.setMonth(untilDateTime.getMonth() - 1);
                } else {
                  // For other patterns, use a precise cutoff just before this event
                  untilDateTime = new Date(eventDate.getTime() - 1000); // 1 second before
                }

                // The UNTIL date should be at the exact time of the last included occurrence
                // This ensures the recurrence generator stops at the right point

                // Get the original recurrence pattern before modifying the base event
                console.log('Looking for parent in baseEvents:', {
                  parentIdToFind: parentId,
                  baseEventIds: baseEvents.map(e => ({ id: e.id, recurrence: e.recurrence }))
                });

                const originalBaseEvent = baseEvents.find(e => e.id === parentId);

                // Get the recurrence from the base event or from modal.event if it's the base
                let originalRecurrence = originalBaseEvent?.recurrence?.replace(/;?UNTIL=[^;]*/g, '') || '';

                // For split series, ensure we get the recurrence
                if (isSplitSeries && modal.event.recurrence) {
                  originalRecurrence = modal.event.recurrence.replace(/;?UNTIL=[^;]*/g, '');
                }

                if (!originalRecurrence && isBaseEvent && modal.event.recurrence) {
                  originalRecurrence = modal.event.recurrence.replace(/;?UNTIL=[^;]*/g, '');
                }

                // Last resort: if we're dealing with a virtual event, find parent by different means
                if (!originalRecurrence && isVirtualEvent && parentId) {
                  const parentEvent = baseEvents.find(e => e.id === parentId);
                  if (parentEvent?.recurrence) {
                    originalRecurrence = parentEvent.recurrence.replace(/;?UNTIL=[^;]*/g, '');
                  }
                }

                console.log('Creating split series:', {
                  parentId,
                  originalRecurrence,
                  hasOriginalBaseEvent: !!originalBaseEvent,
                  isBaseEvent,
                  isVirtualEvent,
                  modalEventRecurrence: modal.event.recurrence,
                  modalEventTitle: modal.event.title,
                  originalStart: originalBaseEvent?.start || modal.event.start,
                  newStart: modal.newStart?.toISOString(),
                  willUseRecurrence: originalRecurrence ||
                                     (isBaseEvent && modal.event.recurrence ? modal.event.recurrence.replace(/;?UNTIL=[^;]*/g, '') : '') ||
                                     'FREQ=DAILY'
                });

                const updatedEvents = baseEvents.map(e => {
                  if (e.id === parentId) {
                    // Update the original series to end before this occurrence
                    let updatedRecurrence = e.recurrence || '';
                    // Format the UNTIL date in RRULE format (YYYYMMDDTHHmmssZ)
                    const untilDate = untilDateTime.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

                    if (updatedRecurrence) {
                      updatedRecurrence = updatedRecurrence.replace(/;?UNTIL=[^;]*/g, '');
                      updatedRecurrence = `${updatedRecurrence};UNTIL=${untilDate}`;
                    }

                    // If we're moving the base event itself, also add an exclusion for its original date
                    // This prevents the base event from appearing at its original location
                    let updatedExclusions = [...(e.excludedDates || [])];
                    if (isBaseEvent || isSplitSeries) {
                      const originalDateStr = modal.event.start;
                      if (!updatedExclusions.some(d => d === originalDateStr)) {
                        console.log('Adding exclusion date for base/split event:', {
                          originalDate: originalDateStr,
                          existingExclusions: updatedExclusions,
                          isBaseEvent,
                          isSplitSeries
                        });
                        updatedExclusions.push(originalDateStr);
                      }
                    }

                    // If this is a virtual event from a split series, add exclusion for the virtual event date
                    if (isVirtualEvent && modal.event.parentId?.includes('-split-')) {
                      const virtualEventDate = modal.event.start;
                      if (!updatedExclusions.some(d => d === virtualEventDate)) {
                        console.log('Adding exclusion date for virtual event from split series:', {
                          virtualEventDate,
                          parentId: e.id
                        });
                        updatedExclusions.push(virtualEventDate);
                      }
                    }

                    const updatedEvent = {
                      ...e,
                      recurrence: updatedRecurrence,
                      excludedDates: updatedExclusions
                    };

                    console.log('Updated original series:', {
                      id: updatedEvent.id,
                      recurrence: updatedEvent.recurrence,
                      excludedDates: updatedEvent.excludedDates,
                      untilDate
                    });

                    return updatedEvent;
                  }
                  return e;
                });

                // Create a new recurring series starting from this date with the new time
                // Use modal.event as base to ensure all properties are present, then override
                // If we're dealing with a base event directly, use it; otherwise use what we found
                const baseForNewEvent = (isBaseEvent || isSplitSeries) ? modal.event : (originalBaseEvent || modal.event);

                // Ensure we have a recurrence pattern
                const finalRecurrence = originalRecurrence ||
                                       (isBaseEvent && modal.event.recurrence ? modal.event.recurrence.replace(/;?UNTIL=[^;]*/g, '') : '') ||
                                       'FREQ=DAILY'; // Last resort default

                const newBaseEvent: CalendarEvent = {
                  ...baseForNewEvent, // Use the base event or modal event as foundation
                  id: `${parentId || modal.event.id}-split-${Date.now()}`,
                  start: modal.newStart?.toISOString() || modal.event.start,
                  end: modal.newEnd?.toISOString() || modal.event.end,
                  isVirtual: false,
                  parentId: undefined,
                  recurrence: finalRecurrence, // Use the final recurrence pattern
                  recurrenceGroupId: modal.event.recurrenceGroupId || modal.event.id || parentId,
                  excludedDates: undefined
                };

                console.log('New split series event:', {
                  id: newBaseEvent.id,
                  recurrence: newBaseEvent.recurrence,
                  start: newBaseEvent.start,
                  end: newBaseEvent.end,
                  title: newBaseEvent.title,
                  recurrenceGroupId: newBaseEvent.recurrenceGroupId,
                  hasRecurrence: !!newBaseEvent.recurrence,
                  recurrenceLength: newBaseEvent.recurrence?.length
                });

                // Verify the recurrence is set
                if (!newBaseEvent.recurrence) {
                  console.error('WARNING: New split series has no recurrence pattern!');
                }

                updatedEvents.push(newBaseEvent);
                addToHistory(updatedEvents, baseEvents);
              }

            } else if (option === 'all') {
              console.log('Processing all events for event:', modal.event.id);

              // Set flag to disable animations for all events
              setIsMovingAllRecurring(true);

              // Determine the recurrence group ID for this series
              const recurrenceGroupId = modal.event.recurrenceGroupId || modal.event.parentId || modal.event.id;
              console.log('Moving all events in recurrence group:', recurrenceGroupId);

              // Calculate the time difference for the move
              const timeDiff = modal.newStart ? modal.newStart.getTime() - new Date(modal.event.start).getTime() : 0;
              const sizeDiff = modal.newEnd && modal.newStart ?
                (modal.newEnd.getTime() - modal.newStart.getTime()) -
                (new Date(modal.event.end).getTime() - new Date(modal.event.start).getTime()) : 0;

              // Find all events in the recurrence group
              const groupEvents = baseEvents.filter(e => {
                const belongsToGroup =
                  e.id === recurrenceGroupId ||
                  e.recurrenceGroupId === recurrenceGroupId ||
                  e.parentId === recurrenceGroupId ||
                  (e.id && e.id.startsWith(`${recurrenceGroupId}-split-`));
                return belongsToGroup;
              });

              // Find the original base event and any split series
              let originalBaseEvent = groupEvents.find(e => e.id === recurrenceGroupId && e.recurrence);
              const splitSeries = groupEvents.filter(e => e.id && e.id.startsWith(`${recurrenceGroupId}-split-`) && e.recurrence);
              const exceptionEvents = groupEvents.filter(e => !e.recurrence && !e.isVirtual);

              // If the original base event has been turned into an exception (no recurrence),
              // we need to restore it as a recurring event when moving all
              const baseEventIsException = !originalBaseEvent && groupEvents.find(e => e.id === recurrenceGroupId && !e.recurrence);

              console.log('Group analysis:', {
                originalBaseEvent: originalBaseEvent?.id,
                baseEventIsException: !!baseEventIsException,
                splitSeriesCount: splitSeries.length,
                exceptionEventsCount: exceptionEvents.length
              });

              // Check if we need to consolidate split series OR restore recurrence
              const shouldConsolidate = splitSeries.length > 0 || baseEventIsException;

              let updatedEvents;

              if (shouldConsolidate && (originalBaseEvent || baseEventIsException)) {
                console.log('Consolidating/restoring recurring series');

                // Use the base event if it exists, or the exception event
                const baseToUse = originalBaseEvent || baseEventIsException;

                // When consolidating, we need to restore the recurrence pattern
                // If the base event lost its recurrence, we need to restore it
                let consolidatedRecurrence = baseToUse.recurrence || '';

                // If no recurrence exists (base became exception), restore default daily recurrence
                // In a real app, we'd want to remember the original pattern
                if (!consolidatedRecurrence && baseEventIsException) {
                  console.log('Restoring recurrence for exception base event');
                  consolidatedRecurrence = 'FREQ=DAILY'; // Default to daily
                }

                // Remove any UNTIL constraint from the recurrence pattern
                consolidatedRecurrence = consolidatedRecurrence.replace(/;?UNTIL=[^;]*/g, '');

                // Collect all excluded dates from original and split series
                let consolidatedExclusions = [...(baseToUse.excludedDates || [])];

                // Add excluded dates from split series if any
                splitSeries.forEach(splitEvent => {
                  if (splitEvent.excludedDates) {
                    consolidatedExclusions = [...consolidatedExclusions, ...splitEvent.excludedDates];
                  }
                });

                // Remove duplicate exclusions
                consolidatedExclusions = [...new Set(consolidatedExclusions)];

                // When moving all events, we want to clear excluded dates since we're moving everything together
                // Exception events will be moved as well, so no need for exclusions
                consolidatedExclusions = [];

                // Create the consolidated base event
                const consolidatedBaseEvent = {
                  ...baseToUse,
                  start: modal.newStart?.toISOString() || new Date(new Date(baseToUse.start).getTime() + timeDiff).toISOString(),
                  end: modal.newEnd?.toISOString() || new Date(new Date(baseToUse.end).getTime() + timeDiff + sizeDiff).toISOString(),
                  recurrence: consolidatedRecurrence,
                  excludedDates: consolidatedExclusions
                };

                console.log('Consolidated event:', {
                  id: consolidatedBaseEvent.id,
                  recurrence: consolidatedRecurrence,
                  exclusionsCount: consolidatedExclusions.length
                });

                // Update events: keep the consolidated base event, remove split series and exceptions
                updatedEvents = baseEvents.map(e => {
                  // Remove split series
                  if (e.id && e.id.startsWith(`${recurrenceGroupId}-split-`) && e.recurrence) {
                    return null; // Mark for removal
                  }

                  // Update the original base event with consolidated data
                  if (e.id === recurrenceGroupId) {
                    return consolidatedBaseEvent;
                  }

                  // Remove all exception events in the group since we're consolidating
                  // The recurrence will regenerate all events
                  const belongsToGroup =
                    e.recurrenceGroupId === recurrenceGroupId ||
                    e.parentId === recurrenceGroupId;

                  if (belongsToGroup && !e.recurrence && !e.isVirtual) {
                    return null; // Remove exception events
                  }

                  return e;
                }).filter(e => e !== null); // Remove nulls

              } else {
                // No consolidation needed, just update all events normally
                updatedEvents = baseEvents.map(e => {
                  // Check if this event belongs to the same recurrence group
                  const belongsToGroup =
                    e.id === recurrenceGroupId ||
                    e.recurrenceGroupId === recurrenceGroupId ||
                    e.parentId === recurrenceGroupId ||
                    (e.id && e.id.startsWith(`${recurrenceGroupId}-split-`));

                  if (belongsToGroup && e.recurrence) {
                    // This is a base event or split series in the group
                    const baseStart = new Date(e.start);
                    const baseEnd = new Date(e.end);

                    console.log('Updating series in group:', {
                      eventId: e.id,
                      oldStart: e.start,
                      newStart: new Date(baseStart.getTime() + timeDiff).toISOString()
                    });

                    return {
                      ...e,
                      start: new Date(baseStart.getTime() + timeDiff).toISOString(),
                      end: new Date(baseEnd.getTime() + timeDiff + sizeDiff).toISOString()
                    };
                  } else if (belongsToGroup && !e.recurrence && !e.isVirtual) {
                    // This is an exception event in the group
                    const eventStart = new Date(e.start);
                    const eventEnd = new Date(e.end);

                    return {
                      ...e,
                      start: new Date(eventStart.getTime() + timeDiff).toISOString(),
                      end: new Date(eventEnd.getTime() + timeDiff + sizeDiff).toISOString()
                    };
                  }
                  return e;
                });
              }

              // Use baseEvents as currentEvents to avoid including virtual events in history
              addToHistory(updatedEvents, baseEvents);

              // Clear the flag after a short delay to allow the change to propagate
              setTimeout(() => {
                setIsMovingAllRecurring(false);
              }, 100);
            }

            console.log('Closing EditRecurringModal and resetting states');
            setEditRecurringModal(null);
            // Reset ALL drag and resize states completely
            setResizePreview(null);
            setDragEnd(null);
            setDragStart(null);
            setDragOffset(null);
            setDraggedEvent(null);
            setResizedEvent(null);
            setResizeEdge(null);
            setIsDragging(false);
            setIsResizing(false);
          }}
        />
      )}

      {/* Delete Recurring Modal */}
      {deleteRecurringModal && (
        <DeleteRecurringModal
          event={deleteRecurringModal.event}
          onClose={() => setDeleteRecurringModal(null)}
          onConfirm={(option) => {
            deleteRecurringModal.onDelete(option);
          }}
        />
      )}

      {/* Empty state welcome message - simple fixed center */}
      {events.length === 0 && !hideWelcome && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50 animate-fade-in-delayed">
          <div
            className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-blue-100 p-10 text-center max-w-xl pointer-events-auto"
            style={{
              opacity: hideWelcome ? 0 : 1,
              transform: hideWelcome ? 'scale(0.9)' : 'scale(1)',
              transition: 'all 0.5s ease-out'
            }}
          >
            <div className="mb-6">
              <svg className="w-20 h-20 mx-auto text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3a1 1 0 011-1h6a1 1 0 011 1v4m4 0v10a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h12zM9 11h6M9 15h6" />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold text-gray-700 mb-3">Your calendar is waiting for magic ✨</h3>
            <p className="text-gray-500 text-lg mb-6">Drag anywhere to create your first event and bring it to life!</p>
            <div className="flex justify-center gap-3">
              <span className="inline-block w-3 h-3 bg-blue-400 rounded-full loading-dot"></span>
              <span className="inline-block w-3 h-3 bg-purple-400 rounded-full loading-dot"></span>
              <span className="inline-block w-3 h-3 bg-green-400 rounded-full loading-dot"></span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};