import { AppAtmosphere } from './components/shared/AppAtmosphere';
import React, { useLayoutEffect, Suspense, lazy, useEffect, useState, useMemo, useCallback, useRef } from 'react';
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
import { Users, Settings, Zap, PanelRightOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import { useChat } from './hooks/useChat';
import { useAnonymousRateLimit } from './hooks/useAnonymousRateLimit';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NotFoundPage } from './components/NotFoundPage';
import { AboutUsToast } from './components/about/AboutUsToast';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { SettingsModalContext, useSettingsModal } from './context/settingsModalContext';
// Imported statically on purpose: it is a modal over the current page, and
// a lazy chunk would suspend the route tree (spinner, page blink) the first
// time it opens.
import { SettingsModal } from './components/settings/SettingsModal';
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
import { ACCESS_TOKEN_REQUIRED, MAINTENANCE_MODE, AI_PERSONAS } from './config/constants';
import { ChatSession, chatService, getSupabaseSessions, getLocalSessions, isPersistable } from './services/chat/chatService';
import { MaxModeButton } from './components/maxmode/MaxModeButton';
import { MaxModePill } from './components/maxmode/MaxModePill';
import { GlassPill } from './components/maxmode/glass';
import { workspaceModeFor } from './services/workspace/harnessBridge';
import { githubExchange } from './services/workspace/githubService';
import type { MaxModeKind } from '../shared/maxMode';
import { newId } from './utils/id';
import { SEOHead } from './components/seo/SEOHead';
import { RouteLoadingFallback } from './components/routing/RouteLoadingFallback';
import { hasEnteredApp, markEnteredApp, type LandingHandoff } from './components/landing/entered';
import { pageZoom } from './utils/pageZoom';

const LandingPage = lazy(() => import('./components/landing/LandingPage').then((module) => ({ default: module.LandingPage })));
const HomePage = lazy(() => import('./components/home/HomePage').then((module) => ({ default: module.HomePage })));
const AccountPage = lazy(() => import('./components/auth/AccountPage').then((module) => ({ default: module.AccountPage })));
const ChatHistoryPage = lazy(() => import('./components/chat/ChatHistoryPage').then((module) => ({ default: module.ChatHistoryPage })));
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
// The editor, terminal and preview only exist on /max; the main bundle must
// not carry CodeMirror and xterm for everyone else.
const WorkspacePanel = lazy(() => import('./components/maxmode/WorkspacePanel').then((module) => ({ default: module.WorkspacePanel })));
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

  // Hand the chat to the main page once it is found. This used to call
  // navigate('/') with no state during render, which loaded the session and
  // then threw it away.
  useEffect(() => {
    if (session) navigate('/', { replace: true, state: { sessionToLoad: session } });
  }, [session, navigate]);

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

  return null;
}

// Main Chat Page component - defined OUTSIDE to prevent re-renders
interface MainChatPageProps {
  groupChatId?: string;
  brandOverride?: BrandOverride;
  backgroundClass?: string;
  /**
   * Max Mode (shared/maxMode.ts): this page is the /max/:id route. The chat
   * is the one loaded for that id — or a fresh PRO chat under that id — and
   * the workspace panel sits beside it. Its own route rather than a mode of
   * "/" because the Node runtime needs cross-origin isolation headers that
   * would break the rest of the app (vercel.json).
   */
  maxModeRoute?: { sessionId: string; session: ChatSession | null; mode: MaxModeKind };
}

/** A PRO chat that does not exist yet, so /max/:id can start one under that id. */
function freshProSession(sessionId: string): ChatSession {
  const now = new Date().toISOString();
  return {
    id: sessionId,
    name: 'New Chat',
    persona: 'pro',
    messages: [{ id: 'initial', content: AI_PERSONAS.pro.initialMessage, isAI: true, hasAnimated: true, createdAt: now }],
    createdAt: now,
    lastModified: now,
  };
}

