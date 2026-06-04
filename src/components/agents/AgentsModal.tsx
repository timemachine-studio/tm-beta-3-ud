import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface AgentsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AgentsModal({ isOpen, onClose }: AgentsModalProps) {
  const { theme } = useTheme();

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog.Root open={isOpen} onOpenChange={onClose}>
          <Dialog.Portal>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`fixed inset-0 ${theme.modal.overlay} backdrop-blur-md z-50`}
              />
            </Dialog.Overlay>

            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`fixed inset-0 flex items-center justify-center p-4 z-50`}
              >
                <div
                  className={`relative w-full max-w-md p-8 rounded-2xl
                    bg-transparent backdrop-blur-3xl border border-white/10
                    shadow-2xl ${theme.glow.secondary}`}
                >
                  <Dialog.Title className={`text-2xl font-light mb-8 ${theme.text} tracking-wide`}>
                    Flight Controls
                  </Dialog.Title>

                  <div className="flex items-center justify-center min-h-[200px]">
                    <p className={`text-center ${theme.text} opacity-60 text-lg leading-relaxed`}>
                      We're just getting started. A lot more is on the way. Stay with us ;)
                    </p>
                  </div>

                  <Dialog.Close asChild>
                    <button
                      className={`absolute top-4 right-4 p-2 rounded-full
                        bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors`}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </Dialog.Close>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </AnimatePresence>
  );
}
