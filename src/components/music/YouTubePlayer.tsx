import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, X, SkipBack, SkipForward, Volume2, VolumeX, Music2 } from 'lucide-react';
import { YouTubeMusicData } from '../../services/ai/aiProxyService';

// Extend Window interface for YouTube IFrame API
declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: () => void;
  }
}

export type { YouTubeMusicData };

interface YouTubePlayerProps {
  musicData: YouTubeMusicData | null;
  onClose: () => void;
  currentPersona?: 'default' | 'girlie' | 'pro';
}

let playerInstance: YT.Player | null = null;
let apiReady = false;
let apiLoadCallbacks: (() => void)[] = [];

// Load YouTube IFrame API
function loadYouTubeAPI(): Promise<void> {
  return new Promise((resolve) => {
    if (apiReady) {
      resolve();
      return;
    }

    if (window.YT && window.YT.Player) {
      apiReady = true;
      resolve();
      return;
    }

    apiLoadCallbacks.push(resolve);

    // Only load the script once
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

export function YouTubePlayer({ musicData, onClose, currentPersona = 'default' }: YouTubePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastVideoIdRef = useRef<string | null>(null);

  const personaColors = {
    default: {
      primary: 'from-purple-600/20 to-blue-600/20',
      border: 'border-purple-500/30',
      glow: 'rgba(139, 92, 246, 0.3)',
      accent: 'text-purple-400'
    },
    girlie: {
      primary: 'from-pink-500/20 to-rose-400/20',
      border: 'border-pink-500/30',
      glow: 'rgba(236, 72, 153, 0.3)',
      accent: 'text-pink-400'
    },
    pro: {
      primary: 'from-cyan-600/20 to-blue-600/20',
      border: 'border-cyan-500/30',
      glow: 'rgba(6, 182, 212, 0.3)',
      accent: 'text-cyan-400'
    }
  };

  const colors = personaColors[currentPersona];

  // Initialize player when musicData changes
  useEffect(() => {
    if (!musicData) return;

    // Skip if same video is already playing
    if (lastVideoIdRef.current === musicData.videoId && playerInstance && isPlaying) {
      return;
    }

    const initPlayer = async () => {
      await loadYouTubeAPI();

      // Destroy existing player if any
      if (playerInstance) {
        try {
          playerInstance.destroy();
        } catch (e) {
          // Ignore errors during cleanup
        }
        playerInstance = null;
      }

      // Reset states
      setIsReady(false);
      setAutoplayBlocked(false);
      lastVideoIdRef.current = musicData.videoId;

      // Create a new player
      const playerElement = document.getElementById('yt-player-hidden');
      if (!playerElement) return;

      playerInstance = new window.YT.Player('yt-player-hidden', {
        height: '0',
        width: '0',
        videoId: musicData.videoId,
        playerVars: {
          autoplay: 1,
          playsinline: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: (event) => {
            setIsReady(true);
            setDuration(event.target.getDuration());

            // Try to play with sound first
            const playPromise = event.target.playVideo();

            // Check if play was successful after a short delay
            setTimeout(() => {
              try {
                const state = event.target.getPlayerState();
                if (state === window.YT.PlayerState.PLAYING) {
                  setIsPlaying(true);
                  setAutoplayBlocked(false);
                } else if (state === window.YT.PlayerState.UNSTARTED || state === window.YT.PlayerState.PAUSED) {
                  // Autoplay was blocked - try muted playback
                  console.log('Autoplay blocked, trying muted playback');
                  event.target.mute();
                  event.target.playVideo();
                  setIsMuted(true);
                  setAutoplayBlocked(true);

                  // Check again if muted playback works
                  setTimeout(() => {
                    const muteState = event.target.getPlayerState();
                    if (muteState === window.YT.PlayerState.PLAYING) {
                      setIsPlaying(true);
                    }
                  }, 500);
                }
              } catch (e) {
                console.error('Error checking playback state:', e);
              }
            }, 1000);
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              setIsPlaying(false);
            } else if (event.data === window.YT.PlayerState.ENDED) {
              setIsPlaying(false);
              setCurrentTime(0);
            }
          },
          onError: (event) => {
            console.error('YouTube player error:', event.data);
          }
        }
      });
    };

    initPlayer();

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [musicData?.videoId, musicData]);

  // Update progress bar
  useEffect(() => {
    if (isPlaying && playerInstance) {
      progressIntervalRef.current = setInterval(() => {
        try {
          const time = playerInstance?.getCurrentTime() || 0;
          setCurrentTime(time);
        } catch (e) {
          // Player might not be ready
        }
      }, 1000);
    } else {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isPlaying]);

  const togglePlay = useCallback(() => {
    if (!playerInstance) return;

    try {
      if (isPlaying) {
        playerInstance.pauseVideo();
      } else {
        playerInstance.playVideo();
      }
    } catch (e) {
      console.error('Error toggling play:', e);
    }
  }, [isPlaying]);

  const toggleMute = useCallback(() => {
    if (!playerInstance) return;

    try {
      if (isMuted) {
        playerInstance.unMute();
        setIsMuted(false);
        setAutoplayBlocked(false); // User interacted, so autoplay is no longer an issue
      } else {
        playerInstance.mute();
        setIsMuted(true);
      }
    } catch (e) {
      console.error('Error toggling mute:', e);
    }
  }, [isMuted]);

  const seekBackward = useCallback(() => {
    if (!playerInstance) return;
    try {
      const time = playerInstance.getCurrentTime();
      playerInstance.seekTo(Math.max(0, time - 10), true);
    } catch (e) {
      console.error('Error seeking:', e);
    }
  }, []);

  const seekForward = useCallback(() => {
    if (!playerInstance) return;
    try {
      const time = playerInstance.getCurrentTime();
      const dur = playerInstance.getDuration();
      playerInstance.seekTo(Math.min(dur, time + 10), true);
    } catch (e) {
      console.error('Error seeking:', e);
    }
  }, []);

  const handleClose = useCallback(() => {
    if (playerInstance) {
      try {
        playerInstance.stopVideo();
        playerInstance.destroy();
      } catch (e) {
        // Ignore errors during cleanup
      }
      playerInstance = null;
    }
    setIsReady(false);
    setIsPlaying(false);
    onClose();
  }, [onClose]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!musicData) return null;

  return (
    <>
      {/* Hidden YouTube Player Element */}
      <div id="yt-player-hidden" style={{ position: 'absolute', top: '-9999px', left: '-9999px' }} />

      {/* Visible Player UI */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="fixed bottom-24 left-4 right-4 sm:left-auto sm:right-4 sm:w-auto z-50"
        >
          <div
            className="p-4 w-full sm:w-72 md:w-80 rounded-2xl"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
            }}
          >
            {/* Header */}
            <div className="flex items-start gap-3 mb-3">
              {/* Thumbnail or Music Icon */}
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden bg-white/10 flex items-center justify-center flex-shrink-0">
                {musicData.thumbnail ? (
                  <img
                    src={musicData.thumbnail}
                    alt={musicData.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Music2 className={`w-6 h-6 ${colors.accent}`} />
                )}
              </div>

              {/* Song Info */}
              <div className="flex-1 min-w-0">
                <h4 className="text-white font-medium text-xs sm:text-sm truncate" title={musicData.title}>
                  {musicData.title}
                </h4>
                <p className="text-white/60 text-xs truncate" title={musicData.artist}>
                  {musicData.artist}
                </p>
                <p className={`text-xs ${colors.accent} mt-0.5 sm:mt-1 hidden sm:block`}>
                  YouTube Music
                </p>
              </div>

              {/* Close Button */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleClose}
                className="p-1.5 rounded-full"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                }}
              >
                <X className="w-4 h-4 text-white/70 hover:text-white" />
              </motion.button>
            </div>

            {/* Progress Bar */}
            <div className="mb-3">
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full bg-gradient-to-r ${colors.primary.replace('/20', '')}`}
                  style={{ width: `${progress}%` }}
                  initial={false}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <div className="flex justify-between text-xs text-white/50 mt-1">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Autoplay blocked indicator */}
            {autoplayBlocked && (
              <motion.button
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={toggleMute}
                className="w-full mb-2 py-2 px-3 rounded-xl flex items-center justify-center gap-2"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                }}
              >
                <VolumeX className={`w-4 h-4 ${colors.accent}`} />
                <span className="text-white text-xs sm:text-sm font-medium">Tap to unmute</span>
              </motion.button>
            )}

            {/* Controls */}
            <div className="flex items-center justify-center gap-1 sm:gap-2">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={toggleMute}
                className={`p-2 rounded-full ${autoplayBlocked ? 'animate-pulse' : ''}`}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                }}
              >
                {isMuted ? (
                  <VolumeX className={`w-4 h-4 ${autoplayBlocked ? colors.accent : 'text-white/70'}`} />
                ) : (
                  <Volume2 className="w-4 h-4 text-white/70" />
                )}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={seekBackward}
                className="p-2 rounded-full"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                }}
              >
                <SkipBack className="w-4 h-4 text-white" />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={togglePlay}
                className="p-2.5 sm:p-3 rounded-full"
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                }}
                disabled={!isReady}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 text-white" />
                ) : (
                  <Play className="w-5 h-5 text-white" />
                )}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={seekForward}
                className="p-2 rounded-full"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                }}
              >
                <SkipForward className="w-4 h-4 text-white" />
              </motion.button>

              <div className="w-6 sm:w-8" /> {/* Spacer for balance */}
            </div>

            {/* Loading indicator */}
            {!isReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
