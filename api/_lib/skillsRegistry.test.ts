import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  candidateSkillPaths,
  fetchSkillMarkdown,
  parseGithubTreeUrl,
  parseSkillFrontmatter,
  rawSkillUrl,
  searchSkillsDirectory,
  skillSlug,
  toSkillsMpResult,
  toSkillsShResult,
} from './skillsRegistry.js';

describe('parseGithubTreeUrl', () => {
  it('reads tree, blob and bare repository links', () => {
    expect(parseGithubTreeUrl('https://github.com/affaan-m/ECC/tree/main/.agents/skills/frontend-patterns'))
      .toEqual({ owner: 'affaan-m', repo: 'ECC', ref: 'main', path: '.agents/skills/frontend-patterns' });
    expect(parseGithubTreeUrl('https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md'))
      .toEqual({ owner: 'anthropics', repo: 'skills', ref: 'main', path: 'skills/frontend-design' });
    expect(parseGithubTreeUrl('https://github.com/anthropics/skills.git'))
      .toEqual({ owner: 'anthropics', repo: 'skills', ref: 'HEAD', path: '' });
  });

  it('refuses other hosts, climbing paths and blobs that are not SKILL.md', () => {
    expect(parseGithubTreeUrl('https://gitlab.com/a/b/tree/main/x')).toBeNull();
    expect(parseGithubTreeUrl('http://github.com/a/b')).toBeNull();
    expect(parseGithubTreeUrl('https://github.com/a/b/tree/main/../../etc')).toBeNull();
    expect(parseGithubTreeUrl('https://github.com/a/b/blob/main/README.md')).toBeNull();
    expect(parseGithubTreeUrl('https://github.com/a')).toBeNull();
    expect(parseGithubTreeUrl('not a url')).toBeNull();
  });

  it('builds the raw URL for the folder', () => {
    expect(rawSkillUrl({ owner: 'o', repo: 'r', ref: 'main', path: 'skills/x' }))
      .toBe('https://raw.githubusercontent.com/o/r/main/skills/x/SKILL.md');
    expect(rawSkillUrl({ owner: 'o', repo: 'r', ref: 'HEAD', path: '' }))
      .toBe('https://raw.githubusercontent.com/o/r/HEAD/SKILL.md');
  });
});

describe('directory results', () => {
  it('normalises skills.sh entries and drops malformed ids', () => {
    expect(toSkillsShResult({ id: 'anthropics/skills/frontend-design', skillId: 'frontend-design', name: 'frontend-design', installs: 893419, source: 'anthropics/skills' }))
      .toEqual({
        source: 'skills.sh', id: 'anthropics/skills/frontend-design', name: 'frontend-design', repository: 'anthropics/skills',
        description: '', popularity: 893419, pageUrl: 'https://skills.sh/anthropics/skills/frontend-design', githubUrl: null,
      });
    expect(toSkillsShResult({ id: 'only/two' })).toBeNull();
    expect(toSkillsShResult({ id: 'a/b/../c' })).toBeNull();
  });

  it('normalises SkillsMP entries and keeps only ones that point at GitHub', () => {
    const result = toSkillsMpResult({
      id: 'affaan-m-ecc-agents-skills-frontend-patterns-skill-md', name: 'frontend-patterns', author: 'affaan-m',
      description: '  Frontend   patterns ', githubUrl: 'https://github.com/affaan-m/ECC/tree/main/.agents/skills/frontend-patterns',
      skillUrl: 'https://skillsmp.com/creators/affaan-m/ecc/agents-skills-frontend-patterns', stars: 253169,
    });
    expect(result).toMatchObject({ source: 'skillsmp', name: 'frontend-patterns', repository: 'affaan-m/ECC', description: 'Frontend patterns', popularity: 253169 });
    expect(toSkillsMpResult({ id: 'x', name: 'x', githubUrl: 'https://example.com/x' })).toBeNull();
  });

  it('lists the folders the skills CLI looks in, most common first', () => {
    const paths = candidateSkillPaths('demo');
    expect(paths[0]).toBe('skills/demo');
    expect(paths).toContain('.claude/skills/demo');
    expect(paths).toContain('.agents/skills/demo');
  });
});

