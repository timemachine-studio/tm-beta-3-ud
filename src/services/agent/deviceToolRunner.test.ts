import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deviceToolStatus, runDeviceTool } from './deviceToolRunner';
import { chatService } from '../chat/chatService';
import { readNotes } from '../notes/notesRepository';

function installStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
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

const call = (name: string, args: unknown) => ({ id: 'call-1', name, arguments: JSON.stringify(args) });

describe('runDeviceTool', () => {
  beforeEach(() => {
    installStorage();
    chatService.setUserId(null);
  });

  it('saves a note and hands back a card for the chat to render', async () => {
    const outcome = await runDeviceTool(call('notes_create', { title: 'Assignment', markdown: '# Jobs\n\nbody' }));

    expect(outcome.appObject).toMatchObject({ kind: 'note', title: 'Assignment', action: 'created' });
    expect(readNotes()).toHaveLength(1);
    // The note is already on screen; telling the model to paste it back would
    // duplicate the whole thing into the reply.
    expect(outcome.content).toContain('already shown to the user');
  });

  it('edits the same note instead of creating a second one', async () => {
    const created = await runDeviceTool(call('notes_create', { title: 'Draft', markdown: 'long intro' }));
    const noteId = created.appObject!.id;

    const edited = await runDeviceTool({
      id: 'call-2',
      name: 'notes_edit',
      arguments: JSON.stringify({ note_id: noteId, title: '', markdown: 'short intro', mode: 'replace' }),
    });

    expect(edited.appObject).toMatchObject({ id: noteId, action: 'updated' });
    expect(readNotes()).toHaveLength(1);
  });

  it('tells the model to ask before replacing a note it cannot find', async () => {
    const outcome = await runDeviceTool(call('notes_edit', { note_id: 'gone', markdown: 'x', mode: 'replace' }));
    expect(outcome.appObject).toBeUndefined();
    expect(outcome.content).toContain('without asking the user');
  });

  it('reports an empty history rather than letting the model invent one', async () => {
    const outcome = await runDeviceTool(call('chats_search', { query: 'jobs', after: '', before: '', limit: 5 }));
    expect(outcome.content).toContain('could not find it');
  });

  it('reads a past conversation and points at the next page', async () => {
    installStorage({
      chatSessions: JSON.stringify([{
        id: 'c1',
        name: 'Old chat',
        persona: 'default',
        createdAt: '2026-08-01T00:00:00.000Z',
        lastModified: '2026-08-01T00:00:00.000Z',
        messages: Array.from({ length: 15 }, (_, index) => ({
          id: `m${index}`, content: `message ${index}`, isAI: index % 2 === 1,
        })),
      }]),
    });

    // The page size is fixed by the executor, not asked of the model: the
    // result is replayed into every later leg, so its size is not the model's
    // to choose.
    const outcome = await runDeviceTool(call('chats_read', { chat_id: 'c1', offset: 0 }));
    expect(outcome.content).toContain('message 0');
    expect(outcome.content).toContain('message 11');
    expect(outcome.content).not.toContain('message 12');
    expect(outcome.content).toContain('offset 12');
    // Read history is a record of a conversation, not established fact.
    expect(outcome.content).toContain('not as verified fact');
  });

  it('ignores a date bound the model did not format as a date', async () => {
    const search = vi.spyOn(chatService, 'searchChats').mockResolvedValue([]);
    await runDeviceTool(call('chats_search', { query: 'x', after: 'last month', before: '2026-09-01', limit: 5 }));

    expect(search).toHaveBeenCalledWith('x', expect.objectContaining({ after: undefined, before: '2026-09-01' }));
    search.mockRestore();
  });

  it('asks the model to retry when it sends malformed arguments', async () => {
    const outcome = await runDeviceTool({ id: 'c', name: 'notes_read', arguments: '{not json' });
    expect(outcome.content).toContain('not valid JSON');
  });

  it('refuses a tool name it does not implement', async () => {
    const outcome = await runDeviceTool(call('notes_delete_everything', {}));
    expect(outcome.content).toContain('not a tool this app can run');
  });

  it('turns a storage failure into something the user will be told about', async () => {
    installStorage();
    Object.defineProperty(globalThis.localStorage, 'setItem', {
      value: () => { throw new DOMException('full', 'QuotaExceededError'); },
    });

    const outcome = await runDeviceTool(call('notes_create', { title: 'Doomed', markdown: 'body' }));
    expect(outcome.appObject).toBeUndefined();
    expect(outcome.content).toContain('not saved');
  });

  it('names the app being touched so the shimmer says something true', async () => {
    const onStatus = vi.fn();
    await runDeviceTool(call('notes_search', { query: '', limit: 5 }), { onStatus });
    expect(onStatus).toHaveBeenCalledWith('Looking through your notes');
    expect(deviceToolStatus('chats_read')).toBe('Reading an earlier conversation');
  });
});
