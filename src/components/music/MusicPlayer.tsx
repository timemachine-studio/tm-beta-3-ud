import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, X, Star as Stage, Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { MusicToast } from './MusicToast';
import PlayIcon from '../icons/PlayIcon';
import { AI_PERSONAS } from '../../config/constants';

const PLAYLIST_CATEGORIES = {
  sad: {
    name: "Melancholic Moods",
    emotion: "sadness",
    songs: [
      {
        id: 1,
        title: "Half Lit Ember",
        artist: "TimeMachine Girlie",
        url: "https://res.cloudinary.com/dnjv18giv/video/upload/v1738769560/Half_Lit_Ember_CS_lj6t0j.mp3"
      },
      {
        id: 2,
        title: "I'm Wrong",
        artist: "TimeMachine",
        url: "https://res.cloudinary.com/dnjv18giv/video/upload/v1738820102/I_m_Wrong_CS_dufiet.mp3"
      },
      {
        id: 3,
        title: "Time & Love & Life",
        artist: "TimeMachine Girlie",
        url: "https://res.cloudinary.com/dnjv18giv/video/upload/v1738769560/Time_Love_Life_CS_dv3fig.mp3"
      }
    ]
  },
  happy: {
    name: "Uplifting Vibes",
    emotion: "joy",
    songs: [
      {
        id: 4,
        title: "Golden Vibes",
        artist: "TimeMachine",
        url: "https://res.cloudinary.com/dnjv18giv/video/upload/v1738769562/Golden_Vibes_CS_prijbj.mp3"
      },
      {
        id: 5,
        title: "Earth's Song",
        artist: "TimeMachine Girlie",
        url: "https://res.cloudinary.com/dnjv18giv/video/upload/v1738769563/Earth_s_Song_CS_lh2y0z.mp3"
      },
      {
        id: 6,
        title: "Moo Deng",
        artist: "TimeMachine",
        url: "https://res.cloudinary.com/dnjv18giv/video/upload/v1739169802/Moo_Deng_CS_or5eup.mp3"
      }
    ]
  },
  romantic: {
    name: "Love Frequencies",
    emotion: "love",
    songs: [
      {
        id: 7,
        title: "Looks Like You",
        artist: "TimeMachine",
        url: "https://res.cloudinary.com/dnjv18giv/video/upload/v1737610377/Looks%20like%20You.mp3"
      },
      {
        id: 8,
        title: "Freckle Kissed",
        artist: "TimeMachine",
        url: "https://res.cloudinary.com/dnjv18giv/video/upload/v1738820102/Freckle_Kissed_CS_nlquut.mp3"
      },
      {
        id: 9,
        title: "Crush Crush",
        artist: "TimeMachine Girlie",
        url: "https://res.cloudinary.com/dnjv18giv/video/upload/v1738820101/Crush_Crush_CS_gbn3ji.mp3"
      }
    ]
  },
  energetic: {
    name: "High Energy",
    emotion: "excitement",
    songs: [
      {
        id: 10,
        title: "No Go Judge Me",
        artist: "TimeMachine",
        url: "https://res.cloudinary.com/dnjv18giv/video/upload/v1738820102/No_Go_Judge_Me_CS_ljdy81.mp3"
      },
      {
        id: 11,
        title: "Vilvid Thunder",
        artist: "TimeMachine Girlie",
        url: "https://res.cloudinary.com/dnjv18giv/video/upload/v1738820100/Vilvid_Thunder_CS_oxvxbm.mp3"
      },
      {
        id: 12,
        title: "NeOn Lights",
        artist: "TimeMachine",
        url: "https://res.cloudinary.com/dnjv18giv/video/upload/v1739169802/NeOn_Lights_CS_waonrk.mp3"
      }
    ]
  },
  angry: {
    name: "Rage Release",
    emotion: "anger",
    songs: [
      {
        id: 13,
        title: "Traitor",
        artist: "TimeMachine Girlie",
        url: "https://res.cloudinary.com/dnjv18giv/video/upload/v1738820105/Traitor_CS_shsqeo.mp3"
      },
      {
        id: 14,
        title: "Static ain't the Vibe",
        artist: "TimeMachine Girlie",
        url: "https://res.cloudinary.com/dnjv18giv/video/upload/v1739169802/Static_ain_t_the_Vibe_CS_morq8e.mp3"
      },
      {
        id: 15,
        title: "Light Speed",
        artist: "TimeMachine Girlie",
        url: "https://res.cloudinary.com/dnjv18giv/video/upload/v1739169802/Light_Speed_CS_jneoxm.mp3"
      }
    ]
  },
  motivated: {
    name: "Motivation Matrix",
    emotion: "motivation",
    songs: [
      {
        id: 19,
        title: "Mama's Blue",
        artist: "TimeMachine",
        url: "https://res.cloudinary.com/dnjv18giv/video/upload/v1738769559/Mama_s_Blue_CS_crlmtn.mp3"
      },
      {
        id: 20,
        title: "Another City",
        artist: "TimeMachine",
        url: "https://res.cloudinary.com/dnjv18giv/video/upload/v1739169802/Another_City_CS_oc2ryq.mp3"
      },
      {
        id: 21,
        title: "New Year New Me",
        artist: "TimeMachine Girlie",
        url: "https://res.cloudinary.com/dnjv18giv/video/upload/v1739170402/New_Year_New_Me_CS_jmybtt.mp3"
      }
    ]
  },
  jealous: {
    name: "Envy Echoes",
    emotion: "jealousy",
    songs: [
      {
        id: 22,
        title: "Secrets",
        artist: "TimeMachine Girlie",
        url: "https://res.cloudinary.com/dnjv18giv/video/upload/v1738769562/Secrets_CS_ewsuvi.mp3"
      },
      {
        id: 23,
        title: "Traitor",
        artist: "TimeMachine Girlie",
        url: "https://res.cloudinary.com/dnjv18giv/video/upload/v1738820105/Traitor_CS_shsqeo.mp3"
      },
      {
        id: 24,
        title: "Static ain't the Vibe",
        artist: "TimeMachine Girlie",
        url: "https://res.cloudinary.com/dnjv18giv/video/upload/v1739169802/Static_ain_t_the_Vibe_CS_morq8e.mp3"
      }
    ]
  },
  relaxing: {
    name: "Zen Zone",
    emotion: "relaxation",
    songs: [
      {
        id: 25,
        title: "Digital Dreams",
        artist: "TimeMachine",
        url: "https://res.cloudinary.com/dnjv18giv/video/upload/v1737610377/Looks%20like%20You.mp3"
      },
      {
        id: 26,
        title: "Quantum Calm",
        artist: "TimeMachine X",
        url: "https://res.cloudinary.com/dnjv18giv/video/upload/v1737610589/Neon%20Dreams.mp3"
      },
      {
        id: 27,
        title: "Future Peace",
        artist: "TimeMachine Girlie",
        url: "https://res.cloudinary.com/dnjv18giv/video/upload/v1737610162/Half%20Lit%20Ember.mp3"
      }
    ]
  },
  anxious: {
    name: "Anxiety Antidote",
    emotion: "anxiety",
    songs: [
      {
        id: 28,
        title: "Calm Circuit",
        artist: "TimeMachine X",
        url: "https://res.cloudinary.com/dnjv18giv/video/upload/v1737610589/Neon%20Dreams.mp3"
      },
      {
        id: 29,
        title: "Digital Breath",
        artist: "TimeMachine",
        url: "https://res.cloudinary.com/dnjv18giv/video/upload/v1737609955/Breathe%20Right%20Strip.mp3"
      },
      {
        id: 30,
        title: "Quantum Relief",
        artist: "TimeMachine Girlie",
        url: "https://res.cloudinary.com/dnjv18giv/video/upload/v1737610162/Half%20Lit%20Ember.mp3"
      }
    ]
  },
  hopeful: {
    name: "Hope Horizons",
    emotion: "hope",
    songs: [
      {
        id: 31,
        title: "Future Faith",
        artist: "TimeMachine",
        url: "https://res.cloudinary.com/dnjv18giv/video/upload/v1737610377/Looks%20like%20You.mp3"
      },
      {
        id: 32,
        title: "Digital Dawn",
        artist: "TimeMachine X",
        url: "https://res.cloudinary.com/dnjv18giv/video/upload/v1737610702/Digital%20Sunset.mp3"
      },
      {
        id: 33,
        title: "Quantum Promise",
        artist: "TimeMachine & TimeMachine Girlie",
        url: "https://res.cloudinary.com/dnjv18giv/video/upload/v1737609955/Breathe%20Right%20Strip.mp3"
      }
    ]
  }
};

