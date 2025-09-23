import { generateVirtualEvents, getEventsWithVirtual } from '../recurrence';
import { CalendarEvent } from '@/types';

describe('Recurrence Utils', () => {
  // Helper function to create a base event
  const createBaseEvent = (
    id: string = 'test-event-1',
    start: string = '2024-01-01T10:00:00.000Z',
    end: string = '2024-01-01T11:00:00.000Z',
    recurrence: string = 'FREQ=DAILY'
  ): CalendarEvent => ({
    id,
    title: 'Test Event',
    start,
    end,
    timezone: 'UTC',
    recurrence,
    color: 'blue'
  });

  describe('generateVirtualEvents', () => {
    describe('Daily Recurrence', () => {
      it('should generate daily virtual events for the view range', () => {
        const baseEvent = createBaseEvent('daily-1', '2024-01-01T10:00:00.000Z', '2024-01-01T11:00:00.000Z', 'FREQ=DAILY');
        const viewStart = new Date('2024-01-02');
        const viewEnd = new Date('2024-01-05');

        const virtualEvents = generateVirtualEvents(baseEvent, viewStart, viewEnd);

        expect(virtualEvents).toHaveLength(3);

        // Check that events are generated for Jan 2, 3, 4
        const expectedDates = ['2024-01-02', '2024-01-03', '2024-01-04'];
        expectedDates.forEach((date, index) => {
          expect(virtualEvents[index].start).toMatch(new RegExp(`${date}T10:00:00`));
          expect(virtualEvents[index].end).toMatch(new RegExp(`${date}T11:00:00`));
          expect(virtualEvents[index].isVirtual).toBe(true);
          expect(virtualEvents[index].parentId).toBe('daily-1');
          expect(virtualEvents[index].id).toMatch(/daily-1-virtual-\d+/);
        });
      });

      it('should respect weekday constraints (BYDAY=MO,TU,WE,TH,FR)', () => {
        const baseEvent = createBaseEvent('weekday-1', '2024-01-01T10:00:00.000Z', '2024-01-01T11:00:00.000Z', 'FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR');
        const viewStart = new Date('2024-01-02');
        const viewEnd = new Date('2024-01-08'); // Includes weekend

        const virtualEvents = generateVirtualEvents(baseEvent, viewStart, viewEnd);

        // Should only include weekdays (Jan 2, 3, 4, 5, 8 - excluding weekend Jan 6, 7)
        expect(virtualEvents).toHaveLength(4);

        virtualEvents.forEach(event => {
          const eventDate = new Date(event.start);
          const dayOfWeek = eventDate.getDay();
          expect(dayOfWeek).toBeGreaterThanOrEqual(1); // Monday
          expect(dayOfWeek).toBeLessThanOrEqual(5); // Friday
        });
      });

      it('should respect weekend constraints (BYDAY=SA,SU)', () => {
        const baseEvent = createBaseEvent('weekend-1', '2024-01-01T10:00:00.000Z', '2024-01-01T11:00:00.000Z', 'FREQ=DAILY;BYDAY=SA,SU');
        const viewStart = new Date('2024-01-02');
        const viewEnd = new Date('2024-01-08');

        const virtualEvents = generateVirtualEvents(baseEvent, viewStart, viewEnd);

        // Should only include weekend days (Jan 6, 7)
        expect(virtualEvents).toHaveLength(2);

        virtualEvents.forEach(event => {
          const eventDate = new Date(event.start);
          const dayOfWeek = eventDate.getDay();
          expect([0, 6]).toContain(dayOfWeek); // Sunday or Saturday
        });
      });

      it('should not generate events before the original event date', () => {
        const baseEvent = createBaseEvent('future-1', '2024-01-05T10:00:00.000Z', '2024-01-05T11:00:00.000Z', 'FREQ=DAILY');
        const viewStart = new Date('2024-01-01');
        const viewEnd = new Date('2024-01-07');

        const virtualEvents = generateVirtualEvents(baseEvent, viewStart, viewEnd);

        // Should only generate for Jan 6, 7 (after the original Jan 5 event)
        expect(virtualEvents).toHaveLength(2);
        expect(virtualEvents[0].start).toMatch(/2024-01-06T10:00:00/);
        expect(virtualEvents[1].start).toMatch(/2024-01-07T10:00:00/);
      });
    });

    describe('Weekly Recurrence', () => {
      it('should generate weekly virtual events', () => {
        const baseEvent = createBaseEvent('weekly-1', '2024-01-01T10:00:00.000Z', '2024-01-01T11:00:00.000Z', 'FREQ=WEEKLY');
        const viewStart = new Date('2024-01-02');
        const viewEnd = new Date('2024-01-22');

        const virtualEvents = generateVirtualEvents(baseEvent, viewStart, viewEnd);

        // Should generate for Jan 8, 15, 22 (weekly intervals)
        expect(virtualEvents).toHaveLength(3);

        const expectedDates = ['2024-01-08', '2024-01-15', '2024-01-22'];
        expectedDates.forEach((date, index) => {
          expect(virtualEvents[index].start).toMatch(new RegExp(`${date}T10:00:00`));
        });
      });

      it('should handle bi-weekly intervals (INTERVAL=2)', () => {
        const baseEvent = createBaseEvent('biweekly-1', '2024-01-01T10:00:00.000Z', '2024-01-01T11:00:00.000Z', 'FREQ=WEEKLY;INTERVAL=2');
        const viewStart = new Date('2024-01-02');
        const viewEnd = new Date('2024-01-29');

        const virtualEvents = generateVirtualEvents(baseEvent, viewStart, viewEnd);

        // Should generate for Jan 15, 29 (bi-weekly intervals)
        expect(virtualEvents).toHaveLength(2);
        expect(virtualEvents[0].start).toMatch(/2024-01-15T10:00:00/);
        expect(virtualEvents[1].start).toMatch(/2024-01-29T10:00:00/);
      });
    });

    describe('Monthly Recurrence', () => {
      it('should generate monthly virtual events', () => {
        const baseEvent = createBaseEvent('monthly-1', '2024-01-15T10:00:00.000Z', '2024-01-15T11:00:00.000Z', 'FREQ=MONTHLY');
        const viewStart = new Date('2024-01-16');
        const viewEnd = new Date('2024-04-20');

        const virtualEvents = generateVirtualEvents(baseEvent, viewStart, viewEnd);

        // Should generate for Feb 15, Mar 15, Apr 15
        expect(virtualEvents).toHaveLength(3);

        const expectedDates = ['2024-02-15', '2024-03-15', '2024-04-15'];
        expectedDates.forEach((date, index) => {
          expect(virtualEvents[index].start).toMatch(new RegExp(`${date}T10:00:00`));
        });
      });

      it('should handle end-of-month edge cases correctly', () => {
        const baseEvent = createBaseEvent('monthly-31', '2024-01-31T10:00:00.000Z', '2024-01-31T11:00:00.000Z', 'FREQ=MONTHLY');
        const viewStart = new Date('2024-02-01');
        const viewEnd = new Date('2024-05-01');

        const virtualEvents = generateVirtualEvents(baseEvent, viewStart, viewEnd);

        // Should skip February (no 31st), include March 31
        expect(virtualEvents).toHaveLength(2);
        expect(virtualEvents[0].start).toMatch(/2024-03-31T10:00:00/);
        expect(virtualEvents[1].start).toMatch(/2024-05-31T10:00:00/); // May has 31 days
      });
    });

    describe('Yearly Recurrence', () => {
      it('should generate yearly virtual events', () => {
        const baseEvent = createBaseEvent('yearly-1', '2024-01-15T10:00:00.000Z', '2024-01-15T11:00:00.000Z', 'FREQ=YEARLY');
        const viewStart = new Date('2024-01-16');
        const viewEnd = new Date('2026-02-01');

        const virtualEvents = generateVirtualEvents(baseEvent, viewStart, viewEnd);

        // Should generate for 2025-01-15, 2026-01-15
        expect(virtualEvents).toHaveLength(2);
        expect(virtualEvents[0].start).toMatch(/2025-01-15T10:00:00/);
        expect(virtualEvents[1].start).toMatch(/2026-01-15T10:00:00/);
      });
    });

    describe('No Recurrence', () => {
      it('should return empty array for non-recurring events', () => {
        const baseEvent = createBaseEvent('no-recur', '2024-01-01T10:00:00.000Z', '2024-01-01T11:00:00.000Z', 'none');
        const viewStart = new Date('2024-01-02');
        const viewEnd = new Date('2024-01-05');

        const virtualEvents = generateVirtualEvents(baseEvent, viewStart, viewEnd);

        expect(virtualEvents).toHaveLength(0);
      });

      it('should return empty array when recurrence is undefined', () => {
        const baseEvent = createBaseEvent('no-recur-2', '2024-01-01T10:00:00.000Z', '2024-01-01T11:00:00.000Z');
        delete baseEvent.recurrence;
        const viewStart = new Date('2024-01-02');
        const viewEnd = new Date('2024-01-05');

        const virtualEvents = generateVirtualEvents(baseEvent, viewStart, viewEnd);

        expect(virtualEvents).toHaveLength(0);
      });
    });

    describe('Event Duration Preservation', () => {
      it('should preserve event duration across virtual events', () => {
        const baseEvent = createBaseEvent('duration-test', '2024-01-01T10:00:00.000Z', '2024-01-01T12:30:00.000Z', 'FREQ=DAILY');
        const viewStart = new Date('2024-01-02');
        const viewEnd = new Date('2024-01-04');

        const virtualEvents = generateVirtualEvents(baseEvent, viewStart, viewEnd);

        virtualEvents.forEach(event => {
          const start = new Date(event.start);
          const end = new Date(event.end);
          const duration = end.getTime() - start.getTime();

          // Duration should be 2.5 hours (150 minutes)
          expect(duration).toBe(150 * 60 * 1000);
        });
      });
    });
  });

  describe('getEventsWithVirtual', () => {
    it('should combine regular and virtual events correctly', () => {
      const regularEvent = createBaseEvent('regular-1', '2024-01-03T10:00:00.000Z', '2024-01-03T11:00:00.000Z', 'none');
      const recurringEvent = createBaseEvent('recurring-1', '2024-01-01T14:00:00.000Z', '2024-01-01T15:00:00.000Z', 'FREQ=DAILY');

      const events = [regularEvent, recurringEvent];
      const viewStart = new Date('2024-01-01');
      const viewEnd = new Date('2024-01-05');

      const allEvents = getEventsWithVirtual(events, viewStart, viewEnd);

      // Should include: regular event + base recurring event + 4 virtual events (Jan 2-5)
      expect(allEvents).toHaveLength(6);

      // Check regular event is included
      expect(allEvents.some(e => e.id === 'regular-1')).toBe(true);

      // Check base recurring event is included
      expect(allEvents.some(e => e.id === 'recurring-1' && !e.isVirtual)).toBe(true);

      // Check virtual events are generated
      const virtualEvents = allEvents.filter(e => e.isVirtual);
      expect(virtualEvents).toHaveLength(4);
    });

    it('should filter out virtual events from input to prevent double generation', () => {
      const baseEvent = createBaseEvent('base-1', '2024-01-01T10:00:00.000Z', '2024-01-01T11:00:00.000Z', 'FREQ=DAILY');
      const virtualEvent: CalendarEvent = {
        ...baseEvent,
        id: 'base-1-virtual-123',
        start: '2024-01-02T10:00:00.000Z',
        end: '2024-01-02T11:00:00.000Z',
        isVirtual: true,
        parentId: 'base-1'
      };

      const events = [baseEvent, virtualEvent];
      const viewStart = new Date('2024-01-01');
      const viewEnd = new Date('2024-01-03');

      const allEvents = getEventsWithVirtual(events, viewStart, viewEnd);

      // Should include base event + 2 virtual events (not the input virtual event)
      expect(allEvents).toHaveLength(3);
      expect(allEvents.filter(e => e.isVirtual)).toHaveLength(2);
      expect(allEvents.some(e => e.id === 'base-1-virtual-123')).toBe(false);
    });

    it('should prevent duplicate events with same ID', () => {
      const event1 = createBaseEvent('dup-1', '2024-01-01T10:00:00.000Z', '2024-01-01T11:00:00.000Z', 'none');
      const event2 = createBaseEvent('dup-1', '2024-01-02T10:00:00.000Z', '2024-01-02T11:00:00.000Z', 'none'); // Same ID

      const events = [event1, event2];
      const viewStart = new Date('2024-01-01');
      const viewEnd = new Date('2024-01-03');

      const allEvents = getEventsWithVirtual(events, viewStart, viewEnd);

      // Should only include one event with ID 'dup-1'
      expect(allEvents).toHaveLength(1);
      expect(allEvents[0].id).toBe('dup-1');
    });

    it('should only process each base recurring event once', () => {
      const recurringEvent = createBaseEvent('recurring-1', '2024-01-01T10:00:00.000Z', '2024-01-01T11:00:00.000Z', 'FREQ=DAILY');
      const duplicateEvent = { ...recurringEvent }; // Same event, different object

      const events = [recurringEvent, duplicateEvent];
      const viewStart = new Date('2024-01-01');
      const viewEnd = new Date('2024-01-03');

      const allEvents = getEventsWithVirtual(events, viewStart, viewEnd);

      // Should include base event + 2 virtual events (not duplicate virtual events)
      expect(allEvents).toHaveLength(3);
      expect(allEvents.filter(e => e.isVirtual)).toHaveLength(2);
    });

    it('should handle empty event array', () => {
      const events: CalendarEvent[] = [];
      const viewStart = new Date('2024-01-01');
      const viewEnd = new Date('2024-01-03');

      const allEvents = getEventsWithVirtual(events, viewStart, viewEnd);

      expect(allEvents).toHaveLength(0);
    });

    it('should filter events outside view range correctly', () => {
      const event1 = createBaseEvent('outside-1', '2023-12-31T10:00:00.000Z', '2023-12-31T11:00:00.000Z', 'none');
      const event2 = createBaseEvent('inside-1', '2024-01-02T10:00:00.000Z', '2024-01-02T11:00:00.000Z', 'none');
      const event3 = createBaseEvent('outside-2', '2024-01-05T10:00:00.000Z', '2024-01-05T11:00:00.000Z', 'none');

      const events = [event1, event2, event3];
      const viewStart = new Date('2024-01-01');
      const viewEnd = new Date('2024-01-03');

      const allEvents = getEventsWithVirtual(events, viewStart, viewEnd);

      // Should only include event2 which is in range
      expect(allEvents).toHaveLength(1);
      expect(allEvents[0].id).toBe('inside-1');
    });
  });

  describe('Performance Tests', () => {
    it('should handle large date ranges efficiently', () => {
      const baseEvent = createBaseEvent('perf-test', '2024-01-01T10:00:00.000Z', '2024-01-01T11:00:00.000Z', 'FREQ=DAILY');
      const viewStart = new Date('2024-01-02');
      const viewEnd = new Date('2024-12-31'); // Almost a full year

      const startTime = performance.now();
      const virtualEvents = generateVirtualEvents(baseEvent, viewStart, viewEnd);
      const endTime = performance.now();

      // Should complete in reasonable time (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100);

      // Should generate correct number of events (364 days)
      expect(virtualEvents).toHaveLength(364);
    });

    it('should handle many recurring events efficiently', () => {
      const events: CalendarEvent[] = [];

      // Create 100 different recurring events
      for (let i = 0; i < 100; i++) {
        events.push(createBaseEvent(`recurring-${i}`, '2024-01-01T10:00:00.000Z', '2024-01-01T11:00:00.000Z', 'FREQ=DAILY'));
      }

      const viewStart = new Date('2024-01-02');
      const viewEnd = new Date('2024-01-08'); // 1 week

      const startTime = performance.now();
      const allEvents = getEventsWithVirtual(events, viewStart, viewEnd);
      const endTime = performance.now();

      // Should complete in reasonable time (less than 500ms)
      expect(endTime - startTime).toBeLessThan(500);

      // Should generate correct number of events (100 base + 100*7 virtual)
      expect(allEvents).toHaveLength(800);
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid recurrence rules gracefully', () => {
      const baseEvent = createBaseEvent('invalid-1', '2024-01-01T10:00:00.000Z', '2024-01-01T11:00:00.000Z', 'INVALID_RULE');
      const viewStart = new Date('2024-01-02');
      const viewEnd = new Date('2024-01-05');

      const virtualEvents = generateVirtualEvents(baseEvent, viewStart, viewEnd);

      // Should return empty array for unrecognized rules
      expect(virtualEvents).toHaveLength(0);
    });

    it('should handle events with very short durations', () => {
      const baseEvent = createBaseEvent('short-1', '2024-01-01T10:00:00.000Z', '2024-01-01T10:00:01.000Z', 'FREQ=DAILY');
      const viewStart = new Date('2024-01-02');
      const viewEnd = new Date('2024-01-03');

      const virtualEvents = generateVirtualEvents(baseEvent, viewStart, viewEnd);

      expect(virtualEvents).toHaveLength(2);
      virtualEvents.forEach(event => {
        const start = new Date(event.start);
        const end = new Date(event.end);
        expect(end.getTime() - start.getTime()).toBe(1000); // 1 second
      });
    });

    it('should handle events spanning multiple days', () => {
      const baseEvent = createBaseEvent('multiday-1', '2024-01-01T22:00:00.000Z', '2024-01-02T02:00:00.000Z', 'FREQ=DAILY');
      const viewStart = new Date('2024-01-02');
      const viewEnd = new Date('2024-01-04');

      const virtualEvents = generateVirtualEvents(baseEvent, viewStart, viewEnd);

      expect(virtualEvents).toHaveLength(3);

      // First virtual event: Jan 2 22:00 - Jan 3 02:00
      expect(virtualEvents[0].start).toMatch(/2024-01-02T22:00:00/);
      expect(virtualEvents[0].end).toMatch(/2024-01-03T02:00:00/);
    });
  });
});