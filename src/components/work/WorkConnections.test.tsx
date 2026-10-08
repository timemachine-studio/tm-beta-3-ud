import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { WorkCapabilities } from '../../../shared/work';
const mock = vi.hoisted(() => ({ result: null as unknown, error: null as string | null, checking: false, check: vi.fn() }));
vi.mock('../../hooks/useWorkConnectionCheck', () => ({ useWorkConnectionCheck: () => mock }));
vi.mock('../../services/work/workService', () => ({ getWorkConnectionStatuses: vi.fn(), getWorkIntegration: vi.fn() }));
import { WorkConnections } from './WorkConnections';
import { WorkIntegrationPane } from './WorkIntegrationPane';
const allowed: WorkCapabilities = { access: 'allowed', cloud: true, local: true, background: true, openhands: false, agenta: false, message: null };
beforeEach(() => { mock.result = null; mock.error = null; mock.checking = false; mock.check.mockClear(); });
describe('Work connection surfaces', () => {
  it('does not treat an installed adapter as a checked remote connection', () => {
    const html = renderToStaticMarkup(<WorkConnections capabilities={allowed} />);
    expect(html).toContain('Not checked'); expect(html).toContain('Sandbox execution is not enabled.');
    expect(html).toContain('PRO browser workspace'); expect(mock.check).not.toHaveBeenCalled();
  });
  it('disables configuration checks for guests and keeps the premium explanation', () => {
    const html = renderToStaticMarkup(<WorkConnections capabilities={{ ...allowed, access: 'sign_in', cloud: false }} />);
    expect(html).toMatch(/button[^>]*disabled=""/); expect(html).toContain('Sign in with a premium TM account');
    expect(html).not.toContain('Worker enabled');
  });
  it('shows configuration without claiming remote health or execution', () => {
    mock.result = [{ service: 'openhands', configured: true, message: 'Assigned configuration.', executionEnabled: false }, { service: 'agenta', configured: true, exportEnabled: false, message: 'Assigned project.', executionEnabled: false }];
    const html = renderToStaticMarkup(<WorkConnections capabilities={allowed} />);
    expect(html).toContain('Configured · remote not checked'); expect(html).toContain('Metadata export: disabled');
    expect(html).not.toContain('Remote response received');
  });
  it('makes upstream checks discoverable in a collapsed task detail, without auto-loading', () => {
    const html = renderToStaticMarkup(<WorkIntegrationPane taskId="11111111-1111-4111-8111-111111111111" />);
    expect(html).toContain('<summary>Upstream connections</summary>');
    expect(html).toContain('This cannot start or resume execution.');
    expect((html.match(/Check connection/g) ?? [])).toHaveLength(2); expect(mock.check).not.toHaveBeenCalled();
  });
  it('shows confirmation as unavailable authorization and offers only read-only paging', () => {
    mock.result = { connected: true, conversation: { status: 'waiting_for_confirmation', runtimeStatus: 'available' }, events: [], traces: [], eventPage: { hasMore: true, nextCursor: 'encrypted-cursor' } };
    const html = renderToStaticMarkup(<WorkIntegrationPane taskId="11111111-1111-4111-8111-111111111111" />);
    expect(html).toContain('Tool approval is not connected yet'); expect(html).toContain('Stop control'); expect(html).toContain('Earlier events');
    expect(html).not.toContain('encrypted-cursor'); expect(html).not.toMatch(/>Approve<|>Reject</); expect(mock.check).not.toHaveBeenCalled();
  });
  it('reports truncated history without presenting an unusable paging button', () => {
    mock.result = { connected: true, conversation: null, events: [], traces: [], eventPage: { hasMore: true, nextCursor: null } };
    const html = renderToStaticMarkup(<WorkIntegrationPane taskId="11111111-1111-4111-8111-111111111111" />);
    expect(html).toContain('More event history exists'); expect(html).not.toContain('Earlier events');
  });
});
