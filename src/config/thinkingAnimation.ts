import type { OrbState } from 'thinking-orbs';

export const THINKING_ANIMATION_KEY = 'tm-thinking-animation';

// Every shipped React orb state except shaping, which the user explicitly excluded.
const ORB_STATES = ['working', 'searching', 'solving', 'listening', 'connecting', 'weaving', 'composing', 'breathing'] as const satisfies readonly OrbState[];
const ORB_SIZES = [64, 20] as const;
const ORB_NAMES: Record<typeof ORB_STATES[number], readonly [string, string]> = {
  working: ['Velora', 'Pipkin'],
  searching: ['Astrail', 'Nimlet'],
  solving: ['Quellix', 'Tessik'],
  listening: ['Soniri', 'Murmio'],
  connecting: ['Nexara', 'Knotzi'],
  weaving: ['Silvara', 'Twili'],
  composing: ['Cadelle', 'Liltik'],
  breathing: ['Aeruma', 'Puflo'],
};

export type OrbVariant = {
  kind: 'orb';
  state: typeof ORB_STATES[number];
  size: typeof ORB_SIZES[number];
};
export type ThinkingVisual = OrbVariant | { kind: 'constellation' } | { kind: 'cubes' };
type OrbChoice = `orb:${OrbVariant['state']}:${OrbVariant['size']}`;
export type ThinkingAnimationChoice = 'orb-cycle' | 'all-cycle' | 'constellation' | 'cubes' | OrbChoice;

export const DEFAULT_THINKING_ANIMATION: ThinkingAnimationChoice = 'orb-cycle';
export const ORB_VARIANTS: readonly OrbVariant[] = ORB_STATES.flatMap(state =>
  ORB_SIZES.map(size => ({ kind: 'orb' as const, state, size })),
);
export const ALL_THINKING_VISUALS: readonly ThinkingVisual[] = [
  { kind: 'cubes' },
  { kind: 'constellation' },
  ...ORB_VARIANTS,
];

export const THINKING_ANIMATION_OPTIONS: ReadonlyArray<{
  value: ThinkingAnimationChoice;
  label: string;
  group: 'Cycles' | 'Original styles' | 'Individual orbs';
  hint: string;
}> = [
  { value: 'orb-cycle', label: 'All orbs', group: 'Cycles', hint: 'Every orb shape, in both sizes.' },
  { value: 'all-cycle', label: 'Everything', group: 'Cycles', hint: 'Cubes, constellation, then every orb variant.' },
  { value: 'cubes', label: 'Original cubes', group: 'Original styles', hint: 'The classic animated block wave.' },
  { value: 'constellation', label: 'Constellation', group: 'Original styles', hint: 'Rotating dots connected one by one.' },
  ...ORB_VARIANTS.map(({ state, size }) => ({
    value: `orb:${state}:${size}` as OrbChoice,
    label: ORB_NAMES[state][size === 64 ? 0 : 1],
    group: 'Individual orbs' as const,
    hint: 'An individual thinking orb.',
  })),
];

const VALID_CHOICES = new Set<string>(THINKING_ANIMATION_OPTIONS.map(({ value }) => value));

export function isThinkingAnimationChoice(value: unknown): value is ThinkingAnimationChoice {
  return typeof value === 'string' && VALID_CHOICES.has(value);
}

export function readStoredThinkingAnimation(read: (key: string) => string | null): ThinkingAnimationChoice {
  const value = read(THINKING_ANIMATION_KEY);
  return isThinkingAnimationChoice(value) ? value : DEFAULT_THINKING_ANIMATION;
}

export function thinkingVisualAt(choice: ThinkingAnimationChoice, step: number): ThinkingVisual {
  const safeStep = Math.max(0, Math.floor(step));
  if (choice === 'orb-cycle') return ORB_VARIANTS[safeStep % ORB_VARIANTS.length];
  if (choice === 'all-cycle') return ALL_THINKING_VISUALS[safeStep % ALL_THINKING_VISUALS.length];
  if (choice === 'cubes' || choice === 'constellation') return { kind: choice };
  const variant = ORB_VARIANTS.find(({ state, size }) => choice === `orb:${state}:${size}`);
  return variant ?? ORB_VARIANTS[0];
}
