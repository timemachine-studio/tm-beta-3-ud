import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { isRegistryToolActive } from './toolRegistryService';

describe('registry execution status', () => {
  it('matches both row id and digest and allows only a visible published row', async () => {
    const query = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'row-1' }, error: null }),
    };
    const client = { from: vi.fn().mockReturnValue(query) } as unknown as SupabaseClient;
    expect(await isRegistryToolActive('row-1', 'sha256:abc', client)).toBe(true);
    expect(query.eq).toHaveBeenCalledWith('id', 'row-1');
    expect(query.eq).toHaveBeenCalledWith('digest', 'sha256:abc');
  });

  it('fails closed when revocation hides the row or the registry is unavailable', async () => {
    const absent = { from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }) } as unknown as SupabaseClient;
    expect(await isRegistryToolActive('row-1', 'sha256:abc', absent)).toBe(false);

    const unavailable = { from: vi.fn().mockImplementation(() => { throw new Error('offline'); }) } as unknown as SupabaseClient;
    expect(await isRegistryToolActive('row-1', 'sha256:abc', unavailable)).toBe(false);
  });
});
