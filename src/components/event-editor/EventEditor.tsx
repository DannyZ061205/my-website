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
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

// Global store for description histories that persist across editor sessions
const descriptionHistoriesStore = new Map<string, { history: string[], index: number }>();

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
  const cancelClickTimeRef = useRef<number>(0);
  const [descriptionHistory, setDescriptionHistory] = useState<string[]>([]);
  const [descriptionHistoryIndex, setDescriptionHistoryIndex] = useState(-1);
  const [mounted, setMounted] = useState(false);
  const savedDescriptionRef = useRef<string>('');  // To protect against text loss
  const fullscreenTextareaRef = useRef<HTMLTextAreaElement>(null);  // Direct ref to fullscreen textarea
  const isDraggingRef = useRef(false);  // Track if we're in a drag operation

  // Format button states
  const [isFormatting, setIsFormatting] = useState(false);
  const [formatStatus, setFormatStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingStartTime, setRecordingStartTime] = useState<number>(0);
  const [recordings, setRecordings] = useState<Array<{
    id: string;
    blob: Blob;
    duration: number;
    url: string;
    transcript?: string;
    isTranscribing?: boolean;
    isPlaying?: boolean;
  }>>([]);
  const [currentRecordingId, setCurrentRecordingId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [playingAudio, setPlayingAudio] = useState<{ [id: string]: HTMLAudioElement }>({});
  const [showDeleteEventModal, setShowDeleteEventModal] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Mouse movement detection for fullscreen UI
  const [showFullscreenControls, setShowFullscreenControls] = useState(true); // Start visible
  const mouseVelocityRef = useRef({ x: 0, y: 0, lastX: 0, lastY: 0, lastTime: Date.now() });
  const hideControlsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const VELOCITY_THRESHOLD = 1; // pixels per millisecond (more sensitive)
  const HIDE_DELAY = 1000; // 1 second

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
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editedEventRef = useRef<CalendarEvent | null>(null);
  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isEditingDescriptionRef = useRef(false);
  const tempDescriptionRef = useRef('');
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioElementsRef = useRef<{ [id: string]: HTMLAudioElement }>({});

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

      // Reset description editing state when switching to a different event
      // This prevents new events from inheriting the description from previous events
      setIsEditingDescription(false);
      setTempDescription('');
      setDescriptionHistory([]);
      setDescriptionHistoryIndex(0);

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

  // Helper function to prepare event for saving with recordings
  const prepareEventForSave = useCallback((eventToSave: CalendarEvent) => {
    if (recordings.length > 0) {
      // Convert recordings to a saveable format
      const recordingsData = recordings.map(rec => ({
        id: rec.id,
        duration: rec.duration,
        transcript: rec.transcript,
        isPlaying: false,
        isTranscribing: false,
        // Store minimal data - in a real app, you'd store audio in cloud storage
      }));
      return {
        ...eventToSave,
        recordings: JSON.stringify(recordingsData)
      };
    }
    // Clear recordings field if no recordings
    const { recordings: _, ...eventWithoutRecordings } = eventToSave;
    return eventWithoutRecordings;
  }, [recordings]);

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
        const eventWithRecordings = prepareEventForSave(eventToSave);
        onSave(eventWithRecordings);
      }, 300); // Reduced debounce for better responsiveness
    },
    [onSave, event, isRecurringEvent, prepareEventForSave]
  );

  // Keep refs in sync with state
  useEffect(() => {
    editedEventRef.current = editedEvent;
    isEditingDescriptionRef.current = isEditingDescription;
    tempDescriptionRef.current = tempDescription;
  }, [editedEvent, isEditingDescription, tempDescription]);

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
      const eventWithRecordings = prepareEventForSave(eventToSave);
      onSave(eventWithRecordings);
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

      // Load recordings from event if they exist
      if (event.recordings) {
        try {
          const parsedRecordings = JSON.parse(event.recordings);
          // Recreate recordings with simplified data (no blob restoration for now)
          setRecordings(parsedRecordings);
        } catch (error) {
          console.error('Failed to parse recordings:', error);
          setRecordings([]);
        }
      } else {
        setRecordings([]);
      }

      // For new events (justCreated), always clear the description/notes
      // For existing events, use their actual description
      if (event.justCreated) {
        setLocalDescription('');
        setTempDescription('');
        setIsEditingDescription(false);
        // Clear any stored history for new events
        if (event.id) {
          descriptionHistoriesStore.delete(event.id);
        }
      } else {
        setLocalDescription(event.description || '');

        // Restore description history if it exists
        if (event.id && descriptionHistoriesStore.has(event.id)) {
          const stored = descriptionHistoriesStore.get(event.id)!;
          setDescriptionHistory(stored.history);
          setDescriptionHistoryIndex(stored.index);
        } else {
          // Initialize with current description if no history exists
          setDescriptionHistory([event.description || '']);
          setDescriptionHistoryIndex(0);
        }
      }
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

      // Check if click is inside the EventEditor component at all
      // This includes the main container and any child elements
      if (mainContainerRef.current && mainContainerRef.current.contains(target)) {
        console.log('Click inside EventEditor main container - ignoring');
        return;
      }

      // Also check if the target has a parent that's the EventEditor
      const eventEditorParent = targetElement.closest('[data-event-editor-container="true"]');
      if (eventEditorParent) {
        console.log('Click inside EventEditor via data attribute check - ignoring');
        return;
      }

      if (editorRef.current && editorRef.current.contains(target)) {
        return;
      }

      // If we're editing description and clicking outside, save it first
      // BUT skip this if we're in fullscreen mode
      if (isEditingDescription && !isFullScreen) {
        updateEvent('description', tempDescription);
        setIsEditingDescription(false);
        setTempDescription('');
        // Don't return - continue to check if we should close the editor
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
        const eventWithRecordings = prepareEventForSave(currentEvent);
        onSave(eventWithRecordings);
      }

      // Close the editor
      onCancel();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditingDescription && !isFullScreen) {
          // If editing description in normal mode, cancel and clear
          setIsEditingDescription(false);
          setTempDescription('');
        } else if (isFullScreen) {
          // If in fullscreen, just exit without clearing content
          setIsFullScreen(false);
          setFullScreenMode('editor');
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
  }, [onCancel, onSave, onDelete, isFullScreen, saveTimeout, hasEventBeenModified, editedEvent, isEditingDescription]);

  // Protect textarea content when in fullscreen mode
  useEffect(() => {
    if (isFullScreen && fullscreenTextareaRef.current) {
      const textarea = fullscreenTextareaRef.current;

      // Always keep the saved value up to date
      if (tempDescription !== '') {
        savedDescriptionRef.current = tempDescription;
      }

      // Global mouse up handler to restore content if needed
      const handleGlobalMouseUp = () => {
        if (isDraggingRef.current) {
          setTimeout(() => {
            isDraggingRef.current = false;

            if (textarea) {
              // Re-enable textarea
              textarea.style.userSelect = 'text';
              textarea.style.webkitUserSelect = 'text';
              textarea.style.pointerEvents = 'auto';
              textarea.readOnly = false;

              // Restore content if it was cleared
              if (textarea.value === '' && savedDescriptionRef.current !== '') {
                textarea.value = savedDescriptionRef.current;
                setTempDescription(savedDescriptionRef.current);
              } else if (tempDescription === '' && savedDescriptionRef.current !== '') {
                setTempDescription(savedDescriptionRef.current);
              }

              // Re-focus and set cursor to end
              textarea.focus();
              textarea.setSelectionRange(textarea.value.length, textarea.value.length);
            }
          }, 100);
        }
      };

      // Add global mouseup listener
      document.addEventListener('mouseup', handleGlobalMouseUp);

      return () => {
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isFullScreen, tempDescription]);

  // Clean up timeout on unmount and save description if editing
  useEffect(() => {
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);

      // Clean up recording
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }

      // Save description if it was being edited when unmounting
      // Use refs to get the current values at unmount time
      if (isEditingDescriptionRef.current && tempDescriptionRef.current) {
        const currentEvent = editedEventRef.current;
        if (currentEvent && tempDescriptionRef.current !== currentEvent.description) {
          const updatedEvent = { ...currentEvent, description: tempDescriptionRef.current };
          delete updatedEvent.justCreated;
          const eventWithRecordings = prepareEventForSave(updatedEvent);
          onSave(eventWithRecordings);
        }
      }

      // Clear live event data when component unmounts
      const currentEvent = editedEventRef.current;
      if (currentEvent) {
        clearLiveEvent(currentEvent.id);
      }
    };
  }, [onSave, clearLiveEvent]); // Include stable dependencies

  // Save description history to store whenever it changes
  useEffect(() => {
    if (editedEvent?.id && descriptionHistory.length > 0) {
      descriptionHistoriesStore.set(editedEvent.id, {
        history: descriptionHistory,
        index: descriptionHistoryIndex
      });
    }
  }, [editedEvent?.id, descriptionHistory, descriptionHistoryIndex]);

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

  // Recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      const recordingId = Date.now().toString();
      setCurrentRecordingId(recordingId);
      const startTime = Date.now();
      setRecordingStartTime(startTime);

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        // Calculate actual duration in seconds
        const duration = Math.round((Date.now() - startTime) / 1000);

        // Add new recording to the list
        setRecordings(prev => [...prev, {
          id: recordingId,
          blob: audioBlob,
          duration: duration,
          url: audioUrl,
          transcript: undefined,
          isTranscribing: false,
          isPlaying: false
        }]);

        // Auto-scroll to bottom to show recordings
        setTimeout(() => {
          // If in editing mode, scroll the editor container
          const scrollContainer = editorRef.current || mainContainerRef.current;
          if (scrollContainer) {
            scrollContainer.scrollTo({
              top: scrollContainer.scrollHeight,
              behavior: 'smooth'
            });
          }
        }, 100);

        // Clear temporary recording data
        audioChunksRef.current = [];
        setCurrentRecordingId(null);
        stream.getTracks().forEach(track => track.stop());

        // Enter edit mode if not already
        if (!isEditingDescription) {
          setIsEditingDescription(true);
          const initialDescription = editedEvent?.description || '';
          setTempDescription(initialDescription);

          // Auto-scroll to bottom if there are recordings
          if (recordings.length > 0) {
            setTimeout(() => {
              const editor = editorRef.current;
              if (editor) {
                editor.scrollTo({
                  top: editor.scrollHeight,
                  behavior: 'smooth'
                });
              }
            }, 100);
          }

          if (editedEvent?.id && descriptionHistoriesStore.has(editedEvent.id)) {
            const stored = descriptionHistoriesStore.get(editedEvent.id)!;
            setDescriptionHistory(stored.history);
            setDescriptionHistoryIndex(stored.index);
            if (stored.history[stored.index] !== undefined) {
              setTempDescription(stored.history[stored.index]);
            }
          } else {
            setDescriptionHistory([initialDescription]);
            setDescriptionHistoryIndex(0);
          }

          setTimeout(() => {
            if (descriptionTextareaRef.current) {
              descriptionTextareaRef.current.focus();
            }
          }, 100);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer for display
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(Math.floor((Date.now() - startTime) / 1000));
      }, 100); // Update more frequently for accurate display
    } catch (err) {
      console.error('Failed to start recording:', err);
      alert('Could not access microphone. Please check your permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  const playRecording = (recordingId: string) => {
    const recording = recordings.find(r => r.id === recordingId);
    if (!recording) return;

    // If already playing, stop it
    if (recording.isPlaying && audioElementsRef.current[recordingId]) {
      audioElementsRef.current[recordingId].pause();
      audioElementsRef.current[recordingId].currentTime = 0;
      setRecordings(prev => prev.map(r =>
        r.id === recordingId ? { ...r, isPlaying: false } : r
      ));
      return;
    }

    // Stop any other playing recordings
    Object.values(audioElementsRef.current).forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    setRecordings(prev => prev.map(r => ({ ...r, isPlaying: false })));

    // Create new audio element if doesn't exist
    if (!audioElementsRef.current[recordingId]) {
      audioElementsRef.current[recordingId] = new Audio(recording.url);
      audioElementsRef.current[recordingId].onended = () => {
        setRecordings(prev => prev.map(r =>
          r.id === recordingId ? { ...r, isPlaying: false } : r
        ));
      };
    }

    // Play the recording
    audioElementsRef.current[recordingId].play();
    setRecordings(prev => prev.map(r =>
      r.id === recordingId ? { ...r, isPlaying: true } : r
    ));
  };

  const deleteRecording = (recordingId: string) => {
    // Clean up audio element if exists
    if (audioElementsRef.current[recordingId]) {
      audioElementsRef.current[recordingId].pause();
      delete audioElementsRef.current[recordingId];
    }

    // Remove from recordings list
    setRecordings(prev => prev.filter(r => r.id !== recordingId));
    setShowDeleteModal(null);
  };

  const transcribeRecording = async (recordingId: string) => {
    const recording = recordings.find(r => r.id === recordingId);
    if (!recording) return;

    // Mark as transcribing
    setRecordings(prev => prev.map(r =>
      r.id === recordingId ? { ...r, isTranscribing: true } : r
    ));

    try {
      // Create form data with the audio blob
      const formData = new FormData();
      formData.append('audio', recording.blob, 'recording.webm');

      // Call the transcribe API
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const data = await response.json();
      const transcript = data.text || '';

      // Update recording with transcript
      setRecordings(prev => prev.map(r =>
        r.id === recordingId ? { ...r, transcript, isTranscribing: false } : r
      ));

      // Add transcript to description
      const currentDescription = tempDescription || localDescription;
      const newDescription = currentDescription ?
        `${currentDescription}\n\n${transcript}` :
        transcript;

      setTempDescription(newDescription);

      // Focus textarea and move cursor to end
      setTimeout(() => {
        if (descriptionTextareaRef.current) {
          descriptionTextareaRef.current.focus();
          const length = descriptionTextareaRef.current.value.length;
          descriptionTextareaRef.current.setSelectionRange(length, length);
        }
      }, 100);

    } catch (error) {
      console.error('Transcription failed:', error);
      setRecordings(prev => prev.map(r =>
        r.id === recordingId ? { ...r, isTranscribing: false } : r
      ));
      alert('Failed to transcribe audio. Please try again.');
    }
  };


  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
      const eventWithRecordings = prepareEventForSave(updatedWithRecurrence);
      onSave(eventWithRecordings);
    } else if (field === 'title') {
      // Save title changes immediately without debounce for live preview
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      const eventWithRecordings = prepareEventForSave(updated);
      onSave(eventWithRecordings);
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
      ref={mainContainerRef}
      data-event-editor-container="true"
      className={`${className} bg-white h-full border-l ${isNewEvent && !editedEvent.title ? 'border-yellow-400 animate-pulse' : 'border-gray-200'} p-4 relative z-40 flex flex-col overflow-y-auto`}
      onClick={(e) => {
        // If editing description and clicking on blank space within the editor, save it
        if (isEditingDescription) {
          const target = e.target as HTMLElement;

          // Don't save if clicking on any part of the description editing area
          const isInDescriptionEditor = target.closest('.border-blue-200') ||
                                       target.closest('[class*="description"]') ||
                                       target.closest('textarea') ||
                                       target.closest('button');

          if (isInDescriptionEditor) {
            return; // Don't save when clicking within the description editor
          }

          // Check if we clicked on truly blank space (editor background or non-interactive areas)
          const isBlankSpace = target === editorRef.current ||
                               (target.classList.contains('flex-1') && !target.closest('.border-blue-200')) ||
                               (target.classList.contains('flex') && !target.closest('.border-blue-200')) ||
                               (target.classList.contains('flex-col') && !target.closest('.border-blue-200'));

          if (isBlankSpace) {
            // Save description just like Cmd+Enter
            updateEvent('description', tempDescription);
            setIsEditingDescription(false);
            setTempDescription('');
          }
        }
      }}
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
                const eventWithRecordings = prepareEventForSave(eventToSave);
                onSave(eventWithRecordings);
              }

              // Save the local title if changed
              if (editedEvent && localTitle !== editedEvent.title) {
                updateEvent('title', localTitle);
              }

              // Disable input after saving new event
              if (editedEvent && editedEvent.justCreated) {
                setTitleInputEnabled(false);
              }

              // Remove the new event flag when losing focus
              setIsNewEvent(false);
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
                  const eventWithRecordings = prepareEventForSave(eventToSave);
                  onSave(eventWithRecordings);
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
                  const eventWithRecordings = prepareEventForSave(eventToSave);
                  onSave(eventWithRecordings);
                }
                onCancel();
              }
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
                          <p className="text-xs text-gray-400 mt-1">Press Enter to create &quot;{newCategoryInput.trim()}&quot;</p>
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
                          <p className="text-xs text-gray-400 mt-1">Press Enter to create &quot;{newLocationInput.trim()}&quot;</p>
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
        <div className={`flex-1 flex flex-col mt-2 ${isEditingDescription ? 'mb-2' : 'mb-0'} min-h-0`}>
          {isEditingDescription ? (
            <div className="animate-fadeIn flex flex-col h-full">
              {/* Scrollable content container with border */}
              <div className="overflow-y-auto flex-1 border border-gray-200 rounded-xl" ref={editorRef}>
                  {/* Formatting toolbar - sticky at top */}
                  <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-2.5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl">
                  <div className="flex items-center gap-1">
                    {/* Heading buttons */}
                    <button
                      type="button"
                      onClick={() => {
                        const textarea = descriptionTextareaRef.current;
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
                      className="px-2 py-1 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                    >
                      H3
                    </button>

                    {/* Separator button */}
                    <button
                      type="button"
                      onClick={() => {
                        const textarea = descriptionTextareaRef.current;
                        if (textarea) {
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const newText = '\n\n---\n';
                          const newDescription = tempDescription.substring(0, start) + newText + tempDescription.substring(end);
                          setTempDescription(newDescription);
                          setTimeout(() => {
                            textarea.focus();
                            const newPosition = start + newText.length;
                            textarea.setSelectionRange(newPosition, newPosition);
                          }, 0);
                        }
                      }}
                      className="px-2 py-1 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                      title="Insert horizontal rule"
                    >
                      ─
                    </button>

                    {/* Format button */}
                    <button
                      type="button"
                      disabled={isFormatting || !tempDescription}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.nativeEvent.stopImmediatePropagation();
                        if (!tempDescription || isFormatting) return;

                        // Delay execution to ensure event doesn't close the editor
                        setTimeout(async () => {
                          const textarea = descriptionTextareaRef.current;
                          const originalText = tempDescription;

                          setIsFormatting(true);
                          setFormatStatus('loading');

                          try {
                          const response = await fetch('/api/format', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Accept': 'application/json',
                            },
                            body: JSON.stringify({ text: originalText }),
                            credentials: 'same-origin',
                            redirect: 'error', // Prevent any redirects
                          });

                          // Check if response is actually JSON
                          const contentType = response.headers.get('content-type');
                          if (!contentType || !contentType.includes('application/json')) {
                            console.error('Format API returned non-JSON response:', contentType);
                            throw new Error('Invalid response from format API');
                          }

                          if (!response.ok) {
                            const errorText = await response.text();
                            console.error('Format API error:', response.status, errorText);
                            throw new Error(`Format failed: ${response.status}`);
                          }

                          const data = await response.json();
                          const formattedText = data.formattedText || originalText;

                          // Update the text with the formatted version
                          setTempDescription(formattedText);
                          setFormatStatus('success');

                          // Refocus the textarea
                          setTimeout(() => {
                            if (textarea) {
                              textarea.focus();
                              textarea.setSelectionRange(0, 0);
                            }
                          }, 50);

                          // Reset status after animation
                          setTimeout(() => {
                            setFormatStatus('idle');
                          }, 2000);
                        } catch (error) {
                          console.error('Error formatting text:', error);
                          setFormatStatus('error');

                          // Reset status after showing error
                          setTimeout(() => {
                            setFormatStatus('idle');
                          }, 2000);
                        } finally {
                          setIsFormatting(false);
                        }
                        }, 0); // Close setTimeout
                      }}
                      className={`relative px-2 py-1 text-xs font-semibold rounded transition-all duration-200 ${
                        isFormatting
                          ? 'bg-blue-100 text-blue-600 cursor-wait'
                          : formatStatus === 'success'
                          ? 'bg-green-100 text-green-600'
                          : formatStatus === 'error'
                          ? 'bg-red-100 text-red-600'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                      } ${!tempDescription ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title={
                        isFormatting
                          ? "Formatting..."
                          : formatStatus === 'success'
                          ? "Formatted successfully!"
                          : formatStatus === 'error'
                          ? "Formatting failed"
                          : "Format text and math notation (AI-powered)"
                      }
                    >
                      {isFormatting ? (
                        <div className="animate-spin">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        </div>
                      ) : formatStatus === 'success' ? (
                        <svg className="w-4 h-4 animate-fadeIn" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : formatStatus === 'error' ? (
                        <svg className="w-4 h-4 animate-shake" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                        </svg>
                      )}
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
                          const textBeforeCursor = tempDescription.substring(0, start);
                          const isAtLineStart = start === 0 || textBeforeCursor.endsWith('\n');
                          const prefix = isAtLineStart ? '' : '\n';
                          const newText = `${prefix}1. ${selectedText || 'List item'}`;
                          const newDescription = tempDescription.substring(0, start) + newText + tempDescription.substring(end);
                          setTempDescription(newDescription);
                          setTimeout(() => {
                            textarea.focus();
                            const offset = prefix.length + 3;
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
                </div>

                {/* Textarea container */}
                <div className="flex flex-col">
                  <textarea
                    ref={descriptionTextareaRef}
                    value={tempDescription}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setTempDescription(newValue);
                      if (editedEvent) {
                        updateLiveEvent(editedEvent.id, { description: newValue });
                        const updated = { ...editedEvent, description: newValue };
                        setEditedEvent(updated);
                        editedEventRef.current = updated;
                      }
                    }}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                        e.preventDefault();
                        updateEvent('description', tempDescription);
                        setIsEditingDescription(false);
                        setTempDescription('');
                        return;
                      }
                    }}
                    className="w-full min-h-[250px] text-gray-700 bg-transparent px-4 py-3 outline-none focus:ring-0 resize-none text-sm font-mono"
                    placeholder="Add your notes • Supports markdown, LaTeX math ($x^2$), tables, code blocks..."
                  />
                </div>

                {/* Recordings container */}
                {recordings.length > 0 && (
                  <div className="border-t border-gray-200 p-4 bg-white/50 mt-2">
                    <div className="space-y-2">
                      {recordings.map((recording, index) => (
                        <div key={recording.id} className="group relative bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all duration-200">
                          <div className="flex items-center py-2 px-3">
                            <div className="flex items-center gap-3 flex-1">
                              <button
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  e.nativeEvent.stopImmediatePropagation();
                                }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  e.nativeEvent.stopImmediatePropagation();
                                  playRecording(recording.id);
                                }}
                                className={`relative flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 ${
                                  recording.isPlaying
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-600'
                                }`}
                                title={recording.isPlaying ? 'Pause' : 'Play recording'}
                              >
                                {recording.isPlaying ? (
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                    <rect x="7" y="7" width="4" height="10" rx="1" />
                                    <rect x="13" y="7" width="4" height="10" rx="1" />
                                  </svg>
                                ) : (
                                  <svg className="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z"/>
                                  </svg>
                                )}
                              </button>
                              <div className="flex-1 flex items-center gap-3">
                                <span className="text-sm font-medium text-gray-800">Recording #{index + 1}</span>
                                <span className="text-xs text-gray-500 font-mono bg-gray-100 px-1.5 py-0.5 rounded">{formatRecordingTime(recording.duration)}</span>
                                {recording.transcript && (
                                  <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                                    <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    <span className="text-[10px]">Transcribed</span>
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {!recording.transcript && !recording.isTranscribing && (
                                <button
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    e.nativeEvent.stopImmediatePropagation();
                                  }}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    e.nativeEvent.stopImmediatePropagation();
                                    transcribeRecording(recording.id);
                                  }}
                                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 rounded-md transition-all duration-200"
                                  title="Generate AI transcript"
                                >
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                                  </svg>
                                  <span>AI</span>
                                </button>
                              )}
                              {recording.isTranscribing && (
                                <div className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 rounded">
                                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  <span>Processing</span>
                                </div>
                              )}
                              <button
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  e.nativeEvent.stopImmediatePropagation();
                                }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  e.nativeEvent.stopImmediatePropagation();
                                  setShowDeleteModal(recording.id);
                                }}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                                title="Delete recording"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                </div>
            </div>
          ) : (
            <div className="relative w-full flex-1 flex flex-col min-h-0">
              <div className="w-full h-full animate-descriptionFadeIn overflow-hidden">
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setIsEditingDescription(true);
                    const initialDescription = editedEvent.description || '';
                    setTempDescription(initialDescription);

                    // Auto-scroll to bottom to show recordings when entering edit mode
                    if (recordings.length > 0) {
                      setTimeout(() => {
                        const editor = editorRef.current;
                        if (editor) {
                          editor.scrollTo({
                            top: editor.scrollHeight,
                            behavior: 'smooth'
                          });
                        }
                      }, 150);
                    }

                    setTimeout(() => {
                      if (descriptionTextareaRef.current) {
                        descriptionTextareaRef.current.focus();
                      }
                    }, 50);
                  }}
                  className="group w-full h-full bg-gradient-to-br from-gray-50 via-white to-gray-50 border border-gray-200 hover:border-blue-300 rounded-xl px-4 pt-3.5 pb-4 cursor-text transition-all duration-300 overflow-y-auto markdown-content hover:shadow-md hover:from-blue-50/30 hover:via-white hover:to-blue-50/30 relative"
                  tabIndex={-1}
                  role="button"
                  aria-label="Click to edit description"
                >
                  {editedEvent.description ? (
                    <div className="prose prose-sm max-w-none event-description-content">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
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
                    <div className="flex flex-col items-center justify-center py-4 text-center">
                      <div className="mb-3">
                        <svg className="w-10 h-10 text-gray-300 group-hover:text-blue-400 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <span className="text-gray-600 font-medium text-sm">
                        Click to add notes
                      </span>
                      <span className="text-xs text-gray-400 mt-2 leading-relaxed max-w-[280px]">
                        Supports Markdown • LaTeX Math • Tables • Lists • Code blocks
                      </span>
                      <div className="flex items-center gap-1.5 mt-3 px-3 py-1.5 bg-gradient-to-r from-green-50 to-blue-50 rounded-full border border-green-200/50">
                        <svg className="w-3.5 h-3.5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32l8.4-8.4z"/>
                          <path d="M5.25 5.25a3 3 0 00-3 3v10.5a3 3 0 003 3h10.5a3 3 0 003-3V13.5a.75.75 0 00-1.5 0v5.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V8.25a1.5 1.5 0 011.5-1.5h5.25a.75.75 0 000-1.5H5.25z"/>
                        </svg>
                        <span className="text-[10px] font-medium text-green-700">
                          Works with ChatGPT
                        </span>
                        <span className="text-[10px] text-gray-500">
                          • Use copy button for markdown
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Recording indicator in preview mode */}
                  {recordings.length > 0 && (
                    <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-gray-50/90 backdrop-blur-sm border border-gray-100 rounded-full px-2.5 py-1.5">
                      <svg className="w-3.5 h-3.5 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3z" />
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                      </svg>
                      <span className="text-[11px] text-gray-600">
                        {recordings.length} {recordings.length === 1 ? 'recording' : 'recordings'}
                      </span>
                      <span className="text-[10px] text-gray-400 ml-0.5">
                        • Edit to play
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action bar - only show in editing mode */}
        {isEditingDescription && (
          <div className="h-[28px] flex items-end justify-between px-0 -mb-1 bg-white">
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!isEditingDescription) {
                  setTempDescription(editedEvent.description || '');
                }
                const cursorPos = descriptionTextareaRef.current?.selectionStart || 0;
                const cursorEnd = descriptionTextareaRef.current?.selectionEnd || 0;
                setIsFullScreen(true);
                setTimeout(() => {
                  const fullscreenTextarea = document.querySelector('.fullscreen-textarea') as HTMLTextAreaElement;
                  if (fullscreenTextarea) {
                    fullscreenTextarea.focus();
                    fullscreenTextarea.setSelectionRange(cursorPos, cursorEnd);
                  }
                }, 50);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200 font-medium"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              Expand
            </button>

            {!isRecording && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.nativeEvent.stopImmediatePropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.nativeEvent.stopImmediatePropagation();
                  startRecording();
                }}
                className="group flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:border-red-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 shadow-sm hover:shadow"
                title="Start voice recording"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3z"/>
                  <path d="M17 12c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                </svg>
                <span>Record</span>
              </button>
            )}
            {isRecording && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.nativeEvent.stopImmediatePropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.nativeEvent.stopImmediatePropagation();
                  stopRecording();
                }}
                className="group flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg animate-pulse"
                title="Stop recording"
              >
                <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                <span>Stop Record</span>
                <span className="text-[10px] opacity-80">{formatRecordingTime(recordingTime)}</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isEditingDescription) {
                  updateEvent('description', tempDescription);
                  setIsEditingDescription(false);
                  setTempDescription('');
                }
              }}
              className="px-4 py-1.5 text-xs bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-medium flex items-center gap-1.5 shadow-sm"
              title="Save notes (Cmd+Enter)"
            >
              Confirm
              <span className="text-[10px] opacity-90 font-normal">(⌘↵)</span>
            </button>
          </div>
        </div>
        )}

        {/* Full Screen Editor Modal (via portal) */}
        {mounted && isFullScreen
          ? createPortal(
              <div
                id="event-editor-portal"
                className="fixed inset-0 z-[9999]"
                onMouseMove={handleMouseMove}
                onKeyDown={(e) => {
                  // Stop all keyboard events from bubbling to the document/calendar
                  // The textarea will handle its own keyboard events
                  e.stopPropagation();
                }}
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
                      <div
                        className={`fixed top-4 right-4 flex items-center gap-2 z-50 transition-opacity duration-300 ease-out ${showFullscreenControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                        onMouseEnter={() => {
                          // Keep controls visible when hovering
                          if (hideControlsTimerRef.current) {
                            clearTimeout(hideControlsTimerRef.current);
                          }
                          setShowFullscreenControls(true);
                        }}
                        onMouseLeave={() => {
                          // Start hide timer when mouse leaves
                          if (hideControlsTimerRef.current) {
                            clearTimeout(hideControlsTimerRef.current);
                          }
                          hideControlsTimerRef.current = setTimeout(() => {
                            setShowFullscreenControls(false);
                          }, HIDE_DELAY);
                        }}
                      >
                        <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 relative p-1">
                          {/* Sliding indicator background */}
                          <div
                            className="absolute top-1 bottom-1 bg-gray-900 rounded-lg"
                            style={{
                              width: fullScreenMode === 'editor' ? '80px' : '105px',
                              left: fullScreenMode === 'editor' ? '4px' : '88px',
                              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}
                          />
                          <div className="relative flex items-center">
                            <button
                              id="fullscreen-edit-btn"
                              onClick={() => setFullScreenMode('editor')}
                              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2 relative z-10 ${
                                fullScreenMode === 'editor'
                                  ? 'text-white'
                                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                              }`}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit
                            </button>
                            <button
                              id="fullscreen-preview-btn"
                              onClick={() => setFullScreenMode('preview')}
                              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2 relative z-10 ${
                                fullScreenMode === 'preview'
                                  ? 'text-white'
                                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                              }`}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              Preview
                            </button>
                          </div>
                        </div>

                        <button
                          onClick={() => setIsFullScreen(false)}
                          className="p-2.5 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all duration-200"
                          title="Exit fullscreen (Esc)"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      {/* Formatting toolbar for editor mode */}
                      {fullScreenMode === 'editor' && (
                        <div
                          className={`fixed top-4 left-1/2 transform -translate-x-1/2 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 px-2 py-2 flex items-center gap-0.5 z-40 transition-opacity duration-300 ease-out ${showFullscreenControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                          onMouseEnter={() => {
                            // Keep toolbar visible when hovering
                            if (hideControlsTimerRef.current) {
                              clearTimeout(hideControlsTimerRef.current);
                            }
                            setShowFullscreenControls(true);
                          }}
                          onMouseLeave={() => {
                            // Start hide timer when mouse leaves
                            if (hideControlsTimerRef.current) {
                              clearTimeout(hideControlsTimerRef.current);
                            }
                            hideControlsTimerRef.current = setTimeout(() => {
                              setShowFullscreenControls(false);
                            }, HIDE_DELAY);
                          }}
                        >
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
                            className="px-3 py-1.5 text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-all duration-200"
                            title="Heading 1"
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
                            className="px-3 py-1.5 text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-all duration-200"
                            title="Heading 2"
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
                            className="px-3 py-1.5 text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-all duration-200"
                            title="Heading 3"
                          >
                            H3
                          </button>

                          {/* Separator button */}
                          <button
                            type="button"
                            onClick={() => {
                              const textarea = document.querySelector('.fullscreen-textarea') as HTMLTextAreaElement;
                              if (textarea) {
                                const start = textarea.selectionStart;
                                const end = textarea.selectionEnd;

                                // Check if we're at the start of a line
                                const textBeforeCursor = tempDescription.substring(0, start);
                                const needsNewlineBefore = start > 0 && !textBeforeCursor.endsWith('\n\n');

                                // Insert separator with double line break before (enter + enter + "---" + enter)
                                const separator = `${needsNewlineBefore ? '\n\n' : ''}---\n`;
                                const newDescription = tempDescription.substring(0, start) + separator + tempDescription.substring(end);
                                setTempDescription(newDescription);

                                setTimeout(() => {
                                  textarea.focus();
                                  const newPos = start + separator.length;
                                  textarea.setSelectionRange(newPos, newPos);
                                }, 0);
                              }
                            }}
                            className="px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-all duration-200 font-mono"
                            title="Horizontal rule"
                          >
                            —
                          </button>

                          <div className="w-px h-5 bg-gray-300 mx-1" />

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
                            className="w-9 h-9 text-sm font-bold text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-all duration-200 flex items-center justify-center"
                            title="Bold"
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
                            className="w-9 h-9 text-sm italic text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-all duration-200 flex items-center justify-center"
                            title="Italic"
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
                            className="w-9 h-9 text-sm underline text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-all duration-200 flex items-center justify-center"
                            title="Underline"
                          >
                            U
                          </button>

                          <div className="w-px h-5 bg-gray-300 mx-1" />

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
                            className="w-9 h-9 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-all duration-200 flex items-center justify-center"
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
                            className="w-9 h-9 text-sm font-bold text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-all duration-200 flex items-center justify-center"
                            title="Numbered list"
                          >
                            #
                          </button>
                        </div>
                      )}

                      {/* Main content area - clean and focused */}
                      <div className="flex-1 relative h-full overflow-hidden">
                        <div className="relative w-full h-full overflow-hidden">
                          {/* Editor Mode */}
                          <div className={`absolute inset-0 ${
                            fullScreenMode === 'editor' ? 'block' : 'hidden'
                          }`}>
                            <>
                            {/* Subtle fade at top for editor mode */}
                            <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-white/80 to-transparent pointer-events-none z-10" />

                            <textarea
                            ref={fullscreenTextareaRef}
                            value={tempDescription}
                            onFocus={() => {
                              // Always save the value when textarea gains focus
                              savedDescriptionRef.current = tempDescription;
                            }}
                            onBlur={() => {
                              // When losing focus during drag, restore content
                              if (isDraggingRef.current && tempDescription === '' && savedDescriptionRef.current !== '') {
                                // Restore the content immediately
                                setTimeout(() => {
                                  setTempDescription(savedDescriptionRef.current);
                                  // Re-focus the textarea
                                  if (fullscreenTextareaRef.current) {
                                    fullscreenTextareaRef.current.focus();
                                  }
                                }, 0);
                              }
                            }}
                            onBeforeInput={() => {
                              // Save value before any input changes
                              if (tempDescription !== '') {
                                savedDescriptionRef.current = tempDescription;
                              }
                            }}
                            onSelect={(e) => {
                              // Block selection entirely if we're in a drag operation
                              if (isDraggingRef.current) {
                                e.preventDefault();
                                window.getSelection()?.removeAllRanges();
                                // Reset selection to nothing
                                const textarea = e.currentTarget as HTMLTextAreaElement;
                                textarea.setSelectionRange(0, 0);
                                return false;
                              }
                              // Normal selection - save the value
                              savedDescriptionRef.current = tempDescription;
                            }}
                            onDragStart={(e) => {
                              // Prevent drag operations that could cause text loss
                              e.preventDefault();
                              return false;
                            }}
                            onDragEnter={(e) => {
                              e.preventDefault();
                              return false;
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              return false;
                            }}
                            onDrop={(e) => {
                              // Prevent drop operations
                              e.preventDefault();
                              return false;
                            }}
                            onChange={(e) => {
                              const newValue = e.target.value;

                              // Prevent clearing during drag operations
                              if (isDraggingRef.current && newValue === '' && savedDescriptionRef.current !== '') {
                                // Don't update to empty during drag
                                e.preventDefault();
                                // Restore the saved value
                                setTimeout(() => {
                                  setTempDescription(savedDescriptionRef.current);
                                  if (fullscreenTextareaRef.current) {
                                    fullscreenTextareaRef.current.value = savedDescriptionRef.current;
                                    // Set cursor to end
                                    fullscreenTextareaRef.current.setSelectionRange(
                                      fullscreenTextareaRef.current.value.length,
                                      fullscreenTextareaRef.current.value.length
                                    );
                                  }
                                }, 0);
                                return;
                              }

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
                                e.stopPropagation(); // Prevent calendar from handling this
                                if (descriptionHistoryIndex > 0) {
                                  const newIndex = descriptionHistoryIndex - 1;
                                  setDescriptionHistoryIndex(newIndex);
                                  setTempDescription(descriptionHistory[newIndex]);
                                }
                                return;
                              }

                              if ((e.metaKey || e.ctrlKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
                                e.preventDefault();
                                e.stopPropagation(); // Prevent calendar from handling this
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
                                e.stopPropagation(); // Prevent any parent handlers
                                updateEvent('description', tempDescription);
                                setIsEditingDescription(false);
                                setTempDescription('');
                                setIsFullScreen(false);
                                setFullScreenMode('editor');
                              }
                            }}
                            className="fullscreen-textarea w-full h-full px-[max(2rem,calc((100vw-80rem)/2))] pt-12 pb-12 text-gray-800 bg-transparent outline-none resize-none font-mono text-lg leading-relaxed max-w-full"
                            placeholder="Add your notes..."
                          />
                          </>
                          </div>

                          {/* Preview Mode */}
                          <div className={`absolute inset-0 ${
                            fullScreenMode === 'preview' ? 'block' : 'hidden'
                          }`}>
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
                                  <ReactMarkdown
                                    remarkPlugins={[remarkGfm, remarkMath]}
                                    rehypePlugins={[rehypeKatex]}
                                  >
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
                          </div>
                        </div>
                      </div>

                      {/* Minimal footer - just save/cancel */}
                      <div className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 flex items-center justify-center gap-3 z-30 transition-opacity duration-300 ease-out ${showFullscreenControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                        <div
                          className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 px-2 py-2 flex items-center gap-2 select-none"
                          style={{ userSelect: 'none' }}
                          onMouseDown={(e) => {
                            // Prevent any text selection when clicking anywhere in the button container
                            e.preventDefault();
                            e.stopPropagation();
                            // Clear any existing text selection
                            if (window.getSelection) {
                              const selection = window.getSelection();
                              if (selection) {
                                selection.removeAllRanges();
                              }
                            }
                          }}
                          onMouseEnter={() => {
                            if (hideControlsTimerRef.current) {
                              clearTimeout(hideControlsTimerRef.current);
                            }
                            setShowFullscreenControls(true);
                          }}
                          onMouseLeave={() => {
                            if (hideControlsTimerRef.current) {
                              clearTimeout(hideControlsTimerRef.current);
                            }
                            hideControlsTimerRef.current = setTimeout(() => {
                              setShowFullscreenControls(false);
                            }, HIDE_DELAY);
                          }}
                        >
                          <button
                            onMouseDown={(e) => {
                              // Prevent all default behaviors
                              e.preventDefault();
                              e.stopPropagation();

                              // Mark drag operation as started
                              isDraggingRef.current = true;

                              // Save the current textarea value
                              savedDescriptionRef.current = tempDescription;

                              // Make textarea completely non-interactive during drag
                              if (fullscreenTextareaRef.current) {
                                const textarea = fullscreenTextareaRef.current;
                                // Disable all interactions
                                textarea.style.userSelect = 'none';
                                textarea.style.webkitUserSelect = 'none';
                                textarea.style.pointerEvents = 'none';
                                // Clear any selection
                                window.getSelection()?.removeAllRanges();
                                // Don't change cursor position, just remove selection
                                // Mark as read-only temporarily
                                textarea.readOnly = true;
                              }
                            }}
                            onMouseUp={(e) => {
                              e.stopPropagation();

                              // Use a small delay to ensure all browser events complete
                              setTimeout(() => {
                                isDraggingRef.current = false;

                                if (fullscreenTextareaRef.current) {
                                  const textarea = fullscreenTextareaRef.current;

                                  // Re-enable the textarea
                                  textarea.style.userSelect = 'text';
                                  textarea.style.webkitUserSelect = 'text';
                                  textarea.style.pointerEvents = 'auto';
                                  textarea.readOnly = false;

                                  // Check and restore content if lost
                                  if (tempDescription === '' && savedDescriptionRef.current !== '') {
                                    setTempDescription(savedDescriptionRef.current);
                                  }

                                  // Ensure textarea is focused and ready
                                  textarea.focus();
                                }
                              }, 50);
                            }}
                            onClick={() => {
                              // Don't clear tempDescription when just closing fullscreen
                              // The user might want to continue editing in normal mode
                              setIsFullScreen(false);
                              setFullScreenMode('editor');
                              // Don't clear tempDescription here
                            }}
                            className="px-5 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200 select-none"
                            style={{ userSelect: 'none' }}
                          >
                            Cancel
                          </button>
                          <button
                            onMouseDown={(e) => {
                              // Prevent all default behaviors
                              e.preventDefault();
                              e.stopPropagation();

                              // Mark drag operation as started
                              isDraggingRef.current = true;

                              // Save the current textarea value
                              savedDescriptionRef.current = tempDescription;

                              // Make textarea completely non-interactive during drag
                              if (fullscreenTextareaRef.current) {
                                const textarea = fullscreenTextareaRef.current;
                                // Disable all interactions
                                textarea.style.userSelect = 'none';
                                textarea.style.webkitUserSelect = 'none';
                                textarea.style.pointerEvents = 'none';
                                // Clear any selection
                                window.getSelection()?.removeAllRanges();
                                // Don't change cursor position, just remove selection
                                // Mark as read-only temporarily
                                textarea.readOnly = true;
                              }
                            }}
                            onMouseUp={(e) => {
                              e.stopPropagation();

                              // Use a small delay to ensure all browser events complete
                              setTimeout(() => {
                                isDraggingRef.current = false;

                                if (fullscreenTextareaRef.current) {
                                  const textarea = fullscreenTextareaRef.current;

                                  // Re-enable the textarea
                                  textarea.style.userSelect = 'text';
                                  textarea.style.webkitUserSelect = 'text';
                                  textarea.style.pointerEvents = 'auto';
                                  textarea.readOnly = false;

                                  // Check and restore content if lost
                                  if (tempDescription === '' && savedDescriptionRef.current !== '') {
                                    setTempDescription(savedDescriptionRef.current);
                                  }

                                  // Ensure textarea is focused and ready
                                  textarea.focus();
                                }
                              }, 50);
                            }}
                            onClick={() => {
                              updateEvent('description', tempDescription);
                              setIsFullScreen(false);
                              setIsEditingDescription(false);
                              setTempDescription('');
                              setFullScreenMode('editor');
                            }}
                            className="px-5 py-2 text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 rounded-lg transition-all duration-200 flex items-center gap-2 select-none"
                            style={{ userSelect: 'none' }}
                          >
                            Save Notes
                            <span className="text-[10px] opacity-90 font-normal">(⌘↵)</span>
                          </button>
                        </div>
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

        {/* Delete Recording Modal */}
        {showDeleteModal && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] animate-fadeIn"
            onMouseDown={(e) => {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
          >
            <div
              className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 transform transition-all duration-200 scale-100"
              onMouseDown={(e) => {
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
              }}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Recording?</h3>
                  <p className="text-sm text-gray-600 mb-5">This will permanently delete the recording. This action cannot be undone.</p>
                  <div className="flex justify-end gap-3">
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.nativeEvent.stopImmediatePropagation();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.nativeEvent.stopImmediatePropagation();
                        setShowDeleteModal(null);
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.nativeEvent.stopImmediatePropagation();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.nativeEvent.stopImmediatePropagation();
                        deleteRecording(showDeleteModal);
                      }}
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm"
                    >
                      Delete Recording
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

EventEditor.displayName = 'EventEditor';