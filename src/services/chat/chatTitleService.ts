/**
 * Naming a chat, and finding it a picture.
 *
 * After the first answer lands the opening exchange goes to
 * `/api/ai-proxy?task=title`, which returns a short title and — when the
 * chat is about one concrete thing — that thing's name. The name is looked
 * up on Wikipedia from the browser, and the article's lead image becomes the
 * card's picture on the history page. Nothing is generated: the picture is
 * whatever the encyclopaedia already uses for that subject, credited to it.
 *
 * Wikipedia's API answers cross-origin with `origin=*`, so this needs no
 * serverless function of ours and no key, and the thumbnails come from
 * Wikimedia's own CDN.
 */

import { supabase } from '../../lib/supabase';
import type { Message } from '../../types/chat';
import type { ChatCardMeta, ChatCover } from './chatCards';
import { AI_PERSONAS } from '../../config/constants';
import { stripHarnessMarkers } from '../../types/chat';

export const CHAT_COVER_VERSION = 3;

export function needsChatCover(card: ChatCardMeta | null | undefined): boolean {
  return !card || card.coverVersion !== CHAT_COVER_VERSION || !card.coverLookedUp;
}

export type CardTurn = { role: 'user' | 'assistant'; content: string };
const normalise = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const greetings = new Set(Object.values(AI_PERSONAS).map(persona => normalise(persona.initialMessage)));

export function isCardBoilerplate(message: Message): boolean {
  return message.id === 'initial' || (message.isAI && greetings.has(normalise(message.content)));
}

/** Start at a real user turn, never at the persona's decorative greeting. */
export function coverContext(messages: readonly Message[]): CardTurn[] {
  const first = messages.findIndex(message => !message.isAI && hasWords(message.content));
  if (first < 0) return [];
  return messages.slice(first).filter(message => !isCardBoilerplate(message)
    && (!message.status || message.status === 'complete') && hasWords(message.content))
    .slice(0, 4).map(message => ({ role: message.isAI ? 'assistant' : 'user', content: stripHarnessMarkers(message.content).slice(0, 1500) }));
}

export interface ChatTitleResult {
  title: string;
  subject: string | null;
}

/** Longest opening exchange the namer is shown: the first prompt and the first answer. */
const OPENING_TURNS = 2;

/** A text a person could reasonably have typed to open a chat. */
function hasWords(content: string | undefined): content is string {
  return typeof content === 'string' && /[\p{L}\p{N}]/u.test(content);
}

/**
 * The opening exchange as the namer wants it, or null when there is nothing
 * to name yet: no user prompt, or no finished answer to it.
 */
export function openingExchange(messages: readonly Message[]): Array<{ role: 'user' | 'assistant'; content: string }> | null {
  const firstUser = messages.findIndex(message => !message.isAI && hasWords(message.content));
  if (firstUser === -1) return null;
  const turns: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const message of messages.slice(firstUser)) {
    if (isCardBoilerplate(message)) continue;
    if (message.isAI && message.status && message.status !== 'complete') return null;
    if (!hasWords(message.content)) continue;
    turns.push({ role: message.isAI ? 'assistant' : 'user', content: message.content });
    if (turns.length >= OPENING_TURNS) break;
  }
  return turns.some(turn => turn.role === 'assistant') ? turns : null;
}

/**
 * The name a chat gets before it has a real one: the opening words. The
 * title request replaces it; if that fails, this is what the card shows,
 * and it is what tells `useChat` a chat still needs naming.
 */
export function provisionalTitle(messages: readonly Message[]): string {
  const first = messages.find(message => !message.isAI);
  if (!first) return 'New Chat';
  if (hasWords(first.content) && first.content !== '[Image message]'
    && !first.content.startsWith('[PDF:') && !first.content.startsWith('[File:')) {
    return first.content.slice(0, 50);
  }
  if (first.imageData || (first.inputImageUrls && first.inputImageUrls.length > 0)) return 'Image message';
  if (first.pdfFileName) {
    return first.pdfFileName.toLowerCase().endsWith('.pdf') ? `PDF: ${first.pdfFileName}` : `File: ${first.pdfFileName}`;
  }
  return 'New Chat';
}

