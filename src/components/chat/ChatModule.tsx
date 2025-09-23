'use client';

import React, {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
} from 'react';

interface ChatModuleProps {
  className?: string;
  shouldAutoFocus?: boolean;
}

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
  const isUser = message.sender === 'user';
  const isTyping = message.id.startsWith('typing-');

  return (
    <div className={`group mb-6 ${isUser ? 'flex justify-end' : 'flex justify-start'}`}>
      <div className="max-w-[70%]">
        {isUser ? (
          <div
            className="inline-block px-4 py-2.5 rounded-2xl text-sm bg-gray-800 text-white"
            style={{ wordBreak: 'break-all', overflowWrap: 'anywhere', maxWidth: '100%' }}
          >
            {message.content}
          </div>
        ) : (
          <div className="text-sm text-gray-900 leading-relaxed break-words">
            {isTyping ? (
              <div className="flex items-center space-x-1">
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
              message.content
            )}
          </div>
        )}
      </div>
    </div>
  );
};

let _uid = 0;
const uid = () => `${Date.now()}-${_uid++}`;

export const ChatModule: React.FC<ChatModuleProps> = ({ className = '', shouldAutoFocus = true }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isAtBottom, setIsAtBottom] = useState(true);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  // Removed bottomAnchorRef as we now scroll within container only

  // holds the current "typing message id" so we can replace it in-place
  const pendingTypingIdRef = useRef<string | null>(null);

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
      id: uid(),
      content: responses[Math.floor(Math.random() * responses.length)],
      sender: 'assistant',
      timestamp: new Date(),
    };
    // In your real app, replace the above with your API call / streaming handler.
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: uid(),
      content: inputValue,
      sender: 'user',
      timestamp: new Date(),
    };

    // Append user message
    setMessages(prev => [...prev, userMessage]);

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
    setTimeout(() => {
      const assistantMessage = simulateAssistantResponse();

      setMessages(prev => {
        const idx = prev.findIndex(m => m.id === pendingTypingIdRef.current);
        if (idx === -1) {
          // Fallback: if user sent again fast and typing got removed somehow, just append
          return [...prev, assistantMessage];
        }
        const next = prev.slice();
        next[idx] = assistantMessage; // in-place replacement
        return next;
      });

      // clear the ref if it belongs to this turn
      if (pendingTypingIdRef.current === typingId) {
        pendingTypingIdRef.current = null;
      }
    }, 1200);

    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
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
              {messages.map(m => (
                <MessageBubble key={m.id} message={m} />
              ))}
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
      <div className="p-4">
        <div className="max-w-3xl mx-auto">
          <div className="relative flex items-center">
            <style jsx>{`
              textarea::-webkit-scrollbar { display: none; }
              textarea { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>

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

            {/* Voice button (stub) */}
            <button
              className="absolute right-12 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Voice input"
              title="Voice input"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>

            {/* Send */}
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
              aria-label="Send message"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
