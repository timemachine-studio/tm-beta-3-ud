import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Sparkles, Brain, Zap } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface AIMentionPickerProps {
  isVisible: boolean;
  onSelect: (aiModel: string) => void;
}

const AI_MODELS = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    icon: Bot,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
    description: 'OpenAI GPT-4'
  },
  {
    id: 'gemini',
    name: 'Gemini',
    icon: Sparkles,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    description: 'Google Gemini'
  },
  {
    id: 'claude',
    name: 'Claude',
    icon: Brain,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20',
    description: 'Anthropic Claude'
  },
  {
    id: 'grok',
    name: 'Grok',
    icon: Zap,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
    description: 'xAI Grok'
  }
];

export function AIMentionPicker({ isVisible, onSelect }: AIMentionPickerProps) {
  const { theme } = useTheme();

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="absolute bottom-full left-0 mb-2 z-50"
        >
          <div className="p-3 rounded-xl
            bg-black/40 backdrop-blur-xl
            border border-white/10
            shadow-lg min-w-[300px]"
          >
            <div className="text-xs text-white/60 mb-2 px-2">
              Mention an AI model
            </div>
            <div className="flex flex-col gap-1">
              {AI_MODELS.map((model) => (
                <motion.button
                  key={model.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={(e) => {
                    e.preventDefault();
                    onSelect(`@${model.id}`);
                  }}
                  className={`px-3 py-2 rounded-lg text-left
                    ${model.bgColor} ${model.borderColor}
                    border backdrop-blur-md
                    transition-all duration-300
                    flex items-center gap-3
                    group hover:shadow-md`}
                >
                  <div className={`w-8 h-8 rounded-lg ${model.bgColor} ${model.borderColor}
                    border flex items-center justify-center`}
                  >
                    <model.icon className={`w-4 h-4 ${model.color}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-medium">{model.name}</span>
                      <span className="text-white/40 text-xs font-mono">@{model.id}</span>
                    </div>
                    <div className="text-white/50 text-xs">{model.description}</div>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
