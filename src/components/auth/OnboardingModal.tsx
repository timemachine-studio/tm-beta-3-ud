import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { User, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onComplete,
}) => {
  const [step, setStep] = useState(1);
  const [nickname, setNickname] = useState('');
  const [aboutMe, setAboutMe] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { updateProfile } = useAuth();

  const handleNext = () => {
    if (step === 1 && !nickname.trim()) {
      setError('Please enter a nickname');
      return;
    }
    setError('');
    setStep(2);
  };

  const handleComplete = async () => {
    if (!nickname.trim()) {
      setError('Please enter a nickname');
      return;
    }

    setLoading(true);
    setError('');

    const { error: updateError } = await updateProfile({
      nickname: nickname.trim(),
      about_me: aboutMe.trim() || null,
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    onComplete();
  };

  const suggestions = [
    "I love learning new things",
    "I'm a creative person who loves art and music",
    "I work in tech and enjoy coding",
    "I'm a student",
  ];

  return (
    <Dialog.Root open={isOpen}>
      <AnimatePresence>
        {isOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-md z-50"
              />
            </Dialog.Overlay>

            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
              >
                <div
                  className="relative w-full max-w-[440px] overflow-hidden rounded-3xl"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                  }}
                >
                  {/* Content */}
                  <div className="p-8">
                    {/* Progress indicator */}
                    <div className="flex items-center justify-center gap-2 mb-8">
                      <div className={`h-1 rounded-full transition-all duration-300 ${step >= 1 ? 'bg-white/60 w-8' : 'bg-white/20 w-2'}`} />
                      <div className={`h-1 rounded-full transition-all duration-300 ${step >= 2 ? 'bg-white/60 w-8' : 'bg-white/20 w-2'}`} />
                    </div>

                    <AnimatePresence mode="wait">
                      {step === 1 ? (
                        <motion.div
                          key="step1"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ duration: 0.2 }}
                        >
                          {/* Header */}
                          <div className="text-center mb-8">
                            <h2 className="text-2xl font-semibold text-white mb-2">
                              Welcome to TimeMachine
                            </h2>
                            <p className="text-white/50 text-sm">
                              Let's personalize your experience
                            </p>
                          </div>

                          {/* Nickname Input */}
                          <div className="space-y-4">
                            <label className="block">
                              <span className="text-white/60 text-sm mb-2 block">
                                What should we call you?
                              </span>
                              <div className="relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
                                  <User size={20} />
                                </div>
                                <input
                                  type="text"
                                  value={nickname}
                                  onChange={(e) => setNickname(e.target.value)}
                                  placeholder="Enter your nickname"
                                  maxLength={30}
                                  className="w-full pl-12 pr-4 py-3.5 rounded-xl text-white text-[15px] placeholder-white/30 focus:outline-none transition-all"
                                  style={{
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    backdropFilter: 'blur(20px)',
                                    WebkitBackdropFilter: 'blur(20px)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                                  }}
                                  autoFocus
                                />
                              </div>
                            </label>

                            {error && (
                              <motion.p
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-red-400/80 text-sm"
                              >
                                {error}
                              </motion.p>
                            )}

                            <button
                              onClick={handleNext}
                              className="w-full py-3.5 rounded-xl text-white font-medium flex items-center justify-center gap-2 transition-all mt-6"
                              style={{
                                background: 'rgba(168, 85, 247, 0.3)',
                                backdropFilter: 'blur(20px)',
                                WebkitBackdropFilter: 'blur(20px)',
                                border: '1px solid rgba(168, 85, 247, 0.5)',
                                boxShadow: '0 4px 12px rgba(168, 85, 247, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                              }}
                            >
                              Continue
                              <ArrowRight size={18} />
                            </button>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="step2"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ duration: 0.2 }}
                        >
                          {/* Header */}
                          <div className="text-center mb-6">
                            <h2 className="text-2xl font-semibold text-white mb-2">
                              Nice to meet you, {nickname}!
                            </h2>
                            <p className="text-white/50 text-sm">
                              Tell TimeMachine a bit about yourself (optional)
                            </p>
                          </div>

                          {/* About Me Input */}
                          <div className="space-y-4">
                            <textarea
                              value={aboutMe}
                              onChange={(e) => setAboutMe(e.target.value)}
                              placeholder="Things you'd like TimeMachine to know about you..."
                              rows={4}
                              maxLength={500}
                              className="w-full px-4 py-3.5 rounded-xl text-white text-[15px] placeholder-white/30 focus:outline-none transition-all resize-none"
                              style={{
                                background: 'rgba(255, 255, 255, 0.05)',
                                backdropFilter: 'blur(20px)',
                                WebkitBackdropFilter: 'blur(20px)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                              }}
                            />
                            <p className="text-white/30 text-xs text-right">
                              {aboutMe.length}/500
                            </p>

                            {/* Suggestions */}
                            <div className="space-y-2">
                              <p className="text-white/40 text-xs uppercase tracking-wider">
                                Suggestions
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {suggestions.map((suggestion, i) => (
                                  <button
                                    key={i}
                                    onClick={() => setAboutMe(suggestion)}
                                    className="px-3 py-1.5 text-xs rounded-full text-white/50 hover:text-white/70 transition-all"
                                    style={{
                                      background: 'rgba(255, 255, 255, 0.05)',
                                      border: '1px solid rgba(255, 255, 255, 0.1)',
                                    }}
                                  >
                                    {suggestion}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {error && (
                              <motion.p
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-red-400/80 text-sm"
                              >
                                {error}
                              </motion.p>
                            )}

                            <div className="flex gap-3 mt-6">
                              <button
                                onClick={() => setStep(1)}
                                className="flex-1 py-3.5 rounded-xl text-white/70 font-medium hover:text-white transition-all"
                                style={{
                                  background: 'rgba(255, 255, 255, 0.05)',
                                  backdropFilter: 'blur(20px)',
                                  WebkitBackdropFilter: 'blur(20px)',
                                  border: '1px solid rgba(255, 255, 255, 0.1)',
                                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                                }}
                              >
                                Back
                              </button>
                              <button
                                onClick={handleComplete}
                                disabled={loading}
                                className="flex-[2] py-3.5 rounded-xl text-white font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                                style={{
                                  background: 'rgba(168, 85, 247, 0.3)',
                                  backdropFilter: 'blur(20px)',
                                  WebkitBackdropFilter: 'blur(20px)',
                                  border: '1px solid rgba(168, 85, 247, 0.5)',
                                  boxShadow: '0 4px 12px rgba(168, 85, 247, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                                }}
                              >
                                {loading ? (
                                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                  "Let's Go"
                                )}
                              </button>
                            </div>

                            <button
                              onClick={handleComplete}
                              className="w-full text-center text-white/30 hover:text-white/50 text-sm mt-2 transition-colors"
                            >
                              Skip for now
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
};

export default OnboardingModal;
