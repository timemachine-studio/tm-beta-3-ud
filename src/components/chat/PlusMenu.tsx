import { plusMenuItems, type PlusMenuOption } from './plusMenuItems';
export type { PlusMenuOption } from './plusMenuItems';
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PlusMenuProps {
  isVisible: boolean;
  onSelect: (option: PlusMenuOption) => void;
}

export function PlusMenu({ isVisible, onSelect }: PlusMenuProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="absolute bottom-full left-0 mb-2 z-50 flex flex-col gap-1.5"
        >
          {plusMenuItems.map(({ key, label, icon: Icon }) => (
            <motion.button
              key={key}
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={(e) => {
                e.preventDefault();
                onSelect(key);
              }}
              className="px-4 py-2.5 rounded-full text-left transition-all duration-300 flex items-center gap-3 min-w-[200px]"
              style={{
                background: 'rgb(var(--tm-ink-rgb) / 0.05)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgb(var(--tm-ink-rgb) / 0.1)',
                boxShadow: 'inset 0 1px 0 rgb(var(--tm-edge-rgb) / 0.1)'
              }}
            >
              <Icon className="w-4 h-4 text-white/70" />
              <span className="text-white text-sm">{label}</span>
            </motion.button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
