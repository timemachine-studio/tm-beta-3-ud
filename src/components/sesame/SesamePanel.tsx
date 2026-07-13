import React, { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { motion } from 'framer-motion';

interface SesamePanelProps {
  onClose: () => void;
}

export function SesamePanel({ onClose }: SesamePanelProps) {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.99 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="relative h-full min-h-0 w-full px-2 pt-[4.75rem] pb-[7.75rem] sm:px-4 sm:pt-20 sm:pb-[8.25rem]"
      aria-label="Sesame voice conversations"
    >
      <motion.button
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        onClick={onClose}
        className="absolute bottom-[5.25rem] right-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white/65 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-colors hover:bg-black/85 hover:text-white sm:bottom-[5.75rem] sm:right-5"
        aria-label="Close Sesame"
      >
        <X className="h-4 w-4" />
      </motion.button>

      <div
        className="relative mx-auto h-full min-h-0 w-full max-w-6xl overflow-hidden rounded-[1.4rem] sm:rounded-[1.75rem]"
        style={{
          background: '#f5efe6',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 28px 80px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        }}
      >
        <div className="relative h-full min-h-0 bg-[#f5efe6]">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#f5efe6]">
              <div className="flex items-center gap-2 text-sm text-[#6d6259]">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Opening Sesame...</span>
              </div>
            </div>
          )}
          <iframe
            src="https://app.sesame.com"
            title="Sesame voice conversations"
            className="h-full w-full border-0 bg-[#f5efe6]"
            allow="microphone; autoplay; encrypted-media; clipboard-write"
            referrerPolicy="no-referrer"
            onLoad={() => setIsLoading(false)}
          />
        </div>
      </div>
    </motion.section>
  );
}
