import React, { useEffect, useRef, useMemo } from 'react';
import { LyricLine } from '../../services/music/lyricsService';
import { motion } from 'framer-motion';

interface LyricsDisplayProps {
  lyrics: LyricLine[];
  currentTime: number;
  onSeek: (time: number) => void;
  isSynced: boolean;
}

const LyricsDisplay: React.FC<LyricsDisplayProps> = ({
  lyrics,
  currentTime,
  onSeek,
  isSynced,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Find active line index memoized to prevent constant recalculation logic on every frame
  const activeIndex = useMemo(() => {
    if (!isSynced || lyrics.length === 0) return -1;
    
    // Binary search or simple find is fine for typical lyric lengths
    const index = lyrics.findIndex((line, i) => {
      const nextLine = lyrics[i + 1];
      const lineTime = line.time || 0;
      const nextTime = nextLine ? nextLine.time || Infinity : Infinity;
      return currentTime >= lineTime && currentTime < nextTime;
    });
    
    return index;
  }, [lyrics, currentTime, isSynced]);

  // Handle smooth scrolling to center
  useEffect(() => {
    if (containerRef.current && activeIndex >= 0 && lineRefs.current[activeIndex]) {
      const container = containerRef.current;
      const activeLine = lineRefs.current[activeIndex];
      
      if (!activeLine) return;

      const containerHeight = container.offsetHeight;
      const lineOffset = activeLine.offsetTop;
      const lineHeight = activeLine.offsetHeight;
      
      // Calculate target scroll position to center the line
      const targetScroll = lineOffset - (containerHeight / 2) + (lineHeight / 2);
      
      container.scrollTo({
        top: targetScroll,
        behavior: 'smooth',
      });
    }
  }, [activeIndex]);

  return (
    <div 
      ref={containerRef}
      className="relative w-full max-w-2xl h-[65vh] overflow-y-auto overflow-x-hidden px-6 select-none transition-all duration-300 hide-scrollbar -translate-y-10"
      style={{
        maskImage: 'linear-gradient(to bottom, transparent 0%, white 25%, white 75%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, white 25%, white 75%, transparent 100%)',
      }}
    >
      <div className="flex flex-col gap-10 text-center md:text-left py-[30vh]">
        {lyrics.map((line, index) => {
          const isActive = index === activeIndex;

          return (
            <motion.div
              key={`line-${index}`}
              ref={(el) => { lineRefs.current[index] = el; }}
              onClick={() => isSynced && line.time !== null && onSeek(line.time)}
              className="cursor-pointer py-2 px-4 rounded-xl transition-colors duration-300 hover:bg-white/5"
              initial={false}
              animate={{
                opacity: isActive ? 1 : 0.2,
                scale: isActive ? 1.05 : 0.95,
                filter: isActive ? 'blur(0px)' : 'blur(2px)',
                y: isActive ? 0 : (index < activeIndex ? -5 : 5)
              }}
              transition={{
                duration: 0.6,
                ease: [0.4, 0, 0.2, 1] // Custom cubic-bezier for smooth kinetic feel
              }}
            >
              <p 
                className={`text-2xl md:text-4xl font-bold tracking-tight leading-tight transition-all duration-700 ${
                  isActive 
                    ? 'text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.6)]' 
                    : 'text-white/60'
                }`}
              >
                {line.text}
              </p>
            </motion.div>
          );
        })}
        {lyrics.length === 0 && (
          <div className="flex flex-col items-center gap-4 opacity-35">
            <p className="text-2xl italic font-medium">Listening for rhythm...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LyricsDisplay;
