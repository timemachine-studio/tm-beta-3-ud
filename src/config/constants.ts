// App Configuration
export const MAINTENANCE_MODE = import.meta.env.VITE_MAINTENANCE_MODE === 'true';
export const ACCESS_TOKEN_REQUIRED = import.meta.env.VITE_ACCESS_TOKEN_REQUIRED === 'true';
// The beta gate is a client-side string comparison and is therefore cosmetic —
// the token ships in the bundle by construction. No default: an unset env var
// must close the gate, not open it with a well-known literal.
export const BETA_ACCESS_TOKEN = import.meta.env.VITE_BETA_ACCESS_TOKEN || '';


// Rate Limits (for display purposes only - actual limits enforced server-side)
export const PERSONA_LIMITS = {
  default: parseInt(import.meta.env.VITE_DEFAULT_PERSONA_LIMIT) || 30,
  girlie: parseInt(import.meta.env.VITE_GIRLIE_PERSONA_LIMIT) || 25,
  pro: parseInt(import.meta.env.VITE_PRO_PERSONA_LIMIT) || 5
};

// Client-side AI Personas (for UI display only)
export const AI_PERSONAS = {
  default: {
    name: 'TimeMachine Air',
    initialMessage: "Hey there, from future",
    color: 'purple'
  },
  girlie: {
    name: 'TimeMachine Girlie',
    initialMessage: "Hiee✨ from future~",
    color: 'pink'
  },
  pro: {
    name: 'TimeMachine PRO',
    initialMessage: "From future. Let's cure cancer.",
    color: 'cyan'
  }
};

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

export const INITIAL_MESSAGE = {
  // Fixed id: the welcome bubble is UI furniture, not a real turn, so code
  // that filters it out of API context can recognise it (1.12).
  id: 'initial',
  content: AI_PERSONAS.default.initialMessage,
  isAI: true,
};

