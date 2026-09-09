import type { VercelRequest, VercelResponse } from './_lib/vercelTypes.js';
import { getAuthenticatedRequestUser } from './_lib/auth.js';
import { applyCors, hasAcceptableOrigin, isSameOriginSubresource } from './_lib/cors.js';
import { apiErrorBody } from './_lib/errors.js';
import { musicQuerySchema, parseOrReject } from './_lib/validation.js';

const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(req, res, 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!hasAcceptableOrigin(req)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  // These URLs are loaded as <img src> / <audio src>, so they cannot carry an
  // Authorization header. The gate is the browser's own fetch metadata plus the
  // origin allowlist — see isSameOriginSubresource. A bearer token is still
  // accepted for non-browser callers we control.
  const bearer = await getAuthenticatedRequestUser(req);
  if (!bearer && !isSameOriginSubresource(req)) {
    return res.status(401).json({ error: 'Not authorized' });
  }

  try {
    const parsed = parseOrReject(res, musicQuerySchema, {
      prompt: req.query.prompt,
      duration: req.query.duration,
      seed: req.query.seed,
    });
    if (!parsed) return;

    const url = new URL(`https://gen.pollinations.ai/audio/${encodeURIComponent(parsed.prompt)}`);
    url.searchParams.set('model', 'acestep');
    url.searchParams.set('duration', String(parsed.duration));
    url.searchParams.set('key', POLLINATIONS_API_KEY);

    if (parsed.seed !== undefined) {
      url.searchParams.set('seed', String(parsed.seed));
    }


    // Fetch the audio from Pollinations server-side
    const audioResponse = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'audio/*'
      }
    });

    if (!audioResponse.ok) {

      // Upstream bodies can echo prompts; retain only a fixed diagnostic.
      console.error('media_provider_failed');
      return res.status(502).json(
        apiErrorBody('PROVIDER_DOWN', 'Failed to generate audio')
      );
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const contentType = audioResponse.headers.get('content-type') || 'audio/mpeg';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Length', audioBuffer.byteLength);

    return res.status(200).send(Buffer.from(audioBuffer));

  } catch (error) {
    void error;
    console.error('Audio proxy error:');
    return res.status(500).json({ error: 'Internal server error' });
  }
}
