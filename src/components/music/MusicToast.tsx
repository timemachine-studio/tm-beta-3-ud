import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, X, Volume2, SkipBack, SkipForward, Library, Star as Stage } from 'lucide-react';

interface MusicToastProps {
  song: {
    title: string;
    artist: string;
  };
  isPlaying: boolean;
  onClose: () => void;
  onPlayPause: () => void;
  onPrevTrack: () => void;
  onNextTrack: () => void;
  onOpenLibrary: () => void;
  currentPersona?: 'default' | 'girlie' | 'x';
  isCenterStage?: boolean;
}

const MusicVisualizer = ({ currentPersona = 'default' }: { currentPersona?: 'default' | 'girlie' | 'x' }) => {
  const barGlowColors = {
    default: 'rgba(255, 255, 255, 0.5)',
    girlie: 'rgba(255, 105, 180, 0.7)',
    x: 'rgba(255, 255, 255, 0.5)'
  };

  return (
    <div className="flex items-center justify-center gap-[2px] h-4 px-1">
      {[...Array(4)].map((_, i) => (
        <motion.div
          key={i}
          className={`w-[2px] bg-gradient-to-t from-white/40 to-white rounded-full
            ${currentPersona === 'girlie' ? 'from-pink-300/40 to-white' : ''}`}
          animate={{
            height: [
              '6px',
              i % 2 === 0 ? '12px' : '8px',
              '6px'
            ],
            opacity: [0.8, 1, 0.8]
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.15,
            ease: [0.4, 0, 0.6, 1],
            times: [0, 0.5, 1]
          }}
          style={{
            boxShadow: `0 0 10px ${barGlowColors[currentPersona]}`,
            filter: 'blur(0.3px)'
          }}
        />
      ))}
    </div>
  );
};

export function MusicToast({
  song,
  isPlaying,
  onClose,
  onPlayPause,
  onPrevTrack,
  onNextTrack,
  onOpenLibrary,
  currentPersona = 'default',
  isCenterStage = false
}: MusicToastProps) {
  const personaColors = {
    default: 'from-purple-600/10 to-blue-600/10',
    girlie: 'from-pink-500/10 to-rose-400/10',
    x: 'from-cyan-600/10 to-blue-600/10'
  };

  const iconGlowStyle = currentPersona === 'girlie' ? {
    filter: 'drop-shadow(0 0 8px rgba(255, 105, 180, 0.7))'
  } : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="fixed bottom-24 right-4 z-50"
    >
      <div className={`p-3 rounded-lg
        bg-white/5 backdrop-blur-xl
        border border-white/5
        flex items-center gap-3 w-[280px] sm:w-[320px]
        shadow-lg`}
      >
        {/* Animated Equalizer */}
        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
          <AnimatePresence mode="wait">
            {isPlaying ? (
              <motion.div
                key="visualizer"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
              >
                <MusicVisualizer currentPersona={currentPersona} />
              </motion.div>
            ) : (
              <motion.div
                key="volume"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
              >
                <Volume2 className="w-4 h-4 text-white" style={iconGlowStyle} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Song Info */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white truncate">{song.title}</div>
          <div className="text-xs text-white/70 truncate">{song.artist}</div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onPrevTrack}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
          >
            <SkipBack className="w-4 h-4 text-white" style={iconGlowStyle} />
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onPlayPause}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <AnimatePresence mode="wait">
              {isPlaying ? (
                <motion.div
                  key="pause"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                >
                  <Pause className="w-4 h-4 text-white" style={iconGlowStyle} />
                </motion.div>
              ) : (
                <motion.div
                  key="play"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                >
                  <Play className="w-4 h-4 text-white" style={iconGlowStyle} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onNextTrack}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
          >
            <SkipForward className="w-4 h-4 text-white" style={iconGlowStyle} />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className={`p-1.5 rounded-full transition-colors
              ${isCenterStage 
                ? 'bg-purple-500/20 text-white' 
                : 'hover:bg-white/10 text-white/70 hover:text-white'}`}
          >
            <Stage className="w-4 h-4" style={iconGlowStyle} />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onOpenLibrary}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
          >
            <Library className="w-4 h-4 text-white" style={iconGlowStyle} />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-4 h-4 text-white" style={iconGlowStyle} />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}