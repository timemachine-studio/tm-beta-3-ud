import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Square, AlertCircle } from 'lucide-react';
import { useAudioRecording } from '../../hooks/useAudioRecording';
import { AI_PERSONAS } from '../../config/constants';
import AiMicIcon from '../icons/AiMicIcon';

interface VoiceRecorderProps {
  onSendMessage: (message: string, imageData?: string | string[], audioData?: string) => void;
  disabled?: boolean;
  currentPersona?: keyof typeof AI_PERSONAS;
}

const personaGlowColors = {
  default: 'rgba(168,85,247,0.2)',
  girlie: 'rgba(255,0,128,0.5)',
  pro: 'rgba(34,211,238,0.2)'
} as const;

const personaBorderColors = {
  default: 'from-purple-600/20 to-blue-600/20',
  girlie: 'from-pink-500 to-rose-400',
  pro: 'from-cyan-600/20 to-blue-600/20'
} as const;

const personaVisualizerColors = {
  default: '#a855f7',
  girlie: '#ec4899',
  pro: '#06b6d4'
} as const;

function AudioVisualizer({ analyser, currentPersona = 'default' }: { analyser: AnalyserNode | null; currentPersona?: keyof typeof AI_PERSONAS }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    if (!analyser || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = canvas.width / bufferLength * 2.5;
      let barHeight;
      let x = 0;

      const color = personaVisualizerColors[currentPersona];

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height * 0.8;

        // Create gradient for bars
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
        gradient.addColorStop(0, color + '80'); // Semi-transparent
        gradient.addColorStop(1, color + 'FF'); // Full opacity

        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        // Add glow effect
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        ctx.shadowBlur = 0;

        x += barWidth + 1;
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyser, currentPersona]);

  return (
    <canvas
      ref={canvasRef}
      width={20}
      height={20}
      className="w-5 h-5"
      style={{ filter: 'blur(0.5px)' }}
    />
  );
}

export function VoiceRecorder({ onSendMessage, disabled, currentPersona = 'default' }: VoiceRecorderProps) {
  const { isRecording, startRecording, stopRecording, error, analyser } = useAudioRecording();
  const [showError, setShowError] = useState(false);

  const handleToggleRecording = async () => {
    try {
      setShowError(false);
      if (isRecording) {
        const audioData = await stopRecording();
        if (audioData) {
          await onSendMessage('', undefined, audioData);
        }
      } else if (!disabled) {
        await startRecording();
      }
    } catch (error) {
      setShowError(true);
      setTimeout(() => setShowError(false), 3000);
    }
  };

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleToggleRecording}
        disabled={disabled && !isRecording}
        className={`p-3 rounded-full transition-all duration-300 relative group
          backdrop-blur-xl border border-white/10
          disabled:opacity-50 disabled:cursor-not-allowed
          ${isRecording 
            ? 'bg-gradient-to-r from-red-600/20 to-pink-600/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
            : `bg-gradient-to-r ${personaBorderColors[currentPersona]} shadow-[0_0_15px_${personaGlowColors[currentPersona]}]
               ${currentPersona === 'girlie' ? 'hover:shadow-[0_0_25px_rgba(255,0,128,0.7)]' : ''}`
          }`}
        type="button"
      >
        {/* Premium glow effect */}
        <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100
          transition-opacity duration-300 animate-pulse"
          style={{
            background: isRecording
              ? 'linear-gradient(to right, rgba(239,68,68,0), rgba(239,68,68,0.3), rgba(239,68,68,0))'
              : `linear-gradient(to right, transparent, ${personaGlowColors[currentPersona]}, transparent)`
          }}
        />
        
        <div className="relative z-10 flex items-center justify-center w-5 h-5">
          {isRecording ? (
            analyser ? (
              <AudioVisualizer analyser={analyser} currentPersona={currentPersona} />
            ) : (
              <Square className="w-5 h-5 text-white drop-shadow-glow" />
            )
          ) : (
            <AiMicIcon className="w-5 h-5 text-white drop-shadow-glow" />
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