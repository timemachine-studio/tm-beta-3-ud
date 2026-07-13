import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap,
  HeartPulse,
  Music,
  MessageCircle,
  Home,
  Settings,
  User,
  History,
  ExternalLink,
  BookOpen,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../hooks/useChat';
import { useAnonymousRateLimit } from '../../hooks/useAnonymousRateLimit';
import { ChatInput } from '../chat/ChatInput';
import { ChatMode } from '../chat/ChatMode';
import { ImageDimensions, ReplyToData } from '../../types/chat';

// ─── helpers ─────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(): string {
  return new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// ─── brand glass (matches UniversalGlassKit) ─────────────────────────

const glassCard = {
  background: 'rgba(255, 255, 255, 0.05)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
} as const;

// ─── bottom bento card data ──────────────────────────────────────────

interface AppTile {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  route: string;
}

const bottomCardData: AppTile[] = [
  { id: 'education', label: 'Education', description: 'Learn anything', icon: <GraduationCap />, route: '/education' },
  { id: 'healthcare', label: 'Healthcare', description: 'Health companion', icon: <HeartPulse />, route: '/healthcare' },
  { id: 'music', label: 'Music', description: 'Stream and discover', icon: <Music />, route: '/music' },
];

// sidebar icons
const sidebarItems = [
  { icon: <Home />, label: 'Home', route: '/home' },
  { icon: <MessageCircle />, label: 'Chat', route: '/' },
  { icon: <History />, label: 'History', route: '/history' },
  { icon: <User />, label: 'Account', route: '/account' },
  { icon: <Settings />, label: 'Settings', route: '/settings' },
];

// ─── animation ───────────────────────────────────────────────────────

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] },
});

// ─── component ───────────────────────────────────────────────────────

