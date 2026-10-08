import { describe, expect, it } from 'vitest';
import { workFileDownload } from './workFiles';
import type { WorkFile } from '../../../shared/work';
describe('artifact downloads', () => {
  it('neutralizes spreadsheet formulas without changing stored files', () => {
    const file = { kind: 'csv', content: 'name,value\n=HYPERLINK("evil"),+1\n@bad,-3' } as WorkFile;
    expect(workFileDownload(file).content).toContain("'=HYPERLINK");
    expect(workFileDownload(file).content).toContain("'+1");
    expect(file.content).toContain('=HYPERLINK');
  });
  it('preserves plain text, including markup, as inert text', () => {
    const file = { kind: 'text', content: '<script>evil()</script>' } as WorkFile;
    expect(workFileDownload(file)).toEqual({ content: file.content, mime: 'text/plain;charset=utf-8' });
  });
});
