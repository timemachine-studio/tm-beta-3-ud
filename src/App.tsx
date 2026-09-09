import React, { Suspense, lazy, useEffect, useState, useMemo, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation, useParams, Navigate } from 'react-router-dom';
import { ChatInput } from './components/chat/ChatInput';
import { BrandLogo } from './components/brand/BrandLogo';
import type { BrandOverride } from './components/brand/BrandLogo';
import { MusicPlayer } from './components/music/MusicPlayer';
import { YouTubePlayer } from './components/music/YouTubePlayer';
import { searchMusic, getLyrics, Track as LyricsTrack, LyricLine } from './services/music/lyricsService';
import LyricsDisplay from './components/music/LyricsDisplay';
import LyricsYouTubePlayer from './components/music/LyricsYouTubePlayer';
import { LyricsMiniPlayer } from './components/music/LyricsMiniPlayer';
import { Star, Users, Settings, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChat } from './hooks/useChat';
import { useAnonymousRateLimit } from './hooks/useAnonymousRateLimit';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NotFoundPage } from './components/NotFoundPage';
import { AboutUsToast } from './components/about/AboutUsToast';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatMode } from './components/chat/ChatMode';
import { StageMode } from './components/chat/StageMode';
import { WelcomeModal } from './components/modals/WelcomeModal';
import { AuthModal } from './components/auth/AuthModal';
import { OnboardingModal } from './components/auth/OnboardingModal';
import { GroupChatModal } from './components/groupchat/GroupChatModal';
import {
  getGroupChat,
  getGroupChatInvite,
  joinGroupChat,
  isGroupChatParticipant,
  toggleMessageReaction
} from './services/groupChat/groupChatService';
import { GroupChat } from './types/groupChat';
import { ACCESS_TOKEN_REQUIRED, MAINTENANCE_MODE, PRO_HEAT_LEVELS, AI_PERSONAS } from './config/constants';
import { ChatSession, getSupabaseSessions, getLocalSessions } from './services/chat/chatService';
import { SEOHead } from './components/seo/SEOHead';
import { RouteLoadingFallback } from './components/routing/RouteLoadingFallback';

