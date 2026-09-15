import type { VercelRequest, VercelResponse } from './_lib/vercelTypes.js';
import { applyCors, hasAcceptableOrigin } from './_lib/cors.js';
import { apiErrorBody } from './_lib/errors.js';
import { admitMediaRequest } from './_lib/mediaGate.js';
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

  // Signed URL or bearer token, rate limited either way (api/_lib/mediaGate.ts).
  const access = await admitMediaRequest(req, res, 'music', '/api/music');
  if (!access) return;

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
    await access.charge();

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
