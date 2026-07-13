import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { BookOpen, HeartPulse } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { Message } from '../../types/chat';
import { AI_PERSONAS } from '../../config/constants';
import { useTheme } from '../../context/ThemeContext';
import { FlipWords } from '../ui/FlipWords';
import { BrandOverride } from '../brand/BrandLogo';
import type { SavedVariation } from './MusicComposeCard';
import { SesameMark } from '../icons/SesameMark';

interface ReplyTo {
  id: number;
  content: string;
  sender_nickname?: string;
  isAI: boolean;
}

interface ChatModeProps {
  messages: Message[];
  currentPersona: keyof typeof AI_PERSONAS;
  onMessageAnimated: (messageId: number) => void;
  error?: string | null;
  streamingMessageId?: number | null;
  loadingPhase?: 'analyzing_photo' | 'thinking' | null;
  isGroupMode?: boolean;
  currentUserId?: string;
  onReply?: (message: ReplyTo) => void;
  onReact?: (messageId: number, emoji: string) => void;
  brandOverride?: BrandOverride;
  onMusicVariationsChange?: (messageId: number, variations: SavedVariation[]) => void;
  onOpenSesame: () => void;
}

export function ChatMode({
  messages,
  currentPersona,
  onMessageAnimated,
  error,
  streamingMessageId,
  loadingPhase,
  isGroupMode,
  currentUserId,
  onReply,
  onReact,
  brandOverride,
  onMusicVariationsChange,
  onOpenSesame
}: ChatModeProps) {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Track the last user message ID we've scrolled to (prevents duplicate scrolls)
  const lastScrolledUserMsgId = useRef<number | null>(null);

  // Smart scroll: positions user message at the top of viewport
  // No auto-scroll for AI messages - they naturally fill below
  const scrollUserMessageToTop = (messageId: number) => {
    const container = document.querySelector('.message-container');
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);

    if (container && messageElement) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        const containerRect = container.getBoundingClientRect();
        const messageRect = messageElement.getBoundingClientRect();

        // Calculate scroll position to put the message at the top
        // Add a small offset (20px) for visual breathing room
        const scrollOffset = messageRect.top - containerRect.top + container.scrollTop - 20;

        container.scrollTo({
          top: Math.max(0, scrollOffset),
          behavior: 'smooth'
        });
      });
    }
  };

  // Scroll to top when component mounts (new session loaded)
  useEffect(() => {
    const container = document.querySelector('.message-container');
    if (container) {
      container.scrollTop = 0;
    }
  }, []);

  // Smart scroll effect: detect new user messages and scroll to them
  useEffect(() => {
    // Find all user messages (excluding the welcome message with id: 1)
    const userMessages = messages.filter(m => !m.isAI && m.id !== 1);

    if (userMessages.length > 0) {
      const lastUserMessage = userMessages[userMessages.length - 1];

      // Only scroll if this is a NEW user message we haven't scrolled to yet
      if (lastUserMessage.id !== lastScrolledUserMsgId.current) {
        lastScrolledUserMsgId.current = lastUserMessage.id;
        // Small delay to ensure the message element is rendered
        setTimeout(() => {
          scrollUserMessageToTop(lastUserMessage.id);
        }, 50);
      }
    }
  }, [messages]);

  // Check if we should show welcome text (no user messages sent yet)
  const hasUserMessages = messages.some(m => !m.isAI);
  const showWelcomeText = !hasUserMessages && messages.length > 0;

  // When showing welcome text, don't display any messages
  // When chat has started, show all messages except the initial AI greeting (first message)
  const displayMessages = showWelcomeText ? [] : messages.slice(1);

  // Persona-based colors for the animated words
  const personaColors: Record<string, string> = {
    default: 'text-purple-400',
    girlie: 'text-pink-400',
    pro: 'text-cyan-400'
  };
  const flipWordsColor = personaColors[currentPersona] || personaColors.default;

  return (
    <div className={`min-h-full pt-20 pb-48 ${theme.text}`}>
      <div className="w-full max-w-4xl mx-auto px-4">
        {error && (
          <div className="bg-[rgba(239,68,68,0.15)] border border-[rgba(239,68,68,0.25)] rounded-lg p-4 mb-4 text-[rgb(252,165,165)]">
            {error}
          </div>
        )}

        {/* Welcome Text - shown when no messages sent yet */}
        <AnimatePresence>
          {showWelcomeText && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
              className="h-[calc(100vh-16rem)] flex items-center justify-center"
            >
              <div className="flex w-full max-w-[23rem] flex-col items-start px-2 sm:w-auto sm:max-w-none sm:px-4">
                <div className="text-lg sm:text-xl font-normal text-neutral-400 text-left">
                  <div className="flex items-center">
                    <span>Start a</span>
                    <FlipWords
                      words={["better", "brighter", "dream", '"my"']}
                      duration={2500}
                      className={flipWordsColor}
                    />
                  </div>
                  <div>future with TimeMachine.</div>
                </div>

                {/* Quick access pills */}
                <div className="mt-8 flex w-full items-center justify-center gap-2 sm:w-auto sm:justify-start sm:gap-2.5">
                  {([
                    { label: 'Notes', icon: BookOpen, onClick: () => navigate('/notes') },
                    { label: 'Healthcare', icon: HeartPulse, onClick: () => navigate('/healthcare') },
                    { label: 'Sesame', icon: SesameMark, onClick: onOpenSesame },
                  ] as const).map((item, i) => (
                    <motion.button
                      key={item.label}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.3 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                      whileHover={{ scale: 1.04, y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={item.onClick}
                      className="reveoule-action-pill flex shrink-0 items-center justify-center gap-1.5 rounded-full px-3.5 py-2.5 text-white/50 transition-colors duration-200 hover:text-white/80 sm:gap-2 sm:px-4"
                      style={{
                        background: 'rgba(255, 255, 255, 0.04)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
                      }}
                    >
                      <item.icon className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium tracking-wide">{item.label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        {!showWelcomeText && (
          <div className="space-y-6">
            {displayMessages.map((message, index) => {
              // For AI messages, get the previous user message to detect @mentions
              const prevIndex = messages.findIndex(m => m.id === message.id) - 1;
              const previousMessage = message.isAI && prevIndex >= 0 ? messages[prevIndex].content : null;
              return (
                <div
                  key={message.id}
                  data-message-id={message.id}
                >
                  <ChatMessage
                    {...message}
                    isChatMode={true}
                    onAnimationComplete={onMessageAnimated}
                    currentPersona={currentPersona}
                    previousMessage={previousMessage}
                    streamingMessageId={streamingMessageId}
                    loadingPhase={loadingPhase}
                    isGroupMode={isGroupMode}
                    currentUserId={currentUserId}
                    onReply={onReply}
                    onReact={onReact}
                    brandOverride={brandOverride}
                    onMusicVariationsChange={onMusicVariationsChange}
                  />
                </div>
              );
            })}
          </div>
        )}
        <div ref={messagesEndRef} className="h-20" />
      </div>
    </div>
  );
}
