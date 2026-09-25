import { popupExit } from '../../utils/popupMotion';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Square } from 'lucide-react';
import { AI_PERSONAS } from '../../config/constants';
import AiMicIcon from '../icons/AiMicIcon';

type Persona = keyof typeof AI_PERSONAS;

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly 0: { readonly transcript: string };
}

interface SpeechRecognitionEventLike extends Event {
  readonly results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface SpeechWindow extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

interface SpeechTranscriptionButtonProps {
  value: string;
  onTranscript: (value: string) => void;
  disabled?: boolean;
  currentPersona?: Persona;
  /** TM Healthcare paints the bar green; the mic follows. */
  accent?: 'healthcare';
}

/* The legacy bar's circle: the mic sits inside the field in the mind's hue
   and turns red while it listens. Kept in step with ChatInput's. */
const personaRgb = { default: '168 85 247', girlie: '236 72 153', pro: '34 211 238', healthcare: '16 185 129' } as const;

const recognitionErrorMessage = (error: string) => {
  if (error === 'not-allowed' || error === 'service-not-allowed') {
    return 'Microphone permission is required';
  }
  if (error === 'no-speech') return 'No speech was detected';
  if (error === 'audio-capture') return 'No microphone was found';
  return 'Speech transcription stopped';
};

export function SpeechTranscriptionButton({
  value,
  onTranscript,
  disabled,
  currentPersona = 'default',
  accent,
}: SpeechTranscriptionButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const startingTextRef = useRef('');
  const stylePersona: keyof typeof personaRgb = accent === 'healthcare'
    ? 'healthcare'
    : currentPersona === 'girlie' || currentPersona === 'pro' ? currentPersona : 'default';
  const accentRgb = stylePersona === 'healthcare' ? personaRgb.healthcare : `var(--tm-chat-accent-rgb, ${personaRgb[stylePersona]})`;

  useEffect(() => () => recognitionRef.current?.abort(), []);

  const stopTranscription = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  };

  const startTranscription = () => {
    setError(null);

    const speechWindow = window as SpeechWindow;
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Live transcription is not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';
    startingTextRef.current = value;

    recognition.onresult = (event) => {
      let sessionTranscript = '';
      for (let index = 0; index < event.results.length; index += 1) {
        sessionTranscript += event.results[index][0].transcript;
      }

      const startingText = startingTextRef.current;
      const separator = startingText && !/\s$/.test(startingText) && sessionTranscript ? ' ' : '';
      onTranscript(`${startingText}${separator}${sessionTranscript}`);
    };

    recognition.onerror = (event) => {
      setError(recognitionErrorMessage(event.error));
      recognitionRef.current = null;
      setIsListening(false);
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
    } catch {
      setError('Could not start live transcription');
    }
  };

  const handleToggle = () => {
    if (isListening) stopTranscription();
    else if (!disabled) startTranscription();
  };

  return (
    <div className="relative">
      <motion.button
        aria-pressed={isListening}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleToggle}
        disabled={disabled && !isListening}
        className="p-3 rounded-full transition-all duration-300 relative group disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: isListening
            ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgb(var(--tm-ink-rgb) / 0.05))'
            : `linear-gradient(135deg, rgb(${accentRgb} / ${stylePersona === 'default' ? 0.2 : 0.15}), rgb(var(--tm-ink-rgb) / 0.05))`,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: isListening
            ? '1px solid rgba(239, 68, 68, 0.4)'
            : `1px solid rgb(${accentRgb} / ${stylePersona === 'default' ? 0.4 : 0.3})`,
          boxShadow: isListening
            ? '0 0 12px rgba(239, 68, 68, 0.3), inset 0 1px 0 rgb(var(--tm-edge-rgb) / 0.15)'
            : `0 0 ${stylePersona === 'default' ? 15 : 12}px rgb(${accentRgb} / ${stylePersona === 'default' ? 0.35 : 0.25}), inset 0 1px 0 rgb(var(--tm-edge-rgb) / 0.15)`
        }}
        type="button"
        aria-label={isListening ? 'Stop live transcription' : 'Start live transcription'}
        title={isListening ? 'Stop transcription' : 'Transcribe speech'}
      >
        <span className="relative z-10 flex items-center justify-center w-5 h-5">
          {isListening ? <Square className="w-4 h-4" /> : <AiMicIcon className="w-5 h-5" color="currentColor" />}
        </span>
      </motion.button>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={popupExit}
            className="absolute bottom-full mb-2 right-0 bg-linear-to-r/srgb from-red-900/90 to-pink-900/90 backdrop-blur-xl text-white text-sm px-4 py-2 rounded-lg w-56 max-w-[70vw] border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
