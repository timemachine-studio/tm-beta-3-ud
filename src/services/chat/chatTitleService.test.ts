import { afterEach, expect, it, vi } from 'vitest';
import { CHAT_COVER_VERSION, coverContext, findWikipediaCover, needsChatCover, openingExchange } from './chatTitleService';
import type { ChatCardMeta } from './chatCards';

vi.mock('../../lib/supabase', () => ({ supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } } }));
afterEach(() => vi.unstubAllGlobals());

const page = (title: string, image: string, index = 1) => ({
  index, title, pageimage: image, extract: 'Article description',
  thumbnail: { source: 'https://upload.wikimedia.org/' + image, width: 800, height: 600 },
});
function responses(pages: unknown[], decision: unknown) {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ query: { pages } })))
    .mockResolvedValueOnce(new Response(JSON.stringify(decision)));
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}

it('requires a confident contextual match rather than the first image returned', async () => {
  const fetcher = responses([page('Training exercise', 'Soldiers_in_woods.jpg'), page('Winter forest', 'Snowy_forest.jpg', 2)], { candidateId: 'candidate-1', confidence: 0.95 });
  const context = [{ role: 'user' as const, content: 'A fictional plane crash in a snowy forest' }];
  expect((await findWikipediaCover('Snowy forest', undefined, context))?.pageTitle).toBe('Winter forest');
  const request = JSON.parse(fetcher.mock.calls[1][1].body);
  expect(request.messages).toEqual(context);
  expect(request.candidates[0].imageName).toBe('Soldiers_in_woods.jpg');
});

it('keeps the card text-only when all images are rejected or confidence is low', async () => {
  responses([page('Survival', 'Soldiers_training.jpg')], { candidateId: null, confidence: 0.95 });
  expect(await findWikipediaCover('Winter plane crash')).toBeNull();
  responses([page('Survival', 'Soldiers_training.jpg')], { candidateId: 'candidate-0', confidence: 0.5 });
  expect(await findWikipediaCover('Winter plane crash')).toBeNull();
});

it('excludes clinical scans, generic diagrams and logos before model review', async () => {
  const fetcher = responses([page('Cancer', 'CT_scan.jpg'), page('Design', 'Linux_architecture_diagram.svg'), page('CMS', 'WordPress_logo.png')], {});
  expect(await findWikipediaCover('Cinematic website')).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('never accepts an invented candidate identifier', async () => {
  responses([page('Dhaka', 'Dhaka_skyline.jpg')], { candidateId: 'candidate-4', confidence: 1 });
  expect(await findWikipediaCover('Dhaka')).toBeNull();
});

it('does not permanently cache an unavailable relevance check as a miss', async () => {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ query: { pages: [page('Dhaka', 'Dhaka_skyline.jpg')] } })))
    .mockResolvedValueOnce(new Response('', { status: 503 })));
  await expect(findWikipediaCover('Dhaka')).rejects.toThrow('Cover relevance check unavailable');
});

it('removes PRO boilerplate even when stored after the user or under an old UUID', () => {
  const messages = [
    { id: 'old-welcome', isAI: true, content: "From future. Let's cure cancer." },
    { id: 'user', isAI: false, content: 'Hello there' },
    { id: 'wrong-order-welcome', isAI: true, content: "From future. Let’s cure cancer." },
  ];
  expect(coverContext(messages)).toEqual([{ role: 'user', content: 'Hello there' }]);
  expect(openingExchange(messages)).toBeNull();
});

it('reassesses previously accepted images, not only misses', () => {
  const card = { cover: { url: 'old-image' }, coverVersion: CHAT_COVER_VERSION - 1, coverLookedUp: true } as ChatCardMeta;
  expect(needsChatCover(card)).toBe(true);
  expect(needsChatCover({ ...card, coverVersion: CHAT_COVER_VERSION })).toBe(false);
});
