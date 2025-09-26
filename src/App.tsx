import React, { useRef, useEffect, useState } from 'react';
import { ChatInput } from './components/chat/ChatInput';
import { BrandLogo } from './components/brand/BrandLogo';
import { MusicPlayer } from './components/music/MusicPlayer';
import { Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChat } from './hooks/useChat';
import { AboutUsToast } from './components/about/AboutUsToast';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { ChatMode } from './components/chat/ChatMode';
import { StageMode } from './components/chat/StageMode';
import { RateLimitModal } from './components/modals/RateLimitModal';
import { WelcomeModal } from './components/modals/WelcomeModal';
import { ACCESS_TOKEN_REQUIRED, MAINTENANCE_MODE, PRO_HEAT_LEVELS } from './config/constants';

function AppContent() {
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
    useStreaming,
    setChatMode, 
    handleSendMessage, 
    handlePersonaChange,
    setCurrentProHeatLevel,
    startNewChat,
    markMessageAsAnimated,
    dismissAboutUs,
    dismissRateLimitModal,
    loadChat,
    setUseStreaming
  } = useChat();
  
  const { theme } = useTheme();
  const [isCenterStage, setIsCenterStage] = useState(false);
  const [isHeatLevelExpanded, setIsHeatLevelExpanded] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(() => {
    // Check if access token is required and if user has already been granted access
    if (!ACCESS_TOKEN_REQUIRED) return false;
    const accessGranted = localStorage.getItem('timeMachine_accessGranted');
    return accessGranted !== 'true';
  });

  // Check for maintenance mode
  if (MAINTENANCE_MODE) {
    window.location.href = '/maintenance.html';
    return null;
  }

  useEffect(() => {
    const updateVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    updateVH();
    window.addEventListener('resize', updateVH);
    return () => window.removeEventListener('resize', updateVH);
  }, []);

  const personaGlowColors = {
    default: 'rgba(139,0,255,0.7)',
    girlie: 'rgba(199,21,133,0.7)',
    pro: 'rgba(30,144,255,0.7)'
  };

  const personaBackgroundColors = {
    default: 'rgba(139,0,255,0.2)',
    girlie: 'rgba(199,21,133,0.2)',
    pro: 'rgba(30,144,255,0.2)'
  };

  const getButtonStyles = (isCenterStage: boolean, persona: string, theme: any) => ({
    border: isCenterStage 
      ? `1px solid ${persona === 'girlie' ? 'rgb(199,21,133)' : 'rgb(139,0,255)'}` 
      : 'none',
    bg: isCenterStage 
      ? (persona === 'girlie' ? 'rgba(199,21,133,0.3)' : 'rgba(139,0,255,0.3)') 
      : personaBackgroundColors[persona],
    shadow: isCenterStage 
      ? `0 0 20px ${persona === 'girlie' ? 'rgba(199,21,133,0.8)' : 'rgba(139,0,255,0.8)'}` 
      : 'none',
    text: isCenterStage 
      ? (persona === 'girlie' ? 'rgb(238,130,238)' : 'rgb(186,85,211)') 
      : theme.text,
  });

  const getHeatLevelButtonStyles = (isExpanded: boolean, theme: any) => ({
    border: isExpanded ? '1px solid rgb(30,144,255)' : 'none',
    bg: isExpanded ? 'rgba(30,144,255,0.3)' : 'rgba(30,144,255,0.2)',
    shadow: isExpanded ? '0 0 20px rgba(30,144,255,0.8)' : 'none',
    text: isExpanded ? 'rgb(135,206,250)' : theme.text,
  });

  const buttonStyles = getButtonStyles(isCenterStage, currentPersona, theme);
  const heatLevelButtonStyles = getHeatLevelButtonStyles(isHeatLevelExpanded, theme);

  const handleAccessGranted = () => {
    setShowWelcomeModal(false);
  };

  // Don't render main app content if welcome modal is showing
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

  return (
    <div 
      className={`min-h-screen ${theme.background} ${theme.text} relative overflow-hidden`}
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
            />
            <div className="flex items-center gap-2">
              {currentPersona === 'pro' ? (
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
                      backdropFilter: 'blur(10px)',
                      outline: 'none',
                      borderWidth: '0px',
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
              ) : (currentPersona === 'default' || currentPersona === 'girlie') && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsCenterStage(!isCenterStage)}
                  style={{
                    background: buttonStyles.bg,
                    color: buttonStyles.text,
                    border: buttonStyles.border,
                    boxShadow: buttonStyles.shadow,
                    borderRadius: '9999px',
                    backdropFilter: 'blur(10px)',
                    outline: 'none',
                    borderWidth: '0px',
                    padding: '8px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.3s ease',
                  }}
                  aria-label={isCenterStage ? "Disable Center Stage" : "Enable Center Stage"}
                >
                  <Star style={{ width: '16px', height: '16px', color: buttonStyles.text }} />
                  <span style={{ fontSize: '14px', color: buttonStyles.text }}>Center Stage</span>
                </motion.button>
              )}
            </div>
          </div>
        </header>
        
        <MusicPlayer 
          currentPersona={currentPersona}
          currentEmotion={currentEmotion}
          isCenterStage={isCenterStage}
        />

        <div className="flex-1 overflow-y-auto custom-scrollbar message-container">
          {isChatMode ? (
            <ChatMode
              messages={messages}
              currentPersona={currentPersona}
              onMessageAnimated={markMessageAsAnimated}
              error={error}
              streamingMessageId={streamingMessageId}
            />
          ) : (
            <StageMode
              messages={messages}
              currentPersona={currentPersona}
              onMessageAnimated={markMessageAsAnimated}
              streamingMessageId={streamingMessageId}
            />
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-transparent">
          <div className="max-w-4xl mx-auto">
            <ChatInput 
              onSendMessage={handleSendMessage} 
              isLoading={isLoading}
              currentPersona={currentPersona}
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
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
