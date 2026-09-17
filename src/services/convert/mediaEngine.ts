/**
 * Audio and video conversion through ffmpeg.wasm, on the device.
 *
 * The ffmpeg core (~30 MB) is fetched from a CDN the first time a media
 * conversion runs and kept for the session. It is the single-threaded build
 * on purpose: the multi-threaded one needs cross-origin isolation, and those
 * headers are only set on /max (they break every third-party frame, see
 * vercel.json). Single-threaded video encoding is slow — a minute of 1080p
 * can take a few minutes — which the view says out loud. Audio is quick.
 *
 * One ffmpeg instance, one job at a time: exec() is not re-entrant and the
 * progress event is per instance, so jobs queue behind each other.
 *
 * Licensing: @ffmpeg/ffmpeg and @ffmpeg/util are MIT, but the core binary is
 * a build of FFmpeg with GPL components (libx264 among them). It is not part
 * of our bundle — it is fetched at runtime and run as a separate program in
 * a worker, the same arrangement as shelling out to an ffmpeg binary. Keep
 * it that way: do not vendor the core into dist/.
 */

import type { FileFormat } from './formats';
import { ConversionError, type ProgressReporter } from './types';

type FFmpegModule = typeof import('@ffmpeg/ffmpeg');
type FFmpegInstance = InstanceType<FFmpegModule['FFmpeg']>;

