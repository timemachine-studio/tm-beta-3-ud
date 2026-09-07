import { describe, it, expect, vi, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { proContentExpired, RETENTION, durableProcessingAvailable } from './policy';
import { cleanupProcessingData } from './cleanup';
import { purgeUserStorage } from './accountStorage';
import { chatErrorFromResponse, isRetryableCode } from '../../../src/services/ai/chatErrors';

const now = Date.parse('2026-09-06T12:00:00Z');
const date = (age: number) => new Date(now - age).toISOString();
afterEach(() => vi.unstubAllEnvs());

describe('processing expiry', () => {
  it('fails closed despite unverified environment flags', () => {
    vi.stubEnv('DURABLE_RETENTION_VERIFIED', 'true');
    expect(durableProcessingAvailable()).toBe(false);
  });
  it('bounds completed recovery and absolute age without sliding reads', () => {
    expect(proContentExpired({ created_at: date(5000), updated_at: date(1000), status: 'completed' }, now)).toBe(false);
    expect(proContentExpired({ created_at: date(RETENTION.recoveryMs + 1), updated_at: date(RETENTION.recoveryMs), status: 'completed' }, now)).toBe(true);
    expect(proContentExpired({ created_at: date(RETENTION.maxRunAgeMs), updated_at: date(0), status: 'completed' }, now)).toBe(true);
  });
  it('does not reopen scrubbed output when the database advances updated_at', () => {
    const base = { created_at: date(RETENTION.recoveryMs + 1), updated_at: date(0) };
    expect(proContentExpired({ ...base, status: 'completed', final_content: null }, now)).toBe(true);
    expect(proContentExpired({ ...base, status: 'failed', error: null }, now)).toBe(true);
    expect(proContentExpired({ ...base, status: 'failed', error: 'PROCESSING_EXPIRED' }, now)).toBe(true);
  });
  it('expires abandoned runs and invalid/future clocks', () => {
    expect(proContentExpired({ created_at: date(RETENTION.abandonedRunMs), updated_at: date(0), status: 'running' }, now)).toBe(true);
    expect(proContentExpired({ created_at: 'invalid', updated_at: date(0), status: 'running' }, now)).toBe(true);
    expect(proContentExpired({ created_at: date(-1), updated_at: date(-1), status: 'running' }, now)).toBe(true);
  });
  it('shows a non-retryable retention failure rather than a model outage', async () => {
    const error = await chatErrorFromResponse(new Response(JSON.stringify({ error: { code: 'RETENTION_UNVERIFIED', message: 'Unavailable' } }), { status: 503 }));
    expect(error.code).toBe('RETENTION_UNVERIFIED');
    expect(isRetryableCode(error.code)).toBe(false);
  });
});

type RecordedOperation = { table: string; action: string; values?: unknown; filters: unknown[][] };
function queryFixture(failOperation = -1) {
  const recorded: RecordedOperation[] = [];
  const client = {
    from(table: string) {
      const op: RecordedOperation = { table, action: '', filters: [] };
      recorded.push(op);
      const index = recorded.length - 1;
      const query = {
        update(values: unknown) { op.action = 'update'; op.values = values; return query; },
        delete() { op.action = 'delete'; return query; },
        eq(...args: unknown[]) { op.filters.push(['eq', ...args]); return query; },
        is(...args: unknown[]) { op.filters.push(['is', ...args]); return query; },
        lte(...args: unknown[]) { op.filters.push(['lte', ...args]); return query; },
        in(...args: unknown[]) { op.filters.push(['in', ...args]); return query; },
        or(...args: unknown[]) { op.filters.push(['or', ...args]); return query; },
        then(resolve: (value: { error: unknown }) => unknown) { return Promise.resolve(resolve({ error: index === failOperation ? { message: 'CANARY_PRIVATE' } : null })); },
      };
      return query;
    },
  } as unknown as SupabaseClient;
  return { client, recorded };
}

describe('cleanup query adapter (synthetic database, no live SQL)', () => {
  it('targets only temporary stores and retains unresolved processor references', async () => {
    const fixture = queryFixture();
    await cleanupProcessingData(fixture.client, now);
    expect(new Set(fixture.recorded.map(op => op.table))).toEqual(new Set(['pro_generation_jobs', 'mcp_tool_runs']));
    expect(fixture.recorded[0].filters).toContainEqual(['lte', 'created_at', date(RETENTION.abandonedRunMs)]);
    expect(fixture.recorded[1].filters).toContainEqual(['lte', 'updated_at', date(RETENTION.recoveryMs)]);
    expect(fixture.recorded[2].filters).toContainEqual(['lte', 'created_at', date(RETENTION.maxRunAgeMs)]);
    expect(fixture.recorded[3].filters).toContainEqual(['is', 'run_id', null]);
    expect(fixture.recorded[4].values).toMatchObject({ continuation_state: null, argument_preview: {}, error_code: null });
  });
  it('reports failure without private diagnostics and still attempts other cleanup', async () => {
    const fixture = queryFixture(1);
    await expect(cleanupProcessingData(fixture.client, now)).rejects.toThrow('retention_cleanup_failed:1');
    expect(fixture.recorded).toHaveLength(8);
  });
});

function storageFixture(names: string[], fail: 'list' | 'remove' | null = null) {
  const objects = new Set(names);
  const storage = {
    list: vi.fn(async (prefix: string, options: { limit: number; offset: number }) => {
      const entries = new Map<string, { name: string; id: string | null }>();
      for (const path of objects) {
        if (!path.startsWith(`${prefix}/`)) continue;
        const relative = path.slice(prefix.length + 1);
        const name = relative.split('/')[0];
        entries.set(name, { name, id: relative.includes('/') ? null : path });
      }
      return { data: [...entries.values()].slice(options.offset, options.offset + options.limit), error: fail === 'list' ? new Error('CANARY_PRIVATE') : null };
    }),
    remove: vi.fn(async (paths: string[]) => {
      if (fail === 'remove') return { error: new Error('CANARY_PRIVATE') };
      paths.forEach(path => objects.delete(path));
      return { error: null };
    }),
  };
  return { objects, storage, client: { storage: { from: () => storage } } as unknown as SupabaseClient };
}

describe('account storage deletion (synthetic storage)', () => {
  it('deletes more than 1000 nested objects without skipping pages or other owners', async () => {
    const fixture = storageFixture([...Array.from({ length: 1101 }, (_, i) => `owner/nested/${i}.png`), 'other/keep.png']);
    await purgeUserStorage(fixture.client, 'user-images', 'owner');
    expect([...fixture.objects]).toEqual(['other/keep.png']);
    await purgeUserStorage(fixture.client, 'user-images', 'owner');
    expect([...fixture.objects]).toEqual(['other/keep.png']);
  });
  it.each(['list', 'remove'] as const)('surfaces %s failures for retry', async failure => {
    const fixture = storageFixture(['owner/a.png'], failure);
    await expect(purgeUserStorage(fixture.client, 'user-images', 'owner')).rejects.toThrow(`storage_${failure}_failed`);
    expect(fixture.objects.size).toBe(1);
  });
});
