import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readWorkEventCursor, readWorkEventPage, type WorkEventScope } from './runtimeEvents';
const context: WorkEventScope = {
  taskId: '11111111-1111-4111-8111-111111111111', userId: '22222222-2222-4222-8222-222222222222',
  connectionId: '33333333-3333-4333-8333-333333333333', conversationId: '44444444-4444-4444-8444-444444444444', generation: 1, revision: 2,
};
const item = { id: 'event-id', kind: 'ActionEvent', timestamp: '2026-09-27T00:00:00Z' };
const first = () => readWorkEventPage({ items: [item], next_page_id: 'private-page' }, context);
beforeEach(() => { vi.stubEnv('TM_WORK_EVENT_CURSOR_SECRET', 's'.repeat(48)); });
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
describe('bounded encrypted event history', () => {
  it('strips all unapproved fields rather than returning raw events', () => {
    const result = readWorkEventPage({ items: [{ ...item, thought: 'secret', action: { command: 'secret' }, reasoning_content: 'secret', api_key: 'secret' }] }, context);
    expect(result.events).toEqual([item]); expect(JSON.stringify(result)).not.toContain('secret');
  });
  it('encrypts rather than base64-encoding the upstream cursor', () => {
    const token = first().eventPage.nextCursor!;
    expect(Buffer.from(token.slice(5), 'base64url').toString()).not.toContain('private-page');
    expect(readWorkEventCursor(token, context)).toMatchObject({ pageId: 'private-page', depth: 1 });
  });
  it.each(['taskId', 'userId', 'connectionId', 'conversationId', 'generation', 'revision'] as const)('binds pagination to %s', field => {
    const token = first().eventPage.nextCursor!;
    const other = { ...context, [field]: typeof context[field] === 'number' ? 9 : '55555555-5555-4555-8555-555555555555' };
    expect(() => readWorkEventCursor(token, other)).toThrow('WORK_EVENT_CURSOR_EXPIRED');
  });
  it('rejects tampering, oversized tokens and rotated keys', () => {
    const token = first().eventPage.nextCursor!;
    expect(() => readWorkEventCursor(token.slice(0, 20) + (token[20] === 'A' ? 'B' : 'A') + token.slice(21), context)).toThrow('WORK_EVENT_CURSOR_EXPIRED');
    expect(() => readWorkEventCursor('tme1.' + 'A'.repeat(4000), context)).toThrow('WORK_EVENT_CURSOR_EXPIRED');
    vi.stubEnv('TM_WORK_EVENT_CURSOR_SECRET', 'x'.repeat(48));
    expect(() => readWorkEventCursor(token, context)).toThrow('WORK_EVENT_CURSOR_EXPIRED');
  });
  it('expires browsing after ten minutes and never extends expiry on a later page', () => {
    vi.useFakeTimers(); const token = first().eventPage.nextCursor!, previous = readWorkEventCursor(token, context);
    vi.advanceTimersByTime(300000);
    const next = readWorkEventPage({ items: [item], next_page_id: 'another-page' }, context, previous).eventPage.nextCursor!;
    expect(readWorkEventCursor(next, context).expiresAt).toBe(previous.expiresAt);
    vi.advanceTimersByTime(300001);
    expect(() => readWorkEventCursor(next, context)).toThrow('WORK_EVENT_CURSOR_EXPIRED');
  });
  it('caps browsing at twenty older pages and exposes incomplete history', () => {
    const previous = readWorkEventCursor(first().eventPage.nextCursor!, context);
    const result = readWorkEventPage({ items: [item], next_page_id: 'next' }, context, { ...previous, depth: 20 });
    expect(result.eventPage).toEqual({ hasMore: true, nextCursor: null });
  });
  it.each([
    { items: Array(31).fill(item) },
    { items: [{ ...item, id: '../invalid' }] },
    { items: [{ ...item, timestamp: '2026-09-27T00:00:00' }] },
    { items: [], next_page_id: 'next' },
    { items: [item], next_page_id: '😀'.repeat(400) },
    { items: [item, { ...item, kind: 'MessageEvent' }] },
    { items: [item, { ...item, id: 'newer', timestamp: '2026-09-28T00:00:00Z' }] },
  ])('rejects malformed, oversized, inconsistent or misordered metadata %#', raw => {
    expect(() => readWorkEventPage(raw, context)).toThrow('WORK_UPSTREAM_INVALID_RESPONSE');
  });
  it('deduplicates identical events and rejects a non-progressing cursor', () => {
    expect(readWorkEventPage({ items: [item, item] }, context).events).toHaveLength(1);
    const previous = readWorkEventCursor(first().eventPage.nextCursor!, context);
    expect(() => readWorkEventPage({ items: [item], next_page_id: previous.pageId }, context, previous)).toThrow('WORK_UPSTREAM_INVALID_RESPONSE');
  });
});