const CORE_VERSION = '0.12.10';
// The ESM build, not UMD: Vite starts ffmpeg's worker as a module worker,
// where importScripts() throws and the worker falls back to import(), which
// needs a default export the UMD file does not have.
const CORE_BASE = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/esm`;

let instancePromise: Promise<FFmpegInstance> | null = null;
let queue: Promise<unknown> = Promise.resolve();
let currentReporter: ProgressReporter | null = null;

/**
 * Fetch a core file into a blob URL, reporting bytes as they arrive. Not
 * @ffmpeg/util's toBlobURL: the CDN serves the core compressed, so
 * Content-Length is the compressed size, received bytes never match it, and
 * that helper throws "incomplete download" then tries to re-read the stream.
 * Here a mismatch only means the bar is approximate.
 */
async function fetchCore(url: string, mime: string, report: (received: number, total: number) => void): Promise<string> {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new ConversionError('Could not download the media engine.');
  const total = Number(response.headers.get('content-length')) || 0;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    report(received, total);
  }
  return URL.createObjectURL(new Blob(chunks as BlobPart[], { type: mime }));
}

async function loadFFmpeg(report: ProgressReporter): Promise<FFmpegInstance> {
  if (!instancePromise) {
    instancePromise = (async () => {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const ffmpeg = new FFmpeg();
      ffmpeg.on('progress', ({ progress }) => {
        // ffmpeg reports past 1 on some containers and negative before the
        // first frame; clamp so the bar never runs backwards.
        const ratio = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : undefined;
        currentReporter?.({ phase: 'convert', label: 'Converting', ratio });
      });
      const onDownload = (received: number, total: number) => {
        report({ phase: 'engine', label: 'Loading media engine', ratio: total > 0 ? Math.min(1, received / total) : undefined });
      };
      // Blob URLs: the worker has to load the core from our own origin.
      const coreURL = await fetchCore(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript', onDownload);
      const wasmURL = await fetchCore(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm', onDownload);
      await ffmpeg.load({ coreURL, wasmURL });
      return ffmpeg;
    })().catch((error) => {
      instancePromise = null;
      throw error;
    });
  }
  return instancePromise;
}

/** Codec arguments per target. Extensions ffmpeg maps on its own are left to it. */
function encoderArgs(target: FileFormat, sourceIsVideo: boolean, quality: number): string[] {
  const audioBitrate = `${Math.round(64 + (quality / 100) * 192)}k`; // 64k–256k
  const crf = String(Math.round(35 - (quality / 100) * 17)); // 35–18
  switch (target.ext) {
    // ── audio ──
    case 'mp3': return ['-vn', '-c:a', 'libmp3lame', '-b:a', audioBitrate];
    case 'aac': return ['-vn', '-c:a', 'aac', '-b:a', audioBitrate];
    case 'm4a':
    case 'm4b': return ['-vn', '-c:a', 'aac', '-b:a', audioBitrate];
    case 'ogg': return ['-vn', '-c:a', 'libvorbis', '-b:a', audioBitrate];
    case 'opus': return ['-vn', '-c:a', 'libopus', '-b:a', audioBitrate, '-ar', '48000'];
    case 'weba': return ['-vn', '-c:a', 'libopus', '-b:a', audioBitrate, '-ar', '48000', '-f', 'webm'];
    case 'flac': return ['-vn', '-c:a', 'flac'];
    case 'wav': return ['-vn', '-c:a', 'pcm_s16le'];
    case 'aiff': return ['-vn', '-c:a', 'pcm_s16be'];
    case 'au': return ['-vn', '-c:a', 'pcm_s16be'];
    case 'wma': return ['-vn', '-c:a', 'wmav2', '-b:a', audioBitrate];
    case 'ac3': return ['-vn', '-c:a', 'ac3', '-b:a', audioBitrate];
    case 'mp2': return ['-vn', '-c:a', 'mp2', '-b:a', audioBitrate];
    case 'voc': return ['-vn', '-c:a', 'pcm_u8'];
    // ── video ──
    case 'mp4':
    case 'mov':
    case 'mkv':
    case 'ts':
      return ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', crf, '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:a', 'aac', '-b:a', '128k', ...(target.ext === 'mp4' || target.ext === 'mov' ? ['-movflags', '+faststart'] : [])];
    case '3gp':
      return ['-c:v', 'libx264', '-profile:v', 'baseline', '-preset', 'veryfast', '-crf', crf, '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:a', 'aac', '-b:a', '96k'];
    case 'webm':
      return ['-c:v', 'libvpx', '-b:v', '1M', '-crf', '10', '-c:a', 'libvorbis', '-b:a', '128k'];
    case 'avi':
      return ['-c:v', 'mpeg4', '-q:v', '5', '-c:a', 'libmp3lame', '-b:a', '128k'];
    case 'wmv':
      return ['-c:v', 'wmv2', '-q:v', '5', '-c:a', 'wmav2', '-b:a', '128k'];
    case 'flv':
      return ['-c:v', 'flv', '-q:v', '5', '-c:a', 'libmp3lame', '-ar', '44100', '-b:a', '128k'];
    case 'mpeg':
      return ['-c:v', 'mpeg2video', '-q:v', '5', '-c:a', 'mp2', '-b:a', '192k'];
    case 'ogv':
      return ['-c:v', 'libtheora', '-q:v', '7', '-c:a', 'libvorbis', '-b:a', '128k'];
    case 'gif':
      // Video → looping GIF. 12 fps at up to 480px wide keeps the file sane.
      return ['-an', '-vf', 'fps=12,scale=min(480\\,iw):-2:flags=lanczos', '-loop', '0'];
    default:
      return sourceIsVideo ? [] : ['-vn'];
  }
}

/** ffmpeg picks muxers by extension; give it the canonical one. */
function scratchName(prefix: string, format: FileFormat): string {
  return `${prefix}.${format.ext}`;
}

export function convertMedia(
  file: File, source: FileFormat, target: FileFormat,
  options: { quality?: number; signal?: AbortSignal }, report: ProgressReporter,
): Promise<Blob> {
  const run = async (): Promise<Blob> => {
    if (options.signal?.aborted) throw new ConversionError('Cancelled.');
    const ffmpeg = await loadFFmpeg(report);
    const { fetchFile } = await import('@ffmpeg/util');
    const inputName = scratchName('in', source);
    const outputName = scratchName('out', target);
    const quality = options.quality ?? 80;
    currentReporter = report;
    report({ phase: 'convert', label: 'Converting', ratio: 0 });

    const onAbort = () => {
      // terminate() kills the worker mid-exec; the next job reloads the core.
      ffmpeg.terminate();
      instancePromise = null;
    };
    options.signal?.addEventListener('abort', onAbort, { once: true });
    try {
      await ffmpeg.writeFile(inputName, await fetchFile(file));
      const code = await ffmpeg.exec(['-i', inputName, ...encoderArgs(target, source.category === 'video', quality), '-y', outputName]);
      if (options.signal?.aborted) throw new ConversionError('Cancelled.');
      if (code !== 0) throw new ConversionError(`ffmpeg could not write ${target.label} (exit ${code}).`);
      const data = await ffmpeg.readFile(outputName);
      if (typeof data === 'string') throw new ConversionError('ffmpeg produced no output.');
      // Copy out of the worker's heap before the scratch files are deleted.
      const bytes = new Uint8Array(data.byteLength);
      bytes.set(data);
      return new Blob([bytes], { type: target.mime });
    } catch (error) {
      if (error instanceof ConversionError) throw error;
      if (options.signal?.aborted) throw new ConversionError('Cancelled.');
      throw new ConversionError(`Could not convert to ${target.label}.`, error);
    } finally {
      options.signal?.removeEventListener('abort', onAbort);
      currentReporter = null;
      if (instancePromise) {
        await Promise.allSettled([ffmpeg.deleteFile(inputName), ffmpeg.deleteFile(outputName)]);
      }
    }
  };
  // Queue behind whatever is running; a failure ahead must not poison the queue.
  const job = queue.then(run, run);
  queue = job.catch(() => undefined);
  return job;
}
