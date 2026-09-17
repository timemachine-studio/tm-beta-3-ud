import { describe, expect, it } from 'vitest';
import { FORMATS, canConvert, extensionOf, formatByExt, formatOfFile, renameTo, targetsFor } from './formats';

describe('format catalogue', () => {
  it('has no duplicate extensions or aliases', () => {
    const seen = new Set<string>();
    for (const format of FORMATS) {
      for (const ext of [format.ext, ...(format.aliases ?? [])]) {
        expect(seen.has(ext), `${ext} listed twice`).toBe(false);
        seen.add(ext);
      }
    }
  });

  it('resolves aliases, dots and case to the canonical format', () => {
    expect(formatByExt('JPG')?.ext).toBe('jpeg');
    expect(formatByExt('.tif')?.ext).toBe('tiff');
    expect(formatByExt('htm')?.ext).toBe('html');
    expect(formatByExt('m4v')?.ext).toBe('mp4');
    expect(formatByExt('exe')).toBeNull();
  });

  it('reads a file by its name, then by its MIME type', () => {
    expect(formatOfFile({ name: 'IMG_0001.HEIC' })?.ext).toBe('heic');
    expect(formatOfFile({ name: 'clipboard', type: 'image/png' })?.ext).toBe('png');
    expect(formatOfFile({ name: 'archive.zip', type: 'application/zip' })).toBeNull();
    expect(extensionOf('.bashrc')).toBe('');
    expect(extensionOf('notes.final.md')).toBe('md');
  });

  it('keeps read-only formats out of the target list', () => {
    const heic = formatByExt('heic')!;
    const targets = targetsFor(heic).map((format) => format.ext);
    expect(targets).toContain('jpeg');
    expect(targets).not.toContain('heic');
    expect(targets).not.toContain('svg');
    expect(targets).not.toContain('nef');
    expect(targets.every((ext) => formatByExt(ext)?.category === 'image')).toBe(true);
  });

  it('lets a video become audio or a gif, and nothing else crosses categories', () => {
    const mp4 = formatByExt('mp4')!;
    const targets = targetsFor(mp4).map((format) => format.ext);
    expect(targets).toContain('mp3');
    expect(targets).toContain('gif');
    expect(targets).not.toContain('png');
    expect(targets).not.toContain('docx');
    expect(canConvert(formatByExt('mp3')!, formatByExt('mp4')!)).toBe(false);
    expect(canConvert(formatByExt('png')!, formatByExt('mp3')!)).toBe(false);
  });

  it('separates prose documents from tabular ones', () => {
    const docx = targetsFor(formatByExt('docx')!).map((format) => format.ext);
    expect(docx).toEqual(expect.arrayContaining(['md', 'txt', 'html']));
    expect(docx).not.toContain('csv');
    expect(docx).not.toContain('pdf');
    const csv = targetsFor(formatByExt('csv')!).map((format) => format.ext);
    expect(csv).toEqual(expect.arrayContaining(['tsv', 'json', 'md', 'html', 'docx']));
  });

  it('renames keeping the stem', () => {
    expect(renameTo('holiday.HEIC', 'jpeg')).toBe('holiday.jpeg');
    expect(renameTo('report.final.docx', 'md')).toBe('report.final.md');
    expect(renameTo('noext', 'png')).toBe('noext.png');
  });
});
