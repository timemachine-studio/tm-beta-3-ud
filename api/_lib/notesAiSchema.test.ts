import { describe, expect, it } from 'vitest';
import { notesAiBodySchema } from './validation.js';

const base = {
  title: 'Q2 planning',
  blocks: [{ index: 0, id: 'a', type: 'text', content: 'Rough thoughts.' }],
  instruction: 'Tighten this up.',
};

describe('notesAiBodySchema', () => {
  it('accepts a model and device-prepared attachments', () => {
    const parsed = notesAiBodySchema.safeParse({
      ...base,
      model: 'pro',
      attachments: {
        images: ['data:image/jpeg;base64,/9j/4AAQ'],
        files: [{ name: 'notes.txt', text: 'Hello' }],
      },
    });
    expect(parsed.success).toBe(true);
  });

  it('still accepts the original three-field body', () => {
    expect(notesAiBodySchema.safeParse(base).success).toBe(true);
  });

  it('rejects an unknown model', () => {
    expect(notesAiBodySchema.safeParse({ ...base, model: 'gpt-4' }).success).toBe(false);
  });

  it('rejects an image that is not an inline image data URL', () => {
    // A remote URL would make the transcriber fetch on the caller's behalf.
    expect(notesAiBodySchema.safeParse({ ...base, attachments: { images: ['https://example.com/x.png'] } }).success).toBe(false);
    expect(notesAiBodySchema.safeParse({ ...base, attachments: { images: ['data:text/html;base64,PGI+'] } }).success).toBe(false);
  });

  it('bounds how much can ride along', () => {
    const img = 'data:image/png;base64,AAAA';
    expect(notesAiBodySchema.safeParse({ ...base, attachments: { images: [img, img, img, img, img] } }).success).toBe(false);
    const file = { name: 'f.txt', text: 'x' };
    expect(notesAiBodySchema.safeParse({ ...base, attachments: { files: [file, file, file, file] } }).success).toBe(false);
    expect(notesAiBodySchema.safeParse({ ...base, attachments: { files: [{ name: 'f.txt', text: 'x'.repeat(60_001) }] } }).success).toBe(false);
  });
});
