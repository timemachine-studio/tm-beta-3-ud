/**
 * Which shell the product wears. `current` is the rail-and-glass shell the
 * chat was redrawn into; `legacy` is the one before it — no rail, the brand
 * as bare glowing text in the corner, the welcome line in the UI face, and
 * every page as its pre-rail file. Both render at 100%. The composer is the
 * legacy bar in both: it was brought back on request, not gated.
 *
 * Stored per device. The value lives on <html> as `data-tm-ui` so plain CSS
 * can follow it the way `data-theme` and `data-tm-scale` are followed.
 */
export type UiStyle = 'current' | 'legacy';

export const UI_STYLE_KEY = 'tm-ui-style';
export const DEFAULT_UI_STYLE: UiStyle = 'current';

const UI_STYLES: readonly UiStyle[] = ['current', 'legacy'];

export function isUiStyle(value: unknown): value is UiStyle {
  return typeof value === 'string' && (UI_STYLES as readonly string[]).includes(value);
}

export function readStoredUiStyle(read: (key: string) => string | null): UiStyle {
  const raw = read(UI_STYLE_KEY);
  return isUiStyle(raw) ? raw : DEFAULT_UI_STYLE;
}