describe('parseSkillFrontmatter', () => {
  it('reads name and description, quoted, bare or folded', () => {
    expect(parseSkillFrontmatter('---\nname: frontend-design\ndescription: "Distinctive, production-grade interfaces."\n---\n# Body\n'))
      .toEqual({ name: 'frontend-design', description: 'Distinctive, production-grade interfaces.', body: '# Body\n' });
    expect(parseSkillFrontmatter("---\nname: 'x'\ndescription: >\n  Line one\n  line two\nlicense: MIT\n---\nrest"))
      .toMatchObject({ name: 'x', description: 'Line one line two', body: 'rest' });
  });

  it('leaves a file without front matter alone', () => {
    expect(parseSkillFrontmatter('# Just markdown\n')).toEqual({ name: null, description: null, body: '# Just markdown\n' });
    expect(parseSkillFrontmatter('﻿---\nname: a\n---\nb').name).toBe('a');
  });
});

describe('skillSlug', () => {
  it('slugifies and avoids what the user already has', () => {
    expect(skillSlug('Frontend Design!', new Set())).toBe('frontend-design');
    expect(skillSlug('Frontend Design', new Set(['frontend-design']))).toBe('frontend-design-2');
    expect(skillSlug('!!!', new Set())).toBe('skill');
  });
});

describe('fetching (mocked network)', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; });

  const respond = (routes: Record<string, { status: number; body?: unknown; text?: string }>) => {
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input instanceof Request ? input.url : input);
      const hit = Object.entries(routes).find(([prefix]) => url.startsWith(prefix));
      if (!hit) return new Response('', { status: 404 });
      const { status, body, text } = hit[1];
      return new Response(text ?? JSON.stringify(body), { status, headers: { 'content-type': text != null ? 'text/plain' : 'application/json' } });
    }) as typeof fetch;
  };

  it('tries the conventional folders in order for a skills.sh id', async () => {
    respond({ 'https://raw.githubusercontent.com/o/r/HEAD/.claude/skills/demo/SKILL.md': { status: 200, text: '---\nname: demo\n---\nhi' } });
    const fetched = await fetchSkillMarkdown({ source: 'skills.sh', id: 'o/r/demo' });
    expect(fetched.rawUrl).toBe('https://raw.githubusercontent.com/o/r/HEAD/.claude/skills/demo/SKILL.md');
    expect(fetched.content).toContain('name: demo');
  });

  it('falls back to the repository tree, and fails clearly when nothing is there', async () => {
    respond({
      'https://api.github.com/repos/o/r/git/trees/HEAD': { status: 200, body: { tree: [{ path: 'packs/web/demo/SKILL.md', type: 'blob' }] } },
      'https://raw.githubusercontent.com/o/r/HEAD/packs/web/demo/SKILL.md': { status: 200, text: 'found' },
    });
    expect((await fetchSkillMarkdown({ source: 'skills.sh', id: 'o/r/demo' })).content).toBe('found');

    respond({});
    await expect(fetchSkillMarkdown({ source: 'skills.sh', id: 'o/r/missing' })).rejects.toThrow(/Could not find missing\/SKILL\.md/);
  });

  it('refuses a folder link that is not GitHub, and an oversized file', async () => {
    await expect(fetchSkillMarkdown({ source: 'skillsmp', githubUrl: 'https://example.com/x' })).rejects.toThrow(/not a GitHub/);
    respond({ 'https://raw.githubusercontent.com/o/r/main/big/SKILL.md': { status: 200, text: 'x'.repeat(80_001) } });
    await expect(fetchSkillMarkdown({ source: 'skillsmp', githubUrl: 'https://github.com/o/r/tree/main/big' })).rejects.toThrow(/limit is 80k/);
  });

  it('reports a rate-limited directory as such', async () => {
    respond({ 'https://skillsmp.com/api/v1/skills/search': { status: 429, body: {} } });
    const outcome = await searchSkillsDirectory('skillsmp', 'seo', 10);
    expect(outcome).toMatchObject({ ok: false, status: 429, code: 'RATE_LIMITED' });
  });
});
