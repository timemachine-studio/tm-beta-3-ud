import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Key, Sparkles, Clock } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { BETA_ACCESS_TOKEN } from '../../config/constants';

interface WelcomeModalProps {
  isOpen: boolean;
  onAccessGranted: () => void;
}

export function WelcomeModal({ isOpen, onAccessGranted }: WelcomeModalProps) {
  const { theme } = useTheme();
  const [accessToken, setAccessToken] = useState('');
  const [error, setError] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsValidating(true);
    setError('');

    // Simulate validation delay for better UX
    await new Promise(resolve => setTimeout(resolve, 800));

    if (accessToken.trim() === BETA_ACCESS_TOKEN) {
      // Store access token in localStorage for future sessions
      localStorage.setItem('timeMachine_accessGranted', 'true');
      onAccessGranted();
    } else {
      setError('Invalid access token. Please check your token and try again.');
    }
    
    setIsValidating(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAccessToken(e.target.value);
    if (error) setError(''); // Clear error when user starts typing
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog.Root open={isOpen}>
          <Dialog.Portal>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50"
              />
            </Dialog.Overlay>

            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                className="fixed inset-0 flex items-center justify-center p-4 z-50"
                style={{ 
                  minHeight: '100vh',
                  minHeight: '100dvh', // Dynamic viewport height for mobile
                }}
              >
                <div
                  className="relative w-full max-w-md mx-auto p-8 rounded-2xl
                    bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-3xl
                    border border-white/20 shadow-[0_8px_32px_rgba(139,92,246,0.2)]
                    overflow-hidden
                    min-h-fit max-h-[90vh] overflow-y-auto"
                  style={{
                    // Ensure proper centering on mobile
                    position: 'relative',
                    top: 'auto',
                    left: 'auto',
                    transform: 'none',
                  }}
                >
                  {/* Animated background elements */}
                  <div className="absolute inset-0 overflow-hidden">
                    <motion.div
                      animate={{
                        rotate: [0, 360],
                        scale: [1, 1.2, 1],
                      }}
                      transition={{
                        duration: 20,
                        repeat: Infinity,
                        ease: "linear"
                      }}
                      className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full blur-xl"
                    />
                    <motion.div
                      animate={{
                        rotate: [360, 0],
                        scale: [1, 1.1, 1],
                      }}
                      transition={{
                        duration: 15,
                        repeat: Infinity,
                        ease: "linear"
                      }}
                      className="absolute -bottom-20 -left-20 w-32 h-32 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-full blur-xl"
                    />
                  </div>

                  {/* Content */}
                  <div className="relative z-10">
                    {/* Header */}
                    <div className="text-center mb-8">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                        className="inline-flex items-center justify-center w-16 h-16 rounded-full
                          bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-md
                          border border-white/20 mb-6"
                      >
                        <Sparkles className="w-8 h-8 text-purple-400" />
                      </motion.div>
                      
                      {/* Premium TimeMachine Logo - matching the HTML file */}
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="mb-4"
                      >
                        <h1 
                          className="text-4xl font-bold mb-4"
                          style={{
                            fontFamily: "'Montserrat', sans-serif",
                            fontWeight: 700,
                            background: 'linear-gradient(135deg, #a855f7, #ec4899, #06b6d4)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                            textShadow: '0 0 30px rgba(168, 85, 247, 0.5)',
                            animation: 'shimmer 2s ease-in-out infinite alternate',
                          }}
                        >
                          TimeMachine
                        </h1>
                        <style jsx>{`
                          @keyframes shimmer {
                            0% {
                              filter: brightness(1);
                            }
                            100% {
                              filter: brightness(1.2);
                            }
                          }
                        `}</style>
                      </motion.div>
                      
                      <Dialog.Title className={`text-xl font-semibold mb-2 ${theme.text}`}>
                        Welcome to the Future
                      </Dialog.Title>
                      
                      <p className={`text-sm opacity-80 ${theme.text} leading-relaxed px-2`}>
                        You're invited to experience the future of AI. Enter your beta access token to begin your journey.
                      </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${theme.text}`}>
                          Access Token
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Key className="w-5 h-5 text-gray-400" />
                          </div>
                          <input
                            type="text"
                            value={accessToken}
                            onChange={handleInputChange}
                            placeholder="Enter your beta access token"
                            className={`w-full pl-10 pr-4 py-3 rounded-xl
                              bg-white/10 backdrop-blur-md
                              border border-white/20 focus:border-purple-400/50
                              ${theme.text} placeholder-gray-400
                              focus:outline-none focus:ring-2 focus:ring-purple-400/20
                              transition-all duration-200`}
                            disabled={isValidating}
                            autoFocus
                          />
                        </div>
                        
                        <AnimatePresence>
                          {error && (
                            <motion.p
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="text-red-400 text-sm mt-2 flex items-center gap-2"
                            >
                              <X className="w-4 h-4" />
                              {error}
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Premium Frosted Glass Button */}
                      <motion.button
                        whileHover={{ 
                          scale: 1.02,
                          boxShadow: '0 20px 40px rgba(168, 85, 247, 0.4), 0 0 60px rgba(168, 85, 247, 0.2)'
                        }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={!accessToken.trim() || isValidating}
                        className="relative w-full py-4 px-6 rounded-xl font-semibold text-white
                          overflow-hidden group
                          disabled:opacity-50 disabled:cursor-not-allowed
                          transition-all duration-300
                          flex items-center justify-center gap-2"
                        style={{
                          background: 'rgba(255, 255, 255, 0.08)',
                          backdropFilter: 'blur(20px)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          boxShadow: '0 8px 32px rgba(168, 85, 247, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                        }}
                      >
                        {/* Frosted glass overlay with gradient */}
                        <div 
                          className="absolute inset-0 opacity-80 group-hover:opacity-100 transition-opacity duration-300"
                          style={{
                            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.3), rgba(236, 72, 153, 0.3), rgba(6, 182, 212, 0.3))',
                            backdropFilter: 'blur(20px)',
                          }}
                        />
                        
                        {/* Glass shine effect */}
                        <div 
                          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                          style={{
                            background: 'linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.1) 50%, transparent 70%)',
                            transform: 'translateX(-100%)',
                            animation: 'shine 1.5s ease-in-out infinite',
                          }}
                        />
                        
                        <style jsx>{`
                          @keyframes shine {
                            0% {
                              transform: translateX(-100%);
                            }
                            100% {
                              transform: translateX(100%);
                            }
                          }
                        `}</style>
                        
                        {/* Button content */}
                        <div className="relative z-10 flex items-center gap-2">
                          {isValidating ? (
                            <>
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                              >
                                <Clock className="w-5 h-5" />
                              </motion.div>
                              Validating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-5 h-5" />
                              Enter TimeMachine
                            </>
                          )}
                        </div>
                      </motion.button>
                    </form>

                    {/* Footer */}
                    <div className="mt-6 text-center">
                      <p className={`text-xs opacity-60 ${theme.text}`}>
                        Beta Preview • TimeMachine Studios
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </AnimatePresence>
  );
}
