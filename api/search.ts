import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthenticatedRequestUser } from './_lib/auth.js';
import { applyCors, hasAcceptableOrigin } from './_lib/cors.js';
import yts from 'yt-search';
import { searchQuerySchema, webSearchQuerySchema, parseOrReject } from './_lib/validation.js';
import { runWebSearch } from './_lib/webSearch.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(req, res, 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!hasAcceptableOrigin(req)) return res.status(403).json({ error: 'Origin not allowed' });

  const user = await getAuthenticatedRequestUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in is required' });

  // ?web=<query> is the Contour web module; ?q=<query> stays YouTube/music.
  // Both live here rather than in a new function because Vercel's Hobby plan
  // caps a deployment at 12 serverless functions and we are at 11.
  if (typeof req.query.web === 'string') {
    const parsedWeb = parseOrReject(res, webSearchQuerySchema, { web: req.query.web });
    if (!parsedWeb) return;
    try {
      const { results, provider } = await runWebSearch(parsedWeb.web, 8);
      return res.status(200).json({ query: parsedWeb.web, provider, results });
    } catch {
      // runWebSearch already logged which providers failed.
      return res.status(503).json({ error: 'Search is unavailable right now' });
    }
  }

  const parsed = parseOrReject(res, searchQuerySchema, { q: req.query.q });
  if (!parsed) return;
  const query = parsed.q;

  try {
    // Search specifically for music/songs
    const r = await yts(query);
    const videos = r.videos.slice(0, 10);

    const tracks = videos.map((v) => ({
      id: v.videoId,
      title: v.title,
      artist: v.author.name,
      thumbnail: v.thumbnail,
      duration: v.seconds,
    }));

    return res.status(200).json({ items: tracks });
  } catch (error) {
    console.error("Search error:", error);
    return res.status(500).json({ error: "Failed to search YouTube" });
  }
}
