# Recurring Events Duplication Bug Fix

## Problem Description

When a user drags a recurring event and selects "Only this event", multiple duplicate events (8 copies) appear at the new time slot instead of just one.

**Steps to reproduce:**
1. Create a daily recurring event (e.g., 5:00 PM - 7:00 PM)
2. Drag one occurrence to a new time (e.g., 7:30 PM - 9:30 PM)
3. Modal appears asking "Only this event" or "All events"
4. User selects "Only this event"
5. **Bug**: 8 duplicate events appear at 7:30 PM - 9:30 PM
6. **Expected**: Only ONE event should appear at the new time

## Root Cause Analysis

The duplication was caused by **duplicate exception creation logic** in two places:

### 1. CalendarModule.tsx (Lines 2206-2281)
- Handles drag operations for virtual recurring events
- Creates exception events when user selects "Only this event"
- Calls `addToHistory()` which triggers `onUpdateEvents` callback

### 2. page.tsx handleSaveEvent (Lines 260-320)
- Receives events from CalendarModule via `onUpdateEvents`
- Has its own logic to detect virtual events and create exceptions
- Creates ANOTHER exception event when it sees a virtual event

## The Cascade Problem

```
1. User drags virtual event → setEditRecurringModal()
2. User clicks "Only this event" → onConfirm('single')
3. CalendarModule creates exception event → addToHistory()
4. addToHistory() calls setEvents() → onUpdateEvents()
5. onUpdateEvents() calls handleSaveEvent() in page.tsx
6. handleSaveEvent() sees virtual event → creates ANOTHER exception
7. Result: Multiple duplicate events created
```

## Solution

### Fixed CalendarModule.tsx
- **Added extensive debugging logs** to track the flow
- **Removed duplicate logic** - CalendarModule now handles exception creation locally
- **Prevented calling onUpdateEvents** for virtual event exceptions to avoid triggering handleSaveEvent
- **Added proper exception event ID generation** with `parentId: undefined` to mark as processed

### Fixed page.tsx
- **Added debugging logs** to track when handleSaveEvent is called
- **Added logic to detect non-virtual exception events** from CalendarModule
- **Prevented duplicate processing** by checking if exception already exists
- **Enhanced exception detection** to avoid creating multiple exceptions for the same date

## Key Changes

### /src/components/calendar/CalendarModule.tsx
```javascript
// BEFORE: Called onUpdateEvents which triggered duplicate processing
if (onUpdateEvents) {
  onUpdateEvents([...baseEvents, exceptionEvent]);
}

// AFTER: Handle locally to prevent duplicate processing
const finalExceptionEvent = {
  ...exceptionEvent,
  parentId: undefined // Mark as processed
};
updatedEvents.push(finalExceptionEvent);
addToHistory(updatedEvents, baseEvents);
```

### /src/app/page.tsx
```javascript
// ADDED: Detect exception events from CalendarModule
if (!updatedEvent.isVirtual && updatedEvent.parentId && updatedEvent.recurrenceGroupId) {
  console.log('Received non-virtual exception event from CalendarModule:', updatedEvent.id);
  // Handle without creating duplicates
}
```

## Debugging Added

Both files now include comprehensive console.log statements to track:
- When drag operations start/end
- When modals open/close
- When exception events are created
- When handleSaveEvent is called
- When duplicates are detected and prevented

## Testing

To test the fix:
1. Create a daily recurring event
2. Drag one occurrence to a new time
3. Select "Only this event"
4. Check browser console for debug logs
5. Verify only ONE event appears at the new time

## Prevention of Future Issues

- **Centralized exception logic**: Consider moving all exception creation logic to a single location
- **Clear data flow**: Document which component is responsible for which operations
- **Better type safety**: Add TypeScript interfaces to distinguish between virtual and exception events
- **Unit tests**: Add tests specifically for recurring event drag operations

## Files Modified

1. `/src/components/calendar/CalendarModule.tsx`
   - Lines 813-820: Added debugging for drag detection
   - Lines 2206-2315: Refactored exception creation logic

2. `/src/app/page.tsx`
   - Lines 260-357: Enhanced handleSaveEvent with duplicate prevention
   - Added debugging throughout the function