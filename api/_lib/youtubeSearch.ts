export interface YouTubeVideoResult {
  videoId: string;
  title: string;
  author: string;
  thumbnail: string;
  seconds: number;
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function textFrom(value: unknown): string {
  if (!isObject(value)) return '';
  if (typeof value.simpleText === 'string') return value.simpleText.trim();
  if (typeof value.content === 'string') return value.content.trim();
  if (!Array.isArray(value.runs)) return '';
  return value.runs
    .map((run) => isObject(run) && typeof run.text === 'string' ? run.text : '')
    .join('')
    .trim();
}

function secondsFrom(timestamp: string): number {
  if (!timestamp) return 0;
  const parts = timestamp.split(':').map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return 0;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

function extractAssignedJson(html: string, variable: string): unknown {
  const marker = html.indexOf(variable);
  if (marker < 0) throw new Error(`YouTube response did not contain ${variable}`);
  const start = html.indexOf('{', marker + variable.length);
  if (start < 0) throw new Error(`YouTube response contained no ${variable} object`);

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < html.length; index += 1) {
    const char = html[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}' && --depth === 0) return JSON.parse(html.slice(start, index + 1));
  }
  throw new Error(`YouTube response contained incomplete ${variable} JSON`);
}

function findVideoRenderers(root: unknown): JsonObject[] {
  const found: JsonObject[] = [];
  const stack: unknown[] = [root];
  while (stack.length > 0) {
    const value = stack.pop();
    if (Array.isArray(value)) {
      stack.push(...value);
      continue;
    }
    if (!isObject(value)) continue;
    if (isObject(value.videoRenderer)) found.push(value.videoRenderer);
    stack.push(...Object.values(value));
  }
  return found;
}

export function parseYouTubeSearchHtml(html: string, limit = 10): YouTubeVideoResult[] {
  const initialData = extractAssignedJson(html, 'ytInitialData');
  const seen = new Set<string>();
  const results: YouTubeVideoResult[] = [];

  for (const renderer of findVideoRenderers(initialData)) {
    const videoId = typeof renderer.videoId === 'string' ? renderer.videoId : '';
    const title = textFrom(renderer.title);
    if (!videoId || !title || seen.has(videoId)) continue;

    const thumbnails = isObject(renderer.thumbnail) && Array.isArray(renderer.thumbnail.thumbnails)
      ? renderer.thumbnail.thumbnails
      : [];
    const lastThumbnail = thumbnails[thumbnails.length - 1];
    const thumbnail = isObject(lastThumbnail) && typeof lastThumbnail.url === 'string'
      ? lastThumbnail.url
      : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    const timestamp = textFrom(renderer.lengthText);

    seen.add(videoId);
    results.push({
      videoId,
      title,
      author: textFrom(renderer.shortBylineText) || textFrom(renderer.ownerText) || 'YouTube',
      thumbnail,
      seconds: secondsFrom(timestamp),
    });
    if (results.length >= limit) break;
  }
  return results;
}

export async function searchYouTubeVideos(
  query: string,
  limit = 10,
  fetchImpl: typeof fetch = fetch,
): Promise<YouTubeVideoResult[]> {
  const url = new URL('https://www.youtube.com/results');
  url.searchParams.set('search_query', query);
  url.searchParams.set('hl', 'en');
  url.searchParams.set('gl', 'US');
  const response = await fetchImpl(url, {
    headers: {
      accept: 'text/html',
      'accept-language': 'en-US,en;q=0.9',
      'user-agent': 'Mozilla/5.0 (compatible; TimeMachineChat/1.0)',
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`YouTube search returned HTTP ${response.status}`);
  return parseYouTubeSearchHtml(await response.text(), limit);
}
