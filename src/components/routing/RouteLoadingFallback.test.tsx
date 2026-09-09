import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RouteLoadingFallback } from './RouteLoadingFallback';

describe('RouteLoadingFallback', () => {
  it('announces route loading without leaving a blank screen', () => {
    const html = renderToStaticMarkup(<RouteLoadingFallback />);

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Loading page…');
  });
});
