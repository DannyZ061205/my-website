'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface LiveEventData {
  [eventId: string]: {
    title?: string;
    description?: string;
  };
}

interface LiveEventContextType {
  liveData: LiveEventData;
  updateLiveEvent: (eventId: string, updates: { title?: string; description?: string }) => void;
  clearLiveEvent: (eventId: string) => void;
}

const LiveEventContext = createContext<LiveEventContextType | undefined>(undefined);

export function LiveEventProvider({ children }: { children: React.ReactNode }) {
  const [liveData, setLiveData] = useState<LiveEventData>({});

  const updateLiveEvent = useCallback((eventId: string, updates: { title?: string; description?: string }) => {
    setLiveData(prev => ({
      ...prev,
      [eventId]: {
        ...prev[eventId],
        ...updates
      }
    }));
  }, []);

  const clearLiveEvent = useCallback((eventId: string) => {
    setLiveData(prev => {
      const next = { ...prev };
      delete next[eventId];
      return next;
    });
  }, []);

  return (
    <LiveEventContext.Provider value={{ liveData, updateLiveEvent, clearLiveEvent }}>
      {children}
    </LiveEventContext.Provider>
  );
}

export function useLiveEvent() {
  const context = useContext(LiveEventContext);
  if (!context) {
    throw new Error('useLiveEvent must be used within a LiveEventProvider');
  }
  return context;
}