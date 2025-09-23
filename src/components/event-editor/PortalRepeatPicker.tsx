'use client';

import React from 'react';
import { RepeatPicker } from './RepeatPicker';
import { usePortalDropdown } from './usePortalDropdown';

interface PortalRepeatPickerProps {
  isOpen: boolean;
  triggerRef: React.RefObject<HTMLElement>;
  value: string;
  eventDate: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onHover?: (label: string | null) => void;
}

export const PortalRepeatPicker: React.FC<PortalRepeatPickerProps> = ({
  isOpen,
  triggerRef,
  value,
  eventDate,
  onChange,
  onClose,
  onHover
}) => {
  const { Portal } = usePortalDropdown({
    isOpen,
    onClose,
    triggerRef,
    offsetX: -253,
    offsetY: 0
  });

  return (
    <Portal>
      <RepeatPicker
        value={value}
        eventDate={eventDate}
        onChange={onChange}
        onClose={onClose}
        onHover={onHover}
        className=""
      />
    </Portal>
  );
};