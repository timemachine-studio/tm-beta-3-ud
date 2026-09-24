import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEVICE_TOOL_DESCRIPTORS, deviceToolsFor } from '../../../shared/deviceTools';
import { runDeviceTool } from './deviceToolRunner';
import { chatService } from '../chat/chatService';
import { readNote, readNotes } from '../notes/notesRepository';
import { clearTimersForTests, readTimer } from '../timer/timerRepository';
import { beginRun, clearRunLedgerForTests, readRun, recordRunEvent, settleRun } from './runLedger';
import { messageContentForModel } from '../ai/aiProxyService';

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}));

function installStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
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

const call = (id: string, name: string, args: unknown) => ({ id, name, arguments: JSON.stringify(args) });

describe('ordinary-person golden journeys', () => {
  beforeEach(async () => {
    installStorage();
    chatService.setUserId(null);
    await clearTimersForTests();
    await clearRunLedgerForTests();
  });

  it('keeps one capability contract aligned with every built-in device adapter', () => {
    for (const descriptor of DEVICE_TOOL_DESCRIPTORS.filter(item => item.origin === 'builtin' && item.name !== 'create_tool')) {
      expect(descriptor.capability, descriptor.name).toBeDefined();
      expect(descriptor.capability?.name).toBe(descriptor.name);
      expect(descriptor.capability?.inputSchema).toEqual(descriptor.definition.function.parameters);
      expect(descriptor.capability?.runtime).toBe('browser');
    }
    expect(deviceToolsFor(['timer'], [])?.map(tool => tool.function.name)).toContain('timer_start');
  });

  it('starts a real persisted timer, then pauses and resumes the same timer', async () => {
    const started = await runDeviceTool(call('t1', 'timer_start', { amount: 2, unit: 'minutes', label: 'Tea' }));
    expect(started.appObject).toMatchObject({ kind: 'timer', title: 'Tea', status: 'running' });
    const id = started.appObject!.id;
    expect((await readTimer(id))?.deadlineAt).toBeTruthy();

    const paused = await runDeviceTool(call('t2', 'timer_control', { timer_id: id, action: 'pause' }));
    expect(paused.appObject).toMatchObject({ id, status: 'paused' });
    expect((await readTimer(id))?.deadlineAt).toBeNull();

    const resumed = await runDeviceTool(call('t3', 'timer_control', { timer_id: id, action: 'resume' }));
    expect(resumed.appObject).toMatchObject({ id, status: 'running' });
    expect((await readTimer(id))?.deadlineAt).toBeTruthy();
  });

  it('searches an earlier chat, creates one sourced note, and edits that exact note later', async () => {
    installStorage({
      chatSessions: JSON.stringify([{
        id: 'jobs-chat', name: 'Jobs and Musk', persona: 'default',
        createdAt: '2026-08-10T10:00:00.000Z', lastModified: '2026-08-10T10:05:00.000Z',
        messages: [
          { id: 'm1', content: 'Compare Steve Jobs and Elon Musk', isAI: false, createdAt: '2026-08-10T10:00:00.000Z' },
          { id: 'm2', content: 'They are technology leaders with different styles.', isAI: true, createdAt: '2026-08-10T10:01:00.000Z' },
        ],
      }]),
    });
    chatService.setUserId(null);

    const search = await runDeviceTool(call('c1', 'chats_search', { query: 'Jobs Musk', after: '', before: '' }));
    expect(search.content).toContain('jobs-chat');
    const read = await runDeviceTool(call('c2', 'chats_read', { chat_id: 'jobs-chat', offset: 0 }));
    expect(read.content).toContain('different styles');

    const created = await runDeviceTool(call('c3', 'notes_create', {
      title: 'Jobs and Musk assignment',
      markdown: '# Jobs and Musk\n\nA long introduction.\n\nThey shaped technology differently.',
      source_chat_ids: ['jobs-chat'],
    }), { runId: 'user-turn-1' });
    expect(created.appObject).toMatchObject({ kind: 'note', action: 'created', sourceChatIds: ['jobs-chat'] });
    const noteId = created.appObject!.id;

    // A network retry of the same user turn receives the existing receipt.
    const retried = await runDeviceTool(call('c4', 'notes_create', {
      title: 'Jobs and Musk assignment', markdown: 'duplicate', source_chat_ids: ['jobs-chat'],
    }), { runId: 'user-turn-1' });
    expect(retried.appObject).toMatchObject({ id: noteId, action: 'reused' });
    expect(readNotes()).toHaveLength(1);

    const context = messageContentForModel({
      id: 'a1', content: 'I saved the assignment.', isAI: true,
      appObjects: [created.appObject!],
    });
    expect(context).toContain(`note id=${JSON.stringify(noteId)}`);
    expect(context).toContain('jobs-chat');

    await runDeviceTool(call('c5', 'notes_edit', {
      note_id: noteId, title: '', markdown: '# Jobs and Musk\n\nShort introduction.\n\nThey shaped technology differently.', mode: 'replace',
    }));
    expect(readNotes()).toHaveLength(1);
    expect(readNote(noteId)?.markdown).toContain('Short introduction.');
    expect(readNotes()[0].version).toBe(2);
  });

  it('persists a truthful ordered run lifecycle', async () => {
    await beginRun({ id: 'run-1', sessionId: 'chat-1', assistantMessageId: 'answer-1' });
    await recordRunEvent('run-1', 'discovering', 'Looking for a tool');
    await recordRunEvent('run-1', 'executing', 'Starting your timer', 'timer_start');
    await recordRunEvent('run-1', 'verifying', 'Timer started', 'timer_start');
    await settleRun('run-1', 'completed', 'Completed');
    const run = await readRun('run-1');
    expect(run?.status).toBe('completed');
    expect(run?.events.map(event => event.status)).toEqual(['understanding', 'discovering', 'executing', 'verifying', 'completed']);
    expect(run?.events.map(event => event.sequence)).toEqual([1, 2, 3, 4, 5]);
  });
});

