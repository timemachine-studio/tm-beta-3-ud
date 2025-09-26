import { Theme } from '../types/theme';

export const darkTheme: Theme = {
  name: 'Dark',
  background: 'bg-black',
  text: 'text-white',
  border: 'border-white/10',
  input: {
    background: 'bg-white/5',
    text: 'text-white',
    placeholder: 'placeholder-gray-400',
    border: 'border-white/10'
  },
  button: {
    primary: 'bg-purple-600 hover:bg-purple-700 text-white',
    secondary: 'bg-white/10 hover:bg-white/20 text-white'
  },
  modal: {
    background: 'bg-black/90',
    overlay: 'bg-black/50'
  },
  dropdown: {
    background: 'bg-black/90',
    hover: 'hover:bg-white/10'
  },
  card: {
    background: 'bg-white/5',
    border: 'border-white/10'
  },
  glow: {
    primary: 'shadow-[0_0_15px_rgba(168,85,247,0.3)]',
    secondary: 'shadow-[0_0_15px_rgba(255,255,255,0.1)]'
  }
};