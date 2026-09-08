import { supabase } from '../../lib/supabase';

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export class WebSearchError extends Error {}

/**
 * Search the web through our own endpoint.
 *
 * The Contour web module used to frame `google.com/search?q=...&igu=1`, which
 * Google no longer serves to embedders — it answers a bot-check redirect, and
 * every other major engine sends `X-Frame-Options` or `frame-ancestors`. There
 * is no framing workaround, so results are fetched and rendered by us instead.
 */
export async function searchWeb(query: string): Promise<WebSearchResult[]> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  // The endpoint is behind auth on purpose: the search providers' free tiers
  // are a shared monthly pool, not per user.
  if (!accessToken) throw new WebSearchError('Sign in to search the web');

  const response = await fetch(`/api/search?web=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new WebSearchError(
      response.status === 401
        ? 'Sign in to search the web'
        : 'Search is unavailable right now',
    );
  }

  const body = (await response.json()) as { results?: WebSearchResult[] };
  return body.results || [];
}