function MainChatPage({ groupChatId, brandOverride, backgroundClass: customBackgroundClass, maxModeRoute }: MainChatPageProps = {}) {
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
  const sessionToLoad = maxModeRoute
    ? (maxModeRoute.session ?? freshProSession(maxModeRoute.sessionId))
    : location.state?.sessionToLoad as ChatSession | undefined;

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
    maxMode,
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
    resumeWorkspaceTurn,
    stopGeneration,
    handlePersonaChange: handlePersonaChangeInternal,
    setMaxMode,
    persistNow,
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
      // The same rule the store uses to decide what to keep: a failed turn
      // has empty content and its text in partialContent, and dropping it
      // here lost the Retry row — and with it the resume — on every reload.
      messages: sessionToLoad.messages.filter(isPersistable),
      id: sessionToLoad.id,
      maxMode: maxModeRoute?.mode ?? sessionToLoad.maxMode,
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

  // Clear navigation state after loading session/healthcare mode/playQuery to prevent reload on refresh.
  // Not on /max: its session comes from the URL, and the URL has to stay so a
  // reload lands on the same workspace.
  useEffect(() => {
    if (maxModeRoute) return;
    if (!sessionToLoad && !healthcareModeFromNav && !playQueryFromNav) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (playQueryFromNav) void handleLyricsPlay(playQueryFromNav);
      window.history.replaceState({}, '', '/');
    });
    return () => { cancelled = true; };
  }, [playQueryFromNav, handleLyricsPlay, sessionToLoad, healthcareModeFromNav, maxModeRoute]);

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
  // Max Mode is its own document (see MainChatPageProps). Entering it from
  // here is a full navigation, so the chat is written out first — the route
  // loads it by id, and the debounced save may not have run yet.
  const enterMaxMode = useCallback(async () => {
    setMaxMode('auto');
    try {
      await persistNow();
    } catch (error) {
      console.error('Could not save the chat before opening Max Mode:', error instanceof Error ? error.message : error);
    }
    window.location.assign(`/max/${currentSessionId}`);
  }, [setMaxMode, persistNow, currentSessionId]);

  const exitMaxMode = useCallback(async () => {
    try {
      await persistNow();
    } catch (error) {
      console.error('Could not save the chat before leaving Max Mode:', error instanceof Error ? error.message : error);
    }
    window.location.assign(`/chat/${currentSessionId}`);
  }, [persistNow, currentSessionId]);

  // The workspace card can be collapsed. On small screens it and the chat
  // take turns, so it starts closed there and open on a desktop.
  const [workspaceOpen, setWorkspaceOpen] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
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
      // The layout is zoomed (index.css); a real pixel measure has to be
      // divided by the zoom to render at its real size.
      document.documentElement.style.setProperty('--vh', `${vh / pageZoom()}px`);
    };

    updateVH();
    window.addEventListener('resize', updateVH);
    return () => window.removeEventListener('resize', updateVH);
  }, []);

  // Flow State: the Air hue as a tinted glass pill, lit when it is on.
  const flowStateButtonStyles = useMemo(() => ({
    border: flowStateActive ? '1px solid rgb(168 85 247 / 0.45)' : '1px solid rgb(var(--tm-ink-rgb) / 0.12)',
    bg: flowStateActive
      ? 'linear-gradient(135deg, rgb(168 85 247 / 0.22), rgb(168 85 247 / 0.1))'
      : undefined,
    shadow: flowStateActive
      ? 'inset 0 1px 0 rgb(var(--tm-edge-rgb) / 0.35), 0 0 18px rgb(168 85 247 / 0.18)'
      : undefined,
    text: flowStateActive ? 'rgb(var(--tm-accent-rgb, 216 180 254))' : 'rgb(var(--tm-ink-rgb) / 0.85)',
  }), [flowStateActive]);

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
    pdfFileName?: string,
    attachments?: import('./types/chat').AttachedFile[]
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
    await handleSendMessage(message, imageUrl, imageUrls, imageDimensions, replyToData || replyTo || undefined, specialMode, pdfData, pdfFileName, attachments);

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

  // The landing page hands over either a first message to send or a request
  // to open sign-in (components/landing/entered.ts). Once, on arrival: the
  // ref guards re-renders, and the history entry is cleared the same way the
  // other nav state above is so a reload does not send it twice.
  const landingHandoff = location.state as LandingHandoff | null;
  const handoffConsumedRef = useRef(false);
  useEffect(() => {
    if (maxModeRoute || handoffConsumedRef.current) return;
    if (!landingHandoff?.initialPrompt && !landingHandoff?.openAuth) return;
    let cancelled = false;
    queueMicrotask(() => {
      // Consumed only once it actually runs: StrictMode mounts twice, and the
      // first mount's microtask is cancelled by its cleanup.
      if (cancelled || handoffConsumedRef.current) return;
      handoffConsumedRef.current = true;
      if (landingHandoff.openAuth) handleOpenAuth();
      if (landingHandoff.initialPrompt) void handleSendMessageWithRateLimit(landingHandoff.initialPrompt);
      window.history.replaceState({}, '', '/');
    });
    return () => { cancelled = true; };
  }, [landingHandoff, maxModeRoute, handleOpenAuth, handleSendMessageWithRateLimit]);

  const handleOpenAccount = useCallback(() => {
    navigate('/account');
  }, [navigate]);

  const handleOpenHistory = useCallback(() => {
    navigate('/history');
  }, [navigate]);

  const { openSettings: handleOpenSettings } = useSettingsModal();

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
      ? 'bg-canvas'
      : theme.background;

  return (
    <div
      id={brandOverride ? 'reveoule-theme' : undefined}
      className={`tm-chat-shell min-h-screen ${backgroundClass} ${theme.text} relative overflow-hidden transition-all duration-700`}
      style={{ minHeight: 'calc(var(--vh, 1vh) * 100)' }}
    >
      {/* Max Mode: chat on the left, workspace on the right. The transform
          makes the column the containing block for the chat's own fixed
          header and composer, so they stay inside it instead of spanning the
          workspace too. */}
      {!brandOverride && !customBackgroundClass && <AppAtmosphere variant={isHealthcareActive ? 'healthcare' : undefined} />}
      <div
        className={maxModeRoute ? 'flex h-screen' : undefined}
        style={maxModeRoute ? { height: 'calc(var(--vh, 1vh) * 100)' } : undefined}
      >
      <div
        className={maxModeRoute ? `relative min-w-0 flex-1 h-full ${workspaceOpen ? 'hidden lg:block' : ''}` : undefined}
        style={maxModeRoute ? { transform: 'translateZ(0)' } : undefined}
      >
      <main className="relative h-screen flex flex-col" style={{ height: 'calc(var(--vh, 1vh) * 100)' }}>
        {/* Independent floating controls leave the header open to the canvas. */}
        <header className="tm-chat-header fixed inset-x-0 top-3 z-50 px-3 sm:top-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3">
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
            <div className="flex items-center gap-1.5">
              {isAnonymous && (
                <span
                  className="tm-glass hidden min-h-11 items-center rounded-full px-3.5 py-2 text-[13px] sm:inline-flex"
                  style={{ border: '1px solid rgb(var(--tm-ink-rgb) / 0.12)', color: 'rgb(var(--tm-ink-rgb) / 0.6)' }}
                >
                  {getRemainingMessages(currentPersona)} free messages left
                </span>
              )}

              {isAnonymous ? (
                <button
                  type="button"
                  onClick={handleOpenAuth}
                  className="tm-press min-h-11 rounded-full bg-pill px-5 py-2 text-sm font-medium text-pill-ink hover:opacity-90"
                  aria-label="Sign Up"
                >
                  Sign up
                </button>
              ) : currentPersona === 'pro' ? (
                <MaxModeButton
                  active={!!maxModeRoute}
                  textColor={theme.text}
                  onEnter={enterMaxMode}
                  onExit={maxModeRoute ? exitMaxMode : undefined}
                />
              ) : currentPersona === 'default' ? (
                // Flow State for Air: a glass pill that takes the Air hue when on.
                <button
                  type="button"
                  onClick={() => setFlowStateActive(!flowStateActive)}
                  className={`tm-press inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm ${flowStateActive ? '' : 'tm-glass-pill'}`}
                  style={{
                    background: flowStateButtonStyles.bg,
                    color: flowStateButtonStyles.text,
                    border: flowStateButtonStyles.border,
                    boxShadow: flowStateButtonStyles.shadow,
                  }}
                  aria-pressed={flowStateActive}
                  aria-label={flowStateActive ? "Disable Flow State" : "Enable Flow State"}
                >
                  <Zap className="h-4 w-4" style={{ fill: flowStateActive ? 'currentColor' : 'none' }} />
                  Flow State
                </button>
              ) : currentPersona === 'girlie' && (
                isCollaborative && collaborativeId ? (
                  // Group Settings when in collaborative mode
                  <button
                    type="button"
                    onClick={() => navigate(`/groupchat/${collaborativeId}/settings`)}
                    className="tm-press tm-glass-pill inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm"
                    style={{ border: '1px solid rgb(236 72 153 / 0.35)', color: 'rgb(var(--tm-ink-rgb) / 0.85)' }}
                    aria-label="Group Settings"
                  >
                    <Settings className="h-4 w-4" />
                    Group Settings
                  </button>
                ) : (
                  // Create Group Chat
                  <button
                    type="button"
                    onClick={() => setShowGroupChatModal(true)}
                    className="tm-press tm-glass-pill inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm"
                    style={{ border: '1px solid rgb(236 72 153 / 0.35)', color: 'rgb(var(--tm-ink-rgb) / 0.85)' }}
                    aria-label="Open Group Chat"
                  >
                    <Users className="h-4 w-4" />
                    Group Chat
                  </button>
                )
              )}
            </div>
          </div>
        </header>

        {!maxModeRoute && (
          <MusicPlayer
            currentPersona={currentPersona}
            currentEmotion={currentEmotion}
            isCenterStage={false}
          />
        )}

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
                background: 'rgb(var(--tm-ink-rgb) / 0.05)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgb(var(--tm-ink-rgb) / 0.1)',
                boxShadow: '0 4px 12px rgb(var(--tm-shadow-rgb) / 0.2), inset 0 1px 0 rgb(var(--tm-edge-rgb) / 0.15)'
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
                    background: 'rgb(var(--tm-ink-rgb) / 0.05)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgb(var(--tm-ink-rgb) / 0.1)',
                    boxShadow: 'inset 0 1px 0 rgb(var(--tm-edge-rgb) / 0.15)'
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
                  background: 'rgb(var(--tm-ink-rgb) / 0.05)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgb(var(--tm-ink-rgb) / 0.1)',
                  boxShadow: '0 4px 12px rgb(var(--tm-shadow-rgb) / 0.2), inset 0 1px 0 rgb(var(--tm-edge-rgb) / 0.15)'
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
                        background: 'rgb(var(--tm-paper-rgb) / 0.4)',
                        border: '1px solid rgb(var(--tm-ink-rgb) / 0.1)',
                        boxShadow: 'inset 0 1px 0 rgb(var(--tm-edge-rgb) / 0.15)',
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

        {/* The dock. The transcript scrolls under it and fades into the
            ground before it reaches the glass; the wrapper passes clicks
            through so only the composer itself is interactive. */}
        <div
          className="tm-chat-dock pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pt-12 sm:px-6"
        >
          <div className="pointer-events-auto mx-auto max-w-4xl">
            {maxModeRoute && (
              <div className="mb-2 flex items-center justify-between px-1">
                <MaxModePill mode={maxMode ?? 'auto'} onSelect={setMaxMode} />
                {!workspaceOpen && (
                  <GlassPill onClick={() => setWorkspaceOpen(true)} className="h-8 px-3 text-[13px]" title="Show the workspace">
                    <PanelRightOpen className="w-3.5 h-3.5" /> Workspace
                  </GlassPill>
                )}
              </div>
            )}
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
      {maxModeRoute && (
        <Suspense fallback={<div className={`${workspaceOpen ? 'flex' : 'hidden'} w-full lg:w-[720px] h-full items-center justify-center`}><RouteLoadingFallback /></div>}>
          <WorkspacePanel
            sessionId={currentSessionId}
            isGenerating={isLoading}
            onResume={resumeWorkspaceTurn}
            className={workspaceOpen ? 'block' : 'hidden'}
            onCollapse={() => setWorkspaceOpen(false)}
          />
        </Suspense>
      )}
      </div>
    </div>
  );
}

