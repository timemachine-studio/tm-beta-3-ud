// YouTube IFrame API Type Declarations
declare namespace YT {
  interface Player {
    loadVideoById(videoId: string, startSeconds?: number): void;
    cueVideoById(videoId: string, startSeconds?: number): void;
    playVideo(): void;
    pauseVideo(): void;
    stopVideo(): void;
    seekTo(seconds: number, allowSeekAhead?: boolean): void;
    mute(): void;
    unMute(): void;
    isMuted(): boolean;
    setVolume(volume: number): void;
    getVolume(): number;
    getCurrentTime(): number;
    getDuration(): number;
    getPlayerState(): number;
    destroy(): void;
    getVideoUrl(): string;
  }

  interface PlayerOptions {
    height?: string | number;
    width?: string | number;
    videoId?: string;
    playerVars?: {
      autoplay?: 0 | 1;
      cc_lang_pref?: string;
      cc_load_policy?: 0 | 1;
      color?: 'red' | 'white';
      controls?: 0 | 1 | 2;
      disablekb?: 0 | 1;
      enablejsapi?: 0 | 1;
      end?: number;
      fs?: 0 | 1;
      hl?: string;
      iv_load_policy?: 1 | 3;
      list?: string;
      listType?: 'playlist' | 'search' | 'user_uploads';
      loop?: 0 | 1;
      modestbranding?: 0 | 1;
      origin?: string;
      playlist?: string;
      playsinline?: 0 | 1;
      rel?: 0 | 1;
      start?: number;
      widget_referrer?: string;
    };
    events?: {
      onReady?: (event: PlayerEvent) => void;
      onStateChange?: (event: OnStateChangeEvent) => void;
      onError?: (event: OnErrorEvent) => void;
      onPlaybackQualityChange?: (event: PlayerEvent) => void;
      onPlaybackRateChange?: (event: PlayerEvent) => void;
      onApiChange?: (event: PlayerEvent) => void;
    };
  }

  interface PlayerEvent {
    target: Player;
    data?: number;
  }

  interface OnStateChangeEvent {
    target: Player;
    data: number;
  }

  interface OnErrorEvent {
    target: Player;
    data: number;
  }

  const PlayerState: {
    UNSTARTED: -1;
    ENDED: 0;
    PLAYING: 1;
    PAUSED: 2;
    BUFFERING: 3;
    CUED: 5;
  };

  class Player {
    constructor(elementId: string | HTMLElement, options: PlayerOptions);
  }
}
