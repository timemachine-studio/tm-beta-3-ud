import type { VercelRequest, VercelResponse } from '@vercel/node';

const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, width = '1024', height = '1024', seed } = req.query;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid prompt parameter' });
    }

    const url = new URL(`https://gen.pollinations.ai/api/generate/image/${encodeURIComponent(prompt)}`);

    // Add common parameters for cover
    url.searchParams.set('model', 'gptimage');
    url.searchParams.set('nologo', 'true');
    url.searchParams.set('width', typeof width === 'string' ? width : '1024');
    url.searchParams.set('height', typeof height === 'string' ? height : '1024');
    url.searchParams.set('key', POLLINATIONS_API_KEY);

    if (seed && typeof seed === 'string') {
      url.searchParams.set('seed', seed);
    }

    const debugUrl = url.toString().replace(/key=[^&]+/, 'key=***');
    console.log('Pollinations request URL (music cover):', debugUrl);

    // Fetch the image from Pollinations server-side
    const imageResponse = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'image/*'
      }
    });

    if (!imageResponse.ok) {
      const errorText = await imageResponse.text().catch(() => '');
      return res.status(502).json({
        error: 'Failed to generate cover image',
        pollinationsStatus: imageResponse.status,
        pollinationsError: errorText,
      });
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/png';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Content-Length', imageBuffer.byteLength);

    return res.status(200).send(Buffer.from(imageBuffer));

  } catch (error) {
    console.error('Music cover proxy error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
