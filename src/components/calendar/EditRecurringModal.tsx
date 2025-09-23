'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarEvent } from '@/types';

interface EditRecurringModalProps {
  event: CalendarEvent;
  action: 'move' | 'resize' | 'edit';
  onClose: () => void;
  onConfirm: (option: 'single' | 'following' | 'all') => void;
}

export const EditRecurringModal: React.FC<EditRecurringModalProps> = ({
  event,
  action,
  onClose,
  onConfirm
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      setMounted(true);
    }, 0);
    return () => {
      clearTimeout(timer);
      setMounted(false);
    };
  }, []);

  if (!mounted) return null;

  const actionText = action === 'move' ? 'move' : action === 'resize' ? 'resize' : 'edit';

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[100] animate-fadeIn"
        onClick={onClose}
      />

      {/* Modal - using transform for immediate centering */}
      <div
        className="fixed z-[101] bg-white rounded-xl shadow-2xl p-6 w-96"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          animation: 'modalFadeIn 0.2s ease-out'
        }}
      >
        <h2 className="text-xl font-semibold text-gray-900 mb-1">
          {action === 'move' ? 'Move' : action === 'resize' ? 'Resize' : 'Edit'} recurring event
        </h2>

        <p className="text-sm text-gray-500 mb-6">
          This is a recurring event. Would you like to {actionText} only this occurrence or all occurrences?
        </p>

        <div className="space-y-2">
          <button
            onClick={() => onConfirm('single')}
            className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between group"
          >
            <div>
              <div className="font-medium text-gray-900">Only this event</div>
              <div className="text-sm text-gray-500">Only this occurrence will be {action === 'move' ? 'moved' : action === 'resize' ? 'resized' : 'changed'}</div>
            </div>
            <span className="text-gray-400 group-hover:text-gray-600 transition-colors">→</span>
          </button>

          <button
            onClick={() => onConfirm('following')}
            className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between group"
          >
            <div>
              <div className="font-medium text-gray-900">This and following events</div>
              <div className="text-sm text-gray-500">This and all future occurrences will be {action === 'move' ? 'moved' : action === 'resize' ? 'resized' : 'changed'}</div>
            </div>
            <span className="text-gray-400 group-hover:text-gray-600 transition-colors">→</span>
          </button>

          <button
            onClick={() => onConfirm('all')}
            className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between group"
          >
            <div>
              <div className="font-medium text-gray-900">All events</div>
              <div className="text-sm text-gray-500">All occurrences in the series will be {action === 'move' ? 'moved' : action === 'resize' ? 'resized' : 'changed'}</div>
            </div>
            <span className="text-gray-400 group-hover:text-gray-600 transition-colors">→</span>
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