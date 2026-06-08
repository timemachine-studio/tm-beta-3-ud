import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { AI_PERSONAS } from '../../config/constants';
import AiMicIcon from '../icons/AiMicIcon';

interface VoiceRecorderProps {
  onTranscription: (text: string) => void;
  onListeningChange?: (listening: boolean) => void;
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

const personaVisualizerColors = {
  default: '#a855f7',
  girlie: '#ec4899',
  pro: '#06b6d4'
} as const;

// 5-bar jumping voice visualizer component using CSS/framer-motion
function JumpingVoiceBars({ color }: { color: string }) {
  return (
    <div className="flex items-end justify-center gap-[3px] w-5 h-5 px-0.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          className="w-[3px] rounded-full"
          style={{ backgroundColor: color }}
          animate={{
            height: [4, 18, 6, 20, 4][i % 5] === 4 ? [4, 18, 4] :
                    [4, 18, 6, 20, 4][i % 5] === 18 ? [6, 20, 6] : [4, 12, 4],
          }}
          transition={{
            duration: 0.7,
            repeat: Infinity,
            delay: i * 0.12,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

export function VoiceRecorder({ onTranscription, onListeningChange, disabled, currentPersona = 'default' }: VoiceRecorderProps) {
  const [isSupported, setIsSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const handleToggleListening = () => {
    if (!isSupported) {
      setError('Speech recognition is not supported in this browser. Try Chrome, Safari, or Edge.');
      setShowError(true);
      setTimeout(() => setShowError(false), 4000);
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    } else if (!disabled) {
      setError(null);
      setShowError(false);

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        onListeningChange?.(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        onTranscription(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setError('Microphone access denied.');
        } else {
          setError(`Speech input error: ${event.error}`);
        }
        setShowError(true);
        setTimeout(() => setShowError(false), 3000);
        setIsListening(false);
        onListeningChange?.(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        onListeningChange?.(false);
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch (err) {
        console.error('Failed to start recognition:', err);
      }
    }
  };

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
            : `linear-gradient(135deg, ${personaStyles.tintColors[currentPersona]}, rgba(255, 255, 255, 0.05))`,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: isListening
            ? '1px solid rgba(239, 68, 68, 0.5)'
            : `1px solid ${personaStyles.borderColors[currentPersona]}`,
          boxShadow: isListening
            ? '0 0 15px rgba(239, 68, 68, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
            : `${personaStyles.glowShadow[currentPersona]}, inset 0 1px 0 rgba(255, 255, 255, 0.15)`
        }}
        animate={isListening ? {
          boxShadow: [
            '0 0 10px rgba(239, 68, 68, 0.3)',
            '0 0 22px rgba(239, 68, 68, 0.6)',
            '0 0 10px rgba(239, 68, 68, 0.3)'
          ]
        } : {}}
        transition={isListening ? {
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut"
        } : {}}
        type="button"
      >
        <div className="relative z-10 flex items-center justify-center w-5 h-5">
          {isListening ? (
            <JumpingVoiceBars color={personaVisualizerColors[currentPersona]} />
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