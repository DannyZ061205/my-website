'use client';

import { useState, useRef, useEffect } from 'react';
import { TodoModule } from '@/components/todo/TodoModule';
import { CalendarModule } from '@/components/calendar/CalendarModule';
import { ChatModule } from '@/components/chat/ChatModule';
import { EventEditor } from '@/components/event-editor/EventEditor';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { CalendarEvent } from '@/types';

// Helper function to check if an event has been modified from its default state
function hasEventBeenModified(event: CalendarEvent): boolean {
  // Check if any meaningful field has been set/modified
  return !!(
    event.title?.trim() ||           // Has a title
    event.description?.trim() ||     // Has a description
    event.category ||                 // Has a category
    event.reminder ||                 // Has old-style reminder
    event.reminders?.length ||        // Has new-style reminders
    event.meeting ||                  // Has a meeting
    event.recurrence ||               // Has recurrence
    event.color !== 'blue'           // Color changed from default
    // Note: We don't check time changes here as those would be handled separately
  );
}

export default function ChronosApp() {
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [leftPanelWidth, setLeftPanelWidth] = useState(384); // w-96 = 384px
  const [rightPanelWidth, setRightPanelWidth] = useState(384);
  const [leftPanelAnimating, setLeftPanelAnimating] = useState(false);
  const [rightPanelAnimating, setRightPanelAnimating] = useState(false);
  const [leftPanelHidden, setLeftPanelHidden] = useState(false);
  const [rightPanelHidden, setRightPanelHidden] = useState(false);
  const [, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const [showOnlyToday, setShowOnlyToday] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const selectedEventRef = useRef<CalendarEvent | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    selectedEventRef.current = selectedEvent;
  }, [selectedEvent]);

  const [isEventChanging, setIsEventChanging] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | 'up' | 'down'>('right');
  const [transitionType, setTransitionType] = useState<'slide' | 'fade' | 'zoom'>('slide');
  const [rightContentTransitioning, setRightContentTransitioning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Merged state - when both separators are in the middle
  const [panelsMerged, setPanelsMerged] = useState(false);
  const [mergedSeparatorPosition, setMergedSeparatorPosition] = useState(50); // percentage from left
  const [calendarWidth, setCalendarWidth] = useState(0);
  const CALENDAR_MIN_WIDTH = 250; // Minimum width before calendar disappears - reduced for less sensitivity
  const MERGE_THRESHOLD = 30; // Distance in pixels where separators snap together

  // Animation states for smooth transitions
  const [leftPanelCollapsing, setLeftPanelCollapsing] = useState(false);
  const [rightPanelCollapsing, setRightPanelCollapsing] = useState(false);
  const [leftPanelExpanding, setLeftPanelExpanding] = useState(false);
  const [rightPanelExpanding, setRightPanelExpanding] = useState(false);
  // Animation states for double-click restoration
  const [leftPanelRestoring, setLeftPanelRestoring] = useState(false);
  const [rightPanelRestoring, setRightPanelRestoring] = useState(false);

  // Double-tap tracking
  const lastLeftArrowRef = useRef<number>(0);
  const lastRightArrowRef = useRef<number>(0);

  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([
    {
      id: 'test-recurring-1',
      title: 'Daily Standup',
      start: new Date(2025, 8, 22, 9, 0).toISOString(), // Monday Sep 22, 2025 9:00 AM (the visible week)
      end: new Date(2025, 8, 22, 9, 30).toISOString(),   // Monday Sep 22, 2025 9:30 AM
      timezone: 'America/New_York',
      color: 'blue',
      recurrence: 'FREQ=DAILY',
      recurrenceGroupId: 'test-recurring-1-group',
      isRecurrenceBase: true
    }
  ]);

  // Keep selectedEvent in sync with calendarEvents when dragged
  useEffect(() => {
    if (selectedEvent) {
      const updatedEvent = calendarEvents.find(e => e.id === selectedEvent.id);
      if (updatedEvent && (updatedEvent.start !== selectedEvent.start || updatedEvent.end !== selectedEvent.end)) {
        // Event position has changed (e.g., from drag), update selectedEvent
        setSelectedEvent(updatedEvent);
      }
    }
  }, [calendarEvents, selectedEvent]);

  // Don't auto-delete any events - let users manage their own events
  // Empty events should persist until explicitly deleted by the user

  const leftResizeRef = useRef<HTMLDivElement>(null);
  const rightResizeRef = useRef<HTMLDivElement>(null);
  const mergedResizeRef = useRef<HTMLDivElement>(null);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [leftSeparatorClicked, setLeftSeparatorClicked] = useState(false);
  const [rightSeparatorClicked, setRightSeparatorClicked] = useState(false);
  const [isResizingMerged, setIsResizingMerged] = useState(false);
  const [deletingEventIds, setDeletingEventIds] = useState<Set<string>>(new Set());

  // Double-click tracking for separators
  const lastLeftSeparatorClick = useRef<number>(0);
  const lastRightSeparatorClick = useRef<number>(0);
  const lastMergedSeparatorClick = useRef<number>(0);


  // Handle double-click on merged separator to restore three-panel view
  const handleMergedSeparatorClick = () => {
    const now = Date.now();
    const timeSinceLastClick = now - lastMergedSeparatorClick.current;

    if (timeSinceLastClick < 300) {
      // Double-click detected - restore three-panel view
      setPanelsMerged(false);
      setLeftPanelRestoring(true);
      setRightPanelRestoring(true);
      // Restore original panel widths
      setTimeout(() => {
        setLeftPanelWidth(384);
        setRightPanelWidth(384);
      }, 10);
      setTimeout(() => {
        setLeftPanelRestoring(false);
        setRightPanelRestoring(false);
      }, 400);
      lastMergedSeparatorClick.current = 0;
    } else {
      lastMergedSeparatorClick.current = now;
    }
  };

  // Handle double-click on left separator
  const handleLeftSeparatorClick = () => {
    const now = Date.now();
    const timeSinceLastClick = now - lastLeftSeparatorClick.current;

    // Show click animation
    setLeftSeparatorClicked(true);
    setTimeout(() => setLeftSeparatorClicked(false), 200);

    if (timeSinceLastClick < 300) {
      // Double-click detected - toggle panel
      setShowLeftPanel(!showLeftPanel);
      if (showLeftPanel) {
        setLeftPanelCollapsing(true);
        setTimeout(() => {
          setLeftPanelCollapsing(false);
          setLeftPanelHidden(true);
        }, 300);
      } else {
        setLeftPanelHidden(false);
        setLeftPanelExpanding(true);
        setTimeout(() => setLeftPanelExpanding(false), 300);
      }
      lastLeftSeparatorClick.current = 0;
    } else {
      lastLeftSeparatorClick.current = now;
    }
  };

  // Handle double-click on right separator
  const handleRightSeparatorClick = () => {
    const now = Date.now();
    const timeSinceLastClick = now - lastRightSeparatorClick.current;

    // Show click animation
    setRightSeparatorClicked(true);
    setTimeout(() => setRightSeparatorClicked(false), 200);

    if (timeSinceLastClick < 300) {
      // Double-click detected - toggle panel
      setShowRightPanel(!showRightPanel);
      if (showRightPanel) {
        setRightPanelCollapsing(true);
        setTimeout(() => {
          setRightPanelCollapsing(false);
          setRightPanelHidden(true);
        }, 300);
      } else {
        setRightPanelHidden(false);
        setRightPanelExpanding(true);
        setTimeout(() => setRightPanelExpanding(false), 300);
      }
      lastRightSeparatorClick.current = 0;
    } else {
      lastRightSeparatorClick.current = now;
    }
  };

  // Handle arrow double-tap for left panel
  const handleLeftArrowClick = () => {
    const now = Date.now();
    const timeSinceLastTap = now - lastLeftArrowRef.current;

    if (timeSinceLastTap < 300) {
      // Double-tap detected - toggle panel
      setShowLeftPanel(!showLeftPanel);
      if (showLeftPanel) {
        setLeftPanelCollapsing(true);
        setTimeout(() => {
          setLeftPanelCollapsing(false);
          setLeftPanelHidden(true);
        }, 300);
      } else {
        setLeftPanelHidden(false);
        setLeftPanelExpanding(true);
        setTimeout(() => setLeftPanelExpanding(false), 300);
      }
      lastLeftArrowRef.current = 0;
    } else {
      lastLeftArrowRef.current = now;
    }
  };

  // Handle arrow double-tap for right panel
  const handleRightArrowClick = () => {
    const now = Date.now();
    const timeSinceLastTap = now - lastRightArrowRef.current;

    if (timeSinceLastTap < 300) {
      // Double-tap detected - toggle panel
      setShowRightPanel(!showRightPanel);
      if (showRightPanel) {
        setRightPanelCollapsing(true);
        setTimeout(() => {
          setRightPanelCollapsing(false);
          setRightPanelHidden(true);
        }, 300);
      } else {
        setRightPanelHidden(false);
        setRightPanelExpanding(true);
        setTimeout(() => setRightPanelExpanding(false), 300);
      }
      lastRightArrowRef.current = 0;
    } else {
      lastRightArrowRef.current = now;
    }
  };

  // Handle event deletion (UI updates only - CalendarModule handles the actual deletion)
  const handleDeleteEvent = (eventId: string) => {
    console.log('handleDeleteEvent called with ID:', eventId);

    // If this was the selected event, close the editor immediately
    if (selectedEvent?.id === eventId) {
      setSelectedEvent(null);
    }

    // Note: The actual deletion is handled by CalendarModule through its history system
    // This ensures undo/redo works correctly with the event's last position
  };

  // Update resize handler for merged separator
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingMerged && mergedResizeRef.current) {
        const containerWidth = window.innerWidth;
        const newPosition = (e.clientX / containerWidth) * 100;
        setMergedSeparatorPosition(Math.max(20, Math.min(80, newPosition)));
      } else if (isResizingLeft && leftResizeRef.current) {
        const newWidth = e.clientX;
        const maxWidth = window.innerWidth * 0.75; // 75% of window width
        const minWidth = 200;
        setLeftPanelWidth(Math.max(minWidth, Math.min(maxWidth, newWidth)));

        // Check if we should merge
        const rightEdge = window.innerWidth - rightPanelWidth;
        const middlePoint = window.innerWidth / 2;
        const leftDistance = Math.abs(newWidth - middlePoint);
        const rightDistance = Math.abs(rightEdge - middlePoint);

        if (leftDistance < MERGE_THRESHOLD && rightDistance < MERGE_THRESHOLD) {
          setPanelsMerged(true);
          setMergedSeparatorPosition(50);
        }
      } else if (isResizingRight && rightResizeRef.current) {
        const newWidth = window.innerWidth - e.clientX;
        const maxWidth = window.innerWidth * 0.75; // 75% of window width
        const minWidth = 200;
        setRightPanelWidth(Math.max(minWidth, Math.min(maxWidth, newWidth)));

        // Check if we should merge
        const leftEdge = leftPanelWidth;
        const middlePoint = window.innerWidth / 2;
        const leftDistance = Math.abs(leftEdge - middlePoint);
        const rightDistance = Math.abs((window.innerWidth - newWidth) - middlePoint);

        if (leftDistance < MERGE_THRESHOLD && rightDistance < MERGE_THRESHOLD) {
          setPanelsMerged(true);
          setMergedSeparatorPosition(50);
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      setIsResizingRight(false);
      setIsResizingMerged(false);
    };

    if (isResizingLeft || isResizingRight || isResizingMerged) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingLeft, isResizingRight, isResizingMerged, leftPanelWidth, rightPanelWidth]);

  // Check for calendar minimum width
  useEffect(() => {
    const containerWidth = window.innerWidth;
    const calendarSpace = containerWidth - leftPanelWidth - rightPanelWidth;

    if (calendarSpace < CALENDAR_MIN_WIDTH && showLeftPanel && showRightPanel) {
      // Merge panels when calendar gets too small
      setPanelsMerged(true);
      setMergedSeparatorPosition(50);
    }
  }, [leftPanelWidth, rightPanelWidth, showLeftPanel, showRightPanel]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevent text selection during resize
  useEffect(() => {
    if (isResizingLeft || isResizingRight || isResizingMerged) {
      document.body.style.userSelect = 'none';
      document.body.style.webkitUserSelect = 'none';
      document.body.style.cursor = 'ew-resize';
    } else {
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
      document.body.style.cursor = '';
    }

    return () => {
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizingLeft, isResizingRight, isResizingMerged]);

  return (
    <div className="h-screen flex relative overflow-hidden bg-gray-50">
      {/* Merged panels mode */}
      {panelsMerged ? (
        <>
          {/* Left merged panel */}
          <div
            style={{ width: `${mergedSeparatorPosition}%` }}
            className="flex-shrink-0 bg-white relative"
          >
            {mergedSeparatorPosition < 50 ? (
              <div className="relative h-full">
                {/* ChatModule with fade out animation */}
                <div className={`absolute inset-0 transition-all duration-300 ${
                  !selectedEvent ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
                }`}>
                  <ChatModule className="h-full" shouldAutoFocus={false} />
                </div>

                {/* EventEditor with fade in animation */}
                <div className={`absolute inset-0 transition-all duration-300 ${
                  selectedEvent ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'
                }`}>
                  {selectedEvent && (
                    <EventEditor
                      event={selectedEvent}
                      onSave={(updatedEvent, updateOption) => {
                        // Check if this is just a color preview (boolean true)
                        const isPreview = updateOption === true;

                        // Clean the event to ensure justCreated is removed
                        const cleanedEvent = { ...updatedEvent };
                        delete cleanedEvent.justCreated;

                        setCalendarEvents(prev => {
                          // Check if event exists in array
                          const exists = prev.some(e => e.id === cleanedEvent.id);
                          if (!exists) {
                            // Add the event if it doesn't exist (new event case)
                            return [...prev, cleanedEvent];
                          } else {
                            // Update existing event
                            return prev.map(e => e.id === cleanedEvent.id ? cleanedEvent : e);
                          }
                        });

                        // Always update selectedEvent to keep it in sync (removes justCreated flag)
                        if (selectedEvent && selectedEvent.id === cleanedEvent.id) {
                          if (isPreview) {
                            // For previews, only update the color
                            setSelectedEvent({ ...selectedEvent, color: cleanedEvent.color });
                          } else {
                            // For actual saves, update the entire event (this removes justCreated)
                            setSelectedEvent(cleanedEvent);
                          }
                        }
                      }}
                      onDelete={(eventId) => {
                        handleDeleteEvent(eventId);
                        setSelectedEvent(null);
                      }}
                      onCancel={() => {
                        // Don't delete here - let the periodic cleanup handle it
                        // This avoids race conditions with saves
                        setSelectedEvent(null);
                      }}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col">
                <TodoModule className="flex-1" />

                {/* Profile Button at Bottom */}
                <div className="p-1.5">
                  <button
                    onClick={() => setShowSettings(true)}
                    className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                    title="Open Settings"
                  >
                    {/* Profile Picture */}
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                      ZZ
                    </div>

                    {/* Name and Status */}
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium text-gray-900">Zichen Zhao</div>
                      <div className="text-xs text-gray-500">Plus</div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Merged separator */}
          <div className="relative group h-full">
            <div
              ref={mergedResizeRef}
              className="absolute inset-y-0 -left-2 w-4 cursor-ew-resize z-10 flex items-center justify-center hover:bg-gray-200/50 transition-colors"
              onMouseDown={(e) => {
                setIsResizingMerged(true);
                e.preventDefault();
              }}
              onClick={handleMergedSeparatorClick}
            >
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-1 h-8 bg-gray-400 rounded-full" />
              </div>
            </div>
            <div className="w-px bg-gray-200 h-full" />
          </div>

          {/* Right merged panel */}
          <div
            style={{ width: `${100 - mergedSeparatorPosition}%` }}
            className="flex-1 bg-white"
          >
            {mergedSeparatorPosition > 50 ? (
              <div className="relative h-full">
                {/* ChatModule with fade out animation */}
                <div className={`absolute inset-0 transition-all duration-300 ${
                  !selectedEvent ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
                }`}>
                  <ChatModule className="h-full" shouldAutoFocus={false} />
                </div>

                {/* EventEditor with fade in animation */}
                <div className={`absolute inset-0 transition-all duration-300 ${
                  selectedEvent ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'
                }`}>
                  {selectedEvent && (
                    <EventEditor
                      event={selectedEvent}
                      onSave={(updatedEvent, updateOption) => {
                        // Check if this is just a color preview (boolean true)
                        const isPreview = updateOption === true;

                        // Clean the event to ensure justCreated is removed
                        const cleanedEvent = { ...updatedEvent };
                        delete cleanedEvent.justCreated;

                        setCalendarEvents(prev => {
                          // Check if event exists in array
                          const exists = prev.some(e => e.id === cleanedEvent.id);
                          if (!exists) {
                            // Add the event if it doesn't exist (new event case)
                            return [...prev, cleanedEvent];
                          } else {
                            // Update existing event
                            return prev.map(e => e.id === cleanedEvent.id ? cleanedEvent : e);
                          }
                        });

                        // Always update selectedEvent to keep it in sync (removes justCreated flag)
                        if (selectedEvent && selectedEvent.id === cleanedEvent.id) {
                          if (isPreview) {
                            // For previews, only update the color
                            setSelectedEvent({ ...selectedEvent, color: cleanedEvent.color });
                          } else {
                            // For actual saves, update the entire event (this removes justCreated)
                            setSelectedEvent(cleanedEvent);
                          }
                        }
                      }}
                      onDelete={(eventId) => {
                        handleDeleteEvent(eventId);
                        setSelectedEvent(null);
                      }}
                      onCancel={() => {
                        // Don't delete here - let the periodic cleanup handle it
                        // This avoids race conditions with saves
                        setSelectedEvent(null);
                      }}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col">
                <TodoModule className="flex-1" />

                {/* Profile Button at Bottom */}
                <div className="p-1.5">
                  <button
                    onClick={() => setShowSettings(true)}
                    className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                    title="Open Settings"
                  >
                    {/* Profile Picture */}
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                      ZZ
                    </div>

                    {/* Name and Status */}
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium text-gray-900">Zichen Zhao</div>
                      <div className="text-xs text-gray-500">Plus</div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Left Panel - Todo */}
          <div
            style={{
              width: showLeftPanel ? leftPanelWidth : 0,
              transition: isResizingLeft || leftPanelAnimating ? 'none' :
                        (leftPanelCollapsing ? 'width 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)' :
                         leftPanelExpanding ? 'width 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)' :
                         leftPanelRestoring ? 'width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' :
                         'width 0.3s ease-in-out'),
              transform: leftPanelCollapsing ? 'scale(0.98)' :
                        leftPanelExpanding ? 'scale(1.02)' :
                        'scale(1)',
              opacity: leftPanelHidden ? 0 : 1
            }}
            className="flex-shrink-0 origin-left overflow-hidden bg-white relative"
          >
            {showLeftPanel && (
              <div className="h-full flex flex-col">
                <TodoModule className="flex-1" />

                {/* Profile Button at Bottom */}
                <div className="p-1.5">
                  <button
                    onClick={() => setShowSettings(true)}
                    className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                    title="Open Settings"
                  >
                    {/* Profile Picture */}
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                      ZZ
                    </div>

                    {/* Name and Status */}
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium text-gray-900">Zichen Zhao</div>
                      <div className="text-xs text-gray-500">Plus</div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Left Resizer - show when panel is visible and not merged */}
          {showLeftPanel && !panelsMerged && (
            <div className="relative group h-full">
              <div
                ref={leftResizeRef}
                className={`absolute inset-y-0 -left-2 w-4 cursor-ew-resize z-10 ${
                  isResizingLeft
                    ? ''
                    : 'hover:bg-blue-50/30'
                }`}
                onMouseDown={(e) => {
                  setIsResizingLeft(true);
                  e.preventDefault();
                }}
                onClick={handleLeftSeparatorClick}
              />
              <div className={`h-full transition-all ${
                isResizingLeft
                  ? 'w-1 bg-blue-500'
                  : 'w-px bg-gray-200 group-hover:bg-blue-400 group-hover:w-px'
              }`} />
            </div>
          )}

          {/* Left Arrow button - only show when panel is hidden */}
          {!showLeftPanel && !panelsMerged && (
            <div
              className="absolute top-1/2 -translate-y-1/2 left-0 z-20 opacity-100 transition-all duration-200 bg-white hover:bg-blue-50 rounded-full shadow-md hover:shadow-lg p-1 cursor-pointer hover:scale-110 active:scale-95"
              onClick={handleLeftArrowClick}
              style={{ left: '8px' }}
            >
              <svg className="w-4 h-4 text-gray-600 hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          )}

          {/* Center - Calendar */}
          <div className="flex-1 flex flex-col overflow-hidden relative">
            {/* Calendar Module */}
            <CalendarModule
              className="flex-1"
              calendarEvents={calendarEvents}
              selectedEventId={selectedEvent?.id}
              onEventUpdate={(events) => setCalendarEvents(events)}
              onEditEvent={(event) => {
                console.log('=== onEventEdit called in page.tsx ===');
                console.log('Event being edited:', event);

                // Just set the new selected event - don't delete anything here
                // The EventEditor will handle saving when it unmounts or loses focus
                setSelectedEvent(event);
                console.log('Setting selectedEvent to:', event);

                if (!showRightPanel) {
                  console.log('Right panel was hidden, showing it now');
                  setShowRightPanel(true);
                  setRightPanelHidden(false);
                  setRightPanelExpanding(true);
                  setTimeout(() => setRightPanelExpanding(false), 300);
                } else {
                  console.log('Right panel is already visible');
                }
              }}
              onDeleteEvent={handleDeleteEvent}
              deletingEventIds={deletingEventIds}
              showOnlyToday={showOnlyToday}
              onToggleShowOnlyToday={() => setShowOnlyToday(!showOnlyToday)}
            />
          </div>

          {/* Right Resizer - only show when panel is visible and not merged */}
          {showRightPanel && !panelsMerged && (
            <div className="relative group h-full">
              <div className={`h-full transition-all ${
                isResizingRight
                  ? 'w-1 bg-blue-500'
                  : 'w-px bg-gray-200 group-hover:bg-blue-400 group-hover:w-px'
              }`} />
              <div
                ref={rightResizeRef}
                className={`absolute inset-y-0 -right-2 w-4 cursor-ew-resize z-10 ${
                  isResizingRight
                    ? ''
                    : 'hover:bg-blue-50/30'
                }`}
                onMouseDown={(e) => {
                  setIsResizingRight(true);
                  e.preventDefault();
                }}
                onClick={handleRightSeparatorClick}
              />
            </div>
          )}

          {/* Right Arrow button - only show when panel is hidden */}
          {!showRightPanel && !panelsMerged && (
            <div
              className="absolute top-1/2 -translate-y-1/2 right-0 z-20 opacity-100 transition-all duration-200 bg-white hover:bg-blue-50 rounded-full shadow-md hover:shadow-lg p-1 cursor-pointer hover:scale-110 active:scale-95"
              onClick={handleRightArrowClick}
              style={{ right: '8px' }}
            >
              <svg className="w-4 h-4 text-gray-600 hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </div>
          )}

          {/* Right Panel - Chat */}
          <div
            style={{
              width: showRightPanel ? rightPanelWidth : 0,
              transition: isResizingRight || rightPanelAnimating ? 'none' :
                        (rightPanelCollapsing ? 'width 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)' :
                         rightPanelExpanding ? 'width 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)' :
                         rightPanelRestoring ? 'width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' :
                         rightContentTransitioning ? `all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)` :
                         'width 0.3s ease-in-out'),
              transform: rightPanelCollapsing ? 'scale(0.98)' :
                        rightPanelExpanding ? 'scale(1.02)' :
                        'scale(1)',
              opacity: rightPanelHidden ? 0 : 1
            }}
            className="flex-shrink-0 origin-right bg-white"
          >
            {showRightPanel && (
              <>
                {console.log('=== Right Panel Render ===', {
                  showRightPanel,
                  selectedEvent,
                  hasSelectedEvent: !!selectedEvent
                })}
                <div className="relative h-full overflow-hidden">
                  {/* ChatModule with fade/slide animation */}
                  <div className={`absolute inset-0 transition-all duration-300 ease-in-out ${
                    !selectedEvent
                      ? 'opacity-100 translate-x-0'
                      : 'opacity-0 -translate-x-4 pointer-events-none'
                  }`}>
                    <ChatModule className="h-full" shouldAutoFocus={false} />
                  </div>

                  {/* EventEditor with fade/slide animation */}
                  <div className={`absolute inset-0 transition-all duration-300 ease-in-out ${
                    selectedEvent
                      ? 'opacity-100 translate-x-0'
                      : 'opacity-0 translate-x-4 pointer-events-none'
                  }`}>
                    {selectedEvent && (
                      <EventEditor
                        className="h-full"
                        event={selectedEvent}
                        onSave={(updatedEvent, updateOption) => {
                          // Check if this is just a color preview (boolean true)
                          const isPreview = updateOption === true;

                          // Clean the event to ensure justCreated is removed
                          const cleanedEvent = { ...updatedEvent };
                          delete cleanedEvent.justCreated;

                          setCalendarEvents(prev => {
                            // Check if event exists in array
                            const exists = prev.some(e => e.id === cleanedEvent.id);
                            if (!exists) {
                              // Add the event if it doesn't exist (new event case)
                              return [...prev, cleanedEvent];
                            } else {
                              // Update existing event
                              return prev.map(e => e.id === cleanedEvent.id ? cleanedEvent : e);
                            }
                          });

                          // Always update selectedEvent to keep it in sync (removes justCreated flag)
                          if (selectedEvent && selectedEvent.id === cleanedEvent.id) {
                            if (isPreview) {
                              // For previews, only update the color
                              setSelectedEvent({ ...selectedEvent, color: cleanedEvent.color });
                            } else {
                              // For actual saves, update the entire event (this removes justCreated)
                              setSelectedEvent(cleanedEvent);
                            }
                          }
                        }}
                        onDelete={(eventId) => {
                          handleDeleteEvent(eventId);
                          setSelectedEvent(null);
                        }}
                        onCancel={() => {
                          // Don't delete here - let the periodic cleanup handle it
                          // This avoids race conditions with saves
                          setSelectedEvent(null);
                        }}
                      />
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Collapsed Panel Indicators */}
      {!showLeftPanel && !panelsMerged && (
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 bg-white rounded-r-lg shadow-md p-2 cursor-pointer hover:bg-gray-50 transition-all hover:pl-3"
          onClick={() => {
            setShowLeftPanel(true);
            setLeftPanelHidden(false);
            setLeftPanelExpanding(true);
            setTimeout(() => setLeftPanelExpanding(false), 300);
          }}
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}

      {!showRightPanel && !panelsMerged && (
        <div
          className="absolute right-0 top-1/2 -translate-y-1/2 bg-white rounded-l-lg shadow-md p-2 cursor-pointer hover:bg-gray-50 transition-all hover:pr-3"
          onClick={() => {
            setShowRightPanel(true);
            setRightPanelHidden(false);
            setRightPanelExpanding(true);
            setTimeout(() => setRightPanelExpanding(false), 300);
          }}
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </div>
      )}

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
}