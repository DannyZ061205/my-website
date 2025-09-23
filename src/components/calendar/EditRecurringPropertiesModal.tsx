'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarEvent } from '@/types';

interface EditRecurringPropertiesModalProps {
  event: CalendarEvent;
  changes: Partial<CalendarEvent>;
  onClose: () => void;
  onConfirm: (option: 'single' | 'following' | 'all') => void;
}

export const EditRecurringPropertiesModal: React.FC<EditRecurringPropertiesModalProps> = ({
  event,
  changes,
  onClose,
  onConfirm
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 0);
    return () => {
      clearTimeout(timer);
      setMounted(false);
    };
  }, []);

  if (!mounted) return null;

  // Determine what changed for better messaging
  const getChangedProperties = () => {
    const changed = [];
    if (changes.title && changes.title !== event.title) changed.push('title');
    if (changes.description !== undefined && changes.description !== event.description) changed.push('description');
    if (changes.color && changes.color !== event.color) changed.push('color');
    if (changes.urgency && changes.urgency !== event.urgency) changed.push('priority');
    if (changes.videoConference !== undefined && changes.videoConference !== event.videoConference) changed.push('video conference');
    if (changes.recurrence && changes.recurrence !== event.recurrence) changed.push('recurrence pattern');
    return changed;
  };

  const changedProps = getChangedProperties();
  const changeDescription = changedProps.length > 0
    ? `You're changing: ${changedProps.join(', ')}`
    : "You're making changes to this event";

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[100] animate-fadeIn"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed z-[101] bg-white rounded-xl shadow-2xl p-6 w-96"
        onClick={(e) => e.stopPropagation()}
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          animation: 'modalFadeIn 0.2s ease-out'
        }}
      >
        <h2 className="text-xl font-semibold text-gray-900 mb-1">
          Update recurring event
        </h2>

        <p className="text-sm text-gray-500 mb-6">
          {changeDescription}. This is a recurring event.
        </p>

        <div className="space-y-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onConfirm('single');
            }}
            className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between group"
          >
            <div>
              <div className="font-medium text-gray-900">Only this event</div>
              <div className="text-sm text-gray-500">Changes will apply to this occurrence only</div>
            </div>
            <span className="text-gray-400 group-hover:text-gray-600 transition-colors">→</span>
          </button>

          {event.isVirtual && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onConfirm('following');
              }}
              className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between group"
            >
              <div>
                <div className="font-medium text-gray-900">This and following events</div>
                <div className="text-sm text-gray-500">Changes will apply to this and all future occurrences</div>
              </div>
              <span className="text-gray-400 group-hover:text-gray-600 transition-colors">→</span>
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onConfirm('all');
            }}
            className="w-full text-left px-4 py-3 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-between group"
          >
            <div>
              <div className="font-medium text-blue-600">All events</div>
              <div className="text-sm text-blue-500">Changes will apply to all occurrences in the series</div>
            </div>
            <span className="text-blue-400 group-hover:text-blue-600 transition-colors">→</span>
          </button>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </>,
    document.body
  );
};