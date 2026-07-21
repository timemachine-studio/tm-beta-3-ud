import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, X, Music2, Maximize2, Minimize2 } from 'lucide-react';
import { Track } from '../../services/music/lyricsService';

interface LyricsMiniPlayerProps {
  track: Track | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  onClose: () => void;
  onMaximize: () => void;
  currentTime: number;
  duration: number;
  isMaximized: boolean;
  onSeek?: (time: number) => void;
}

export function LyricsMiniPlayer({
  track,
  isPlaying,
  onPlayPause,
  onClose,
  onMaximize,
  currentTime,
  duration,
  isMaximized,
  onSeek,
}: LyricsMiniPlayerProps) {
  // Hover and collapse/expand state for mini player
  const [isHovered, setIsHovered] = useState(false);
  const [isClickedExpanded, setIsClickedExpanded] = useState(false);

  // Smooth scrubbing state
  const [localTime, setLocalTime] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!track) return null;

  const isOpen = isHovered || isClickedExpanded;
  const displayTime = localTime !== null ? localTime : currentTime;
  const progress = duration > 0 ? (displayTime / duration) * 100 : 0;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const cleanTitle = (title: string, artist: string): string => {
    let cleaned = title;
    
    // Remove common YouTube suffixes in parentheses or square brackets
    cleaned = cleaned.replace(/\s*[([][^)]*(?:video|audio|lyrics|official|song|music|clip|hd|hq|4k|ft|feat)[^\])]*[\])]/gi, '');
    
    // Remove isolated feat/ft
    cleaned = cleaned.replace(/\s*(?:feat\.?|ft\.?)\s+.*$/i, '');
    
    // Check separators
    const separators = [' - ', ' | ', ' : ', ' – '];
    for (const sep of separators) {
      if (cleaned.includes(sep)) {
        const parts = cleaned.split(sep);
        const part0 = parts[0].trim();
        const part1 = parts.slice(1).join(sep).trim();
        const part0Lower = part0.toLowerCase();
        const artistLower = artist.toLowerCase();
        
        if (part0Lower.includes(artistLower) || artistLower.includes(part0Lower)) {
          cleaned = part1;
        } else {
          cleaned = part1; // Fallback: assume "Artist - Title" format
        }
        break;
      }
    }
    
    cleaned = cleaned.trim().replace(/^[-–—:|]+|[-–—:|]+$/g, '').trim();
    
    if (cleaned) {
      return cleaned.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
    
    return title;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="fixed bottom-24 right-4 z-50 flex justify-end"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setIsClickedExpanded(false);
        }}
      >
        <motion.div
          layout
          className="rounded-2xl border relative overflow-hidden select-none"
          style={{
            width: isOpen ? '24rem' : '3.5rem', // 3.5rem is 56px (w-14)
            height: isOpen ? 'auto' : '3.5rem', // 3.5rem is 56px (h-14)
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(30px)',
            WebkitBackdropFilter: 'blur(30px)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          {/* Subtle background glow */}
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 pointer-events-none" />

          {!isOpen ? (
            // Minimized View - Shows only Cover Art
            <div 
              onClick={() => setIsClickedExpanded(true)}
              className="w-full h-full flex items-center justify-center relative cursor-pointer group"
              title={`${cleanTitle(track.title, track.artist)} - ${track.artist}`}
            >
              {track.thumbnail ? (
                <img
                  src={track.thumbnail}
                  alt={track.title}
                  className="w-full h-full object-cover rounded-xl"
                />
              ) : (
                <Music2 className="w-6 h-6 text-purple-400" />
              )}
              {isPlaying && (
                <div className="absolute inset-0 rounded-xl border-2 border-purple-500/50 animate-pulse pointer-events-none" />
              )}
            </div>
          ) : (
            // Expanded View - Full Controls and Track Info
            <div className="p-4 flex flex-col">
              {/* Header */}
              <div className="flex items-start gap-3 mb-3 relative z-10">
                {/* Thumbnail */}
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/10 flex items-center justify-center flex-shrink-0">
                  {track.thumbnail ? (
                    <img
                      src={track.thumbnail}
                      alt={track.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Music2 className="w-6 h-6 text-purple-400" />
                  )}
                </div>

                {/* Song Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-semibold text-sm truncate" title={track.title}>
                    {cleanTitle(track.title, track.artist)}
                  </h4>
                  <p className="text-white/60 text-xs truncate" title={track.artist}>
                    {track.artist}
                  </p>
                  <span className="text-[10px] text-purple-400 font-medium uppercase tracking-wider mt-1 block">
                    TimeMachine Music
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMaximize();
                    }}
                    className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors"
                    title={isMaximized ? "Minimize Lyrics" : "View Lyrics"}
                  >
                    {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose();
                    }}
                    className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors"
                    title="Close Player"
                  >
                    <X className="w-3.5 h-3.5" />
                  </motion.button>
                </div>
              </div>

              {/* Progress Bar with Scrubbing */}
              <div className="mb-3 relative z-10 flex flex-col gap-1 group/slider" onClick={(e) => e.stopPropagation()}>
                <input
                  ref={inputRef}
                  type="range"
                  min="0"
                  max={duration || 100}
                  value={displayTime}
                  onChange={(e) => {
                    setLocalTime(Number(e.target.value));
                  }}
                  onMouseUp={() => {
                    if (inputRef.current) {
                      onSeek && onSeek(Number(inputRef.current.value));
                    }
                    setLocalTime(null);
                  }}
                  onTouchEnd={() => {
                    if (inputRef.current) {
                      onSeek && onSeek(Number(inputRef.current.value));
                    }
                    setLocalTime(null);
                  }}
                  className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer outline-none transition-all accent-purple-500 hover:accent-pink-500 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:opacity-0 [&::-webkit-slider-thumb]:group-hover/slider:opacity-100 [&::-webkit-slider-thumb]:transition-opacity [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:opacity-0 [&::-moz-range-thumb]:group-hover/slider:opacity-100 [&::-moz-range-thumb]:border-none"
                  style={{
                    background: `linear-gradient(to right, #a855f7 0%, #ec4899 ${progress}%, rgba(255, 255, 255, 0.1) ${progress}%, rgba(255, 255, 255, 0.1) 100%)`
                  }}
                />
                <div className="flex justify-between text-[10px] text-white/40 mt-0.5">
                  <span>{formatTime(displayTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-4 relative z-10" onClick={(e) => e.stopPropagation()}>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onPlayPause}
                  className="p-2.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-white shadow-lg flex items-center justify-center"
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 text-white" />
                  ) : (
                    <Play className="w-4 h-4 text-white fill-white" />
                  )}
                </motion.button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
