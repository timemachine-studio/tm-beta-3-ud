import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://etpehiyzlkhknzceizar.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const serverSupabaseKey = serviceKey || process.env.VITE_SUPABASE_ANON_KEY || 'missing-supabase-key';

export const flightControlsAdmin = createClient(supabaseUrl, serverSupabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export interface ServerFlightControl {
  id: string;
  kind: 'skill' | 'mcp';
  slug: string;
  name: string;
  description: string;
  skill_content: string | null;
  mcp_server_url: string | null;
  mcp_auth_mode: 'none' | 'bearer_env' | null;
  mcp_auth_env_var: string | null;
  mcp_allowed_tools: string[];
  mcp_auto_approve_tools: string[];
  mcp_connect_timeout_ms: number;
  mcp_call_timeout_ms: number;
  mcp_result_char_limit: number;
  sort_order: number;
  default_enabled: boolean;
}

export async function loadEnabledFlightControls(userId: string | null): Promise<ServerFlightControl[]> {
  if (!userId || !serviceKey) return [];

  const [{ data: catalog, error: catalogError }, { data: settings, error: settingsError }] = await Promise.all([
    flightControlsAdmin
      .from('flight_control_catalog')
      .select('*')
      .eq('is_published', true)
      .order('sort_order', { ascending: true }),
    flightControlsAdmin
      .from('user_flight_control_settings')
      .select('catalog_id,enabled')
      .eq('user_id', userId),
  ]);

  if (catalogError) {
    console.error('[Flight Controls] Catalog load failed:', catalogError.message);
    return [];
  }
  if (settingsError) console.error('[Flight Controls] Preference load failed:', settingsError.message);

  const preferences = new Map((settings || []).map(row => [row.catalog_id, row.enabled]));
  return (catalog || []).filter(row => preferences.get(row.id) ?? row.default_enabled) as ServerFlightControl[];
}

export function enabledSkills(controls: ServerFlightControl[]) {
  return controls.filter(control => control.kind === 'skill' && control.skill_content);
}

export function enabledMcpServers(controls: ServerFlightControl[]) {
  return controls.filter(control => control.kind === 'mcp').slice(0, 5);
}

/**
 * Keep approval payloads short-lived and audit metadata bounded. This is run
 * opportunistically from MCP requests so it works without a Supabase cron job.
 */
export async function cleanupFlightControlRuns(): Promise<void> {
  if (!serviceKey) return;

  const now = new Date().toISOString();
  const retentionCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [{ error: expiryError }, { error: retentionError }] = await Promise.all([
    flightControlsAdmin
      .from('mcp_tool_runs')
      .update({ status: 'expired', continuation_state: null })
      .eq('status', 'pending')
      .lt('expires_at', now),
    flightControlsAdmin
      .from('mcp_tool_runs')
      .delete()
      .lt('created_at', retentionCutoff),
  ]);

  if (expiryError) console.error('[Flight Controls] Approval expiry cleanup failed:', expiryError.message);
  if (retentionError) console.error('[Flight Controls] Audit retention cleanup failed:', retentionError.message);
}
