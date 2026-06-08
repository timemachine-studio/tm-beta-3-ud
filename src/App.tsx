import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation, useParams, useSearchParams, Navigate } from 'react-router-dom';
import { ChatInput } from './components/chat/ChatInput';
import { BrandLogo, BrandOverride } from './components/brand/BrandLogo';
import { MusicPlayer } from './components/music/MusicPlayer';
import { YouTubePlayer } from './components/music/YouTubePlayer';
import { Star, Users, Settings, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChat } from './hooks/useChat';
import { useAnonymousRateLimit } from './hooks/useAnonymousRateLimit';
import { AboutUsToast, AboutPage } from './components/about';
import { ContactPage } from './components/contact';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatMode } from './components/chat/ChatMode';
import { StageMode } from './components/chat/StageMode';
import { RateLimitModal } from './components/modals/RateLimitModal';
import { WelcomeModal } from './components/modals/WelcomeModal';
import { AuthModal, OnboardingModal, AccountPage } from './components/auth';
import { ChatHistoryPage } from './components/chat/ChatHistoryPage';
import { SettingsPage } from './components/settings/SettingsPage';
import { AlbumPage } from './components/album/AlbumPage';
import { MemoriesPage } from './components/memories/MemoriesPage';
import { HelpPage } from './components/help/HelpPage';
import { PersonasPage } from './components/personas/PersonasPage';
import { FeaturesPage } from './components/features/FeaturesPage';
import { GroupChatModal } from './components/groupchat/GroupChatModal';
import { GroupSettingsPage } from './components/groupchat/GroupSettingsPage';
import { HomePage } from './components/home/HomePage';
import { NotesPage } from './components/notes/NotesPage';
import { HealthcarePage } from './components/healthcare/HealthcarePage';
import { ShopPage } from './components/shop/ShopPage';
import { LifestyleLayout } from './components/lifestyle/LifestyleLayout';
import { CookBookPage } from './components/lifestyle/CookBookPage';
import { FashionPage } from './components/lifestyle/FashionPage';
import { ShoppingListPage } from './components/lifestyle/ShoppingListPage';
import { PremiumCalendarPage } from './components/lifestyle/PremiumCalendarPage';
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
  const { user, profile, loading: authLoading, needsOnboarding, updateLastPersona } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

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
  const [groupChat, setGroupChat] = useState<GroupChat | null>(null);
  const [isGroupChatLoading, setIsGroupChatLoading] = useState(false);
  const [isGroupParticipant, setIsGroupParticipant] = useState(false);
  const [isJoiningGroup, setIsJoiningGroup] = useState(false);
  const [groupInviteInfo, setGroupInviteInfo] = useState<{ owner_nickname: string; chat_name: string; participant_count: number; persona: string } | null>(null);

  // Reply state for group chat
  const [replyTo, setReplyTo] = useState<{ id: number; content: string; sender_nickname?: string; isAI: boolean } | null>(null);

  // Get initial persona from profile (validated against AI_PERSONAS)
  // If loading from history, use the session's persona instead
  const savedPersona = profile?.last_persona as keyof typeof AI_PERSONAS | null;
  const initialPersona = sessionToLoad
    ? sessionToLoad.persona
    : (!authLoading && savedPersona && savedPersona in AI_PERSONAS ? savedPersona : undefined);

  const {
    messages,
    isChatMode,
    isLoading,
    currentPersona,
    currentProHeatLevel,
    currentEmotion,
    error,
    showAboutUs,
    showRateLimitModal,
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
    handlePersonaChange: handlePersonaChangeInternal,
    setCurrentProHeatLevel,
    startNewChat,
    markMessageAsAnimated,
    dismissAboutUs,
    dismissRateLimitModal,
    loadChat,
    clearYoutubeMusic,
    enableCollaborativeMode,
    joinCollaborativeChat,
    updateMessageReactions,
    updateMusicVariations,
    // Remote music
    pendingRemoteMusic,
    playPendingMusic,
    dismissPendingMusic
  } = useChat(
    user?.id,
    profile || undefined,
    initialPersona,
    authLoading,
    // Pass session to load directly so it's available immediately on mount
    sessionToLoad ? {
      messages: sessionToLoad.messages.filter(msg => msg.content && msg.content.trim() !== ''),
      id: sessionToLoad.id,
      heat_level: sessionToLoad.heat_level
    } : null
  );

  // Clear navigation state after loading session/healthcare mode to prevent reload on refresh
  useEffect(() => {
    if (sessionToLoad || healthcareModeFromNav) {
      window.history.replaceState({}, '', '/');
    }
  }, []); // Only run once on mount

  const { isRateLimited, getRemainingMessages, incrementCount, isAnonymous } = useAnonymousRateLimit();

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
  const [isFlowStateEnabled, setIsFlowStateEnabled] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(() => {
    if (!ACCESS_TOKEN_REQUIRED) return false;
    const accessGranted = localStorage.getItem('timeMachine_accessGranted');
    return accessGranted !== 'true';
  });

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [authModalMessage, setAuthModalMessage] = useState<string | undefined>();

  useEffect(() => {
    if (!authLoading && needsOnboarding) {
      setShowOnboarding(true);
    }
  }, [authLoading, needsOnboarding]);

  // Group chat loading and subscription
  useEffect(() => {
    if (!isGroupMode || !groupChatId) return;

    async function loadGroupChat() {
      setIsGroupChatLoading(true);

      // Get invite info first
      const invite = await getGroupChatInvite(groupChatId);
      if (invite) {
        setGroupInviteInfo(invite);
      }

      // Check if user is a participant
      if (user) {
        const participant = await isGroupChatParticipant(groupChatId, user.id);
        setIsGroupParticipant(participant);

        if (participant) {
          const chat = await getGroupChat(groupChatId);
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
      profile.avatar_url
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
    background: isHeatLevelExpanded
      ? 'linear-gradient(135deg, rgba(30,144,255,0.28), rgba(255,255,255,0.07))'
      : 'rgba(255, 255, 255, 0.05)',
    border: isHeatLevelExpanded ? '1px solid rgba(30,144,255,0.45)' : '1px solid rgba(255,255,255,0.1)',
    shadow: isHeatLevelExpanded
      ? '0 0 18px rgba(30,144,255,0.38), inset 0 1px 0 rgba(255,255,255,0.16)'
      : '0 4px 12px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.15)',
    text: isHeatLevelExpanded ? 'rgb(165,225,255)' : theme.text,
  }), [isHeatLevelExpanded, theme.text]);

  const flowStateButtonStyles = useMemo(() => ({
    background: isFlowStateEnabled
      ? 'linear-gradient(135deg, rgba(168,85,247,0.28), rgba(255,255,255,0.07))'
      : 'rgba(255, 255, 255, 0.05)',
    border: isFlowStateEnabled ? '1px solid rgba(168,85,247,0.45)' : '1px solid rgba(255,255,255,0.1)',
    shadow: isFlowStateEnabled
      ? '0 0 18px rgba(168,85,247,0.38), inset 0 1px 0 rgba(255,255,255,0.16)'
      : '0 4px 12px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.15)',
    text: isFlowStateEnabled ? 'rgb(216,180,254)' : theme.text,
  }), [isFlowStateEnabled, theme.text]);

  const handleAccessGranted = useCallback(() => {
    setShowWelcomeModal(false);
  }, []);

  // Memoized send message handler
  const handleSendMessageWithRateLimit = useCallback(async (
    message: string,
    imageUrl?: string | string[],
    audioData?: string,
    imageUrls?: string[],
    imageDimensions?: import('./types/chat').ImageDimensions,
    replyToData?: import('./types/chat').ReplyToData,
    specialMode?: string,
    pdfData?: string,
    pdfFileName?: string
  ) => {
    const mentionMatch = message.match(/^@(chatgpt|gemini|claude|grok|girlie|pro)\s/i);
    const targetModel = mentionMatch ? mentionMatch[1].toLowerCase() : currentPersona;
    const useFlowStateForRequest = isFlowStateEnabled && currentPersona === 'default' && !mentionMatch;
    const quotaCost = useFlowStateForRequest ? 3 : 1;

    if (isAnonymous && (isRateLimited(targetModel) || getRemainingMessages(targetModel) < quotaCost)) {
      let authMessage: string;
      if (targetModel === 'pro') {
        authMessage = "PRO mode requires a TimeMachine ID. Create one to access advanced features!";
      } else if (targetModel === 'girlie') {
        authMessage = "Girlie mode requires a TimeMachine ID. Create one to unlock this persona!";
      } else if (targetModel === 'gemini') {
        authMessage = "@Gemini requires a TimeMachine ID. Create one to chat with Gemini!";
      } else if (targetModel === 'claude') {
        authMessage = "@Claude requires a TimeMachine ID. Create one to chat with Claude!";
      } else if (targetModel === 'grok') {
        authMessage = "@Grok requires a TimeMachine ID. Create one to chat with Grok!";
      } else {
        authMessage = "You've used your 3 free messages! Create a TimeMachine ID to continue chatting.";
      }
      setAuthModalMessage(authMessage);
      setShowAuthModal(true);
      return;
    }

    if (isAnonymous) {
      incrementCount(targetModel, quotaCost);
    }

    await handleSendMessage(message, imageUrl, audioData, imageUrls, imageDimensions, replyToData || replyTo || undefined, specialMode, pdfData, pdfFileName, useFlowStateForRequest);
    // Clear reply after sending
    setReplyTo(null);
  }, [currentPersona, isFlowStateEnabled, isAnonymous, isRateLimited, getRemainingMessages, incrementCount, handleSendMessage, replyTo]);

  // Reply handlers for group chat
  const handleReply = useCallback((message: { id: number; content: string; sender_nickname?: string; isAI: boolean }) => {
    setReplyTo(message);
  }, []);

  const handleClearReply = useCallback(() => {
    setReplyTo(null);
  }, []);

  // Handle reactions on messages
  const handleReact = useCallback(async (messageId: number, emoji: string) => {
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
    window.location.href = '/maintenance.html';
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

  if (authLoading) {
    return (
      <div className={`min-h-screen ${theme.background} ${theme.text} flex items-center justify-center`}>
        <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Override background for healthcare mode (green gradient instead of season theme)
  const isHealthcareActive = activeChatMode === 'tm-healthcare';
  const backgroundClass = customBackgroundClass
    ? customBackgroundClass
    : isHealthcareActive
      ? 'bg-gradient-to-t from-green-950 to-black to-50%'
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
                      background: heatLevelButtonStyles.background,
                      color: heatLevelButtonStyles.text,
                      border: heatLevelButtonStyles.border,
                      boxShadow: heatLevelButtonStyles.shadow,
                      borderRadius: '9999px',
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
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
                              background: 'linear-gradient(90deg, rgba(30,144,255,0.2) 0%, transparent 100%)'
                            }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => {
                              setCurrentProHeatLevel(parseInt(level));
                              setIsHeatLevelExpanded(false);
                            }}
                            className={`w-full px-4 py-3 text-left transition-all duration-300
                              ${currentProHeatLevel === parseInt(level) ? 'text-cyan-400' : theme.text}
                              ${currentProHeatLevel === parseInt(level) ? 'bg-gradient-to-r from-cyan-500/20 to-black/10' : 'bg-transparent'}
                              flex flex-col gap-1 border-b border-white/5 last:border-b-0`}
                            style={{
                              background: currentProHeatLevel === parseInt(level) ?
                                'linear-gradient(to right, rgba(30,144,255,0.2), rgba(0,0,0,0.1))' :
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
              ) : (
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
                ) : currentPersona === 'default' ? (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsFlowStateEnabled((value) => !value)}
                    style={{
                      background: flowStateButtonStyles.background,
                      color: flowStateButtonStyles.text,
                      border: flowStateButtonStyles.border,
                      boxShadow: flowStateButtonStyles.shadow,
                      borderRadius: '9999px',
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                      outline: 'none',
                      padding: '8px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.3s ease',
                    }}
                    aria-pressed={isFlowStateEnabled}
                    aria-label={isFlowStateEnabled ? "Turn off Flow State" : "Turn on Flow State"}
                  >
                    <Zap style={{ width: '16px', height: '16px', color: flowStateButtonStyles.text }} />
                    <span style={{ fontSize: '14px', color: flowStateButtonStyles.text }}>Flow State</span>
                  </motion.button>
                ) : null
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

        <div className="flex-1 overflow-y-auto custom-scrollbar message-container">
          {/* Group chat join UI */}
          {isGroupMode && !isGroupParticipant && !isGroupChatLoading && (
            <div className="min-h-full flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md"
              >
                <div className="relative overflow-hidden rounded-3xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] to-white/[0.02] backdrop-blur-2xl" />
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-violet-500 opacity-20" />
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
                        className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-500 to-violet-500 text-white font-semibold flex items-center justify-center gap-2"
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
                        className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-500 to-violet-500 text-white font-semibold"
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
              {isChatMode ? (
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
                />
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
            />
          </div>
        </div>

        <AboutUsToast
          isVisible={showAboutUs}
          onClose={dismissAboutUs}
          onClick={() => window.open('https://timemachine.notion.site', '_blank')}
          currentPersona={currentPersona}
        />

        <RateLimitModal
          isOpen={showRateLimitModal}
          onClose={dismissRateLimitModal}
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
      <Route path="/personas" element={<><SEOHead title="Personas" description="Meet TimeMachine AI personas — TimeMachine Air for everyday speed, TimeMachine Girlie for vibe-check conversations, and TimeMachine PRO for advanced intelligence. Plus ChatGPT, Gemini, Claude, and Grok." path="/personas" /><PersonasPage /></>} />
      <Route path="/features" element={<><SEOHead title="Features" description="Explore TimeMachine features — Contour command palette with 30+ tools, group chat, TM Healthcare, image generation, music streaming, memory system, voice input, and more." path="/features" /><FeaturesPage /></>} />
      <Route path="/contact" element={<><SEOHead title="Contact" description="Get in touch with the TimeMachine team for support, feedback, or collaboration." path="/contact" /><ContactPage /></>} />
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
    </Routes>
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
