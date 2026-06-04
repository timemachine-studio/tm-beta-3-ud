import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Settings, Wand2, History, Plus, User, LogIn } from 'lucide-react';
import { AI_PERSONAS } from '../../config/constants';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { AgentsModal } from '../agents/AgentsModal';
import { ChatSession } from '../../services/chat/chatService';

export interface BrandOverride {
  name: string;
  watermark?: string;
  textColorClass?: string;
  glowColor?: string;
  personaName?: string;
}

interface BrandLogoProps {
  onPersonaChange: (persona: keyof typeof AI_PERSONAS) => void;
  currentPersona: keyof typeof AI_PERSONAS;
  onLoadChat: (session: ChatSession) => void;
  onStartNewChat: () => void;
  onOpenAuth?: () => void;
  onOpenAccount?: () => void;
  onOpenHistory?: () => void;
  onOpenSettings?: () => void;
  brandOverride?: BrandOverride;
}

const personaColors = {
  default: 'text-purple-400',
  girlie: 'text-pink-400',
  pro: 'text-cyan-400'
} as const;

const personaDescriptions = {
  default: 'Fastest intelligence in the world for everyday use',
  girlie: 'The intelligence that gets the vibe check',
  pro: 'Our most technologically advanced intelligence with human-like emotions and thinking capabilities'
} as const;

const personaGlowColors = {
  default: 'rgba(168,85,247,0.6)',
  girlie: 'rgba(255,20,147,0.8)',
  pro: 'rgba(34,211,238,0.6)'
} as const;

