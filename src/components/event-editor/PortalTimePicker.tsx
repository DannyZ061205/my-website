'use client';

import React from 'react';
import { TimePicker } from './TimePicker';
import { usePortalDropdown } from './usePortalDropdown';

interface PortalTimePickerProps {
  isOpen: boolean;
  triggerRef: React.RefObject<HTMLElement>;
  value: string;
  onChange: (time: string) => void;
  onClose: () => void;
  onHover?: (time: string | null) => void;
}

export const PortalTimePicker: React.FC<PortalTimePickerProps> = ({
  isOpen,
  triggerRef,
  value,
  onChange,
  onClose,
  onHover
}) => {
  const { Portal } = usePortalDropdown({
    isOpen,
    onClose,
    triggerRef,
    offsetX: -230,
    offsetY: 0
  });

  return (
    <Portal>
      <TimePicker
        value={value}
        onChange={onChange}
        onClose={onClose}
        onHover={onHover}
        className=""
      />
    </Portal>
  );
};