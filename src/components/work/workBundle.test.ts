import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import type { WorkFile } from '../../../shared/work';
import { workDeliverablesBundle } from './workBundle';

const file = (path: string, content: string, source = false, kind: WorkFile['kind'] = 'text') => ({
  id: crypto.randomUUID(), task_id: crypto.randomUUID(), path, content, source, kind,
  revision: 2, updated_at: '2026-09-28T00:00:00Z',
}) satisfies WorkFile;

describe('Work deliverables archive', () => {
  it('keeps nested output paths, omits originals and neutralizes CSV formulas', async () => {
    const archive = workDeliverablesBundle([
      file('private-notes.txt', 'do not export', true),
      file('reports/brief.md', '# Findings', false, 'markdown'),
      file('tables/results.csv', 'name,value\nitem,=HYPERLINK("evil")', false, 'csv'),
    ]);
    expect(archive.type).toBe('application/zip');
    const entries = unzipSync(new Uint8Array(await archive.arrayBuffer()));
    expect(Object.keys(entries).sort()).toEqual(['manifest.json', 'reports/brief.md', 'tables/results.csv']);
    expect(strFromU8(entries['reports/brief.md'])).toBe('# Findings');
    expect(strFromU8(entries['tables/results.csv'])).toContain("'=HYPERLINK");
    const manifest = JSON.parse(strFromU8(entries['manifest.json']));
    expect(manifest.files).toEqual([
      { path: 'reports/brief.md', kind: 'markdown', revision: 2, updatedAt: '2026-09-28T00:00:00Z' },
      { path: 'tables/results.csv', kind: 'csv', revision: 2, updatedAt: '2026-09-28T00:00:00Z' },
    ]);
  });
  it('rejects missing outputs and unsafe or duplicate archive paths', () => {
    expect(() => workDeliverablesBundle([file('source.txt', 'x', true)])).toThrow();
    expect(() => workDeliverablesBundle([file('../escape.txt', 'x')])).toThrow();
    expect(() => workDeliverablesBundle([file('same.txt', 'x'), file('same.txt', 'y')])).toThrow();
    expect(() => workDeliverablesBundle([file('manifest.json', '{}')])).toThrow();
  });
});