/**
 * /github/callback — where the GitHub App sends the user back.
 *
 * The code is handed to the server with the user's JWT, which is what ties
 * the connection to this account (api/_lib/github.ts). Then a full
 * navigation back to the workspace the flow started from: /max is its own
 * document, so a client-side navigate would land without its headers.
 */
function GithubCallbackPage() {
  const { user, loading: authLoading } = useAuth();
  const { theme } = useTheme();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  const state = params.get('state');
  const [exchangeError, setExchangeError] = useState<string | null>(null);
  // Derived, not set in the effect: what is missing is known from the URL
  // and the session before anything runs.
  const error = !code || !state
    ? 'GitHub did not send a code back. Start the connection again.'
    : !authLoading && !user
      ? 'Sign in first, then connect GitHub again.'
      : exchangeError;

  useEffect(() => {
    if (authLoading || !user || !code || !state) return;
    githubExchange(code, state)
      .then(result => { window.location.replace(`${result.returnTo}${result.returnTo.includes('?') ? '&' : '?'}github=connected`); })
      .catch((cause: unknown) => setExchangeError(cause instanceof Error ? cause.message : 'The GitHub connection could not be completed.'));
  }, [authLoading, user, code, state]);

  return (
    <div className={`min-h-screen ${theme.background} flex items-center justify-center p-4`}>
      {error ? (
        <div className="text-center max-w-sm">
          <p className="text-white/70 mb-4">{error}</p>
          <a href="/max" className="px-6 py-3 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-100 inline-block">Back to Max Mode</a>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-white/60">
          <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
          Connecting GitHub…
        </div>
      )}
    </div>
  );
}

