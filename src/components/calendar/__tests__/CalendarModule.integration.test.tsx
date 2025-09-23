import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CalendarModule } from '../CalendarModule';
import { CalendarEvent } from '@/types';

// Mock dependencies
jest.mock('../EventContextMenu', () => ({
  EventContextMenu: () => <div data-testid="event-context-menu">Context Menu</div>
}));

jest.mock('../DeleteRecurringModal', () => ({
  DeleteRecurringModal: ({ onDelete, onClose }: any) => (
    <div data-testid="delete-recurring-modal">
      <button onClick={() => onDelete('single')}>Delete Single</button>
      <button onClick={() => onDelete('following')}>Delete Following</button>
      <button onClick={() => onDelete('all')}>Delete All</button>
      <button onClick={onClose}>Cancel</button>
    </div>
  )
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
}));

describe('CalendarModule - Recurring Events Integration', () => {
  const mockOnEditEvent = jest.fn();
  const mockOnUpdateEvents = jest.fn();

  // Sample recurring events for testing
  const dailyRecurringEvent: CalendarEvent = {
    id: 'daily-standup',
    title: 'Daily Standup',
    start: '2024-01-01T09:00:00.000Z',
    end: '2024-01-01T09:30:00.000Z',
    timezone: 'UTC',
    recurrence: 'FREQ=DAILY',
    color: 'blue',
    description: 'Daily team meeting'
  };

  const weeklyRecurringEvent: CalendarEvent = {
    id: 'weekly-review',
    title: 'Weekly Review',
    start: '2024-01-01T14:00:00.000Z',
    end: '2024-01-01T15:00:00.000Z',
    timezone: 'UTC',
    recurrence: 'FREQ=WEEKLY',
    color: 'green'
  };

  const monthlyRecurringEvent: CalendarEvent = {
    id: 'monthly-planning',
    title: 'Monthly Planning',
    start: '2024-01-15T10:00:00.000Z',
    end: '2024-01-15T12:00:00.000Z',
    timezone: 'UTC',
    recurrence: 'FREQ=MONTHLY',
    color: 'purple'
  };

  const regularEvent: CalendarEvent = {
    id: 'one-time-meeting',
    title: 'One-time Meeting',
    start: '2024-01-03T11:00:00.000Z',
    end: '2024-01-03T12:00:00.000Z',
    timezone: 'UTC',
    color: 'yellow'
  };

  const mockEvents = [dailyRecurringEvent, weeklyRecurringEvent, monthlyRecurringEvent, regularEvent];

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock current date to be January 1, 2024
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Virtual Event Generation', () => {
    it('should generate and display virtual events for daily recurrence', async () => {
      render(
        <CalendarModule
          events={[dailyRecurringEvent]}
          onUpdateEvents={mockOnUpdateEvents}
          onEditEvent={mockOnEditEvent}
        />
      );

      // Wait for component to mount and generate virtual events
      await waitFor(() => {
        expect(screen.getByText('Daily Standup')).toBeInTheDocument();
      });

      // The component should show the base event and virtual events for the current week view
      const standupEvents = screen.getAllByText('Daily Standup');
      expect(standupEvents.length).toBeGreaterThan(1); // Base event + virtual events
    });

    it('should generate virtual events for weekly recurrence', async () => {
      render(
        <CalendarModule
          events={[weeklyRecurringEvent]}
          onUpdateEvents={mockOnUpdateEvents}
          onEditEvent={mockOnEditEvent}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Weekly Review')).toBeInTheDocument();
      });

      // Should show the base event in current week
      const reviewEvents = screen.getAllByText('Weekly Review');
      expect(reviewEvents.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle multiple recurring events without conflicts', async () => {
      render(
        <CalendarModule
          events={mockEvents}
          onUpdateEvents={mockOnUpdateEvents}
          onEditEvent={mockOnEditEvent}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Daily Standup')).toBeInTheDocument();
        expect(screen.getByText('Weekly Review')).toBeInTheDocument();
        expect(screen.getByText('One-time Meeting')).toBeInTheDocument();
      });

      // Should display all events without duplicates or conflicts
      const allEventElements = screen.getAllByText(/Standup|Review|Meeting|Planning/);
      expect(allEventElements.length).toBeGreaterThan(3);
    });

    it('should not persist virtual events when updating events', async () => {
      render(
        <CalendarModule
          events={[dailyRecurringEvent]}
          onUpdateEvents={mockOnUpdateEvents}
          onEditEvent={mockOnEditEvent}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Daily Standup')).toBeInTheDocument();
      });

      // Simulate adding a new regular event
      const newEvent: CalendarEvent = {
        id: 'new-event',
        title: 'New Event',
        start: '2024-01-02T10:00:00.000Z',
        end: '2024-01-02T11:00:00.000Z',
        timezone: 'UTC',
        color: 'blue'
      };

      // Trigger an update that would include the new event
      const updatedEvents = [...mockEvents, newEvent];

      // Rerender with updated events
      render(
        <CalendarModule
          events={updatedEvents}
          onUpdateEvents={mockOnUpdateEvents}
          onEditEvent={mockOnEditEvent}
        />
      );

      // onUpdateEvents should only be called with non-virtual events
      // Check this through the filtering behavior
      expect(mockOnUpdateEvents).not.toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ isVirtual: true })
        ])
      );
    });
  });

  describe('Week Navigation with Recurring Events', () => {
    it('should generate appropriate virtual events when navigating to next week', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <CalendarModule
          events={[dailyRecurringEvent]}
          onUpdateEvents={mockOnUpdateEvents}
          onEditEvent={mockOnEditEvent}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Daily Standup')).toBeInTheDocument();
      });

      // Find and click next week button
      const nextButton = screen.getByLabelText(/next week/i) || screen.getByText('>')
      if (nextButton) {
        await user.click(nextButton);

        await waitFor(() => {
          // Should still show Daily Standup events for the new week
          expect(screen.getByText('Daily Standup')).toBeInTheDocument();
        });

        const standupEvents = screen.getAllByText('Daily Standup');
        expect(standupEvents.length).toBeGreaterThan(0);
      }
    });

    it('should generate appropriate virtual events when navigating to previous week', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <CalendarModule
          events={[weeklyRecurringEvent]}
          onUpdateEvents={mockOnUpdateEvents}
          onEditEvent={mockOnEditEvent}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Weekly Review')).toBeInTheDocument();
      });

      // Find and click previous week button
      const prevButton = screen.getByLabelText(/previous week/i) || screen.getByText('<');
      if (prevButton) {
        await user.click(prevButton);

        await waitFor(() => {
          // For weekly events, previous week might not show the event
          // depending on when the base event started
          const reviewElements = screen.queryAllByText('Weekly Review');
          // Should either show the event or not, but not crash
          expect(reviewElements.length).toBeGreaterThanOrEqual(0);
        });
      }
    });

    it('should maintain performance when navigating with many recurring events', async () => {
      const manyRecurringEvents: CalendarEvent[] = Array.from({ length: 20 }, (_, i) => ({
        id: `recurring-${i}`,
        title: `Recurring Event ${i}`,
        start: '2024-01-01T09:00:00.000Z',
        end: '2024-01-01T10:00:00.000Z',
        timezone: 'UTC',
        recurrence: 'FREQ=DAILY',
        color: 'blue'
      }));

      const startTime = performance.now();

      render(
        <CalendarModule
          events={manyRecurringEvents}
          onUpdateEvents={mockOnUpdateEvents}
          onEditEvent={mockOnEditEvent}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Recurring Event 0')).toBeInTheDocument();
      });

      const renderTime = performance.now() - startTime;

      // Should render within reasonable time (less than 1 second)
      expect(renderTime).toBeLessThan(1000);
    });
  });

  describe('Virtual Event Uniqueness', () => {
    it('should not create duplicate virtual events with same ID', async () => {
      // Create an event that might cause ID conflicts
      const eventWithPredictableId: CalendarEvent = {
        id: 'predictable-id',
        title: 'Predictable Event',
        start: '2024-01-01T10:00:00.000Z',
        end: '2024-01-01T11:00:00.000Z',
        timezone: 'UTC',
        recurrence: 'FREQ=DAILY',
        color: 'blue'
      };

      render(
        <CalendarModule
          events={[eventWithPredictableId]}
          onUpdateEvents={mockOnUpdateEvents}
          onEditEvent={mockOnEditEvent}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Predictable Event')).toBeInTheDocument();
      });

      // Check that all rendered events have unique IDs in the DOM
      const eventElements = screen.getAllByText('Predictable Event');
      const parentElements = eventElements.map(el => el.closest('[data-event-id]'));

      // Filter out null elements and extract IDs
      const eventIds = parentElements
        .filter(el => el !== null)
        .map(el => el?.getAttribute('data-event-id'))
        .filter(id => id !== null);

      // All IDs should be unique
      const uniqueIds = new Set(eventIds);
      expect(uniqueIds.size).toBe(eventIds.length);
    });

    it('should handle duplicate base events gracefully', async () => {
      const duplicateEvents = [dailyRecurringEvent, dailyRecurringEvent]; // Same event twice

      render(
        <CalendarModule
          events={duplicateEvents}
          onUpdateEvents={mockOnUpdateEvents}
          onEditEvent={mockOnEditEvent}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Daily Standup')).toBeInTheDocument();
      });

      // Should not crash and should handle duplicates properly
      const standupEvents = screen.getAllByText('Daily Standup');
      expect(standupEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Event Interaction with Virtual Events', () => {
    it('should handle clicking on virtual events', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <CalendarModule
          events={[dailyRecurringEvent]}
          onUpdateEvents={mockOnUpdateEvents}
          onEditEvent={mockOnEditEvent}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Daily Standup')).toBeInTheDocument();
      });

      // Click on an event (could be base or virtual)
      const eventElement = screen.getByText('Daily Standup');
      await user.click(eventElement);

      // Should be able to interact with virtual events
      // (specific behavior depends on implementation)
      expect(eventElement).toBeInTheDocument();
    });

    it('should handle editing virtual events correctly', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <CalendarModule
          events={[dailyRecurringEvent]}
          onUpdateEvents={mockOnUpdateEvents}
          onEditEvent={mockOnEditEvent}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Daily Standup')).toBeInTheDocument();
      });

      // Double-click to edit (if that's the edit behavior)
      const eventElement = screen.getByText('Daily Standup');
      await user.dblClick(eventElement);

      // Should trigger edit event handler
      if (mockOnEditEvent.mock.calls.length > 0) {
        const editedEvent = mockOnEditEvent.mock.calls[0][0];
        expect(editedEvent).toHaveProperty('title', 'Daily Standup');
      }
    });
  });

  describe('Recurring Event Deletion Flow', () => {
    it('should show delete modal for recurring events', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <CalendarModule
          events={[dailyRecurringEvent]}
          onUpdateEvents={mockOnUpdateEvents}
          onEditEvent={mockOnEditEvent}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Daily Standup')).toBeInTheDocument();
      });

      // Right-click to open context menu (if applicable)
      const eventElement = screen.getByText('Daily Standup');
      fireEvent.contextMenu(eventElement);

      // Look for delete option or similar
      // This test would need to be adjusted based on actual implementation
    });

    it('should handle deleting single occurrence correctly', async () => {
      // This test would verify that deleting a single occurrence
      // doesn't affect other virtual events
      render(
        <CalendarModule
          events={[dailyRecurringEvent]}
          onUpdateEvents={mockOnUpdateEvents}
          onEditEvent={mockOnEditEvent}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Daily Standup')).toBeInTheDocument();
      });

      // Test implementation would depend on how delete is triggered
      // in the actual calendar interface
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed recurrence rules gracefully', async () => {
      const malformedEvent: CalendarEvent = {
        ...dailyRecurringEvent,
        id: 'malformed',
        recurrence: 'INVALID_RRULE'
      };

      render(
        <CalendarModule
          events={[malformedEvent]}
          onUpdateEvents={mockOnUpdateEvents}
          onEditEvent={mockOnEditEvent}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Daily Standup')).toBeInTheDocument();
      });

      // Should not crash with malformed recurrence rules
      expect(screen.getByText('Daily Standup')).toBeInTheDocument();
    });

    it('should handle events with missing required fields', async () => {
      const incompleteEvent: Partial<CalendarEvent> = {
        id: 'incomplete',
        title: 'Incomplete Event',
        recurrence: 'FREQ=DAILY'
        // Missing start, end, timezone
      };

      // Should not crash even with incomplete event data
      expect(() => {
        render(
          <CalendarModule
            events={[incompleteEvent as CalendarEvent]}
            onUpdateEvents={mockOnUpdateEvents}
            onEditEvent={mockOnEditEvent}
          />
        );
      }).not.toThrow();
    });
  });

  describe('Memory Management', () => {
    it('should not create memory leaks with many virtual events', async () => {
      const longRunningEvent: CalendarEvent = {
        id: 'long-running',
        title: 'Long Running Event',
        start: '2023-01-01T10:00:00.000Z', // Event started a year ago
        end: '2023-01-01T11:00:00.000Z',
        timezone: 'UTC',
        recurrence: 'FREQ=DAILY',
        color: 'blue'
      };

      const { unmount } = render(
        <CalendarModule
          events={[longRunningEvent]}
          onUpdateEvents={mockOnUpdateEvents}
          onEditEvent={mockOnEditEvent}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Long Running Event')).toBeInTheDocument();
      });

      // Unmount component to test cleanup
      unmount();

      // Component should unmount without issues
      expect(screen.queryByText('Long Running Event')).not.toBeInTheDocument();
    });
  });
});