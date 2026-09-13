import { describe, expect, it } from 'vitest';
import { diffSummary, lineDiff } from './diff';
import { globToRegExp } from './workspaceTools';
import { HARNESS_ACTION_MARKER, harnessActionMarker, stripHarnessMarkers } from '../../types/chat';
import { buildPreviewDocument } from './previewController';

describe('lineDiff', () => {
  it('counts and shows a small change with context', () => {
    const before = 'a\nb\nc\nd\ne\n';
    const after = 'a\nb\nC\nd\ne\nf\n';
    const diff = lineDiff(before, after);
    expect(diffSummary(diff)).toBe('+2 −1');
    expect(diff.unified).toContain('-c');
    expect(diff.unified).toContain('+C');
    expect(diff.unified).toContain('+f');
    expect(diff.unified?.startsWith('@@')).toBe(true);
  });

  it('reports no change as empty rather than null', () => {
    expect(lineDiff('same\n', 'same\n')).toEqual({ added: 0, removed: 0, unified: '' });
  });

  it('falls back to counts on a file too large to align', () => {
    const big = Array.from({ length: 2_000 }, (_, i) => `line ${i}`).join('\n');
    const diff = lineDiff(big, `${big}\nextra`);
    expect(diff.added).toBe(1);
    expect(diff.removed).toBe(0);
    expect(diff.unified).toBeNull();
  });
});

describe('globToRegExp', () => {
  it('matches the way people type globs', () => {
    expect(globToRegExp('*.ts').test('src/a.ts')).toBe(true);
    expect(globToRegExp('*.ts').test('src/a.tsx')).toBe(false);
    expect(globToRegExp('src/**/*.ts').test('src/a.ts')).toBe(true);
    expect(globToRegExp('src/**/*.ts').test('src/x/y/a.ts')).toBe(true);
    expect(globToRegExp('src/**/*.ts').test('lib/a.ts')).toBe(false);
    expect(globToRegExp('src/*.ts').test('src/x/a.ts')).toBe(false);
    expect(globToRegExp('').test('anything')).toBe(true);
  });
});

describe('harness markers', () => {
  it('survive a split and strip cleanly', () => {
    const content = `Reading first.\n\n${harnessActionMarker('call_1')}\n\nNow editing.\n\n${harnessActionMarker('call-2')}\n\nDone.`;
    const parts = content.split(HARNESS_ACTION_MARKER);
    expect(parts.filter((_, index) => index % 2 === 1)).toEqual(['call_1', 'call-2']);
    expect(stripHarnessMarkers(content)).toBe('Reading first.\n\nNow editing.\n\nDone.');
    expect(stripHarnessMarkers('plain')).toBe('plain');
  });
});

describe('buildPreviewDocument', () => {
  it('injects the console capture and leaves absolute references alone', async () => {
    const html = '<html><head><link rel="stylesheet" href="https://cdn.example/x.css"></head><body><script src="https://cdn.example/x.js"></script></body></html>';
    // The store is empty in this test, so nothing resolves; the document
    // still gets its capture script and keeps every remote reference.
    const out = await buildPreviewDocument('session', 'index.html', html, 7);
    expect(out).toContain('tm-preview');
    expect(out).toContain('https://cdn.example/x.css');
    expect(out).toContain('https://cdn.example/x.js');
    expect(out.indexOf('<script>')).toBeLessThan(out.indexOf('<link'));
  });
});
