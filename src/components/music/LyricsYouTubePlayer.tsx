import React, { useEffect, useRef } from 'react';

interface LyricsYouTubePlayerProps {
  videoId: string;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onPlayerStateChange: (state: number) => void;
  onReady: (player: any) => void;
}

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

const LyricsYouTubePlayer: React.FC<LyricsYouTubePlayerProps> = React.memo(({
  videoId,
  onTimeUpdate,
  onDurationChange,
  onPlayerStateChange,
  onReady,
}) => {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<number | null>(null);

  // Use refs for callbacks to avoid re-binding issues if they change
  const callbacks = useRef({ onTimeUpdate, onDurationChange, onPlayerStateChange, onReady });
  useEffect(() => {
    callbacks.current = { onTimeUpdate, onDurationChange, onPlayerStateChange, onReady };
  });

  useEffect(() => {
    let isMounted = true;
    let playerEl: HTMLDivElement | null = null;

    const initPlayer = () => {
      if (!isMounted || !containerRef.current) return;
      
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          // Ignore errors during destroy
        }
      }

      // Create a fresh detached element for the iframe to replace.
      playerEl = document.createElement('div');
      containerRef.current.appendChild(playerEl);

      playerRef.current = new window.YT.Player(playerEl, {
        height: '0',
        width: '0',
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          showinfo: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: (event: any) => {
            if (!isMounted) return;
            callbacks.current.onReady(event.target);
            callbacks.current.onDurationChange(event.target.getDuration());
            
            // Explicitly play video to ensure autoplay triggers
            try {
              event.target.playVideo();
            } catch (e) {
              console.error("Autoplay attempt failed:", e);
            }
          },
          onStateChange: (event: any) => {
            if (!isMounted) return;
            callbacks.current.onPlayerStateChange(event.data);
            if (event.data === window.YT.PlayerState.PLAYING) {
              startTracking();
            } else {
              stopTracking();
            }
          },
        },
      });
    };

    if (!window.YT) {
      // Check if tag already exists to prevent duplicate script tags
      if (!document.getElementById('youtube-iframe-api-script')) {
        const tag = document.createElement('script');
        tag.id = 'youtube-iframe-api-script';
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

        window.onYouTubeIframeAPIReady = () => {
          initPlayer();
        };
      } else {
        // Script is loading, poll for ready status or check interval
        const checkYTReady = setInterval(() => {
          if (window.YT && window.YT.Player) {
            clearInterval(checkYTReady);
            initPlayer();
          }
        }, 100);
      }
    } else {
      initPlayer();
    }

    const startTracking = () => {
      if (intervalRef.current) return;
      intervalRef.current = window.setInterval(() => {
        if (playerRef.current && playerRef.current.getCurrentTime) {
          try {
            callbacks.current.onTimeUpdate(playerRef.current.getCurrentTime());
          } catch (e) {
            // Player might have been destroyed
          }
        }
      }, 50);
    };

    const stopTracking = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    return () => {
      isMounted = false;
      stopTracking();
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          // Ignore errors on destroy
        }
        playerRef.current = null;
      }
      if (playerEl && playerEl.parentNode) {
        playerEl.parentNode.removeChild(playerEl);
      }
    };
  }, [videoId]); // Only re-init when videoId changes

  return (
    <div 
      className="fixed -left-[9999px] -top-[9999px] pointer-events-none opacity-0"
      aria-hidden="true"
      ref={containerRef}
    />
  );
});

export default LyricsYouTubePlayer;
