import { Theme } from '../types/theme';

/**
 * Seasons are a dark-mode feature. Each is the black canvas with one hue
 * rising from the bottom, and the persona picks one by default (Air →
 * autumn, Girlie → spring, PRO → summer). Light mode has a single variant
 * — see themes/light.ts — so there are no light seasons here.
 */
export const seasonThemes = {
  springDark: {
    name: 'Spring Night',
    background: 'bg-linear-to-t/srgb from-pink-950 to-black to-50%',
    text: 'text-gray-200',
    border: 'border-gray-800/50',
    input: {
      background: 'bg-gray-900/70 backdrop-blur-3xl',
      text: 'text-gray-200',
      placeholder: 'placeholder-gray-400',
      border: 'border-transparent'
    },
    button: {
      primary: 'bg-linear-to-r/srgb from-pink-950 to-pink-900 hover:from-pink-900 hover:to-pink-800 text-white rounded-lg shadow-xs',
      secondary: 'bg-gray-900/80 hover:bg-gray-800/80 backdrop-blur-3xl text-gray-200 rounded-lg'
    },
    modal: {
      background: 'bg-gray-900/75 backdrop-blur-3xl shadow-lg',
      overlay: 'bg-black/20 backdrop-blur-md'
    },
    dropdown: {
      background: 'bg-gray-900/75 backdrop-blur-3xl shadow-xs',
      hover: 'hover:bg-pink-950/50'
    },
    card: {
      background: 'bg-gray-900/70 backdrop-blur-3xl shadow-xs',
      border: 'border-gray-800/30'
    },
    glow: {
      primary: 'shadow-[0_4px_16px_rgba(236,72,153,0.15)]',
      secondary: 'shadow-[0_4px_16px_rgba(0,0,0,0.1)]'
    }
  },
  summerDark: {
    name: 'Summer Forest',
    background: 'bg-linear-to-t/srgb from-cyan-950 to-black to-50%',
    text: 'text-gray-200',
    border: 'border-gray-800/50',
    input: {
      background: 'bg-gray-900/70 backdrop-blur-3xl',
      text: 'text-gray-200',
      placeholder: 'placeholder-gray-400',
      border: 'border-transparent'
    },
    button: {
      primary: 'bg-linear-to-r/srgb from-cyan-950 to-cyan-900 hover:from-cyan-900 hover:to-cyan-800 text-white rounded-lg shadow-xs',
      secondary: 'bg-gray-900/80 hover:bg-gray-800/80 backdrop-blur-3xl text-gray-200 rounded-lg'
    },
    modal: {
      background: 'bg-gray-900/75 backdrop-blur-3xl shadow-lg',
      overlay: 'bg-black/20 backdrop-blur-md'
    },
    dropdown: {
      background: 'bg-gray-900/75 backdrop-blur-3xl shadow-xs',
      hover: 'hover:bg-cyan-950/50'
    },
    card: {
      background: 'bg-gray-900/70 backdrop-blur-3xl shadow-xs',
      border: 'border-gray-800/30'
    },
    glow: {
      primary: 'shadow-[0_4px_16px_rgba(6,182,212,0.15)]',
      secondary: 'shadow-[0_4px_16px_rgba(0,0,0,0.1)]'
    }
  },
  autumnDark: {
    name: 'Autumn Ember',
    background: 'bg-linear-to-t/srgb from-purple-950 to-black to-50%',
    text: 'text-gray-200',
    border: 'border-gray-800/50',
    input: {
      background: 'bg-gray-900/80 backdrop-blur-3xl',
      text: 'text-gray-200',
      placeholder: 'placeholder-gray-400',
      border: 'border-transparent'
    },
    button: {
      primary: 'bg-linear-to-r/srgb from-purple-950 to-purple-800 hover:from-purple-800 hover:to-purple-700 text-white rounded-lg shadow-xs',
      secondary: 'bg-gray-900/80 hover:bg-gray-800/80 backdrop-blur-3xl text-gray-200 rounded-lg'
    },
    modal: {
      background: 'bg-gray-900/80 backdrop-blur-3xl shadow-lg',
      overlay: 'bg-black/20 backdrop-blur-md'
    },
    dropdown: {
      background: 'bg-gray-900/80 backdrop-blur-3xl shadow-xs',
      hover: 'hover:bg-purple-950/50'
    },
    card: {
      background: 'bg-gray-900/80 backdrop-blur-3xl shadow-xs',
      border: 'border-gray-800/30'
    },
    glow: {
      primary: 'shadow-[0_4px_16px_rgba(147,51,234,0.15)]',
      secondary: 'shadow-[0_4px_16px_rgba(0,0,0,0.1)]'
    }
  },
  winterDark: {
    name: 'Winter Midnight',
    background: 'bg-linear-to-t/srgb from-blue-950 to-black to-50%',
    text: 'text-gray-200',
    border: 'border-gray-800/50',
    input: {
      background: 'bg-gray-900/70 backdrop-blur-3xl',
      text: 'text-gray-200',
      placeholder: 'placeholder-gray-400',
      border: 'border-transparent'
    },
    button: {
      primary: 'bg-linear-to-r/srgb from-blue-950 to-blue-900 hover:from-blue-900 hover:to-blue-800 text-white rounded-lg shadow-xs',
      secondary: 'bg-gray-900/80 hover:bg-gray-800/80 backdrop-blur-3xl text-gray-200 rounded-lg'
    },
    modal: {
      background: 'bg-gray-900/75 backdrop-blur-3xl shadow-lg',
      overlay: 'bg-black/20 backdrop-blur-md'
    },
    dropdown: {
      background: 'bg-gray-900/75 backdrop-blur-3xl shadow-xs',
      hover: 'hover:bg-blue-950/50'
    },
    card: {
      background: 'bg-gray-900/70 backdrop-blur-3xl shadow-xs',
      border: 'border-gray-800/30'
    },
    glow: {
      primary: 'shadow-[0_4px_16px_rgba(59,130,246,0.15)]',
      secondary: 'shadow-[0_4px_16px_rgba(0,0,0,0.1)]'
    }
  },
  /* No hue at all: the black canvas with nothing rising from the bottom.
     Everything else is Autumn Ember's, so the chrome is unchanged. */
  pureDark: {
    name: 'Pure Black',
    background: 'bg-black',
    text: 'text-gray-200',
    border: 'border-gray-800/50',
    input: {
      background: 'bg-gray-900/80 backdrop-blur-3xl',
      text: 'text-gray-200',
      placeholder: 'placeholder-gray-400',
      border: 'border-transparent'
    },
    button: {
      primary: 'bg-purple-900 hover:bg-purple-800 text-white rounded-lg shadow-xs',
      secondary: 'bg-gray-900/80 hover:bg-gray-800/80 backdrop-blur-3xl text-gray-200 rounded-lg'
    },
    modal: {
      background: 'bg-gray-900/80 backdrop-blur-3xl shadow-lg',
      overlay: 'bg-black/20 backdrop-blur-md'
    },
    dropdown: {
      background: 'bg-gray-900/80 backdrop-blur-3xl shadow-xs',
      hover: 'hover:bg-white/5'
    },
    card: {
      background: 'bg-gray-900/80 backdrop-blur-3xl shadow-xs',
      border: 'border-gray-800/30'
    },
    glow: {
      primary: 'shadow-[0_4px_16px_rgba(0,0,0,0.3)]',
      secondary: 'shadow-[0_4px_16px_rgba(0,0,0,0.1)]'
    }
  }
} as const satisfies Record<string, Theme>;
