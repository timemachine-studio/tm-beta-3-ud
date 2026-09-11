import { Theme } from '../types/theme';

/**
 * The one light variant. Bone paper with a slow-drifting bloom behind the
 * glass (`.tm-canvas`, see stylesheet/light.css) and near-black ink. It
 * is the dark UI with the lights on: same radii, same blur, same alphas —
 * only the poles swap, and that swap happens at the token level in
 * light.css, which is why every value here is a semantic token rather
 * than a literal shade.
 */
export const lightTheme: Theme = {
  name: 'Light',
  background: 'tm-canvas',
  text: 'text-ink',
  border: 'border-line',
  input: {
    background: 'bg-surface/70 backdrop-blur-3xl',
    text: 'text-ink',
    placeholder: 'placeholder-ink-faint',
    border: 'border-line'
  },
  button: {
    primary: 'bg-pill hover:opacity-90 text-pill-ink rounded-lg shadow-xs',
    secondary: 'bg-surface/70 hover:bg-surface backdrop-blur-3xl text-ink border border-line rounded-lg'
  },
  modal: {
    background: 'bg-surface/80 backdrop-blur-3xl shadow-lg',
    overlay: 'bg-black/40 backdrop-blur-md'
  },
  dropdown: {
    background: 'bg-surface/80 backdrop-blur-3xl shadow-xs',
    hover: 'hover:bg-sunken'
  },
  card: {
    background: 'bg-surface/70 backdrop-blur-3xl shadow-xs',
    border: 'border-line'
  },
  glow: {
    primary: 'shadow-[0_4px_16px_rgba(52,44,30,0.12)]',
    secondary: 'shadow-[0_4px_16px_rgba(52,44,30,0.08)]'
  }
};
