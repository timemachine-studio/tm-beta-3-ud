import { describe, expect, it } from 'vitest';
import { detectFileConvert, parseTarget } from './fileConverter';

describe('detectFileConvert', () => {
  it('opens on the slash command with or without a target', () => {
    expect(detectFileConvert('/convert')).toEqual({ target: null, sourceHint: null, query: '' });
    expect(detectFileConvert('/convert png')?.target?.ext).toBe('png');
    expect(detectFileConvert('/convert to WebP')?.target?.ext).toBe('webp');
    expect(detectFileConvert('/converter')).not.toBeNull();
    expect(detectFileConvert('/convert xyz')).toEqual({ target: null, sourceHint: null, query: 'xyz' });
  });

  it('reads natural requests', () => {
    expect(detectFileConvert('convert to png')?.target?.ext).toBe('png');
    expect(detectFileConvert('convert my photo to jpg')?.target?.ext).toBe('jpeg');
    expect(detectFileConvert('convert this heic file to jpeg')).toMatchObject({ target: { ext: 'jpeg' }, sourceHint: { ext: 'heic' } });
    expect(detectFileConvert('convert video into mp3')?.target?.ext).toBe('mp3');
  });

  it('reads a pair of extensions only when both are real and the second is writable', () => {
    expect(detectFileConvert('mp4 to mp3')).toMatchObject({ target: { ext: 'mp3' }, sourceHint: { ext: 'mp4' } });
    expect(detectFileConvert('HEIC -> jpg')?.target?.ext).toBe('jpeg');
    expect(detectFileConvert('docx to pdf')).toBeNull(); // pdf is read-only
    expect(detectFileConvert('km to miles')).toBeNull(); // the unit converter's
    expect(detectFileConvert('ts to js')).toBeNull();
    expect(detectFileConvert('convert')).toBeNull();
    expect(detectFileConvert('convert me to a believer')).toBeNull();
  });

  it('parses the focused-mode textbox', () => {
    expect(parseTarget('png')?.ext).toBe('png');
    expect(parseTarget('to .webp')?.ext).toBe('webp');
    expect(parseTarget('→ mp3')?.ext).toBe('mp3');
    expect(parseTarget('svg')).toBeNull();
    expect(parseTarget('png please')).toBeNull();
  });
});