const HomePage = lazy(() => import('./components/home/HomePage').then((module) => ({ default: module.HomePage })));
const AccountPage = lazy(() => import('./components/auth/AccountPage').then((module) => ({ default: module.AccountPage })));
const ChatHistoryPage = lazy(() => import('./components/chat/ChatHistoryPage').then((module) => ({ default: module.ChatHistoryPage })));
const SettingsPage = lazy(() => import('./components/settings/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const AboutPage = lazy(() => import('./components/about/AboutPage').then((module) => ({ default: module.AboutPage })));
const PersonasPage = lazy(() => import('./components/personas/PersonasPage').then((module) => ({ default: module.PersonasPage })));
const FeaturesPage = lazy(() => import('./components/features/FeaturesPage').then((module) => ({ default: module.FeaturesPage })));
const ContactPage = lazy(() => import('./components/contact/ContactPage').then((module) => ({ default: module.ContactPage })));
const PrivacyPage = lazy(() => import('./components/legal/PrivacyPage').then((module) => ({ default: module.PrivacyPage })));
const TermsPage = lazy(() => import('./components/legal/TermsPage').then((module) => ({ default: module.TermsPage })));
const AlbumPage = lazy(() => import('./components/album/AlbumPage').then((module) => ({ default: module.AlbumPage })));
const MemoriesPage = lazy(() => import('./components/memories/MemoriesPage').then((module) => ({ default: module.MemoriesPage })));
const HelpPage = lazy(() => import('./components/help/HelpPage').then((module) => ({ default: module.HelpPage })));
const NotesPage = lazy(() => import('./components/notes/NotesPage').then((module) => ({ default: module.NotesPage })));
const HealthcarePage = lazy(() => import('./components/healthcare/HealthcarePage').then((module) => ({ default: module.HealthcarePage })));
const ShopPage = lazy(() => import('./components/shop/ShopPage').then((module) => ({ default: module.ShopPage })));
const LifestyleLayout = lazy(() => import('./components/lifestyle/LifestyleLayout').then((module) => ({ default: module.LifestyleLayout })));
const CookBookPage = lazy(() => import('./components/lifestyle/CookBookPage').then((module) => ({ default: module.CookBookPage })));
const FashionPage = lazy(() => import('./components/lifestyle/FashionPage').then((module) => ({ default: module.FashionPage })));
const ShoppingListPage = lazy(() => import('./components/lifestyle/ShoppingListPage').then((module) => ({ default: module.ShoppingListPage })));
const PremiumCalendarPage = lazy(() => import('./components/lifestyle/PremiumCalendarPage').then((module) => ({ default: module.PremiumCalendarPage })));
const GroupSettingsPage = lazy(() => import('./components/groupchat/GroupSettingsPage').then((module) => ({ default: module.GroupSettingsPage })));

// Chat by ID page component - defined OUTSIDE to prevent re-renders
function ChatByIdPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user } = useAuth();
  const [session, setSession] = useState<ChatSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadChat() {
      if (!id) return;
      setIsLoading(true);

      try {
        let sessions: ChatSession[];
        if (user) {
          sessions = await getSupabaseSessions(user.id);
        } else {
          sessions = getLocalSessions();
        }

        const found = sessions.find(s => s.id === id);
        setSession(found || null);
      } catch (error) {
        console.error('Failed to load chat:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadChat();
  }, [id, user]);

  if (isLoading) {
    return (
      <div className={`min-h-screen ${theme.background} flex items-center justify-center`}>
        <div className="w-10 h-10 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className={`min-h-screen ${theme.background} flex items-center justify-center p-4`}>
        <div className="text-center">
          <p className="text-white/50 text-lg mb-4">Chat not found</p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/')}
            className="px-6 py-3 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-200"
          >
            Go Home
          </motion.button>
        </div>
      </div>
    );
  }

  navigate('/');
  return null;
}

// Main Chat Page component - defined OUTSIDE to prevent re-renders
interface MainChatPageProps {
  groupChatId?: string;
  brandOverride?: BrandOverride;
  backgroundClass?: string;
}

function MainChatPage({ groupChatId, brandOverride, backgroundClass: customBackgroundClass }: MainChatPageProps = {}) {
  const { theme } = useTheme();
  const { user, profile, loading: authLoading, profileLoading, needsOnboarding, updateLastPersona } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (MAINTENANCE_MODE) {
      window.location.href = '/maintenance.html';
    }
  }, []);

  // Check if we're loading a session from history BEFORE useChat initialization
  // This prevents the init effect from overwriting loaded messages
  const sessionToLoad = location.state?.sessionToLoad as ChatSession | undefined;

  // Check if navigating from healthcare page to auto-enable TM Healthcare mode
  const healthcareModeFromNav = location.state?.healthcareMode as boolean | undefined;

  // Track the active special mode from ChatInput (for theme overrides)
  const [activeChatMode, setActiveChatMode] = useState<string | null>(
    healthcareModeFromNav ? 'tm-healthcare' : null
  );

  // Group chat mode detection
  const isGroupMode = !!groupChatId;

  // Group chat state
  const [, setGroupChat] = useState<GroupChat | null>(null);
  const [isGroupChatLoading, setIsGroupChatLoading] = useState(false);
  const [isGroupParticipant, setIsGroupParticipant] = useState(false);
  const [isJoiningGroup, setIsJoiningGroup] = useState(false);
  const [groupInviteInfo, setGroupInviteInfo] = useState<{ owner_nickname: string; chat_name: string; participant_count: number; persona: string } | null>(null);

  // Reply state for group chat
  const [replyTo, setReplyTo] = useState<{ id: string; content: string; sender_nickname?: string; isAI: boolean } | null>(null);

  // Get initial persona from profile (validated against AI_PERSONAS)
  // If loading from history, use the session's persona instead
  const savedPersona = profile?.last_persona as keyof typeof AI_PERSONAS | null;
  const initialPersona = sessionToLoad
    ? sessionToLoad.persona
    : (!profileLoading && savedPersona && savedPersona in AI_PERSONAS ? savedPersona : undefined);

  const [flowStateActive, setFlowStateActive] = useState(false);

  const {
    messages,
    isChatMode,
    isLoading,
    currentPersona,
    currentProHeatLevel,
    currentEmotion,
    error,
    showAboutUs,
    streamingMessageId,
    youtubeMusic,
    loadingPhase,
    currentSessionId,
    // Collaborative mode
    isCollaborative,
    collaborativeId,
    participants,
    // Actions
    handleSendMessage,
    retryMessage,
    stopGeneration,
    handlePersonaChange: handlePersonaChangeInternal,
    setCurrentProHeatLevel,
    startNewChat,
    markMessageAsAnimated,
    dismissAboutUs,
    loadChat,
    clearYoutubeMusic,
    enableCollaborativeMode,
    joinCollaborativeChat,
    updateMessageReactions,
    updateMusicVariations,
    handleMcpApprovalDecision,
    // Remote music
    pendingRemoteMusic,
    playPendingMusic,
    dismissPendingMusic
  } = useChat(
    user?.id,
    profile || undefined,
    initialPersona,
    // The saved persona lives on the profile, so chat state waits for that —
    // not for the session, and not for anything the shell renders.
    authLoading || profileLoading,
    // Pass session to load directly so it's available immediately on mount
    sessionToLoad ? {
      messages: sessionToLoad.messages.filter(msg => msg.content && msg.content.trim() !== ''),
      id: sessionToLoad.id,
      heat_level: sessionToLoad.heat_level
    } : null,
    flowStateActive
  );

  // Synced Lyrics Player Integration States
  const [lyricsTrack, setLyricsTrack] = useState<LyricsTrack | null>(null);
  const [lyricsList, setLyricsList] = useState<LyricLine[]>([]);
  const [lyricsSynced, setLyricsSynced] = useState<boolean>(false);
  const [lyricsCurrentTime, setLyricsCurrentTime] = useState<number>(0);
  const [lyricsDuration, setLyricsDuration] = useState<number>(0);
  const [lyricsIsPlaying, setLyricsIsPlaying] = useState<boolean>(false);
  const [lyricsIsLoading, setLyricsIsLoading] = useState<boolean>(false);
  const [lyricsError, setLyricsError] = useState<string | null>(null);
  const [isLyricsMaximized, setIsLyricsMaximized] = useState<boolean>(false);
  const [lyricsPlayer, setLyricsPlayer] = useState<YT.Player | null>(null);

  const handleLyricsPlay = useCallback(async (query: string) => {
    if (clearYoutubeMusic) {
      clearYoutubeMusic(); // Stop standard AI music
    }
    setLyricsIsLoading(true);
    setLyricsError(null);
    setIsLyricsMaximized(true);
    try {
      const results = await searchMusic(query);
      if (results.length > 0) {
        const track = results[0];
        setLyricsTrack(track);
        const lyricData = await getLyrics(track.artist, track.title);
        if (lyricData) {
          setLyricsList(lyricData.lyrics);
          setLyricsSynced(lyricData.synced);
        } else {
          setLyricsList([]);
          setLyricsSynced(false);
        }
      } else {
        setLyricsError("No tracks found.");
      }
    } catch {
      setLyricsError("Failed to search. Please try again.");
    } finally {
      setLyricsIsLoading(false);
    }
  }, [clearYoutubeMusic]);

  // If AI starts playing youtubeMusic, stop the lyrics track
  useEffect(() => {
    if (!youtubeMusic) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLyricsTrack(null);
      setLyricsList([]);
      setLyricsIsPlaying(false);
      setLyricsCurrentTime(0);
      setLyricsDuration(0);
      setIsLyricsMaximized(false);
    });
    return () => { cancelled = true; };
  }, [youtubeMusic]);

  // Check if navigating from homepage with a playQuery
  const playQueryFromNav = location.state?.playQuery as string | undefined;

  // Clear navigation state after loading session/healthcare mode/playQuery to prevent reload on refresh
  useEffect(() => {
    if (!sessionToLoad && !healthcareModeFromNav && !playQueryFromNav) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (playQueryFromNav) void handleLyricsPlay(playQueryFromNav);
      window.history.replaceState({}, '', '/');
    });
    return () => { cancelled = true; };
  }, [playQueryFromNav, handleLyricsPlay, sessionToLoad, healthcareModeFromNav]);

  const { isRateLimited, getRemainingMessages, isAnonymous } = useAnonymousRateLimit(currentPersona, isLoading);

  // Wrapper for persona change that also persists to profile
  const handlePersonaChange = useCallback((persona: keyof typeof AI_PERSONAS) => {
    handlePersonaChangeInternal(persona);
    // Save to profile if user is logged in
    updateLastPersona(persona);
  }, [handlePersonaChangeInternal, updateLastPersona]);

  // Derive chat name from first user message - memoized to prevent recalculation
  const currentChatName = useMemo(() => {
    const firstUserMessage = messages.find(msg => !msg.isAI);
    if (firstUserMessage?.content && firstUserMessage.content.trim()) {
      return firstUserMessage.content.slice(0, 50);
    }
    return 'New Chat';
  }, [messages]);

  const [showGroupChatModal, setShowGroupChatModal] = useState(false);
  const [isHeatLevelExpanded, setIsHeatLevelExpanded] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(() => {
    if (!ACCESS_TOKEN_REQUIRED) return false;
    const accessGranted = localStorage.getItem('timeMachine_accessGranted');
    return accessGranted !== 'true';
  });

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [authModalMessage, setAuthModalMessage] = useState<string | undefined>();

  useEffect(() => {
    if (authLoading || !needsOnboarding) return;
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) setShowOnboarding(true); });
    return () => { cancelled = true; };
  }, [authLoading, needsOnboarding]);

  // Group chat loading and subscription
  useEffect(() => {
    if (!isGroupMode || !groupChatId) return;
    // Narrowed once, here: the async closure below does not inherit the guard.
    const chatId = groupChatId;

    async function loadGroupChat() {
      setIsGroupChatLoading(true);

      // Get invite info first
      const invite = await getGroupChatInvite(chatId);
      if (invite) {
        setGroupInviteInfo(invite);
      }

      // Check if user is a participant
      if (user) {
        const participant = await isGroupChatParticipant(chatId, user.id);
        setIsGroupParticipant(participant);

        if (participant) {
          const chat = await getGroupChat(chatId);
          setGroupChat(chat);
        }
      }

      setIsGroupChatLoading(false);
    }

    loadGroupChat();
  }, [isGroupMode, groupChatId, user]);

  // Real-time updates are handled by useChat's joinCollaborativeChat subscription
  // which updates the messages state that ChatMode renders from

  // Handle joining group chat
  const handleJoinGroupChat = useCallback(async () => {
    if (!groupChatId || !user || !profile) return;

    setIsJoiningGroup(true);
    const success = await joinGroupChat(
      groupChatId,
      user.id,
      profile.nickname || 'User',
      profile.avatar_url || undefined
    );

    if (success) {
      setIsGroupParticipant(true);
      // Initialize useChat collaborative mode
      await joinCollaborativeChat(groupChatId);
    }
    setIsJoiningGroup(false);
  }, [groupChatId, user, profile, joinCollaborativeChat]);

  // When already a participant on /groupchat/:id, sync useChat to collaborative mode
  useEffect(() => {
    if (isGroupMode && groupChatId && isGroupParticipant && !isCollaborative) {
      joinCollaborativeChat(groupChatId);
    }
  }, [isGroupMode, groupChatId, isGroupParticipant, isCollaborative, joinCollaborativeChat]);

  useEffect(() => {
    const updateVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    updateVH();
    window.addEventListener('resize', updateVH);
    return () => window.removeEventListener('resize', updateVH);
  }, []);

  // Memoize button styles to prevent recalculation
  const personaBackgroundColors: Record<string, string> = useMemo(() => ({
    default: 'rgba(139,0,255,0.2)',
    girlie: 'rgba(199,21,133,0.2)',
    pro: 'rgba(30,144,255,0.2)'
  }), []);

  const buttonStyles = useMemo(() => ({
    bg: personaBackgroundColors[currentPersona] || personaBackgroundColors.default,
    text: theme.text,
  }), [currentPersona, theme.text, personaBackgroundColors]);

  const heatLevelButtonStyles = useMemo(() => ({
    border: isHeatLevelExpanded ? '1px solid rgba(34, 211, 238, 0.5)' : '1px solid rgba(34, 211, 238, 0.3)',
    bg: isHeatLevelExpanded
      ? 'linear-gradient(135deg, rgba(34, 211, 238, 0.3), rgba(255, 255, 255, 0.05))'
      : 'linear-gradient(135deg, rgba(34, 211, 238, 0.15), rgba(255, 255, 255, 0.05))',
    shadow: isHeatLevelExpanded
      ? '0 0 20px rgba(34, 211, 238, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
      : '0 0 12px rgba(34, 211, 238, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
    text: isHeatLevelExpanded ? 'rgb(135,206,250)' : theme.text,
  }), [isHeatLevelExpanded, theme.text]);

  const flowStateButtonStyles = useMemo(() => ({
    border: flowStateActive ? '1px solid rgba(168, 85, 247, 0.5)' : '1px solid rgba(168, 85, 247, 0.4)',
    bg: flowStateActive
      ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.3), rgba(255, 255, 255, 0.05))'
      : 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(255, 255, 255, 0.05))',
    shadow: flowStateActive
      ? '0 0 20px rgba(168, 85, 247, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
      : '0 0 15px rgba(168, 85, 247, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
    text: flowStateActive ? 'rgb(216, 180, 254)' : theme.text,
  }), [flowStateActive, theme.text]);

  const handleAccessGranted = useCallback(() => {
    setShowWelcomeModal(false);
  }, []);

  // Memoized send message handler
  const handleSendMessageWithRateLimit = useCallback(async (
    message: string,
    imageUrl?: string | string[],
    imageUrls?: string[],
    imageDimensions?: import('./types/chat').ImageDimensions,
    replyToData?: import('./types/chat').ReplyToData,
    specialMode?: string,
    pdfData?: string,
    pdfFileName?: string
  ) => {
    // Intercept trigger word "play " case-insensitively
    if (message.trim().toLowerCase().startsWith('play ')) {
      const query = message.trim().slice(5).trim();
      if (query) {
        handleLyricsPlay(query);
      }
      return;
    }

    // Minimize lyrics view for normal user requests to keep the AI functional in view
    setIsLyricsMaximized(false);

    const mentionMatch = message.match(/^@(girlie|pro)\s/i);
    const targetModel = mentionMatch ? mentionMatch[1].toLowerCase() : currentPersona;

    if (isAnonymous && isRateLimited(targetModel)) {
      let authMessage: string;
      if (targetModel === 'pro') {
        authMessage = "PRO mode requires a TimeMachine ID. Create one to access advanced features!";
      } else if (targetModel === 'girlie') {
        authMessage = "Girlie mode requires a TimeMachine ID. Create one to unlock this persona!";
      } else {
        authMessage = "You've used your 3 free messages! Create a TimeMachine ID to continue chatting.";
      }
      setAuthModalMessage(authMessage);
      setShowAuthModal(true);
      return;
    }

    // No optimistic increment: the count is re-read from the server when the
    // turn finishes (see useAnonymousRateLimit's falling-edge effect), so a
    // failed generation leaves it unchanged — production-check.md 0.4.
    await handleSendMessage(message, imageUrl, imageUrls, imageDimensions, replyToData || replyTo || undefined, specialMode, pdfData, pdfFileName);

    // Clear reply after sending
    setReplyTo(null);
  }, [currentPersona, isAnonymous, isRateLimited, handleSendMessage, replyTo, handleLyricsPlay, setIsLyricsMaximized]);

  // Reply handlers for group chat
  const handleReply = useCallback((message: { id: string; content: string; sender_nickname?: string; isAI: boolean }) => {
    setReplyTo(message);
  }, []);

  const handleClearReply = useCallback(() => {
    setReplyTo(null);
  }, []);

  // Handle reactions on messages
  const handleReact = useCallback(async (messageId: string, emoji: string) => {
    if (!user) return;

    const newReactions = await toggleMessageReaction(messageId, emoji, user.id);
    if (newReactions) {
      // Update local message state with new reactions
      updateMessageReactions(messageId, newReactions);
    }
  }, [user, updateMessageReactions]);

  const handleOpenAuth = useCallback(() => {
    setAuthModalMessage(undefined);
    setShowAuthModal(true);
  }, []);

  const handleOpenAccount = useCallback(() => {
    navigate('/account');
  }, [navigate]);

  const handleOpenHistory = useCallback(() => {
    navigate('/history');
  }, [navigate]);

  const handleOpenSettings = useCallback(() => {
    navigate('/settings');
  }, [navigate]);

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false);
  }, []);

  const handleGroupChatCreated = useCallback(async (chatName: string): Promise<string | null> => {
    const shareId = await enableCollaborativeMode(chatName);
    if (shareId) {
      console.log('Collaborative mode enabled:', shareId);
    }
    return shareId;
  }, [enableCollaborativeMode]);

  if (MAINTENANCE_MODE) {
    return null;
  }

  if (showWelcomeModal) {
    return (
      <div className={`min-h-screen ${theme.background} ${theme.text} relative overflow-hidden`}>
        <WelcomeModal
          isOpen={showWelcomeModal}
          onAccessGranted={handleAccessGranted}
        />
      </div>
    );
  }

  // No auth gate here. The shell — header, transcript, composer — renders on
  // the first frame and auth resolves behind it; this early return was the
  // single reason a first-time visitor watched a bare spinner for up to eight
  // seconds before anything painted (production-check.md 1.14).

  // Override background for healthcare mode (green gradient instead of season theme)
  const isHealthcareActive = activeChatMode === 'tm-healthcare';
  const backgroundClass = customBackgroundClass
    ? customBackgroundClass
    : isHealthcareActive
      ? 'bg-linear-to-t/srgb from-green-950 to-black to-50%'
      : theme.background;

  return (
    <div
      id={brandOverride ? 'reveoule-theme' : undefined}
      className={`min-h-screen ${backgroundClass} ${theme.text} relative overflow-hidden transition-all duration-700`}
      style={{ minHeight: 'calc(var(--vh, 1vh) * 100)' }}
    >
      <main className="relative h-screen flex flex-col" style={{ height: 'calc(var(--vh, 1vh) * 100)' }}>
        <header className="fixed top-0 left-0 right-0 z-50 px-4 py-3 bg-transparent">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <BrandLogo
              currentPersona={currentPersona}
              onPersonaChange={handlePersonaChange}
              onLoadChat={loadChat}
              onStartNewChat={startNewChat}
              onOpenAuth={handleOpenAuth}
              onOpenAccount={handleOpenAccount}
              onOpenHistory={handleOpenHistory}
              onOpenSettings={handleOpenSettings}
              brandOverride={brandOverride}
            />
            <div className="flex items-center gap-2">
              {isAnonymous && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/50">
                  <span>{getRemainingMessages(currentPersona)} free messages left</span>
                </div>
              )}

              {isAnonymous ? (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleOpenAuth}
                  style={{
                    background: buttonStyles.bg,
                    color: buttonStyles.text,
                    borderRadius: '9999px',
                    backdropFilter: 'blur(10px)',
                    outline: 'none',
                    padding: '8px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.3s ease',
                  }}
                  aria-label="Sign Up"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3.00006 7.63576C4.6208 4.29965 8.04185 2 12 2C17.5229 2 22 6.47715 22 12C22 17.5228 17.5229 22 12 22C8.04185 22 4.6208 19.7004 3.00006 16.3642" />
                    <path d="M11 8C11 8 15 10.946 15 12C15 13.0541 11 16 11 16M14.5 12H2" />
                  </svg>
                  <span style={{ fontSize: '14px', color: buttonStyles.text }}>Sign Up</span>
                </motion.button>
              ) : currentPersona === 'pro' ? (
                <div className="relative">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsHeatLevelExpanded(!isHeatLevelExpanded)}
                    style={{
                      background: heatLevelButtonStyles.bg,
                      color: heatLevelButtonStyles.text,
                      border: heatLevelButtonStyles.border,
                      boxShadow: heatLevelButtonStyles.shadow,
                      borderRadius: '9999px',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                      outline: 'none',
                      padding: '8px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.3s ease',
                    }}
                    aria-label={isHeatLevelExpanded ? "Close Heat Level" : "Open Heat Level"}
                  >
                    <Star style={{ width: '16px', height: '16px', color: heatLevelButtonStyles.text }} />
                    <span style={{ fontSize: '14px', color: heatLevelButtonStyles.text }}>
                      Heat Level {currentProHeatLevel}
                    </span>
                  </motion.button>

                  <AnimatePresence>
                    {isHeatLevelExpanded && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                        className="absolute top-full right-0 mt-3 w-72 bg-black/10 backdrop-blur-3xl rounded-3xl z-50 overflow-hidden border border-white/5"
                        style={{
                          background: 'linear-gradient(145deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))'
                        }}
                      >
                        {Object.entries(PRO_HEAT_LEVELS).map(([level, config]) => (
                          <motion.button
                            key={level}
                            whileHover={{
                              scale: 1.03,
                              background: 'linear-gradient(90deg, rgba(34,211,238,0.2) 0%, transparent 100%)'
                            }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => {
                              setCurrentProHeatLevel(parseInt(level));
                              setIsHeatLevelExpanded(false);
                            }}
                            className={`w-full px-4 py-3 text-left transition-all duration-300
                              ${currentProHeatLevel === parseInt(level) ? 'text-cyan-400' : theme.text}
                              ${currentProHeatLevel === parseInt(level) ? 'bg-linear-to-r/srgb from-cyan-500/20 to-black/10' : 'bg-transparent'}
                              flex flex-col gap-1 border-b border-white/5 last:border-b-0`}
                            style={{
                              background: currentProHeatLevel === parseInt(level) ?
                                'linear-gradient(to right, rgba(34,211,238,0.2), rgba(0,0,0,0.1))' :
                                'transparent'
                            }}
                          >
                            <div className="font-bold text-sm">{config.name}</div>
                            <div className={`text-xs opacity-70 ${theme.text}`}>
                              {config.description}
                            </div>
                          </motion.button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : currentPersona === 'default' ? (
                // Flow State button for Air persona — liquid glass style
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setFlowStateActive(!flowStateActive)}
                  style={{
                    background: flowStateButtonStyles.bg,
                    color: flowStateButtonStyles.text,
                    border: flowStateButtonStyles.border,
                    boxShadow: flowStateButtonStyles.shadow,
                    borderRadius: '9999px',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    outline: 'none',
                    padding: '8px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.3s ease',
                  }}
                  aria-label={flowStateActive ? "Disable Flow State" : "Enable Flow State"}
                >
                  <Zap style={{ width: '16px', height: '16px', color: flowStateButtonStyles.text, fill: flowStateActive ? flowStateButtonStyles.text : 'none' }} />
                  <span style={{ fontSize: '14px', color: flowStateButtonStyles.text }}>
                    Flow State
                  </span>
                </motion.button>
              ) : currentPersona === 'girlie' && (
                isCollaborative && collaborativeId ? (
                  // Group Settings button when in collaborative mode
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate(`/groupchat/${collaborativeId}/settings`)}
                    style={{
                      background: buttonStyles.bg,
                      color: buttonStyles.text,
                      borderRadius: '9999px',
                      backdropFilter: 'blur(10px)',
                      outline: 'none',
                      padding: '8px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.3s ease',
                    }}
                    aria-label="Group Settings"
                  >
                    <Settings style={{ width: '16px', height: '16px', color: buttonStyles.text }} />
                    <span style={{ fontSize: '14px', color: buttonStyles.text }}>Group Settings</span>
                  </motion.button>
                ) : (
                  // Create Group Chat button
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowGroupChatModal(true)}
                    style={{
                      background: buttonStyles.bg,
                      color: buttonStyles.text,
                      borderRadius: '9999px',
                      backdropFilter: 'blur(10px)',
                      outline: 'none',
                      padding: '8px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.3s ease',
                    }}
                    aria-label="Open Group Chat"
                  >
                    <Users style={{ width: '16px', height: '16px', color: buttonStyles.text }} />
                    <span style={{ fontSize: '14px', color: buttonStyles.text }}>Group Chat</span>
                  </motion.button>
                )
              )}
            </div>
          </div>
        </header>

        <MusicPlayer
          currentPersona={currentPersona}
          currentEmotion={currentEmotion}
          isCenterStage={false}
        />

        {youtubeMusic && (
          <YouTubePlayer
            musicData={youtubeMusic}
            onClose={clearYoutubeMusic}
            currentPersona={currentPersona}
          />
        )}

        {lyricsTrack && (
          <LyricsYouTubePlayer
            videoId={lyricsTrack.id}
            onTimeUpdate={setLyricsCurrentTime}
            onDurationChange={setLyricsDuration}
            onPlayerStateChange={(state) => {
              if (state === 1) setLyricsIsPlaying(true);
              if (state === 2) setLyricsIsPlaying(false);
            }}
            onReady={setLyricsPlayer}
          />
        )}

        {lyricsTrack && (
          <LyricsMiniPlayer
            track={lyricsTrack}
            isPlaying={lyricsIsPlaying}
            onPlayPause={() => {
              if (lyricsPlayer) {
                if (lyricsIsPlaying) {
                  lyricsPlayer.pauseVideo();
                } else {
                  lyricsPlayer.playVideo();
                }
              }
            }}
            onClose={() => {
              setLyricsTrack(null);
              setLyricsList([]);
              setLyricsIsPlaying(false);
              setLyricsCurrentTime(0);
              setLyricsDuration(0);
              setIsLyricsMaximized(false);
            }}
            onMaximize={() => setIsLyricsMaximized(!isLyricsMaximized)}
            currentTime={lyricsCurrentTime}
            duration={lyricsDuration}
            isMaximized={isLyricsMaximized}
            onSeek={(time) => {
              if (lyricsPlayer) {
                lyricsPlayer.seekTo(time, true);
              }
            }}
          />
        )}

        {/* Play for me too - shown when someone else plays music in group chat */}
        {/* Hidden when same music is already playing locally (youtubeMusic.videoId === pendingRemoteMusic.videoId) */}
        {pendingRemoteMusic && youtubeMusic?.videoId !== pendingRemoteMusic.videoId && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-4 right-4 sm:left-auto sm:right-4 sm:w-72 z-50"
          >
            <div
              className="p-4 rounded-2xl"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{pendingRemoteMusic.title}</p>
                  <p className="text-white/60 text-xs truncate">{pendingRemoteMusic.artist}</p>
                </div>
                <button
                  onClick={dismissPendingMusic}
                  className="p-1.5 rounded-full"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                  }}
                >
                  <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={playPendingMusic}
                className="w-full py-2.5 px-4 rounded-xl text-white font-medium text-sm flex items-center justify-center gap-2"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Play for me too
              </motion.button>
            </div>
          </motion.div>
        )}

        <div className={`flex-1 custom-scrollbar message-container ${
          isLyricsMaximized && (lyricsTrack || lyricsIsLoading || lyricsError)
            ? 'overflow-hidden flex flex-col justify-center items-center'
            : 'overflow-y-auto'
        }`}>
          {/* Group chat join UI */}
          {isGroupMode && !isGroupParticipant && !isGroupChatLoading && (
            <div className="min-h-full flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md"
              >
                <div className="relative overflow-hidden rounded-3xl">
                  <div className="absolute inset-0 bg-linear-to-br/srgb from-white/[0.08] to-white/[0.02] backdrop-blur-2xl" />
                  <div className="absolute inset-0 bg-linear-to-br/srgb from-purple-500 to-violet-500 opacity-20" />
                  <div className="absolute inset-[1px] rounded-3xl border border-white/[0.08]" />

                  <div className="relative p-8 text-center">
                    <div className="inline-flex p-4 rounded-2xl bg-white/10 mb-6">
                      <Users className="w-8 h-8 text-white" />
                    </div>

                    <h1 className="text-2xl font-bold text-white mb-2">
                      {groupInviteInfo?.chat_name || 'Group Chat'}
                    </h1>

                    <p className="text-white/60 mb-6">
                      {user ? (
                        <>Hosted by <span className="text-white font-medium">{groupInviteInfo?.owner_nickname}</span></>
                      ) : (
                        'Sign in to join this group chat'
                      )}
                    </p>

                    {user ? (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleJoinGroupChat}
                        disabled={isJoiningGroup}
                        className="w-full py-4 rounded-xl bg-linear-to-r/srgb from-purple-500 to-violet-500 text-white font-semibold flex items-center justify-center gap-2"
                      >
                        {isJoiningGroup ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          'Join Group Chat'
                        )}
                      </motion.button>
                    ) : (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleOpenAuth}
                        className="w-full py-4 rounded-xl bg-linear-to-r/srgb from-purple-500 to-violet-500 text-white font-semibold"
                      >
                        Sign In to Join
                      </motion.button>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* Regular chat mode */}
          {(!isGroupMode || isGroupParticipant) && (
            <>
              {isLyricsMaximized && (lyricsTrack || lyricsIsLoading || lyricsError) ? (
                <div className="flex-1 flex flex-col items-center justify-center p-4 relative min-h-[60vh] w-full">
                  {/* Minimize Button */}
                  <div className="absolute top-4 right-4 z-40">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setIsLyricsMaximized(false)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full text-white/70 hover:text-white transition-colors text-xs font-medium"
                      style={{
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                      }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      <span>Minimize</span>
                    </motion.button>
                  </div>

                  {lyricsIsLoading ? (
                    <motion.div 
                      key="lyrics-loader"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center gap-4 py-20"
                    >
                      <div className="w-10 h-10 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                      <p className="text-white/40 font-medium tracking-widest uppercase text-xs">Finding your track...</p>
                    </motion.div>
                  ) : lyricsError ? (
                    <div className="text-center px-4 py-20">
                      <p className="text-red-400 text-lg mb-2">{lyricsError}</p>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsLyricsMaximized(false)}
                        className="text-white/60 hover:text-white text-sm underline"
                      >
                        Go back to chat
                      </motion.button>
                    </div>
                  ) : (
                    <LyricsDisplay 
                      lyrics={lyricsList}
                      currentTime={lyricsCurrentTime}
                      onSeek={(time) => {
                        if (lyricsPlayer) {
                          lyricsPlayer.seekTo(time, true);
                        }
                      }}
                      isSynced={lyricsSynced}
                    />
                  )}
                </div>
              ) : isChatMode ? (
                // A second boundary around just the transcript: a message that
                // fails to render should not take the composer and header
                // with it (1.3).
                <ErrorBoundary
                  name="transcript"
                  fallback={(reset) => (
                    <div className="mx-auto mt-24 max-w-md rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-5 text-center">
                      <p className="text-sm text-amber-100/80">
                        This conversation couldn&apos;t be displayed.
                      </p>
                      <div className="mt-4 flex items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={reset}
                          className="rounded-full border border-white/15 bg-white/[0.08] px-4 py-1.5 text-xs font-medium hover:bg-white/[0.14]"
                        >
                          Try again
                        </button>
                        <button
                          type="button"
                          onClick={() => { reset(); startNewChat(); }}
                          className="rounded-full border border-white/10 px-4 py-1.5 text-xs font-medium text-white/70 hover:bg-white/[0.06] hover:text-white"
                        >
                          Start a new chat
                        </button>
                      </div>
                    </div>
                  )}
                >
                <ChatMode
                  messages={messages}
                  currentPersona={currentPersona}
                  onMessageAnimated={markMessageAsAnimated}
                  error={error}
                  streamingMessageId={streamingMessageId}
                  loadingPhase={loadingPhase}
                  isGroupMode={isGroupMode}
                  currentUserId={user?.id}
                  onReply={isCollaborative ? handleReply : undefined}
                  onReact={isCollaborative ? handleReact : undefined}
                  brandOverride={brandOverride}
                  onMusicVariationsChange={updateMusicVariations}
                  // app.sesame.com sends `frame-ancestors 'none'` and
                  // `x-frame-options: DENY`, so the old in-app panel could only
                  // ever render a blank box — and its `permissions-policy`
                  // grants the microphone to `self` only, which a cross-origin
                  // frame would never satisfy. A new tab is the only path left.
                  onOpenSesame={() => window.open('https://app.sesame.com', '_blank', 'noopener,noreferrer')}
                  onMcpApprovalDecision={handleMcpApprovalDecision}
                  onRetry={retryMessage}
                  isRetrying={isLoading}
                />
                </ErrorBoundary>
              ) : (
                <StageMode
                  messages={messages}
                  currentPersona={currentPersona}
                  onMessageAnimated={markMessageAsAnimated}
                  streamingMessageId={streamingMessageId}
                  loadingPhase={loadingPhase}
                />
              )}
            </>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-transparent">
          <div className="max-w-4xl mx-auto">
            <ChatInput
              onSendMessage={handleSendMessageWithRateLimit}
              isLoading={isLoading}
              currentPersona={currentPersona}
              isGroupMode={isCollaborative}
              participants={participants}
              replyTo={replyTo}
              onClearReply={handleClearReply}
              initialMode={healthcareModeFromNav ? 'tm-healthcare' : undefined}
              onModeChange={setActiveChatMode}
              onStop={stopGeneration}
            />
          </div>
        </div>

        <AboutUsToast
          isVisible={showAboutUs}
          onClose={dismissAboutUs}
          currentPersona={currentPersona}
        />

        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          message={authModalMessage}
        />

        <OnboardingModal
          isOpen={showOnboarding}
          onComplete={handleOnboardingComplete}
        />

        <GroupChatModal
          isOpen={showGroupChatModal}
          onClose={() => setShowGroupChatModal(false)}
          sessionId={currentSessionId}
          chatName={currentChatName || 'Group Chat'}
          persona={currentPersona}
          onGroupChatCreated={handleGroupChatCreated}
        />
      </main>
    </div>
  );
}

