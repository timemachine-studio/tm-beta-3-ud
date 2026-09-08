// Web search, provider chain: Tavily → SearXNG → Exa.
//
// This replaced a call to Pollinations' `perplexity-fast` text model, which was
// not a search API at all: every lookup paid for a whole LLM-written answer,
// and what came back was opaque prose with no URLs to cite. A search API
// returns snippets and links, and the model we are already paying for does the
// synthesis. The chain exists because each free tier is small; a 429 on the
// first provider should degrade to the next, not to a failed turn.

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export type WebSearchProvider = 'tavily' | 'searxng' | 'exa';

export interface WebSearchResponse {
  results: WebSearchResult[];
  provider: WebSearchProvider;
}

const TAVILY_API_KEY = (process.env.TAVILY_API_KEY || '').trim();
const EXA_API_KEY = (process.env.EXA_API_KEY || '').trim();

/** Operator-configured SearXNG instances, tried in order. */
function searxngBases(): string[] {
  return (process.env.SEARXNG_URL || '')
    .split(',')
    .map((raw) => raw.trim())
    .filter(Boolean)
    .filter((raw) => {
      // Env-supplied, but it still ends up in a server-side fetch — settle the
      // scheme here rather than trusting the deploy to have typed it right.
      try {
        const { protocol } = new URL(raw);
        return protocol === 'https:' || protocol === 'http:';
      } catch {
        return false;
      }
    })
    .map((raw) => raw.replace(/\/+$/, ''));
}

const REQUEST_TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

/** Drop entries without an absolute http(s) URL, then cap. */
function normalise(
  raw: Array<{ title?: unknown; url?: unknown; snippet?: unknown }>,
  maxResults: number,
): WebSearchResult[] {
  const out: WebSearchResult[] = [];
  for (const item of raw) {
    const url = clean(item.url);
    if (!/^https?:\/\//i.test(url)) continue;
    out.push({
      title: clean(item.title) || url,
      url,
      snippet: clean(item.snippet).slice(0, 600),
    });
    if (out.length >= maxResults) break;
  }
  return out;
}

async function searchTavily(query: string, maxResults: number): Promise<WebSearchResult[]> {
  if (!TAVILY_API_KEY) return [];
  const response = await fetchWithTimeout('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TAVILY_API_KEY}`,
    },
    // search_depth 'basic' is 1 credit; 'advanced' is 2. include_answer is
    // deliberately off — an LLM-written answer is the expensive thing we left.
    body: JSON.stringify({
      query,
      max_results: maxResults,
      search_depth: 'basic',
      include_answer: false,
      include_raw_content: false,
    }),
  });
  if (!response.ok) throw new Error(`Tavily ${response.status}`);
  const data = (await response.json()) as { results?: Array<Record<string, unknown>> };
  return normalise(
    (data.results || []).map((r) => ({ title: r.title, url: r.url, snippet: r.content })),
    maxResults,
  );
}

async function searchSearxng(query: string, maxResults: number): Promise<WebSearchResult[]> {
  for (const base of searxngBases()) {
    try {
      const url = `${base}/search?q=${encodeURIComponent(query)}&format=json&language=en&safesearch=1`;
      const response = await fetchWithTimeout(url, {
        headers: { Accept: 'application/json' },
      });
      // Most public instances answer 403 here: `format=json` is off by default
      // upstream, so a self-hosted instance is the only dependable one.
      if (!response.ok) continue;
      const data = (await response.json()) as { results?: Array<Record<string, unknown>> };
      const results = normalise(
        (data.results || []).map((r) => ({ title: r.title, url: r.url, snippet: r.content })),
        maxResults,
      );
      if (results.length) return results;
    } catch {
      // Try the next instance rather than failing the whole chain.
    }
  }
  return [];
}

async function searchExa(query: string, maxResults: number): Promise<WebSearchResult[]> {
  if (!EXA_API_KEY) return [];
  const response = await fetchWithTimeout('https://api.exa.ai/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': EXA_API_KEY,
    },
    body: JSON.stringify({
      query,
      numResults: maxResults,
      type: 'auto',
      contents: { text: { maxCharacters: 500 } },
    }),
  });
  if (!response.ok) throw new Error(`Exa ${response.status}`);
  const data = (await response.json()) as { results?: Array<Record<string, unknown>> };
  return normalise(
    (data.results || []).map((r) => ({ title: r.title, url: r.url, snippet: r.text })),
    maxResults,
  );
}

/**
 * Run a search, falling through the chain on failure or an empty result.
 *
 * Throws only when every provider is exhausted, so callers get one error to
 * handle rather than three.
 */
export async function runWebSearch(
  query: string,
  maxResults = 6,
): Promise<WebSearchResponse> {
  const chain: Array<[WebSearchProvider, (q: string, n: number) => Promise<WebSearchResult[]>]> = [
    ['tavily', searchTavily],
    ['searxng', searchSearxng],
    ['exa', searchExa],
  ];

  const failures: string[] = [];
  for (const [provider, run] of chain) {
    try {
      const results = await run(query, maxResults);
      if (results.length) return { results, provider };
      failures.push(`${provider}: no results`);
    } catch (error) {
      // The query itself is not logged — see the logging rule in CLAUDE.md.
      failures.push(`${provider}: ${error instanceof Error ? error.message : 'failed'}`);
    }
  }

  console.error('Web search: every provider failed —', failures.join('; '));
  throw new Error('No search provider returned results');
}

/** Render results as the numbered, citable block the model reads. */
export function formatResultsForModel(response: WebSearchResponse): string {
  const lines = response.results.map(
    (r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet || '(no snippet)'}`,
  );
  return [
    `Web search results (${response.provider}):`,
    '',
    lines.join('\n\n'),
    '',
    'Answer from these results and cite the sources you used by their URL. If they do not cover the question, say so rather than filling the gap from memory.',
  ].join('\n');
}