export function BrandLogo({
  onPersonaChange,
  currentPersona,
  onLoadChat,
  onStartNewChat,
  onOpenAuth,
  onOpenAccount,
  onOpenHistory,
  onOpenSettings,
  brandOverride
}: BrandLogoProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showAgents, setShowAgents] = useState(false);
  const { theme } = useTheme();
  const { user, profile } = useAuth();

  const toggleDropdown = () => setIsOpen(!isOpen);

  const handlePersonaSelect = (persona: keyof typeof AI_PERSONAS) => {
    onPersonaChange(persona);
    setIsOpen(false);
  };

  const handleStartNewChat = () => {
    onStartNewChat();
    setIsOpen(false);
  };

  const handleAuthClick = () => {
    setIsOpen(false);
    if (user) {
      onOpenAccount?.();
    } else {
      onOpenAuth?.();
    }
  };

  const handleHistoryClick = () => {
    setIsOpen(false);
    onOpenHistory?.();
  };

  const handleSettingsClick = () => {
    setIsOpen(false);
    onOpenSettings?.();
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="relative z-50 flex items-center gap-2 cursor-pointer group"
          onClick={toggleDropdown}
        >
          <div className="flex flex-col">
            <h1
              className={`text-xl sm:text-2xl font-bold ${brandOverride?.textColorClass || personaColors[currentPersona]} transition-colors duration-300`}
              style={{
                fontFamily: 'Montserrat, sans-serif',
                textShadow: `
                  0 0 20px ${brandOverride?.glowColor || personaGlowColors[currentPersona]},
                  0 0 40px ${(brandOverride?.glowColor || personaGlowColors[currentPersona]).replace(/[\d.]+\)$/, '0.3)')},
                  0 0 60px ${(brandOverride?.glowColor || personaGlowColors[currentPersona]).replace(/[\d.]+\)$/, '0.1)')}
                `
              }}
            >
              {brandOverride?.name || AI_PERSONAS[currentPersona].name}
            </h1>
            {brandOverride?.watermark && (
              <span className="text-[10px] sm:text-xs text-white/50 -mt-1 tracking-wider uppercase" style={{ fontFamily: 'Inter, sans-serif' }}>
                {brandOverride.watermark}
              </span>
            )}
          </div>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className={personaColors[currentPersona]}
          >
            <ChevronDown className="w-5 h-5" />
          </motion.div>
        </motion.div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className={`absolute top-full left-0 mt-3 w-72 bg-black/10 backdrop-blur-3xl rounded-3xl z-50 overflow-hidden border border-white/5`}
            style={{
              background: 'linear-gradient(145deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))'
            }}
          >
            {/* Sign In / My Account Button */}
            <motion.button
              whileHover={{
                scale: 1.03,
                background: user
                  ? 'linear-gradient(90deg, rgba(34,197,94,0.2) 0%, transparent 100%)'
                  : 'linear-gradient(90deg, rgba(168,85,247,0.3) 0%, transparent 100%)'
              }}
              whileTap={{ scale: 0.97 }}
              onClick={handleAuthClick}
              className={`w-full px-4 py-3 text-left transition-all duration-300 ${theme.text} flex items-center gap-3 border-b border-white/5`}
            >
              {user ? (
                <>
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden"
                    style={{
                      background: profile?.avatar_url
                        ? 'transparent'
                        : 'rgba(168, 85, 247, 0.15)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      border: '1px solid rgba(168, 85, 247, 0.2)',
                      boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                    }}
                  >
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-4 h-4 text-purple-400" />
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-sm">{profile?.nickname || 'My Account'}</div>
                    <div className="text-xs opacity-50">View your profile</div>
                  </div>
                </>
              ) : (
                <>
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{
                      background: 'rgba(168, 85, 247, 0.15)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      border: '1px solid rgba(168, 85, 247, 0.2)',
                      boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                    }}
                  >
                    <LogIn className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <div className="font-bold text-sm">Sign In / Sign Up</div>
                    <div className="text-xs opacity-50">Unlock unlimited chats</div>
                  </div>
                </>
              )}
            </motion.button>

            {/* Divider */}
            <div className="h-px bg-white/10" />

            {Object.entries(AI_PERSONAS)
              .filter(([key]) => ['default', 'girlie', 'pro'].includes(key)) // Only show TimeMachine personas
              .map(([key, persona]) => (
                <motion.button
                  key={key}
                  whileHover={{
                    scale: 1.03,
                    background: `linear-gradient(90deg, ${personaGlowColors[key as keyof typeof personaGlowColors]} 0%, transparent 100%)`
                  }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handlePersonaSelect(key as keyof typeof AI_PERSONAS)}
                  className={`w-full px-4 py-3 text-left transition-all duration-300
                  ${currentPersona === key ? personaColors[key as keyof typeof personaColors] : theme.text}
                  ${currentPersona === key ? `bg-gradient-to-r from-[${personaGlowColors[key as keyof typeof personaGlowColors]}] to-black/10` : 'bg-transparent'}
                  flex flex-col gap-1 border-b border-white/5 last:border-b-0`}
                  style={{
                    background: currentPersona === key ?
                      `linear-gradient(to right, ${personaGlowColors[key as keyof typeof personaGlowColors]}, rgba(0,0,0,0.1))` :
                      'transparent'
                  }}
                >
                  <div className="font-bold text-sm">{persona.name}</div>
                  <div className={`text-xs opacity-70 ${theme.text}`}>
                    {personaDescriptions[key as keyof typeof personaDescriptions]}
                  </div>
                </motion.button>
              ))}
            <motion.button
              whileHover={{
                scale: 1.03,
                background: 'linear-gradient(90deg, rgba(34,197,94,0.2) 0%, transparent 100%)'
              }}
              whileTap={{ scale: 0.97 }}
              onClick={handleStartNewChat}
              className={`w-full px-4 py-3 text-left transition-all duration-300 ${theme.text} flex items-center gap-2 border-b border-white/5`}
            >
              <Plus className="w-4 h-4" />
              <div className="font-bold text-sm">Start New Chat</div>
            </motion.button>
            <motion.button
              whileHover={{
                scale: 1.03,
                background: 'linear-gradient(90deg, rgba(168,85,247,0.2) 0%, transparent 100%)'
              }}
              whileTap={{ scale: 0.97 }}
              onClick={handleHistoryClick}
              className={`w-full px-4 py-3 text-left transition-all duration-300 ${theme.text} flex items-center gap-2 border-b border-white/5`}
            >
              <History className="w-4 h-4" />
              <div className="font-bold text-sm">Chat History</div>
            </motion.button>
            <motion.button
              whileHover={{
                scale: 1.03,
                background: 'linear-gradient(90deg, rgba(168,85,247,0.2) 0%, transparent 100%)'
              }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setShowAgents(true);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-3 text-left transition-all duration-300 ${theme.text} flex items-center gap-2 border-b border-white/5`}
            >
              <Wand2 className="w-4 h-4" />
              <div className="font-bold text-sm">Flight Controls</div>
            </motion.button>
            <motion.button
              whileHover={{
                scale: 1.03,
                background: 'linear-gradient(90deg, rgba(168,85,247,0.2) 0%, transparent 100%)'
              }}
              whileTap={{ scale: 0.97 }}
              onClick={handleSettingsClick}
              className={`w-full px-4 py-3 text-left transition-all duration-300 ${theme.text} flex items-center gap-2 last:rounded-b-3xl`}
            >
              <Settings className="w-4 h-4" />
              <div className="font-bold text-sm">Settings & Theme</div>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <AgentsModal isOpen={showAgents} onClose={() => setShowAgents(false)} />
    </div>
  );
}
