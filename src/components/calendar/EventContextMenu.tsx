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
}

export const EventContextMenu: React.FC<EventContextMenuProps> = ({
  event,
  position,
  onClose,
  onCut,
  onCopy,
  onDuplicate,
  onDelete
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Detect if user is on Mac
  const isMac = typeof window !== 'undefined' &&
    navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘' : 'Ctrl';

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Small delay to prevent the context menu from closing immediately on right-click
      setTimeout(() => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
          onClose();
        }
      }, 10);
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Use 'click' instead of 'mousedown' for better UX
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('contextmenu', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('contextmenu', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const menuItems = [
    {
      icon: '⬚',
      label: 'Cut',
      shortcut: `${modKey} X`,
      action: () => {
        onCut(event);
        onClose();
      }
    },
    {
      icon: '⧉',
      label: 'Copy',
      shortcut: `${modKey} C`,
      action: () => {
        onCopy(event);
        onClose();
      }
    },
    {
      icon: '⊞',
      label: 'Duplicate',
      shortcut: `${modKey} D`,
      action: () => {
        onDuplicate(event);
        onClose();
      }
    },
    {
      icon: '🗑',
      label: 'Delete',
      shortcut: 'delete',
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
      className="fixed z-50 bg-gray-900 text-white rounded-lg shadow-2xl py-1 min-w-[200px] border border-gray-700 context-menu-bounce"
      style={{
        top: position.y,
        left: position.x
      }}
    >
      {menuItems.map((item, index) => (
        <button
          key={index}
          onClick={(e) => {
            // Add a little celebration effect for actions
            const btn = e.currentTarget;
            btn.style.transform = 'scale(0.95)';
            setTimeout(() => {
              btn.style.transform = '';
              item.action();
            }, 100);
          }}
          className={`w-full px-4 py-2 flex items-center justify-between hover:bg-gray-800 transition-all duration-200 hover:scale-105 ${
            item.isDestructive ? 'text-red-400 hover:text-red-300 hover:bg-red-900/20' : 'hover:bg-gray-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-lg opacity-70 transition-transform duration-200 hover:scale-110">{item.icon}</span>
            <span className="text-sm font-medium">{item.label}</span>
          </div>
          <span className="text-xs opacity-50">{item.shortcut}</span>
        </button>
      ))}
    </div>
  );
};