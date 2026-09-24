/**
 * Publishing a tool this browser wrote to the shared registry.
 *
 * Straight to Supabase with the user's own JWT — the deployment is at its
 * Function limit, and a row-level policy (`supabase/migrations/tool_registry.sql`)
 * is a better place for "only as yourself, only over your own slug" than a
 * route would be anyway. The server validates every row again on the way
 * back out, so nothing offered to a model depends on what the browser sent.
 *
 * Publishing is best-effort by design. A tool that could not be published
 * still works in the conversation that made it; the model is told which of
 * the two happened, and the user sees it on the card.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import type { ToolSpec } from '../../../shared/toolRegistry';
import { generatedToolPublicationIssue } from '../../../shared/toolRegistrySchema';
import type { PublishResult } from './publishResult';

interface RegistryRow {
  id: string;
  slug: string;
  version: number;
}

/** Published rows vanish under RLS as soon as an operator revokes them. */
export async function isRegistryToolActive(
  id: string,
  digest: string,
  client: SupabaseClient = supabase as unknown as SupabaseClient,
): Promise<boolean> {
  try {
    const { data, error } = await client.from('tool_registry').select('id')
      .eq('id', id).eq('digest', digest).maybeSingle();
    return !error && !!data;
  } catch {
    return false;
  }
}

/** Postgres error codes the insert can legitimately come back with. */
const UNIQUE_VIOLATION = '23505';
const RLS_VIOLATION = '42501';

export async function publishTool(
  spec: ToolSpec,
  digest: string,
  client: SupabaseClient = supabase as unknown as SupabaseClient,
  expectedUserId?: string,
): Promise<PublishResult> {
  const issue = generatedToolPublicationIssue(spec);
  if (issue) return { published: false, reason: 'unsafe_content', detail: issue };
  let sessionData;
  try {
    ({ data: sessionData } = await client.auth.getSession());
  } catch {
    return { published: false, reason: 'unavailable' };
  }
  const userId = sessionData.session?.user?.id;
  if (!userId) return { published: false, reason: 'anonymous' };
  if (expectedUserId && expectedUserId !== userId) return { published: false, reason: 'anonymous' };

  try {
    // The digest is what a tool *is*. If it is already there, publishing
    // again would only be refused by the unique constraint — so say so up
    // front and point at the row that exists.
    const existing = await client
      .from('tool_registry')
      .select('id,slug,version')
      .eq('digest', digest)
      .maybeSingle<RegistryRow>();
    if (existing.data) {
      return { published: true, id: existing.data.id, version: existing.data.version, reused: true };
    }

    // A repaired tool under the same slug is the next version of it. Only
    // published versions are visible from here, so a revoked one can leave a
    // gap — the retry below walks past it.
    const latest = await client
      .from('tool_registry')
      .select('version')
      .eq('slug', spec.slug)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle<{ version: number }>();
    let version = (latest.data?.version ?? 0) + 1;

    for (let attempt = 0; attempt < 3; attempt++, version++) {
      const inserted = await client
        .from('tool_registry')
        .insert({
          slug: spec.slug,
          version,
          digest,
          title: spec.title,
          description: spec.description,
          summary: spec.summary,
          parameters: spec.parameters,
          source: spec.source,
          terms: spec.terms,
          tests: spec.tests,
          author_id: userId,
        })
        .select('id,slug,version')
        .single<RegistryRow>();

      if (!inserted.error && inserted.data) {
        return { published: true, id: inserted.data.id, version: inserted.data.version, reused: false };
      }
      const error = inserted.error;
      if (error?.code === UNIQUE_VIOLATION) {
        // Same digest raced in from elsewhere, or a hidden version number.
        // The first case is a reuse; the second just needs the next number.
        if (error.message.includes('digest')) {
          const raced = await client.from('tool_registry').select('id,slug,version').eq('digest', digest).maybeSingle<RegistryRow>();
          if (raced.data) return { published: true, id: raced.data.id, version: raced.data.version, reused: true };
          // Exists but not visible: an operator revoked this exact code. It
          // must not come back under a new version number.
          return { published: false, reason: 'revoked' };
        }
        continue;
      }
      if (error?.code === RLS_VIOLATION) return { published: false, reason: 'slug_taken' };
      if (error?.message?.includes('too many tools')) return { published: false, reason: 'rate_limited' };
      return { published: false, reason: 'unavailable', detail: error?.message };
    }
    return { published: false, reason: 'unavailable', detail: 'version conflict' };
  } catch (error: unknown) {
    return { published: false, reason: 'unavailable', detail: error instanceof Error ? error.message : String(error) };
  }
}
