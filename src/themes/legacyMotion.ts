// The background wash runs for 1.45s. Accent changes follow its vertical path:
// composer at the bottom, kinetic word near the middle, then brand at the top.
export const LEGACY_TEXT_TRANSITION = {
  transitionDelay: '220ms',
  transitionDuration: '1150ms',
  transitionTimingFunction: 'cubic-bezier(0.65, 0, 0.35, 1)',
} as const;

export const LEGACY_COMPOSER_TRANSITION = {
  transitionDelay: '130ms',
  transitionDuration: '1150ms',
  transitionTimingFunction: 'cubic-bezier(0.65, 0, 0.35, 1)',
} as const;

export const LEGACY_TOP_DELAY_MS = 500;
export const LEGACY_TOP_DURATION_MS = 950;

export const LEGACY_BRAND_TRANSITION = {
  // The shared top persona state already applies the 500ms positional delay.
  transitionDelay: '0ms',
  transitionDuration: `${LEGACY_TOP_DURATION_MS}ms`,
  transitionTimingFunction: 'cubic-bezier(0.65, 0, 0.35, 1)',
} as const;
