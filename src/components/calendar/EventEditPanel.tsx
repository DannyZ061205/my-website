'use client';

import React, { useState, useEffect } from 'react';
import { CalendarEvent, Urgency } from '@/types';
import { DeleteRecurringModal } from './DeleteRecurringModal';

interface EventEditPanelProps {
  event: CalendarEvent | null;
  onSave: (event: CalendarEvent) => void;
  onDelete: (eventId: string, deleteOption?: 'single' | 'following' | 'all') => void;
  onClose: () => void;
}

export const EventEditPanel: React.FC<EventEditPanelProps> = ({
  event,
  onSave,
  onDelete,
  onClose
}) => {
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [urgency, setUrgency] = useState<Urgency>('orange');
  const [description, setDescription] = useState('');
  const [repeat, setRepeat] = useState('none');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      const start = new Date(event.start);
      const end = new Date(event.end);

      setStartDate(start.toISOString().split('T')[0]);
      setStartTime(start.toTimeString().slice(0, 5));
      setEndDate(end.toISOString().split('T')[0]);
      setEndTime(end.toTimeString().slice(0, 5));
      setUrgency(event.urgency || 'orange');
      setDescription(event.description || '');
    }
  }, [event]);

  const handleSave = () => {
    if (!event) return;

    const startDateTime = new Date(`${startDate}T${startTime}`);
    const endDateTime = new Date(`${endDate}T${endTime}`);

    onSave({
      ...event,
      title,
      start: startDateTime.toISOString(),
      end: endDateTime.toISOString(),
      urgency,
      description,
    });
  };

  const formatTimeDisplay = (date: string, time: string) => {
    const datetime = new Date(`${date}T${time}`);
    return datetime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const formatDateDisplay = (date: string) => {
    const d = new Date(date + 'T00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getDuration = () => {
    if (!startDate || !startTime || !endDate || !endTime) return '';
    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${endDate}T${endTime}`);
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return '';
  };

  if (!event) return null;

  return (
    <div className="h-full bg-gradient-to-b from-gray-900 to-gray-800 text-gray-100 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-300">Event</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Title */}
        <div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full bg-transparent text-2xl font-semibold text-gray-100 placeholder-gray-500 outline-none border-b border-gray-700 pb-2 focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Time Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-gray-300">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="bg-gray-700 text-gray-100 px-2 py-1 rounded outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-500">→</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="bg-gray-700 text-gray-100 px-2 py-1 rounded outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-400 text-sm">{getDuration()}</span>
            </div>
          </div>

          <div className="ml-8">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setEndDate(e.target.value);
              }}
              className="bg-gray-700 text-gray-100 px-3 py-1 rounded outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Urgency/Color */}
        <div className="space-y-2">
          <label className="text-sm text-gray-400">Priority</label>
          <div className="flex gap-2">
            {(['red', 'orange', 'green'] as Urgency[]).map((color) => (
              <button
                key={color}
                onClick={() => setUrgency(color)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  urgency === color
                    ? color === 'red'
                      ? 'bg-red-500 text-white'
                      : color === 'orange'
                      ? 'bg-orange-500 text-white'
                      : 'bg-green-500 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                {color.charAt(0).toUpperCase() + color.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Repeat */}
        <div className="space-y-2">
          <label className="text-sm text-gray-400">Repeat</label>
          <select
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
            className="w-full bg-gray-700 text-gray-100 px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="none">Does not repeat</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="text-sm text-gray-400">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add description..."
            rows={4}
            className="w-full bg-gray-700 text-gray-100 px-3 py-2 rounded-lg placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            style={{
              overflowWrap: 'break-word',
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap'
            }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-700 space-y-2">
        <button
          onClick={handleSave}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg font-medium transition-colors"
        >
          Save
        </button>
        <button
          onClick={() => {
            // Check if this is a recurring event
            if (event.recurrence || event.recurrenceGroupId) {
              setShowDeleteModal(true);
            } else {
              if (confirm('Delete this event?')) {
                onDelete(event.id);
              }
            }
          }}
          className="w-full bg-gray-700 hover:bg-red-600 text-gray-300 hover:text-white py-2 px-4 rounded-lg font-medium transition-colors"
        >
          Delete
        </button>
      </div>

      {/* Delete Recurring Modal */}
      {showDeleteModal && event && (event.recurrence || event.recurrenceGroupId) && (
        <DeleteRecurringModal
          event={event}
          onClose={() => setShowDeleteModal(false)}
          onDelete={(option) => {
            onDelete(event.id, option);
            setShowDeleteModal(false);
            onClose();
          }}
        />
      )}
    </div>
  );
};