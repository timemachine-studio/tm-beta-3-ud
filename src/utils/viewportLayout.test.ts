import { describe, expect, it } from 'vitest';
import { viewportLayout } from './viewportLayout';

const viewport = { layoutHeight: 844, visualHeight: 460, offsetTop: 0, scale: 1, zoom: 1, focused: true };

describe('viewportLayout', () => {
  it('lifts the composer and shortens chat while the keyboard covers the layout viewport', () => {
    expect(viewportLayout(viewport)).toEqual({ vh: '4.6px', keyboard: 384 });
  });
  it('discards stale keyboard geometry after leaving history search or blurring an input', () => {
    expect(viewportLayout({ ...viewport, focused: false })).toEqual({ vh: 'calc(1dvh / 1)', keyboard: 0 });
  });
  it('does not lift the composer for pinch zoom or browser chrome', () => {
    expect(viewportLayout({ ...viewport, scale: 2 }).keyboard).toBe(0);
    expect(viewportLayout({ ...viewport, visualHeight: 800 }).keyboard).toBe(0);
  });
  it('does not double-compensate when Android resizes the layout viewport', () => {
    expect(viewportLayout({ ...viewport, layoutHeight: 460 })).toEqual({ vh: 'calc(1dvh / 1)', keyboard: 0 });
  });
  it('accounts for viewport panning and CSS zoom', () => {
    expect(viewportLayout({ ...viewport, offsetTop: 20, zoom: 0.8 })).toEqual({ vh: '5.75px', keyboard: 455 });
  });
});
