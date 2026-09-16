import type { NotesAIAttachments } from '../../services/ai/notesAiService';

/* What the Notes co-pilot can be handed, prepared on the device. Images are
   downsized here because the whole request must fit under the API's 4 MB
   body ceiling; files become text here because the model only ever sees
   text, and the bytes have no reason to leave the machine. */

export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp';
export const FILE_ACCEPT = 'application/pdf,text/*,application/json,.md,.txt,.js,.jsx,.ts,.tsx,.json,.html,.css,.csv,.xml,.yaml,.yml,.log,.rtf';

export const MAX_IMAGES = 4;
export const MAX_FILES = 3;
const MAX_FILE_BYTES = 25_000_000;
const MAX_FILE_CHARS = 60_000;
const MAX_IMAGE_EDGE = 1280;

export interface PendingImage { id: string; url: string; name: string }
export interface PendingFile { id: string; name: string; text: string; size: number }

export interface PendingAttachments {
  images: PendingImage[];
  files: PendingFile[];
}

export const EMPTY_ATTACHMENTS: PendingAttachments = { images: [], files: [] };

export function hasAttachments(a: PendingAttachments): boolean {
  return a.images.length > 0 || a.files.length > 0;
}

export function toPayload(a: PendingAttachments): NotesAIAttachments | undefined {
  if (!hasAttachments(a)) return undefined;
  return {
    ...(a.images.length ? { images: a.images.map((i) => i.url) } : {}),
    ...(a.files.length ? { files: a.files.map((f) => ({ name: f.name, text: f.text })) } : {}),
  };
}

/** "2 images, 1 file" — for the transcript. */
export function describeAttachments(a: PendingAttachments): string {
  const parts: string[] = [];
  if (a.images.length) parts.push(`${a.images.length} image${a.images.length === 1 ? '' : 's'}`);
  if (a.files.length) parts.push(`${a.files.length} file${a.files.length === 1 ? '' : 's'}`);
  return parts.join(', ');
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const uid = () => Math.random().toString(36).slice(2, 10);

/** Downsize to MAX_IMAGE_EDGE and re-encode as JPEG. PNG only if the image has transparency. */
export async function shrinkImage(file: File): Promise<PendingImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not read the image.');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const keepAlpha = file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/gif';
  const url = keepAlpha && hasTransparentPixels(ctx, w, h)
    ? canvas.toDataURL('image/png')
    : canvas.toDataURL('image/jpeg', 0.82);
  return { id: uid(), url, name: file.name };
}

function hasTransparentPixels(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  // Sample a grid rather than every pixel: enough to catch a transparent
  // background, cheap enough to run on a phone.
  const step = Math.max(1, Math.floor(Math.min(w, h) / 32));
  for (let y = 0; y < h; y += step) {
    const row = ctx.getImageData(0, y, w, 1).data;
    for (let x = 3; x < row.length; x += 4 * step) {
      if (row[x] < 250) return true;
    }
  }
  return false;
}

export async function readAttachmentText(file: File): Promise<PendingFile> {
  if (file.size > MAX_FILE_BYTES) throw new Error('Files must be under 25 MB.');
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  let text: string;
  if (file.type === 'application/pdf' || ext === 'pdf') {
    const { extractPdfText } = await import('../../services/pdf/pdfService');
    text = (await extractPdfText(file)).text;
  } else {
    text = await file.text();
  }
  if (text.length > MAX_FILE_CHARS) {
    const keepEnd = Math.floor(MAX_FILE_CHARS * 0.15);
    text = `${text.slice(0, MAX_FILE_CHARS - keepEnd)}\n\n[… middle of the file omitted for length …]\n\n${text.slice(-keepEnd)}`;
  }
  return { id: uid(), name: file.name, text, size: file.size };
}
