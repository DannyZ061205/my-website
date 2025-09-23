import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteRecurringModal } from '../DeleteRecurringModal';
import { CalendarEvent } from '@/types';

// Mock createPortal to render content directly
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (children: React.ReactNode) => children,
}));

describe('DeleteRecurringModal', () => {
  const mockEvent: CalendarEvent = {
    id: 'recurring-event-1',
    title: 'Daily Standup',
    start: '2024-01-01T09:00:00.000Z',
    end: '2024-01-01T09:30:00.000Z',
    timezone: 'UTC',
    recurrence: 'FREQ=DAILY',
    color: 'blue'
  };

  const mockOnClose = jest.fn();
  const mockOnDelete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock document.body for portal rendering
    document.body.innerHTML = '';
  });

  afterEach(() => {
    // Clean up any portals
    document.body.innerHTML = '';
  });

  describe('Modal Rendering', () => {
    it('should render modal with event title', async () => {
      render(
        <DeleteRecurringModal
          event={mockEvent}
          onClose={mockOnClose}
          onDelete={mockOnDelete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Delete repeat event "Daily Standup"')).toBeInTheDocument();
      });

      expect(screen.getByText('This is a recurring event. Choose which occurrences to delete.')).toBeInTheDocument();
    });

    it('should render all three delete options', async () => {
      render(
        <DeleteRecurringModal
          event={mockEvent}
          onClose={mockOnClose}
          onDelete={mockOnDelete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('This event')).toBeInTheDocument();
      });

      expect(screen.getByText('This and following events')).toBeInTheDocument();
      expect(screen.getByText('All events')).toBeInTheDocument();
    });

    it('should render option descriptions', async () => {
      render(
        <DeleteRecurringModal
          event={mockEvent}
          onClose={mockOnClose}
          onDelete={mockOnDelete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Only this occurrence will be deleted')).toBeInTheDocument();
      });

      expect(screen.getByText('This and all future occurrences will be deleted')).toBeInTheDocument();
      expect(screen.getByText('All occurrences will be deleted')).toBeInTheDocument();
    });

    it('should render cancel button', async () => {
      render(
        <DeleteRecurringModal
          event={mockEvent}
          onClose={mockOnClose}
          onDelete={mockOnDelete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });
    });

    it('should render backdrop overlay', async () => {
      render(
        <DeleteRecurringModal
          event={mockEvent}
          onClose={mockOnClose}
          onDelete={mockOnDelete}
        />
      );

      await waitFor(() => {
        const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/50');
        expect(backdrop).toBeInTheDocument();
      });
    });
  });

  describe('User Interactions', () => {
    it('should call onDelete with "single" when "This event" is clicked', async () => {
      const user = userEvent.setup();

      render(
        <DeleteRecurringModal
          event={mockEvent}
          onClose={mockOnClose}
          onDelete={mockOnDelete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('This event')).toBeInTheDocument();
      });

      await user.click(screen.getByText('This event'));

      expect(mockOnDelete).toHaveBeenCalledWith('single');
      expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });

    it('should call onDelete with "following" when "This and following events" is clicked', async () => {
      const user = userEvent.setup();

      render(
        <DeleteRecurringModal
          event={mockEvent}
          onClose={mockOnClose}
          onDelete={mockOnDelete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('This and following events')).toBeInTheDocument();
      });

      await user.click(screen.getByText('This and following events'));

      expect(mockOnDelete).toHaveBeenCalledWith('following');
      expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });

    it('should call onDelete with "all" when "All events" is clicked', async () => {
      const user = userEvent.setup();

      render(
        <DeleteRecurringModal
          event={mockEvent}
          onClose={mockOnClose}
          onDelete={mockOnDelete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('All events')).toBeInTheDocument();
      });

      await user.click(screen.getByText('All events'));

      expect(mockOnDelete).toHaveBeenCalledWith('all');
      expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when cancel button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <DeleteRecurringModal
          event={mockEvent}
          onClose={mockOnClose}
          onDelete={mockOnDelete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Cancel'));

      expect(mockOnClose).toHaveBeenCalledTimes(1);
      expect(mockOnDelete).not.toHaveBeenCalled();
    });

    it('should call onClose when backdrop is clicked', async () => {
      render(
        <DeleteRecurringModal
          event={mockEvent}
          onClose={mockOnClose}
          onDelete={mockOnDelete}
        />
      );

      await waitFor(() => {
        const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/50');
        expect(backdrop).toBeInTheDocument();
        fireEvent.click(backdrop as Element);
      });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
      expect(mockOnDelete).not.toHaveBeenCalled();
    });
  });

  describe('Modal State Management', () => {
    it('should not render initially and then mount after timeout', async () => {
      const { container } = render(
        <DeleteRecurringModal
          event={mockEvent}
          onClose={mockOnClose}
          onDelete={mockOnDelete}
        />
      );

      // Initially should be empty
      expect(container.firstChild).toBeNull();

      // After mount delay, should render
      await waitFor(() => {
        expect(screen.getByText('Delete repeat event "Daily Standup"')).toBeInTheDocument();
      });
    });

    it('should handle different event titles correctly', async () => {
      const eventWithLongTitle: CalendarEvent = {
        ...mockEvent,
        title: 'Very Long Event Title That Might Cause Issues'
      };

      render(
        <DeleteRecurringModal
          event={eventWithLongTitle}
          onClose={mockOnClose}
          onDelete={mockOnDelete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Delete repeat event "Very Long Event Title That Might Cause Issues"')).toBeInTheDocument();
      });
    });

    it('should handle event titles with special characters', async () => {
      const eventWithSpecialChars: CalendarEvent = {
        ...mockEvent,
        title: 'Event with "quotes" & special <characters>'
      };

      render(
        <DeleteRecurringModal
          event={eventWithSpecialChars}
          onClose={mockOnClose}
          onDelete={mockOnDelete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Delete repeat event "Event with "quotes" & special <characters>""')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper modal structure for screen readers', async () => {
      render(
        <DeleteRecurringModal
          event={mockEvent}
          onClose={mockOnClose}
          onDelete={mockOnDelete}
        />
      );

      await waitFor(() => {
        const heading = screen.getByRole('heading', { level: 2 });
        expect(heading).toHaveTextContent('Delete repeat event "Daily Standup"');
      });
    });

    it('should have clickable buttons with proper text', async () => {
      render(
        <DeleteRecurringModal
          event={mockEvent}
          onClose={mockOnClose}
          onDelete={mockOnDelete}
        />
      );

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(4); // 3 delete options + cancel
      });

      const thisEventButton = screen.getByRole('button', { name: /this event/i });
      const followingButton = screen.getByRole('button', { name: /this and following events/i });
      const allEventsButton = screen.getByRole('button', { name: /all events/i });
      const cancelButton = screen.getByRole('button', { name: /cancel/i });

      expect(thisEventButton).toBeInTheDocument();
      expect(followingButton).toBeInTheDocument();
      expect(allEventsButton).toBeInTheDocument();
      expect(cancelButton).toBeInTheDocument();
    });

    it('should have proper focus management', async () => {
      const user = userEvent.setup();

      render(
        <DeleteRecurringModal
          event={mockEvent}
          onClose={mockOnClose}
          onDelete={mockOnDelete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('This event')).toBeInTheDocument();
      });

      // Test tab navigation
      await user.tab();
      expect(screen.getByRole('button', { name: /this event/i })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('button', { name: /this and following events/i })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('button', { name: /all events/i })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('button', { name: /cancel/i })).toHaveFocus();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should close modal on Escape key', async () => {
      const user = userEvent.setup();

      render(
        <DeleteRecurringModal
          event={mockEvent}
          onClose={mockOnClose}
          onDelete={mockOnDelete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('This event')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should activate buttons with Enter key', async () => {
      const user = userEvent.setup();

      render(
        <DeleteRecurringModal
          event={mockEvent}
          onClose={mockOnClose}
          onDelete={mockOnDelete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('This event')).toBeInTheDocument();
      });

      await user.tab(); // Focus first button
      await user.keyboard('{Enter}');

      expect(mockOnDelete).toHaveBeenCalledWith('single');
    });

    it('should activate buttons with Space key', async () => {
      const user = userEvent.setup();

      render(
        <DeleteRecurringModal
          event={mockEvent}
          onClose={mockOnClose}
          onDelete={mockOnDelete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('This and following events')).toBeInTheDocument();
      });

      await user.tab(); // Focus first button
      await user.tab(); // Focus second button
      await user.keyboard(' '); // Space key

      expect(mockOnDelete).toHaveBeenCalledWith('following');
    });
  });

  describe('Visual Styling', () => {
    it('should apply correct hover states to buttons', async () => {
      const user = userEvent.setup();

      render(
        <DeleteRecurringModal
          event={mockEvent}
          onClose={mockOnClose}
          onDelete={mockOnDelete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('This event')).toBeInTheDocument();
      });

      const thisEventButton = screen.getByRole('button', { name: /this event/i });

      await user.hover(thisEventButton);

      expect(thisEventButton).toHaveClass('hover:bg-gray-50');
    });

    it('should apply special styling to "All events" delete option', async () => {
      render(
        <DeleteRecurringModal
          event={mockEvent}
          onClose={mockOnClose}
          onDelete={mockOnDelete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('All events')).toBeInTheDocument();
      });

      const allEventsButton = screen.getByRole('button', { name: /all events/i });
      expect(allEventsButton).toHaveClass('hover:bg-red-50');

      const allEventsText = screen.getByText('All events');
      expect(allEventsText).toHaveClass('text-red-600');
    });

    it('should have proper modal positioning and backdrop styling', async () => {
      render(
        <DeleteRecurringModal
          event={mockEvent}
          onClose={mockOnClose}
          onDelete={mockOnDelete}
        />
      );

      await waitFor(() => {
        const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/50');
        expect(backdrop).toBeInTheDocument();
        expect(backdrop).toHaveClass('z-[100]');
      });

      const modal = document.querySelector('.fixed.z-\\[101\\]');
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveStyle({
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      });
    });
  });
});