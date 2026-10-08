import { describe, expect, it } from 'vitest';
import { DEFAULT_UI_STYLE, UI_STYLE_KEY, isUiStyle, readStoredUiStyle } from './uiStyle';

describe('UI style storage', () => {
  it('starts a new visitor in Present', () => {
    expect(DEFAULT_UI_STYLE).toBe('present');
    expect(readStoredUiStyle(() => null)).toBe('present');
  });

  it('honours a saved user choice', () => {
    expect(readStoredUiStyle((key) => key === UI_STYLE_KEY ? 'present' : null)).toBe('present');
    expect(readStoredUiStyle((key) => key === UI_STYLE_KEY ? 'classic' : null)).toBe('classic');
    expect(readStoredUiStyle((key) => key === UI_STYLE_KEY ? 'legacy' : null)).toBe('legacy');
  });

  it('migrates the former current setting to Present', () => {
    expect(readStoredUiStyle((key) => key === UI_STYLE_KEY ? 'current' : null)).toBe('present');
    expect(isUiStyle('current')).toBe(false);
  });
});
