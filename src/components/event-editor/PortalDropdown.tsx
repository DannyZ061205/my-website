'use client';

import React from 'react';
import { usePortalDropdown } from './usePortalDropdown';

interface PortalDropdownProps {
  isOpen: boolean;
  triggerRef: React.RefObject<HTMLElement>;
  onClose: () => void;
  children: React.ReactNode;
  offsetX?: number;
  offsetY?: number;
  preferredAlignment?: 'left' | 'right';
}

export const PortalDropdown: React.FC<PortalDropdownProps> = ({
  isOpen,
  triggerRef,
  onClose,
  children,
  offsetX = -270,
  offsetY = 0,
  preferredAlignment = 'left'
}) => {
  const { Portal } = usePortalDropdown({
    isOpen,
    onClose,
    triggerRef,
    offsetX,
    offsetY,
    preferredAlignment
  });

  return (
    <Portal>
      {children}
    </Portal>
  );
};