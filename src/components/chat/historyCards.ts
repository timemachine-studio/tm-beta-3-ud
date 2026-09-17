/**
 * The pure parts of the history page: what a card says, in what order the
 * cards come, and which ones a filter or a search keeps.
 */

import type { ChatSession } from '../../services/chat/chatService';
import type { ChatCardMeta, ChatCover } from '../../services/chat/chatCards';
import { CHAT_COVER_VERSION, isCardBoilerplate } from '../../services/chat/chatTitleService';
import { stripHarnessMarkers } from '../../types/chat';

export type HistoryFilter = 'all' | 'default' | 'girlie' | 'pro' | 'group';

export interface GroupChatItem {
  id: string;
  name: string;
  persona: string;
  owner_nickname: string;
  updated_at: string;
  participant_count: number;
}

export interface HistoryItem {
  id: string;
  kind: 'chat' | 'group';
  title: string;
  /** The first answer's opening, as plain text; the prompt when there is none. */
  preview: string;
  updatedAt: string;
  persona: string;
  pinned: boolean;
  cover: ChatCover | null;
  /** The picture is the card, with the title over it. */
  bleed: boolean;
  session?: ChatSession;
  group?: GroupChatItem;
}

const PREVIEW_CHARS = 240;

/** Markdown and the app's own markers, flattened to the words a card can show. */
export function plainPreview(content: string): string {
  return stripHarnessMarkers(content)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_~`]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, PREVIEW_CHARS);
}

/**
 * When the chat was last touched: the newest message's time. Not the
 * store's `updated_at` — renaming a chat (which the namer does to every old
 * chat) bumps that, and a chat from August must not surface as "1:14 PM"
 * because it was given a title today.
 */
export function lastTouched(session: ChatSession): string {
  let latest = '';
  for (const message of session.messages || []) {
    if (message.createdAt && message.createdAt > latest) latest = message.createdAt;
  }
  return latest || session.lastModified || session.createdAt || '';
}

export function previewOf(session: ChatSession): string {
  const messages = session.messages || [];
  const firstUser = messages.findIndex(message => !message.isAI && message.content?.trim());
  const answer = firstUser === -1
    ? undefined
    : messages.slice(firstUser + 1).find(message => message.isAI && !isCardBoilerplate(message) && message.content?.trim() && message.status !== 'error');
  const source = answer?.content || (firstUser === -1 ? '' : messages[firstUser].content);
  return plainPreview(source || '');
}

/**
 * Whether a pictured card is drawn as the picture. Decided from the id so a
 * card does not change shape between visits: about one in three, which is
 * enough rhythm without the wall turning into a photo grid.
 */
export function bleedsFor(id: string): boolean {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return hash % 3 === 0;
}

export function itemsFrom(
  sessions: readonly ChatSession[],
  groups: readonly GroupChatItem[],
  cards: ReadonlyMap<string, ChatCardMeta>,
): HistoryItem[] {
  const items: HistoryItem[] = sessions.map(session => {
    const card = cards.get(session.id);
    const cover = card?.coverVersion === CHAT_COVER_VERSION ? card.cover : null;
    return {
      id: session.id,
      kind: 'chat',
      // A chat the namer has not reached yet wears its first message, markdown
      // and all; the card shows the words.
      title: plainPreview(session.name || '').slice(0, 80) || 'New Chat',
      preview: previewOf(session),
      updatedAt: lastTouched(session),
      persona: session.persona,
      pinned: card?.pinned ?? false,
      cover,
      bleed: !!cover && bleedsFor(session.id),
      session,
    };
  });
  for (const group of groups) {
    const card = cards.get(group.id);
    items.push({
      id: group.id,
      kind: 'group',
      title: group.name?.trim() || 'Untitled Group',
      preview: `${group.participant_count} ${group.participant_count === 1 ? 'person' : 'people'} · by ${group.owner_nickname}`,
      updatedAt: group.updated_at,
      persona: group.persona,
      pinned: card?.pinned ?? false,
      cover: null,
      bleed: false,
      group,
    });
  }
  return sortItems(items);
}

/** Pinned first, then most recently touched first. */
export function sortItems(items: readonly HistoryItem[]): HistoryItem[] {
  return [...items].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return (b.updatedAt || '').localeCompare(a.updatedAt || '');
  });
}

export function matchesFilter(item: HistoryItem, filter: HistoryFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'group') return item.kind === 'group';
  return item.kind === 'chat' && item.persona === filter;
}

/** Title, preview or any message carrying every word of the query. */
export function matchesQuery(item: HistoryItem, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = [
    item.title,
    item.preview,
    ...(item.session?.messages || []).map(message => message.content || ''),
  ].join('\n').toLowerCase();
  return terms.every(term => haystack.includes(term));
}

/**
 * When the chat was last touched, the way a person says it: the time for
 * today, "Yesterday", the weekday inside a week, the date beyond.
 */
export function whenLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const day = 24 * 60 * 60 * 1000;
  const since = startOfToday.getTime() - date.getTime();
  if (since <= 0) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (since <= day) return 'Yesterday';
  if (since <= 6 * day) return date.toLocaleDateString('en-US', { weekday: 'long' });
  if (date.getFullYear() === now.getFullYear()) return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
