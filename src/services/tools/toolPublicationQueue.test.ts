import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '../../lib/supabase';
import type { ToolSpec } from '../../../shared/toolRegistry';
import { toolDigest } from '../../../shared/toolRegistrySchema';
import {
  clearToolPublicationQueueForTests,
  publicationReceipt,
  publicationQueueStatus,
  queueToolPublication,
  resetToolPublicationQueueForTests,
  retryQueuedToolPublications,
} from './toolPublicationQueue';

const spec: ToolSpec = {
  slug: 'word_meter', title: 'Word meter',
  description: 'Counts words in generic input text for a reusable writing check.',
  summary: 'Count the words in supplied text.',
  parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false },
  source: 'def main(text):\n    return {"words": len(text.split())}',
  terms: ['word meter', 'count words'], tests: [{ input: { text: 'one two' }, expect: '2' }],
};

describe('tool publication outbox', () => {
  let currentUser: string | null;
  beforeEach(async () => {
    currentUser = 'account-a';
    vi.spyOn(supabase.auth, 'getSession').mockImplementation(async () => ({
      data: { session: currentUser ? { user: { id: currentUser } } : null }, error: null,
    }) as Awaited<ReturnType<typeof supabase.auth.getSession>>);
    resetToolPublicationQueueForTests();
    await clearToolPublicationQueueForTests();
  });

  it('retries a queued tool by digest and saves a publication receipt', async () => {
    const digest = await toolDigest(spec);
    expect(await queueToolPublication(spec, digest)).toBe(true);
    expect(await publicationQueueStatus(digest)).toBe('pending');
    const publish = vi.fn(async () => ({ published: true as const, id: 'row-1', version: 3, reused: false }));
    expect(await retryQueuedToolPublications('account-a', publish, Date.now() + 31_000)).toBe(1);
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ slug: spec.slug }), digest);
    expect(await publicationReceipt(digest)).toEqual({ id: 'row-1', version: 3 });
    expect(await publicationQueueStatus(digest)).toBeNull();
    expect(await retryQueuedToolPublications('account-a', publish, Date.now() + 61_000)).toBe(0);
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('never publishes another account’s pending source', async () => {
    const digest = await toolDigest(spec);
    await queueToolPublication(spec, digest);
    currentUser = 'account-b';
    const publish = vi.fn();
    expect(await retryQueuedToolPublications('account-a', publish, Date.now() + 31_000)).toBe(0);
    expect(await publicationReceipt(digest)).toBeNull();
    expect(publish).not.toHaveBeenCalled();
  });

  it('backs off on outages and stops retrying terminal failures', async () => {
    const digest = await toolDigest(spec);
    await queueToolPublication(spec, digest);
    const outage = vi.fn(async () => ({ published: false as const, reason: 'unavailable' as const }));
    const firstDue = Date.now() + 31_000;
    expect(await retryQueuedToolPublications('account-a', outage, firstDue)).toBe(0);
    expect(await retryQueuedToolPublications('account-a', outage, firstDue + 1)).toBe(0);
    expect(outage).toHaveBeenCalledTimes(1);
    const terminal = vi.fn(async () => ({ published: false as const, reason: 'slug_taken' as const }));
    expect(await retryQueuedToolPublications('account-a', terminal, firstDue + 120_001)).toBe(0);
    expect(await retryQueuedToolPublications('account-a', terminal, firstDue + 240_000)).toBe(0);
    expect(terminal).toHaveBeenCalledTimes(1);
    expect(await publicationQueueStatus(digest)).toBe('stopped');
  });

  it('backs off when a publisher throws, then recovers without losing the package', async () => {
    const digest = await toolDigest(spec);
    await queueToolPublication(spec, digest);
    const due = Date.now() + 31_000;
    const throwing = vi.fn(async () => { throw new Error('offline'); });
    expect(await retryQueuedToolPublications('account-a', throwing, due)).toBe(0);
    expect(throwing).toHaveBeenCalledTimes(1);
    const success = vi.fn(async () => ({ published: true as const, id: 'row-2', version: 1, reused: false }));
    expect(await retryQueuedToolPublications('account-a', success, due + 1)).toBe(0);
    expect(await retryQueuedToolPublications('account-a', success, due + 120_001)).toBe(1);
    expect(await publicationReceipt(digest)).toEqual({ id: 'row-2', version: 1 });
  });
});
