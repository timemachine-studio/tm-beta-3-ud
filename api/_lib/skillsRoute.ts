/**
 * The skills side of /api/mcp-servers?skills=<action>.
 *
 * Actions: search · list · add · update · remove. The user is already verified
 * by the time this runs. `user_skills` has no browser policies, so this is
 * the only way rows are read or written, and the service-role client is
 * scoped to the user's id by hand on every query.
 *
 * Adding a skill fetches its SKILL.md from GitHub here, on the server, and
 * stores it in one step — the browser never carries the content, and the
 * only hosts ever fetched are the two directories and raw.githubusercontent.
 */

import { z } from 'zod';
import type { VercelRequest, VercelResponse } from './vercelTypes.js';
import type { AuthenticatedRequestUser } from './auth.js';
import { apiErrorBody } from './errors.js';
import { parseOrReject } from './validation.js';
import { flightControlsAdmin, invalidateFlightControlsCache, MAX_USER_SKILLS } from './flightControls.js';
import {
  fetchSkillMarkdown,
  parseSkillFrontmatter,
  searchSkillsDirectory,
  SkillFetchError,
  skillSlug,
  type SkillSource,
} from './skillsRegistry.js';

const searchSchema = z.object({
  q: z.string().trim().min(1).max(120),
  source: z.enum(['skills.sh', 'skillsmp']).default('skills.sh'),
  limit: z.coerce.number().int().min(1).max(30).default(12),
});

const addSchema = z.object({
  source: z.enum(['skills.sh', 'skillsmp']),
  /** skills.sh: `owner/repo/skill`. skillsmp: its own id, kept for the record. */
  id: z.string().min(1).max(300),
  /** skillsmp gives the folder; skills.sh is resolved from the id. */
  githubUrl: z.string().url().max(600).optional(),
  pageUrl: z.string().url().max(600).optional(),
  /** The directory's name for it, used when the front matter has none. */
  name: z.string().max(120).optional(),
  description: z.string().max(600).optional(),
});

const updateSchema = z.object({ id: z.string().uuid(), enabled: z.boolean() });
const removeSchema = z.object({ id: z.string().uuid() });

/**
 * PostgREST's message when the migration has not been run. Worth naming: the
 * panel then says what to do instead of "could not save".
 */
const NOT_SET_UP = 'Skills are not set up on this deployment yet — run supabase/migrations/user_skills.sql in the Supabase SQL editor.';
function isMissingTable(error: { message?: string; code?: string } | null): boolean {
  return !!error && (error.code === 'PGRST205' || error.code === '42P01' || /user_skills.*schema cache|relation .*user_skills.* does not exist/i.test(error.message || ''));
}

/** A row as the browser sees it. The content stays on the server; its size is enough. */
function sanitize(row: Record<string, unknown>) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    source: row.source,
    sourceId: row.source_id,
    pageUrl: row.page_url,
    rawUrl: row.raw_url,
    contentLength: typeof row.content === 'string' ? row.content.length : 0,
    enabled: row.enabled,
    createdAt: row.created_at,
  };
}

