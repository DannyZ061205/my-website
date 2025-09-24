/**
 * Daily Recurrence Animation Controller
 * Professional implementation for calendar event animations
 */

class DailyRecurrenceAnimator {
  constructor(options = {}) {
    this.animationType = options.animationType || 'flow'; // 'flow', 'glow', 'cascade', 'breathe'
    this.accentColor = options.accentColor || 'blue'; // 'blue', 'emerald', 'purple'
    this.duration = options.duration || 600; // Total animation sequence duration
    this.staggerDelay = options.staggerDelay || 80; // Delay between each day
  }

  /**
   * Animate daily recurring events appearing across the week
   * @param {HTMLElement[]} eventElements - Array of event elements for each day
   * @param {Function} onComplete - Callback when animation completes
   */
  animateDailyRecurrence(eventElements, onComplete) {
    if (!eventElements || eventElements.length === 0) return;

    // Reset all elements to hidden state
    eventElements.forEach(element => {
      if (element) {
        element.classList.add('daily-event-hidden');
        element.classList.remove(this.getAnimationClass());
      }
    });

    // Apply accent color
    const accentClass = `daily-accent-${this.accentColor}`;

    // Start animation sequence
    eventElements.forEach((element, index) => {
      if (!element) return;

      setTimeout(() => {
        // Add animation classes
        element.classList.add(this.getAnimationClass());
        element.classList.add(`daily-event-day-${index}`);
        element.classList.add(accentClass);
        element.classList.remove('daily-event-hidden');

        // Call onComplete when last element starts animating
        if (index === eventElements.length - 1 && onComplete) {
          setTimeout(onComplete, this.getAnimationDuration());
        }
      }, 50); // Small initial delay for smoother experience
    });
  }

  /**
   * Show success feedback after daily recurrence is set
   * @param {HTMLElement[]} eventElements - Event elements to flash
   */
  showSuccessFeedback(eventElements) {
    eventElements.forEach(element => {
      if (element) {
        element.classList.add('daily-event-success');
        setTimeout(() => {
          element.classList.remove('daily-event-success');
        }, 600);
      }
    });
  }

  /**
   * Show creating state while processing
   * @param {HTMLElement} triggerElement - Element that triggered the creation
   */
  showCreatingState(triggerElement) {
    if (triggerElement) {
      triggerElement.classList.add('daily-event-creating');
    }
  }

  /**
   * Hide creating state
   * @param {HTMLElement} triggerElement - Element that triggered the creation
   */
  hideCreatingState(triggerElement) {
    if (triggerElement) {
      triggerElement.classList.remove('daily-event-creating');
    }
  }

  /**
   * Get the appropriate animation class based on type
   * @returns {string} Animation class name
   */
  getAnimationClass() {
    const animationMap = {
      flow: 'daily-event-appear',
      glow: 'daily-event-glow',
      cascade: 'daily-event-cascade',
      breathe: 'daily-event-breathe'
    };
    return animationMap[this.animationType] || 'daily-event-appear';
  }

  /**
   * Get animation duration based on type
   * @returns {number} Duration in milliseconds
   */
  getAnimationDuration() {
    const durationMap = {
      flow: 600,
      glow: 700,
      cascade: 500,
      breathe: 800
    };
    return durationMap[this.animationType] || 600;
  }

  /**
   * Clean up animation classes
   * @param {HTMLElement[]} eventElements - Elements to clean
   */
  cleanup(eventElements) {
    const animationClasses = [
      'daily-event-appear',
      'daily-event-glow',
      'daily-event-cascade',
      'daily-event-breathe',
      'daily-event-hidden',
      'daily-event-creating',
      'daily-event-success'
    ];

    const dayClasses = Array.from({length: 7}, (_, i) => `daily-event-day-${i}`);
    const accentClasses = ['daily-accent-blue', 'daily-accent-emerald', 'daily-accent-purple'];

    eventElements.forEach(element => {
      if (element) {
        element.classList.remove(...animationClasses, ...dayClasses, ...accentClasses);
      }
    });
  }
}

/**
 * React Hook for Daily Recurrence Animation
 * Example implementation for React applications
 */
function useDailyRecurrenceAnimation(options = {}) {
  const animator = new DailyRecurrenceAnimator(options);

  const animateRecurrence = useCallback((eventElements, onComplete) => {
    animator.animateDailyRecurrence(eventElements, onComplete);
  }, [animator]);

  const showSuccess = useCallback((eventElements) => {
    animator.showSuccessFeedback(eventElements);
  }, [animator]);

  const showCreating = useCallback((element) => {
    animator.showCreatingState(element);
  }, [animator]);

  const hideCreating = useCallback((element) => {
    animator.hideCreatingState(element);
  }, [animator]);

  const cleanup = useCallback((eventElements) => {
    animator.cleanup(eventElements);
  }, [animator]);

  return {
    animateRecurrence,
    showSuccess,
    showCreating,
    hideCreating,
    cleanup
  };
}

/**
 * Example Usage in React Component
 */
const ExampleCalendarComponent = () => {
  const { animateRecurrence, showSuccess, showCreating, hideCreating } = useDailyRecurrenceAnimation({
    animationType: 'flow',
    accentColor: 'blue',
    staggerDelay: 80
  });

  const handleSetDailyRecurrence = async (eventData) => {
    // Show creating state
    const triggerButton = document.querySelector('[data-daily-trigger]');
    showCreating(triggerButton);

    try {
      // Create recurring events (your API call here)
      await createDailyRecurringEvents(eventData);

      // Get event elements for each day
      const eventElements = Array.from({length: 7}, (_, i) =>
        document.querySelector(`[data-daily-event-day="${i}"]`)
      );

      // Hide creating state
      hideCreating(triggerButton);

      // Animate the appearance
      animateRecurrence(eventElements, () => {
        // Show success feedback
        showSuccess(eventElements);
      });

    } catch (error) {
      hideCreating(triggerButton);
      // Handle error
    }
  };

  return (
    <div className="calendar-week-view">
      {/* Your calendar implementation */}
      <button
        data-daily-trigger
        onClick={() => handleSetDailyRecurrence(eventData)}
        className="btn-set-daily"
      >
        Set Daily Recurrence
      </button>

      {/* Event elements for each day */}
      {Array.from({length: 7}, (_, i) => (
        <div key={i} data-daily-event-day={i} className="daily-event-item">
          {/* Event content */}
        </div>
      ))}
    </div>
  );
};

/**
 * Vanilla JavaScript Example
 */
const setupDailyRecurrenceAnimation = () => {
  const animator = new DailyRecurrenceAnimator({
    animationType: 'flow',
    accentColor: 'blue'
  });

  document.addEventListener('click', (e) => {
    if (e.target.matches('[data-set-daily]')) {
      const eventElements = Array.from(document.querySelectorAll('[data-daily-event]'));

      animator.animateDailyRecurrence(eventElements, () => {
        animator.showSuccessFeedback(eventElements);
      });
    }
  });
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DailyRecurrenceAnimator, useDailyRecurrenceAnimation };
}

// Global for direct script inclusion
if (typeof window !== 'undefined') {
  window.DailyRecurrenceAnimator = DailyRecurrenceAnimator;
}