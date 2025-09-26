import { Theme } from '../types/theme';

export const seasonThemes: Record<string, Theme> = {
  spring: {
    name: 'Spring Bloom',
    background: 'bg-gradient-to-br from-pink-100 to-rose-200',
    text: 'text-black',
    border: 'border-rose-200/50',
    input: {
      background: 'bg-white/70 backdrop-blur-md',
      text: 'text-black',
      placeholder: 'placeholder-gray-600',
      border: 'border-transparent'
    },
    button: {
      primary: 'bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm',
      secondary: 'bg-white/80 hover:bg-white/90 backdrop-blur-md text-black rounded-lg'
    },
    modal: {
      background: 'bg-white/80 backdrop-blur-lg shadow-lg',
      overlay: 'bg-black/20 backdrop-blur-sm'
    },
    dropdown: {
      background: 'bg-white/80 backdrop-blur-md shadow-sm',
      hover: 'hover:bg-rose-100/50'
    },
    card: {
      background: 'bg-white/70 backdrop-blur-md shadow-sm',
      border: 'border-rose-200/30'
    },
    glow: {
      primary: 'shadow-[0_4px_12px_rgba(244,63,94,0.2)]',
      secondary: 'shadow-[0_4px_12px_rgba(0,0,0,0.05)]'
    }
  },
  summer: {
    name: 'Summer Peach',
    background: 'bg-gradient-to-br from-orange-100 to-yellow-100',
    text: 'text-black',
    border: 'border-orange-200/50',
    input: {
      background: 'bg-white/85 backdrop-blur-lg',
      text: 'text-black',
      placeholder: 'placeholder-gray-600',
      border: 'border-transparent'
    },
    button: {
      primary: 'bg-orange-500 hover:bg-orange-600 text-white rounded-lg shadow-sm',
      secondary: 'bg-white/80 hover:bg-white/90 backdrop-blur-lg text-black rounded-lg'
    },
    modal: {
      background: 'bg-white/85 backdrop-blur-lg shadow-lg',
      overlay: 'bg-black/20 backdrop-blur-sm'
    },
    dropdown: {
      background: 'bg-white/85 backdrop-blur-lg shadow-sm',
      hover: 'hover:bg-orange-100/50'
    },
    card: {
      background: 'bg-white/85 backdrop-blur-lg shadow-sm',
      border: 'border-orange-200/30'
    },
    glow: {
      primary: 'shadow-[0_4px_16px_rgba(255,165,0,0.2)]',
      secondary: 'shadow-[0_4px_16px_rgba(0,0,0,0.05)]'
    }
  },
  autumn: {
    name: 'Autumn Harvest',
    background: 'bg-gradient-to-br from-purple-200 to-indigo-300',
    text: 'text-black',
    border: 'border-purple-200/50',
    input: {
      background: 'bg-white/85 backdrop-blur-lg',
      text: 'text-black',
      placeholder: 'placeholder-gray-600',
      border: 'border-transparent'
    },
    button: {
      primary: 'bg-purple-500 hover:bg-purple-600 text-white rounded-lg shadow-sm',
      secondary: 'bg-white/80 hover:bg-white/90 backdrop-blur-lg text-black rounded-lg'
    },
    modal: {
      background: 'bg-white/85 backdrop-blur-lg shadow-lg',
      overlay: 'bg-black/20 backdrop-blur-sm'
    },
    dropdown: {
      background: 'bg-white/85 backdrop-blur-lg shadow-sm',
      hover: 'hover:bg-purple-200/50'
    },
    card: {
      background: 'bg-white/85 backdrop-blur-lg shadow-sm',
      border: 'border-purple-200/30'
    },
    glow: {
      primary: 'shadow-[0_4px_16px_rgba(147,51,234,0.2)]',
      secondary: 'shadow-[0_4px_16px_rgba(0,0,0,0.05)]'
    }
  },
  winter: {
    name: 'Winter Sky',
    background: 'bg-gradient-to-br from-blue-100 to-cyan-200',
    text: 'text-black',
    border: 'border-cyan-200/50',
    input: {
      background: 'bg-white/70 backdrop-blur-md',
      text: 'text-black',
      placeholder: 'placeholder-gray-600',
      border: 'border-transparent'
    },
    button: {
      primary: 'bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg shadow-sm',
      secondary: 'bg-white/80 hover:bg-white/90 backdrop-blur-md text-black rounded-lg'
    },
    modal: {
      background: 'bg-white/80 backdrop-blur-lg shadow-lg',
      overlay: 'bg-black/20 backdrop-blur-sm'
    },
    dropdown: {
      background: 'bg-white/80 backdrop-blur-md shadow-sm',
      hover: 'hover:bg-cyan-100/50'
    },
    card: {
      background: 'bg-white/70 backdrop-blur-md shadow-sm',
      border: 'border-cyan-200/30'
    },
    glow: {
      primary: 'shadow-[0_4px_12px_rgba(6,182,212,0.2)]',
      secondary: 'shadow-[0_4px_12px_rgba(0,0,0,0.05)]'
    }
  },
  springDark: {
    name: 'Spring Night',
    background: 'bg-gradient-to-t from-pink-950 to-black to-50%',
    text: 'text-gray-200',
    border: 'border-gray-800/50',
    input: {
      background: 'bg-gray-900/70 backdrop-blur-3xl',
      text: 'text-gray-200',
      placeholder: 'placeholder-gray-400',
      border: 'border-transparent'
    },
    button: {
      primary: 'bg-gradient-to-r from-pink-950 to-pink-900 hover:from-pink-900 hover:to-pink-800 text-white rounded-lg shadow-sm',
      secondary: 'bg-gray-900/80 hover:bg-gray-800/80 backdrop-blur-3xl text-gray-200 rounded-lg'
    },
    modal: {
      background: 'bg-gray-900/75 backdrop-blur-3xl shadow-lg',
      overlay: 'bg-black/20 backdrop-blur-md'
    },
    dropdown: {
      background: 'bg-gray-900/75 backdrop-blur-3xl shadow-sm',
      hover: 'hover:bg-pink-950/50'
    },
    card: {
      background: 'bg-gray-900/70 backdrop-blur-3xl shadow-sm',
      border: 'border-gray-800/30'
    },
    glow: {
      primary: 'shadow-[0_4px_16px_rgba(236,72,153,0.15)]',
      secondary: 'shadow-[0_4px_16px_rgba(0,0,0,0.1)]'
    }
  },
  summerDark: {
    name: 'Summer Forest',
    background: 'bg-gradient-to-t from-cyan-950 to-black to-50%',
    text: 'text-gray-200',
    border: 'border-gray-800/50',
    input: {
      background: 'bg-gray-900/70 backdrop-blur-3xl',
      text: 'text-gray-200',
      placeholder: 'placeholder-gray-400',
      border: 'border-transparent'
    },
    button: {
      primary: 'bg-gradient-to-r from-cyan-950 to-cyan-900 hover:from-cyan-900 hover:to-cyan-800 text-white rounded-lg shadow-sm',
      secondary: 'bg-gray-900/80 hover:bg-gray-800/80 backdrop-blur-3xl text-gray-200 rounded-lg'
    },
    modal: {
      background: 'bg-gray-900/75 backdrop-blur-3xl shadow-lg',
      overlay: 'bg-black/20 backdrop-blur-md'
    },
    dropdown: {
      background: 'bg-gray-900/75 backdrop-blur-3xl shadow-sm',
      hover: 'hover:bg-cyan-950/50'
    },
    card: {
      background: 'bg-gray-900/70 backdrop-blur-3xl shadow-sm',
      border: 'border-gray-800/30'
    },
    glow: {
      primary: 'shadow-[0_4px_16px_rgba(6,182,212,0.15)]',
      secondary: 'shadow-[0_4px_16px_rgba(0,0,0,0.1)]'
    }
  },
  autumnDark: {
    name: 'Autumn Ember',
    background: 'bg-gradient-to-t from-purple-950 to-black to-50%',
    text: 'text-gray-200',
    border: 'border-gray-800/50',
    input: {
      background: 'bg-gray-900/80 backdrop-blur-3xl',
      text: 'text-gray-200',
      placeholder: 'placeholder-gray-400',
      border: 'border-transparent'
    },
    button: {
      primary: 'bg-gradient-to-r from-purple-950 to-purple-800 hover:from-purple-800 hover:to-purple-700 text-white rounded-lg shadow-sm',
      secondary: 'bg-gray-900/80 hover:bg-gray-800/80 backdrop-blur-3xl text-gray-200 rounded-lg'
    },
    modal: {
      background: 'bg-gray-900/80 backdrop-blur-3xl shadow-lg',
      overlay: 'bg-black/20 backdrop-blur-md'
    },
    dropdown: {
      background: 'bg-gray-900/80 backdrop-blur-3xl shadow-sm',
      hover: 'hover:bg-purple-950/50'
    },
    card: {
      background: 'bg-gray-900/80 backdrop-blur-3xl shadow-sm',
      border: 'border-gray-800/30'
    },
    glow: {
      primary: 'shadow-[0_4px_16px_rgba(147,51,234,0.15)]',
      secondary: 'shadow-[0_4px_16px_rgba(0,0,0,0.1)]'
    }
  },
  winterDark: {
    name: 'Winter Midnight',
    background: 'bg-gradient-to-t from-blue-950 to-black to-50%',
    text: 'text-gray-200',
    border: 'border-gray-800/50',
    input: {
      background: 'bg-gray-900/70 backdrop-blur-3xl',
      text: 'text-gray-200',
      placeholder: 'placeholder-gray-400',
      border: 'border-transparent'
    },
    button: {
      primary: 'bg-gradient-to-r from-blue-950 to-blue-900 hover:from-blue-900 hover:to-blue-800 text-white rounded-lg shadow-sm',
      secondary: 'bg-gray-900/80 hover:bg-gray-800/80 backdrop-blur-3xl text-gray-200 rounded-lg'
    },
    modal: {
      background: 'bg-gray-900/75 backdrop-blur-3xl shadow-lg',
      overlay: 'bg-black/20 backdrop-blur-md'
    },
    dropdown: {
      background: 'bg-gray-900/75 backdrop-blur-3xl shadow-sm',
      hover: 'hover:bg-blue-950/50'
    },
    card: {
      background: 'bg-gray-900/70 backdrop-blur-3xl shadow-sm',
      border: 'border-gray-800/30'
    },
    glow: {
      primary: 'shadow-[0_4px_16px_rgba(59,130,246,0.15)]',
      secondary: 'shadow-[0_4px_16px_rgba(0,0,0,0.1)]'
    }
  },
  monochrome: {
    name: 'Monochrome Slate',
    background: 'bg-gradient-to-br from-gray-900 to-gray-900',
    text: 'text-gray-200',
    border: 'border-gray-700/50',
    input: {
      background: 'bg-gray-800/80 backdrop-blur-3xl',
      text: 'text-gray-200',
      placeholder: 'placeholder-gray-400',
      border: 'border-transparent'
    },
    button: {
      primary: 'bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 text-white rounded-lg shadow-sm',
      secondary: 'bg-gray-800/80 hover:bg-gray-700/80 backdrop-blur-3xl text-gray-200 rounded-lg'
    },
    modal: {
      background: 'bg-gray-800/85 backdrop-blur-3xl shadow-lg',
      overlay: 'bg-gray-900/20 backdrop-blur-md'
    },
    dropdown: {
      background: 'bg-gray-800/85 backdrop-blur-3xl shadow-sm',
      hover: 'hover:bg-blue-500/20'
    },
    card: {
      background: 'bg-gray-800/80 backdrop-blur-3xl shadow-sm',
      border: 'border-gray-700/30'
    },
    glow: {
      primary: 'shadow-[0_4px_16px_rgba(59,130,246,0.1)]',
      secondary: 'shadow-[0_4px_16px_rgba(0,0,0,0.1)]'
    }
  }
};