export function HomePage() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();

  // ── Live chat engine ────────────────────────────────────────────
  const {
    messages,
    isLoading,
    currentPersona,
    currentSessionId,
    error,
    streamingMessageId,
    loadingPhase,
    handleSendMessage,
    markMessageAsAnimated,
  } = useChat(
    user?.id,
    profile ? { nickname: profile.nickname, about_me: profile.about_me } : undefined,
    undefined,
    authLoading,
  );

  const { isRateLimited, incrementCount, isAnonymous } = useAnonymousRateLimit();

  // Has the user started chatting? (more than just the initial AI welcome message)
  const hasUserMessages = messages.some((m) => !m.isAI);

  // Rate-limited send (same logic as MainChatPage)
  const handleSendMessageWithRateLimit = useCallback(async (
    message: string,
    imageUrl?: string | string[],
    imageUrls?: string[],
    imageDimensions?: ImageDimensions,
    replyToData?: ReplyToData,
    specialMode?: string,
    pdfData?: string,
    pdfFileName?: string,
  ) => {
    // Intercept trigger word "play " case-insensitively
    if (message.trim().toLowerCase().startsWith('play ')) {
      const query = message.trim().slice(5).trim();
      if (query) {
        navigate('/', { state: { playQuery: query } });
      }
      return;
    }

    const mentionMatch = message.match(/^@(chatgpt|gemini|claude|grok|girlie|pro)\s/i);
    const targetModel = mentionMatch ? mentionMatch[1].toLowerCase() : currentPersona;

    if (isAnonymous && isRateLimited(targetModel)) {
      // Rate limited — redirect to chat UI where the auth modal will show
      navigate('/');
      return;
    }

    if (isAnonymous) incrementCount(targetModel);

    await handleSendMessage(message, imageUrl, imageUrls, imageDimensions, replyToData, specialMode, pdfData, pdfFileName);
  }, [currentPersona, isAnonymous, isRateLimited, incrementCount, handleSendMessage, navigate]);

  // Open in Chat UI — navigates to / and passes the current session so MainChatPage
  // loads THIS chat instead of starting fresh.
  const handleOpenInChatUI = useCallback(() => {
    navigate('/', {
      state: {
        sessionToLoad: {
          id: currentSessionId,
          name: messages.find((m) => !m.isAI)?.content?.slice(0, 50) || 'Home Chat',
          messages,
          persona: currentPersona,
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
        },
      },
    });
  }, [navigate, currentSessionId, messages, currentPersona]);

  // ── Clock ─────────────────────────────────────────────────────
  const [time, setTime] = useState(formatTime);
  useEffect(() => {
    const id = setInterval(() => setTime(formatTime()), 30_000);
    return () => clearInterval(id);
  }, []);

  const greeting = useMemo(getGreeting, []);
  const date = useMemo(formatDate, []);
  const name = profile?.nickname || null;

  // ── Notes draft (side panel) ──────────────────────────────────
  const [notesDraft, setNotesDraft] = useState('');

  const handleOpenInNotesUI = useCallback(() => {
    if (notesDraft.trim()) {
      localStorage.setItem('tm-notes-draft', notesDraft.trim());
    }
    navigate('/notes');
  }, [navigate, notesDraft]);

  // Current route for active state in nav
  const { pathname: currentPath } = useLocation();

  return (
    <div className="fixed inset-0 select-none">
      {/* ── BG: purple → black ──────────────────────────────── */}
      <div className="absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(160deg, #7c3aed 0%, #4c1d95 20%, #1e1b4b 45%, #0a0a0a 75%, #000 100%)' }}
        />
        <div className="absolute top-[-10%] left-[20%] w-[700px] h-[700px] bg-purple-500/25 rounded-full blur-[200px]" />
        <div className="absolute bottom-[-5%] right-[10%] w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[160px]" />
        <div className="absolute top-[50%] left-[60%] w-[300px] h-[300px] bg-fuchsia-500/8 rounded-full blur-[120px]" />
      </div>

      {/* ── LAYOUT ──────────────────────────────────────────── */}
      <div className="h-full flex overflow-hidden">

        {/* ── Sidebar (desktop) ─────────────────────────────── */}
        <motion.aside
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="hidden md:flex flex-col items-center py-6 px-3 gap-2 shrink-0 w-[72px]"
        >
          {sidebarItems.map((item) => (
            <motion.button
              key={item.label}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate(item.route)}
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-all duration-200"
              title={item.label}
            >
              {React.cloneElement(item.icon as React.ReactElement, { className: 'w-5 h-5' })}
            </motion.button>
          ))}
        </motion.aside>

        {/* ── Main grid area ────────────────────────────────── */}
        <div className="flex-1 h-full overflow-y-auto overflow-x-hidden p-4 pb-24 md:pb-5 md:pl-0 md:pr-5 md:py-5">
          <div className="md:h-full flex flex-col gap-4 md:min-h-[600px]">

            {/* ── TOP ROW: hero + side panel ─────────────────── */}
            <div className="md:flex-[1.3] flex flex-col md:flex-row gap-4 min-h-0">

              {/* HERO CARD — greeting + live chat + real ChatInput */}
              <motion.div
                {...fadeUp(0)}
                className="md:flex-[1.6] rounded-3xl overflow-hidden relative flex flex-col"
                style={{
                  ...glassCard,
                  minHeight: hasUserMessages ? '360px' : '280px',
                }}
              >
                {/* subtle accent glow */}
                <div
                  className="absolute inset-0 opacity-[0.08] pointer-events-none"
                  style={{ background: 'radial-gradient(ellipse at 30% 80%, #a855f7, transparent 60%)' }}
                />

                <div className="relative flex-1 flex flex-col min-h-0">
                  {/* top bar: date + time + open button */}
                  <div className="flex items-center justify-between px-5 sm:px-8 pt-5 pb-2 shrink-0">
                    <span className="text-white/30 text-xs sm:text-sm font-medium tracking-wide">{date}</span>
                    <div className="flex items-center gap-3">
                      <AnimatePresence>
                        {hasUserMessages && (
                          <motion.button
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleOpenInChatUI}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white/50 hover:text-white/80 transition-colors text-xs font-medium"
                            style={{
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                            }}
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Open in Chat UI</span>
                          </motion.button>
                        )}
                      </AnimatePresence>
                      <span className="text-white/30 text-xs sm:text-sm font-medium">{time}</span>
                    </div>
                  </div>

                  {/* greeting (shown when no user messages yet) */}
                  {!hasUserMessages && (
                    <div className="flex-1 flex items-center px-5 sm:px-8 py-4">
                      <div>
                        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.1]">
                          {greeting}{name ? ',' : '.'}
                        </h1>
                        {name && (
                          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.1]">
                            {name}.
                          </h1>
                        )}
                      </div>
                    </div>
                  )}

                  {/* live chat messages (shown once user sends a message) */}
                  {hasUserMessages && (
                    <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                      <ChatMode
                        messages={messages}
                        currentPersona={currentPersona}
                        onMessageAnimated={markMessageAsAnimated}
                        error={error}
                        streamingMessageId={streamingMessageId}
                        loadingPhase={loadingPhase}
                      />
                    </div>
                  )}

                  {/* real ChatInput — identical to the one in MainChatPage */}
                  <div className="shrink-0 px-4 sm:px-6 pb-4 pt-2">
                    <ChatInput
                      onSendMessage={handleSendMessageWithRateLimit}
                      isLoading={isLoading}
                      currentPersona={currentPersona}
                    />
                  </div>
                </div>
              </motion.div>

              {/* SIDE PANEL — Notes */}
              <motion.div
                {...fadeUp(0.08)}
                className="md:flex-1 rounded-3xl overflow-hidden relative"
                style={{ ...glassCard, minHeight: '220px' }}
              >
                <div className="relative h-full flex flex-col p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="w-4 h-4 text-white/30" />
                    <p className="text-white/30 text-[11px] font-semibold uppercase tracking-widest">Notes</p>
                  </div>

                  {/* Writing area */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar -mr-2 pr-2">
                    <textarea
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      placeholder="Start writing here..."
                      className="w-full h-full min-h-[120px] md:min-h-[180px] bg-transparent text-white/80 text-sm placeholder-white/15 outline-none resize-none leading-relaxed"
                    />
                  </div>

                  {/* Open in Notes UI pill button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleOpenInNotesUI}
                    className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-300"
                    style={{
                      background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(168, 85, 247, 0.08))',
                      border: '1px solid rgba(168, 85, 247, 0.3)',
                      boxShadow: '0 0 12px rgba(168, 85, 247, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                      color: 'rgba(196, 132, 252, 0.9)',
                    }}
                  >
                    Open in Notes UI
                    <ArrowRight className="w-4 h-4" />
                  </motion.button>
                </div>
              </motion.div>
            </div>

            {/* ── BOTTOM ROW: 3 feature cards ────────────────── */}
            <div className="md:flex-[0.65] grid grid-cols-3 gap-3 sm:gap-4 min-h-[120px] sm:min-h-[160px]">
              {bottomCardData.map((app, i) => (
                <motion.div
                  key={app.id}
                  {...fadeUp(0.14 + i * 0.06)}
                  whileHover={{ y: -4, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(app.route)}
                  className="rounded-3xl overflow-hidden relative cursor-pointer"
                  style={glassCard}
                >
                  <div className="relative h-full flex flex-col justify-between p-4 sm:p-6">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center bg-white/[0.06]">
                      <span className="text-white/70">
                        {React.cloneElement(app.icon as React.ReactElement, { className: 'w-5 h-5 sm:w-6 sm:h-6' })}
                      </span>
                    </div>
                    <div className="mt-3 sm:mt-0">
                      <p className="text-white/90 text-sm sm:text-base font-semibold">{app.label}</p>
                      <p className="text-white/30 text-[10px] sm:text-xs mt-0.5 hidden sm:block">{app.description}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Floating glass pill navbar (mobile) ──────────── */}
      <div
        className="md:hidden fixed z-50 left-1/2 -translate-x-1/2"
        style={{ bottom: 'max(12px, env(safe-area-inset-bottom, 12px))' }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-1.5 px-2 py-2 rounded-full"
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
          }}
        >
          {sidebarItems.map((item) => {
            const isActive = currentPath === item.route || (item.route === '/' && currentPath === '/');
            return (
              <motion.button
                key={item.label}
                whileTap={{ scale: 0.85 }}
                onClick={() => navigate(item.route)}
                className="relative flex items-center justify-center w-11 h-11 rounded-full transition-all duration-300"
                style={isActive ? {
                  background: 'rgba(168, 85, 247, 0.25)',
                  border: '1px solid rgba(168, 85, 247, 0.4)',
                  boxShadow: '0 0 12px rgba(168, 85, 247, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                } : {
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
                title={item.label}
              >
                {React.cloneElement(item.icon as React.ReactElement, {
                  className: `w-[18px] h-[18px] transition-colors duration-300 ${isActive ? 'text-purple-300' : 'text-white/40'}`,
                })}
              </motion.button>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
