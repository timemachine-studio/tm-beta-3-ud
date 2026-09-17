/**
 * The file converter's format catalogue: what a file is, and what it can
 * become.
 *
 * Everything here converts on the device — images through ImageMagick
 * compiled to WebAssembly (with a no-download fast path through the canvas
 * for the common web formats), audio and video through ffmpeg.wasm, documents
 * through small JS libraries. Nothing is uploaded, which is the only reason a
 * converter belongs in a product whose headline is privacy.
 *
 * `input` and `output` are separate on purpose: a camera RAW can be read and
 * never written, an SVG is rasterised on the way in, a PDF is text-extracted.
 * Keep a format out of `output` unless the engine has actually produced one.
 */

export type FormatCategory = 'image' | 'audio' | 'video' | 'document';

export interface FileFormat {
  /** Canonical lowercase extension, no dot. */
  ext: string;
  label: string;
  category: FormatCategory;
  mime: string;
  input: boolean;
  output: boolean;
  /** Other extensions that mean the same container. */
  aliases?: string[];
  /** A caveat worth showing next to the format. */
  note?: string;
}

const f = (
  ext: string, label: string, category: FormatCategory, mime: string,
  io: 'io' | 'in' | 'out', extra?: { aliases?: string[]; note?: string },
): FileFormat => ({
  ext, label, category, mime, input: io !== 'out', output: io !== 'in', ...extra,
});

/** Camera RAW: readable through libraw inside ImageMagick, never written. */
const RAW_CAMERA = ['nef', 'cr2', 'cr3', 'crw', 'dng', 'arw', 'raf', 'orf', 'rw2', 'pef', 'erf', 'mrw', 'srw', 'sr2', 'srf', 'dcr', '3fr', 'mef', 'mos', 'nrw', 'kdc'];

export const FORMATS: FileFormat[] = [
  // ── Images ──────────────────────────────────────────────────────────────
  f('png', 'PNG', 'image', 'image/png', 'io'),
  f('jpeg', 'JPEG', 'image', 'image/jpeg', 'io', { aliases: ['jpg', 'jpe', 'jfif'] }),
  f('webp', 'WebP', 'image', 'image/webp', 'io'),
  f('gif', 'GIF', 'image', 'image/gif', 'io', { note: 'first frame from an animation' }),
  f('avif', 'AVIF', 'image', 'image/avif', 'io'),
  f('jxl', 'JPEG XL', 'image', 'image/jxl', 'io'),
  f('heic', 'HEIC', 'image', 'image/heic', 'in', { aliases: ['heif'] }),
  f('bmp', 'BMP', 'image', 'image/bmp', 'io'),
  f('ico', 'ICO', 'image', 'image/x-icon', 'io', { note: 'one size, up to 256px' }),
  f('cur', 'Cursor', 'image', 'image/x-icon', 'io'),
  f('tiff', 'TIFF', 'image', 'image/tiff', 'io', { aliases: ['tif'] }),
  f('tga', 'TGA', 'image', 'image/x-tga', 'io'),
  f('psd', 'Photoshop', 'image', 'image/vnd.adobe.photoshop', 'io', { note: 'layers are flattened' }),
  f('pnm', 'PNM', 'image', 'image/x-portable-anymap', 'io', { aliases: ['pbm', 'pgm', 'ppm', 'pfm'] }),
  f('hdr', 'Radiance HDR', 'image', 'image/vnd.radiance', 'io'),
  f('exr', 'OpenEXR', 'image', 'image/x-exr', 'io'),
  f('dds', 'DDS', 'image', 'image/vnd-ms.dds', 'io'),
  f('qoi', 'QOI', 'image', 'image/qoi', 'io'),
  f('pcx', 'PCX', 'image', 'image/x-pcx', 'io'),
  f('svg', 'SVG', 'image', 'image/svg+xml', 'in', { note: 'rasterised' }),
  f('xcf', 'GIMP', 'image', 'image/x-xcf', 'in'),
  f('icns', 'Apple icon', 'image', 'image/icns', 'in'),
  ...RAW_CAMERA.map((ext) => f(ext, `${ext.toUpperCase()} (RAW)`, 'image', 'image/x-raw', 'in')),

  // ── Audio ───────────────────────────────────────────────────────────────
  f('mp3', 'MP3', 'audio', 'audio/mpeg', 'io'),
  f('wav', 'WAV', 'audio', 'audio/wav', 'io'),
  f('flac', 'FLAC', 'audio', 'audio/flac', 'io'),
  f('ogg', 'OGG Vorbis', 'audio', 'audio/ogg', 'io', { aliases: ['oga'] }),
  f('opus', 'Opus', 'audio', 'audio/ogg', 'io'),
  f('aac', 'AAC', 'audio', 'audio/aac', 'io'),
  f('m4a', 'M4A', 'audio', 'audio/mp4', 'io'),
  f('m4b', 'M4B audiobook', 'audio', 'audio/mp4', 'io'),
  f('wma', 'WMA', 'audio', 'audio/x-ms-wma', 'io'),
  f('aiff', 'AIFF', 'audio', 'audio/aiff', 'io', { aliases: ['aif', 'aifc'] }),
  f('ac3', 'AC-3', 'audio', 'audio/ac3', 'io'),
  f('mp2', 'MP2', 'audio', 'audio/mpeg', 'io'),
  f('au', 'Sun AU', 'audio', 'audio/basic', 'io'),
  f('weba', 'WebM audio', 'audio', 'audio/webm', 'io'),
  f('voc', 'VOC', 'audio', 'audio/x-voc', 'io'),
  f('amr', 'AMR', 'audio', 'audio/amr', 'in'),
  f('caf', 'CAF', 'audio', 'audio/x-caf', 'in'),
  f('mpc', 'Musepack', 'audio', 'audio/x-musepack', 'in'),
  f('dsf', 'DSD', 'audio', 'audio/x-dsf', 'in', { aliases: ['dff'] }),

  // ── Video ───────────────────────────────────────────────────────────────
  f('mp4', 'MP4', 'video', 'video/mp4', 'io', { aliases: ['m4v'] }),
  f('webm', 'WebM', 'video', 'video/webm', 'io'),
  f('mkv', 'Matroska', 'video', 'video/x-matroska', 'io'),
  f('mov', 'QuickTime', 'video', 'video/quicktime', 'io'),
  f('avi', 'AVI', 'video', 'video/x-msvideo', 'io'),
  f('wmv', 'WMV', 'video', 'video/x-ms-wmv', 'io'),
  f('flv', 'Flash video', 'video', 'video/x-flv', 'io'),
  f('3gp', '3GP', 'video', 'video/3gpp', 'io', { aliases: ['3g2'] }),
  f('mpeg', 'MPEG', 'video', 'video/mpeg', 'io', { aliases: ['mpg'] }),
  f('ogv', 'OGG video', 'video', 'video/ogg', 'io'),
  f('ts', 'MPEG-TS', 'video', 'video/mp2t', 'io', { aliases: ['mts', 'm2ts'] }),
  f('vob', 'DVD VOB', 'video', 'video/dvd', 'in'),

  // ── Documents ───────────────────────────────────────────────────────────
  f('md', 'Markdown', 'document', 'text/markdown', 'io', { aliases: ['markdown'] }),
  f('txt', 'Plain text', 'document', 'text/plain', 'io', { aliases: ['text'] }),
  f('html', 'HTML', 'document', 'text/html', 'io', { aliases: ['htm'] }),
  f('docx', 'Word', 'document', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'io'),
  f('csv', 'CSV', 'document', 'text/csv', 'io'),
  f('tsv', 'TSV', 'document', 'text/tab-separated-values', 'io'),
  f('json', 'JSON', 'document', 'application/json', 'io'),
  f('pdf', 'PDF', 'document', 'application/pdf', 'in', { note: 'text only' }),
];

