import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Image, Video, Music, FileCheck, Bot, Code, FileText, Sparkles } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface AgentsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const agents = [
  {
    id: 'picture-perfect',
    name: 'Picture Perfect',
    description: 'Simply edit images with precision and quality. Think, prompt, perfect.',
    icon: Image,
    comingSoon: true
  },
  {
    id: 'gen-fashion',
    name: 'Gen Fashion',
    description: 'Try on any outfits instanty. Style your "love at first" sight look.',
    icon: Video,
    comingSoon: true
  },
  {
    id: 'neural-sync',
    name: 'NeuralSync',
    description: 'Establish neural bonding with any living being. Express thoughts across the timeline.',
    icon: Music,
    comingSoon: true
  },
  {
    id: 'timetravel',
    name: 'TimeTravel',
    description: 'Travel through temporal timeline and rewind or forward time. Literally',
    icon: FileCheck,
    comingSoon: true
  },
  {
    id: 'code-assistant',
    name: 'Code Assistant',
    description: 'Get help with coding and development',
    icon: Code,
    comingSoon: true
  },
  {
    id: 'content-writer',
    name: 'Content Writer',
    description: 'Generate engaging content for any purpose',
    icon: FileText,
    comingSoon: true
  },
  {
    id: 'ai-trainer',
    name: 'AI Trainer',
    description: 'Train custom AI models for your needs',
    icon: Bot,
    comingSoon: true
  },
  {
    id: 'creative-assistant',
    name: 'Creative Assistant',
    description: 'Boost your creative projects with AI',
    icon: Sparkles,
    comingSoon: true
  }
];

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
                  className={`relative w-full max-w-4xl p-6 rounded-2xl
                    bg-transparent backdrop-blur-3xl border border-white/10
                    shadow-2xl ${theme.glow.secondary}`}
                >
                  <Dialog.Title className={`text-2xl font-light mb-6 ${theme.text} tracking-wide`}>
                    Fabricator
                  </Dialog.Title>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-h-[70vh] overflow-y-auto p-2">
                    {agents.map((agent) => (
                      <motion.div
                        key={agent.id}
                        whileHover={{ scale: 1.02, boxShadow: '0 4px 20px rgba(255,255,255,0.1)' }}
                        className={`p-6 rounded-2xl bg-transparent backdrop-blur-xl border border-white/10
                          shadow-lg transition-all duration-300 flex flex-col justify-between`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-xl bg-white/5`}>
                            <agent.icon className="w-6 h-6 text-white/80" />
                          </div>
                          <div className="flex-1">
                            <h3 className={`font-semibold text-lg ${theme.text} tracking-tight`}>{agent.name}</h3>
                            <p className={`text-sm mt-2 opacity-70 ${theme.text} leading-relaxed`}>
                              {agent.description}
                            </p>
                          </div>
                        </div>
                        {agent.comingSoon && (
                          <div className="mt-4 px-3 py-1 bg-white/5 rounded-full inline-block">
                            <span className="text-xs font-medium text-white/60">Under Development</span>
                          </div>
                        )}
                        <div className="mt-6 flex gap-3">
                          <button
                            className={`flex-1 py-2 px-4 rounded-xl bg-white/10 hover:bg-white/20
                              text-sm font-medium text-white transition-colors duration-200`}
                            disabled={agent.comingSoon}
                          >
                            Open in Fabricator
                          </button>
                          <button
                            className={`flex-1 py-2 px-4 rounded-xl bg-white/10 hover:bg-white/20
                              text-sm font-medium text-white transition-colors duration-200`}
                            disabled={agent.comingSoon}
                          >
                            Details
                          </button>
                        </div>
                      </motion.div>
                    ))}
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
