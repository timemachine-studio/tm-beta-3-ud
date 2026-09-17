/**
 * Finding skills on the public directories, and fetching what they point at.
 *
 * Two directories, one shape. skills.sh (Vercel's Agent Skills directory)
 * answers a search with `owner/repo/skill` ids and install counts, nothing
 * more; the skill itself lives in that GitHub repository at one of a few
 * conventional paths, the same ones its CLI (`npx skills add`) looks in.
 * skillsmp.com answers with a description and a direct link to the skill's
 * folder on GitHub. Either way the thing being installed is a SKILL.md on
 * raw.githubusercontent.com — nothing is ever fetched from anywhere else.
 *
 * Called from api/mcp-servers.ts rather than given its own route: Vercel
 * deploys one Function per file under api/, and this project is at the limit
 * (tests/api/deployableSurface.test.ts). Same reason mcpRegistry.ts lives here.
 *
 * **Everything returned here is untrusted.** Names, descriptions and the
 * SKILL.md body were written by whoever published the skill. Installing one
 * is the user's deliberate choice, and it only ever reaches that user's chats.
 */

const SKILLS_SH_SEARCH = 'https://skills.sh/api/search';
const SKILLSMP_SEARCH = 'https://skillsmp.com/api/v1/skills/search';
const RAW_GITHUB = 'https://raw.githubusercontent.com';
const GITHUB_API = 'https://api.github.com';
const REQUEST_TIMEOUT_MS = 10_000;

/** A SKILL.md larger than this is refused rather than truncated: half a skill is worse than none. */
export const MAX_SKILL_CHARS = 80_000;

export type SkillSource = 'skills.sh' | 'skillsmp';

/** What the client gets. One shape for both directories. */
export interface SkillSearchResult {
  source: SkillSource;
  /** The directory's own id: `owner/repo/skill` on skills.sh, its slug on skillsmp. */
  id: string;
  name: string;
  /** `owner/repo`. */
  repository: string;
  /** Empty for skills.sh, which does not return one; filled in when previewed. */
  description: string;
  /** Installs (skills.sh) or stars (skillsmp) — a popularity signal, labelled by the UI. */
  popularity: number;
  pageUrl: string;
  /** The skill's folder on GitHub, when the directory says where it is. */
  githubUrl: string | null;
}

export type SkillSearchOutcome =
  | { ok: true; skills: SkillSearchResult[]; note?: string }
  | { ok: false; status: number; code: 'PROVIDER_DOWN' | 'TIMEOUT' | 'RATE_LIMITED'; message: string };

// A leading dot is allowed — `.claude`, `.agents`, `.cursor` are where these
// repositories keep skills — but `.` and `..` are not, which the alnum that
// must follow the dot rules out.
const SAFE_SEGMENT = /^\.?[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/;

function safeSegment(value: unknown): string | null {
  return typeof value === 'string' && SAFE_SEGMENT.test(value) && !value.includes('..') ? value : null;
}

// ─── Search ─────────────────────────────────────────────────────────────────

interface SkillsShEntry { id?: string; skillId?: string; name?: string; installs?: number; source?: string }

export function toSkillsShResult(entry: SkillsShEntry): SkillSearchResult | null {
  const parts = typeof entry.id === 'string' ? entry.id.split('/') : [];
  if (parts.length !== 3 || !parts.every(safeSegment)) return null;
  const [owner, repo, skill] = parts;
  return {
    source: 'skills.sh',
    id: `${owner}/${repo}/${skill}`,
    name: String(entry.name || entry.skillId || skill).slice(0, 120),
    repository: `${owner}/${repo}`,
    description: '',
    popularity: Number.isFinite(entry.installs) ? Number(entry.installs) : 0,
    pageUrl: `https://skills.sh/${owner}/${repo}/${skill}`,
    githubUrl: null,
  };
}

interface SkillsMpEntry { id?: string; name?: string; author?: string; description?: string; githubUrl?: string; skillUrl?: string; stars?: number }

export function toSkillsMpResult(entry: SkillsMpEntry): SkillSearchResult | null {
  const location = typeof entry.githubUrl === 'string' ? parseGithubTreeUrl(entry.githubUrl) : null;
  if (!location || typeof entry.id !== 'string' || !entry.id) return null;
  const pageUrl = typeof entry.skillUrl === 'string' && entry.skillUrl.startsWith('https://skillsmp.com/') ? entry.skillUrl : `https://skillsmp.com/search?q=${encodeURIComponent(String(entry.name || ''))}`;
  return {
    source: 'skillsmp',
    id: entry.id.slice(0, 200),
    name: String(entry.name || location.path.split('/').pop() || 'skill').slice(0, 120),
    repository: `${location.owner}/${location.repo}`,
    description: String(entry.description || '').replace(/\s+/g, ' ').trim().slice(0, 600),
    popularity: Number.isFinite(entry.stars) ? Number(entry.stars) : 0,
    pageUrl,
    githubUrl: entry.githubUrl as string,
  };
}

async function fetchJson(url: URL, headers: Record<string, string>): Promise<{ status: number; body: unknown }> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { Accept: 'application/json', 'User-Agent': 'TimeMachine (skills search)', ...headers },
  });
  const body = response.ok ? await response.json().catch(() => null) : null;
  return { status: response.status, body };
}