/** Documents that hold rows, as opposed to prose. They convert among themselves. */
export const TABLE_DOCUMENT_EXTS = new Set(['csv', 'tsv', 'json']);

const BY_EXT = new Map<string, FileFormat>();
for (const format of FORMATS) {
  BY_EXT.set(format.ext, format);
  for (const alias of format.aliases ?? []) BY_EXT.set(alias, format);
}

/** Resolve an extension (with or without the dot, any case) to its format. */
export function formatByExt(ext: string): FileFormat | null {
  return BY_EXT.get(ext.replace(/^\./, '').toLowerCase()) ?? null;
}

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : '';
}

export function formatOfFile(file: { name: string; type?: string }): FileFormat | null {
  const byName = formatByExt(extensionOf(file.name));
  if (byName) return byName;
  // A file dragged from some apps arrives with a MIME type and a bare name.
  if (file.type) {
    const byMime = FORMATS.find((format) => format.input && format.mime === file.type);
    if (byMime) return byMime;
  }
  return null;
}

/** Every readable extension, for the file picker's `accept`. */
export const ACCEPT_ATTRIBUTE = FORMATS
  .filter((format) => format.input)
  .flatMap((format) => [format.ext, ...(format.aliases ?? [])])
  .map((ext) => `.${ext}`)
  .join(',');

/**
 * What a file of this format can become. Same category, plus the two
 * cross-category cases that people actually want: a video's audio track, and
 * a video as a looping GIF.
 */
export function targetsFor(source: FileFormat): FileFormat[] {
  const outputs = FORMATS.filter((format) => format.output && format.ext !== source.ext);
  switch (source.category) {
    case 'video':
      return outputs.filter((format) => format.category === 'video' || format.category === 'audio' || format.ext === 'gif');
    case 'document': {
      const tabular = TABLE_DOCUMENT_EXTS.has(source.ext);
      return outputs.filter((format) => format.category === 'document' && (tabular || !TABLE_DOCUMENT_EXTS.has(format.ext)));
    }
    default:
      return outputs.filter((format) => format.category === source.category);
  }
}

export function canConvert(source: FileFormat, target: FileFormat): boolean {
  return targetsFor(source).some((format) => format.ext === target.ext);
}

/** Group the target list the way the picker shows it. */
export function groupTargets(targets: FileFormat[]): { category: FormatCategory; formats: FileFormat[] }[] {
  const order: FormatCategory[] = ['image', 'audio', 'video', 'document'];
  return order
    .map((category) => ({ category, formats: targets.filter((format) => format.category === category) }))
    .filter((group) => group.formats.length > 0);
}

export const CATEGORY_LABEL: Record<FormatCategory, string> = {
  image: 'Images',
  audio: 'Audio',
  video: 'Video',
  document: 'Documents',
};

/** Swap a file's extension, keeping the rest of the name. */
export function renameTo(name: string, ext: string): string {
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  return `${stem}.${ext}`;
}

/** What the browser itself decodes and encodes; the image engine's no-download path. */
export const CANVAS_DECODES = new Set(['png', 'jpeg', 'webp', 'gif', 'bmp', 'avif', 'ico', 'svg']);
export const CANVAS_ENCODES: Record<string, string> = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' };

/** True when an image conversion needs the WASM engine — worth saying before a 15 MB fetch. */
export function imageNeedsEngine(source: FileFormat, target: FileFormat): boolean {
  return !(CANVAS_ENCODES[target.ext] && CANVAS_DECODES.has(source.ext));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
