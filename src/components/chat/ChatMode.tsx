import React, { useRef, useEffect } from 'react';
import { ChatMessage } from './ChatMessage';
import { Message } from '../../types/chat';
import { AI_PERSONAS } from '../../config/constants';
import { useTheme } from '../../context/ThemeContext';

interface ChatModeProps {
  messages: Message[];
  currentPersona: keyof typeof AI_PERSONAS;
  onMessageAnimated: (messageId: number) => void;
  error?: string | null;
  streamingMessageId?: number | null;
}

export function ChatMode({ 
  messages, 
  currentPersona, 
  onMessageAnimated,
  error,
  streamingMessageId
}: ChatModeProps) {
  const { theme } = useTheme();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastUserMessageRef = useRef<HTMLDivElement>(null);

  const scrollToMessage = () => {
    const container = document.querySelector('.message-container');
    if (container) {
      const lastMessage = messages[messages.length - 1];
      const isShortMessage = lastMessage.content.length < 350 && !lastMessage.content.includes('\n');
      
      if (!lastMessage.isAI || isShortMessage) {
        const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
        if (isAtBottom) {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
      }
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage.isAI) {
        lastUserMessageRef.current?.scrollIntoView({ behavior: "smooth" });
      } else {
        scrollToMessage();
      }
    }
  }, [messages]);

  return (
    <div className={`min-h-full pt-20 pb-48 ${theme.text}`}>
      <div className="w-full max-w-4xl mx-auto px-4">
        {error && (
          <div className="bg-[rgba(239,68,68,0.15)] border border-[rgba(239,68,68,0.25)] rounded-lg p-4 mb-4 text-[rgb(252,165,165)]">
            {error}
          </div>
        )}
        <div className="space-y-6">
          {messages.map((message, index) => {
            const previousMessage = !message.isAI && index > 0 ? message.content : null;
            return (
              <div
                key={message.id}
                ref={index === messages.length - 1 && !message.isAI ? lastUserMessageRef : null}
                className={index === 0 ? 'h-[calc(100vh-16rem)] flex items-center justify-center' : ''}
              >
                <ChatMessage 
                  {...message}
                  isChatMode={true}
                  onAnimationComplete={onMessageAnimated}
                  currentPersona={currentPersona}
                  previousMessage={previousMessage}
                  streamingMessageId={streamingMessageId}
                />
              </div>
            );
          })}
        </div>
        <div ref={messagesEndRef} className="h-20" />
      </div>
    </div>
  );
}