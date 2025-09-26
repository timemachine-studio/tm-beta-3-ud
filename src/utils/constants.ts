// Animation constants
export const ANIMATION_CONFIG = {
  WORD_STAGGER: 0.12,
  WORD_DELAY: 0.04,
  SPRING_DAMPING: 12,
  SPRING_STIFFNESS: 100,
  FADE_DURATION: 0.6
} as const;

// Loading animation words with enhanced colors
export const LOADING_WORDS = [
  { text: 'Time', color: 'text-yellow-400' },
  { text: 'Future', color: 'text-purple-400' },
  { text: 'Magic', color: 'text-green-400' },
  { text: 'AGI', color: 'text-cyan-400' }
] as const;
