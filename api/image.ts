import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthenticatedRequestUser } from './_lib/auth.js';
import { applyCors, hasAcceptableOrigin, isSameOriginSubresource } from './_lib/cors.js';
import { apiErrorBody } from './_lib/errors.js';
import { promptQuerySchema, parseOrReject, isAllowedImageUrl, LIMITS } from './_lib/validation.js';

// Pollinations API key from environment variable
const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY || '';

type Persona = 'default' | 'girlie' | 'pro';
type Process = 'create' | 'edit';
type Orientation = 'portrait' | 'landscape';

interface ImageParams {
  prompt: string;
  orientation: Orientation;
  process: Process;
  persona: Persona;
  inputImageUrls?: string[];
  width?: number;  // Original image width for edit operations
  height?: number; // Original image height for edit operations
}

function constructPollinationsUrl(params: ImageParams): URL {
  const {
    prompt,
    orientation = 'portrait',
    process = 'create',
    persona = 'default',
    inputImageUrls,
    width: originalWidth,
    height: originalHeight
  } = params;

  // Select model based on process type and persona
  let model: string;
  if (process === 'edit') {
    // Edit process: use nanobanana models
    model = persona === 'default' ? 'klein' : 'nova-canvas';
  } else {
    // Create process: use seedream/zimage models
    model = persona === 'default' ? 'zimage' : 'zimage';
  }

  // Use WHATWG URL API to avoid url.parse() deprecation warning
  const url = new URL(`https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}`);

  // Add common parameters
  url.searchParams.set('enhance', 'false');
  url.searchParams.set('private', 'true');
  url.searchParams.set('nologo', 'true');
  url.searchParams.set('model', model);
  url.searchParams.set('key', POLLINATIONS_API_KEY);

  if (process === 'edit') {
    // For edit process: use original image dimensions if provided, otherwise use defaults based on orientation
    if (originalWidth && originalHeight) {
      url.searchParams.set('width', String(originalWidth));
      url.searchParams.set('height', String(originalHeight));
    } else {
      // Default dimensions for edit when not provided
      const defaultWidth = orientation === 'landscape' ? 1920 : 1080;
      const defaultHeight = orientation === 'landscape' ? 1080 : 1920;
      url.searchParams.set('width', String(defaultWidth));
      url.searchParams.set('height', String(defaultHeight));
    }
  } else {
    // For create process: include width/height based on orientation
    const width = orientation === 'landscape' ? 2048 : 1152;
    const height = orientation === 'landscape' ? 1152 : 2048;
    url.searchParams.set('width', String(width));
    url.searchParams.set('height', String(height));
  }

  // Handle multiple reference images (up to 4)
  // IMPORTANT: Pollinations expects image URLs WITHOUT percent-encoding for : and /
  // URLSearchParams.set() encodes these (https%3A%2F%2F), but Pollinations needs (https://)
  // So we manually append the image parameter to preserve the raw URL format
  if (inputImageUrls && inputImageUrls.length > 0) {
    const imageUrls = inputImageUrls.slice(0, 4).join(',');
    return new URL(url.toString() + '&image=' + imageUrls);
  }

  return url;
}

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
    const {
      prompt,
      orientation = 'portrait',
      process = 'create',
      persona = 'default',
      inputImageUrls,
      width,
      height
    } = req.query;

    // Validate required parameters
    const parsedPrompt = parseOrReject(res, promptQuerySchema, { prompt });
    if (!parsedPrompt) return;

    // Parse inputImageUrls if provided (comma-separated)
    // These are handed to Pollinations, which fetches them — so only hosts we
    // trust may appear here (1.8, SSRF).
    let parsedImageUrls: string[] | undefined;
    if (inputImageUrls) {
      const raw = typeof inputImageUrls === 'string'
        ? inputImageUrls.split(',')
        : Array.isArray(inputImageUrls) ? inputImageUrls : [];
      const candidates = raw
        .filter((url): url is string => typeof url === 'string' && url.trim() !== '')
        .map(url => url.trim())
        .slice(0, LIMITS.maxImageUrls);
      if (candidates.some(url => !isAllowedImageUrl(url))) {
        return res.status(400).json(apiErrorBody('BAD_REQUEST', 'Invalid request: inputImageUrls'));
      }
      parsedImageUrls = candidates;
    }

    // Parse width and height for edit operations
    const boundDimension = (value: unknown): number | undefined => {
      if (typeof value !== 'string') return undefined;
      const parsedValue = parseInt(value, 10);
      if (!Number.isFinite(parsedValue)) return undefined;
      return Math.min(4096, Math.max(64, parsedValue));
    };
    const parsedWidth = boundDimension(width);
    const parsedHeight = boundDimension(height);

    // Construct the Pollinations URL with secret key (server-side only)
    const pollinationsUrl = constructPollinationsUrl({
      prompt: parsedPrompt.prompt,
      orientation: (orientation as Orientation) || 'portrait',
      process: (process as Process) || 'create',
      persona: (persona as Persona) || 'default',
      inputImageUrls: parsedImageUrls,
      width: parsedWidth,
      height: parsedHeight
    });

    // Log the URL for debugging (mask the API key)
    const debugUrl = pollinationsUrl.toString().replace(/key=[^&]+/, 'key=***');
    console.log('Pollinations request URL:', debugUrl);
    console.log('Parsed image URLs:', parsedImageUrls);

    // Fetch the image from Pollinations server-side
    const imageResponse = await fetch(pollinationsUrl, {
      method: 'GET',
      headers: {
        'Accept': 'image/*'
      }
    });

    if (!imageResponse.ok) {
      const errorText = await imageResponse.text().catch(() => '');
      console.error('Pollinations API error:', imageResponse.status, errorText);
      console.error('Request URL was:', debugUrl);
      // Status, upstream body and our own request URL stay server-side (1.7).
      return res.status(502).json(apiErrorBody('PROVIDER_DOWN', 'Failed to generate image'));
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
