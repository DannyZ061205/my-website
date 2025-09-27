'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Task, Urgency } from '@/types';

interface TodoModuleProps {
  className?: string;
  onCollapse?: () => void;
}

interface TaskItemProps {
  task: Task;
  onToggle: (taskId: string) => void;
  onEdit: (taskId: string, newName: string) => void;
  onDelete: (taskId: string) => void;
}

const urgencyColors: Record<Urgency, string> = {
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  green: 'bg-green-500',
};


const TaskItem: React.FC<TaskItemProps> = ({ task, onToggle, onEdit, onDelete }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.name);
  const [showMenu, setShowMenu] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [showSparkles, setShowSparkles] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [isEditing]);

  const handleEditSubmit = () => {
    if (editValue.trim() && editValue !== task.name) {
      onEdit(task.id, editValue.trim());
      // Add a little celebration for editing
      const taskElement = document.querySelector(`[data-task-id="${task.id}"]`);
      if (taskElement) {
        taskElement.classList.add('celebrate');
        setTimeout(() => taskElement.classList.remove('celebrate'), 600);
      }
    }
    setIsEditing(false);
    setEditValue(task.name);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditValue(task.name);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleEditSubmit();
    } else if (e.key === 'Escape') {
      handleEditCancel();
    }
  };

  // Format time range for display
  const formatTimeRange = () => {
    if (task.timeframe?.start && task.timeframe?.end) {
      return `${task.timeframe.start}-${task.timeframe.end}`;
    }
    return null;
  };

  const handleToggleWithDelight = () => {
    if (task.status === 'open') {
      setJustCompleted(true);
      setShowSparkles(true);
      setTimeout(() => {
        setJustCompleted(false);
        setShowSparkles(false);
      }, 1000);
    }
    onToggle(task.id);
  };

  return (
    <div
      data-task-id={task.id}
      className={`todo-item group relative flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300 ${
        isHovered ? 'bg-blue-50 hover-lift' : ''
      } ${task.status === 'done' ? 'opacity-60' : ''} ${
        justCompleted ? 'celebrate' : ''
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowMenu(false);
      }}
    >
      <button
        onClick={handleToggleWithDelight}
        className={`flex-shrink-0 w-4 h-4 rounded border transition-all duration-300 flex items-center justify-center btn-playful ${
          task.status === 'done'
            ? 'bg-blue-600 border-blue-600 hover-glow'
            : 'border-blue-200 hover:bg-blue-50 hover-bounce'
        } relative`}
        aria-label={task.status === 'done' ? 'Mark as incomplete' : 'Mark as complete'}
      >
        {task.status === 'done' && (
          <svg className="w-3 h-3 text-white success-check" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
        {showSparkles && (
          <>
            <div className="absolute -top-1 -left-1 w-2 h-2 bg-yellow-400 rounded-full sparkle" />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-400 rounded-full sparkle" style={{ animationDelay: '0.2s' }} />
            <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-green-400 rounded-full sparkle" style={{ animationDelay: '0.4s' }} />
            <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-purple-400 rounded-full sparkle" style={{ animationDelay: '0.6s' }} />
          </>
        )}
      </button>

      <div className="flex-1 min-w-0 flex items-center gap-2">
        {isEditing ? (
          <div className="bg-white rounded-lg shadow-lg p-2 border border-gray-200 flex-1">
            <input
              ref={editInputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleEditSubmit}
              className="w-full text-sm text-gray-900 bg-transparent outline-none"
              aria-label="Edit task name"
            />
          </div>
        ) : (
          <>
            <span
              className={`text-sm text-gray-900 ${
                task.status === 'done' ? 'line-through' : ''
              }`}
            >
              {task.name}
            </span>
            {formatTimeRange() && (
              <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                {formatTimeRange()}
              </span>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Priority dot */}
        <div
          className={`w-2 h-2 rounded-full transition-all duration-300 hover-bounce ${
            urgencyColors[task.urgency]
          } ${isHovered ? 'scale-125' : ''}`}
          title={`Priority: ${task.urgency}`}
        />

        {isHovered && !isEditing && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center justify-center w-6 h-6 text-gray-400 hover:text-gray-600 transition-all duration-200 hover-wiggle"
              aria-label="Task options"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>

            {showMenu && (
              <div className="absolute right-0 top-7 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-[80px] animate-slideIn">
                <button
                  onClick={() => {
                    setIsEditing(true);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-blue-700 hover:bg-blue-50 transition-all duration-200 hover-lift flex items-center gap-2"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
                <button
                  onClick={() => {
                    onDelete(task.id);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-all duration-200 hover-lift flex items-center gap-2"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};


export const TodoModule: React.FC<TodoModuleProps> = ({ className = '', onCollapse }) => {
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: '1',
      name: 'Review quarterly goals',
      urgency: 'red',
      status: 'open',
      timeframe: { start: '9:00AM', end: '10:30AM' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '2',
      name: 'Team standup meeting',
      urgency: 'orange',
      status: 'open',
      timeframe: { start: '10:30AM', end: '11:00AM' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '3',
      name: 'Morning workout',
      urgency: 'green',
      status: 'done',
      timeframe: { start: '7:00AM', end: '8:00AM' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '4',
      name: 'Email client updates',
      urgency: 'green',
      status: 'open',
      timeframe: { start: '2:00PM', end: '3:30PM' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '5',
      name: 'Prepare presentation',
      urgency: 'red',
      status: 'open',
      timeframe: { start: '4:00PM', end: '6:00PM' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '6',
      name: 'Research competitor analysis',
      urgency: 'orange',
      status: 'open',
      timeframe: { start: '11:30AM', end: '1:00PM' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);

  const [undoStack, setUndoStack] = useState<Task[][]>([]);
  const [redoStack, setRedoStack] = useState<Task[][]>([]);
  const [separatorPosition, setSeparatorPosition] = useState(60); // percentage
  const [isDraggingSeparator, setIsDraggingSeparator] = useState(false);
  const [showDoTodayToggle, setShowDoTodayToggle] = useState(true);
  const [showDoLaterToggle] = useState(true);

  const openTasks = tasks.filter((task) => task.status === 'open');
  const splitIndex = Math.ceil(openTasks.length * separatorPosition / 100);
  const doTodayTasks = openTasks.slice(0, splitIndex);
  const doLaterTasks = openTasks.slice(splitIndex);

  const saveState = () => {
    setUndoStack((prev) => [...prev.slice(-9), tasks]);
    setRedoStack([]);
  };

  const handleUndo = () => {
    if (undoStack.length > 0) {
      const previousState = undoStack[undoStack.length - 1];
      setRedoStack((prev) => [tasks, ...prev.slice(0, 9)]);
      setUndoStack((prev) => prev.slice(0, -1));
      setTasks(previousState);
    }
  };

  const handleRedo = () => {
    if (redoStack.length > 0) {
      const nextState = redoStack[0];
      setUndoStack((prev) => [...prev.slice(-9), tasks]);
      setRedoStack((prev) => prev.slice(1));
      setTasks(nextState);
    }
  };

  const handleToggleTask = (taskId: string) => {
    saveState();
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? { ...task, status: task.status === 'done' ? 'open' : 'done', updatedAt: new Date().toISOString() }
          : task
      )
    );
  };

  const handleEditTask = (taskId: string, newName: string) => {
    saveState();
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? { ...task, name: newName, updatedAt: new Date().toISOString() }
          : task
      )
    );
  };

  const handleDeleteTask = (taskId: string) => {
    saveState();
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
  };

  const handleAddTask = () => {
    saveState();
    const newTask: Task = {
      id: Date.now().toString(),
      name: 'New task',
      urgency: 'orange',
      status: 'open',
      timeframe: { start: '9:00AM', end: '10:00AM' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTasks((prev) => [...prev, newTask]);
  };

  return (
    <div className={`todo-container h-full bg-white overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 relative">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-medium text-gray-900 hover-bounce">To-do List</h2>
          <button
            onClick={() => setShowDoTodayToggle(!showDoTodayToggle)}
            className={`w-5 h-5 rounded border transition-all duration-200 ${
              showDoTodayToggle
                ? 'bg-blue-600 border-blue-600'
                : 'bg-blue-100 border-blue-300 hover:bg-blue-200'
            }`}
            title="Toggle Do Today section"
          >
            {showDoTodayToggle && (
              <svg className="w-3 h-3 text-white mx-auto" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            aria-label="Undo"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            aria-label="Redo"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Collapse button in upper right - Sidebar Icon (flipped) */}
          {onCollapse && (
            <button
              onClick={onCollapse}
              className="ml-2 p-1.5 text-gray-400 hover:text-gray-600 transition-colors duration-200 rounded hover:bg-gray-100"
              aria-label="Hide todo list"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="15" y1="3" x2="15" y2="21" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Do Today Section */}
        <div className="flex-shrink-0" style={{ height: `${separatorPosition}%` }}>
          <div className="p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-900">Do Today</h3>
              <div className="flex items-center gap-2">
                <div className={`w-8 h-5 rounded-full border transition-all duration-200 ${
                  showDoTodayToggle
                    ? 'bg-green-200 border-green-300'
                    : 'bg-blue-200 border-blue-300'
                }`}></div>
                <button
                  onClick={handleAddTask}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-all duration-200 hover-bounce btn-playful"
                  aria-label="Add task to Do Today"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {doTodayTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-center">
                  <div className="w-12 h-12 text-gray-300 mb-2 gentle-sway">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-500 mb-1">Ready to conquer today?</p>
                  <p className="text-xs text-gray-400">Add your first task above</p>
                </div>
              ) : (
                doTodayTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggle={handleToggleTask}
                    onEdit={handleEditTask}
                    onDelete={handleDeleteTask}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Draggable Separator */}
        <div
          className={`flex items-center px-4 py-2 cursor-row-resize group border-t border-b transition-all duration-200 ${
            isDraggingSeparator
              ? 'border-blue-300 bg-blue-50'
              : 'border-blue-200 bg-white hover:bg-blue-50'
          }`}
          onMouseDown={(e) => {
            setIsDraggingSeparator(true);
            e.preventDefault();

            const handleMouseMove = (e: MouseEvent) => {
              const container = document.querySelector('.todo-container');
              if (container) {
                const rect = container.getBoundingClientRect();
                const relativeY = e.clientY - rect.top;
                const newPosition = Math.max(20, Math.min(80, (relativeY / rect.height) * 100));
                setSeparatorPosition(newPosition);
              }
            };

            const handleMouseUp = () => {
              setIsDraggingSeparator(false);
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('mouseup', handleMouseUp);
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
          }}
        >
          <div className={`flex-1 h-0.5 transition-colors duration-200 ${
            isDraggingSeparator ? 'bg-blue-400' : 'bg-blue-300'
          }`} />
          <div className="mx-2 text-xs text-gray-500 select-none">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 16a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
            </svg>
          </div>
          <div className={`flex-1 h-0.5 transition-colors duration-200 ${
            isDraggingSeparator ? 'bg-blue-400' : 'bg-blue-300'
          }`} />
        </div>

        {/* Do Later Section */}
        <div className="flex-1 overflow-hidden">
          <div className="p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-900">Do Later</h3>
              <div className="flex items-center gap-2">
                <div className={`w-8 h-5 rounded-full border transition-all duration-200 ${
                  showDoLaterToggle
                    ? 'bg-green-200 border-green-300'
                    : 'bg-blue-200 border-blue-300'
                }`}></div>
                <button
                  onClick={handleAddTask}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-all duration-200 hover-bounce btn-playful"
                  aria-label="Add task to Do Later"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {doLaterTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-center">
                  <div className="w-12 h-12 text-gray-300 mb-2 float">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-500 mb-1">Future tasks go here</p>
                  <p className="text-xs text-gray-400">Planning ahead feels good!</p>
                </div>
              ) : (
                doLaterTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggle={handleToggleTask}
                    onEdit={handleEditTask}
                    onDelete={handleDeleteTask}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};