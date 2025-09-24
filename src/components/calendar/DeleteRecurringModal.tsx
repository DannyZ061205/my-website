'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarEvent } from '@/types';

interface DeleteRecurringModalProps {
  event: CalendarEvent;
  onClose: () => void;
  onConfirm: (option: 'single' | 'following' | 'all') => void;
}

export const DeleteRecurringModal: React.FC<DeleteRecurringModalProps> = ({
  event,
  onClose,
  onConfirm
}) => {
  console.log('DeleteRecurringModal: Component rendered with:', { event, onClose: !!onClose, onConfirm: !!onConfirm });
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

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[100] animate-fadeIn"
        onClick={onClose}
        data-modal-content="delete-recurring-backdrop"
      />

      {/* Modal - using transform for immediate centering */}
      <div
        className="fixed z-[101] bg-white rounded-xl shadow-2xl p-6 w-96"
        onClick={(e) => e.stopPropagation()}
        data-modal-content="delete-recurring"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          animation: 'modalFadeIn 0.2s ease-out'
        }}
      >
        <h2 className="text-xl font-semibold text-gray-900 mb-1">
          Delete repeat event &ldquo;{event.title}&rdquo;
        </h2>

        <p className="text-sm text-gray-500 mb-6">
          This is a recurring event. Choose which occurrences to delete.
        </p>

        <div className="space-y-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              console.log('DeleteRecurringModal: Delete single clicked');
              console.log('DeleteRecurringModal: Calling onConfirm with "single"');
              onConfirm('single');
              console.log('DeleteRecurringModal: onConfirm called successfully');
            }}
            className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between group"
          >
            <div>
              <div className="font-medium text-gray-900">This event</div>
              <div className="text-sm text-gray-500">Only this occurrence will be deleted</div>
            </div>
            <span className="text-gray-400 group-hover:text-gray-600 transition-colors">→</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              console.log('DeleteRecurringModal: Delete following clicked');
              console.log('DeleteRecurringModal: Calling onConfirm with "following"');
              onConfirm('following');
              console.log('DeleteRecurringModal: onConfirm called successfully');
            }}
            className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between group"
          >
            <div>
              <div className="font-medium text-gray-900">This and following events</div>
              <div className="text-sm text-gray-500">This and all future occurrences will be deleted</div>
            </div>
            <span className="text-gray-400 group-hover:text-gray-600 transition-colors">→</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              console.log('DeleteRecurringModal: Delete all clicked');
              console.log('DeleteRecurringModal: Calling onConfirm with "all"');
              onConfirm('all');
              console.log('DeleteRecurringModal: onConfirm called successfully');
            }}
            className="w-full text-left px-4 py-3 rounded-lg hover:bg-red-50 transition-colors flex items-center justify-between group"
          >
            <div>
              <div className="font-medium text-red-600">All events</div>
              <div className="text-sm text-red-500">All occurrences will be deleted</div>
            </div>
            <span className="text-red-400 group-hover:text-red-600 transition-colors">→</span>
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