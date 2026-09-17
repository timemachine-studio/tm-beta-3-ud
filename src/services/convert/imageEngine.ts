/**
 * Image conversion, on the device.
 *
 * Two tiers. The canvas tier handles what a browser can already decode and
 * encode — PNG, JPEG, WebP in, PNG, JPEG, WebP out — with no download, which
 * is most conversions anyone asks for. Everything else (TIFF, AVIF, HEIC,
 * PSD, camera RAW, ICO…) goes through ImageMagick compiled to WebAssembly,
 * a ~15 MB binary fetched from our own origin the first time it is needed
 * and kept for the session.
 *
 * SVG is rasterised through the canvas first either way: the WASM build has
 * no SVG delegate, and the browser's renderer is the better one anyway.
 */

import { CANVAS_DECODES, CANVAS_ENCODES, type FileFormat } from './formats';
import type { ProgressReporter } from './types';

export interface ImageOptions {
  /** 1–100 for lossy targets. */
  quality?: number;
}

/** Formats whose MagickFormat name is not just the upper-cased extension. */
const MAGICK_NAME: Record<string, string> = {
  jpeg: 'JPEG', tiff: 'TIFF', pnm: 'PNM', heic: 'HEIC',
};

// ─── Canvas tier ────────────────────────────────────────────────────────────

async function decodeWithBrowser(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  // createImageBitmap is the fast path but refuses an SVG without intrinsic
  // dimensions in some browsers; <img> handles those.
  try {
    return await createImageBitmap(file);
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('The browser could not decode this image.'));
        img.src = url;
      });
      return img;
    } finally {
      // The element keeps its decoded bitmap; the URL can go.
      queueMicrotask(() => URL.revokeObjectURL(url));
    }
  }
}

function sourceSize(source: ImageBitmap | HTMLImageElement): { width: number; height: number } {
  if (source instanceof HTMLImageElement) {
    return { width: source.naturalWidth || source.width || 1024, height: source.naturalHeight || source.height || 1024 };
  }
  return { width: source.width, height: source.height };
}

/** Draw a decoded image onto a canvas and encode it. Opaque targets get white behind transparency. */
async function encodeWithCanvas(source: ImageBitmap | HTMLImageElement, mime: string, quality: number | undefined, opaque: boolean): Promise<Blob> {
  const { width, height } = sourceSize(source);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D canvas available.');
  if (opaque) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(source, 0, 0, width, height);
  if ('close' in source) source.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, quality != null ? quality / 100 : undefined));
  if (!blob || blob.type !== mime) throw new Error(`The browser cannot encode ${mime}.`);
  return blob;
}

async function rasterise(file: Blob): Promise<Uint8Array> {
  const source = await decodeWithBrowser(file);
  const png = await encodeWithCanvas(source, 'image/png', undefined, false);
  return new Uint8Array(await png.arrayBuffer());
}

// ─── ImageMagick tier ───────────────────────────────────────────────────────

type Magick = typeof import('@imagemagick/magick-wasm');

let magickPromise: Promise<Magick> | null = null;

/** Fetch the WASM with byte progress, then initialise. One per session. */
function loadMagick(report: ProgressReporter): Promise<Magick> {
  if (!magickPromise) {
    magickPromise = (async () => {
      const [magick, { default: wasmUrl }] = await Promise.all([
        import('@imagemagick/magick-wasm'),
        import('@imagemagick/magick-wasm/magick.wasm?url'),
      ]);
      const response = await fetch(wasmUrl);
      if (!response.ok || !response.body) throw new Error('Could not download the image engine.');
      const total = Number(response.headers.get('content-length')) || 0;
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        report({ phase: 'engine', label: 'Loading image engine', ratio: total ? received / total : undefined });
      }
      const bytes = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      await magick.initializeImageMagick(bytes);
      return magick;
    })().catch((error) => {
      magickPromise = null;
      throw error;
    });
  }
  return magickPromise;
}

function magickFormatFor(ext: string, magick: Magick): import('@imagemagick/magick-wasm').MagickFormat {
  const name = MAGICK_NAME[ext] ?? ext.toUpperCase();
  const known = Object.values(magick.MagickFormat) as string[];
  if (!known.includes(name)) throw new Error(`ImageMagick has no ${ext.toUpperCase()} writer.`);
  return name as import('@imagemagick/magick-wasm').MagickFormat;
}

async function convertWithMagick(file: File, source: FileFormat, target: FileFormat, options: ImageOptions, report: ProgressReporter): Promise<Blob> {
  const magick = await loadMagick(report);
  report({ phase: 'convert', label: 'Converting', ratio: undefined });
  const input = source.ext === 'svg'
    ? await rasterise(file)
    : new Uint8Array(await file.arrayBuffer());
  const format = magickFormatFor(target.ext, magick);
  // The callback runs synchronously; the byte array it hands us is freed when
  // it returns, hence the copy.
  const output = magick.ImageMagick.read(input, (image) => {
    if (options.quality != null) image.quality = options.quality;
    if (target.ext === 'ico' && (image.width > 256 || image.height > 256)) {
      // ICO holds at most 256px per side.
      image.resize(256, 256);
    }
    return image.write(format, (data) => data.slice());
  });
  return new Blob([output as BlobPart], { type: target.mime });
}

// ─── Entry ──────────────────────────────────────────────────────────────────

export async function convertImage(file: File, source: FileFormat, target: FileFormat, options: ImageOptions, report: ProgressReporter): Promise<Blob> {
  const mime = CANVAS_ENCODES[target.ext];
  if (mime && CANVAS_DECODES.has(source.ext)) {
    try {
      report({ phase: 'convert', label: 'Converting', ratio: undefined });
      const decoded = await decodeWithBrowser(file);
      return await encodeWithCanvas(decoded, mime, options.quality, target.ext === 'jpeg');
    } catch {
      // A GIF the browser mis-decodes, an AVIF this browser cannot read, an
      // encoder it lacks: fall through to the engine that has all of them.
    }
  }
  return convertWithMagick(file, source, target, options, report);
}
