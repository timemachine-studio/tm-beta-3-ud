/**
 * The user's installed skills, and searching the public directories for more.
 *
 * Everything goes through /api/mcp-servers?skills=… rather than Supabase
 * directly: `user_skills` deliberately has no browser policies, and fetching
 * a SKILL.md from GitHub is the server's job. The content never comes back to
 * the browser — only its size — because the model is the one who reads it.
 */

import { supabase } from '../../lib/supabase';

export type SkillDirectory = 'skills.sh' | 'skillsmp';

export interface SkillSearchResult {
  source: SkillDirectory;
  id: string;
  name: string;
  repository: string;
  description: string;
  popularity: number;
  pageUrl: string;
  githubUrl: string | null;
}

export interface InstalledSkill {
  id: string;
  slug: string;
  name: string;
  description: string;
  source: SkillDirectory | 'github';
  sourceId: string | null;
  pageUrl: string | null;
  rawUrl: string;
  contentLength: number;
  enabled: boolean;
  createdAt: string;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
  };
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    return body?.error?.message || body?.error || fallback;
  } catch {
    return fallback;
  }
}

export async function searchSkills(source: SkillDirectory, query: string, signal?: AbortSignal): Promise<SkillSearchResult[]> {
  const params = new URLSearchParams({ skills: 'search', source, q: query });
  const response = await fetch(`/api/mcp-servers?${params}`, { headers: await authHeaders(), signal });
  if (!response.ok) throw new Error(await readError(response, 'Search failed'));
  const body = await response.json();
  return body.skills as SkillSearchResult[];
}

export async function listInstalledSkills(): Promise<{ skills: InstalledSkill[]; limit: number }> {
  const response = await fetch('/api/mcp-servers?skills=list', { headers: await authHeaders() });
  if (!response.ok) throw new Error(await readError(response, 'Could not load your skills'));
  return response.json();
}

export async function installSkill(result: SkillSearchResult): Promise<InstalledSkill> {
  const response = await fetch('/api/mcp-servers?skills=add', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      source: result.source,
      id: result.id,
      githubUrl: result.githubUrl ?? undefined,
      pageUrl: result.pageUrl,
      name: result.name,
      description: result.description || undefined,
    }),
  });
  if (!response.ok) throw new Error(await readError(response, 'Could not install that skill'));
  return (await response.json()).skill as InstalledSkill;
}

export async function setInstalledSkillEnabled(id: string, enabled: boolean): Promise<InstalledSkill> {
  const response = await fetch('/api/mcp-servers?skills=update', {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify({ id, enabled }),
  });
  if (!response.ok) throw new Error(await readError(response, 'Could not update that skill'));
  return (await response.json()).skill as InstalledSkill;
}

export async function removeInstalledSkill(id: string): Promise<void> {
  const response = await fetch('/api/mcp-servers?skills=remove', {
    method: 'DELETE',
    headers: await authHeaders(),
    body: JSON.stringify({ id }),
  });
  if (!response.ok) throw new Error(await readError(response, 'Could not remove that skill'));
}

/** "893,419 installs" / "253k stars" — the directory's own popularity signal. */
export function formatPopularity(result: SkillSearchResult): string {
  const n = result.popularity;
  const short = n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 10_000 ? `${Math.round(n / 1000)}k` : n.toLocaleString();
  return result.source === 'skills.sh' ? `${short} installs` : `${short} stars`;
}
