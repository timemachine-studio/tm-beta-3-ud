import { describe, expect, it } from 'vitest';
import { FILE_STORE_CAP_BYTES, planEviction, type StoredFileMeta } from './fileStore';

const file = (id: string, size: number, createdAt: string): StoredFileMeta => ({
  id, size, createdAt, name: `${id}.bin`, mime: 'application/octet-stream', source: 'python',
});

describe('making room in the file store', () => {
  it('evicts nothing while there is room', () => {
    expect(planEviction([file('a', 10, '2026-01-01T00:00:00Z')], 10, 100)).toEqual([]);
  });

  it('evicts oldest first, and only as far as it has to', () => {
    // Oldest first because a file generated ten conversations ago is the one
    // the user is least likely to open. Only as far as it has to, because
    // every eviction is a download that silently stops working.
    const existing = [
      file('old', 40, '2026-01-01T00:00:00Z'),
      file('middle', 40, '2026-02-01T00:00:00Z'),
      file('new', 40, '2026-03-01T00:00:00Z'),
    ];
    // 120 stored + 60 incoming against a cap of 100: two have to go, and the
    // third stays because by then it fits.
    expect(planEviction(existing, 60, 100)).toEqual(['old', 'middle']);
    // A smaller arrival costs only one of them.
    expect(planEviction(existing, 20, 100)).toEqual(['old']);
  });

  it('does not depend on the order it is handed the files', () => {
    const existing = [
      file('new', 60, '2026-03-01T00:00:00Z'),
      file('old', 60, '2026-01-01T00:00:00Z'),
    ];
    expect(planEviction(existing, 10, 100)).toEqual(['old']);
  });

  it('has a cap big enough for real documents', () => {
    // A spreadsheet or a PDF with images in it is megabytes, not kilobytes.
    // The point of moving off the message was to stop that being a problem.
    expect(FILE_STORE_CAP_BYTES).toBeGreaterThanOrEqual(100_000_000);
  });
});
