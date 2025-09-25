'use client';

import React, {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
} from 'react';
import { useChat } from '@/contexts/ChatContext';

interface ChatModuleProps {
  className?: string;
  shouldAutoFocus?: boolean;
  messages?: Message[];
  onMessagesChange?: (messages: Message[]) => void;
  inputValue?: string;
  onInputChange?: (value: string) => void;
}

export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

const MessageBubble: React.FC<{
  message: Message;
  shouldAnimate: boolean;
  onAnimationComplete?: () => void;
}> = ({ message, shouldAnimate, onAnimationComplete }) => {
  const isUser = message.sender === 'user';
  const isTyping = message.id.startsWith('typing-') && message.sender === 'assistant';

  // Split content into words for animation
  const words = message.content.split(' ');

  // Call onAnimationComplete after animation finishes
  useEffect(() => {
    if (shouldAnimate && onAnimationComplete && !isUser && !isTyping) {
      // Calculate total animation time
      const totalAnimationTime = words.length * 50 + 300; // 50ms per word + 300ms for animation
      const timer = setTimeout(onAnimationComplete, totalAnimationTime);
      return () => clearTimeout(timer);
    }
  }, [shouldAnimate, onAnimationComplete, isUser, isTyping, words.length]);

  return (
    <div className={`group mb-6 ${isUser ? 'flex justify-end' : 'flex justify-start'}`}>
      <div className={isUser ? "max-w-[70%]" : "w-full"}>
        {isUser ? (
          <div
            className="inline-block px-4 py-2.5 rounded-2xl text-sm bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm"
            style={{ wordBreak: 'break-all', overflowWrap: 'anywhere', maxWidth: '100%' }}
          >
            {message.content}
          </div>
        ) : (
          <div className="text-sm text-gray-700 leading-relaxed break-words">
            {isTyping ? (
              <div className="flex items-center space-x-1 py-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0.1s' }}
                />
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0.2s' }}
                />
              </div>
            ) : (
              <div>
                {shouldAnimate && !isUser && !isTyping ? (
                  <>
                    {words.map((word, index) => (
                      <span
                        key={index}
                        className="inline-block animate-word-reveal"
                        style={{
                          animationDelay: `${index * 0.05}s`,
                          opacity: 0
                        }}
                      >
                        {word}{index < words.length - 1 ? '\u00A0' : ''}
                      </span>
                    ))}
                    <style jsx>{`
                      @keyframes wordReveal {
                        to {
                          opacity: 1;
                        }
                      }
                      :global(.animate-word-reveal) {
                        animation: wordReveal 0.3s ease-in forwards;
                      }
                    `}</style>
                  </>
                ) : (
                  message.content
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

let _uid = 0;
const uid = () => `${Date.now()}-${_uid++}`;

export const ChatModule: React.FC<ChatModuleProps> = ({
  className = '',
  shouldAutoFocus = true,
  messages: controlledMessages,
  onMessagesChange,
  inputValue: controlledInputValue,
  onInputChange
}) => {
  // Try to use ChatContext if available
  let contextValue: any;
  try {
    contextValue = useChat();
  } catch (e) {
    // Not wrapped in ChatProvider, use local state
    contextValue = null;
  }

  // Local tracking for animated messages if not using context
  const [localAnimatedIds, setLocalAnimatedIds] = useState<Set<string>>(new Set());

  // Use controlled state if provided, otherwise use context if available, otherwise use internal state
  const [internalMessages, setInternalMessages] = useState<Message[]>([]);
  const [internalInputValue, setInternalInputValue] = useState('');

  const messages = controlledMessages ?? contextValue?.messages ?? internalMessages;
  const inputValue = controlledInputValue ?? contextValue?.inputValue ?? internalInputValue;

  const setMessages = useCallback((value: Message[] | ((prev: Message[]) => Message[])) => {
    if (onMessagesChange) {
      // Controlled mode
      if (typeof value === 'function') {
        // For function updates, we need to get the current messages
        const currentMessages = controlledMessages ?? contextValue?.messages ?? internalMessages;
        onMessagesChange(value(currentMessages));
      } else {
        onMessagesChange(value);
      }
    } else if (contextValue?.setMessages) {
      // Context mode
      contextValue.setMessages(value);
    } else {
      // Uncontrolled mode
      setInternalMessages(value);
    }
  }, [controlledMessages, internalMessages, onMessagesChange, contextValue]);

  const setInputValue = useCallback((value: string) => {
    if (onInputChange) {
      onInputChange(value);
    } else if (contextValue?.setInputValue) {
      contextValue.setInputValue(value);
    } else {
      setInternalInputValue(value);
    }
  }, [onInputChange, contextValue]);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  // Removed bottomAnchorRef as we now scroll within container only

  // holds the current "typing message id" so we can replace it in-place
  const pendingTypingIdRef = useRef<string | null>(null);
  const generationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (shouldAutoFocus) {
      inputRef.current?.focus();
    }
  }, [shouldAutoFocus]);

  // Auto-resize composer
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = '44px';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [inputValue]);

  const scrollToBottom = useCallback((smooth = true) => {
    // Use rAF so DOM has applied height changes
    requestAnimationFrame(() => {
      // Only scroll within the messages container, not the whole page
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    });
  }, []);

  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const THRESHOLD_PX = 96;
    const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
    setIsAtBottom(distanceFromBottom <= THRESHOLD_PX);
  }, []);

  // Keep pinned when new content arrives only if user is near bottom
  useLayoutEffect(() => {
    if (isAtBottom) scrollToBottom(false);
  }, [messages, isAtBottom, scrollToBottom]);

  const simulateAssistantResponse = (): Message => {
    const responses = [
      'I can help you with scheduling, time management, and productivity. What would you like to work on?',
      "I'm here to assist with your calendar and planning needs. How can I help you today?",
      "I understand you're looking for assistance. Could you tell me more about what you'd like to accomplish?",
      "I'm ready to help you organize your time and tasks. What's on your mind?",
    ];
    return {
      id: `msg-${uid()}`, // Ensure ID doesn't start with 'typing-'
      content: responses[Math.floor(Math.random() * responses.length)],
      sender: 'assistant',
      timestamp: new Date(),
    };
    // In your real app, replace the above with your API call / streaming handler.
  };

  const handleStopGeneration = () => {
    // Clear the timeout
    if (generationTimeoutRef.current) {
      clearTimeout(generationTimeoutRef.current);
      generationTimeoutRef.current = null;
    }
    // Remove typing indicator
    if (pendingTypingIdRef.current) {
      setMessages(prev => prev.filter(msg => msg.id !== pendingTypingIdRef.current));
      pendingTypingIdRef.current = null;
    }
    setIsGenerating(false);
    // Clear input to ensure smooth transition to microphone
    setInputValue('');
  };

  const handleSendMessage = () => {
    if (!inputValue.trim() || isGenerating) return;

    const userMessage: Message = {
      id: uid(),
      content: inputValue,
      sender: 'user',
      timestamp: new Date(),
    };

    // Append user message
    setMessages(prev => [...prev, userMessage]);

    // Set generating state
    setIsGenerating(true);

    // Add a UNIQUE typing placeholder and remember its id
    const typingId = `typing-${uid()}`;
    pendingTypingIdRef.current = typingId;

    const typingMessage: Message = {
      id: typingId,
      content: 'Thinking…',
      sender: 'assistant',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, typingMessage]);

    // Force pin to bottom after send
    setIsAtBottom(true);
    scrollToBottom();

    // Replace typing bubble in-place
    generationTimeoutRef.current = setTimeout(() => {
      const assistantMessage = simulateAssistantResponse();

      setMessages(prev => {
        // Filter out ALL typing messages and add the new response
        const filteredMessages = prev.filter(m => !m.id.startsWith('typing-'));
        return [...filteredMessages, assistantMessage];
      });

      // Clear the pending ref
      pendingTypingIdRef.current = null;

      // Clear generating state
      setIsGenerating(false);
      generationTimeoutRef.current = null;
    }, 1200);

    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isGenerating) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className={`h-full bg-white flex flex-col ${className}`}>
      {/* Messages Area */}
      <div
        className="relative flex-1 min-h-0 overflow-y-auto"  // <-- min-h-0 is important inside flex
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col justify-center px-6">
            <div className="max-w-3xl w-full mx-auto">
              <div className="mb-12 text-center">
                <h1 className="text-4xl font-semibold text-gray-800 mb-4">Chronos AI</h1>
                <p className="text-gray-500 text-lg">How can I help you organize your time today?</p>
              </div>

              <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
                <button
                  onClick={() => setInputValue('Schedule a meeting for tomorrow at 2pm')}
                  className="text-left p-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors group"
                >
                  <div className="text-sm font-medium text-gray-700 mb-1 group-hover:text-gray-900">
                    📅 Schedule meeting
                  </div>
                  <div className="text-xs text-gray-500">"Book time tomorrow afternoon"</div>
                </button>

                <button
                  onClick={() => setInputValue('Block 2 hours for deep work')}
                  className="text-left p-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors group"
                >
                  <div className="text-sm font-medium text-gray-700 mb-1 group-hover:text-gray-900">
                    🎯 Focus time
                  </div>
                  <div className="text-xs text-gray-500">"Reserve time for deep work"</div>
                </button>

                <button
                  onClick={() => setInputValue("What's on my calendar today?")}
                  className="text-left p-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors group"
                >
                  <div className="text-sm font-medium text-gray-700 mb-1 group-hover:text-gray-900">
                    📋 View schedule
                  </div>
                  <div className="text-xs text-gray-500">"Show today's appointments"</div>
                </button>

                <button
                  onClick={() => setInputValue('Set a weekly team standup')}
                  className="text-left p-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors group"
                >
                  <div className="text-sm font-medium text-gray-700 mb-1 group-hover:text-gray-900">
                    🔄 Recurring event
                  </div>
                  <div className="text-xs text-gray-500">"Create weekly meetings"</div>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="max-w-3xl mx-auto px-6 pt-6 pb-6">
              {messages.map(m => {
                const animatedIds = contextValue?.animatedMessageIds ?? localAnimatedIds;
                const shouldAnimate = !m.id.startsWith('typing-') &&
                                     m.sender === 'assistant' &&
                                     !animatedIds.has(m.id);

                return (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    shouldAnimate={shouldAnimate}
                    onAnimationComplete={() => {
                      if (contextValue?.markMessageAnimated) {
                        contextValue.markMessageAnimated(m.id);
                      } else {
                        setLocalAnimatedIds(prev => new Set(prev).add(m.id));
                      }
                    }}
                  />
                );
              })}
            </div>

            {/* Jump to latest chip */}
            {!isAtBottom && (
              <div className="pointer-events-none absolute inset-x-0 bottom-20 flex justify-center">
                <button
                  onClick={() => {
                    scrollToBottom();
                    setIsAtBottom(true);
                  }}
                  className="pointer-events-auto px-3 py-1.5 rounded-full bg-white border border-gray-200 shadow-sm text-xs text-gray-700 hover:bg-gray-50"
                >
                  Jump to latest
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="relative flex items-center">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Start scheduling..."
              rows={1}
              className="w-full pl-5 py-3 pr-24 bg-gray-50 border border-gray-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent text-sm text-gray-900 placeholder-gray-500 resize-none overflow-y-auto"
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />

            {/* Microphone/Send/Stop button - Fixed position and size */}
            <button
              onClick={
                isGenerating
                  ? handleStopGeneration
                  : inputValue.trim()
                    ? handleSendMessage
                    : undefined
              }
              disabled={!isGenerating && !inputValue.trim()}
              className={`absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full transition-all duration-300 ease-in-out ${
                isGenerating || inputValue.trim()
                  ? 'bg-gray-800 text-white hover:bg-gray-900 shadow-sm scale-100'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 scale-100'
              }`}
              aria-label={
                isGenerating
                  ? "Stop generating"
                  : inputValue.trim()
                    ? "Send message"
                    : "Voice input"
              }
              title={
                !isGenerating && !inputValue.trim()
                  ? "Voice input"
                  : undefined
              }
            >
              <div className="relative w-full h-full flex items-center justify-center">
                {/* Stop icon with fade transition */}
                <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
                  isGenerating ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="1" />
                  </svg>
                </div>

                {/* Send icon with fade transition */}
                <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
                  !isGenerating && inputValue.trim() ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}>
                  <svg
                    className="w-4 h-4 rotate-90"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                </div>

                {/* Microphone icon with fade transition */}
                <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
                  !isGenerating && !inputValue.trim() ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
