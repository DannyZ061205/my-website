export type Urgency = 'red' | 'orange' | 'green';

export interface Task {
  id: string;
  name: string;
  urgency: Urgency;
  description?: string;
  date?: string; // YYYY-MM-DD format
  timeframe?: {
    start?: string; // HH:mm format
    end?: string;   // HH:mm format
  };
  status: 'open' | 'done';
  createdAt: string;
  updatedAt: string;
}

export type EventColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'gray';

export type ReminderOption = 'at-time' | '5min' | '10min' | '30min' | '1hour' | '1day' | '1week' | '1month';

export interface CalendarEvent {
  id: string;
  taskId?: string;
  title: string;
  start: string; // ISO string
  end: string;   // ISO string
  timezone: string;
  description?: string;
  urgency?: Urgency;
  category?: string; // User-defined category
  location?: string; // User-defined location
  reminder?: ReminderOption; // Notification reminder setting (deprecated)
  reminders?: ReminderOption[]; // Multiple notification reminders
  meeting?: string; // 'google-meet' | 'zoom' | null
  color?: EventColor;
  recurrence?: string; // RRULE string for repeating events
  excludedDates?: string[]; // ISO strings of dates to exclude from recurrence
  recurrenceGroupId?: string; // ID to group related recurring events
  isRecurrenceBase?: boolean; // True for the original event that created the series
  isVirtual?: boolean; // True if this is a dynamically generated occurrence
  parentId?: string; // ID of the base event for virtual occurrences
  justCreated?: boolean; // True only for brand new events, cleared after first save
  recordings?: string; // JSON string of audio recordings data
}

export interface Goal {
  id: string;
  title: string;
  defaultUrgency: 'orange';
  constraints?: {
    hoursPerWeek?: number;
    preferredDays?: string[];
    preferredTimes?: string[];
    noScheduleWindows?: Array<{start: string; end: string}>;
  };
  recurrence: string; // RRULE string
  sessions: Array<{
    eventId: string;
    date: string;
    guidance: string;
  }>;
}

export interface User {
  id: string;
  clockType: '12h' | '24h';
  country: string;
  language: 'English' | 'Chinese';
  sleepSchedule: {
    start: string; // HH:mm
    end: string;   // HH:mm
  };
  eatingSchedule: {
    breakfast?: { start: string; end: string; enabled: boolean };
    lunch?: { start: string; end: string; enabled: boolean };
    dinner?: { start: string; end: string; enabled: boolean };
  };
  subscription: 'Free' | 'Pro';
}