/**
 * /max/:id — Max Mode's own document (see MainChatPageProps.maxModeRoute).
 *
 * Loads the chat for the id through ChatService, then hands MainChatPage the
 * session and the mode the workspace was left in. An id nobody has saved yet
 * is a new PRO chat, which is how "Max Mode" on a fresh chat gets here.
 */
function MaxModePage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const { theme } = useTheme();
  const [loaded, setLoaded] = useState<{ session: ChatSession | null; mode: MaxModeKind } | null>(null);

  useEffect(() => {
    if (!id || authLoading) return;
    let cancelled = false;
    (async () => {
      let session: ChatSession | null = null;
      try {
        chatService.setUserId(user?.id ?? null);
        session = (await chatService.getSessions()).find(candidate => candidate.id === id) ?? null;
      } catch (error) {
        console.error('Could not load the chat for Max Mode:', error instanceof Error ? error.message : error);
      }
      const mode = (await workspaceModeFor(id)) ?? session?.maxMode ?? 'auto';
      if (!cancelled) setLoaded({ session, mode });
    })();
    return () => { cancelled = true; };
  }, [id, user?.id, authLoading]);

  if (!id) return <Navigate to={`/max/${newId()}`} replace />;
  if (!loaded) {
    return (
      <div className={`min-h-screen ${theme.background} flex items-center justify-center`}>
        <div className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
      </div>
    );
  }
  return <MainChatPage maxModeRoute={{ sessionId: id, session: loaded.session, mode: loaded.mode }} />;
}

