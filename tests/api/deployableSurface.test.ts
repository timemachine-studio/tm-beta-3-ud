import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const API_DIR = new URL('../../api/', import.meta.url).pathname;

/**
 * Vercel turns every file under `api/` into a deployed Function, one route per
 * file, and only skips paths whose segments start with `_`. A test file sitting
 * next to a handler is therefore shipped as a public endpoint — and it counts
 * against the per-deployment Function limit. Two of them (`api/search.test.ts`
 * and `api/pro-stream.test.ts`) took this project from 11 Functions to 13 and
 * failed the production deploy at "Deploying outputs", after a build that had
 * reported success. Nothing else in the toolchain notices: the files typecheck,
 * lint and pass as tests exactly like any other.
 *
 * Handler tests belong here in `tests/api/`, outside the scanned tree.
 */
function routableFiles(dir: string, prefix = ''): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (entry.startsWith('_')) return [];
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return routableFiles(full, `${prefix}${entry}/`);
    return /\.(ts|js|mjs)$/.test(entry) ? [`${prefix}${entry}`] : [];
  });
}

describe('deployable api/ surface', () => {
  it('ships no test or spec file as a Vercel Function', () => {
    const shipped = routableFiles(API_DIR).filter((file) => /\.(test|spec)\./.test(file));
    expect(shipped).toEqual([]);
  });

  it('ships only the handlers the deployment expects', () => {
    expect(routableFiles(API_DIR).sort()).toEqual([
      'ai-proxy.ts',
      'delete-account.ts',
      'image.ts',
      'mcp-approval.ts',
      'mcp-servers.ts',
      'music.ts',
      'musicCover.ts',
      'notes-ai.ts',
      'pro-generation.ts',
      'pro-stream.ts',
      'retention-cleanup.ts',
      'search.ts',
    ]);
  });
});

/**
 * Vercel runs `api/` as native Node ESM, where a relative import must carry
 * its extension. Vite and vitest resolve `./toolCatalog` to the .ts file,
 * `tsc` accepts it, and `vite build` never touches the server tree — so an
 * extensionless import passes every gate and then takes the whole Function
 * down at boot: `Cannot find module '/var/task/shared/toolCatalog'`. That is
 * what happened with shared/deviceTools.ts. The api/ files already write
 * `./x.js`; this holds shared/ and api/ to it.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.ts$/.test(entry) && !/\.test\.ts$/.test(entry) ? [full] : [];
  });
}

describe('server-side ESM imports', () => {
  it('names the extension on every relative import in shared/ and api/', () => {
    const roots = [new URL('../../shared/', import.meta.url).pathname, API_DIR];
    const offenders: string[] = [];
    for (const file of roots.flatMap(sourceFiles)) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/from\s+'(\.\.?\/[^']*)'/g)) {
        if (!/\.(js|json)$/.test(match[1])) offenders.push(`${file.replace(/.*\/(shared|api)\//, '$1/')}: ${match[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
