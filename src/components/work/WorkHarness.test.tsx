import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorkHarness } from './WorkHarness';

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../../hooks/useWork', () => ({ useWork: () => ({
  snapshot: null, history: [], busy: false, checking: false, error: null,
  capabilities: { access: 'sign_in', cloud: false, message: 'Sign in to check your Work access.' },
}) }));
vi.mock('../../services/work/workService', () => ({ getWorkCapabilities: vi.fn() }));

const props = {
  sessionId: 'test-session', persona: 'default' as const, visible: true,
  brand: <button type="button" aria-haspopup="menu">TimeMachine Work</button>,
  onPersonaChange: vi.fn(), onOpenAuth: vi.fn(), onOpenSettings: vi.fn(),
  beforeStart: async () => {}, onLocalWork: async () => {},
};
const renderAt = (width: number) => {
  vi.stubGlobal('window', { matchMedia: () => ({ matches: width >= 901 }) });
  return renderToStaticMarkup(<WorkHarness {...props} />);
};

afterEach(() => vi.unstubAllGlobals());

describe('Work sidebar layout', () => {
  it('uses one persistent close/reopen control on desktop', () => {
    const html = renderAt(1440);
    expect(html).toContain('aria-label="Hide Work sidebar" title="Hide sidebar" aria-expanded="true"');
    expect(html).toContain('data-sidebar-open="true"');
    expect(html.match(/aria-controls="work-sidebar"/g)).toHaveLength(1);
    expect(html).not.toMatch(/id="work-sidebar"[^>]*hidden/);
    expect(html.match(/TimeMachine Work<\/button>/g)).toHaveLength(1);
  });

  it('starts closed on mobile while retaining the composer and navigation', () => {
    const html = renderAt(390);
    expect(html).toContain('aria-label="Show Work sidebar" title="Show sidebar" aria-expanded="false"');
    expect(html).toContain('aria-controls="work-sidebar"');
    expect(html).toContain('data-sidebar-open="false"');
    expect(html).toMatch(/id="work-sidebar"[^>]*hidden=""/);
    expect(html).toContain('id="work-goal"');
    expect(html).toContain('aria-label="Work sections"');
    expect(html.match(/TimeMachine Work<\/button>/g)).toHaveLength(1);
  });

  it('uses the desktop default at the breakpoint and keeps hidden harnesses hidden', () => {
    expect(renderAt(900)).toContain('data-sidebar-open="false"');
    expect(renderAt(901)).toContain('data-sidebar-open="true"');
    expect(renderToStaticMarkup(<WorkHarness {...props} visible={false} />))
      .toMatch(/class="tm-work"[^>]*hidden=""/);
  });
});