// Settings opens as a glass modal over the current page rather than as a
// page of its own. `/settings` is kept as a deep link (HomePage, Contact,
// the Contour `/settings` command) — it lands on the chat with the modal up.
function SettingsRedirect() {
  const { openSettings } = useSettingsModal();
  useEffect(() => {
    openSettings();
  }, [openSettings]);
  return <Navigate to="/" replace />;
}

// "/" is the product for anyone signed in and for anyone who has already
// stepped into it; the landing page only for a signed-out first visit. In-app
// navigation to "/" always carries router state (a session, a mode, a
// handoff), so it counts as an entry too — see components/landing/entered.ts.
function RootRoute() {
  const { user } = useAuth();
  const location = useLocation();
  const showLanding = !user && !location.state && !hasEnteredApp();
  useEffect(() => {
    if (!showLanding) markEnteredApp();
  }, [showLanding]);
  if (showLanding) {
    return <><SEOHead /><LandingPage /></>;
  }
  return <><SEOHead /><MainChatPage /></>;
}

/** The routes that are the marketing site rather than the product. */
const MARKETING_PATHS = new Set(['/welcome', '/features', '/personas', '/about', '/help', '/contact']);

function AppContent() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // The product renders at 80% (index.css) — the density the chat was drawn
  // at — and the marketing pages at 100%. Decided here, before paint, so a
  // route change never flashes the other size. The root route counts as
  // marketing only while it would show the landing page (see RootRoute).
  const marketing = MARKETING_PATHS.has(location.pathname)
    || (location.pathname === '/' && !user && !location.state && !hasEnteredApp());
  useLayoutEffect(() => {
    document.documentElement.dataset.tmScale = marketing ? 'marketing' : 'app';
    // --vh is measured on resize (MainChatPage); the zoom it divides by has
    // just changed, so measure again.
    window.dispatchEvent(new Event('resize'));
  }, [marketing]);
  const settingsModal = useMemo(() => ({
    isSettingsOpen,
    openSettings: () => setIsSettingsOpen(true),
    closeSettings: () => setIsSettingsOpen(false),
  }), [isSettingsOpen]);

  return (
    <SettingsModalContext.Provider value={settingsModal}>
    <SettingsModal isOpen={isSettingsOpen} onClose={settingsModal.closeSettings} />
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route path="/welcome" element={<><SEOHead title="Welcome" description="TimeMachine Chat — one chat with three AI minds, a coding agent in Max Mode, and nothing about you for sale. Free to try." path="/welcome" /><LandingPage /></>} />
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
      <Route path="/settings" element={<SettingsRedirect />} />
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
      <Route path="/github/callback" element={<><SEOHead title="Connecting GitHub" noIndex /><GithubCallbackPage /></>} />
      <Route path="/max" element={<><SEOHead title="Max Mode" noIndex /><MaxModePage /></>} />
      <Route path="/max/:id" element={<><SEOHead title="Max Mode" noIndex /><MaxModePage /></>} />
      <Route path="/groupchat/:id" element={<><SEOHead title="Group Chat" noIndex /><GroupChatWrapper /></>} />
      <Route path="/groupchat/:id/settings" element={<><SEOHead title="Group Settings" noIndex /><GroupSettingsPage /></>} />
      <Route path="*" element={<><SEOHead title="Page not found" description="This TimeMachine page doesn't exist." noIndex /><NotFoundPage /></>} />
      </Routes>
    </Suspense>
    </SettingsModalContext.Provider>
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