export async function searchSkillsDirectory(source: SkillSource, query: string, limit: number): Promise<SkillSearchOutcome> {
  try {
    if (source === 'skills.sh') {
      const url = new URL(SKILLS_SH_SEARCH);
      url.searchParams.set('q', query);
      const { status, body } = await fetchJson(url, {});
      if (status === 429) return { ok: false, status: 429, code: 'RATE_LIMITED', message: 'skills.sh is rate limiting searches right now. Try again in a minute.' };
      if (status !== 200 || !body) return { ok: false, status: 502, code: 'PROVIDER_DOWN', message: `skills.sh returned ${status}` };
      const skills = ((body as { skills?: SkillsShEntry[] }).skills || [])
        .map(toSkillsShResult)
        .filter((entry): entry is SkillSearchResult => entry !== null)
        .slice(0, limit);
      return { ok: true, skills };
    }

    const url = new URL(SKILLSMP_SEARCH);
    url.searchParams.set('q', query);
    url.searchParams.set('limit', String(Math.min(limit, 50)));
    // Anonymous callers get 50 searches a day, shared by everyone behind this
    // deployment's egress. A key (SKILLSMP_API_KEY) raises that to 500.
    const apiKey = process.env.SKILLSMP_API_KEY;
    const { status, body } = await fetchJson(url, apiKey ? { Authorization: `Bearer ${apiKey}` } : {});
    if (status === 429) return { ok: false, status: 429, code: 'RATE_LIMITED', message: 'SkillsMP has no searches left for today on this deployment. Try skills.sh, or tomorrow.' };
    if (status !== 200 || !body) return { ok: false, status: 502, code: 'PROVIDER_DOWN', message: `SkillsMP returned ${status}` };
    const skills = ((body as { data?: { skills?: SkillsMpEntry[] } }).data?.skills || [])
      .map(toSkillsMpResult)
      .filter((entry): entry is SkillSearchResult => entry !== null)
      .slice(0, limit);
    return { ok: true, skills };
  } catch (error: unknown) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    return timedOut
      ? { ok: false, status: 504, code: 'TIMEOUT', message: `${source} did not answer in time` }
      : { ok: false, status: 502, code: 'PROVIDER_DOWN', message: `${source} could not be reached` };
  }
}

// ─── Locating the SKILL.md ──────────────────────────────────────────────────

export interface GithubLocation {
  owner: string;
  repo: string;
  /** A branch, tag or commit; `HEAD` when the URL did not name one. */
  ref: string;
  /** The skill's folder, no leading or trailing slash; '' for the repository root. */
  path: string;
}

/**
 * `https://github.com/{owner}/{repo}/tree/{ref}/{path}` or
 * `…/blob/{ref}/{path}/SKILL.md`, or a bare `https://github.com/{owner}/{repo}`.
 * Anything else — another host, a path segment that could climb — is refused.
 */
export function parseGithubTreeUrl(value: string): GithubLocation | null {
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'https:' || url.hostname !== 'github.com') return null;
  const segments = url.pathname.split('/').filter(Boolean);
  const owner = safeSegment(segments[0]);
  const repo = safeSegment((segments[1] || '').replace(/\.git$/, ''));
  if (!owner || !repo) return null;
  if (segments.length === 2) return { owner, repo, ref: 'HEAD', path: '' };
  if ((segments[2] !== 'tree' && segments[2] !== 'blob') || !segments[3]) return null;
  const ref = safeSegment(segments[3]);
  if (!ref) return null;
  const rest = segments.slice(4);
  if (!rest.every(safeSegment)) return null;
  if (segments[2] === 'blob') {
    if (rest[rest.length - 1] !== 'SKILL.md') return null;
    rest.pop();
  }
  return { owner, repo, ref, path: rest.join('/') };
}

export function rawSkillUrl(location: GithubLocation): string {
  const folder = location.path ? `${location.path}/` : '';
  return `${RAW_GITHUB}/${location.owner}/${location.repo}/${location.ref}/${folder}SKILL.md`;
}

/** Where `npx skills add owner/repo --skill name` looks, in the order it looks. */
export function candidateSkillPaths(skill: string): string[] {
  return [
    `skills/${skill}`,
    skill,
    `.claude/skills/${skill}`,
    `.agents/skills/${skill}`,
    `.cursor/skills/${skill}`,
    `.codex/skills/${skill}`,
    `.github/skills/${skill}`,
    `.opencode/skills/${skill}`,
    `.agent/skills/${skill}`,
  ];
}

export class SkillFetchError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = 'SkillFetchError';
  }
}

