import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthenticatedRequestUser } from './_lib/auth.js';
import { applyCors, hasAcceptableOrigin } from './_lib/cors.js';
import yts from 'yt-search';
import { searchQuerySchema, parseOrReject } from './_lib/validation.js';

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
