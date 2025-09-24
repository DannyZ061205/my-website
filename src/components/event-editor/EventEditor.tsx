'use client';

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { CalendarEvent, EventColor, ReminderOption } from '@/types';
import { useLiveEvent } from '@/contexts/LiveEventContext';
import { PortalTimePicker } from './PortalTimePicker';
import { PortalRepeatPicker } from './PortalRepeatPicker';
import { PortalDropdown } from './PortalDropdown';
import { DeleteRecurringModal } from '../calendar/DeleteRecurringModal';
import { EditRecurringPropertiesModal } from '../calendar/EditRecurringPropertiesModal';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface EventEditorProps {
  event: CalendarEvent | null;
  onSave: (event: CalendarEvent, updateOption?: 'single' | 'following' | 'all' | boolean) => void;
  onCancel: () => void;
  onDelete?: (eventId: string, deleteOption?: 'single' | 'following' | 'all') => void;
  className?: string;
}

export const EventEditor: React.FC<EventEditorProps> = memo(({
  event,
  onSave,
  onCancel,
  onDelete,
  className = ''
}) => {
  const [editedEvent, setEditedEvent] = useState<CalendarEvent | null>(null);
  const [localTitle, setLocalTitle] = useState('');
  const [localDescription, setLocalDescription] = useState('');
  const [repeatOption, setRepeatOption] = useState<string>('none');
  const [editingField, setEditingField] = useState<'start' | 'end' | 'repeat' | 'category' | 'location' | 'color' | 'reminder' | 'meeting' | null>(null);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [tempDescription, setTempDescription] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [fullScreenMode, setFullScreenMode] = useState<'editor' | 'preview'>('editor');
  const [descriptionHistory, setDescriptionHistory] = useState<string[]>([]);
  const [descriptionHistoryIndex, setDescriptionHistoryIndex] = useState(-1);
  const [mounted, setMounted] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Mouse movement detection for fullscreen UI
  const [showFullscreenControls, setShowFullscreenControls] = useState(true); // Start visible
  const mouseVelocityRef = useRef({ x: 0, y: 0, lastX: 0, lastY: 0, lastTime: Date.now() });
  const hideControlsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const VELOCITY_THRESHOLD = 1; // pixels per millisecond (more sensitive)
  const HIDE_DELAY = 3000; // 3 seconds

  // Preview width control sliders
  const DEFAULT_PREVIEW_WIDTH = 60; // default width percentage
  const [previewContentWidth, setPreviewContentWidth] = useState(DEFAULT_PREVIEW_WIDTH);
  const [isDraggingLeftSlider, setIsDraggingLeftSlider] = useState(false);
  const [isDraggingRightSlider, setIsDraggingRightSlider] = useState(false);
  const lastLeftSliderClick = useRef<number>(0);
  const lastRightSliderClick = useRef<number>(0)
  const [showEditModal, setShowEditModal] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Partial<CalendarEvent> | null>(null);
  const [isNewEvent, setIsNewEvent] = useState(false);
  const [titleInputEnabled, setTitleInputEnabled] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [locations, setLocations] = useState<string[]>([]);
  const [newLocationInput, setNewLocationInput] = useState('');
  const [hoveredMeeting, setHoveredMeeting] = useState<string | null>(null);
  const [hasMeetingBeenSelected, setHasMeetingBeenSelected] = useState(false);
  const [hoveredReminder, setHoveredReminder] = useState<string | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [hoveredLocation, setHoveredLocation] = useState<string | null>(null);
  const [hoveredColor, setHoveredColor] = useState<string | null>(null);
  const [hoveredRepeat, setHoveredRepeat] = useState<string | null>(null);
  const [hoveredStartTime, setHoveredStartTime] = useState<string | null>(null);
  const [hoveredEndTime, setHoveredEndTime] = useState<string | null>(null);
  const [meetingStatus, setMeetingStatus] = useState<'idle' | 'creating' | 'created'>('idle');
  const [meetingLink, setMeetingLink] = useState<string>('');

  // Use the live event context for instant updates
  const { updateLiveEvent, clearLiveEvent } = useLiveEvent();
  const [meetingCode, setMeetingCode] = useState<string>('');

  const editorRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editedEventRef = useRef<CalendarEvent | null>(null);
  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs for portal dropdown triggers
  const startTimeRef = useRef<HTMLElement>(null!);
  const endTimeRef = useRef<HTMLElement>(null!);
  const repeatRef = useRef<HTMLElement>(null!);
  const colorRef = useRef<HTMLElement>(null!);
  const categoryRef = useRef<HTMLElement>(null!);
  const locationRef = useRef<HTMLElement>(null!);
  const reminderRef = useRef<HTMLElement>(null!);
  const meetingRef = useRef<HTMLElement>(null!);

  // mount guard for portal and auto-focus
  useEffect(() => {
    setMounted(true);
    // Load categories from localStorage
    const savedCategories = localStorage.getItem('eventCategories');
    if (savedCategories) {
      try {
        const parsed = JSON.parse(savedCategories);
        if (Array.isArray(parsed)) {
          setCategories(parsed);
        }
      } catch (e) {
        console.error('Failed to parse saved categories:', e);
      }
    }
    // Load locations from localStorage
    const savedLocations = localStorage.getItem('eventLocations');
    if (savedLocations) {
      try {
        const parsed = JSON.parse(savedLocations);
        if (Array.isArray(parsed)) {
          setLocations(parsed);
        }
      } catch (e) {
        console.error('Failed to parse saved locations:', e);
      }
    }
  }, []);

  // Auto-focus and select for new events
  useEffect(() => {
    if (event) {
      // Only truly new events have the justCreated flag
      const eventIsNew = event.justCreated === true;
      setIsNewEvent(eventIsNew);

      // Set whether title input should be enabled based on if it's a new event
      setTitleInputEnabled(eventIsNew);

      // Auto-focus and select title input ONLY for just-created events
      if (eventIsNew) {
        // Small delay to ensure component is mounted
        const timer = setTimeout(() => {
          if (titleInputRef.current) {
            titleInputRef.current.focus({ preventScroll: true });
            // Only select text if there's actually text to select (not for empty titles)
            if (titleInputRef.current.value.trim()) {
              titleInputRef.current.select();
            }
          }
        }, 50);

        return () => clearTimeout(timer);
      }
    }
  }, [event?.id, event?.justCreated]); // Trigger on event ID or justCreated change

  // Helper to check if event is part of recurring series
  const isRecurringEvent = useCallback((evt: CalendarEvent) => {
    return (evt.isVirtual && evt.parentId) ||
           (evt.recurrence && evt.recurrence !== 'none') ||
           (evt.recurrenceGroupId && !evt.isVirtual);
  }, []);

  // Define debouncedSave before any conditional returns
  const debouncedSave = useCallback(
    (updatedEvent: CalendarEvent) => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => {
        // Always save the event to keep it in sync with parent
        // The parent will handle deletion if needed

        // Clear the justCreated flag on first save
        const eventToSave = { ...updatedEvent };
        delete eventToSave.justCreated;

        // Check if this is a recurring event and we have significant changes
        if (event && isRecurringEvent(event)) {
          const hasSignificantChanges =
            eventToSave.title !== event.title ||
            eventToSave.description !== event.description ||
            eventToSave.color !== event.color ||
            eventToSave.category !== event.category ||
            eventToSave.location !== event.location ||
            eventToSave.reminder !== event.reminder ||
            eventToSave.meeting !== event.meeting ||
            eventToSave.recurrence !== event.recurrence;

          if (hasSignificantChanges) {
            // Store the pending changes and show modal
            setPendingChanges(eventToSave);
            setShowEditModal(true);
            return;
          }
        }
        // For non-recurring events, new events, or minor changes, save directly
        onSave(eventToSave);
      }, 300); // Reduced debounce for better responsiveness
    },
    [onSave, event, isRecurringEvent]
  );

  // Keep ref in sync with state
  useEffect(() => {
    editedEventRef.current = editedEvent;
  }, [editedEvent]);

  // Helper to check if event has been modified
  const hasEventBeenModified = useCallback((evt: CalendarEvent): boolean => {
    return !!(
      evt.title?.trim() ||
      evt.description?.trim() ||
      evt.category ||
      evt.reminder ||
      evt.reminders?.length ||
      evt.meeting ||
      evt.recurrence ||
      evt.color !== 'blue'
    );
  }, []);

  // Mouse movement handler for fullscreen mode
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isFullScreen) return;

    const now = Date.now();
    const timeDelta = now - mouseVelocityRef.current.lastTime;

    if (timeDelta > 0) {
      const distanceX = Math.abs(e.clientX - mouseVelocityRef.current.lastX);
      const distanceY = Math.abs(e.clientY - mouseVelocityRef.current.lastY);
      const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
      const velocity = distance / timeDelta;

      // Show controls if velocity exceeds threshold
      if (velocity > VELOCITY_THRESHOLD) {
        setShowFullscreenControls(true);

        // Clear existing timer
        if (hideControlsTimerRef.current) {
          clearTimeout(hideControlsTimerRef.current);
        }

        // Set new timer to hide controls after 3 seconds
        hideControlsTimerRef.current = setTimeout(() => {
          setShowFullscreenControls(false);
        }, HIDE_DELAY);
      }
    }

    // Update last position and time
    mouseVelocityRef.current = {
      x: e.clientX,
      y: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      lastTime: now
    };
  }, [isFullScreen]);

  // Cleanup timer on unmount and handle fullscreen state changes
  useEffect(() => {
    if (isFullScreen) {
      // Show controls when entering fullscreen
      setShowFullscreenControls(true);

      // Start timer to hide after 3 seconds
      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
      }
      hideControlsTimerRef.current = setTimeout(() => {
        setShowFullscreenControls(false);
      }, HIDE_DELAY);
    }

    return () => {
      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
      }
    };
  }, [isFullScreen]);

  // Handle slider drag for preview width
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingLeftSlider && !isDraggingRightSlider) return;

      const viewportWidth = window.innerWidth;
      const mouseX = e.clientX;

      if (isDraggingLeftSlider) {
        // Left slider position as percentage from left edge
        const leftPosition = (mouseX / viewportWidth) * 100;
        // Calculate width: 100% - (2 * distance from edge)
        // Allow left slider to go all the way to 0
        const newWidth = Math.max(10, Math.min(100, 100 - (2 * leftPosition)));
        setPreviewContentWidth(newWidth);
      } else if (isDraggingRightSlider) {
        // Right slider position as percentage from left edge
        const rightPosition = (mouseX / viewportWidth) * 100;
        // Calculate width: 2 * distance from left edge - 100%
        // Allow right slider to go all the way to 100
        const newWidth = Math.max(10, Math.min(100, 2 * rightPosition - 100));
        setPreviewContentWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingLeftSlider(false);
      setIsDraggingRightSlider(false);
    };

    if (isDraggingLeftSlider || isDraggingRightSlider) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ew-resize';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'auto';
    };
  }, [isDraggingLeftSlider, isDraggingRightSlider]);

  // Force immediate save (bypass debounce)
  const forceSave = useCallback(() => {
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
      saveTimeout.current = null;
    }
    const currentEvent = editedEventRef.current;
    if (currentEvent && hasEventBeenModified(currentEvent)) {
      console.log('Force saving modified event');
      // Clear the justCreated flag before saving
      const eventToSave = { ...currentEvent };
      delete eventToSave.justCreated;
      onSave(eventToSave);
    }
  }, [onSave, hasEventBeenModified]);

  useEffect(() => {
    // Update internal state if it's a different event OR if the position changed (after drag)
    if (event && (!editedEvent ||
        editedEvent.id !== event.id ||
        editedEvent.start !== event.start ||
        editedEvent.end !== event.end)) {
      setEditedEvent({ ...event });
      setLocalTitle(event.title || '');
      setLocalDescription(event.description || '');
      // If event has a meeting value, set the flag
      if (event.meeting) {
        setHasMeetingBeenSelected(true);
        // Generate mock meeting data for existing meetings
        setMeetingStatus('created');
        if (event.meeting === 'google-meet') {
          setMeetingLink('https://meet.google.com/izf-wqpw-tqo');
          setMeetingCode('izf-wqpw-tqo');
        } else if (event.meeting === 'zoom') {
          setMeetingLink('https://zoom.us/j/1234567890');
          setMeetingCode('123-456-7890');
        } else if (event.meeting === 'tencent-meeting') {
          setMeetingLink('https://meeting.tencent.com/dm/ABC123');
          setMeetingCode('ABC-123');
        }
      } else {
        setMeetingStatus('idle');
        setMeetingLink('');
        setMeetingCode('');
      }
      if (event.meeting) {
        setHasMeetingBeenSelected(true);
      }
      // Parse repeat option from event if it has recurrence
      if (event.recurrence) {
        if (event.recurrence.includes('FREQ=DAILY') && !event.recurrence.includes('BYDAY')) {
          setRepeatOption('daily');
        } else if (event.recurrence.includes('FREQ=DAILY') && event.recurrence.includes('BYDAY=MO,TU,WE,TH,FR')) {
          setRepeatOption('weekday');
        } else if (event.recurrence.includes('FREQ=DAILY') && event.recurrence.includes('BYDAY=SA,SU')) {
          setRepeatOption('weekend');
        } else if (event.recurrence.includes('FREQ=WEEKLY') && event.recurrence.includes('INTERVAL=2')) {
          setRepeatOption('biweekly');
        } else if (event.recurrence.includes('FREQ=WEEKLY')) {
          setRepeatOption('weekly');
        } else if (event.recurrence.includes('FREQ=MONTHLY')) {
          setRepeatOption('monthly');
        } else if (event.recurrence.includes('FREQ=YEARLY')) {
          setRepeatOption('yearly');
        } else {
          setRepeatOption('custom');
        }
      } else {
        setRepeatOption('none');
      }
    }
  }, [event?.id, event?.start, event?.end]); // Depend on ID and position to handle drag updates

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const targetElement = target as HTMLElement;

      // If click is inside the main editor, ignore
      if (editorRef.current && editorRef.current.contains(target)) {
        return;
      }

      // If click is inside any picker dropdown (now rendered in portals), ignore
      const isInPicker = targetElement.closest('.time-picker') ||
                         targetElement.closest('.repeat-picker') ||
                         targetElement.closest('.color-picker') ||
                         targetElement.closest('.category-picker') ||
                         targetElement.closest('.reminder-picker') ||
                         targetElement.closest('.meeting-picker') ||
                         targetElement.closest('[role="listbox"]') ||
                         targetElement.closest('[role="dialog"]');
      if (isInPicker) return;

      // Check if click is on any of the portal dropdown trigger buttons
      const isOnTriggerButton = startTimeRef.current?.contains(target) ||
                               endTimeRef.current?.contains(target) ||
                               repeatRef.current?.contains(target) ||
                               colorRef.current?.contains(target) ||
                               categoryRef.current?.contains(target) ||
                               reminderRef.current?.contains(target) ||
                               meetingRef.current?.contains(target);
      if (isOnTriggerButton) return;

      // If click is inside the fullscreen portal, ignore
      const portalRoot = typeof document !== 'undefined' ? document.getElementById('event-editor-portal') : null;
      if (portalRoot && portalRoot.contains(target)) return;

      // If click is inside any modal (including delete modal), ignore
      const modalContent = targetElement.closest('[data-modal-content]');
      if (modalContent) return;

      // If click is on a calendar event, ignore (to prevent deselecting when clicking the same event)
      const closestEvent = targetElement.closest('[data-event-id]');
      if (closestEvent) return;

      // Force save the event immediately if it has been modified
      const currentEvent = editedEventRef.current;
      if (currentEvent && hasEventBeenModified(currentEvent)) {
        console.log('EventEditor: Force saving modified event before closing');
        // Clear any pending debounced saves first
        if (saveTimeout.current) {
          clearTimeout(saveTimeout.current);
          saveTimeout.current = null;
        }
        // Save immediately
        onSave(currentEvent);
      }

      // Close the editor
      onCancel();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullScreen) {
          setIsFullScreen(false);
        } else {
          // Just close the editor - deletion handled when new action starts
          onCancel();
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        // Check if we're currently in an input field or textarea
        const activeElement = document.activeElement;
        const isInTextField = activeElement && (
          activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.getAttribute('contenteditable') === 'true'
        );

        // Special case: if we're in the title input and it's empty, let the input's handler delete the event
        const isTitleInput = activeElement === titleInputRef.current;
        const isTitleEmpty = !editedEvent?.title?.trim();

        // If not in a text field, OR if in the empty title field, delete the entire event
        // (but let the title input's own handler take care of it if it's the title input)
        if (!isInTextField && editedEvent && onDelete) {
          e.preventDefault();
          e.stopPropagation();
          onDelete(editedEvent.id);
        }
      }
    };

    // Small delay to prevent immediate closing when the editor opens
    const timer = setTimeout(() => {
      // Use click event instead of mousedown to avoid timing conflicts with button onClick
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onCancel, onSave, onDelete, isFullScreen, saveTimeout, hasEventBeenModified, editedEvent]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      // Clear live event data when component unmounts
      if (editedEvent) {
        clearLiveEvent(editedEvent.id);
      }
    };
  }, [editedEvent?.id, clearLiveEvent]);

  // Set cursor position to end when editing description
  useEffect(() => {
    if (isEditingDescription && descriptionTextareaRef.current) {
      // Use requestAnimationFrame to avoid layout shifts
      const focusFrame = requestAnimationFrame(() => {
        if (descriptionTextareaRef.current) {
          const textarea = descriptionTextareaRef.current;
          textarea.focus({ preventScroll: true });
          const length = textarea.value.length;
          textarea.setSelectionRange(length, length);
        }
      });

      return () => cancelAnimationFrame(focusFrame);
    }
  }, [isEditingDescription]);

  if (!editedEvent) return null;

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDateForDisplay = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };


  const updateTimeFromPicker = (field: 'start' | 'end', newTimeISO: string) => {
    if (!editedEvent) return;
    // Keep the same date but use the new time
    const newTime = new Date(newTimeISO);
    const currentDate = new Date(editedEvent[field]);
    currentDate.setHours(newTime.getHours(), newTime.getMinutes(), 0, 0);
    updateEvent(field, currentDate.toISOString());
    // Don't close the picker - let user close it by clicking outside
  };

  const previewColor = (color: string | null) => {
    if (!editedEvent) return;

    // If hovering, show preview immediately without saving
    if (color) {
      const previewEvent = { ...editedEvent, color: color as EventColor };
      onSave(previewEvent, true); // Pass true to indicate this is just a preview
    } else {
      // Restore original color when not hovering
      onSave(editedEvent, true);
    }
  };

  const previewTime = (field: 'start' | 'end', newTimeISO: string | null) => {
    if (!editedEvent) return;

    // If hovering, show preview immediately without saving
    if (newTimeISO) {
      // Keep the same date but use the new time
      const newTime = new Date(newTimeISO);
      const currentDate = new Date(editedEvent[field]);
      currentDate.setHours(newTime.getHours(), newTime.getMinutes(), 0, 0);

      const previewEvent = { ...editedEvent, [field]: currentDate.toISOString() };

      // If adjusting start time and end would be before start, adjust end too
      if (field === 'start' && new Date(previewEvent.start) >= new Date(previewEvent.end)) {
        const duration = new Date(editedEvent.end).getTime() - new Date(editedEvent.start).getTime();
        const newEnd = new Date(currentDate.getTime() + duration);
        previewEvent.end = newEnd.toISOString();
      }

      // If adjusting end time and it would be before start, keep minimum 30 min duration
      if (field === 'end' && new Date(previewEvent.end) <= new Date(previewEvent.start)) {
        const minEnd = new Date(new Date(previewEvent.start).getTime() + 30 * 60 * 1000);
        previewEvent.end = minEnd.toISOString();
      }

      onSave(previewEvent, true); // Pass true to indicate this is just a preview
    } else {
      // Restore original time when not hovering
      onSave(editedEvent, true);
    }
  };

  const updateEvent = (field: keyof CalendarEvent, value: any) => {
    if (!editedEvent) return;

    const updated = { ...editedEvent, [field]: value };
    setEditedEvent(updated);

    // Handle recurrence updates
    if (field === 'recurrence') {
      const updatedWithRecurrence = { ...updated };
      switch (value) {
        case 'daily':
          updatedWithRecurrence.recurrence = 'FREQ=DAILY';
          break;
        case 'weekly':
          updatedWithRecurrence.recurrence = 'FREQ=WEEKLY';
          break;
        case 'monthly':
          updatedWithRecurrence.recurrence = 'FREQ=MONTHLY';
          break;
        case 'none':
          delete updatedWithRecurrence.recurrence;
          break;
      }
      // Save recurrence changes immediately for better UX
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      onSave(updatedWithRecurrence);
    } else if (field === 'title') {
      // Save title changes immediately without debounce for live preview
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      onSave(updated);
    } else {
      // Debounce other saves to prevent flickering and focus loss
      // The state update above will immediately update the UI
      // But the actual save is debounced to prevent re-renders
      debouncedSave(updated);
    }
  };

  const handleDelete = () => {
    console.log('EventEditor: handleDelete called');
    console.log('EventEditor: editedEvent:', editedEvent);
    console.log('EventEditor: onDelete exists:', !!onDelete);

    if (editedEvent && onDelete) {
      // Check if this is a recurring event (base or virtual)
      // Base events have a recurrence rule, virtual events have a recurrenceGroupId
      // Be extra explicit about checking for truthy values
      const hasRecurrence = editedEvent.recurrence && editedEvent.recurrence !== '' && editedEvent.recurrence !== 'none';
      const hasRecurrenceGroupId = editedEvent.recurrenceGroupId && editedEvent.recurrenceGroupId !== '';
      const isRecurringEvent = hasRecurrence || hasRecurrenceGroupId;

      console.log('EventEditor: Delete check for event:', {
        id: editedEvent.id,
        title: editedEvent.title,
        recurrence: editedEvent.recurrence,
        recurrenceGroupId: editedEvent.recurrenceGroupId,
        isRecurrenceBase: editedEvent.isRecurrenceBase,
        isVirtual: editedEvent.isVirtual,
        hasRecurrence,
        hasRecurrenceGroupId,
        isRecurringEvent
      });

      // Check if this is a recurring event
      if (isRecurringEvent) {
        console.log('EventEditor: Recurring event detected, showing delete modal');
        setShowDeleteModal(true);
      } else {
        console.log('EventEditor: Non-recurring event, calling onDelete directly');
        onDelete(editedEvent.id);
      }
    } else {
      console.error('EventEditor: Cannot delete - missing editedEvent or onDelete');
    }
  };

  return (
    <div
      ref={editorRef}
      className={`${className} bg-white h-full border-l ${isNewEvent && !editedEvent.title ? 'border-yellow-400 animate-pulse' : 'border-gray-200'} p-4 relative z-40 flex flex-col overflow-hidden`}
    >
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header with close button */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <input
            ref={titleInputRef}
            type="text"
            value={localTitle}
            onChange={(e) => {
              const newTitle = e.target.value;
              setLocalTitle(newTitle);
              // Update the live context for instant display update
              if (editedEvent) {
                updateLiveEvent(editedEvent.id, { title: newTitle });
                const updated = { ...editedEvent, title: newTitle };
                setEditedEvent(updated);
                editedEventRef.current = updated;
              }
            }}
            onBlur={() => {
              // Save the final state (not a preview)
              if (editedEventRef.current) {
                const eventToSave = { ...editedEventRef.current };
                delete eventToSave.justCreated; // Clear the flag now that user is done
                onSave(eventToSave);
              }

              // Disable input after saving new event
              if (editedEvent && editedEvent.justCreated) {
                setTitleInputEnabled(false);
              }
            }}
            autoFocus={false}
            tabIndex={titleInputEnabled ? 0 : -1}
            readOnly={!titleInputEnabled}
            onClick={() => {
              // Enable editing when clicked (for existing events)
              if (!titleInputEnabled) {
                setTitleInputEnabled(true);
                // Focus after enabling
                setTimeout(() => {
                  if (titleInputRef.current) {
                    titleInputRef.current.focus();
                    // Place cursor at click position, don't select all
                    const length = titleInputRef.current.value.length;
                    titleInputRef.current.setSelectionRange(length, length);
                  }
                }, 0);
              }
            }}
              onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                // If title is empty, don't save or close
                if (!localTitle.trim()) {
                  return;
                }
                // Update event with local title before saving
                if (editedEvent) {
                  const updatedEvent = { ...editedEvent, title: localTitle };
                  setEditedEvent(updatedEvent);
                  // Mark as no longer new (stops the yellow border)
                  setIsNewEvent(false);
                  // Force immediate save when Enter is pressed with a title
                  if (saveTimeout.current) {
                    clearTimeout(saveTimeout.current);
                  }
                  // Clear justCreated flag when saving
                  const eventToSave = { ...updatedEvent };
                  delete eventToSave.justCreated;
                  onSave(eventToSave);
                  // Blur the input to remove focus
                  if (titleInputRef.current) {
                    titleInputRef.current.blur();
                  }
                }
              } else if (e.key === 'Delete' || e.key === 'Backspace') {
                // Delete the event if it's empty (no title)
                if (!localTitle.trim()) {
                  console.log('EventEditor: Delete pressed on empty title, deleting event');
                  e.preventDefault();
                  e.stopPropagation();
                  if (onDelete && editedEvent) {
                    onDelete(editedEvent.id);
                  }
                  onCancel();
                }
              } else if (e.key === 'Escape') {
                // Close the editor on Escape
                e.preventDefault();
                e.stopPropagation();
                // Save any pending changes if there's a title
                if (localTitle.trim() && editedEvent) {
                  const updatedEvent = { ...editedEvent, title: localTitle };
                  if (saveTimeout.current) {
                    clearTimeout(saveTimeout.current);
                  }
                  // Clear justCreated flag when saving
                  const eventToSave = { ...updatedEvent };
                  delete eventToSave.justCreated;
                  onSave(eventToSave);
                }
                onCancel();
              }
            }}
            onBlur={() => {
              // Save the local title if changed
              if (editedEvent && localTitle !== editedEvent.title) {
                updateEvent('title', localTitle);
              }
              // Remove the new event flag when losing focus
              setIsNewEvent(false);
            }}
            className={`flex-1 text-xl sm:text-2xl font-semibold bg-transparent border ${isNewEvent && !localTitle ? 'border-yellow-300' : 'border-transparent'} hover:border-gray-200 focus:border-gray-300 rounded-md px-2 sm:px-3 py-1 sm:py-1.5 outline-none focus:ring-0 text-gray-900 placeholder-gray-400 transition-colors min-w-0 truncate focus:overflow-visible focus:text-clip ${!titleInputEnabled ? 'cursor-text hover:bg-gray-50' : ''}`}
            placeholder={isNewEvent ? "Type event name..." : "Event name"}
            title={localTitle}
          />
          {onDelete && (
            <button
              onClick={handleDelete}
              data-delete-button
              className="p-2 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
              aria-label="Delete"
              title="Delete event"
            >
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Time Section - Compact Layout with Duration */}
        <div className="relative">
          <div className="w-full flex items-center justify-between py-3 px-3 -mx-2">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>

              <div className="flex flex-col">
                <span className="flex items-center text-gray-700">
                  {/* Start Time */}
                  <div className="relative">
                    <button
                      ref={startTimeRef as React.RefObject<HTMLButtonElement>}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const newField = editingField === 'start' ? null : 'start';
                        setEditingField(newField);
                      }}
                      className={`px-2 py-0.5 -ml-2 text-gray-700 hover:text-gray-900 rounded transition-colors ${
                        editingField === 'start' ? 'bg-gray-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      {hoveredStartTime || formatTime(editedEvent.start)}
                    </button>
                    <PortalTimePicker
                      isOpen={editingField === 'start'}
                      triggerRef={startTimeRef}  // Use the start time ref as anchor for both
                      value={editedEvent.start}
                      onChange={(time) => updateTimeFromPicker('start', time)}
                      onClose={() => {
                        setEditingField(null);
                        setHoveredStartTime(null);
                        previewTime('start', null);  // Reset preview on close
                      }}
                      onHover={(timeStr) => {
                        setHoveredStartTime(timeStr);
                        if (timeStr) {
                          // Convert the time string (e.g., "3:00 PM") to ISO datetime
                          const [time, period] = timeStr.split(' ');
                          const [hourStr, minuteStr] = time.split(':');
                          let hour = parseInt(hourStr, 10);
                          const minute = parseInt(minuteStr, 10);

                          // Convert to 24-hour format
                          if (period === 'PM' && hour !== 12) hour += 12;
                          if (period === 'AM' && hour === 12) hour = 0;

                          // Create new datetime with the hovered time
                          const currentDate = new Date(editedEvent.start);
                          const previewDate = new Date(currentDate);
                          previewDate.setHours(hour, minute, 0, 0);

                          previewTime('start', previewDate.toISOString());
                        } else {
                          previewTime('start', null);
                        }
                      }}
                    />
                  </div>

                  {/* Dash separator */}
                  <span className="text-gray-400 mx-0">–</span>

                  {/* End Time */}
                  <div className="relative">
                    <button
                      ref={endTimeRef as React.RefObject<HTMLButtonElement>}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const newField = editingField === 'end' ? null : 'end';
                        setEditingField(newField);
                      }}
                      className={`px-2 py-0.5 text-gray-700 hover:text-gray-900 rounded transition-colors ${
                        editingField === 'end' ? 'bg-gray-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      {hoveredEndTime || formatTime(editedEvent.end)}
                    </button>
                    <PortalTimePicker
                      isOpen={editingField === 'end'}
                      triggerRef={endTimeRef}
                      value={editedEvent.end}
                      onChange={(time) => updateTimeFromPicker('end', time)}
                      offsetX={-320}  // Move further left for end time
                      onClose={() => {
                        setEditingField(null);
                        setHoveredEndTime(null);
                        previewTime('end', null);  // Reset preview on close
                      }}
                      onHover={(timeStr) => {
                        setHoveredEndTime(timeStr);
                        if (timeStr) {
                          // Convert the time string (e.g., "3:00 PM") to ISO datetime
                          const [time, period] = timeStr.split(' ');
                          const [hourStr, minuteStr] = time.split(':');
                          let hour = parseInt(hourStr, 10);
                          const minute = parseInt(minuteStr, 10);

                          // Convert to 24-hour format
                          if (period === 'PM' && hour !== 12) hour += 12;
                          if (period === 'AM' && hour === 12) hour = 0;

                          // Create new datetime with the hovered time
                          const currentDate = new Date(editedEvent.end);
                          const previewDate = new Date(currentDate);
                          previewDate.setHours(hour, minute, 0, 0);

                          previewTime('end', previewDate.toISOString());
                        } else {
                          previewTime('end', null);
                        }
                      }}
                    />
                  </div>

                  {/* Duration Display */}
                  <span className="text-gray-500 text-xs ml-2">
                    ({(() => {
                      const start = new Date(editedEvent.start);
                      const end = new Date(editedEvent.end);
                      const diff = end.getTime() - start.getTime();
                      const hours = Math.floor(diff / (1000 * 60 * 60));
                      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

                      if (hours === 0) {
                        return `${minutes} min`;
                      } else if (minutes === 0) {
                        return `${hours}h`;
                      } else {
                        return `${hours}h ${minutes} min`;
                      }
                    })()})
                  </span>
                </span>

                {/* Date Display - on second line */}
                <span className="text-gray-500 text-sm mt-1">
                  {formatDateForDisplay(editedEvent.start)}
                </span>
              </div>
            </div>

            {/* Empty right side for alignment */}
            <div></div>
          </div>
        </div>

        {/* Show indicator if part of recurring series */}
        {editedEvent.recurrenceGroupId && !editedEvent.isRecurrenceBase && (
          <div className="flex items-center gap-3 text-sm text-gray-500 py-2">
            <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="italic">Part of a recurring series</span>
          </div>
        )}

        {/* Repeat - Only show for non-recurring or base events */}
        {(!editedEvent.recurrenceGroupId || editedEvent.isRecurrenceBase) && (
          <div className="relative">
            <button
              ref={repeatRef as React.RefObject<HTMLButtonElement>}
              data-field="repeat"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setEditingField(editingField === 'repeat' ? null : 'repeat');
              }}
              className={`group w-full flex items-center justify-between py-3 px-3 -mx-2 rounded-lg transition-colors ${
                editingField === 'repeat' ? 'bg-gray-50' : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="text-gray-700">
              {hoveredRepeat || (() => {
                const date = new Date(editedEvent.start);
                const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
                const dayOfMonth = date.getDate();

                switch (repeatOption) {
                  case 'none': return 'Does not repeat';
                  case 'daily': return 'Every day';
                  case 'weekday': return 'Every weekday';
                  case 'weekend': return 'Every weekend day';
                  case 'weekly': return `Every week on ${dayOfWeek}`;
                  case 'biweekly': return `Every 2 weeks on ${dayOfWeek}`;
                  case 'monthly': return `Every month on the ${dayOfMonth}${dayOfMonth === 1 ? 'st' : dayOfMonth === 2 ? 'nd' : dayOfMonth === 3 ? 'rd' : 'th'}`;
                  case 'monthly-week': {
                    const weekOfMonth = Math.ceil(dayOfMonth / 7);
                    const weekOrdinal = weekOfMonth === 1 ? '1st' : weekOfMonth === 2 ? '2nd' : weekOfMonth === 3 ? '3rd' : weekOfMonth === 4 ? '4th' : 'last';
                    return `Every month on the ${weekOrdinal} ${dayOfWeek}`;
                  }
                  case 'monthly-last': return `Every month on the last ${dayOfWeek}`;
                  case 'yearly': {
                    const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    return `Every year on ${monthDay}`;
                  }
                  case 'custom': return 'Custom... ✨';
                  default: return 'Does not repeat';
                }
              })()}
                </span>
              </div>
              <svg className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <PortalRepeatPicker
              isOpen={editingField === 'repeat'}
              triggerRef={repeatRef}
              value={repeatOption}
              eventDate={editedEvent.start}
              onChange={(rrule) => {
                // Update the recurrence field with the actual RRULE string
                // For recurrence changes from RepeatPicker, save immediately
                if (!editedEvent) return;
                const updatedEvent = { ...editedEvent, recurrence: rrule };
                setEditedEvent(updatedEvent);
                // Save immediately for recurrence changes
                if (saveTimeout.current) clearTimeout(saveTimeout.current);
                onSave(updatedEvent);
                // Update display state based on RRULE
                if (!rrule) {
                  setRepeatOption('none');
                } else if (rrule.includes('FREQ=DAILY') && !rrule.includes('BYDAY')) {
                  setRepeatOption('daily');
                } else if (rrule.includes('FREQ=DAILY') && rrule.includes('BYDAY=MO,TU,WE,TH,FR')) {
                  setRepeatOption('weekday');
                } else if (rrule.includes('FREQ=DAILY') && rrule.includes('BYDAY=SA,SU')) {
                  setRepeatOption('weekend');
                } else if (rrule.includes('FREQ=WEEKLY') && rrule.includes('INTERVAL=2')) {
                  setRepeatOption('biweekly');
                } else if (rrule.includes('FREQ=WEEKLY')) {
                  setRepeatOption('weekly');
                } else if (rrule.includes('FREQ=MONTHLY')) {
                  setRepeatOption('monthly');
                } else if (rrule.includes('FREQ=YEARLY')) {
                  setRepeatOption('yearly');
                } else {
                  setRepeatOption('custom');
                }
              }}
              onClose={() => {
                setEditingField(null);
                setHoveredRepeat(null);
              }}
              onHover={(label) => setHoveredRepeat(label)}
            />
          </div>
        )}

        {/* Event Color */}
        <div className="relative">
          <button
            ref={colorRef as React.RefObject<HTMLButtonElement>}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setEditingField(editingField === 'color' ? null : 'color');
            }}
            className={`group w-full flex items-center justify-between py-3 px-3 -mx-2 rounded-lg transition-colors ${
              editingField === 'color' ? 'bg-gray-50' : 'hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="4" y="4" width="6" height="6" rx="1" strokeWidth="2"/>
                <rect x="14" y="4" width="6" height="6" rx="1" strokeWidth="2"/>
                <rect x="4" y="14" width="6" height="6" rx="1" strokeWidth="2"/>
                <rect x="14" y="14" width="6" height="6" rx="1" strokeWidth="2"/>
              </svg>
              <span className="flex items-center gap-2">
              <span
                className={`inline-block w-4 h-4 rounded-full ${
                  (hoveredColor || editedEvent.color) === 'red' ? 'bg-red-500' :
                  (hoveredColor || editedEvent.color) === 'orange' ? 'bg-orange-500' :
                  (hoveredColor || editedEvent.color) === 'yellow' ? 'bg-yellow-500' :
                  (hoveredColor || editedEvent.color) === 'green' ? 'bg-green-500' :
                  (hoveredColor || editedEvent.color) === 'blue' ? 'bg-blue-500' :
                  (hoveredColor || editedEvent.color) === 'purple' ? 'bg-purple-500' :
                  (hoveredColor || editedEvent.color) === 'gray' ? 'bg-gray-500' :
                  'bg-blue-500'
                }`}
              ></span>
              <span
                className={
                  (hoveredColor || editedEvent.color) === 'red' ? 'text-red-600' :
                  (hoveredColor || editedEvent.color) === 'orange' ? 'text-orange-600' :
                  (hoveredColor || editedEvent.color) === 'yellow' ? 'text-yellow-600' :
                  (hoveredColor || editedEvent.color) === 'green' ? 'text-green-600' :
                  (hoveredColor || editedEvent.color) === 'blue' ? 'text-blue-600' :
                  (hoveredColor || editedEvent.color) === 'purple' ? 'text-purple-600' :
                  (hoveredColor || editedEvent.color) === 'gray' ? 'text-gray-600' :
                  'text-blue-600'
                }
              >
                {hoveredColor ?
                  (hoveredColor === 'gray' ? 'Grey' : hoveredColor.charAt(0).toUpperCase() + hoveredColor.slice(1)) :
                  (editedEvent.color ?
                    (editedEvent.color === 'gray' ? 'Grey' : editedEvent.color.charAt(0).toUpperCase() + editedEvent.color.slice(1)) :
                    'Blue')}
              </span>
              </span>
            </div>
            <svg className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <PortalDropdown
            isOpen={editingField === 'color'}
            triggerRef={colorRef}
            onClose={() => {
              setEditingField(null);
              setHoveredColor(null);
            }}
            offsetX={-253}
            offsetY={0}
          >
            <div
              className="color-picker"
              onMouseLeave={() => {
                setHoveredColor(null);
                previewColor(null);
              }}
            >
              <div className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden" style={{ width: '240px' }}>
                <div>
                  {[
                    { value: 'red', label: 'Red', bgColor: 'bg-red-500', textColor: 'text-red-600' },
                    { value: 'orange', label: 'Orange', bgColor: 'bg-orange-500', textColor: 'text-orange-600' },
                    { value: 'yellow', label: 'Yellow', bgColor: 'bg-yellow-500', textColor: 'text-yellow-600' },
                    { value: 'green', label: 'Green', bgColor: 'bg-green-500', textColor: 'text-green-600' },
                    { value: 'blue', label: 'Blue', bgColor: 'bg-blue-500', textColor: 'text-blue-600' },
                    { value: 'purple', label: 'Purple', bgColor: 'bg-purple-500', textColor: 'text-purple-600' },
                    { value: 'gray', label: 'Grey', bgColor: 'bg-gray-500', textColor: 'text-gray-600' },
                  ].map((option, index, array) => (
                    <div
                      key={option.value}
                      onMouseEnter={() => {
                        setHoveredColor(option.value);
                        previewColor(option.value);
                      }}
                      onMouseLeave={() => {
                        setHoveredColor(null);
                        previewColor(null);
                      }}
                      onClick={() => {
                        updateEvent('color', option.value as EventColor);
                        setEditingField(null);
                        setHoveredColor(null);
                      }}
                      className={`px-2 cursor-pointer ${
                        index === 0 ? 'pt-2' :
                        index === array.length - 1 ? 'pb-2' :
                        ''
                      }`}
                    >
                      <div className={`flex items-center px-2 py-2.5 rounded-md transition-colors ${
                        (editedEvent.color || 'blue') === option.value
                          ? 'bg-blue-50'
                          : 'hover:bg-gray-100'
                      }`}>
                        <div className="flex items-center gap-2 flex-1">
                          <span className={`inline-block w-4 h-4 rounded-full ${option.bgColor}`}></span>
                          <span className={`${option.textColor} text-sm`}>{option.label}</span>
                        </div>
                        {(editedEvent.color || 'blue') === option.value && (
                          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </PortalDropdown>
        </div>

        {/* Category */}
        <div className="relative">
          <button
            ref={categoryRef as React.RefObject<HTMLButtonElement>}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setEditingField(editingField === 'category' ? null : 'category');
            }}
            className={`group w-full flex items-center justify-between py-3 px-3 -mx-2 rounded-lg transition-colors ${
              editingField === 'category' ? 'bg-gray-50' : 'hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10v.001M7 7a3 3 0 00-3 3v10a3 3 0 003 3h10a3 3 0 003-3V10a3 3 0 00-3-3m-10 0h10M7 7V4a2 2 0 012-2h2a2 2 0 012 2v3" />
              </svg>
              <span className="text-gray-700">{hoveredCategory || editedEvent.category || 'Category'}</span>
            </div>
            <svg className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <PortalDropdown
            isOpen={editingField === 'category'}
            triggerRef={categoryRef}
            onClose={() => {
              setEditingField(null);
              setHoveredCategory(null);
            }}
            offsetX={-253}
            offsetY={0}
          >
            <div
              className="category-picker"
              onMouseLeave={() => setHoveredCategory(null)}
            >
              <div className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden" style={{ width: '240px' }}>
                {/* Add new category input */}
                <div className="p-2 border-b border-gray-200">
                  <input
                    type="text"
                    value={newCategoryInput}
                    onChange={(e) => setNewCategoryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newCategoryInput.trim()) {
                        const newCategory = newCategoryInput.trim();
                        // Check if there's an exact match first (case-insensitive)
                        const existingCategory = categories.find(cat =>
                          cat.toLowerCase() === newCategory.toLowerCase()
                        );

                        if (existingCategory) {
                          // Use the existing category with its original casing
                          updateEvent('category', existingCategory);
                        } else {
                          // Add as new category
                          const updatedCategories = [...categories, newCategory];
                          setCategories(updatedCategories);
                          localStorage.setItem('eventCategories', JSON.stringify(updatedCategories));
                          updateEvent('category', newCategory);
                        }
                        setNewCategoryInput('');
                        setEditingField(null);
                      }
                    }}
                    placeholder="Search or add category..."
                    className="w-full px-2 py-1 text-sm text-gray-900 placeholder-gray-500 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    autoFocus
                  />
                </div>
                {/* Existing categories */}
                <div>
                  {/* User categories - filtered by search input */}
                  {(() => {
                    const filteredCategories = categories.filter(cat =>
                      newCategoryInput.trim() === '' ||
                      cat.toLowerCase().includes(newCategoryInput.toLowerCase())
                    );

                    if (filteredCategories.length === 0 && newCategoryInput.trim()) {
                      return (
                        <div className="px-4 py-3 text-center">
                          <p className="text-sm text-gray-500">No matching categories</p>
                          <p className="text-xs text-gray-400 mt-1">Press Enter to create "{newCategoryInput.trim()}"</p>
                        </div>
                      );
                    }

                    return filteredCategories.map((cat, index, array) => (
                    <div
                      key={cat}
                      onMouseEnter={() => setHoveredCategory(cat)}
                      onMouseLeave={() => setHoveredCategory(null)}
                      onClick={() => {
                        // Toggle behavior: if clicking the same category, deselect it
                        if (editedEvent.category === cat) {
                          updateEvent('category', undefined);
                        } else {
                          updateEvent('category', cat);
                        }
                        setEditingField(null);
                        setHoveredCategory(null);
                      }}
                      className={`px-2 cursor-pointer ${
                        index === 0 ? 'pt-2' :
                        index === array.length - 1 ? 'pb-2' :
                        ''
                      }`}
                    >
                      <div className={`flex items-center px-2 py-2.5 rounded-md transition-colors ${
                        editedEvent.category === cat
                          ? 'bg-blue-50'
                          : 'hover:bg-gray-100'
                      }`}>
                        <span className="text-gray-700 text-sm flex-1">{cat}</span>
                        {editedEvent.category === cat && (
                          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                  ));
                  })()}
                </div>
              </div>
            </div>
          </PortalDropdown>
        </div>

        {/* Location */}
        <div className="relative">
          <button
            ref={locationRef as React.RefObject<HTMLButtonElement>}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setEditingField(editingField === 'location' ? null : 'location');
            }}
            className={`group w-full flex items-center justify-between py-3 px-3 -mx-2 rounded-lg transition-colors ${
              editingField === 'location' ? 'bg-gray-50' : 'hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-gray-700">{hoveredLocation || editedEvent.location || 'Location'}</span>
            </div>
            <svg className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <PortalDropdown
            isOpen={editingField === 'location'}
            triggerRef={locationRef}
            onClose={() => {
              setEditingField(null);
              setHoveredLocation(null);
            }}
            offsetX={-253}
            offsetY={0}
          >
            <div
              className="location-picker"
              onMouseLeave={() => setHoveredLocation(null)}
            >
              <div className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden" style={{ width: '240px' }}>
                {/* Add new location input */}
                <div className="p-2 border-b border-gray-200">
                  <input
                    type="text"
                    value={newLocationInput}
                    onChange={(e) => setNewLocationInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newLocationInput.trim()) {
                        const newLocation = newLocationInput.trim();
                        // Check if there's an exact match first (case-insensitive)
                        const existingLocation = locations.find(loc =>
                          loc.toLowerCase() === newLocation.toLowerCase()
                        );

                        if (existingLocation) {
                          // Use the existing location with its original casing
                          updateEvent('location', existingLocation);
                        } else {
                          // Add as new location
                          const updatedLocations = [...locations, newLocation];
                          setLocations(updatedLocations);
                          localStorage.setItem('eventLocations', JSON.stringify(updatedLocations));
                          updateEvent('location', newLocation);
                        }
                        setNewLocationInput('');
                        setEditingField(null);
                      }
                    }}
                    placeholder="Search or add location..."
                    className="w-full px-2 py-1 text-sm text-gray-900 placeholder-gray-500 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    autoFocus
                  />
                </div>
                {/* Existing locations */}
                <div>
                  {/* User locations - filtered by search input */}
                  {(() => {
                    const searchLower = newLocationInput.toLowerCase();
                    const filteredLocations = locations.filter(loc =>
                      loc.toLowerCase().includes(searchLower)
                    );

                    const defaultLocations = ['Home', 'Office', 'Remote'];
                    const combinedLocations = [...new Set([...filteredLocations, ...defaultLocations])];
                    const locationsToShow = combinedLocations.filter(loc =>
                      loc.toLowerCase().includes(searchLower)
                    );

                    if (locationsToShow.length === 0 && newLocationInput.trim()) {
                      return (
                        <div className="px-4 py-3 text-center">
                          <p className="text-sm text-gray-500">No matching locations</p>
                          <p className="text-xs text-gray-400 mt-1">Press Enter to create "{newLocationInput.trim()}"</p>
                        </div>
                      );
                    }

                    return locationsToShow.map((loc, index, array) => (
                      <div
                        key={loc}
                        onMouseEnter={() => setHoveredLocation(loc)}
                        onMouseLeave={() => setHoveredLocation(null)}
                        onClick={() => {
                          // Toggle behavior: if clicking the same location, deselect it
                          if (editedEvent.location === loc) {
                            updateEvent('location', undefined);
                          } else {
                            updateEvent('location', loc);
                          }
                          setEditingField(null);
                          setHoveredLocation(null);
                        }}
                        className={`px-2 cursor-pointer ${
                          index === 0 ? 'pt-2' :
                          index === array.length - 1 ? 'pb-2' :
                          ''
                        }`}
                      >
                        <div className={`flex items-center px-2 py-2.5 rounded-md transition-colors ${
                          editedEvent.location === loc
                            ? 'bg-blue-50'
                            : 'hover:bg-gray-100'
                        }`}>
                          <span className="text-gray-700 text-sm flex-1">{loc}</span>
                          {editedEvent.location === loc && (
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </PortalDropdown>
        </div>

        {/* Reminder */}
        <div className="relative">
          <button
            ref={reminderRef as React.RefObject<HTMLButtonElement>}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setEditingField(editingField === 'reminder' ? null : 'reminder');
            }}
            className={`group w-full flex items-center justify-between py-3 px-3 -mx-2 rounded-lg transition-colors ${
              editingField === 'reminder' ? 'bg-gray-50' : 'hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
              <span className="text-gray-700">
                {hoveredReminder || (() => {
                  if (!editedEvent.reminders || editedEvent.reminders.length === 0) return 'Reminders';
                  if (editedEvent.reminders.length === 1) {
                    switch (editedEvent.reminders[0]) {
                      case 'at-time': return 'At start of event';
                      case '5min': return '5 minutes before';
                      case '10min': return '10 minutes before';
                      case '30min': return '30 minutes before';
                      case '1hour': return '1 hour before';
                      case '1day': return '1 day before';
                      case '1week': return '1 week before';
                      case '1month': return '1 month before';
                      default: return 'Reminders';
                    }
                  }
                  return `${editedEvent.reminders.length} reminders`;
                })()}
              </span>
            </div>
            <svg className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <PortalDropdown
            isOpen={editingField === 'reminder'}
            triggerRef={reminderRef}
            onClose={() => {
              setEditingField(null);
              setHoveredReminder(null);
            }}
            offsetX={-253}
            offsetY={0}
          >
            <div
              className="reminder-picker"
              onMouseLeave={() => setHoveredReminder(null)}
            >
              <div className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden" style={{ width: '240px' }}>
                <div>
                  {[
                    { value: 'at-time', label: 'At start of event' },
                    { value: '5min', label: '5 min before' },
                    { value: '10min', label: '10 min before' },
                    { value: '30min', label: '30 min before' },
                    { value: '1hour', label: '1 hour before' },
                    { value: '1day', label: '1 day before' },
                    { value: '1week', label: '1 week before' },
                    { value: '1month', label: '1 month before' },
                  ].map((option, index, array) => {
                    const isSelected = editedEvent.reminders?.includes(option.value as ReminderOption) || false;
                    return (
                      <div
                        key={option.value}
                        onMouseEnter={() => setHoveredReminder(option.label)}
                        onMouseLeave={() => setHoveredReminder(null)}
                        onClick={() => {
                          const currentReminders = editedEvent.reminders || [];
                          let newReminders: ReminderOption[];

                          if (isSelected) {
                            // Remove from reminders
                            newReminders = currentReminders.filter(r => r !== option.value);
                          } else {
                            // Add to reminders
                            newReminders = [...currentReminders, option.value as ReminderOption];
                          }

                          updateEvent('reminders', newReminders.length > 0 ? newReminders : undefined);
                          // Don't close the dropdown - allow multiple selections
                          setHoveredReminder(null);
                        }}
                        className={`px-2 cursor-pointer ${
                          index === 0 ? 'pt-2' :
                          index === array.length - 1 ? 'pb-2' :
                          ''
                        }`}
                      >
                        <div className={`flex items-center px-2 py-2.5 rounded-md transition-colors ${
                          isSelected ? 'bg-blue-50' : 'hover:bg-gray-100'
                        }`}>
                          <span className="text-gray-700 text-sm flex-1">{option.label}</span>
                          {isSelected && (
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </PortalDropdown>
        </div>

        {/* Meeting */}
        <div className="relative">
          <button
            ref={meetingRef as React.RefObject<HTMLButtonElement>}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setEditingField(editingField === 'meeting' ? null : 'meeting');
              if (editingField === 'meeting') setHoveredMeeting(null);
            }}
            className={`group w-full flex items-center justify-between py-3 px-3 -mx-2 rounded-lg transition-colors ${
              editingField === 'meeting' ? 'bg-gray-50' : 'hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span className="text-gray-700">
                {hoveredMeeting ?
                  (hoveredMeeting === 'google-meet' ? 'Google Meet' :
                   hoveredMeeting === 'zoom' ? 'Zoom' :
                   hoveredMeeting === 'tencent-meeting' ? 'Tencent Meeting' :
                   'Meeting') :
                  (editedEvent.meeting === 'google-meet' ? 'Google Meet' :
                   editedEvent.meeting === 'zoom' ? 'Zoom' :
                   editedEvent.meeting === 'tencent-meeting' ? 'Tencent Meeting' :
                   'Meeting')
                }
              </span>
            </div>
            <svg className={`w-4 h-4 text-gray-400 transition-opacity flex-shrink-0 ${
              editingField === 'meeting' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <PortalDropdown
            isOpen={editingField === 'meeting'}
            triggerRef={meetingRef}
            onClose={() => {
              setEditingField(null);
              setHoveredMeeting(null);
            }}
            offsetX={-253}
            offsetY={0}
          >
            <div
              className="meeting-picker"
              onMouseLeave={() => setHoveredMeeting(null)}
            >
              <div className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden" style={{ width: '240px' }}>
                <div>
                  {hasMeetingBeenSelected && [
                    { value: null, label: 'No meeting', logo: null },
                  ].map((option) => (
                    <div
                      key={option.value || 'none'}
                      onMouseEnter={() => setHoveredMeeting(option.value)}
                      onClick={() => {
                        updateEvent('meeting', null);
                        setHasMeetingBeenSelected(true);
                        setEditingField(null);
                        setHoveredMeeting(null);
                        setMeetingStatus('idle');
                        setMeetingLink('');
                        setMeetingCode('');
                      }}
                      className="px-2 pt-2 pb-1 cursor-pointer"
                    >
                      <div className={`flex items-center px-2 py-2.5 rounded-md transition-colors ${
                        (editedEvent.meeting || null) === option.value
                          ? 'bg-blue-50'
                          : 'hover:bg-gray-100'
                      }`}>
                        <div className="flex items-center gap-2 flex-1">
                          <div className="relative">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            <svg className="w-4 h-4 text-gray-400 absolute inset-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6" />
                            </svg>
                          </div>
                          <span className="text-gray-700 text-sm">{option.label}</span>
                        </div>
                        {(editedEvent.meeting || null) === option.value && (
                          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Separator - only show if "No meeting" option is visible */}
                  {hasMeetingBeenSelected && (
                    <div className="py-1">
                      <div className="border-t border-gray-200 mx-3"></div>
                    </div>
                  )}

                  {/* Meeting options */}
                  {[
                    { value: 'google-meet', label: 'Google Meet', logo: '/logos/google-meet.png' },
                    { value: 'zoom', label: 'Zoom', logo: '/logos/zoom.png' },
                    { value: 'tencent-meeting', label: 'Tencent Meeting', logo: '/logos/tencent-meeting.svg' },
                  ].map((option, index, array) => (
                    <div
                      key={option.value}
                      onMouseEnter={() => setHoveredMeeting(option.value)}
                      onClick={async () => {
                        updateEvent('meeting', option.value);
                        setHasMeetingBeenSelected(true);
                        setEditingField(null);
                        setHoveredMeeting(null);

                        // Simulate creating meeting
                        if (option.value) {
                          setMeetingStatus('creating');

                          // Simulate API call delay
                          setTimeout(() => {
                            if (option.value === 'google-meet') {
                              setMeetingLink('https://meet.google.com/izf-wqpw-tqo');
                              setMeetingCode('izf-wqpw-tqo');
                            } else if (option.value === 'zoom') {
                              setMeetingLink('https://zoom.us/j/1234567890');
                              setMeetingCode('123-456-7890');
                            } else if (option.value === 'tencent-meeting') {
                              setMeetingLink('https://meeting.tencent.com/dm/ABC123');
                              setMeetingCode('ABC-123');
                            }
                            setMeetingStatus('created');
                          }, 1500);
                        }
                      }}
                      className={`px-2 cursor-pointer ${
                        index === 0 ? 'pt-2' :
                        index === array.length - 1 ? 'pb-2' :
                        ''
                      }`}
                    >
                      <div className={`flex items-center px-2 py-2.5 rounded-md transition-colors ${
                        (editedEvent.meeting || null) === option.value
                          ? 'bg-blue-50'
                          : 'hover:bg-gray-100'
                      }`}>
                        <div className="flex items-center gap-2 flex-1">
                          <img
                            src={option.logo}
                            alt={option.label}
                            className="w-4 h-4 object-contain"
                          />
                          <span className="text-gray-700 text-sm">{option.label}</span>
                        </div>
                        {(editedEvent.meeting || null) === option.value && (
                          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </PortalDropdown>

          {/* Meeting Info Section - appears below meeting button when selected */}
          {editedEvent.meeting && (
            <div className="ml-8 mt-2 mb-2">
              {meetingStatus === 'creating' && (
                <div className="text-gray-500 text-sm">
                  Creating {editedEvent.meeting === 'google-meet' ? 'Google Meet' :
                           editedEvent.meeting === 'zoom' ? 'Zoom' :
                           'Tencent Meeting'} meeting...
                </div>
              )}
              {meetingStatus === 'created' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-sm">
                      {editedEvent.meeting === 'google-meet' ? 'Google Meet' :
                       editedEvent.meeting === 'zoom' ? 'Zoom' :
                       'Tencent Meeting'} link
                    </span>
                    <a
                      href={meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 text-sm truncate max-w-[300px]"
                      title={meetingLink}
                    >
                      {meetingLink}
                    </a>
                  </div>
                  {meetingCode && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-sm">Code</span>
                      <span className="text-gray-700 text-sm font-mono">{meetingCode}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Description - extends to bottom */}
        <div className="flex-1 flex flex-col mt-2 min-h-0">
          <div className="relative w-full flex-1 flex flex-col min-h-0">
            {isEditingDescription ? (
              <div className="w-full flex-1 flex flex-col animate-descriptionFadeIn">
                <div className="w-full flex-1 border border-gray-300 rounded-lg overflow-hidden flex flex-col shadow-sm">
                  {/* Formatting Toolbar */}
                  <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-200 bg-gray-50">
                    {/* Heading buttons */}
                    <button
                      type="button"
                      onClick={() => {
                        const textarea = descriptionTextareaRef.current;
                        if (textarea) {
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const selectedText = tempDescription.substring(start, end);

                          // Check if we're at the start of a line
                          const textBeforeCursor = tempDescription.substring(0, start);
                          const isAtLineStart = start === 0 || textBeforeCursor.endsWith('\n');

                          // Add newline if not at start of line
                          const prefix = isAtLineStart ? '' : '\n';
                          const newText = `${prefix}# ${selectedText || 'Heading 1'}`;
                          const newDescription = tempDescription.substring(0, start) + newText + tempDescription.substring(end);
                          setTempDescription(newDescription);

                          setTimeout(() => {
                            textarea.focus();
                            const offset = prefix.length + 2;
                            textarea.setSelectionRange(start + offset, start + offset + (selectedText.length || 9));
                          }, 0);
                        }
                      }}
                      className="px-2 py-1 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                    >
                      H1
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const textarea = descriptionTextareaRef.current;
                        if (textarea) {
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const selectedText = tempDescription.substring(start, end);

                          // Check if we're at the start of a line
                          const textBeforeCursor = tempDescription.substring(0, start);
                          const isAtLineStart = start === 0 || textBeforeCursor.endsWith('\n');

                          // Add newline if not at start of line
                          const prefix = isAtLineStart ? '' : '\n';
                          const newText = `${prefix}## ${selectedText || 'Heading 2'}`;
                          const newDescription = tempDescription.substring(0, start) + newText + tempDescription.substring(end);
                          setTempDescription(newDescription);

                          setTimeout(() => {
                            textarea.focus();
                            const offset = prefix.length + 3;
                            textarea.setSelectionRange(start + offset, start + offset + (selectedText.length || 9));
                          }, 0);
                        }
                      }}
                      className="px-2 py-1 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                    >
                      H2
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const textarea = descriptionTextareaRef.current;
                        if (textarea) {
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const selectedText = tempDescription.substring(start, end);

                          // Check if we're at the start of a line
                          const textBeforeCursor = tempDescription.substring(0, start);
                          const isAtLineStart = start === 0 || textBeforeCursor.endsWith('\n');

                          // Add newline if not at start of line
                          const prefix = isAtLineStart ? '' : '\n';
                          const newText = `${prefix}### ${selectedText || 'Heading 3'}`;
                          const newDescription = tempDescription.substring(0, start) + newText + tempDescription.substring(end);
                          setTempDescription(newDescription);

                          setTimeout(() => {
                            textarea.focus();
                            const offset = prefix.length + 4;
                            textarea.setSelectionRange(start + offset, start + offset + (selectedText.length || 9));
                          }, 0);
                        }
                      }}
                      className="px-2 py-1 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                    >
                      H3
                    </button>

                    <div className="w-px h-4 bg-gray-300 mx-1" />

                    {/* Text formatting buttons */}
                    <button
                      type="button"
                      onClick={() => {
                        const textarea = descriptionTextareaRef.current;
                        if (textarea) {
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const selectedText = tempDescription.substring(start, end);
                          const newText = `**${selectedText || 'bold'}**`;
                          const newDescription = tempDescription.substring(0, start) + newText + tempDescription.substring(end);
                          setTempDescription(newDescription);
                          setTimeout(() => {
                            textarea.focus();
                            textarea.setSelectionRange(start + 2, start + 2 + (selectedText.length || 4));
                          }, 0);
                        }
                      }}
                      className="px-2 py-1 text-xs font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                    >
                      B
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const textarea = descriptionTextareaRef.current;
                        if (textarea) {
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const selectedText = tempDescription.substring(start, end);
                          const newText = `*${selectedText || 'italic'}*`;
                          const newDescription = tempDescription.substring(0, start) + newText + tempDescription.substring(end);
                          setTempDescription(newDescription);
                          setTimeout(() => {
                            textarea.focus();
                            textarea.setSelectionRange(start + 1, start + 1 + (selectedText.length || 6));
                          }, 0);
                        }
                      }}
                      className="px-2 py-1 text-xs italic text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                    >
                      I
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const textarea = descriptionTextareaRef.current;
                        if (textarea) {
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const selectedText = tempDescription.substring(start, end);
                          const newText = `<u>${selectedText || 'underline'}</u>`;
                          const newDescription = tempDescription.substring(0, start) + newText + tempDescription.substring(end);
                          setTempDescription(newDescription);
                          setTimeout(() => {
                            textarea.focus();
                            textarea.setSelectionRange(start + 3, start + 3 + (selectedText.length || 9));
                          }, 0);
                        }
                      }}
                      className="px-2 py-1 text-xs underline text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                    >
                      U
                    </button>

                    <div className="w-px h-4 bg-gray-300 mx-1" />

                    {/* List buttons */}
                    <button
                      type="button"
                      onClick={() => {
                        const textarea = descriptionTextareaRef.current;
                        if (textarea) {
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const selectedText = tempDescription.substring(start, end);

                          // Check if we're at the start of a line
                          const textBeforeCursor = tempDescription.substring(0, start);
                          const isAtLineStart = start === 0 || textBeforeCursor.endsWith('\n');

                          // Add newline if not at start of line
                          const prefix = isAtLineStart ? '' : '\n';
                          const newText = `${prefix}- ${selectedText || 'List item'}`;
                          const newDescription = tempDescription.substring(0, start) + newText + tempDescription.substring(end);
                          setTempDescription(newDescription);

                          setTimeout(() => {
                            textarea.focus();
                            const offset = prefix.length + 2;
                            textarea.setSelectionRange(start + offset, start + offset + (selectedText.length || 9));
                          }, 0);
                        }
                      }}
                      className="px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                      title="Bullet list"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h13M8 12h13m-13 6h13M3 6h.01M3 12h.01M3 18h.01" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const textarea = descriptionTextareaRef.current;
                        if (textarea) {
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const selectedText = tempDescription.substring(start, end);

                          // Check if we're at the start of a line
                          const textBeforeCursor = tempDescription.substring(0, start);
                          const isAtLineStart = start === 0 || textBeforeCursor.endsWith('\n');

                          // Get current line to check indentation
                          const lines = textBeforeCursor.split('\n');
                          const currentLine = lines[lines.length - 1];
                          const leadingSpaces = currentLine.match(/^(\s*)/)?.[1] || '';
                          const indentLevel = Math.floor(leadingSpaces.length / 4);

                          // Always use '1. ' for markdown compatibility
                          let marker = '1. ';

                          // Add newline if not at start of line
                          const prefix = isAtLineStart ? '' : '\n';
                          const newText = `${prefix}${leadingSpaces}${marker}${selectedText || 'List item'}`;
                          const newDescription = tempDescription.substring(0, start) + newText + tempDescription.substring(end);
                          setTempDescription(newDescription);

                          setTimeout(() => {
                            textarea.focus();
                            const offset = prefix.length + leadingSpaces.length + marker.length;
                            textarea.setSelectionRange(start + offset, start + offset + (selectedText.length || 9));
                          }, 0);
                        }
                      }}
                      className="px-2 py-1 text-xs font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                      title="Numbered list"
                    >
                      #
                    </button>
                  </div>

                  {/* Textarea */}
                  <textarea
                    ref={descriptionTextareaRef}
                    value={tempDescription}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setTempDescription(newValue);

                      // Add to history on significant changes (debounced effect)
                      // Clear any existing timer
                      if (historyTimerRef.current) {
                        clearTimeout(historyTimerRef.current);
                      }

                      // Set new timer to add to history after user stops typing
                      historyTimerRef.current = setTimeout(() => {
                        const newHistory = [...descriptionHistory.slice(0, descriptionHistoryIndex + 1), newValue];
                        // Keep only last 50 states
                        const trimmedHistory = newHistory.length > 50
                          ? newHistory.slice(newHistory.length - 50)
                          : newHistory;
                        setDescriptionHistory(trimmedHistory);
                        setDescriptionHistoryIndex(trimmedHistory.length - 1);
                        historyTimerRef.current = null;
                      }, 500);
                    }}
                    onKeyDown={(e) => {
                      // Handle Cmd/Ctrl+Z for undo and Cmd/Ctrl+Shift+Z for redo
                      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
                        e.preventDefault();
                        if (descriptionHistoryIndex > 0) {
                          const newIndex = descriptionHistoryIndex - 1;
                          setDescriptionHistoryIndex(newIndex);
                          setTempDescription(descriptionHistory[newIndex]);
                        }
                        return;
                      }

                      if ((e.metaKey || e.ctrlKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
                        e.preventDefault();
                        if (descriptionHistoryIndex < descriptionHistory.length - 1) {
                          const newIndex = descriptionHistoryIndex + 1;
                          setDescriptionHistoryIndex(newIndex);
                          setTempDescription(descriptionHistory[newIndex]);
                        }
                        return;
                      }
                      // Check for Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux) to save
                      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                        e.preventDefault();
                        updateEvent('description', tempDescription);
                        setIsEditingDescription(false);
                        setTempDescription('');
                        return;
                      }

                      // Check for Tab key to handle list indentation
                      if (e.key === 'Tab') {
                        const textarea = e.currentTarget;
                        const cursorPos = textarea.selectionStart;
                        const textBeforeCursor = tempDescription.substring(0, cursorPos);
                        const textAfterCursor = tempDescription.substring(cursorPos);

                        // Find the current line
                        const lines = textBeforeCursor.split('\n');
                        const currentLine = lines[lines.length - 1];
                        const lineStart = cursorPos - currentLine.length;

                        // Check if current line is a list item
                        const bulletMatch = currentLine.match(/^(\s*)(-\s+.*)$/);
                        const numberMatch = currentLine.match(/^(\s*)(\d+)\.\s+(.*)$/);

                        if (bulletMatch) {
                          e.preventDefault();
                          const currentIndent = bulletMatch[1];
                          const listContent = bulletMatch[2];

                          if (e.shiftKey) {
                            // Shift+Tab: Remove indentation (up to 4 spaces)
                            const spacesToRemove = Math.min(4, currentIndent.length);
                            const newIndent = currentIndent.substring(spacesToRemove);
                            const newLine = newIndent + listContent;
                            const newText = tempDescription.substring(0, lineStart) + newLine + textAfterCursor;
                            setTempDescription(newText);
                            setTimeout(() => {
                              const newPos = lineStart + newLine.length - listContent.length + 2;
                              textarea.setSelectionRange(newPos, newPos);
                            }, 0);
                          } else {
                            // Tab: Add indentation (4 spaces)
                            const newIndent = currentIndent + '    ';
                            const newLine = newIndent + listContent;
                            const newText = tempDescription.substring(0, lineStart) + newLine + textAfterCursor;
                            setTempDescription(newText);
                            setTimeout(() => {
                              const newPos = cursorPos + 4;
                              textarea.setSelectionRange(newPos, newPos);
                            }, 0);
                          }
                          return;
                        } else if (numberMatch) {
                          e.preventDefault();
                          const match = numberMatch;
                          const currentIndent = match[1];
                          const marker = match[2];
                          const content = match[3];

                          if (e.shiftKey) {
                            // Shift+Tab: Remove indentation and change format
                            const spacesToRemove = Math.min(4, currentIndent.length);
                            const newIndent = currentIndent.substring(spacesToRemove);
                            const newIndentLevel = Math.floor(newIndent.length / 4);

                            // Always use '1' for markdown compatibility
                            let newMarker = '1';

                            const newLine = newIndent + newMarker + '. ' + content;
                            const newText = tempDescription.substring(0, lineStart) + newLine + textAfterCursor;
                            setTempDescription(newText);
                            setTimeout(() => {
                              const newPos = lineStart + newIndent.length + newMarker.length + 2;
                              textarea.setSelectionRange(newPos, newPos);
                            }, 0);
                          } else {
                            // Tab: Add indentation and change format
                            const newIndent = currentIndent + '    ';
                            const newIndentLevel = Math.floor(newIndent.length / 4);

                            // For proper markdown, always use numbers
                            // The CSS will style nested lists as letters
                            let newMarker = '1';

                            const newLine = newIndent + newMarker + '. ' + content;
                            const newText = tempDescription.substring(0, lineStart) + newLine + textAfterCursor;
                            setTempDescription(newText);
                            setTimeout(() => {
                              const newPos = lineStart + newIndent.length + newMarker.length + 2;
                              textarea.setSelectionRange(newPos, newPos);
                            }, 0);
                          }
                          return;
                        }
                      }

                      // Check for Backspace key to handle list deletion
                      if (e.key === 'Backspace') {
                        const textarea = e.currentTarget;
                        const cursorPos = textarea.selectionStart;
                        const textBeforeCursor = tempDescription.substring(0, cursorPos);

                        // Find the current line
                        const lines = textBeforeCursor.split('\n');
                        const currentLine = lines[lines.length - 1];

                        // Check if cursor is right after a bullet point or number
                        if (currentLine.match(/^(\s*)-\s*$/) ||
                            currentLine.match(/^(\s*)(\d+)\.\s*$/)) {
                          e.preventDefault();
                          const lineStart = cursorPos - currentLine.length;
                          const textAfterCursor = tempDescription.substring(cursorPos);
                          const newText = tempDescription.substring(0, lineStart) + textAfterCursor;
                          setTempDescription(newText);
                          setTimeout(() => {
                            textarea.setSelectionRange(lineStart, lineStart);
                          }, 0);
                          return;
                        }
                      }

                      // Check for Enter key to handle list continuation
                      if (e.key === 'Enter') {
                        const textarea = e.currentTarget;
                        const cursorPos = textarea.selectionStart;
                        const textBeforeCursor = tempDescription.substring(0, cursorPos);
                        const textAfterCursor = tempDescription.substring(cursorPos);

                        // Find the current line
                        const lines = textBeforeCursor.split('\n');
                        const currentLine = lines[lines.length - 1];

                        // Check if current line starts with a bullet point
                        const bulletMatch = currentLine.match(/^(\s*)-\s+(.*)$/);
                        // Check if current line starts with a number
                        const numberMatch = currentLine.match(/^(\s*)(\d+)\.\s+(.*)$/);

                        if (bulletMatch) {
                          e.preventDefault();
                          const indent = bulletMatch[1];
                          const content = bulletMatch[2];

                          // If the line only has "- " (empty item), remove it instead of continuing
                          if (!content || content.trim() === '') {
                            const newText = tempDescription.substring(0, cursorPos - currentLine.length) + textAfterCursor;
                            setTempDescription(newText);
                            setTimeout(() => {
                              textarea.setSelectionRange(cursorPos - currentLine.length, cursorPos - currentLine.length);
                            }, 0);
                          } else {
                            // Add new bullet point on next line with same indentation
                            const newText = textBeforeCursor + '\n' + indent + '- ' + textAfterCursor;
                            setTempDescription(newText);
                            setTimeout(() => {
                              const newPos = textBeforeCursor.length + 1 + indent.length + 2;
                              textarea.setSelectionRange(newPos, newPos);
                            }, 0);
                          }
                        } else if (numberMatch) {
                          e.preventDefault();
                          const indent = numberMatch[1];
                          const marker = numberMatch[2];
                          const content = numberMatch[3];

                          // If the line only has marker (empty item), remove it instead of continuing
                          if (!content || content.trim() === '') {
                            const newText = tempDescription.substring(0, cursorPos - currentLine.length) + textAfterCursor;
                            setTempDescription(newText);
                            setTimeout(() => {
                              textarea.setSelectionRange(cursorPos - currentLine.length, cursorPos - currentLine.length);
                            }, 0);
                          } else {
                            // Continue with next number
                            const currentNumber = parseInt(marker);
                            const nextMarker = (currentNumber + 1) + '. ';

                            // Add new item on next line with appropriate marker
                            const newText = textBeforeCursor + '\n' + indent + nextMarker + textAfterCursor;
                            setTempDescription(newText);
                            setTimeout(() => {
                              const newPos = textBeforeCursor.length + 1 + indent.length + nextMarker.length;
                              textarea.setSelectionRange(newPos, newPos);
                            }, 0);
                          }
                        }
                      }
                    }}
                    className="w-full flex-1 text-gray-700 bg-transparent px-4 py-3 outline-none focus:ring-0 resize-none text-sm min-h-0 overflow-y-auto"
                    placeholder="Write in markdown..."
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFullScreen(true);
                    }}
                    className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                    Expand
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditingDescription(false);
                        setTempDescription('');
                      }}
                      className="px-3 py-1 text-xs text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateEvent('description', tempDescription);
                        setIsEditingDescription(false);
                        setTempDescription('');
                      }}
                      className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                      title="Cmd+Enter to save"
                    >
                      Confirm
                      <span className="text-[10px] opacity-75">(⌘↵)</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                onMouseDown={(e) => {
                  // Prevent any default mouse behavior
                  e.stopPropagation();
                  e.nativeEvent.stopImmediatePropagation();
                }}
                onPointerDown={(e) => {
                  // Also stop pointer events
                  e.stopPropagation();
                  e.nativeEvent.stopImmediatePropagation();
                }}
                onClick={(e) => {
                  // Stop all propagation
                  e.stopPropagation();
                  e.nativeEvent.stopImmediatePropagation();
                  e.preventDefault();

                  // Enter edit mode
                  setIsEditingDescription(true);
                  const initialDescription = editedEvent.description || '';
                  setTempDescription(initialDescription);
                  // Initialize history when starting to edit
                  setDescriptionHistory([initialDescription]);
                  setDescriptionHistoryIndex(0);
                  // Focus the textarea after a short delay to ensure it's rendered
                  setTimeout(() => {
                    if (descriptionTextareaRef.current) {
                      descriptionTextareaRef.current.focus();
                    }
                  }, 50);
                }}
                className="w-full flex-1 text-gray-700 border border-gray-200 hover:border-gray-300 rounded-lg px-4 py-3 cursor-text transition-all duration-200 overflow-y-auto markdown-content hover:bg-gray-50 hover:shadow-sm max-h-full"
                tabIndex={-1}
                role="button"
                aria-label="Click to edit description"
              >
                {editedEvent.description ? (
                  <div
                    className="prose prose-sm max-w-none event-description-content"
                    style={{ pointerEvents: 'auto' }}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({ children, href, ...props }) => (
                          <span
                            style={{ textDecoration: 'underline', cursor: 'inherit', color: 'inherit' }}
                            onClick={(e) => e.preventDefault()}
                          >
                            {children}
                          </span>
                        )
                      }}
                    >
                      {editedEvent.description}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <span className="text-gray-500">
                    Add description
                    <span className="block text-xs mt-1">(supports markdown)</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Full Screen Editor Modal (via portal) */}
        {mounted && isFullScreen
          ? createPortal(
              <div
                id="event-editor-portal"
                className="fixed inset-0 z-[9999]"
                onMouseMove={handleMouseMove}
              >
                {/* Backdrop */}
                <div
                  className="absolute inset-0 bg-white/95 backdrop-blur-sm"
                  onClick={() => setIsFullScreen(false)}
                />

                {/* Clean minimal editor - use full screen width */}
                <div className="relative h-full w-full">
                  <div className="w-full h-full flex flex-col">

                      {/* Simple mode toggle - floating in top right corner */}
                      <div className={`fixed top-4 right-4 flex items-center gap-2 z-50 transition-all duration-1000 ease-in-out ${showFullscreenControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
                        <button
                          onClick={() => setFullScreenMode(fullScreenMode === 'editor' ? 'preview' : 'editor')}
                          className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-2"
                        >
                          {fullScreenMode === 'editor' ? (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              Preview
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => setIsFullScreen(false)}
                          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      {/* Formatting toolbar for editor mode */}
                      {fullScreenMode === 'editor' && (
                        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 px-4 py-2 flex items-center gap-1 z-40 transition-all duration-1000 ease-in-out ${showFullscreenControls ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
                          {/* Heading buttons */}
                          <button
                            type="button"
                            onClick={() => {
                              const textarea = document.querySelector('.fullscreen-textarea') as HTMLTextAreaElement;
                              if (textarea) {
                                const start = textarea.selectionStart;
                                const end = textarea.selectionEnd;
                                const selectedText = tempDescription.substring(start, end);
                                const textBeforeCursor = tempDescription.substring(0, start);
                                const isAtLineStart = start === 0 || textBeforeCursor.endsWith('\n');
                                const prefix = isAtLineStart ? '' : '\n';
                                const newText = `${prefix}# ${selectedText || 'Heading 1'}`;
                                const newDescription = tempDescription.substring(0, start) + newText + tempDescription.substring(end);
                                setTempDescription(newDescription);
                                setTimeout(() => {
                                  textarea.focus();
                                  const offset = prefix.length + 2;
                                  textarea.setSelectionRange(start + offset, start + offset + (selectedText.length || 9));
                                }, 0);
                              }
                            }}
                            className="px-3 py-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
                          >
                            H1
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const textarea = document.querySelector('.fullscreen-textarea') as HTMLTextAreaElement;
                              if (textarea) {
                                const start = textarea.selectionStart;
                                const end = textarea.selectionEnd;
                                const selectedText = tempDescription.substring(start, end);
                                const textBeforeCursor = tempDescription.substring(0, start);
                                const isAtLineStart = start === 0 || textBeforeCursor.endsWith('\n');
                                const prefix = isAtLineStart ? '' : '\n';
                                const newText = `${prefix}## ${selectedText || 'Heading 2'}`;
                                const newDescription = tempDescription.substring(0, start) + newText + tempDescription.substring(end);
                                setTempDescription(newDescription);
                                setTimeout(() => {
                                  textarea.focus();
                                  const offset = prefix.length + 3;
                                  textarea.setSelectionRange(start + offset, start + offset + (selectedText.length || 9));
                                }, 0);
                              }
                            }}
                            className="px-3 py-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
                          >
                            H2
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const textarea = document.querySelector('.fullscreen-textarea') as HTMLTextAreaElement;
                              if (textarea) {
                                const start = textarea.selectionStart;
                                const end = textarea.selectionEnd;
                                const selectedText = tempDescription.substring(start, end);
                                const textBeforeCursor = tempDescription.substring(0, start);
                                const isAtLineStart = start === 0 || textBeforeCursor.endsWith('\n');
                                const prefix = isAtLineStart ? '' : '\n';
                                const newText = `${prefix}### ${selectedText || 'Heading 3'}`;
                                const newDescription = tempDescription.substring(0, start) + newText + tempDescription.substring(end);
                                setTempDescription(newDescription);
                                setTimeout(() => {
                                  textarea.focus();
                                  const offset = prefix.length + 4;
                                  textarea.setSelectionRange(start + offset, start + offset + (selectedText.length || 9));
                                }, 0);
                              }
                            }}
                            className="px-3 py-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
                          >
                            H3
                          </button>

                          <div className="w-px h-6 bg-gray-200 mx-1" />

                          {/* Text formatting buttons */}
                          <button
                            type="button"
                            onClick={() => {
                              const textarea = document.querySelector('.fullscreen-textarea') as HTMLTextAreaElement;
                              if (textarea) {
                                const start = textarea.selectionStart;
                                const end = textarea.selectionEnd;
                                const selectedText = tempDescription.substring(start, end);
                                const newText = `**${selectedText || 'bold'}**`;
                                const newDescription = tempDescription.substring(0, start) + newText + tempDescription.substring(end);
                                setTempDescription(newDescription);
                                setTimeout(() => {
                                  textarea.focus();
                                  textarea.setSelectionRange(start + 2, start + 2 + (selectedText.length || 4));
                                }, 0);
                              }
                            }}
                            className="px-3 py-1.5 text-sm font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
                          >
                            B
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const textarea = document.querySelector('.fullscreen-textarea') as HTMLTextAreaElement;
                              if (textarea) {
                                const start = textarea.selectionStart;
                                const end = textarea.selectionEnd;
                                const selectedText = tempDescription.substring(start, end);
                                const newText = `*${selectedText || 'italic'}*`;
                                const newDescription = tempDescription.substring(0, start) + newText + tempDescription.substring(end);
                                setTempDescription(newDescription);
                                setTimeout(() => {
                                  textarea.focus();
                                  textarea.setSelectionRange(start + 1, start + 1 + (selectedText.length || 6));
                                }, 0);
                              }
                            }}
                            className="px-3 py-1.5 text-sm italic text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
                          >
                            I
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const textarea = document.querySelector('.fullscreen-textarea') as HTMLTextAreaElement;
                              if (textarea) {
                                const start = textarea.selectionStart;
                                const end = textarea.selectionEnd;
                                const selectedText = tempDescription.substring(start, end);
                                const newText = `<u>${selectedText || 'underline'}</u>`;
                                const newDescription = tempDescription.substring(0, start) + newText + tempDescription.substring(end);
                                setTempDescription(newDescription);
                                setTimeout(() => {
                                  textarea.focus();
                                  textarea.setSelectionRange(start + 3, start + 3 + (selectedText.length || 9));
                                }, 0);
                              }
                            }}
                            className="px-3 py-1.5 text-sm underline text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
                          >
                            U
                          </button>

                          <div className="w-px h-6 bg-gray-200 mx-1" />

                          {/* List buttons */}
                          <button
                            type="button"
                            onClick={() => {
                              const textarea = document.querySelector('.fullscreen-textarea') as HTMLTextAreaElement;
                              if (textarea) {
                                const start = textarea.selectionStart;
                                const end = textarea.selectionEnd;
                                const selectedText = tempDescription.substring(start, end);
                                const textBeforeCursor = tempDescription.substring(0, start);
                                const isAtLineStart = start === 0 || textBeforeCursor.endsWith('\n');
                                const prefix = isAtLineStart ? '' : '\n';
                                const newText = `${prefix}- ${selectedText || 'List item'}`;
                                const newDescription = tempDescription.substring(0, start) + newText + tempDescription.substring(end);
                                setTempDescription(newDescription);
                                setTimeout(() => {
                                  textarea.focus();
                                  const offset = prefix.length + 2;
                                  textarea.setSelectionRange(start + offset, start + offset + (selectedText.length || 9));
                                }, 0);
                              }
                            }}
                            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
                            title="Bullet list"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h13M8 12h13m-13 6h13M3 6h.01M3 12h.01M3 18h.01" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const textarea = document.querySelector('.fullscreen-textarea') as HTMLTextAreaElement;
                              if (textarea) {
                                const start = textarea.selectionStart;
                                const end = textarea.selectionEnd;
                                const selectedText = tempDescription.substring(start, end);
                                const textBeforeCursor = tempDescription.substring(0, start);
                                const isAtLineStart = start === 0 || textBeforeCursor.endsWith('\n');
                                const lines = textBeforeCursor.split('\n');
                                const currentLine = lines[lines.length - 1];
                                const leadingSpaces = currentLine.match(/^(\s*)/)?.[1] || '';
                                const prefix = isAtLineStart ? '' : '\n';
                                const newText = `${prefix}${leadingSpaces}1. ${selectedText || 'List item'}`;
                                const newDescription = tempDescription.substring(0, start) + newText + tempDescription.substring(end);
                                setTempDescription(newDescription);
                                setTimeout(() => {
                                  textarea.focus();
                                  const offset = prefix.length + leadingSpaces.length + 3;
                                  textarea.setSelectionRange(start + offset, start + offset + (selectedText.length || 9));
                                }, 0);
                              }
                            }}
                            className="px-3 py-1.5 text-sm font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
                            title="Numbered list"
                          >
                            #
                          </button>
                        </div>
                      )}

                      {/* Main content area - clean and focused */}
                      <div className="flex-1 overflow-hidden relative h-full">
                        {fullScreenMode === 'editor' ? (
                          <>
                            {/* Subtle fade at top for editor mode */}
                            <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-white/80 to-transparent pointer-events-none z-10" />

                            <textarea
                            value={tempDescription}
                            onChange={(e) => {
                              const newValue = e.target.value;
                              setTempDescription(newValue);

                              // Add to history on significant changes (debounced effect)
                              // Clear any existing timer
                              if (historyTimerRef.current) {
                                clearTimeout(historyTimerRef.current);
                              }

                              // Set new timer to add to history after user stops typing
                              historyTimerRef.current = setTimeout(() => {
                                const newHistory = [...descriptionHistory.slice(0, descriptionHistoryIndex + 1), newValue];
                                // Keep only last 50 states
                                const trimmedHistory = newHistory.length > 50
                                  ? newHistory.slice(newHistory.length - 50)
                                  : newHistory;
                                setDescriptionHistory(trimmedHistory);
                                setDescriptionHistoryIndex(trimmedHistory.length - 1);
                                historyTimerRef.current = null;
                              }, 500);
                            }}
                            onKeyDown={(e) => {
                              // Handle Cmd/Ctrl+Z for undo and Cmd/Ctrl+Shift+Z for redo
                              if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
                                e.preventDefault();
                                if (descriptionHistoryIndex > 0) {
                                  const newIndex = descriptionHistoryIndex - 1;
                                  setDescriptionHistoryIndex(newIndex);
                                  setTempDescription(descriptionHistory[newIndex]);
                                }
                                return;
                              }

                              if ((e.metaKey || e.ctrlKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
                                e.preventDefault();
                                if (descriptionHistoryIndex < descriptionHistory.length - 1) {
                                  const newIndex = descriptionHistoryIndex + 1;
                                  setDescriptionHistoryIndex(newIndex);
                                  setTempDescription(descriptionHistory[newIndex]);
                                }
                                return;
                              }

                              // Check for Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux)
                              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                                e.preventDefault();
                                updateEvent('description', tempDescription);
                                setIsEditingDescription(false);
                                setTempDescription('');
                                setIsFullScreen(false);
                                setFullScreenMode('editor');
                              }
                            }}
                            className="fullscreen-textarea w-full h-full px-[max(2rem,calc((100vw-80rem)/2))] pt-12 pb-12 text-gray-800 bg-transparent outline-none resize-none font-mono text-lg leading-relaxed max-w-full"
                            placeholder="Start writing..."
                            autoFocus
                          />
                          </>
                        ) : (
                          <div className="relative w-full h-full flex">
                            {/* Left Slider */}
                            <div
                              className="absolute h-full z-20 group"
                              style={{ left: `${(100 - previewContentWidth) / 2}%` }}
                            >
                              <div className="w-px bg-gray-200 h-full relative">
                                <div className={`absolute inset-y-0 left-1/2 -translate-x-1/2 transition-all ${
                                  isDraggingLeftSlider
                                    ? 'w-1 bg-blue-500'
                                    : 'w-px bg-gray-200 group-hover:bg-blue-400 group-hover:w-1'
                                }`} />
                              </div>
                              <div
                                className="absolute inset-y-0 -left-2 w-4 cursor-ew-resize"
                                onMouseDown={(e) => {
                                  e.preventDefault();

                                  // Check for double-click
                                  const now = Date.now();
                                  if (now - lastLeftSliderClick.current < 300) {
                                    // Double-click detected - reset to default
                                    setPreviewContentWidth(DEFAULT_PREVIEW_WIDTH);
                                    lastLeftSliderClick.current = 0;
                                    return;
                                  }
                                  lastLeftSliderClick.current = now;

                                  setIsDraggingLeftSlider(true);
                                }}
                              />
                            </div>

                            {/* Right Slider */}
                            <div
                              className="absolute h-full z-20 group"
                              style={{ right: `${(100 - previewContentWidth) / 2}%` }}
                            >
                              <div className="w-px bg-gray-200 h-full relative">
                                <div className={`absolute inset-y-0 left-1/2 -translate-x-1/2 transition-all ${
                                  isDraggingRightSlider
                                    ? 'w-1 bg-blue-500'
                                    : 'w-px bg-gray-200 group-hover:bg-blue-400 group-hover:w-1'
                                }`} />
                              </div>
                              <div
                                className="absolute inset-y-0 -right-2 w-4 cursor-ew-resize"
                                onMouseDown={(e) => {
                                  e.preventDefault();

                                  // Check for double-click
                                  const now = Date.now();
                                  if (now - lastRightSliderClick.current < 300) {
                                    // Double-click detected - reset to default
                                    setPreviewContentWidth(DEFAULT_PREVIEW_WIDTH);
                                    lastRightSliderClick.current = 0;
                                    return;
                                  }
                                  lastRightSliderClick.current = now;

                                  setIsDraggingRightSlider(true);
                                }}
                              />
                            </div>

                            {/* Content area with controlled width */}
                            <div className="relative w-full h-full">
                              {/* Subtle fade at top */}
                              <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-white/60 to-transparent pointer-events-none z-10" />

                              {/* Content with hidden scrollbar but still scrollable */}
                              <div className="w-full h-full overflow-y-auto scrollbar-hide">
                                <div
                                  className="mx-auto px-8 pt-12 pb-12"
                                  style={{ width: `${previewContentWidth}%` }}
                                >
                                <div className="markdown-content prose prose-xl max-w-none text-gray-800 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol_ol]:list-[lower-alpha] [&_ol_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul_ul]:list-circle [&_ul_ul]:pl-5">
                                {tempDescription ? (
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {tempDescription}
                                  </ReactMarkdown>
                                ) : (
                                  <span className="text-gray-400 italic text-lg">Nothing to preview yet...</span>
                                )}
                                </div>
                                </div>
                              </div>

                              {/* Subtle bottom fade */}
                              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white/60 to-transparent pointer-events-none z-10" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Minimal footer - just save/cancel */}
                      <div className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 flex items-center justify-center gap-3 z-30 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg px-4 py-2 border border-gray-100 transition-all duration-1000 ease-in-out ${showFullscreenControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                        <button
                          onClick={() => {
                            setIsFullScreen(false);
                            setFullScreenMode('editor');
                          }}
                          className="px-5 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            updateEvent('description', tempDescription);
                            setIsFullScreen(false);
                            setIsEditingDescription(false);
                            setTempDescription('');
                            setFullScreenMode('editor');
                          }}
                          className="px-6 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-all"
                        >
                          Save
                        </button>
                      </div>
                  </div>
                </div>
              </div>,
              document.body
            )
          : null}

        {/* Delete Recurring Modal */}
        {(() => {
          if (!showDeleteModal || !editedEvent) {
            console.log('EventEditor: Modal not rendering - showDeleteModal:', showDeleteModal, 'editedEvent:', !!editedEvent);
            return false;
          }

          // Use the same logic as in handleDelete
          const hasRecurrence = editedEvent.recurrence && editedEvent.recurrence !== '' && editedEvent.recurrence !== 'none';
          const hasRecurrenceGroupId = editedEvent.recurrenceGroupId && editedEvent.recurrenceGroupId !== '';
          const shouldShowModal = hasRecurrence || hasRecurrenceGroupId;

          console.log('EventEditor: Modal render check:', {
            showDeleteModal,
            editedEventId: editedEvent.id,
            recurrence: editedEvent.recurrence,
            recurrenceGroupId: editedEvent.recurrenceGroupId,
            hasRecurrence,
            hasRecurrenceGroupId,
            shouldShowModal
          });

          if (shouldShowModal) {
            console.log('EventEditor: SHOULD RENDER MODAL - all conditions met');
          } else {
            console.log('EventEditor: NOT RENDERING MODAL - not a recurring event');
          }

          return shouldShowModal;
        })() && (
          <DeleteRecurringModal
            event={editedEvent}
            onClose={() => setShowDeleteModal(false)}
            onConfirm={(option) => {
              console.log('EventEditor: DeleteRecurringModal onConfirm called with:', option);
              console.log('EventEditor: editedEvent:', editedEvent);
              console.log('EventEditor: onDelete function exists:', !!onDelete);

              if (onDelete && editedEvent) {
                console.log('EventEditor: Calling parent onDelete with:', editedEvent.id, option);
                onDelete(editedEvent.id, option);
                console.log('EventEditor: Parent onDelete called, closing modal');
                setShowDeleteModal(false);
                onCancel(); // Close the editor after deletion
              } else {
                console.error('EventEditor: Cannot delete - onDelete or editedEvent is missing');
              }
            }}
          />
        )}

        {/* Edit Recurring Properties Modal */}
        {showEditModal && pendingChanges && editedEvent && (
          <EditRecurringPropertiesModal
            event={editedEvent}
            changes={pendingChanges}
            onClose={() => {
              setShowEditModal(false);
              setPendingChanges(null);
            }}
            onConfirm={(option) => {
              console.log('EventEditor: EditRecurringPropertiesModal onConfirm with:', option);
              setShowEditModal(false);

              if (pendingChanges) {
                // Apply the pending changes
                const updatedEvent = { ...editedEvent, ...pendingChanges };
                // Clear justCreated flag when saving
                delete updatedEvent.justCreated;
                console.log('EventEditor: Saving with updateOption:', option, 'and event:', updatedEvent);
                onSave(updatedEvent, option);
                setPendingChanges(null);
              }
            }}
          />
        )}
      </div>
    </div>
  );
});

EventEditor.displayName = 'EventEditor';