async function fetchRaw(url: string): Promise<string | null> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { Accept: 'text/plain', 'User-Agent': 'TimeMachine (skills install)' },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new SkillFetchError(`GitHub returned ${response.status} for that skill`, 502);
  const length = Number(response.headers.get('content-length')) || 0;
  if (length > MAX_SKILL_CHARS * 4) throw new SkillFetchError('That SKILL.md is too large to install', 400);
  const text = await response.text();
  if (text.length > MAX_SKILL_CHARS) throw new SkillFetchError(`That SKILL.md is ${Math.round(text.length / 1000)}k characters; the limit is ${MAX_SKILL_CHARS / 1000}k`, 400);
  return text;
}

/**
 * Last resort for a skills.sh id whose repository keeps skills somewhere
 * unusual: list the tree and look for any `{skill}/SKILL.md` at any depth.
 * Unauthenticated, so 60 calls an hour per egress IP — enough for a fallback,
 * which is all this is.
 */
async function locateViaTree(owner: string, repo: string, skill: string): Promise<GithubLocation | null> {
  const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'TimeMachine (skills install)' },
  });
  if (!response.ok) return null;
  const body = await response.json().catch(() => null) as { tree?: Array<{ path?: string; type?: string }> } | null;
  const suffix = `/${skill}/SKILL.md`;
  const hit = (body?.tree || []).find(entry => entry.type === 'blob' && typeof entry.path === 'string'
    && (entry.path === `${skill}/SKILL.md` || entry.path.endsWith(suffix))
    && entry.path.split('/').every(safeSegment));
  if (!hit?.path) return null;
  return { owner, repo, ref: 'HEAD', path: hit.path.slice(0, -'/SKILL.md'.length) };
}

export interface FetchedSkill {
  content: string;
  rawUrl: string;
  location: GithubLocation;
}

/** Resolve a directory entry to its SKILL.md and fetch it. */
export async function fetchSkillMarkdown(entry: { source: SkillSource | 'github'; id?: string; githubUrl?: string }): Promise<FetchedSkill> {
  // A folder the directory pointed at (skillsmp), or a link the user pasted.
  if (entry.githubUrl) {
    const location = parseGithubTreeUrl(entry.githubUrl);
    if (!location) throw new SkillFetchError('That is not a GitHub folder or SKILL.md link', 400);
    const rawUrl = rawSkillUrl(location);
    const content = await fetchRaw(rawUrl);
    if (content == null) throw new SkillFetchError('No SKILL.md at that location', 404);
    return { content, rawUrl, location };
  }

  // A skills.sh id: try the conventional folders, then the tree.
  const parts = (entry.id || '').split('/');
  if (parts.length !== 3 || !parts.every(safeSegment)) throw new SkillFetchError('That skill id is not owner/repo/skill', 400);
  const [owner, repo, skill] = parts;
  for (const path of candidateSkillPaths(skill)) {
    const location = { owner, repo, ref: 'HEAD', path };
    const rawUrl = rawSkillUrl(location);
    const content = await fetchRaw(rawUrl);
    if (content != null) return { content, rawUrl, location };
  }
  const located = await locateViaTree(owner, repo, skill);
  if (located) {
    const rawUrl = rawSkillUrl(located);
    const content = await fetchRaw(rawUrl);
    if (content != null) return { content, rawUrl, location: located };
  }
  throw new SkillFetchError(`Could not find ${skill}/SKILL.md in ${owner}/${repo}`, 404);
}

// ─── Front matter ───────────────────────────────────────────────────────────

export interface SkillFrontmatter {
  name: string | null;
  description: string | null;
  /** The markdown after the front matter block. */
  body: string;
}

/**
 * The Agent Skills format opens with a YAML block carrying `name` and
 * `description`. Only those two keys are read, as single-line scalars
 * (quoted or bare) or a folded `>` / `|` block; a real YAML parser is not
 * worth a dependency for two fields.
 */
export function parseSkillFrontmatter(markdown: string): SkillFrontmatter {
  const text = markdown.replace(/^\uFEFF/, '');
  const match = text.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!match) return { name: null, description: null, body: text };
  const lines = match[1].split(/\r?\n/);
  const fields: Record<string, string> = {};
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].match(/^([A-Za-z_][A-Za-z0-9_-]*):[ \t]*(.*)$/);
    if (!line) continue;
    const key = line[1].toLowerCase();
    let value = line[2].trim();
    if (value === '>' || value === '|' || value === '>-' || value === '|-') {
      const block: string[] = [];
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) block.push(lines[++i].trim());
      value = block.join(' ');
    } else if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    fields[key] = value;
  }
  return {
    name: fields.name?.trim() || null,
    description: fields.description?.replace(/\s+/g, ' ').trim() || null,
    body: text.slice(match[0].length),
  };
}

/** `Frontend Design!` → `frontend-design`, unique against what the user has. */
export function skillSlug(name: string, taken: Set<string>): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'skill';
  if (!taken.has(base)) return base;
  for (let suffix = 2; suffix < 100; suffix++) {
    const candidate = `${base}-${suffix}`.slice(0, 62);
    if (!taken.has(candidate)) return candidate;
  }
  throw new SkillFetchError('Could not find a free name for this skill', 400);
}
