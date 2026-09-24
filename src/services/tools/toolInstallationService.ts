import { supabase } from '../../lib/supabase';
import type { RegistryToolPayload } from '../../../shared/toolRegistry';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Pin the exact registry version that just ran; only metadata is synced. */
export async function recordRegistryToolExecution(tool: RegistryToolPayload, succeeded: boolean): Promise<void> {
  // This migration is newer than the checked-in generated Database type. Keep
  // the escape local; the migration and runtime payload validate the shape.
  const client = supabase as unknown as SupabaseClient;
  const { data } = await client.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return;

  await client.rpc('record_tool_execution', { tool_id: tool.id, succeeded });
  if (!succeeded) return;

  await client.from('user_tool_installations').upsert({
    user_id: userId,
    tool_id: tool.id,
    slug: tool.slug,
    version: tool.version,
    digest: tool.digest,
    installed_at: new Date().toISOString(),
  }, { onConflict: 'user_id,slug' });
}
