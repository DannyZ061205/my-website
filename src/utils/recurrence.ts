import { CalendarEvent } from '@/types';

/**
 * Generate virtual recurring events based on the recurrence rule
 * Similar to how Google Calendar handles recurring events
 */
export function generateVirtualEvents(
  baseEvent: CalendarEvent,
  viewStart: Date,
  viewEnd: Date
): CalendarEvent[] {
  if (!baseEvent.recurrence || baseEvent.recurrence === 'none') {
    return [];
  }

  const virtualEvents: CalendarEvent[] = [];
  const originalStart = new Date(baseEvent.start);
  const originalEnd = new Date(baseEvent.end);
  const duration = originalEnd.getTime() - originalStart.getTime();

  // Create a function to check if a date is excluded
  const isDateExcluded = (date: Date): boolean => {
    if (!baseEvent.excludedDates || baseEvent.excludedDates.length === 0) return false;

    const dateStr = date.toISOString().split('T')[0];
    const dateTimeStr = date.toISOString();

    return baseEvent.excludedDates.some(excluded => {
      const excludedDate = new Date(excluded);
      const excludedDateStr = excludedDate.toISOString().split('T')[0];

      // Compare just the date parts (ignoring time)
      return dateStr === excludedDateStr;
    });
  };

  // Parse recurrence rule
  const rrule = baseEvent.recurrence;

  // If no recurrence rule, return empty array
  if (!rrule || typeof rrule !== 'string') {
    return [];
  }

  // Parse UNTIL date if present
  let untilDate: Date | null = null;
  const untilMatch = rrule.match(/UNTIL=(\d{8}T\d{6}Z?)/);
  if (untilMatch) {
    const untilStr = untilMatch[1];
    // Parse YYYYMMDDTHHMMSSZ format
    const year = parseInt(untilStr.substr(0, 4));
    const month = parseInt(untilStr.substr(4, 2)) - 1; // Month is 0-based
    const day = parseInt(untilStr.substr(6, 2));
    untilDate = new Date(year, month, day, 23, 59, 59); // End of day
  }

  if (rrule.includes('FREQ=DAILY')) {
    let currentDate = new Date(originalStart);

    // Fast-forward to just before viewStart if event started long ago
    if (currentDate < viewStart) {
      const daysDiff = Math.floor((viewStart.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
      currentDate.setDate(currentDate.getDate() + daysDiff);
    }

    // Generate events only for the visible range
    while (currentDate <= viewEnd && (!untilDate || currentDate <= untilDate)) {
      if (currentDate >= viewStart && currentDate > originalStart) {
        // Check weekday/weekend constraints
        const day = currentDate.getDay();
        let shouldInclude = true;

        if (rrule.includes('BYDAY=MO,TU,WE,TH,FR')) {
          shouldInclude = day >= 1 && day <= 5;
        } else if (rrule.includes('BYDAY=SA,SU')) {
          shouldInclude = day === 0 || day === 6;
        }

        if (shouldInclude && !isDateExcluded(currentDate)) {
          virtualEvents.push({
            ...baseEvent,
            id: `${baseEvent.id}-virtual-${currentDate.getTime()}`,
            start: currentDate.toISOString(),
            end: new Date(currentDate.getTime() + duration).toISOString(),
            isVirtual: true,
            parentId: baseEvent.id
          });
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
  } else if (rrule.includes('FREQ=WEEKLY')) {
    const interval = rrule.includes('INTERVAL=2') ? 14 : 7;
    let currentDate = new Date(originalStart);

    // Fast-forward to just before viewStart
    if (currentDate < viewStart) {
      const weeksDiff = Math.floor((viewStart.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
      currentDate.setDate(currentDate.getDate() + weeksDiff * interval);
    }

    while (currentDate <= viewEnd && (!untilDate || currentDate <= untilDate)) {
      if (currentDate >= viewStart && currentDate > originalStart && !isDateExcluded(currentDate)) {
        virtualEvents.push({
          ...baseEvent,
          id: `${baseEvent.id}-virtual-${currentDate.getTime()}`,
          start: currentDate.toISOString(),
          end: new Date(currentDate.getTime() + duration).toISOString(),
          isVirtual: true,
          parentId: baseEvent.id
        });
      }
      currentDate.setDate(currentDate.getDate() + interval);
    }
  } else if (rrule.includes('FREQ=MONTHLY')) {
    let currentDate = new Date(originalStart);
    const dayOfMonth = originalStart.getDate();

    // Fast-forward to just before viewStart
    if (currentDate < viewStart) {
      const monthsDiff = (viewStart.getFullYear() - currentDate.getFullYear()) * 12 +
                        (viewStart.getMonth() - currentDate.getMonth());
      if (monthsDiff > 0) {
        currentDate.setMonth(currentDate.getMonth() + monthsDiff - 1);
      }
    }

    while (currentDate <= viewEnd && (!untilDate || currentDate <= untilDate)) {
      if (currentDate >= viewStart && currentDate > originalStart) {
        // Handle end-of-month edge cases
        const tempDate = new Date(currentDate);
        tempDate.setDate(dayOfMonth);

        // If the day doesn't exist in this month (e.g., Jan 31 -> Feb 31), skip
        if (tempDate.getDate() === dayOfMonth && !isDateExcluded(tempDate)) {
          virtualEvents.push({
            ...baseEvent,
            id: `${baseEvent.id}-virtual-${tempDate.getTime()}`,
            start: tempDate.toISOString(),
            end: new Date(tempDate.getTime() + duration).toISOString(),
            isVirtual: true,
            parentId: baseEvent.id
          });
        }
      }
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
  } else if (rrule.includes('FREQ=YEARLY')) {
    let currentDate = new Date(originalStart);

    // Fast-forward to just before viewStart
    if (currentDate < viewStart) {
      const yearsDiff = viewStart.getFullYear() - currentDate.getFullYear();
      if (yearsDiff > 0) {
        currentDate.setFullYear(currentDate.getFullYear() + yearsDiff - 1);
      }
    }

    while (currentDate <= viewEnd && (!untilDate || currentDate <= untilDate)) {
      if (currentDate >= viewStart && currentDate > originalStart && !isDateExcluded(currentDate)) {
        virtualEvents.push({
          ...baseEvent,
          id: `${baseEvent.id}-virtual-${currentDate.getTime()}`,
          start: currentDate.toISOString(),
          end: new Date(currentDate.getTime() + duration).toISOString(),
          isVirtual: true,
          parentId: baseEvent.id
        });
      }
      currentDate.setFullYear(currentDate.getFullYear() + 1);
    }
  }

  return virtualEvents;
}

/**
 * Get all events including virtual recurring events for a given view range
 */
export function getEventsWithVirtual(
  events: CalendarEvent[],
  viewStart: Date,
  viewEnd: Date
): CalendarEvent[] {
  // Early return for empty events
  if (events.length === 0) return [];

  const allEvents: CalendarEvent[] = [];
  const processedBaseEvents = new Set<string>();
  const addedEventKeys = new Set<string>();

  // Pre-calculate timestamps for faster comparisons
  const viewStartTime = viewStart.getTime();
  const viewEndTime = viewEnd.getTime();

  for (const event of events) {
    // Skip virtual events - they should never be used to generate more virtual events
    if (event.isVirtual) {
      continue;
    }

    // Add regular events
    if (!event.recurrence || event.recurrence === 'none') {
      const eventStartTime = new Date(event.start).getTime();
      if (eventStartTime >= viewStartTime && eventStartTime <= viewEndTime) {
        if (!addedEventKeys.has(event.id)) {
          allEvents.push(event);
          addedEventKeys.add(event.id);
        }
      }
    }
    // For recurring events, only process base events once
    else if (!processedBaseEvents.has(event.id)) {
      processedBaseEvents.add(event.id);

      // Check if the base event should be displayed (not excluded)
      const eventStart = new Date(event.start);
      const eventStartTime = eventStart.getTime();
      if (eventStartTime >= viewStartTime && eventStartTime <= viewEndTime) {
        // Check if the base event's date is in the excludedDates

        const isBaseEventExcluded = event.excludedDates?.some(excluded => {
          const excludedDate = new Date(excluded).toISOString().split('T')[0];
          const baseEventDate = eventStart.toISOString().split('T')[0];
          return excludedDate === baseEventDate;
        }) || false;

        // Add the base event to results ONLY if it's not excluded
        // If excluded, we skip adding it but still generate virtual events
        if (!addedEventKeys.has(event.id) && !isBaseEventExcluded) {
          allEvents.push(event);
          addedEventKeys.add(event.id);
        }
      }

      // Generate virtual events
      const virtualEvents = generateVirtualEvents(event, viewStart, viewEnd);
      for (const virtualEvent of virtualEvents) {
        // Ensure we don't add duplicate virtual events
        if (!addedEventKeys.has(virtualEvent.id)) {
          allEvents.push(virtualEvent);
          addedEventKeys.add(virtualEvent.id);
        }
      }
    }
  }

  return allEvents;
}