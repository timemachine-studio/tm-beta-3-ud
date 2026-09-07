import type { SupabaseClient } from '@supabase/supabase-js';
import { RETENTION } from './policy.js';

/** Existing-schema cleanup. Never touches saved history, notes, memories or
 * files. Caller must provide a server-only client and explicitly authorize
 * cleanup in the target environment. Errors contain no database diagnostics. */
export async function cleanupProcessingData(client: SupabaseClient, now = Date.now()): Promise<void> {
  const iso = (age: number) => new Date(now - age).toISOString();
  const operations = [
    () => client.from('pro_generation_jobs').update({ status: 'failed', final_content: null, error: 'PROCESSING_EXPIRED' })
      .eq('status', 'running').lte('created_at', iso(RETENTION.abandonedRunMs)),
    () => client.from('pro_generation_jobs').update({ final_content: null, error: null })
      .in('status', ['completed', 'failed']).lte('updated_at', iso(RETENTION.recoveryMs))
      .or('final_content.not.is.null,error.not.is.null'),
    () => client.from('pro_generation_jobs').update({ final_content: null, error: null })
      .lte('created_at', iso(RETENTION.maxRunAgeMs)).or('final_content.not.is.null,error.not.is.null'),
    // Keep external run identifiers until processor deletion is verified. Losing
    // those references would make outstanding deletion requests untraceable.
    () => client.from('pro_generation_jobs').delete().is('run_id', null).lte('created_at', iso(RETENTION.metadataMs)),
    () => client.from('mcp_tool_runs').update({ status: 'expired', continuation_state: null, argument_preview: {}, error_code: null })
      .in('status', ['pending', 'approved']).lte('expires_at', iso(0)),
    () => client.from('mcp_tool_runs').update({ continuation_state: null, argument_preview: {}, error_code: null })
      .in('status', ['succeeded', 'failed', 'denied', 'expired']),
    () => client.from('mcp_tool_runs').update({ status: 'failed', continuation_state: null, argument_preview: {}, error_code: 'PROCESSING_EXPIRED' })
      .eq('status', 'executing').lte('updated_at', iso(RETENTION.abandonedRunMs)),
    () => client.from('mcp_tool_runs').delete().lte('created_at', iso(RETENTION.metadataMs)),
  ];
  const failures: number[] = [];
  for (const [index, operation] of operations.entries()) {
    try {
      const { error } = await operation();
      if (error) failures.push(index);
    } catch { failures.push(index); }
  }
  if (failures.length) throw new Error(`retention_cleanup_failed:${failures.join(',')}`);
}