interface MusicPlayerProps {
  currentPersona?: keyof typeof AI_PERSONAS;
  currentEmotion?: string;
  isCenterStage?: boolean;
}

export function MusicPlayer({ currentPersona = 'default', currentEmotion = 'joy', isCenterStage = false }: MusicPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [currentSong, setCurrentSong] = useState<(typeof PLAYLIST_CATEGORIES)['sad']['songs'][0] | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<keyof typeof PLAYLIST_CATEGORIES>('happy');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const minimizeTimeoutRef = useRef<NodeJS.Timeout>();
  const categoryContainerRef = useRef<HTMLDivElement>(null);
  const lastEmotionRef = useRef<string>('hope');
  const emotionChangedRef = useRef(false);

  const personaColors = {
    default: 'from-purple-600/10 to-blue-600/10',
    girlie: 'from-pink-500/10 to-rose-400/10',
    pro: 'from-cyan-600/10 to-blue-600/10'
  };

  const getPlaylistCategory = (emotion: string): keyof typeof PLAYLIST_CATEGORIES => {
    const emotionMap: Record<string, keyof typeof PLAYLIST_CATEGORIES> = {
      sadness: 'sad',
      joy: 'happy',
      love: 'romantic',
      excitement: 'energetic',
      anger: 'angry',
      motivation: 'motivated',
      jealousy: 'jealous',
      relaxation: 'relaxing',
      anxiety: 'anxious',
      hope: 'hopeful'
    };

    return emotionMap[emotion.toLowerCase()] || 'happy';
  };

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = 'auto';
    }

    const handleEnded = () => {
      if (isCenterStage) {
        handleNextTrack();
      }
    };

    audioRef.current.addEventListener('ended', handleEnded);

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('ended', handleEnded);
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [isCenterStage]);

  useEffect(() => {
    if (isCenterStage && currentEmotion && currentEmotion !== lastEmotionRef.current) {
      emotionChangedRef.current = true;
      const category = getPlaylistCategory(currentEmotion);
      
      if (category && PLAYLIST_CATEGORIES[category]) {
        setSelectedCategory(category);
        const songs = PLAYLIST_CATEGORIES[category].songs;
        
        if (songs && songs.length > 0) {
          const randomIndex = Math.floor(Math.random() * songs.length);
          const selectedSong = songs[randomIndex];
          
          handleSongSelect(selectedSong);
          setIsPlaying(true);
          setShowToast(true);
          setIsMinimized(false);
        }
      }
      
      lastEmotionRef.current = currentEmotion;
    } else if (!isCenterStage) {
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }
  }, [currentEmotion, isCenterStage]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;

    const handleError = (e: ErrorEvent) => {
      console.error('Audio playback error:', e);
      setIsPlaying(false);
    };

    if (!audio.src.includes(currentSong.url)) {
      audio.src = currentSong.url;
      audio.load();
    }

    if (isPlaying) {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error('Playback failed:', error);
          setIsPlaying(false);
        });
      }
    } else {
      audio.pause();
    }

    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('error', handleError);
    };
  }, [currentSong, isPlaying]);

  useEffect(() => {
    if (isPlaying && showToast) {
      if (minimizeTimeoutRef.current) {
        clearTimeout(minimizeTimeoutRef.current);
      }
      minimizeTimeoutRef.current = setTimeout(() => {
        setShowToast(false);
        setIsMinimized(true);
      }, 3000);
    }

    return () => {
      if (minimizeTimeoutRef.current) {
        clearTimeout(minimizeTimeoutRef.current);
      }
    };
  }, [isPlaying, showToast]);

  const handleClick = () => {
    if (!currentSong) {
      setShowPlaylist(true);
    } else if (isMinimized) {
      setShowPlaylist(true);
      setShowToast(false);
      setIsMinimized(false);
    }
  };

  const handleSongSelect = (song: typeof currentSong) => {
    if (!song) return;
    
    if (currentSong?.id === song.id) {
      setShowPlaylist(false);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    setCurrentSong(song);
    setIsPlaying(true);
    setShowPlaylist(false);
    setShowToast(true);
    setIsMinimized(false);
  };

  const getCurrentCategory = () => {
    if (!currentSong) return null;
    return Object.entries(PLAYLIST_CATEGORIES).find(([_, category]) =>
      category.songs.some(song => song.id === currentSong.id)
    );
  };

  const handlePrevTrack = () => {
    if (!currentSong) return;
    
    const currentCategory = getCurrentCategory();
    if (!currentCategory) return;

    const songs = currentCategory[1].songs;
    const currentIndex = songs.findIndex(song => song.id === currentSong.id);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : songs.length - 1;
    handleSongSelect(songs[prevIndex]);
  };

  const handleNextTrack = () => {
    if (!currentSong) return;
    
    const currentCategory = getCurrentCategory();
    if (!currentCategory) return;

    const songs = currentCategory[1].songs;
    const currentIndex = songs.findIndex(song => song.id === currentSong.id);
    const nextIndex = currentIndex < songs.length - 1 ? currentIndex + 1 : 0;
    handleSongSelect(songs[nextIndex]);
  };

  const handleCategoryChange = (category: keyof typeof PLAYLIST_CATEGORIES) => {
    setSelectedCategory(category);
  };

  const scrollCategory = (direction: 'left' | 'right') => {
    if (categoryContainerRef.current) {
      const scrollAmount = 200;
      const newScrollLeft = direction === 'left' 
        ? categoryContainerRef.current.scrollLeft - scrollAmount
        : categoryContainerRef.current.scrollLeft + scrollAmount;
      
      categoryContainerRef.current.scrollTo({
        left: newScrollLeft,
        behavior: 'smooth'
      });
    }
  };

  const MusicVisualizer = () => {
    const barGlowColors = {
      default: 'rgba(255, 255, 255, 0.5)',
      girlie: 'rgba(255, 105, 180, 0.7)',
      pro: 'rgba(255, 255, 255, 0.5)'
    };

    return (
      <div className="flex items-center justify-center gap-[3px] h-5 px-1">
        {[...Array(4)].map((_, i) => (
          <motion.div
            key={i}
            className={`w-[3px] bg-gradient-to-t from-white/40 to-white rounded-full
              ${currentPersona === 'girlie' ? 'from-pink-300/40 to-white' : ''}`}
            animate={{
              height: [
                '8px',
                i % 2 === 0 ? '16px' : '12px',
                '8px'
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

  return (
    <>
      <div className="fixed bottom-24 left-4 z-50 flex items-center gap-2">
        <motion.div className="relative">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleClick}
            className={`p-3 rounded-full
              bg-white/5 backdrop-blur-xl
              border border-white/5
              transition-all duration-300
              relative group
              overflow-hidden`}
          >
            {isPlaying && isMinimized ? (
              <MusicVisualizer />
            ) : (
              <PlayIcon className="w-5 h-5 relative z-10" />
            )}
          </motion.button>
        </motion.div>

        <AnimatePresence>
          {showPlaylist && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-full left-0 mb-4 w-80
                bg-black/40 backdrop-blur-xl rounded-lg
                border border-white/5 shadow-2xl
                max-h-[70vh] overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-white font-semibold">Music Library</h3>
                <button
                  onClick={() => setShowPlaylist(false)}
                  className="text-white/60 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="relative overflow-hidden border-b border-white/5">
                <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-black/40 to-transparent z-10" />
                <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-black/40 to-transparent z-10" />
                
                <div 
                  ref={categoryContainerRef}
                  className="overflow-x-auto hide-scrollbar px-4 flex items-center"
                >
                  <div className="flex min-w-max">
                    {Object.entries(PLAYLIST_CATEGORIES).map(([key, category]) => (
                      <button
                        key={key}
                        onClick={() => handleCategoryChange(key as keyof typeof PLAYLIST_CATEGORIES)}
                        className={`px-4 py-2.5 whitespace-nowrap text-sm transition-all
                          ${selectedCategory === key 
                            ? 'text-white border-b-2 border-white/20 bg-white/5' 
                            : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                      >
                        {category.name}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => scrollCategory('left')}
                  className="absolute left-0 top-0 bottom-0 px-2 text-white/60 hover:text-white hover:bg-black/30 transition-colors z-20"
                >
                  ‹
                </button>
                <button
                  onClick={() => scrollCategory('right')}
                  className="absolute right-0 top-0 bottom-0 px-2 text-white/60 hover:text-white hover:bg-black/30 transition-colors z-20"
                >
                  ›
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-4 space-y-2">
                  {PLAYLIST_CATEGORIES[selectedCategory].songs.map(song => (
                    <button
                      key={song.id}
                      onClick={() => handleSongSelect(song)}
                      className={`w-full p-3 rounded-lg transition-all
                        ${currentSong?.id === song.id 
                          ? 'bg-white/10 border border-white/10' 
                          : 'hover:bg-white/5'}
                        text-left group`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full 
                          bg-white/5
                          flex items-center justify-center
                          ${currentSong?.id === song.id ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}
                          transition-opacity`}
                        >
                          <PlayIcon className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <div className="text-sm text-white font-medium">{song.title}</div>
                          <div className="text-xs text-white/60">{song.artist}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Currently Playing Section */}
              {currentSong && (
                <div className="p-4 border-t border-white/5 bg-white/5">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">
                        {currentSong.title}
                      </div>
                      <div className="text-xs text-white/60 truncate">
                        {currentSong.artist}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={handlePrevTrack}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                      >
                        <SkipBack className="w-4 h-4 text-white" />
                      </motion.button>
                      
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                      >
                        {isPlaying ? (
                          <Pause className="w-4 h-4 text-white" />
                        ) : (
                          <Play className="w-4 h-4 text-white" />
                        )}
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={handleNextTrack}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                      >
                        <SkipForward className="w-4 h-4 text-white" />
                      </motion.button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showToast && currentSong && (
          <MusicToast
            song={currentSong}
            isPlaying={isPlaying}
            onClose={() => {
              setShowToast(false);
              setIsMinimized(true);
            }}
            onPlayPause={() => {
              setIsPlaying(!isPlaying);
              if (!isPlaying) {
                setShowToast(true);
                setIsMinimized(false);
              }
            }}
            onPrevTrack={handlePrevTrack}
            onNextTrack={handleNextTrack}
            onOpenLibrary={() => setShowPlaylist(true)}
            currentPersona={currentPersona}
            isCenterStage={isCenterStage}
          />
        )}
      </AnimatePresence>
    </>
  );
}
