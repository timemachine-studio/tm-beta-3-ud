import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatService, type ChatSession } from './chatService';

const session: ChatSession = {
  id: 'device-only-test',
  name: 'Device only',
  persona: 'default',
  createdAt: '2026-09-23T00:00:00.000Z',
  lastModified: '2026-09-23T00:00:00.000Z',
  messages: [{ id: 'message-1', content: 'Keep this local', isAI: false }],
};

describe('signed-in chat storage policy', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('fails closed when the device database is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const service = new ChatService();
    service.setUserId('account-1');

    await expect(service.getSessions()).rejects.toThrow('device_history_unavailable');
    await expect(service.saveSession(session)).rejects.toThrow('device_history_unavailable');
    await expect(service.renameSession(session.id, 'Renamed')).rejects.toThrow('device_history_unavailable');
    await expect(service.deleteSession(session.id)).rejects.toThrow('device_history_unavailable');
    await expect(service.listChats()).rejects.toThrow('device_history_unavailable');
    await expect(service.searchChats('local')).rejects.toThrow('device_history_unavailable');
    await expect(service.readChat(session.id)).rejects.toThrow('device_history_unavailable');
    await expect(service.hasArchive()).rejects.toThrow('device_history_unavailable');
  });
});