export async function handleSkillsRequest(req: VercelRequest, res: VercelResponse, user: AuthenticatedRequestUser, action: string) {
  // ─── Search ───────────────────────────────────────────────────────────
  if (action === 'search' && req.method === 'GET') {
    const search = parseOrReject(res, searchSchema, req.query);
    if (!search) return;
    const outcome = await searchSkillsDirectory(search.source as SkillSource, search.q, search.limit);
    return outcome.ok
      ? res.status(200).json({ skills: outcome.skills })
      : res.status(outcome.status).json(apiErrorBody(outcome.code === 'RATE_LIMITED' ? 'RATE_LIMITED' : outcome.code, outcome.message));
  }

  // ─── List ─────────────────────────────────────────────────────────────
  if (action === 'list' && req.method === 'GET') {
    const { data, error } = await flightControlsAdmin
      .from('user_skills')
      .select('id,slug,name,description,source,source_id,page_url,raw_url,content,enabled,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    if (isMissingTable(error)) return res.status(503).json(apiErrorBody('UNAVAILABLE', NOT_SET_UP));
    if (error) return res.status(500).json(apiErrorBody('UNKNOWN', 'Could not load your skills'));
    return res.status(200).json({ skills: (data || []).map(sanitize), limit: MAX_USER_SKILLS });
  }

  // ─── Add ──────────────────────────────────────────────────────────────
  if (action === 'add' && req.method === 'POST') {
    const body = parseOrReject(res, addSchema, req.body || {});
    if (!body) return;

    const { count, error: countError } = await flightControlsAdmin
      .from('user_skills')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);
    // Found out before the GitHub fetch, so a missing table costs nothing.
    if (isMissingTable(countError)) return res.status(503).json(apiErrorBody('UNAVAILABLE', NOT_SET_UP));
    if ((count ?? 0) >= MAX_USER_SKILLS) {
      return res.status(400).json(apiErrorBody('BAD_REQUEST', `You can install up to ${MAX_USER_SKILLS} skills`));
    }

    let fetched;
    try {
      fetched = await fetchSkillMarkdown(body.source === 'skillsmp'
        ? { source: 'skillsmp', githubUrl: body.githubUrl }
        : { source: 'skills.sh', id: body.id });
    } catch (error: unknown) {
      if (error instanceof SkillFetchError) return res.status(error.status).json(apiErrorBody('BAD_REQUEST', error.message));
      return res.status(502).json(apiErrorBody('PROVIDER_DOWN', 'GitHub could not be reached'));
    }

    const frontmatter = parseSkillFrontmatter(fetched.content);
    const name = (frontmatter.name || body.name || fetched.location.path.split('/').pop() || 'Skill').slice(0, 80);
    const description = (frontmatter.description || body.description || '').slice(0, 600);

    const { data: existing } = await flightControlsAdmin.from('user_skills').select('slug').eq('user_id', user.id);
    const slug = skillSlug(name, new Set((existing || []).map(row => row.slug as string)));

    const { data: inserted, error } = await flightControlsAdmin
      .from('user_skills')
      .insert({
        user_id: user.id,
        slug,
        name,
        description,
        content: fetched.content,
        source: body.source,
        source_id: body.id.slice(0, 300),
        page_url: body.pageUrl ?? null,
        raw_url: fetched.rawUrl,
        enabled: true,
      })
      .select('id,slug,name,description,source,source_id,page_url,raw_url,content,enabled,created_at')
      .single();
    if (error || !inserted) {
      console.error('[Skills] insert failed:', error?.message);
      if (isMissingTable(error)) return res.status(503).json(apiErrorBody('UNAVAILABLE', NOT_SET_UP));
      return res.status(500).json(apiErrorBody('UNKNOWN', 'Could not save that skill'));
    }
    invalidateFlightControlsCache(user.id);
    return res.status(201).json({ skill: sanitize(inserted) });
  }

  // ─── Update ───────────────────────────────────────────────────────────
  if (action === 'update' && req.method === 'PATCH') {
    const body = parseOrReject(res, updateSchema, req.body || {});
    if (!body) return;
    const { data, error } = await flightControlsAdmin
      .from('user_skills')
      .update({ enabled: body.enabled })
      .eq('id', body.id)
      .eq('user_id', user.id)
      .select('id,slug,name,description,source,source_id,page_url,raw_url,content,enabled,created_at')
      .maybeSingle();
    if (error) return res.status(500).json(apiErrorBody('UNKNOWN', 'Could not update that skill'));
    if (!data) return res.status(404).json(apiErrorBody('BAD_REQUEST', 'That skill is not yours or no longer exists'));
    invalidateFlightControlsCache(user.id);
    return res.status(200).json({ skill: sanitize(data) });
  }

  // ─── Remove ───────────────────────────────────────────────────────────
  if (action === 'remove' && req.method === 'DELETE') {
    const body = parseOrReject(res, removeSchema, req.body || {});
    if (!body) return;
    const { error } = await flightControlsAdmin
      .from('user_skills')
      .delete()
      .eq('id', body.id)
      .eq('user_id', user.id);
    if (error) return res.status(500).json(apiErrorBody('UNKNOWN', 'Could not remove that skill'));
    invalidateFlightControlsCache(user.id);
    return res.status(200).json({ ok: true });
  }

  return res.status(404).json(apiErrorBody('BAD_REQUEST', 'Unknown skills action'));
}
