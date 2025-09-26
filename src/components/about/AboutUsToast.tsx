import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Info } from 'lucide-react';

interface AboutUsToastProps {
  isVisible: boolean;
  onClose: () => void;
  onClick: () => void;
  currentPersona?: 'default' | 'girlie' | 'x';
}

export function AboutUsToast({ isVisible, onClose, onClick, currentPersona = 'default' }: AboutUsToastProps) {
  const personaColors = {
    default: 'from-purple-600/20 to-blue-600/20',
    girlie: 'from-pink-500 to-rose-400',
    x: 'from-cyan-600/20 to-blue-600/20'
  };

  const personaGlowColors = {
    default: 'shadow-[0_0_15px_rgba(168,85,247,0.3)]',
    girlie: 'shadow-[0_0_20px_rgba(255,0,128,0.5)]',
    x: 'shadow-[0_0_15px_rgba(34,211,238,0.3)]'
  };

  const handleClick = () => {
    window.open('https://congruous-fold-922.notion.site/TimeMachine-The-Total-chaos-Season-1-19abe05747de804caef8e42a58119149', '_blank');
    onClose();
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-24 right-4 z-50"
        >
          <div className={`p-4 rounded-lg
            bg-gradient-to-r ${personaColors[currentPersona]}
            backdrop-blur-xl border border-white/10
            ${personaGlowColors[currentPersona]}
            flex items-center gap-3`}
          >
            <Info className="w-5 h-5 text-white" />
            <button
              onClick={handleClick}
              className="text-white text-sm hover:underline"
            >
              Who are we? Know about us.
            </button>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}