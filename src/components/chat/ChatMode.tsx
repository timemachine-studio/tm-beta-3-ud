import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
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
import type { McpApprovalDecision } from '../../types/flightControls';

interface ReplyTo {
  id: string;
  content: string;
  sender_nickname?: string;
  isAI: boolean;
}

interface ChatModeProps {
  messages: Message[];
  currentPersona: keyof typeof AI_PERSONAS;
  onMessageAnimated: (messageId: string) => void;
  error?: string | null;
  streamingMessageId?: string | null;
  loadingPhase?: 'analyzing_photo' | 'thinking' | null;
  isGroupMode?: boolean;
  currentUserId?: string;
  onReply?: (message: ReplyTo) => void;
  onReact?: (messageId: string, emoji: string) => void;
  brandOverride?: BrandOverride;
  onMusicVariationsChange?: (messageId: string, variations: SavedVariation[]) => void;
  onOpenSesame?: () => void;
  onMcpApprovalDecision?: (messageId: string, decision: McpApprovalDecision) => void;
  onRetry?: (messageId: string) => void;
  isRetrying?: boolean;
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
  onOpenSesame,
  onMcpApprovalDecision,
  onRetry,
  isRetrying,
}: ChatModeProps) {
  const { theme } = useTheme();
  const reduced = useReducedMotion();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Track the last user message ID we've scrolled to (prevents duplicate scrolls)
  const lastScrolledUserMsgId = useRef<string | null>(null);

  // Smart scroll: positions user message at the top of viewport
  // No auto-scroll for AI messages - they naturally fill below
  const scrollUserMessageToTop = (messageId: string) => {
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
    // Find all user messages. The welcome message is always an AI message,
    // so filtering by role already excludes it.
    const userMessages = messages.filter(m => !m.isAI);

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

  // The three minds' hues, as on the landing page.
  const personaColors: Record<string, string> = {
    default: 'text-purple-400',
    girlie: 'text-pink-400',
    pro: 'text-cyan-400'
  };
  const flipWordsColor = personaColors[currentPersona] || personaColors.default;

  return (
    <div className={`min-h-full pt-24 ${showWelcomeText ? 'pb-24' : 'pb-48'} ${theme.text}`}>
      <div className="w-full max-w-4xl mx-auto px-4">
        {error && (
          <div
            className="mb-4 rounded-2xl px-4 py-3 text-[15px]"
            style={{ background: 'rgb(239 68 68 / 0.12)', border: '1px solid rgb(239 68 68 / 0.25)', color: 'rgb(252 165 165)' }}
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Welcome: the landing page's display voice, centred in the room
            between the nav and the composer. */}
        <AnimatePresence>
          {showWelcomeText && (
            <motion.div
              initial={reduced ? false : { opacity: 0, y: 16, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={reduced ? undefined : { opacity: 0, y: -16, scale: 0.98, filter: 'blur(8px)' }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="tm-chat-welcome flex items-center justify-center"
            >
              <div className="flex w-full flex-col items-center text-center">
                <h1
                  className="tm-display tm-welcome-text tm-welcome-heading"
                  style={{ color: 'rgb(var(--tm-ink-rgb) / 0.95)' }}
                >
                  <span className="flex items-baseline justify-center gap-[0.22em]">
                    <span>Start a</span>
                    <FlipWords
                      words={["better", "brighter", "dream", '"my"']}
                      duration={2500}
                      className={`italic font-light ${flipWordsColor}`}
                    />
                  </span>
                  <span className="block" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.7)' }}>future with TimeMachine.</span>
                </h1>

                {/* Where else to go: three glass pills, as under the landing composer. */}
                <div className="mt-9 flex flex-wrap items-center justify-center gap-1.5">
                  {([
                    { label: 'Notes', icon: BookOpen, onClick: () => navigate('/notes') },
                    { label: 'Healthcare', icon: HeartPulse, onClick: () => navigate('/healthcare') },
                    { label: 'Sesame', icon: SesameMark, onClick: onOpenSesame },
                  ] as const).map((item, i) => (
                    <motion.button
                      key={item.label}
                      type="button"
                      initial={reduced ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.25 + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                      onClick={item.onClick}
                      className="reveoule-action-pill tm-press tm-glass-pill inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors"
                      style={{ border: '1px solid rgb(var(--tm-ink-rgb) / 0.12)', color: 'rgb(var(--tm-ink-rgb) / 0.7)' }}
                    >
                      <item.icon className="h-4 w-4" aria-hidden="true" />
                      {item.label}
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
            {displayMessages.map((message) => {
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
                    onMcpApprovalDecision={onMcpApprovalDecision}
                    onRetry={onRetry}
                    isRetrying={isRetrying}
                  />
                </div>
              );
            })}
          </div>
        )}
        <div ref={messagesEndRef} className={showWelcomeText ? undefined : 'h-20'} />
      </div>
    </div>
  );
}
