import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Square, AlertCircle } from 'lucide-react';
import { AI_PERSONAS } from '../../config/constants';
import AiMicIcon from '../icons/AiMicIcon';

interface VoiceRecorderProps {
  message: string;
  setMessage: React.Dispatch<React.SetStateAction<string>>;
  disabled?: boolean;
  currentPersona?: keyof typeof AI_PERSONAS;
}

// Persona-colored glass styling (matches ChatInput buttons)
const personaStyles = {
  tintColors: {
    default: 'rgba(168, 85, 247, 0.2)',    // Purple tint (brighter)
    girlie: 'rgba(236, 72, 153, 0.15)',    // Pink tint
    pro: 'rgba(34, 211, 238, 0.15)'        // Cyan tint
  },
  borderColors: {
    default: 'rgba(168, 85, 247, 0.4)',    // Purple border (brighter)
    girlie: 'rgba(236, 72, 153, 0.3)',      // Pink border
    pro: 'rgba(34, 211, 238, 0.3)'          // Cyan border
  },
  glowShadow: {
    default: '0 0 15px rgba(168, 85, 247, 0.35)',  // Purple glow (brighter, larger)
    girlie: '0 0 12px rgba(236, 72, 153, 0.25)',
    pro: '0 0 12px rgba(34, 211, 238, 0.25)'
  }
} as const;

export function VoiceRecorder({ message, setMessage, disabled, currentPersona = 'default' }: VoiceRecorderProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);

  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef<string>('');

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    setError(null);
    setShowError(false);
    baseTextRef.current = message;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setError('Microphone permission denied.');
        } else if (event.error === 'no-speech') {
          // Silent errors are fine, just stop listening
          return;
        } else {
          setError('Error occurred during speech recognition.');
        }
        setShowError(true);
        setTimeout(() => setShowError(false), 3000);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = 0; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        const baseText = baseTextRef.current;
        const spacing = (baseText && !baseText.endsWith(' ')) ? ' ' : '';
        setMessage(baseText + spacing + finalTranscript + interimTranscript);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error('Failed to initialize speech recognition:', e);
      setError('Could not start speech recognition.');
      setShowError(true);
      setTimeout(() => setShowError(false), 3000);
      setIsListening(false);
    }
  };

  const handleToggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
    } else if (!disabled) {
      startListening();
    }
  };

  if (!isSupported) {
    return (
      <button
        disabled
        title="Speech recognition is not supported in this browser. Try Chrome or Safari."
        className="p-3 rounded-full opacity-30 cursor-not-allowed transition-all duration-300"
        type="button"
        style={{
          border: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(255, 255, 255, 0.02)'
        }}
      >
        <AiMicIcon className="w-5 h-5 text-white/50" />
      </button>
    );
  }

  const activePersona = currentPersona in personaStyles.tintColors ? currentPersona : 'default';

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleToggleListening}
        disabled={disabled && !isListening}
        className="p-3 rounded-full transition-all duration-300 relative group disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: isListening
            ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(255, 255, 255, 0.05))'
            : `linear-gradient(135deg, ${personaStyles.tintColors[activePersona]}, rgba(255, 255, 255, 0.05))`,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: isListening
            ? '1px solid rgba(239, 68, 68, 0.5)'
            : `1px solid ${personaStyles.borderColors[activePersona]}`,
          boxShadow: isListening
            ? '0 0 15px rgba(239, 68, 68, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
            : `${personaStyles.glowShadow[activePersona]}, inset 0 1px 0 rgba(255, 255, 255, 0.15)`
        }}
        animate={isListening ? {
          scale: [1, 1.05, 1],
          boxShadow: [
            '0 0 15px rgba(239, 68, 68, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
            '0 0 25px rgba(239, 68, 68, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
            '0 0 15px rgba(239, 68, 68, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
          ]
        } : {}}
        transition={isListening ? {
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut"
        } : undefined}
        type="button"
      >
        <div className="relative z-10 flex items-center justify-center w-5 h-5">
          {isListening ? (
            <Square className="w-4 h-4 text-white fill-white animate-pulse" />
          ) : (
            <AiMicIcon className="w-5 h-5 text-white" />
          )}
        </div>
      </motion.button>

      <AnimatePresence>
        {showError && error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2
              bg-gradient-to-r from-red-900/90 to-pink-900/90
              backdrop-blur-xl text-white text-sm px-4 py-2
              rounded-lg whitespace-nowrap border border-red-500/30
              shadow-[0_0_15px_rgba(239,68,68,0.2)]"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2
              rotate-45 w-2 h-2 bg-gradient-to-br from-red-900/90 to-pink-900/90" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}