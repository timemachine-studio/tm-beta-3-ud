import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { decodeWorkspaceArchive } from './workspaceArchive';
import { MAX_WORKSPACE_FILE_BYTES } from '../../../shared/maxMode';

describe('bounded ZIP decoding', () => {
  it('filters oversized and ignored files before extracting them', () => {
    const zip = zipSync({ 'project/a.ts': strToU8('ok'), 'project/huge.txt': new Uint8Array(MAX_WORKSPACE_FILE_BYTES + 1), 'project/node_modules/a.ts': strToU8('ignored') });
    const decoded = decodeWorkspaceArchive(zip);
    expect(decoded.files).toEqual([{ path: 'a.ts', content: 'ok' }]);
    expect(decoded.skipped).toEqual([{ path: 'huge.txt', reason: 'too large' }, { path: 'node_modules/a.ts', reason: 'ignored directory' }]);
  });
  it('keeps binary files intact', () => {
    const bytes = Uint8Array.of(0, 255, 0, 1);
    expect(decodeWorkspaceArchive(zipSync({ 'image.bin': bytes })).files).toEqual([{ path: 'image.bin', content: bytes }]);
  });
  it('rejects total expanded contents above the import budget', () => {
    const files: Record<string, Uint8Array> = {};
    for (let i = 0; i < 129; i++) files[`${i}.bin`] = new Uint8Array(MAX_WORKSPACE_FILE_BYTES);
    expect(() => decodeWorkspaceArchive(zipSync(files))).toThrow('Expanded ZIP contents exceed 64 MB');
  });
});
