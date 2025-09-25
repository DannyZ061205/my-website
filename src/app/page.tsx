'use client';

import { useState, useRef, useEffect, startTransition } from 'react';
import { TodoModule } from '@/components/todo/TodoModule';
import { CalendarModule } from '@/components/calendar/CalendarModule';
import { ChatModule, type Message } from '@/components/chat/ChatModule';
import { EventEditor } from '@/components/event-editor/EventEditor';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { CalendarEvent } from '@/types';
import { LiveEventProvider } from '@/contexts/LiveEventContext';

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

function ChronosAppContent() {
  // Default panel widths
  const DEFAULT_LEFT_WIDTH = 384; // w-96 = 384px
  const DEFAULT_RIGHT_WIDTH = 384;

  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [leftPanelWidth, setLeftPanelWidth] = useState(DEFAULT_LEFT_WIDTH);
  const [rightPanelWidth, setRightPanelWidth] = useState(DEFAULT_RIGHT_WIDTH);
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

  // Chat state - persistent across merged/unmerged panels
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatInputValue, setChatInputValue] = useState('');

  // Merged state - when both separators are in the middle
  const [panelsMerged, setPanelsMerged] = useState(false);
  const [mergedSeparatorPosition, setMergedSeparatorPosition] = useState(50); // percentage from left
  const [calendarWidth, setCalendarWidth] = useState(0);
  const [isMerging, setIsMerging] = useState(false); // Track merge animation
  const [dragStartedAsMerged, setDragStartedAsMerged] = useState(false); // Track if drag started from merged state
  const [mergedDuringDrag, setMergedDuringDrag] = useState(false); // Track if panels merged during current drag
  const CALENDAR_MIN_WIDTH_PERCENT = 10; // Calendar disappears when less than 10% of screen width
  const MERGE_THRESHOLD = 5; // Distance in pixels where separators snap together - very precise merging

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

  // Helper function for smooth panel merging
  const mergePanelsSmooth = (targetPosition: number) => {
    // Don't merge if already merging
    if (isMerging || panelsMerged) return;

    console.log('Starting merge animation...');
    setIsMerging(true);
    const mergePosition = targetPosition || 50;

    // Calculate the exact center point where panels should meet
    const centerPoint = (mergePosition * window.innerWidth) / 100;

    console.log(`Animating panels to position: ${mergePosition}%`);
    console.log(`Current left width: ${leftPanelWidth}, target: ${centerPoint}`);
    console.log(`Current right width: ${rightPanelWidth}, target: ${window.innerWidth - centerPoint}`);

    // Animate both panels to meet at the center point
    const animationDuration = 500; // Increased for more visible animation

    // Enable animation flags
    setLeftPanelAnimating(true);
    setRightPanelAnimating(true);

    // Move panels to merge position
    requestAnimationFrame(() => {
      setLeftPanelWidth(centerPoint);
      setRightPanelWidth(window.innerWidth - centerPoint);
    });

    // After animation completes, switch to merged view
    setTimeout(() => {
      console.log('Merge animation complete, switching to merged view');
      setPanelsMerged(true);
      setMergedSeparatorPosition(mergePosition);
      setLeftPanelAnimating(false);
      setRightPanelAnimating(false);
      setIsMerging(false);
    }, animationDuration);
  };

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
  // Removed unused separator clicked states - animation no longer needed
  const [isResizingMerged, setIsResizingMerged] = useState(false);
  const [deletingEventIds, setDeletingEventIds] = useState<Set<string>>(new Set());

  // Track double-clicks for restoring to default
  const lastLeftClickRef = useRef<number>(0);
  const lastRightClickRef = useRef<number>(0);

  // Track if right panel was auto-opened for an event
  const [rightPanelAutoOpened, setRightPanelAutoOpened] = useState(false);

  // Double-click tracking for separators
  // Removed old separator click refs - now using lastLeftClickRef and lastRightClickRef
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
  // Removed unused separator click handlers - double-click is now handled in onMouseDown

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

  // Handle event deletion
  const handleDeleteEvent = (eventId: string) => {
    console.log('handleDeleteEvent called with ID:', eventId);

    // Mark the event as deleting to trigger the animation
    setDeletingEventIds(prev => new Set([...prev, eventId]));

    // If this was the selected event, close the editor immediately
    if (selectedEvent?.id === eventId) {
      setSelectedEvent(null);

      // If we auto-opened the right panel for this event, close it
      if (rightPanelAutoOpened) {
        setShowRightPanel(false);
        setRightPanelHidden(true);
        setRightPanelWidth(0);
        setRightPanelAutoOpened(false);
      }
    }

    // Wait for the animation to complete before actually deleting
    setTimeout(() => {
      // Delete the event from calendarEvents
      setCalendarEvents(prev => prev.filter(e => e.id !== eventId));

      // Clean up the deleting state
      setDeletingEventIds(prev => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
    }, 250); // Match the animation duration in CSS
  };

  // Update resize handler for merged separator
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingMerged && mergedResizeRef.current) {
        const containerWidth = window.innerWidth;
        const newPosition = (e.clientX / containerWidth) * 100;
        const currentX = e.clientX;

        // If we're dragging the merged separator and it was merged during this drag
        if (mergedDuringDrag) {
          // Calculate what the calendar space would be if we unmerged
          // Check both directions - left and right

          // If dragging left - assuming left panel goes back to where mouse is
          const potentialLeftWidth = currentX;
          const potentialCalendarSpaceLeft = containerWidth - potentialLeftWidth - rightPanelWidth;
          const potentialCalendarPercentLeft = (potentialCalendarSpaceLeft / containerWidth) * 100;

          // If dragging right - assuming right panel goes back to where mouse would place it
          const potentialRightWidth = containerWidth - currentX;
          const potentialCalendarSpaceRight = containerWidth - leftPanelWidth - potentialRightWidth;
          const potentialCalendarPercentRight = (potentialCalendarSpaceRight / containerWidth) * 100;

          // If dragging far enough left to create sufficient calendar space
          if (potentialCalendarPercentLeft >= CALENDAR_MIN_WIDTH_PERCENT &&
              currentX < containerWidth - rightPanelWidth - (containerWidth * CALENDAR_MIN_WIDTH_PERCENT / 100)) {
            // Unmerge - restore left separator
            setPanelsMerged(false);
            setMergedDuringDrag(false);
            setIsResizingMerged(false);
            setIsResizingLeft(true);
            setLeftPanelWidth(potentialLeftWidth);
            // Right panel stays where it was
            return;
          }

          // If dragging far enough right to create sufficient calendar space
          if (potentialCalendarPercentRight >= CALENDAR_MIN_WIDTH_PERCENT &&
              currentX > leftPanelWidth + (containerWidth * CALENDAR_MIN_WIDTH_PERCENT / 100)) {
            // Unmerge - restore right separator
            setPanelsMerged(false);
            setMergedDuringDrag(false);
            setIsResizingMerged(false);
            setIsResizingRight(true);
            setRightPanelWidth(potentialRightWidth);
            // Left panel stays where it was
            return;
          }
        }

        setMergedSeparatorPosition(Math.max(20, Math.min(80, newPosition)));
      } else if (isResizingLeft && leftResizeRef.current) {
        const newWidth = e.clientX;
        const maxWidth = window.innerWidth * 0.85; // 85% of window width - left separator can go up to 85%
        const minWidth = 0; // Allow left separator to go to 0 (fully collapsed)

        // Calculate percentage position
        const percentPosition = (newWidth / window.innerWidth) * 100;

        // Don't snap during drag, just update position
        if (percentPosition <= 8) {
          // Just set to edge position without hiding
          setLeftPanelWidth(0);
        } else {
          setLeftPanelWidth(Math.max(minWidth, Math.min(maxWidth, newWidth)));
        }

        // Check if we should merge or unmerge (only if not snapped)
        if (percentPosition > 8) {
          const rightEdge = window.innerWidth - rightPanelWidth;
          const calendarSpace = window.innerWidth - newWidth - rightPanelWidth;
          const calendarSpacePercent = (calendarSpace / window.innerWidth) * 100;

          // Check for merge (only if drag didn't start merged)
          if (calendarSpacePercent < CALENDAR_MIN_WIDTH_PERCENT && calendarSpace >= 0 && !panelsMerged && !dragStartedAsMerged) {
            // Instant merge during drag (no animation)
            const calendarStart = newWidth;
            const calendarEnd = window.innerWidth - rightPanelWidth;
            const mergePoint = (calendarStart + calendarEnd) / 2;
            const mergePercent = (mergePoint / window.innerWidth) * 100;

            setPanelsMerged(true);
            setMergedDuringDrag(true); // Mark that merge happened during this drag
            setMergedSeparatorPosition(mergePercent);
            setIsResizingLeft(false);
            setIsResizingMerged(true); // Switch to merged resizing
          } else if (calendarSpacePercent >= CALENDAR_MIN_WIDTH_PERCENT && panelsMerged && mergedDuringDrag) {
            // Unmerge when dragged back out (only if merged during this drag)
            setPanelsMerged(false);
            setMergedDuringDrag(false);
            setIsResizingMerged(false);
            setIsResizingLeft(true); // Switch back to left separator
            // Restore positions based on where we're dragging
            setLeftPanelWidth(newWidth);
            // Right panel stays where it was
          }
        }
      } else if (isResizingRight && rightResizeRef.current) {
        const newWidth = window.innerWidth - e.clientX;
        const maxWidth = window.innerWidth * 0.85; // 85% of window width - right separator can go up to 85% (leaving 15% minimum for calendar)
        const minWidth = 0; // Allow right separator to go to 0 (fully collapsed)

        // Calculate percentage position of the right separator (from left edge)
        const rightSeparatorPosition = e.clientX;
        const percentPosition = (rightSeparatorPosition / window.innerWidth) * 100;

        // Don't snap during drag, just update position
        if (percentPosition < 15) {
          setRightPanelWidth(window.innerWidth * 0.85);
        } else if (percentPosition >= 92) {
          // Just set to edge position without hiding
          setRightPanelWidth(0);
        } else {
          setRightPanelWidth(Math.max(minWidth, Math.min(maxWidth, newWidth)));
        }

        // Check if we should merge (only if not snapped)
        if (percentPosition < 92 && percentPosition > 15) {
          const leftEdge = leftPanelWidth;
          const calendarSpace = window.innerWidth - leftEdge - newWidth;
          const calendarSpacePercent = (calendarSpace / window.innerWidth) * 100;

          // Check for merge (only if drag didn't start merged)
          if (calendarSpacePercent < CALENDAR_MIN_WIDTH_PERCENT && calendarSpace >= 0 && !panelsMerged && !dragStartedAsMerged && !isMerging) {
            // Instant merge during drag (no animation)
            const calendarStart = leftEdge;
            const calendarEnd = window.innerWidth - newWidth;
            const mergePoint = (calendarStart + calendarEnd) / 2;
            const mergePercent = (mergePoint / window.innerWidth) * 100;

            setPanelsMerged(true);
            setMergedDuringDrag(true); // Mark that merge happened during this drag
            setMergedSeparatorPosition(mergePercent);
            setIsResizingRight(false);
            setIsResizingMerged(true); // Switch to merged resizing
          } else if (calendarSpacePercent >= CALENDAR_MIN_WIDTH_PERCENT && panelsMerged && mergedDuringDrag) {
            // Unmerge when dragged back out (only if merged during this drag)
            setPanelsMerged(false);
            setMergedDuringDrag(false);
            setIsResizingMerged(false);
            setIsResizingRight(true); // Switch back to right separator
            // Restore positions based on where we're dragging
            setRightPanelWidth(newWidth);
            // Left panel stays where it was
          }
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      // Check if we should complete snap on release
      if (isResizingLeft) {
        const percentPosition = (e.clientX / window.innerWidth) * 100;
        if (percentPosition <= 8) {
          // Enable animation for final snap
          setLeftPanelAnimating(true);
          setLeftPanelCollapsing(true);
          // Ensure it's at 0
          setLeftPanelWidth(0);
          setTimeout(() => {
            setShowLeftPanel(false);
            setLeftPanelHidden(true);
            setLeftPanelCollapsing(false);
            setLeftPanelAnimating(false);
          }, 300);
        }
      }

      if (isResizingRight) {
        const percentPosition = (e.clientX / window.innerWidth) * 100;
        if (percentPosition >= 92) {
          // Enable animation for final snap
          setRightPanelAnimating(true);
          setRightPanelCollapsing(true);
          // Ensure it's at 0
          setRightPanelWidth(0);
          setTimeout(() => {
            setShowRightPanel(false);
            setRightPanelHidden(true);
            setRightPanelCollapsing(false);
            setRightPanelAnimating(false);
          }, 300);
        }
      }

      setIsResizingLeft(false);
      setIsResizingRight(false);
      setIsResizingMerged(false);
      setMergedDuringDrag(false); // Reset merge tracking when drag ends
      setDragStartedAsMerged(false); // Reset drag start state
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

  // Check for calendar minimum width - disabled during active resizing
  useEffect(() => {
    // Only auto-merge when not actively dragging
    if (isResizingLeft || isResizingRight || isResizingMerged) {
      return;
    }

    const containerWidth = window.innerWidth;
    const calendarSpace = containerWidth - leftPanelWidth - rightPanelWidth;
    const calendarSpacePercent = (calendarSpace / containerWidth) * 100;
    const minWidthInPixels = containerWidth * (CALENDAR_MIN_WIDTH_PERCENT / 100);

    if (calendarSpacePercent < CALENDAR_MIN_WIDTH_PERCENT && showLeftPanel && showRightPanel && calendarSpace >= 0 && !panelsMerged && !isMerging) {
      // Merge panels when calendar gets too small (less than 10% of screen)
      // Calculate merge position at the middle of the remaining calendar space
      const calendarStart = leftPanelWidth;
      const calendarEnd = containerWidth - rightPanelWidth;
      const mergePoint = (calendarStart + calendarEnd) / 2;
      const mergePercent = (mergePoint / containerWidth) * 100;
      mergePanelsSmooth(mergePercent);
    }
  }, [leftPanelWidth, rightPanelWidth, showLeftPanel, showRightPanel, isResizingLeft, isResizingRight, isResizingMerged]);


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
          {/* Left merged panel - Always show TodoModule */}
          <div
            style={{ width: `${mergedSeparatorPosition}%` }}
            className="flex-shrink-0 bg-white relative"
          >
            {/* Always show TodoModule on left in merged mode */}
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
          </div>

          {/* Merged separator */}
          <div className="relative group h-full">
            <div
              ref={mergedResizeRef}
              className="absolute inset-y-0 -left-2 w-4 cursor-ew-resize z-10 flex items-center justify-center hover:bg-gray-200/50 transition-colors"
              onMouseDown={(e) => {
                setIsResizingMerged(true);
                setDragStartedAsMerged(true); // Track that drag started from already merged state
                e.preventDefault();
              }}
              onClick={handleMergedSeparatorClick}
            >
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-1 h-8 bg-gray-400 rounded-full" />
              </div>
            </div>
            <div className="w-px bg-gray-200 h-full relative">
              <div className={`absolute inset-y-0 left-1/2 -translate-x-1/2 transition-all ${
                isResizingMerged
                  ? 'w-1 bg-blue-500'
                  : 'w-px bg-gray-200 group-hover:bg-blue-400 group-hover:w-1'
              }`} />
            </div>
          </div>

          {/* Right merged panel - Always show Chat/EventEditor */}
          <div
            style={{ width: `${100 - mergedSeparatorPosition}%` }}
            className="flex-1 bg-white"
          >
            {/* Always show Chat/EventEditor on right in merged mode */}
            <div className="relative h-full">
              {/* ChatModule with fade out animation */}
              <div className={`absolute inset-0 transition-all duration-300 ${
                !selectedEvent ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
              }`}>
                <ChatModule
                  className="h-full"
                  shouldAutoFocus={false}
                />
              </div>

              {/* EventEditor with fade in animation */}
              <div className={`absolute inset-0 transition-all duration-300 ${
                selectedEvent ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'
              }`}>
                {selectedEvent && (
                  <EventEditor
                      event={selectedEvent}
                      onSave={(updatedEvent, updateOption) => {
                        const saveStart = performance.now();

                        // Check if this is just a color preview (boolean true)
                        const isPreview = updateOption === true;

                        // Clean the event to ensure justCreated is removed
                        const cleanedEvent = { ...updatedEvent };
                        delete cleanedEvent.justCreated;

                        // Handle preview updates immediately without transitions
                        if (isPreview) {
                          // Update immediately for zero lag
                          setCalendarEvents(prev => prev.map(e =>
                            e.id === cleanedEvent.id ? cleanedEvent : e
                          ));
                          return; // Exit early for previews
                        }

                        // Handle recurring event updates based on option
                        if (updateOption === 'single' || updateOption === 'following' || updateOption === 'all') {
                          // For recurring events, we need to handle the update properly
                          console.log('Handling recurring event update with option:', updateOption);

                          // Check if this is a virtual event
                          if (cleanedEvent.isVirtual && cleanedEvent.parentId) {
                            if (updateOption === 'single') {
                              // Create an exception event for this specific occurrence
                              const exceptionEvent = {
                                ...cleanedEvent,
                                id: `exception-${Date.now()}`, // New unique ID for the exception
                                isVirtual: false,
                                parentId: undefined,
                                recurrenceGroupId: cleanedEvent.parentId,
                                recurrence: undefined // Exceptions don't have recurrence
                              };

                              // Add exception event and exclude this date from parent
                              setCalendarEvents(prev => {
                                // Find parent event
                                const parent = prev.find(e => e.id === cleanedEvent.parentId);
                                if (!parent) return prev;

                                // Update parent with excluded date
                                const updatedParent = {
                                  ...parent,
                                  excludedDates: [
                                    ...(parent.excludedDates || []),
                                    cleanedEvent.start
                                  ]
                                };

                                // Add exception and update parent
                                return [
                                  ...prev.filter(e => e.id !== parent.id),
                                  updatedParent,
                                  exceptionEvent
                                ];
                              });
                            } else if (updateOption === 'all') {
                              // Update the parent event with new properties
                              setCalendarEvents(prev => {
                                return prev.map(e => {
                                  if (e.id === cleanedEvent.parentId) {
                                    // Apply changes to parent, keeping recurrence
                                    return {
                                      ...e,
                                      title: cleanedEvent.title,
                                      color: cleanedEvent.color,
                                      description: cleanedEvent.description,
                                      location: cleanedEvent.location,
                                      // Don't update start/end times or recurrence
                                    };
                                  }
                                  return e;
                                });
                              });
                            } else if (updateOption === 'following') {
                              // Split the series - create a new recurring event from this point
                              console.log('Splitting series for following events');
                              // This requires more complex logic - CalendarModule should handle it
                            }
                          } else {
                            // Non-virtual event or base event - update normally
                            setCalendarEvents(prev => {
                              return prev.map(e => e.id === cleanedEvent.id ? cleanedEvent : e);
                            });
                          }
                        } else {
                          // Normal update - use startTransition for better performance with recurring events
                          startTransition(() => {
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
                          });
                        }

                        // Always update selectedEvent to keep it in sync (removes justCreated flag)
                        if (selectedEvent && selectedEvent.id === cleanedEvent.id) {
                          // For actual saves, update the entire event (this removes justCreated)
                          setSelectedEvent(cleanedEvent);
                        }

                        const saveEnd = performance.now();
                        if (!isPreview && saveEnd - saveStart > 50) {
                          console.warn(`Event save took ${(saveEnd - saveStart).toFixed(2)}ms`);
                        }
                      }}
                      onDelete={(eventId) => {
                        handleDeleteEvent(eventId);
                        setSelectedEvent(null);

                        // If we auto-opened the right panel for this event, close it
                        if (rightPanelAutoOpened) {
                          setShowRightPanel(false);
                          setRightPanelHidden(true);
                          setRightPanelWidth(0);
                          setRightPanelAutoOpened(false);
                        }
                      }}
                      onCancel={() => {
                        // If we auto-opened the right panel for this event, close it instantly
                        if (rightPanelAutoOpened) {
                          // Instantly hide the panel and clear selection
                          setShowRightPanel(false);
                          setRightPanelHidden(true);
                          setRightPanelWidth(0); // Set width to 0 to match dragged-to-edge state
                          setRightPanelAutoOpened(false);
                          setSelectedEvent(null);
                        } else {
                          // If panel wasn't auto-opened, just clear the selection normally
                          setSelectedEvent(null);
                        }
                      }}
                    />
                  )}
                </div>
              </div>
          </div>
        </>
      ) : (
        <>
          {/* Left Panel - Todo */}
          <div
            style={{
              width: showLeftPanel ? leftPanelWidth : 0,
              transition: isResizingLeft ? 'none' :
                        (leftPanelCollapsing ? 'width 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)' :
                         leftPanelExpanding ? 'width 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)' :
                         leftPanelRestoring ? 'width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' :
                         isMerging ? 'width 0.4s cubic-bezier(0.4, 0.0, 0.2, 1)' :
                         leftPanelAnimating ? 'width 0.4s cubic-bezier(0.4, 0.0, 0.2, 1)' :
                         'width 0.3s ease-in-out'),
              transform: leftPanelCollapsing ? 'scale(0.98)' :
                        leftPanelExpanding ? 'scale(1.02)' :
                        'scale(1)',
              opacity: leftPanelHidden ? 0 : 1
            }}
            className="h-full flex-shrink-0 origin-left overflow-hidden bg-white relative"
          >
            {showLeftPanel && (
              <div className="h-full flex flex-col min-h-0">
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
                  e.preventDefault();

                  // Check for double-click
                  const now = Date.now();
                  if (now - lastLeftClickRef.current < 300) {
                    // Double-click detected - restore to default position
                    setLeftPanelWidth(DEFAULT_LEFT_WIDTH);
                    setShowLeftPanel(true); // Ensure panel is visible
                    setLeftPanelHidden(false);
                    lastLeftClickRef.current = 0;
                    return;
                  }
                  lastLeftClickRef.current = now;

                  setIsResizingLeft(true);
                  setDragStartedAsMerged(false); // Track that drag started from unmerged state
                }}
              />
              <div className="w-px bg-gray-200 h-full relative">
                <div className={`absolute inset-y-0 left-1/2 -translate-x-1/2 transition-all ${
                  isResizingLeft
                    ? 'w-1 bg-blue-500'
                    : 'w-px bg-gray-200 group-hover:bg-blue-400 group-hover:w-1'
                }`} />
              </div>
            </div>
          )}

          {/* Left Arrow button - show when panel is hidden */}
          {!showLeftPanel && !panelsMerged && (
            <div
              className="fixed top-1/2 -translate-y-1/2 z-50 left-0"
              onClick={() => {
                setShowLeftPanel(true);
                setLeftPanelHidden(false);
                setLeftPanelExpanding(true);
                setLeftPanelWidth(DEFAULT_LEFT_WIDTH); // Restore to default width
                setTimeout(() => setLeftPanelExpanding(false), 300);
              }}
            >
              <div className="bg-white shadow-md rounded-r-lg px-2 py-4 cursor-pointer">
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          )}

          {/* Center - Calendar */}
          <div className="flex-1 flex flex-col overflow-hidden relative">
            {/* Calendar Module */}
            <CalendarModule
              className="flex-1"
              calendarEvents={calendarEvents}
              selectedEventId={selectedEvent?.id}
              onEventUpdate={(events) => {
                console.log('onEventUpdate called with events:', events);
                // Don't update if events is empty - this is likely a bug
                if (events && events.length > 0) {
                  setCalendarEvents(events);
                } else {
                  console.warn('Attempted to set empty events array - ignoring');
                }
              }}
              onEditEvent={(event) => {
                console.log('=== onEventEdit called in page.tsx ===');
                console.log('Event being edited:', event);

                // Just set the new selected event - don't delete anything here
                // The EventEditor will handle saving when it unmounts or loses focus
                setSelectedEvent(event);
                console.log('Setting selectedEvent to:', event);

                if (!showRightPanel || rightPanelWidth === 0) {
                  console.log('Right panel was hidden, showing it now');
                  setShowRightPanel(true);
                  setRightPanelHidden(false);
                  setRightPanelExpanding(true);
                  setRightPanelWidth(DEFAULT_RIGHT_WIDTH); // Restore to default width
                  setRightPanelAutoOpened(true); // Mark that we auto-opened it
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
              <div className="w-px bg-gray-200 h-full relative">
                <div className={`absolute inset-y-0 left-1/2 -translate-x-1/2 transition-all ${
                  isResizingRight
                    ? 'w-1 bg-blue-500'
                    : 'w-px bg-gray-200 group-hover:bg-blue-400 group-hover:w-1'
                }`} />
              </div>
              <div
                ref={rightResizeRef}
                className={`absolute inset-y-0 -right-2 w-4 cursor-ew-resize z-10 ${
                  isResizingRight
                    ? ''
                    : 'hover:bg-blue-50/30'
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();

                  // Check for double-click
                  const now = Date.now();
                  if (now - lastRightClickRef.current < 300) {
                    // Double-click detected - restore to default position
                    setRightPanelWidth(DEFAULT_RIGHT_WIDTH);
                    setShowRightPanel(true); // Ensure panel is visible
                    setRightPanelHidden(false);
                    lastRightClickRef.current = 0;
                    return;
                  }
                  lastRightClickRef.current = now;

                  setIsResizingRight(true);
                  setDragStartedAsMerged(false); // Track that drag started from unmerged state
                  setRightPanelAutoOpened(false); // User manually interacted with it
                }}
              />
            </div>
          )}

          {/* Right Arrow button - show when panel is hidden */}
          {!showRightPanel && !panelsMerged && (
            <div
              className="fixed top-1/2 -translate-y-1/2 z-50 right-0"
              onClick={() => {
                setShowRightPanel(true);
                setRightPanelHidden(false);
                setRightPanelExpanding(true);
                setRightPanelWidth(DEFAULT_RIGHT_WIDTH); // Restore to default width
                setRightPanelAutoOpened(false); // User manually opened it
                setTimeout(() => setRightPanelExpanding(false), 300);
              }}
            >
              <div className="bg-white shadow-md rounded-l-lg px-2 py-4 cursor-pointer">
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </div>
            </div>
          )}

          {/* Right Panel - Chat */}
          <div
            style={{
              width: showRightPanel ? rightPanelWidth : 0,
              transition: isResizingRight ? 'none' :
                        (rightPanelCollapsing ? 'width 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)' :
                         rightPanelExpanding ? 'width 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)' :
                         rightPanelRestoring ? 'width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' :
                         rightContentTransitioning ? `all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)` :
                         isMerging ? 'width 0.4s cubic-bezier(0.4, 0.0, 0.2, 1)' :
                         rightPanelAnimating ? 'width 0.4s cubic-bezier(0.4, 0.0, 0.2, 1)' :
                         'width 0.3s ease-in-out'),
              transform: rightPanelCollapsing ? 'scale(0.98)' :
                        rightPanelExpanding ? 'scale(1.02)' :
                        'scale(1)',
              opacity: rightPanelHidden ? 0 : 1
            }}
            className="h-full flex-shrink-0 origin-right bg-white overflow-hidden"
          >
            <div className={`h-full flex flex-col min-h-0 ${(!showRightPanel || rightPanelWidth <= 0) ? 'invisible' : 'visible'}`}>
              {console.log('=== Right Panel Render ===', {
                showRightPanel,
                selectedEvent,
                hasSelectedEvent: !!selectedEvent
              })}
              <div className="relative flex-1 min-h-0 overflow-hidden">
                {/* ChatModule with fade/slide animation */}
                <div className={`absolute inset-0 transition-all duration-300 ease-in-out ${
                  !selectedEvent
                    ? 'opacity-100 translate-x-0'
                    : 'opacity-0 -translate-x-4 pointer-events-none'
                }`}>
                  <ChatModule
                    className="h-full"
                    shouldAutoFocus={false}
                  />
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

                          // Handle recurring event updates based on option
                          if (updateOption === 'single' || updateOption === 'following' || updateOption === 'all') {
                            // Check if this is a virtual event
                            if (cleanedEvent.isVirtual && cleanedEvent.parentId) {
                              if (updateOption === 'single') {
                                // Create an exception event for this specific occurrence
                                const exceptionEvent = {
                                  ...cleanedEvent,
                                  id: `exception-${Date.now()}`,
                                  isVirtual: false,
                                  parentId: undefined,
                                  recurrenceGroupId: cleanedEvent.parentId,
                                  recurrence: undefined
                                };

                                setCalendarEvents(prev => {
                                  const parent = prev.find(e => e.id === cleanedEvent.parentId);
                                  if (!parent) return prev;

                                  const updatedParent = {
                                    ...parent,
                                    excludedDates: [
                                      ...(parent.excludedDates || []),
                                      cleanedEvent.start
                                    ]
                                  };

                                  return [
                                    ...prev.filter(e => e.id !== parent.id),
                                    updatedParent,
                                    exceptionEvent
                                  ];
                                });
                              } else if (updateOption === 'all') {
                                // Update the parent event
                                setCalendarEvents(prev => {
                                  return prev.map(e => {
                                    if (e.id === cleanedEvent.parentId) {
                                      return {
                                        ...e,
                                        title: cleanedEvent.title,
                                        color: cleanedEvent.color,
                                        description: cleanedEvent.description,
                                        location: cleanedEvent.location,
                                      };
                                    }
                                    return e;
                                  });
                                });
                              }
                            } else {
                              // Non-virtual event - update normally
                              setCalendarEvents(prev => {
                                const exists = prev.some(e => e.id === cleanedEvent.id);
                                if (!exists) {
                                  return [...prev, cleanedEvent];
                                } else {
                                  return prev.map(e => e.id === cleanedEvent.id ? cleanedEvent : e);
                                }
                              });
                            }
                          } else {
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
                          }

                          // Always update selectedEvent to keep it in sync (removes justCreated flag)
                          if (selectedEvent && selectedEvent.id === cleanedEvent.id) {
                            if (isPreview) {
                              // For previews, update color and time properties
                              const previewEvent = {
                                ...selectedEvent,
                                color: cleanedEvent.color,
                                start: cleanedEvent.start,
                                end: cleanedEvent.end
                              };
                              setSelectedEvent(previewEvent);
                              // Also update in calendarEvents for immediate visual feedback
                              setCalendarEvents(prev => prev.map(e =>
                                e.id === cleanedEvent.id ? previewEvent : e
                              ));
                            } else {
                              // For actual saves, update the entire event (this removes justCreated)
                              setSelectedEvent(cleanedEvent);
                            }
                          }
                        }}
                        onDelete={(eventId) => {
                          handleDeleteEvent(eventId);
                          setSelectedEvent(null);

                          // If we auto-opened the right panel for this event, close it
                          if (rightPanelAutoOpened) {
                            setShowRightPanel(false);
                            setRightPanelHidden(true);
                            setRightPanelWidth(0);
                            setRightPanelAutoOpened(false);
                          }
                        }}
                        onCancel={() => {
                          // If we auto-opened the right panel for this event, close it instantly
                          if (rightPanelAutoOpened) {
                            // Instantly hide the panel and clear selection
                            setShowRightPanel(false);
                            setRightPanelHidden(true);
                            setRightPanelWidth(0); // Set width to 0 to match dragged-to-edge state
                            setRightPanelAutoOpened(false);
                            setSelectedEvent(null);
                          } else {
                            // If panel wasn't auto-opened, just clear the selection normally
                            setSelectedEvent(null);
                          }
                        }}
                    />
                  )}
                </div>
              </div>
            </div>
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

export default function ChronosApp() {
  return (
    <LiveEventProvider>
      <ChronosAppContent />
    </LiveEventProvider>
  );
}