import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ImagePlus, Code, Music, HeartPulse, FileText } from 'lucide-react';

export type PlusMenuOption = 'upload-photos' | 'upload-pdf' | 'web-coding' | 'music-compose' | 'tm-healthcare';

export const plusMenuItems: { key: PlusMenuOption; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'upload-photos', label: 'Upload Photos', icon: ImagePlus },
  { key: 'upload-pdf', label: 'Upload PDF', icon: FileText },
  { key: 'web-coding', label: 'Web Coding', icon: Code },
  { key: 'music-compose', label: 'Music Compose', icon: Music },
  { key: 'tm-healthcare', label: 'TM Healthcare', icon: HeartPulse },
];

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
          className="absolute bottom-full left-0 mb-2 z-50"
        >
          <div
            className="p-2 rounded-[20px]"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
            }}
          >
            <div className="flex flex-col gap-1.5">
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
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                  }}
                >
                  <Icon className="w-4 h-4 text-white/70" />
                  <span className="text-white text-sm">{label}</span>
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
