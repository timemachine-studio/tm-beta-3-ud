import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Volume2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { AI_PERSONAS } from '../../config/constants';

interface AudioPlayerBubbleProps {
  audioSrc: string;
  isUserMessage?: boolean;
  isLoading?: boolean;
  className?: string;
  currentPersona?: keyof typeof AI_PERSONAS;
}

// Dynamic Waveform Visualizer Component
interface DynamicWaveformVisualizerProps {
  analyser: AnalyserNode | null;
  isUserMessage: boolean;
  isPlaying: boolean;
  currentPersona?: keyof typeof AI_PERSONAS;
}

const personaVisualizerColors = {
  default: '#a855f7', // Purple
  girlie: '#ec4899', // Pink
  pro: '#06b6d4' // Cyan
} as const;

const DynamicWaveformVisualizer: React.FC<DynamicWaveformVisualizerProps> = ({ 
  analyser, 
  isUserMessage, 
  isPlaying,
  currentPersona = 'default'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    if (!analyser || !canvasRef.current || !isPlaying) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isPlaying) return;
      
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barCount = 20;
      const barWidth = canvas.width / barCount;
      const maxBarHeight = canvas.height * 0.8;

      for (let i = 0; i < barCount; i++) {
        const dataIndex = Math.floor((i / barCount) * bufferLength);
        const barHeight = (dataArray[dataIndex] / 255) * maxBarHeight;
        
        const x = i * barWidth;
        const y = (canvas.height - barHeight) / 2;

        // Color based on message type and persona
        const color = isUserMessage ? '#a855f7' : personaVisualizerColors[currentPersona];
        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        gradient.addColorStop(0, color + '80');
        gradient.addColorStop(1, color + 'FF');

        ctx.fillStyle = gradient;
        ctx.fillRect(x + 1, y, barWidth - 2, barHeight);

        // Add glow effect
        ctx.shadowColor = color;
        ctx.shadowBlur = 3;
        ctx.fillRect(x + 1, y, barWidth - 2, barHeight);
        ctx.shadowBlur = 0;
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyser, isUserMessage, isPlaying, currentPersona]);

  return (
    <canvas
      ref={canvasRef}
      width={160}
      height={24}
      className="w-full h-6"
    />
  );
};

export function AudioPlayerBubble({ 
  audioSrc, 
  isUserMessage = false, 
  isLoading = false,
  className = '',
  currentPersona = 'default'
}: AudioPlayerBubbleProps) {
  const { theme } = useTheme();
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoadingAudio, setIsLoadingAudio] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [analyserInstance, setAnalyserInstance] = useState<AnalyserNode | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = 'anonymous';
    }

    const audio = audioRef.current;
    
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoadingAudio(false);
      setHasError(false);
      
      // Initialize Web Audio API for waveform visualization
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        
        if (!sourceNodeRef.current && audioContextRef.current) {
          sourceNodeRef.current = audioContextRef.current.createMediaElementSource(audio);
          const analyser = audioContextRef.current.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.8;
          
          sourceNodeRef.current.connect(analyser);
          analyser.connect(audioContextRef.current.destination);
          
          setAnalyserInstance(analyser);
        }
      } catch (error) {
        console.warn('Web Audio API not supported or failed to initialize:', error);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = () => {
      setIsLoadingAudio(false);
      setHasError(true);
      setIsPlaying(false);
    };

    const handleCanPlay = () => {
      setIsLoadingAudio(false);
      setHasError(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);

    // Set the audio source
    if (audioSrc !== audio.src) {
      setIsLoadingAudio(true);
      setHasError(false);
      setAnalyserInstance(null);
      
      // Clean up previous audio context
      if (sourceNodeRef.current) {
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
      }
      
      audio.src = audioSrc;
      audio.load();
    }

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
      
      // Cleanup Web Audio API
      if (sourceNodeRef.current) {
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [audioSrc]);

  const togglePlayPause = async () => {
    if (!audioRef.current || hasError) return;

    try {
      // Resume audio context if it's suspended
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      setHasError(true);
      setIsPlaying(false);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Static waveform for when not playing or no analyser
  const StaticWaveform = () => (
    <div className="flex items-center gap-[2px] h-6 px-2">
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className={`w-[2px] bg-current rounded-full opacity-60
            ${isUserMessage ? 'text-white' : theme.text}`}
          animate={isPlaying ? {
            height: [
              '8px',
              i % 3 === 0 ? '20px' : i % 2 === 0 ? '16px' : '12px',
              '8px'
            ],
            opacity: [0.6, 1, 0.6]
          } : {
            height: '8px',
            opacity: 0.6
          }}
          transition={{
            duration: 1.2,
            repeat: isPlaying ? Infinity : 0,
            delay: i * 0.1,
            ease: [0.4, 0, 0.6, 1],
          }}
        />
      ))}
    </div>
  );

  if (isLoading) {
    return (
      <div className={`flex items-center gap-3 p-3 rounded-2xl
        ${isUserMessage 
          ? 'bg-purple-500/10 border border-purple-500/20' 
          : 'bg-white/5 border border-white/10'
        } ${className}`}
      >
        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
          <Volume2 className="w-4 h-4 text-white/60" />
        </div>
        <div className="flex-1">
          <div className="text-sm text-white/60">Loading audio...</div>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className={`flex items-center gap-3 p-3 rounded-2xl
        ${isUserMessage 
          ? 'bg-purple-500/10 border border-purple-500/20' 
          : 'bg-white/5 border border-white/10'
        } ${className}`}
      >
        <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
          <Volume2 className="w-4 h-4 text-red-400" />
        </div>
        <div className="flex-1">
          <div className="text-sm text-red-400">Failed to load audio</div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`flex items-center gap-3 p-3 rounded-2xl
        ${isUserMessage 
          ? 'bg-purple-500/10 border border-purple-500/20' 
          : 'bg-white/5 border border-white/10'
        } ${className} max-w-xs`}
    >
      {/* Play/Pause Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={togglePlayPause}
        disabled={isLoadingAudio}
        className={`w-8 h-8 rounded-full flex items-center justify-center
          ${isUserMessage 
            ? 'bg-purple-500/20 hover:bg-purple-500/30' 
            : 'bg-white/10 hover:bg-white/20'
          } transition-colors duration-200 disabled:opacity-50`}
      >
        <AnimatePresence mode="wait">
          {isLoadingAudio ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"
            />
          ) : isPlaying ? (
            <motion.div
              key="pause"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <Pause className="w-4 h-4" />
            </motion.div>
          ) : (
            <motion.div
              key="play"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <Play className="w-4 h-4 ml-0.5" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Waveform and Progress */}
      <div className="flex-1 min-w-0">
        <div className="relative">
          {isPlaying && analyserInstance ? (
            <DynamicWaveformVisualizer 
              analyser={analyserInstance} 
              isUserMessage={isUserMessage}
              isPlaying={isPlaying}
              currentPersona={currentPersona}
            />
          ) : (
            <StaticWaveform />
          )}
          
          {/* Progress Bar Overlay */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full
                ${isUserMessage ? 'bg-purple-400' : 'bg-white/40'}`}
              style={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
        </div>
        
        {/* Time Display */}
        <div className={`text-xs mt-1 opacity-60
          ${isUserMessage ? 'text-white' : theme.text}`}
        >
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>
    </motion.div>
  );
}
