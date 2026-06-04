import React from 'react';
import { motion } from 'framer-motion';
import { Home } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AI_PERSONAS } from '../../config/constants';

interface MusicPlayerProps {
  currentPersona?: keyof typeof AI_PERSONAS;
  currentEmotion?: string;
  isCenterStage?: boolean;
}

export function MusicPlayer(_props: MusicPlayerProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Don't show the home button if we're already on the chat UI (default page) or the reveoule branded page
  if (location.pathname === '/' || location.pathname === '/reveoule') return null;

  const glassStyle = {
    background: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
  };

  return (
    <div className="fixed bottom-24 left-4 z-50">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => navigate('/')}
        className="p-3 rounded-full transition-all duration-300 relative group overflow-hidden"
        style={glassStyle}
        aria-label="Go to Home"
      >
        <Home className="w-5 h-5 text-white/80 relative z-10" />
      </motion.button>
    </div>
  );
}
