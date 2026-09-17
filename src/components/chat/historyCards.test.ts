import { describe, expect, it } from 'vitest';
import { itemsFrom, lastTouched, matchesFilter, matchesQuery, plainPreview, previewOf } from './historyCards';
import type { ChatSession } from '../../services/chat/chatService';

const session: ChatSession = {
  id: 'chat', name: 'Mushroom Basics', persona: 'default',
  createdAt: '2026-08-01T12:00:00Z', lastModified: '2026-09-17T12:00:00Z',
  messages: [
    { id: 'user', content: 'Tell me about chanterelles', isAI: false, createdAt: '2026-08-01T12:00:00Z' },
    { id: 'answer', content: '**Chanterelles** grow in forests.', isAI: true, createdAt: '2026-08-01T12:01:00Z' },
  ],
};

describe('history cards', () => {
  it('does not use a persona greeting as the chat preview', () => {
    expect(previewOf({ ...session, messages: [
      { id: 'user', content: 'Hello there', isAI: false },
      { id: 'old-greeting', content: "From future. Let's cure cancer.", isAI: true },
    ] })).toBe('Hello there');
  });
  it('keeps a renamed old chat on the date of its last message', () => {
    expect(lastTouched(session)).toBe('2026-08-01T12:01:00Z');
  });
  it('falls back to the stored date for older messages without timestamps', () => {
    expect(lastTouched({ ...session, messages: [] })).toBe(session.lastModified);
  });
  it('searches message bodies and filters personas', () => {
    const [item] = itemsFrom([session], [], new Map());
    expect(matchesQuery(item, 'chanterelles forests')).toBe(true);
    expect(matchesQuery(item, 'chanterelles oceans')).toBe(false);
    expect(matchesFilter(item, 'default')).toBe(true);
    expect(matchesFilter(item, 'girlie')).toBe(false);
  });
  it('shows readable text without code, images or Markdown formatting', () => {
    expect(plainPreview('# A title\n**Bold** [link](https://example.com) ![image](x)\n```js\nsecret()\n```')).toBe('A title Bold link');
  });
});
