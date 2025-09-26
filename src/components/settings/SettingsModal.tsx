import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sun, Moon, Palette } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { seasonThemes } from '../../themes/seasons';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal = React.memo(({ isOpen, onClose }: SettingsModalProps) => {
  const { theme, mode, season, setMode, setSeason, defaultTheme, setDefaultTheme, clearDefaultTheme } = useTheme();
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);

  // Clear confirmation message after 3 seconds
  useEffect(() => {
    if (confirmationMessage) {
      const timer = setTimeout(() => setConfirmationMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [confirmationMessage]);

  // Memoized season buttons to prevent re-renders
  const seasonButtons = React.useMemo(
    () =>
      Object.entries(seasonThemes)
        .filter(([key]) => key !== 'monochrome')
        .map(([key, seasonTheme]) => (
          <div key={key} className="flex flex-col items-center">
            <button
              onClick={() => setSeason(key as keyof typeof seasonThemes)}
              className={`w-12 h-12 rounded-full
                ${seasonTheme.background} bg-opacity-20 backdrop-blur-md
                border border-white/20 dark:border-gray-800/20
                ${season === key ? 'ring-2 ring-white/50 ring-offset-2 ring-offset-transparent' : ''}
                hover:bg-opacity-30 relative group transition-all duration-200`}
              aria-label={`Select ${seasonTheme.name} theme`}
            >
              {season === key && (
                <Palette className="w-4 h-4 text-white/80 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
              )}
            </button>
            <span className={`text-xs font-medium mt-1 text-center ${theme.text}`}>
              {seasonTheme.name}
            </span>
          </div>
        )),
    [season, theme.text, setSeason]
  );

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
                className="fixed inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm z-50"
              />
            </Dialog.Overlay>

            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed inset-0 flex items-center justify-center p-4 z-50"
              >
                <div
                  className={`relative w-full max-w-md sm:max-w-lg p-6 rounded-xl
                    bg-white/10 dark:bg-black/10 backdrop-blur-lg
                    border border-white/20 dark:border-gray-800/20
                    shadow-[0_8px_32px_rgba(31,38,135,0.2)]
                    transition-all duration-300`}
                >
                  {/* Confirmation Message */}
                  <AnimatePresence>
                    {confirmationMessage && (
                      <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        aria-live="polite"
                        className={`absolute top-2 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-full
                          bg-white/20 dark:bg-black/20 backdrop-blur-md
                          border border-white/30 dark:border-gray-800/30
                          text-white/80 dark:text-gray-200/80 text-sm`}
                      >
                        {confirmationMessage}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <Dialog.Title className={`text-xl font-semibold mb-4 ${theme.text}`}>
                    Appearance
                  </Dialog.Title>

                  <div className="space-y-6">
                    {/* Theme Mode Selector */}
                    <div className="space-y-3">
                      <label className={`text-sm font-medium ${theme.text}`}>
                        Theme Mode
                      </label>
                      <div className="flex space-x-2">
                        {['light', 'dark', 'monochrome'].map((option) => (
                          <button
                            key={option}
                            onClick={() => {
                              setMode(option as 'light' | 'dark' | 'monochrome');
                            }}
                            className={`flex-1 py-2 px-4 rounded-full text-sm
                              ${mode === option
                                ? 'bg-white/20 dark:bg-black/20 backdrop-blur-md border-white/30 dark:border-gray-800/30'
                                : 'bg-white/10 dark:bg-black/10 backdrop-blur-md border-white/20 dark:border-gray-800/20'
                              }
                              hover:bg-white/20 dark:hover:bg-gray-800/20
                              text-white/80 dark:text-gray-200/80
                              transition-all duration-200
                              flex items-center justify-center space-x-2`}
                            aria-label={`Select ${option} mode`}
                          >
                            {option === 'light' && <Sun className="w-4 h-4" />}
                            {option === 'dark' && <Moon className="w-4 h-4" />}
                            {option === 'monochrome' && <Palette className="w-4 h-4" />}
                            <span className="capitalize">{option}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Default Theme Section */}
                    <div className="space-y-3">
                      <label className={`text-sm font-medium ${theme.text}`}>
                        Default Theme
                      </label>
                      <div className="flex items-center justify-between">
                        <span className={`text-sm ${theme.text}`}>
                          {defaultTheme
                            ? `Current Default: ${defaultTheme.mode.charAt(0).toUpperCase() + defaultTheme.mode.slice(1)}${
                                defaultTheme.season ? `, ${seasonThemes[defaultTheme.season]?.name || defaultTheme.season}` : ''
                              }`
                            : 'No default theme set'}
                        </span>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => {
                              setDefaultTheme({ mode, season });
                              setConfirmationMessage(defaultTheme ? 'Default theme changed!' : 'Default theme set!');
                            }}
                            className={`px-3 py-1 rounded-full text-sm
                              bg-white/10 dark:bg-black/10 backdrop-blur-md
                              border border-white/20 dark:border-gray-800/20
                              hover:bg-white/20 dark:hover:bg-gray-800/20
                              text-white/80 dark:text-gray-200/80
                              transition-all duration-200`}
                          >
                            {defaultTheme ? 'Change Default' : 'Set as Default'}
                          </button>
                          {defaultTheme && (
                            <button
                              onClick={() => {
                                clearDefaultTheme();
                                setConfirmationMessage('Default theme cleared!');
                              }}
                              className={`px-3 py-1 rounded-full text-sm
                                bg-white/10 dark:bg-black/10 backdrop-blur-md
                                border border-white/20 dark:border-gray-800/20
                                hover:bg-white/20 dark:hover:bg-gray-800/20
                                text-white/80 dark:text-gray-200/80
                                transition-all duration-200`}
                            >
                              Clear Default
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Season Themes */}
                    <div className="space-y-3">
                      <label className={`text-sm font-medium ${theme.text}`}>
                        Seasons
                      </label>
                      <div
                        className="max-h-[60vh] overflow-y-auto rounded-lg hide-scrollbar"
                        style={{
                          scrollbarWidth: 'none', // Firefox
                          msOverflowStyle: 'none', // IE/Edge
                        }}
                      >
                        <style jsx>{`
                          .hide-scrollbar::-webkit-scrollbar {
                            display: none;
                          }
                        `}</style>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4">
                          {seasonButtons}
                        </div>
                      </div>
                    </div>
                  </div>

                  <Dialog.Close asChild>
                    <button
                      className="absolute top-4 right-4 p-2 rounded-full
                        bg-white/10 dark:bg-black/10 backdrop-blur-md
                        border border-white/20 dark:border-gray-800/20
                        hover:bg-white/20 dark:hover:bg-gray-800/20
                        transition-all duration-200"
                      aria-label="Close settings modal"
                    >
                      <X className="w-4 h-4 text-white/80 dark:text-gray-200/80" />
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
});