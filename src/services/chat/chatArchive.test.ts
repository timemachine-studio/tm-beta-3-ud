import { beforeEach, describe, expect, it } from 'vitest';
import { escapeLike, listChatSummaries, readChatTranscript, searchChatArchive } from './chatArchive';

// Anonymous history lives in localStorage under `chatSessions`; the signed-in
// half of this module talks to Supabase and is covered by its own queries.
function seed(sessions: unknown[]) {
  const store = new Map<string, string>([['chatSessions', JSON.stringify(sessions)]]);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    } as Storage,
  });
}

const session = (id: string, name: string, when: string, texts: Array<[boolean, string]>) => ({
  id,
  name,
  persona: 'default',
  createdAt: when,
  lastModified: when,
  messages: texts.map(([isAI, content], index) => ({
    id: `${id}-m${index}`,
    createdAt: when,
    content,
    isAI,
  })),
});

describe('chat archive (device store)', () => {
  beforeEach(() => {
    seed([
      session('c1', 'Steve Jobs and Elon Musk', '2026-08-12T10:00:00.000Z', [
        [false, 'what did Jobs actually do at NeXT'],
        [true, 'He founded it after leaving Apple in 1985.'],
      ]),
      session('c2', 'Weekend plans', '2026-09-05T10:00:00.000Z', [
        [false, 'any ideas for saturday'],
        [true, 'A walk, maybe. Elon Musk was on the radio about it.'],
      ]),
      session('c3', 'Groceries', '2026-07-01T10:00:00.000Z', [[false, 'milk, eggs']]),
    ]);
  });

  it('lists chats newest first with their titles', async () => {
    const listed = await listChatSummaries(null, { limit: 10 });
    expect(listed.map(chat => chat.id)).toEqual(['c2', 'c1', 'c3']);
    expect(listed[1].title).toBe('Steve Jobs and Elon Musk');
    expect(listed[1].messageCount).toBe(2);
  });

  it('finds a conversation by message text, not only by title', async () => {
    // "Weekend plans" says nothing about Musk in its title — titles alone do
    // not satisfy the requirement, which is the whole reason search reads
    // message bodies.
    const hits = await searchChatArchive(null, 'musk', { limit: 10 });
    expect(hits.map(hit => hit.id).sort()).toEqual(['c1', 'c2']);
    expect(hits.find(hit => hit.id === 'c2')?.excerpt).toContain('Elon Musk');
  });

  it('honours a date window', async () => {
    const august = await searchChatArchive(null, 'musk', { after: '2026-08-01', before: '2026-09-01' });
    expect(august.map(hit => hit.id)).toEqual(['c1']);
  });

  it('excludes the conversation the user is already in', async () => {
    const hits = await searchChatArchive(null, 'musk', { excludeChatId: 'c2' });
    expect(hits.map(hit => hit.id)).toEqual(['c1']);
  });

  it('falls back to a recency listing when the query has no usable terms', async () => {
    const hits = await searchChatArchive(null, 'a of', { limit: 2 });
    expect(hits.map(hit => hit.id)).toEqual(['c2', 'c1']);
  });

  it('reads the actual messages of one chat, and pages the rest', async () => {
    const first = await readChatTranscript(null, 'c1', { offset: 0, limit: 1 });
    expect(first?.totalMessages).toBe(2);
    expect(first?.messages).toEqual([
      { role: 'user', content: 'what did Jobs actually do at NeXT', createdAt: '2026-08-12T10:00:00.000Z' },
    ]);

    const second = await readChatTranscript(null, 'c1', { offset: 1, limit: 1 });
    expect(second?.messages[0].role).toBe('assistant');
  });

  it('returns nothing for a chat that is not the user\'s', async () => {
    expect(await readChatTranscript(null, 'does-not-exist')).toBeNull();
  });

  it('caps the page size however large a limit is asked for', async () => {
    const listed = await listChatSummaries(null, { limit: 5_000 });
    expect(listed.length).toBeLessThanOrEqual(25);
  });
});

describe('escapeLike', () => {
  it('neutralises PostgREST filter syntax so a search stays a search', () => {
    // Unescaped, `%` is a wildcard and `,` ends the term — one search for
    // "50%,off" would become two filters, neither of them what was typed.
    expect(escapeLike('50%,off_now')).toBe('50\\%\\,off\\_now');
  });
});
