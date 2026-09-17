/**
 * The file converter's front door. `convertFile` picks the engine from the
 * source category; the engines themselves are lazy so a chat that never
 * converts anything never loads them. See formats.ts for the catalogue.
 */

import { type FileFormat, canConvert, formatOfFile, renameTo } from './formats';
import { ConversionError, type ConversionOptions, type ProgressReporter } from './types';

export { FORMATS, ACCEPT_ATTRIBUTE, CATEGORY_LABEL, formatByExt, formatOfFile, targetsFor, groupTargets, renameTo, formatBytes, extensionOf, imageNeedsEngine } from './formats';
export type { FileFormat, FormatCategory } from './formats';
export { ConversionError } from './types';
export type { ConversionOptions, ConversionProgress, ProgressReporter } from './types';

export interface ConvertedFile {
  blob: Blob;
  name: string;
  format: FileFormat;
}

export async function convertFile(
  file: File, target: FileFormat, options: ConversionOptions = {}, report: ProgressReporter = () => {},
): Promise<ConvertedFile> {
  const source = formatOfFile(file);
  if (!source) throw new ConversionError(`"${file.name}" is not a format the converter can read.`);
  if (!canConvert(source, target)) throw new ConversionError(`${source.label} cannot become ${target.label}.`);

  let blob: Blob;
  try {
    switch (source.category) {
      case 'image': {
        const { convertImage } = await import('./imageEngine');
        blob = await convertImage(file, source, target, { quality: options.quality }, report);
        break;
      }
      case 'audio':
      case 'video': {
        const { convertMedia } = await import('./mediaEngine');
        blob = await convertMedia(file, source, target, options, report);
        break;
      }
      case 'document': {
        const { convertDocument } = await import('./documentEngine');
        blob = await convertDocument(file, source, target, report);
        break;
      }
    }
  } catch (error) {
    if (error instanceof ConversionError) throw error;
    const detail = error instanceof Error && error.message ? ` ${error.message}` : '';
    throw new ConversionError(`Could not convert ${file.name} to ${target.label}.${detail}`, error);
  }
  return { blob, name: renameTo(file.name, target.ext), format: target };
}

/** Whether this browser can run the converter at all. */
export function converterSupported(): boolean {
  return typeof WebAssembly === 'object' && typeof Worker === 'function' && typeof createImageBitmap === 'function';
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Safari needs the URL alive until the download has started.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Bundle several converted files into one download. Stored, not deflated: they are already compressed formats. */
export async function zipFiles(files: ConvertedFile[]): Promise<Blob> {
  const { zipSync } = await import('fflate');
  const entries: Record<string, [Uint8Array, { level: 0 }]> = {};
  const seen = new Map<string, number>();
  for (const file of files) {
    // Two "photo.png"s in one zip would silently keep the last one.
    const count = seen.get(file.name) ?? 0;
    seen.set(file.name, count + 1);
    const name = count === 0 ? file.name : renameTo(file.name, `${count}.${file.format.ext}`);
    entries[name] = [new Uint8Array(await file.blob.arrayBuffer()), { level: 0 }];
  }
  return new Blob([zipSync(entries) as BlobPart], { type: 'application/zip' });
}