export async function requestChatTitle(
  exchange: Array<{ role: 'user' | 'assistant'; content: string }>,
  signal?: AbortSignal,
): Promise<ChatTitleResult | null> {
  const { data } = await supabase.auth.getSession();
  const response = await fetch('/api/ai-proxy?task=title', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
    },
    body: JSON.stringify({ messages: exchange.map(turn => ({ ...turn, content: turn.content.slice(0, 1500) })) }),
    signal: signal ?? AbortSignal.timeout(30_000),
  });
  if (!response.ok) return null;
  const body = await response.json() as Partial<ChatTitleResult>;
  if (typeof body.title !== 'string' || !body.title.trim()) return null;
  return { title: body.title.trim(), subject: typeof body.subject === 'string' && body.subject.trim() ? body.subject.trim() : null };
}

const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';
/** Wide enough for a two-column card on a 3× phone. */
const THUMB_WIDTH = 800;
/** A lead image narrower than this is an icon or a flag, not a picture. */
const MIN_THUMB_WIDTH = 120;

interface WikipediaPage {
  index?: number;
  title?: string;
  fullurl?: string;
  extract?: string;
  pageimage?: string;
  pageprops?: { disambiguation?: string };
  thumbnail?: { source?: string; width?: number; height?: number };
}

/**
 * The lead image of the Wikipedia article a subject names, sized for a
 * card. Null when the article has none worth showing, or is a
 * disambiguation page — a wrong picture is worse than no picture.
 */
export async function findWikipediaCover(subject: string, signal?: AbortSignal, context: CardTurn[] = [{ role: 'user', content: subject }]): Promise<ChatCover | null> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    origin: '*',
    generator: 'search',
    gsrsearch: subject,
    gsrlimit: '3',
    gsrnamespace: '0',
    prop: 'pageimages|info|pageprops|extracts',
    exintro: '1',
    explaintext: '1',
    exchars: '650',
    exlimit: '3',
    piprop: 'thumbnail|name',
    pilicense: 'any',
    pithumbsize: String(THUMB_WIDTH),
    inprop: 'url',
    ppprop: 'disambiguation',
  });
  const response = await fetch(`${WIKIPEDIA_API}?${params}`, { signal: signal ?? AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error('Cover lookup unavailable');
  const body = await response.json() as { query?: { pages?: WikipediaPage[] } };
  // Search results are not necessarily returned in rank order. A missing
  // lead image on the first article should not discard the other matches.
  const pages = [...(body.query?.pages ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const eligible = pages.filter(candidate => {
    const thumb = candidate.thumbnail;
    const imageName = (candidate.pageimage ?? '').replace(/[_-]/g, ' ');
    // Clinical scans and generic charts/logos are poor archive illustrations.
    // The semantic review below still checks the remaining pictures in context.
    const unsuitable = /\b(ct|mri|x ray|radiograph|computed tomography|histopathology|diagram|flowchart|schematic|logo|wordmark)\b/i.test(imageName);
    return !unsuitable && candidate.title && candidate.pageimage && candidate.pageprops?.disambiguation === undefined
      && thumb?.source && /^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(thumb.source)
      && (thumb.width ?? 0) >= MIN_THUMB_WIDTH && (thumb.height ?? 0) > 0;
  });
  if (!eligible.length) return null;
  const candidates = eligible.map((page, index) => ({
    id: `candidate-${index}`, title: page.title!.slice(0, 200),
    description: (page.extract ?? '').slice(0, 1000), imageName: page.pageimage!.slice(0, 300),
  }));
  const { data } = await supabase.auth.getSession();
  const review = await fetch('/api/ai-proxy?task=title', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {}) },
    body: JSON.stringify({ messages: context, candidates }),
    signal: signal ?? AbortSignal.timeout(30_000),
  });
  if (!review.ok) throw new Error('Cover relevance check unavailable');
  const decision = await review.json() as { candidateId?: unknown; confidence?: unknown };
  if (decision.candidateId === null) return null;
  if (typeof decision.confidence !== 'number' || decision.confidence < 0.85) return null;
  const selected = candidates.findIndex(candidate => candidate.id === decision.candidateId);
  const page = eligible[selected];
  if (!page?.thumbnail?.source || !page.title) return null;
  const { source, width = 0, height = 0 } = page.thumbnail;
  if (!/^https:\/\/upload\.wikimedia\.org\//.test(source) && !/^https:\/\/thumb\.wikimedia\.org\//.test(source)) return null;
  if (width < MIN_THUMB_WIDTH || height <= 0) return null;
  return {
    url: source,
    width,
    height,
    pageTitle: page.title,
    pageUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
  };
}
