import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface HtmlPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  htmlCode: string;
}

export function HtmlPreviewModal({ isOpen, onClose, htmlCode }: HtmlPreviewModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={backdropRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleBackdropClick}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-0 sm:p-4 animate-none"
          style={{ background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(10px)' }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative w-full h-full sm:w-[96vw] sm:h-[92vh] max-w-none rounded-none sm:rounded-2xl overflow-hidden flex flex-col"
            style={{
              background: 'rgba(25, 25, 25, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(20px)',
            }}
          >
            {/* Header bar styled like a browser window */}
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{
              background: 'rgba(255, 255, 255, 0.04)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            }}>
              <div className="flex items-center select-none">
                <span className="text-xs font-semibold text-white/50 tracking-wider font-sans uppercase">
                  BY TIMEMACHINE CHAT
                </span>
              </div>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="p-1 rounded-lg transition-all duration-200 hover:scale-105 hover:bg-white/10 active:scale-95"
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
                title="Close Preview"
              >
                <X className="w-4 h-4 text-white/80" />
              </button>
            </div>

            {/* Iframe rendering the HTML */}
            <iframe
              srcDoc={htmlCode}
              title="HTML Preview"
              sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
              className="w-full flex-1 border-0 bg-white"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
