'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface Position {
  top: number;
  left: number;
}

interface UsePortalDropdownOptions {
  isOpen: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement>;
  offsetX?: number;
  offsetY?: number;
  preferredAlignment?: 'left' | 'right';
}

export function usePortalDropdown({
  isOpen,
  onClose,
  triggerRef: externalTriggerRef,
  offsetX = -240, // Default to left alignment with some offset
  offsetY = 0,
  preferredAlignment = 'left'
}: UsePortalDropdownOptions) {
  const internalTriggerRef = useRef<HTMLElement>(null);
  const triggerRef = externalTriggerRef || internalTriggerRef;
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position>({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);

  // Mount guard for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate position when dropdown opens
  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !isOpen) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left: number;
    let top: number;

    // Calculate horizontal position
    if (preferredAlignment === 'left') {
      left = triggerRect.left + offsetX;

      // Ensure dropdown doesn't go off the left edge
      if (left < 8) {
        left = 8;
      }
    } else {
      left = triggerRect.right + offsetX;

      // Ensure dropdown doesn't go off the right edge
      const estimatedWidth = 240; // Default dropdown width
      if (left + estimatedWidth > viewportWidth - 8) {
        left = viewportWidth - estimatedWidth - 8;
      }
    }

    // Calculate vertical position
    top = triggerRect.top + offsetY;

    // Ensure dropdown doesn't go off the bottom edge
    const estimatedHeight = 300; // Estimated max height
    if (top + estimatedHeight > viewportHeight - 8) {
      // Try positioning above the trigger
      const aboveTop = triggerRect.bottom - estimatedHeight + offsetY;
      if (aboveTop >= 8) {
        top = aboveTop;
      } else {
        // If it doesn't fit above either, position at bottom with scroll
        top = viewportHeight - estimatedHeight - 8;
      }
    }

    // Ensure dropdown doesn't go off the top edge
    if (top < 8) {
      top = 8;
    }

    setPosition({ top, left });
  }, [isOpen, offsetX, offsetY, preferredAlignment]);

  // Recalculate position when dropdown opens or window resizes
  useEffect(() => {
    if (isOpen) {
      calculatePosition();

      const handleResize = () => calculatePosition();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [isOpen, calculatePosition, triggerRef]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;

      // Don't close if clicking inside the dropdown
      if (dropdownRef.current?.contains(target)) {
        return;
      }

      // Don't handle if clicking on the trigger button - let the button's onClick handle it
      // This allows the button to toggle the dropdown properly
      if (triggerRef.current?.contains(target)) {
        // For trigger clicks, we rely on the button's onClick to toggle
        return;
      }

      onClose();
    };

    // Small delay to prevent immediate closing when the dropdown opens
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen, onClose, triggerRef]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Portal renderer
  const Portal = useCallback(({ children }: { children: React.ReactNode }) => {
    if (!mounted || !isOpen) return null;

    return createPortal(
      <div
        ref={dropdownRef}
        className="fixed z-[9999]"
        style={{
          top: position.top,
          left: position.left,
        }}
      >
        {children}
      </div>,
      document.body
    );
  }, [mounted, isOpen, position]);

  return {
    triggerRef: internalTriggerRef,
    Portal,
    isOpen,
    position
  };
}