import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Plus } from 'lucide-react';
import { AI_PERSONAS } from '../../config/constants';

type Persona = keyof typeof AI_PERSONAS;

const personaStyles = {
  tintColors: {
    default: 'rgba(168, 85, 247, 0.2)',
    girlie: 'rgba(236, 72, 153, 0.15)',
    pro: 'rgba(34, 211, 238, 0.15)',
  },
  borderColors: {
    default: 'rgba(168, 85, 247, 0.4)',
    girlie: 'rgba(236, 72, 153, 0.3)',
    pro: 'rgba(34, 211, 238, 0.3)',
  },
  glowShadow: {
    default: '0 0 15px rgba(168, 85, 247, 0.35)',
    girlie: '0 0 12px rgba(236, 72, 153, 0.25)',
    pro: '0 0 12px rgba(34, 211, 238, 0.25)',
  },
} as const;

const getPersonaKey = (p: Persona): 'default' | 'girlie' | 'pro' => {
  if (p === 'girlie') return 'girlie';
  if (p === 'pro') return 'pro';
  return 'default';
};

interface UniversalTextboxProps {
  onSend: (text: string) => void;
  placeholder?: string;
  persona?: Persona;
  floating?: boolean;
  showPlusButton?: boolean;
  onPlusClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export function UniversalTextbox({
  onSend,
  placeholder = 'Start typing...',
  persona = 'default' as Persona,
  floating = true,
  showPlusButton = false,
  onPlusClick,
  disabled = false,
  className = '',
}: UniversalTextboxProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const key = getPersonaKey(persona);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      const scrollTop = textarea.scrollTop;
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 150);
      textarea.style.height = `${newHeight}px`;
      textarea.scrollTop = scrollTop;
    }
  }, [message]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const wrapperClass = floating
    ? `fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-2xl z-40 ${className}`
    : `w-full ${className}`;

  return (
    <form onSubmit={handleSubmit} className={wrapperClass}>
      <div className="relative flex items-center gap-2">
        {showPlusButton && (
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onPlusClick}
            disabled={disabled}
            className="p-3 rounded-full text-white disabled:opacity-50 relative group transition-all duration-300 shrink-0"
            style={{
              background: `linear-gradient(135deg, ${personaStyles.tintColors[key]}, rgba(255, 255, 255, 0.05))`,
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: `1px solid ${personaStyles.borderColors[key]}`,
              boxShadow: `${personaStyles.glowShadow[key]}, inset 0 1px 0 rgba(255, 255, 255, 0.15)`,
            }}
          >
            <Plus className="w-5 h-5 relative z-10" />
          </motion.button>
        )}

        <div className="relative flex-1">
          <div className="relative flex items-center">
            <motion.textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              className="w-full px-6 pr-16 rounded-[28px] text-white placeholder-gray-400 outline-none disabled:opacity-50 transition-all duration-300 text-base resize-none overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: floating
                  ? '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                  : 'inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                fontSize: '1rem',
                minHeight: '56px',
                maxHeight: '150px',
                paddingTop: '16px',
                paddingBottom: '16px',
                lineHeight: '24px',
              }}
              rows={1}
            />

            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <motion.button
                type="submit"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={disabled || !message.trim()}
                className="p-3 rounded-full text-white disabled:opacity-50 relative group transition-all duration-300"
                style={{
                  background: `linear-gradient(135deg, ${personaStyles.tintColors[key]}, rgba(255, 255, 255, 0.05))`,
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: `1px solid ${personaStyles.borderColors[key]}`,
                  boxShadow: `${personaStyles.glowShadow[key]}, inset 0 1px 0 rgba(255, 255, 255, 0.15)`,
                }}
              >
                <Send className="w-5 h-5 relative z-10" />
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
