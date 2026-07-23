import type { VercelRequest, VercelResponse } from '@vercel/node';

const SESAME_ORIGIN = 'https://app.sesame.com';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    return res.status(200).end();
  }

  try {
    const response = await fetch(SESAME_ORIGIN, {
      headers: { 'User-Agent': req.headers['user-agent'] || '' },
    });

    let html = await response.text();

    html = html.replace(
      /(href|src)=("\/)/g,
      `$1="${SESAME_ORIGIN}/`,
    );

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).send(html);
  } catch (error) {
    console.error('Sesame proxy error:', error);
    res.status(502).json({ error: 'Failed to fetch Sesame' });
  }
}