function AppContent() {
  const { theme } = useTheme();
  const navigate = useNavigate();

  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
      <Route path="/" element={<><SEOHead /><MainChatPage /></>} />
      <Route path="/reveoule" element={
        <>
          <SEOHead title="Rêveoulé" description="Beauty products collab" path="/reveoule" noIndex />
          <MainChatPage
            brandOverride={{
              name: 'Rêveoulé',
              textColorClass: 'text-[#59090C]',
              glowColor: 'transparent',
              personaName: 'Skin Advisor'
            }}
            backgroundClass="reveoule-bg"
          />
        </>
      } />
      <Route path="/home" element={<><SEOHead title="Home" description="TimeMachine — the everything app. Chat, Canvas, Education, Healthcare, Shopping, and more." path="/home" /><HomePage /></>} />
      <Route path="/account" element={
        <div className={`min-h-screen ${theme.background} ${theme.text} relative overflow-hidden`}>
          <SEOHead title="Account" description="Manage your TimeMachine Chat account settings and profile." path="/account" noIndex />
          <AccountPage onBack={() => navigate('/')} />
        </div>
      } />
      <Route path="/history" element={
        <>
          <SEOHead title="Chat History" description="View and continue your previous TimeMachine Chat conversations." path="/history" noIndex />
          <ChatHistoryPage onLoadChat={(session) => {
            // Pass session via navigation state so MainChatPage can load it
            navigate('/', { state: { sessionToLoad: session } });
          }} />
        </>
      } />
      <Route path="/settings" element={<><SEOHead title="Settings" description="Customize your TimeMachine Chat experience with themes, personas, and preferences." path="/settings" noIndex /><SettingsPage /></>} />
      <Route path="/about" element={<><SEOHead title="About" description="Learn about TimeMachine — the super app bringing AI personas, privacy-first design, and intelligent tools into one chat interface. Built by TimeMachine Mafia." path="/about" /><AboutPage /></>} />
      <Route path="/personas" element={<><SEOHead title="Personas" description="Meet the TimeMachine AI personas — TimeMachine Air for everyday speed, TimeMachine Girlie for vibe-check conversations, and TimeMachine PRO for advanced intelligence." path="/personas" /><PersonasPage /></>} />
      <Route path="/features" element={<><SEOHead title="Features" description="Explore TimeMachine features — Contour command palette with 30+ tools, group chat, TM Healthcare, image generation, music streaming, memory system, voice input, and more." path="/features" /><FeaturesPage /></>} />
      <Route path="/contact" element={<><SEOHead title="Contact" description="Get in touch with the TimeMachine team for support, feedback, or collaboration." path="/contact" /><ContactPage /></>} />
      <Route path="/privacy" element={<><SEOHead title="Privacy Policy" description="How TimeMachine Chat collects, uses, and protects your data — including which third-party AI providers receive your prompts." path="/privacy" /><PrivacyPage /></>} />
      <Route path="/terms" element={<><SEOHead title="Terms of Service" description="The terms governing your use of TimeMachine Chat." path="/terms" /><TermsPage /></>} />
      <Route path="/album" element={<><SEOHead title="Album" path="/album" noIndex /><AlbumPage /></>} />
      <Route path="/memories" element={<><SEOHead title="Memories" path="/memories" noIndex /><MemoriesPage /></>} />
      <Route path="/help" element={<><SEOHead title="Help" description="Get help with TimeMachine — learn about AI personas, group chats, image generation, and all features." path="/help" /><HelpPage /></>} />
      <Route path="/notes" element={<><SEOHead title="Notes" description="Capture your thoughts with TimeMachine Notes — a powerful Notion-like editor built right into TimeMachine." path="/notes" /><NotesPage /></>} />
      <Route path="/healthcare" element={<><SEOHead title="Healthcare" description="Search medicines, brands, generics, and drug information — including dosage, side effects, and indications. Powered by TimeMachine Healthcare." path="/healthcare" /><HealthcarePage /></>} />
      <Route path="/shop" element={<><SEOHead title="Shop" description="Physical goods from the TimeMachine universe. Apparel, accessories, and more." path="/shop" /><ShopPage /></>} />
      <Route path="/lifestyle" element={<><SEOHead title="Lifestyle" description="Everyday essentials — calendar, shopping list, and expense tracker. All in one place with TimeMachine." path="/lifestyle" /><LifestyleLayout /></>}>
        <Route index element={<Navigate to="cookbook" replace />} />
        <Route path="cookbook" element={<><SEOHead title="CookBook" path="/lifestyle/cookbook" /><CookBookPage /></>} />
        <Route path="fashion" element={<><SEOHead title="Fashion" path="/lifestyle/fashion" /><FashionPage /></>} />
        <Route path="shopping-list" element={<><SEOHead title="Shopping List" path="/lifestyle/shopping-list" /><ShoppingListPage /></>} />
        <Route path="calendar" element={<><SEOHead title="Calendar" path="/lifestyle/calendar" /><PremiumCalendarPage /></>} />
      </Route>
      <Route path="/chat/:id" element={<><SEOHead title="Chat" noIndex /><ChatByIdPage /></>} />
      <Route path="/groupchat/:id" element={<><SEOHead title="Group Chat" noIndex /><GroupChatWrapper /></>} />
      <Route path="/groupchat/:id/settings" element={<><SEOHead title="Group Settings" noIndex /><GroupSettingsPage /></>} />
      <Route path="*" element={<><SEOHead title="Page not found" description="This TimeMachine page doesn't exist." noIndex /><NotFoundPage /></>} />
      </Routes>
    </Suspense>
  );
}

// Wrapper to pass group chat ID to MainChatPage
function GroupChatWrapper() {
  const { id } = useParams<{ id: string }>();
  return <MainChatPage groupChatId={id} />;
}

function AppWithAuth() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppWithAuth />
    </ThemeProvider>
  );
}
