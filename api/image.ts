import type { VercelRequest, VercelResponse } from './_lib/vercelTypes.js';
import { applyCors, hasAcceptableOrigin } from './_lib/cors.js';
import { apiErrorBody } from './_lib/errors.js';
import { admitMediaRequest } from './_lib/mediaGate.js';
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
  /**
   * Pollinations is non-deterministic without one. The tool puts a seed in
   * every URL it hands out so that display, re-upload, download and reopening
   * the chat all resolve to the same picture instead of four different ones
   * (pre-launch-audit.md A.8).
   */
  seed?: number;
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
  if (params.seed !== undefined) url.searchParams.set('seed', String(params.seed));

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

  // Signed URL (minted by the generate_image tool) or a bearer token; both
  // are rate limited. See api/_lib/mediaGate.ts for why the old
  // Sec-Fetch-Site gate is gone.
  const access = await admitMediaRequest(req, res, 'image', '/api/image');
  if (!access) return;

  try {
    const {
      prompt,
      orientation = 'portrait',
      process = 'create',
      persona = 'default',
      inputImageUrls,
      width,
      height,
      seed,
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
    const parsedSeed = typeof seed === 'string' && /^\d{1,10}$/.test(seed) ? Number(seed) : undefined;

    // Construct the Pollinations URL with secret key (server-side only)
    const pollinationsUrl = constructPollinationsUrl({
      prompt: parsedPrompt.prompt,
      orientation: (orientation as Orientation) || 'portrait',
      process: (process as Process) || 'create',
      persona: (persona as Persona) || 'default',
      inputImageUrls: parsedImageUrls,
      width: parsedWidth,
      height: parsedHeight,
      seed: parsedSeed,
    });



    // Fetch the image from Pollinations server-side
    const imageResponse = await fetch(pollinationsUrl, {
      method: 'GET',
      headers: {
        'Accept': 'image/*'
      }
    });

    if (!imageResponse.ok) {

      console.error('image_provider_failed', imageResponse.status);

      // Neither URLs nor upstream bodies belong in durable logs (TM-02).
      return res.status(502).json(apiErrorBody('PROVIDER_DOWN', 'Failed to generate image'));
    }

    // Get the image as a buffer
    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/png';

    // Charged only now that Pollinations actually answered.
    await access.charge();

    // Set response headers for image. Private (this browser only — the prompt
    // is in the URL, so no shared cache may keep it) but cacheable, so the
    // display, the re-upload and the download share one generation.
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', parsedSeed !== undefined ? 'private, max-age=86400' : 'no-store');
    res.setHeader('Content-Length', imageBuffer.byteLength);

    // Return the raw image bytes
    return res.status(200).send(Buffer.from(imageBuffer));

  } catch (error) {
    void error;
    console.error('Image proxy error:');
    return res.status(500).json({ error: 'Internal server error' });
  }
}
