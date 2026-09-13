import { describe, expect, it } from 'vitest';
import { gunzipSync, gzipSync } from 'node:zlib';
import { gitBlobSha, mintState, safeReturnPath, tarEntries, verifyState } from './github.js';

const config = { slug: 'tm', clientId: 'id', clientSecret: 'secret' };

describe('OAuth state', () => {
  it('round-trips the user and return path, signed', () => {
    const state = mintState(config, 'user-1', '/max/abc');
    const verified = verifyState(config, state);
    expect(verified?.userId).toBe('user-1');
    expect(verified?.returnTo).toBe('/max/abc');
  });

  it('refuses a state signed with a different secret, or tampered with', () => {
    const state = mintState({ ...config, clientSecret: 'other' }, 'user-1', '/max');
    expect(verifyState(config, state)).toBeNull();
    const [payload, signature] = mintState(config, 'user-1', '/max').split('.');
    const tampered = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url').toString()), userId: 'user-2' })).toString('base64url');
    expect(verifyState(config, `${tampered}.${signature}`)).toBeNull();
  });

  it('keeps the return path on our own origin', () => {
    expect(safeReturnPath('https://evil.example/')).toBe('/max');
    expect(safeReturnPath('//evil.example')).toBe('/max');
    expect(safeReturnPath('/max/abc?x=1')).toBe('/max/abc?x=1');
    expect(safeReturnPath(undefined)).toBe('/max');
  });
});

describe('gitBlobSha', () => {
  it('matches git hash-object', () => {
    // `printf 'hello\n' | git hash-object --stdin`
    expect(gitBlobSha(Buffer.from('hello\n'))).toBe('ce013625030ba8dba906f756967f9e9ca394464a');
  });
});

/** A minimal ustar writer, enough to exercise the reader. */
function tar(entries: Array<{ name: string; data?: string; type?: string }>): Buffer {
  const blocks: Buffer[] = [];
  for (const entry of entries) {
    const data = Buffer.from(entry.data ?? '');
    const header = Buffer.alloc(512);
    header.write(entry.name.slice(0, 100), 0, 'utf8');
    header.write('0000644\0', 100);
    header.write('0000000\0', 108);
    header.write('0000000\0', 116);
    header.write(`${data.length.toString(8).padStart(11, '0')}\0`, 124);
    header.write('00000000000\0', 136);
    header.write('        ', 148);
    header.write(entry.type ?? '0', 156);
    header.write('ustar\0', 257);
    header.write('00', 263);
    let sum = 0;
    for (const byte of header) sum += byte;
    header.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148);
    blocks.push(header, data, Buffer.alloc((512 - (data.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return Buffer.concat(blocks);
}

describe('tarEntries', () => {
  it('yields regular files and skips directories', () => {
    const archive = tar([
      { name: 'repo-abc/', type: '5' },
      { name: 'repo-abc/README.md', data: '# hi\n' },
      { name: 'repo-abc/src/', type: '5' },
      { name: 'repo-abc/src/index.ts', data: 'export {};\n' },
    ]);
    const files = [...tarEntries(archive)];
    expect(files.map(file => file.path)).toEqual(['repo-abc/README.md', 'repo-abc/src/index.ts']);
    expect(files[1].bytes.toString()).toBe('export {};\n');
  });

  it('honours pax path headers for long names', () => {
    const longName = `repo-abc/${'deep/'.repeat(30)}file.txt`;
    // "<len> path=<value>\n", where len counts its own digits.
    const rest = ` path=${longName}\n`;
    let length = rest.length + 1;
    while (String(length).length + rest.length !== length) length++;
    const paxRecord = `${length}${rest}`;
    const archive = tar([
      { name: 'repo-abc/PaxHeader/file.txt', type: 'x', data: paxRecord },
      { name: 'repo-abc/truncated-name', data: 'x' },
    ]);
    const files = [...tarEntries(archive)];
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe(longName);
  });

  it('survives a gzip round trip the way the tarball endpoint delivers it', () => {
    const archive = tar([{ name: 'r-1/a.txt', data: 'a' }]);
    const gz = gzipSync(archive);
    expect([...tarEntries(gunzipSync(gz))][0].path).toBe('r-1/a.txt');
  });
});

describe('publishing from a known checkout', () => {
  it('rejects a stale remote head before creating blobs or commits', async () => {
    const { vi } = await import('vitest');
    const { pushChanges } = await import('./github.js');
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ object: { sha: 'b'.repeat(40) } }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    try {
      await expect(pushChanges('test-token', { owner: 'o', name: 'r', base: 'main', branch: 'tm/fix', title: 'Fix', body: '', expectedHead: 'a'.repeat(40), changes: [{ path: 'a.ts', content: 'new' }] })).rejects.toThrow('remote branch changed');
      expect(fetcher).toHaveBeenCalledTimes(1);
    } finally { vi.unstubAllGlobals(); }
  });
  it('refuses a direct push to the base branch', async () => {
    const { pushChanges } = await import('./github.js');
    await expect(pushChanges('test-token', { owner: 'o', name: 'r', base: 'main', branch: 'main', title: 'Fix', body: '', expectedHead: 'a'.repeat(40), changes: [{ path: 'a.ts', content: 'new' }] })).rejects.toThrow('separate branch');
  });
});
