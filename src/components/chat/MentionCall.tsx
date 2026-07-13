import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User } from 'lucide-react';
import { AI_PERSONAS } from '../../config/constants';
import { GroupChatParticipant } from '../../types/groupChat';

interface MentionCallProps {
  isVisible: boolean;
  onSelect: (command: string) => void;
  currentPersona: keyof typeof AI_PERSONAS;
  isGroupMode?: boolean;
  participants?: GroupChatParticipant[];
  currentUserId?: string;
}

const personaColors = {
  default: 'rgba(139,0,255,0.3)',
  girlie: 'rgba(199,21,133,0.3)',
  pro: 'rgba(34,211,238,0.3)',
  chatgpt: 'rgba(34,197,94,0.3)',
  gemini: 'rgba(37,99,235,0.3)',
  claude: 'rgba(234,88,12,0.3)',
  deepseek: 'rgba(99,102,241,0.3)',
  grok: 'rgba(107,114,128,0.3)'
} as const;

const personaTextColors = {
  default: 'text-purple-300',
  girlie: 'text-pink-300',
  pro: 'text-cyan-300',
  chatgpt: 'text-green-300',
  gemini: 'text-blue-300',
  claude: 'text-orange-300',
  deepseek: 'text-indigo-300',
  grok: 'text-gray-300'
} as const;

export function MentionCall({ isVisible, onSelect, currentPersona, isGroupMode, participants, currentUserId }: MentionCallProps) {
  // Only show external AI models in mention dropdown (when not in group mode)
  // Order: ChatGPT, Gemini, Claude, DeepSeek, Grok
  const externalAIs = ['chatgpt', 'gemini', 'claude', 'deepseek', 'grok'];
  const availablePersonas = externalAIs
    .filter(key => key in AI_PERSONAS)
    .map(key => ({
      key,
      command: `@${key}`,
      name: AI_PERSONAS[key as keyof typeof AI_PERSONAS].name
    }));

  // In group mode, show @TimeMachine first, then other participants
  const groupMentions = isGroupMode ? [
    { key: 'timemachine', command: '@TimeMachine', name: 'TimeMachine', isAI: true },
    ...(participants || [])
      .filter(p => p.user_id !== currentUserId) // Don't show self
      .map(p => ({
        key: p.user_id,
        command: `@${p.nickname}`,
        name: p.nickname,
        isAI: false
      }))
  ] : [];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="absolute bottom-full left-0 mb-2 z-50 flex max-h-[300px] flex-col gap-1.5 overflow-y-auto"
        >
          {/* Group chat mentions (TimeMachine + participants) */}
          {isGroupMode && groupMentions.length > 0 && (
            <>
              {groupMentions.map(({ key, command, isAI }) => (
                <motion.button
                  key={key}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={(e) => {
                    e.preventDefault();
                    onSelect(command);
                  }}
                  className="px-4 py-2.5 rounded-full text-left transition-all duration-300 flex items-center gap-2 min-w-[200px]"
                  style={{
                    background: isAI
                      ? personaColors[currentPersona]
                      : 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                  }}
                >
                  {!isAI && (
                    <User className="w-4 h-4 text-white/50" />
                  )}
                  <span className={`text-sm font-mono ${isAI ? personaTextColors[currentPersona] : 'text-white/60'}`}>
                    {command}
                  </span>
                </motion.button>
              ))}
            </>
          )}

          {/* External AI models - Glass Pills */}
          {availablePersonas.map(({ key, command, name }) => (
            <motion.button
              key={key}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={(e) => {
                e.preventDefault();
                onSelect(command);
              }}
              className="px-4 py-2.5 rounded-full text-left transition-all duration-300 flex items-center gap-2 min-w-[200px]"
              style={{
                background: personaColors[key as keyof typeof personaColors],
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)'
              }}
            >
              <span className={`text-sm font-mono ${personaTextColors[key as keyof typeof personaTextColors]}`}>
                {command}
              </span>
              <span className="text-white text-sm">{name}</span>
            </motion.button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
