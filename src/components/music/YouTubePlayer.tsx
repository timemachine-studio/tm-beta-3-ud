import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, X, SkipBack, SkipForward, Volume2, VolumeX, ExternalLink } from 'lucide-react';

// Extend Window interface for YouTube IFrame API
// declare global { interface Window { YT: typeof YT; onYouTubeIframeAPIReady: () => void; } }

let playerInstance = null;
let apiReady = false;
let apiLoadCallbacks = [];

function loadYouTubeAPI() {
  return new Promise((resolve) => {
    if (apiReady) { resolve(); return; }
    if (window.YT && window.YT.Player) { apiReady = true; resolve(); return; }
    apiLoadCallbacks.push(resolve);
    if (!document.getElementById('youtube-iframe-api')) {
      const tag = document.createElement('script');
      tag.id = 'youtube-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      window.onYouTubeIframeAPIReady = () => {
        apiReady = true;
        apiLoadCallbacks.forEach(cb => cb());
        apiLoadCallbacks = [];
      };
    }
  });
}

export function YouTubePlayerPremium({ musicData, onClose }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const progressRef = useRef(null);
  const progressIntervalRef = useRef(null);

  // Audio visualizer bars (simulated)
  const [visualizerBars] = useState(() => 
    Array.from({ length: 32 }, () => Math.random())
  );

  useEffect(() => {
    if (!musicData) return;
    setHasError(false);
    setErrorMessage('');
    setIsReady(false);

    const initPlayer = async () => {
      await loadYouTubeAPI();
      if (playerInstance) {
        try { playerInstance.destroy(); } catch (e) {}
        playerInstance = null;
      }
      const playerElement = document.getElementById('yt-player-hidden');
      if (!playerElement) return;

      playerInstance = new window.YT.Player('yt-player-hidden', {
        height: '1',
        width: '1',
        videoId: musicData.videoId,
        playerVars: {
          autoplay: 1, playsinline: 1, controls: 0, disablekb: 1,
          fs: 0, modestbranding: 1, rel: 0, enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            setIsReady(true);
            setDuration(event.target.getDuration());
            event.target.playVideo();
            setIsPlaying(true);
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) setIsPlaying(true);
            else if (event.data === window.YT.PlayerState.PAUSED) setIsPlaying(false);
            else if (event.data === window.YT.PlayerState.ENDED) {
              setIsPlaying(false);
              setCurrentTime(0);
            }
          },
          onError: (event) => {
            setHasError(true);
            setIsReady(true);
            if (event.data === 150 || event.data === 101) {
              setErrorMessage('Embedding disabled');
            } else if (event.data === 100) {
              setErrorMessage('Video not found');
            } else {
              setErrorMessage('Playback error');
            }
          }
        }
      });
    };

    initPlayer();
    return () => { if (progressIntervalRef.current) clearInterval(progressIntervalRef.current); };
  }, [musicData?.videoId]);

  useEffect(() => {
    if (isPlaying && playerInstance) {
      progressIntervalRef.current = setInterval(() => {
        try {
          const time = playerInstance?.getCurrentTime() || 0;
          setCurrentTime(time);
        } catch (e) {}
      }, 100);
    } else {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    }
    return () => { if (progressIntervalRef.current) clearInterval(progressIntervalRef.current); };
  }, [isPlaying]);

  const togglePlay = useCallback(() => {
    if (!playerInstance) return;
    try {
      if (isPlaying) playerInstance.pauseVideo();
      else playerInstance.playVideo();
    } catch (e) {}
  }, [isPlaying]);

  const toggleMute = useCallback(() => {
    if (!playerInstance) return;
    try {
      if (isMuted) { playerInstance.unMute(); setIsMuted(false); }
      else { playerInstance.mute(); setIsMuted(true); }
    } catch (e) {}
  }, [isMuted]);

  const seekBackward = useCallback(() => {
    if (!playerInstance) return;
    try {
      const time = playerInstance.getCurrentTime();
      playerInstance.seekTo(Math.max(0, time - 10), true);
    } catch (e) {}
  }, []);

  const seekForward = useCallback(() => {
    if (!playerInstance) return;
    try {
      const time = playerInstance.getCurrentTime();
      const dur = playerInstance.getDuration();
      playerInstance.seekTo(Math.min(dur, time + 10), true);
    } catch (e) {}
  }, []);

  const handleClose = useCallback(() => {
    if (playerInstance) {
      try { playerInstance.stopVideo(); playerInstance.destroy(); } catch (e) {}
      playerInstance = null;
    }
    setIsReady(false);
    setIsPlaying(false);
    setHasError(false);
    setErrorMessage('');
    onClose();
  }, [onClose]);

  const openInYouTube = useCallback(() => {
    if (musicData) window.open(`https://www.youtube.com/watch?v=${musicData.videoId}`, '_blank');
  }, [musicData]);

  const handleProgressClick = (e) => {
    if (!playerInstance || !progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;
    playerInstance.seekTo(newTime, true);
    setCurrentTime(newTime);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!musicData) return null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Space+Mono:wght@400;700&display=swap');
        
        .player-glass {
          background: linear-gradient(
            135deg,
            rgba(20, 20, 25, 0.85) 0%,
            rgba(30, 30, 38, 0.75) 50%,
            rgba(20, 20, 25, 0.85) 100%
          );
          backdrop-filter: blur(40px) saturate(180%);
          -webkit-backdrop-filter: blur(40px) saturate(180%);
        }
        
        .player-glass::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.12) 0%,
            rgba(255, 255, 255, 0.03) 50%,
            rgba(255, 255, 255, 0.08) 100%
          );
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
        
        .noise-overlay {
          position: absolute;
          inset: 0;
          border-radius: inherit;
          opacity: 0.03;
          pointer-events: none;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
        }
        
        .glow-orb {
          position: absolute;
          width: 200px;
          height: 200px;
          border-radius: 50%;
          filter: blur(60px);
          opacity: 0.4;
          pointer-events: none;
        }
        
        .control-btn {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }
        
        .control-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.12);
          transform: scale(1.05);
        }
        
        .control-btn:active {
          transform: scale(0.95);
        }
        
        .play-btn {
          background: linear-gradient(135deg, #fff 0%, #e0e0e0 100%);
          border: none;
          box-shadow: 
            0 4px 20px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.4);
        }
        
        .play-btn:hover {
          background: linear-gradient(135deg, #fff 0%, #f5f5f5 100%);
          box-shadow: 
            0 6px 28px rgba(0, 0, 0, 0.5),
            inset 0 1px 0 rgba(255, 255, 255, 0.5);
        }
        
        .progress-track {
          position: relative;
          height: 4px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 2px;
          cursor: pointer;
          overflow: visible;
        }
        
        .progress-track:hover {
          height: 6px;
        }
        
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #a78bfa 0%, #818cf8 100%);
          border-radius: 2px;
          position: relative;
          transition: width 0.1s linear;
        }
        
        .progress-knob {
          position: absolute;
          right: -6px;
          top: 50%;
          transform: translateY(-50%);
          width: 12px;
          height: 12px;
          background: #fff;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
          opacity: 0;
          transition: opacity 0.2s;
        }
        
        .progress-track:hover .progress-knob {
          opacity: 1;
        }
        
        .visualizer-bar {
          background: linear-gradient(to top, rgba(167, 139, 250, 0.6), rgba(129, 140, 248, 0.3));
          border-radius: 1px;
        }
        
        .thumbnail-glow {
          position: absolute;
          inset: -20px;
          background: inherit;
          filter: blur(30px);
          opacity: 0.5;
          z-index: -1;
        }
      `}</style>

      <div
        id="yt-player-hidden"
        style={{
          position: 'fixed', top: 0, left: 0, width: '1px', height: '1px',
          opacity: 0, pointerEvents: 'none', zIndex: -1
        }}
      />

      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.95 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-24 right-4 z-50"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div 
            className="player-glass relative rounded-2xl overflow-hidden"
            style={{ 
              width: '340px',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            <div className="noise-overlay" />
            
            {/* Ambient glow orbs */}
            <motion.div 
              className="glow-orb"
              style={{ 
                background: 'radial-gradient(circle, rgba(167, 139, 250, 0.4) 0%, transparent 70%)',
                top: '-100px',
                left: '-50px',
              }}
              animate={{ 
                x: isPlaying ? [0, 20, 0] : 0,
                y: isPlaying ? [0, -10, 0] : 0,
              }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div 
              className="glow-orb"
              style={{ 
                background: 'radial-gradient(circle, rgba(129, 140, 248, 0.3) 0%, transparent 70%)',
                bottom: '-80px',
                right: '-60px',
              }}
              animate={{ 
                x: isPlaying ? [0, -15, 0] : 0,
                y: isPlaying ? [0, 15, 0] : 0,
              }}
              transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            />

            <div className="relative z-10 p-5">
              {/* Header with close button */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  <span 
                    className="text-[10px] tracking-[0.2em] uppercase text-white/40"
                    style={{ fontFamily: "'Space Mono', monospace" }}
                  >
                    Now Playing
                  </span>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleClose}
                  className="control-btn w-7 h-7"
                >
                  <X className="w-3.5 h-3.5 text-white/50" />
                </motion.button>
              </div>

              {/* Album art and info */}
              <div className="flex gap-4 mb-5">
                <div className="relative flex-shrink-0">
                  <motion.div 
                    className="w-20 h-20 rounded-xl overflow-hidden"
                    style={{
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                    }}
                    animate={{ 
                      rotate: isPlaying ? 360 : 0 
                    }}
                    transition={{ 
                      duration: 20, 
                      repeat: Infinity, 
                      ease: "linear",
                      repeatType: "loop"
                    }}
                  >
                    {musicData.thumbnail ? (
                      <>
                        <div className="thumbnail-glow">
                          <img src={musicData.thumbnail} alt="" className="w-full h-full object-cover" />
                        </div>
                        <img
                          src={musicData.thumbnail}
                          alt={musicData.title}
                          className="w-full h-full object-cover"
                        />
                      </>
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center">
                        <svg className="w-8 h-8 text-white/30" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                        </svg>
                      </div>
                    )}
                  </motion.div>
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <h4 
                    className="text-white font-medium text-sm leading-tight mb-1 line-clamp-2"
                    title={musicData.title}
                  >
                    {musicData.title}
                  </h4>
                  <p 
                    className="text-white/40 text-xs truncate"
                    title={musicData.artist}
                  >
                    {musicData.artist}
                  </p>
                </div>
              </div>

              {/* Visualizer */}
              <div className="flex items-end justify-center gap-[2px] h-8 mb-4 px-2">
                {visualizerBars.map((height, i) => (
                  <motion.div
                    key={i}
                    className="visualizer-bar w-[6px]"
                    animate={{
                      height: isPlaying 
                        ? [
                            `${Math.max(4, height * 24)}px`,
                            `${Math.max(4, Math.random() * 32)}px`,
                            `${Math.max(4, height * 24)}px`
                          ]
                        : '4px'
                    }}
                    transition={{
                      duration: 0.5 + Math.random() * 0.5,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                ))}
              </div>

              {/* Progress bar */}
              <div className="mb-4">
                <div 
                  ref={progressRef}
                  className="progress-track"
                  onClick={handleProgressClick}
                >
                  <div 
                    className="progress-fill"
                    style={{ width: `${progress}%` }}
                  >
                    <div className="progress-knob" />
                  </div>
                </div>
                <div className="flex justify-between mt-2">
                  <span 
                    className="text-[10px] text-white/30"
                    style={{ fontFamily: "'Space Mono', monospace" }}
                  >
                    {formatTime(currentTime)}
                  </span>
                  <span 
                    className="text-[10px] text-white/30"
                    style={{ fontFamily: "'Space Mono', monospace" }}
                  >
                    {formatTime(duration)}
                  </span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={toggleMute}
                  className="control-btn w-10 h-10"
                >
                  {isMuted ? (
                    <VolumeX className="w-4 h-4 text-white/60" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-white/60" />
                  )}
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={seekBackward}
                  className="control-btn w-10 h-10"
                >
                  <SkipBack className="w-4 h-4 text-white/70" />
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={togglePlay}
                  className="play-btn w-14 h-14 rounded-full"
                  disabled={!isReady}
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6 text-gray-900" strokeWidth={2.5} />
                  ) : (
                    <Play className="w-6 h-6 text-gray-900 ml-0.5" strokeWidth={2.5} />
                  )}
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={seekForward}
                  className="control-btn w-10 h-10"
                >
                  <SkipForward className="w-4 h-4 text-white/70" />
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={openInYouTube}
                  className="control-btn w-10 h-10"
                >
                  <ExternalLink className="w-4 h-4 text-white/60" />
                </motion.button>
              </div>
            </div>

            {/* Loading overlay */}
            <AnimatePresence>
              {!isReady && !hasError && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20 flex items-center justify-center"
                  style={{ background: 'rgba(15, 15, 20, 0.9)' }}
                >
                  <div className="relative">
                    <motion.div
                      className="w-12 h-12 rounded-full border-2 border-white/10 border-t-white/60"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white/40" />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error overlay */}
            <AnimatePresence>
              {hasError && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6"
                  style={{ background: 'rgba(15, 15, 20, 0.95)' }}
                >
                  <p className="text-white/60 text-sm text-center mb-4">{errorMessage}</p>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={openInYouTube}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all"
                    style={{
                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      boxShadow: '0 4px 20px rgba(239, 68, 68, 0.3)',
                    }}
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Open in YouTube</span>
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}

export default YouTubePlayerPremium;
