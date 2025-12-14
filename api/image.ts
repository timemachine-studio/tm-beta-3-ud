import type { VercelRequest, VercelResponse } from '@vercel/node';

// Pollinations API secret key - NEVER expose this to the client
const POLLINATIONS_API_KEY = 'plln_sk_GnhDxr0seAiz92cgYsAh3VjBGQM8NRLK';

type Persona = 'default' | 'girlie' | 'pro' | 'chatgpt' | 'gemini' | 'claude' | 'grok';
type Process = 'create' | 'edit';
type Orientation = 'portrait' | 'landscape';

interface ImageParams {
  prompt: string;
  orientation: Orientation;
  process: Process;
  persona: Persona;
  inputImageUrls?: string[];
}

function constructPollinationsUrl(params: ImageParams): string {
  const {
    prompt,
    orientation = 'portrait',
    process = 'create',
    persona = 'default',
    inputImageUrls
  } = params;

  const encodedPrompt = encodeURIComponent(prompt);

  // Select model based on process type and persona
  let model: string;
  if (process === 'edit') {
    // Edit process: use nanobanana models
    model = persona === 'girlie' ? 'nanobanana' : 'nanobanana-pro';
  } else {
    // Create process: use seedream/zimage models
    model = persona === 'girlie' ? 'zimage' : 'seedream-pro';
  }

  let url: string;
  if (process === 'edit') {
    // For edit process: no width/height parameters
    url = `https://enter.pollinations.ai/api/generate/image/${encodedPrompt}?enhance=false&private=true&nologo=true&model=${model}&key=${POLLINATIONS_API_KEY}`;
  } else {
    // For create process: include width/height based on orientation
    const width = orientation === 'landscape' ? 3840 : 2160;
    const height = orientation === 'landscape' ? 2160 : 3840;
    url = `https://enter.pollinations.ai/api/generate/image/${encodedPrompt}?width=${width}&height=${height}&enhance=false&private=true&nologo=true&model=${model}&key=${POLLINATIONS_API_KEY}`;
  }

  // Handle multiple reference images (up to 4)
  if (inputImageUrls && inputImageUrls.length > 0) {
    const imageUrls = inputImageUrls.slice(0, 4).map(encodeURIComponent).join(',');
    url += `&image=${imageUrls}`;
  }

  return url;
}

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
    const {
      prompt,
      orientation = 'portrait',
      process = 'create',
      persona = 'default',
      inputImageUrls
    } = req.query;

    // Validate required parameters
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid prompt parameter' });
    }

    // Parse inputImageUrls if provided (comma-separated)
    let parsedImageUrls: string[] | undefined;
    if (inputImageUrls) {
      if (typeof inputImageUrls === 'string') {
        parsedImageUrls = inputImageUrls.split(',').filter(url => url.trim());
      } else if (Array.isArray(inputImageUrls)) {
        parsedImageUrls = inputImageUrls.filter(url => typeof url === 'string' && url.trim());
      }
    }

    // Construct the Pollinations URL with secret key (server-side only)
    const pollinationsUrl = constructPollinationsUrl({
      prompt,
      orientation: (orientation as Orientation) || 'portrait',
      process: (process as Process) || 'create',
      persona: (persona as Persona) || 'default',
      inputImageUrls: parsedImageUrls
    });

    // Fetch the image from Pollinations server-side
    const imageResponse = await fetch(pollinationsUrl, {
      method: 'GET',
      headers: {
        'Accept': 'image/*'
      }
    });

    if (!imageResponse.ok) {
      console.error('Pollinations API error:', imageResponse.status, await imageResponse.text().catch(() => ''));
      return res.status(502).json({ error: 'Failed to generate image' });
    }

    // Get the image as a buffer
    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/png';

    // Set response headers for image
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.setHeader('Content-Length', imageBuffer.byteLength);

    // Return the raw image bytes
    return res.status(200).send(Buffer.from(imageBuffer));

  } catch (error) {
    console.error('Image proxy error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
