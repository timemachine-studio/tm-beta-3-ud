import { beforeEach, expect, it, vi } from 'vitest';
import { ChatService, type ChatSession } from './chatService';
import { CHAT_COVER_VERSION, findWikipediaCover, requestChatTitle } from './chatTitleService';
import { readCard, writeCard, type ChatCardMeta } from './chatCards';

vi.mock('./chatTitleService', async importOriginal => ({
  ...await importOriginal<typeof import('./chatTitleService')>(),
  requestChatTitle: vi.fn(),
  findWikipediaCover: vi.fn().mockResolvedValue(null),
}));
vi.mock('./chatCards', () => ({
  deleteCard: vi.fn(), listCards: vi.fn(), readCard: vi.fn(), writeCard: vi.fn().mockResolvedValue(null),
}));

const sample = (): ChatSession => ({
  id: '11111111-1111-4111-8111-111111111111', name: 'Explain mushrooms', persona: 'default',
  createdAt: '2026-08-01T12:00:00Z', lastModified: '2026-08-01T12:00:00Z',
  messages: [
    { id: '22222222-2222-4222-8222-222222222222', content: 'Explain mushrooms', isAI: false },
    { id: '33333333-3333-4333-8333-333333333333', content: 'Mushrooms are fungi.', isAI: true, status: 'complete' },
  ],
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readCard).mockResolvedValue(null);
  vi.mocked(findWikipediaCover).mockResolvedValue(null);
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  });
});

const previousMiss = (): ChatCardMeta => ({
  chatId: sample().id, subject: null, cover: null, coverLookedUp: true,
  namedAt: '2026-09-17T00:00:00Z', updatedAt: '2026-09-17T00:00:00Z', pinned: false,
});

it('automatically obtains a cover for an already-named chat without renaming it', async () => {
  const service = new ChatService();
  const session = { ...sample(), name: 'My Handpicked Title' };
  await service.saveSession(session);
  vi.mocked(requestChatTitle).mockResolvedValue({ title: 'Automatic Name', subject: 'Chanterelle' });
  await service.ensureChatCover(session);
  expect(findWikipediaCover).toHaveBeenCalledWith('Chanterelle', undefined, expect.any(Array));
  expect((await service.getSessions())[0].name).toBe('My Handpicked Title');
});

it('reconsiders no-image results cached under the original restrictive rules', async () => {
  const service = new ChatService();
  vi.mocked(readCard).mockResolvedValue(previousMiss());
  vi.mocked(requestChatTitle).mockResolvedValue({ title: 'Mushrooms', subject: 'Chanterelle' });
  await service.ensureChatCover(sample());
  expect(findWikipediaCover).toHaveBeenCalledWith('Chanterelle', undefined, expect.any(Array));
  expect(writeCard).toHaveBeenCalledWith(sample().id, expect.objectContaining({ coverVersion: CHAT_COVER_VERSION }));
});

it('remembers a current no-subject decision instead of choosing an unrelated image', async () => {
  const service = new ChatService();
  vi.mocked(readCard).mockResolvedValue({ ...previousMiss(), coverVersion: CHAT_COVER_VERSION });
  await service.ensureChatCover(sample());
  expect(requestChatTitle).not.toHaveBeenCalled();
  expect(findWikipediaCover).not.toHaveBeenCalled();
});

it('retries a failed image request without calling the topic model again', async () => {
  const service = new ChatService();
  vi.mocked(readCard).mockResolvedValue({ ...previousMiss(), subject: 'Chanterelle', coverVersion: CHAT_COVER_VERSION, coverLookedUp: false });
  await service.ensureChatCover(sample());
  expect(requestChatTitle).not.toHaveBeenCalled();
  expect(findWikipediaCover).toHaveBeenCalledWith('Chanterelle', undefined, expect.any(Array));
});

it('deduplicates simultaneous cover requests', async () => {
  const service = new ChatService();
  vi.mocked(requestChatTitle).mockResolvedValue({ title: 'Mushrooms', subject: 'Chanterelle' });
  await Promise.all([service.ensureChatCover(sample()), service.ensureChatCover(sample())]);
  expect(requestChatTitle).toHaveBeenCalledTimes(1);
  expect(findWikipediaCover).toHaveBeenCalledTimes(1);
});

it('keeps a manual name when a later message snapshot carries the old name', async () => {
  const service = new ChatService();
  await service.saveSession(sample());
  await service.renameSession(sample().id, 'My Fungi Notes');
  await service.saveSession(sample());
  expect((await service.getSessions())[0].name).toBe('My Fungi Notes');
});

it('does not let a late automatic title replace a manual rename', async () => {
  const service = new ChatService();
  await service.saveSession(sample());
  let finish!: (result: { title: string; subject: null }) => void;
  vi.mocked(requestChatTitle).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const naming = service.nameChat(sample());
  await service.renameSession(sample().id, 'Handpicked Title');
  finish({ title: 'Automatic Title', subject: null });
  expect(await naming).toBeNull();
  expect((await service.getSessions())[0].name).toBe('Handpicked Title');
});

it('deduplicates naming and preserves the result across later saves', async () => {
  const service = new ChatService();
  await service.saveSession(sample());
  vi.mocked(requestChatTitle).mockResolvedValue({ title: 'Mushroom Basics', subject: null });
  await Promise.all([service.nameChat(sample()), service.nameChat(sample())]);
  expect(requestChatTitle).toHaveBeenCalledTimes(1);
  await service.saveSession(sample());
  expect((await service.getSessions())[0].name).toBe('Mushroom Basics');
});

it('does not report a title as saved when the chat is absent', async () => {
  const service = new ChatService();
  vi.mocked(requestChatTitle).mockResolvedValue({ title: 'Mushroom Basics', subject: null });
  expect(await service.nameChat(sample())).toBeNull();
});

it('discards title requests after account changes', async () => {
  const service = new ChatService();
  await service.saveSession(sample());
  let finish!: (result: { title: string; subject: null }) => void;
  vi.mocked(requestChatTitle).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const naming = service.nameChat(sample());
  service.setUserId('another-user');
  finish({ title: 'Late Title', subject: null });
  expect(await naming).toBeNull();
});
