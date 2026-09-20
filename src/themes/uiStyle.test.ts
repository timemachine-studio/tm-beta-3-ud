import { describe, expect, it } from 'vitest';
import { DEFAULT_UI_STYLE, UI_STYLE_KEY, readStoredUiStyle } from './uiStyle';

describe('UI style storage', () => {
  it('starts a new visitor in Legacy', () => {
    expect(DEFAULT_UI_STYLE).toBe('legacy');
    expect(readStoredUiStyle(() => null)).toBe('legacy');
  });

  it('honours a saved user choice', () => {
    expect(readStoredUiStyle((key) => key === UI_STYLE_KEY ? 'current' : null)).toBe('current');
    expect(readStoredUiStyle((key) => key === UI_STYLE_KEY ? 'legacy' : null)).toBe('legacy');
  });
});
