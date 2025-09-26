import { Theme } from '../types/theme';

export const lightTheme: Theme = {
  name: 'Light',
  background: 'bg-white',
  text: 'text-black',
  border: 'border-gray-200',
  input: {
    background: 'bg-gray-50',
    text: 'text-black',
    placeholder: 'placeholder-gray-500',
    border: 'border-gray-200'
  },
  button: {
    primary: 'bg-purple-600 hover:bg-purple-700 text-white',
    secondary: 'bg-gray-100 hover:bg-gray-200 text-black'
  },
  modal: {
    background: 'bg-white',
    overlay: 'bg-black/20'
  },
  dropdown: {
    background: 'bg-white',
    hover: 'hover:bg-gray-100'
  },
  card: {
    background: 'bg-gray-50',
    border: 'border-gray-200'
  },
  glow: {
    primary: 'shadow-[0_0_15px_rgba(168,85,247,0.2)]',
    secondary: 'shadow-[0_0_15px_rgba(0,0,0,0.05)]'
  }
};