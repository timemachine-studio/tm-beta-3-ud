import React from 'react';
import { motion } from 'framer-motion';
import { Tv, MessageSquare } from 'lucide-react';
import type { Persona } from '../../types/chat';

interface ShiftModeProps {
  isChatMode: boolean;
  onToggle: () => void;
  currentPersona?: Persona;
}

// Keyed by Persona, so a persona that is added or removed breaks here loudly.
// The third key used to be 'x', which has not existed since 0.9.
const personaGlowColors: Record<Persona, string> = {
  default: 'rgba(168,85,247,0.3)',
  girlie: 'rgba(255,0,128,0.5)',
  pro: 'rgba(34,211,238,0.3)'
};

const personaBorderColors: Record<Persona, string> = {
  default: 'from-purple-600/20 to-blue-600/20',
  girlie: 'from-pink-500 to-rose-400',
  pro: 'from-cyan-600/20 to-blue-600/20'
};

const personaHoverGlow: Record<Persona, string> = {
  default: 'hover:shadow-[0_0_25px_rgba(168,85,247,0.3)]',
  girlie: 'hover:shadow-[0_0_25px_rgba(255,0,128,0.7)]',
  pro: 'hover:shadow-[0_0_25px_rgba(34,211,238,0.3)]'
};

export function ShiftMode({ isChatMode, onToggle, currentPersona = 'default' }: ShiftModeProps) {
  return (
    <motion.button
      onClick={onToggle}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`p-3 rounded-full
        bg-gradient-to-r ${personaBorderColors[currentPersona]}
        backdrop-blur-xl text-white
        border border-white/10
        shadow-[0_0_15px_${personaGlowColors[currentPersona]}]
        transition-all duration-300
        ${personaHoverGlow[currentPersona]}
        active:scale-95`}
    >
      {isChatMode ? (
        <Tv className="w-4 h-4" />
      ) : (
        <MessageSquare className="w-4 h-4" />
      )}
    </motion.button>
  );
}