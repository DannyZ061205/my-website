import React, { useEffect, useRef } from 'react';
import { CalendarEvent } from '@/types';

interface EventContextMenuProps {
  event: CalendarEvent;
  position: { x: number; y: number };
  onClose: () => void;
  onCut: (event: CalendarEvent) => void;
  onCopy: (event: CalendarEvent) => void;
  onDuplicate: (event: CalendarEvent) => void;
  onDelete: (event: CalendarEvent) => void;
  isClosing?: boolean;
}

export const EventContextMenu: React.FC<EventContextMenuProps> = ({
  event,
  position,
  onClose,
  onCut,
  onCopy,
  onDuplicate,
  onDelete,
  isClosing = false
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Detect if user is on Mac
  const isMac = typeof window !== 'undefined' &&
    navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘' : 'Ctrl';

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      // If right-clicking outside the menu, close it
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Add listeners with a small delay to avoid closing immediately when opening
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('contextmenu', handleContextMenu);
      document.addEventListener('keydown', handleEscape);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const menuItems = [
    {
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="10" height="10" strokeDasharray="3 2" />
        </svg>
      ),
      label: 'Cut',
      shortcut: `${modKey} X`,
      action: () => {
        onCut(event);
        onClose();
      }
    },
    {
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="5" width="8" height="9" />
          <path d="M6 5V3C6 2.5 6.5 2 7 2H13C13.5 2 14 2.5 14 3V11C14 11.5 13.5 12 13 12H10" />
        </svg>
      ),
      label: 'Copy',
      shortcut: `${modKey} C`,
      action: () => {
        onCopy(event);
        onClose();
      }
    },
    {
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="5" y="5" width="9" height="9" />
          <rect x="2" y="2" width="9" height="9" />
        </svg>
      ),
      label: 'Duplicate',
      shortcut: `${modKey} D`,
      action: () => {
        onDuplicate(event);
        onClose();
      }
    },
    {
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M6 2L6 1M10 2L10 1M4 5L12 5M5 5V11C5 12 5.5 13 6.5 13H9.5C10.5 13 11 12 11 11V5M7 8V10M9 8V10M2 5H14" />
        </svg>
      ),
      label: 'Delete',
      shortcut: 'Delete',
      action: () => {
        onDelete(event);
        onClose();
      },
      isDestructive: true
    }
  ];

  return (
    <div
      ref={menuRef}
      className={`fixed z-50 bg-white rounded-lg shadow-lg py-1 min-w-[200px] border border-gray-200 ${isClosing ? 'context-menu-fade-out' : 'context-menu-fade-in'}`}
      style={{
        top: position.y,
        left: position.x,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 0 1px rgba(0, 0, 0, 0.1)'
      }}
    >
      {menuItems.map((item, index) => (
        <React.Fragment key={index}>
          <button
            onClick={() => item.action()}
            className={`w-full px-3 py-2 flex items-center justify-between transition-colors duration-100 ${
              item.isDestructive
                ? 'text-red-600 hover:bg-red-50'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className={`${item.isDestructive ? 'text-red-500' : 'text-gray-500'}`}>
                {item.icon}
              </span>
              <span className="text-[13px] font-normal">{item.label}</span>
            </div>
            <span className="text-[11px] text-gray-400">{item.shortcut}</span>
          </button>
          {index === menuItems.length - 2 && (
            <div className="h-px bg-gray-200 my-1" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};