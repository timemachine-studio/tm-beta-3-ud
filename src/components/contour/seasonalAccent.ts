/** Contour follows the resolved Auto/manual season set by ThemeProvider. */
export const seasonalContourAccent = {
  bg: 'rgb(var(--tm-season-rgb, 168 85 247) / 0.12)',
  border: 'rgb(var(--tm-season-rgb, 168 85 247) / 0.25)',
  glow: '0 14px 38px -22px rgb(var(--tm-season-rgb, 168 85 247) / 0.35)',
  text: 'tm-contour-accent-text',
  solid: 'var(--tm-season-accent, #c084fc)',
} as const;
