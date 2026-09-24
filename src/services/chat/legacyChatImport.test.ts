import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({ supabase: { from: mocks.from } }));

import { getSupabaseSessions } from './chatService';

describe('legacy cloud history import', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mocks.from.mockReset();
  });

  it('does not treat a failed message read as an empty conversation', async () => {
    const session = {
      id: 'legacy-session',
      user_id: 'account-1',
      name: 'Important conversation',
      persona: 'default',
      created_at: '2026-09-20T00:00:00.000Z',
      updated_at: '2026-09-21T00:00:00.000Z',
    };
    const order = vi.fn()
      .mockResolvedValueOnce({ data: [session], error: null })
      .mockResolvedValueOnce({ data: null, error: new Error('message_read_failed') });
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order };
    mocks.from.mockReturnValue(query);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(getSupabaseSessions('account-1', true)).rejects.toThrow('message_read_failed');
    expect(mocks.from).toHaveBeenCalledWith('chat_messages');
  });
});
