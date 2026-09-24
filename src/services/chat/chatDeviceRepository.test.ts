import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ChatSession } from './chatService';
import {
  chatWorkspace,
  clearChatDeviceRepositoryForTests,
  deleteDeviceSession,
  listDeviceSessions,
  readDeviceSession,
  readHistoryMeta,
  writeDeviceSession,
  writeHistoryMeta,
} from './chatDeviceRepository';

function session(id: string, content: string, lastModified = '2026-09-23T00:00:00.000Z'): ChatSession {
  return {
    id,
    name: content,
    persona: 'default',
    createdAt: '2026-09-22T00:00:00.000Z',
    lastModified,
    messages: [{ id: `${id}-message`, content, isAI: false }],
  };
}

describe('chatDeviceRepository', () => {
  beforeEach(async () => {
    await clearChatDeviceRepositoryForTests();
  });

  it('isolates the same chat id between account workspaces', async () => {
    const accountA = chatWorkspace('account-a');
    const accountB = chatWorkspace('account-b');
    await writeDeviceSession(accountA, session('shared-id', 'alpha'));
    await writeDeviceSession(accountB, session('shared-id', 'beta'));

    expect((await readDeviceSession(accountA, 'shared-id'))?.name).toBe('alpha');
    expect((await readDeviceSession(accountB, 'shared-id'))?.name).toBe('beta');
    expect(await listDeviceSessions(chatWorkspace(null))).toEqual([]);
  });

  it('orders by last modification and deletes only the requested session', async () => {
    const workspace = chatWorkspace(null);
    await writeDeviceSession(workspace, session('older', 'older', '2026-09-22T00:00:00.000Z'));
    await writeDeviceSession(workspace, session('newer', 'newer', '2026-09-23T00:00:00.000Z'));

    expect((await listDeviceSessions(workspace)).map(item => item.id)).toEqual(['newer', 'older']);
    await deleteDeviceSession(workspace, 'newer');
    expect((await listDeviceSessions(workspace)).map(item => item.id)).toEqual(['older']);
  });

  it('persists migration metadata separately from chat rows', async () => {
    await writeHistoryMeta('legacy-import', 'complete');
    expect(await readHistoryMeta('legacy-import')).toBe('complete');
    expect(await listDeviceSessions(chatWorkspace(null))).toEqual([]);
  });
});
