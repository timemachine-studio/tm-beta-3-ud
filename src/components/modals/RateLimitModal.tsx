import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface RateLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RateLimitModal({ isOpen, onClose }: RateLimitModalProps) {
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
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              />
            </Dialog.Overlay>

            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="fixed inset-0 flex items-center justify-center p-4 z-50"
              >
                <div
                  className="relative w-full max-w-md p-6 rounded-xl
                    bg-white/10 backdrop-blur-lg
                    border border-white/20
                    shadow-[0_8px_32px_rgba(31,38,135,0.2)]
                    transition-all duration-300"
                >
                  {/* Icon */}
                  <div className="flex justify-center mb-4">
                    <div className="p-3 rounded-full bg-orange-500/20 backdrop-blur-md">
                      <Clock className="w-6 h-6 text-orange-400" />
                    </div>
                  </div>

                  {/* Title */}
                  <Dialog.Title className={`text-xl font-semibold text-center mb-4 ${theme.text}`}>
                    Server Load Alert
                  </Dialog.Title>

                  {/* Message */}
                  <div className={`text-center mb-6 ${theme.text} opacity-80 leading-relaxed`}>
                    We are facing huge load on our servers and thus we've had to temporarily limit access to maintain system stability. Please be patient, this thing doesn't grow on trees.
                  </div>

                  {/* Actions */}
                  <div className="flex justify-center">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={onClose}
                      className="px-6 py-2 rounded-lg
                        bg-white/10 hover:bg-white/20
                        backdrop-blur-md border border-white/20
                        text-white transition-all duration-200
                        font-medium"
                    >
                      Got it
                    </motion.button>
                  </div>

                  {/* Close button */}
                  <Dialog.Close asChild>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="absolute top-4 right-4 p-2 rounded-full
                        bg-white/10 hover:bg-white/20
                        backdrop-blur-md border border-white/20
                        transition-all duration-200"
                      aria-label="Close rate limit modal"
                    >
                      <X className="w-4 h-4 text-white/80" />
                    </motion.button>
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