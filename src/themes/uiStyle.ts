/**
 * Present and Classic share the sidebar layout and differ in their glass
 * material. Legacy keeps the earlier, rail-free layout. `current` remains a
 * readable storage alias for builds that saved the former Present value.
 *
 * Stored per device. The value lives on <html> as `data-tm-ui` so plain CSS
 * can follow it the way `data-theme` and `data-tm-scale` are followed.
 */
export type UiStyle = 'present' | 'classic' | 'legacy';

export const UI_STYLE_KEY = 'tm-ui-style';
// First-time visitors start in Present. Once they choose an
// interface in Settings, the stored value below remains authoritative.
export const DEFAULT_UI_STYLE: UiStyle = 'present';

const UI_STYLES: readonly UiStyle[] = ['present', 'classic', 'legacy'];

export function isUiStyle(value: unknown): value is UiStyle {
  return typeof value === 'string'
    && (UI_STYLES as readonly string[]).includes(value);
}

export function readStoredUiStyle(read: (key: string) => string | null): UiStyle {
  const raw = read(UI_STYLE_KEY);
  if (raw === 'current') return 'present';
  return isUiStyle(raw) ? raw : DEFAULT_UI_STYLE;
}
