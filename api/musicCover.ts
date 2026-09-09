import type { VercelRequest, VercelResponse } from './_lib/vercelTypes.js';
import { getAuthenticatedRequestUser } from './_lib/auth.js';
import { applyCors, hasAcceptableOrigin, isSameOriginSubresource } from './_lib/cors.js';
import { apiErrorBody } from './_lib/errors.js';
import { musicCoverQuerySchema, parseOrReject } from './_lib/validation.js';

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
    const parsed = parseOrReject(res, musicCoverQuerySchema, {
      prompt: req.query.prompt,
      width: req.query.width,
      height: req.query.height,
      seed: req.query.seed,
    });
    if (!parsed) return;
    const { prompt, width, height, seed } = parsed;

    const url = new URL(`https://gen.pollinations.ai/api/generate/image/${encodeURIComponent(prompt)}`);

    // Add common parameters for cover
    url.searchParams.set('model', 'gptimage');
    url.searchParams.set('nologo', 'true');
    url.searchParams.set('width', String(width));
    url.searchParams.set('height', String(height));
    url.searchParams.set('key', POLLINATIONS_API_KEY);

    if (seed !== undefined) {
      url.searchParams.set('seed', String(seed));
    }


    // Fetch the image from Pollinations server-side
    const imageResponse = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'image/*'
      }
    });

    if (!imageResponse.ok) {

      // Upstream bodies can echo prompts; retain only a fixed diagnostic.
        console.error('media_provider_failed');
        return res.status(502).json(
          apiErrorBody('PROVIDER_DOWN', 'Failed to generate cover image')
        );
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/png';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Length', imageBuffer.byteLength);

    return res.status(200).send(Buffer.from(imageBuffer));

  } catch (error) {
    void error;
    console.error('Music cover proxy error:');
    return res.status(500).json({ error: 'Internal server error' });
  }
}
