import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Settings, Wand2, History, Plus } from 'lucide-react';
import { AI_PERSONAS } from '../../config/constants';
import { useTheme } from '../../context/ThemeContext';
import { SettingsModal } from '../settings/SettingsModal';
import { AgentsModal } from '../agents/AgentsModal';
import { ChatHistoryModal } from '../chat/ChatHistoryModal';
import { Message } from '../../types/chat';

interface BrandLogoProps {
  onPersonaChange: (persona: keyof typeof AI_PERSONAS) => void;
  currentPersona: keyof typeof AI_PERSONAS;
  onLoadChat: (messages: Message[]) => void;
  onStartNewChat: () => void;
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

export function BrandLogo({ onPersonaChange, currentPersona, onLoadChat, onStartNewChat }: BrandLogoProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAgents, setShowAgents] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { theme } = useTheme();

  const toggleDropdown = () => setIsOpen(!isOpen);

  const handlePersonaSelect = (persona: keyof typeof AI_PERSONAS) => {
    onPersonaChange(persona);
    setIsOpen(false);
  };

  const handleStartNewChat = () => {
    onStartNewChat();
    setIsOpen(false);
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
          <h1 
            className={`text-xl sm:text-2xl font-bold ${personaColors[currentPersona]} transition-colors duration-300`}
            style={{
              fontFamily: 'Montserrat, sans-serif',
              textShadow: `
                0 0 20px ${personaGlowColors[currentPersona]},
                0 0 40px ${personaGlowColors[currentPersona].replace(/[\d.]+\)$/, '0.3)')},
                0 0 60px ${personaGlowColors[currentPersona].replace(/[\d.]+\)$/, '0.1)')}
              `
            }}
          >
            {AI_PERSONAS[currentPersona].name}
          </h1>
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
              onClick={() => {
                setShowHistory(true);
                setIsOpen(false);
              }}
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
              onClick={() => {
                setShowSettings(true);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-3 text-left transition-all duration-300 ${theme.text} flex items-center gap-2 last:rounded-b-3xl`}
            >
              <Settings className="w-4 h-4" />
              <div className="font-bold text-sm">Themes</div>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <AgentsModal isOpen={showAgents} onClose={() => setShowAgents(false)} />
      <ChatHistoryModal 
        isOpen={showHistory} 
        onClose={() => setShowHistory(false)}
        onLoadChat={onLoadChat}
      />
    </div>
  );
}
