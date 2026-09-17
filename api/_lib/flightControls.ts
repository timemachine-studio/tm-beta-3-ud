import { createClient } from '@supabase/supabase-js';
import { decryptCredential } from './mcpCredentials.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
if (!supabaseUrl) {
  // Fail fast rather than falling back to a hardcoded project URL: a stale
  // fallback silently points production at the wrong database.
  throw new Error('VITE_SUPABASE_URL is not set.');
}
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const serverSupabaseKey = serviceKey || process.env.VITE_SUPABASE_ANON_KEY || 'missing-supabase-key';

export const flightControlsAdmin = createClient(supabaseUrl, serverSupabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export interface ServerFlightControl {
  id: string;
  kind: 'skill' | 'mcp';
  /**
   * A server the user added themselves, rather than one an operator published.
   * Only used to label things for the user; execution is identical.
   */
  owner?: 'catalog' | 'user';
  /**
   * A decrypted bearer token, present only in memory and only for a
   * user-added server whose credential we just decrypted. Never persisted,
   * never logged, never returned to a browser.
   */
  bearer_token?: string;
  slug: string;
  name: string;
  description: string;
  skill_content: string | null;
  mcp_server_url: string | null;
  mcp_auth_mode: 'none' | 'bearer_env' | 'bearer_user' | null;
  mcp_auth_env_var: string | null;
  mcp_allowed_tools: string[];
  mcp_auto_approve_tools: string[];
  mcp_connect_timeout_ms: number;
  mcp_call_timeout_ms: number;
  mcp_result_char_limit: number;
  sort_order: number;
  default_enabled: boolean;
}

export interface ResolvedFlightControls {
  /** Published controls this user has switched on. */
  enabled: ServerFlightControl[];
  /**
   * Every published skill slug, enabled or not.
   *
   * The catalog is authoritative for the slugs it defines, and knowing which
   * those are is the only way to tell "the user turned this off" from "the
   * catalog never mentioned it". Without it a toggle only works one way: the
   * built-in library would keep supplying a skill the user switched off.
   */
  governedSkillSlugs: string[];
}

export async function resolveFlightControls(userId: string | null): Promise<ResolvedFlightControls> {
  const empty: ResolvedFlightControls = { enabled: [], governedSkillSlugs: [] };
  if (!userId || !serviceKey) return empty;

  const [{ data: catalog, error: catalogError }, { data: settings, error: settingsError }, { data: installed, error: installedError }] = await Promise.all([
    flightControlsAdmin
      .from('flight_control_catalog')
      .select('*')
      .eq('is_published', true)
      .order('sort_order', { ascending: true }),
    flightControlsAdmin
      .from('user_flight_control_settings')
      .select('catalog_id,enabled')
      .eq('user_id', userId),
    // Skills the user installed from a directory (api/_lib/skillsRoute.ts).
    // They join the enabled set as `kind: 'skill'` and reach the model the
    // same way — list_skills / read_skill — so nothing downstream tells them
    // apart from a catalog skill except `owner`.
    flightControlsAdmin
      .from('user_skills')
      .select('id,slug,name,description,content')
      .eq('user_id', userId)
      .eq('enabled', true)
      .order('created_at', { ascending: true })
      .limit(MAX_USER_SKILLS),
  ]);

  if (catalogError) {
    console.error('[Flight Controls] Catalog load failed:', catalogError.message);
    return empty;
  }
  if (settingsError) console.error('[Flight Controls] Preference load failed:', settingsError.message);
  // A missing table (migration not run) is not a reason to lose the catalog.
  if (installedError) console.error('[Flight Controls] Installed skills load failed:', installedError.message);

  const preferences = new Map((settings || []).map(row => [row.catalog_id, row.enabled]));
  const rows = (catalog || []) as ServerFlightControl[];
  const userSkills: ServerFlightControl[] = (installed || []).map(row => ({
    id: row.id,
    kind: 'skill',
    owner: 'user',
    slug: row.slug,
    name: row.name,
    description: row.description || '',
    skill_content: row.content,
    mcp_server_url: null,
    mcp_auth_mode: null,
    mcp_auth_env_var: null,
    mcp_allowed_tools: [],
    mcp_auto_approve_tools: [],
    mcp_connect_timeout_ms: 0,
    mcp_call_timeout_ms: 0,
    mcp_result_char_limit: 0,
    sort_order: 2000,
    default_enabled: true,
  }));
  return {
    enabled: [...rows.filter(row => preferences.get(row.id) ?? row.default_enabled), ...userSkills],
    // An installed skill governs its slug too: it is the user's pick over a
    // built-in of the same name.
    governedSkillSlugs: [...rows.filter(row => row.kind === 'skill').map(row => row.slug), ...userSkills.map(row => row.slug)],
  };
}

/**
 * The user's own MCP servers, converted into the shape mcpClient already
 * speaks, with their credentials decrypted.
 *
 * A server whose credential cannot be decrypted is dropped rather than dialled
 * without auth: sending an unauthenticated request to someone's private
 * endpoint is worse than not reaching it. The reason is logged without the
 * server URL, which can itself carry a token in its path.
 */
export async function loadUserMcpServers(userId: string | null): Promise<ServerFlightControl[]> {
  if (!userId || !serviceKey) return [];

  const { data, error } = await flightControlsAdmin
    .from('user_mcp_servers')
    .select('*')
    .eq('user_id', userId)
    .eq('enabled', true)
    .order('created_at', { ascending: true })
    .limit(MAX_USER_MCP_SERVERS);

  if (error) {
    console.error('[Flight Controls] User MCP server load failed:', error.message);
    return [];
  }

  const servers: ServerFlightControl[] = [];
  for (const row of data || []) {
    let bearerToken: string | undefined;
    if (row.auth_mode === 'bearer') {
      try {
        bearerToken = decryptCredential(row.credential_ciphertext || '');
      } catch (err) {
        console.error(`[Flight Controls] Skipping user MCP server ${row.slug}: ${err instanceof Error ? err.message : 'credential unavailable'}`);
        continue;
      }
    }
    servers.push({
      id: row.id,
      kind: 'mcp',
      owner: 'user',
      slug: row.slug,
      name: row.name,
      description: row.description || '',
      skill_content: null,
      mcp_server_url: row.server_url,
      mcp_auth_mode: row.auth_mode === 'bearer' ? 'bearer_user' : 'none',
      mcp_auth_env_var: null,
      ...(bearerToken ? { bearer_token: bearerToken } : {}),
      mcp_allowed_tools: row.mcp_allowed_tools || [],
      mcp_auto_approve_tools: row.mcp_auto_approve_tools || [],
      mcp_connect_timeout_ms: row.mcp_connect_timeout_ms,
      mcp_call_timeout_ms: row.mcp_call_timeout_ms,
      mcp_result_char_limit: row.mcp_result_char_limit,
      sort_order: 1000,
      default_enabled: true,
    });
  }
  return servers;
}

/** The enabled controls alone, for callers that do not need the rest. */
export async function loadEnabledFlightControls(userId: string | null): Promise<ServerFlightControl[]> {
  return (await resolveFlightControls(userId)).enabled;
}

/**
 * How long a user's resolved Flight Controls are reused within one instance.
 *
 * This runs on the hot path of every signed-in message and costs two Supabase
 * round-trips, so it is cached per warm serverless instance. Thirty seconds is
 * chosen against what it delays: a user who flips a toggle waits at most that
 * long for their next message to reflect it, which is well inside the time it
 * takes to close a modal and type. Nothing here is a permission — the toggles
 * only add capability — so a stale read cannot grant access to anything.
 */
const CONTROLS_CACHE_TTL_MS = 30_000;

const controlsCache = new Map<string, { expires: number; resolved: ResolvedFlightControls }>();

/** Bounds the cache on a long-lived instance serving many users. */
const CONTROLS_CACHE_MAX = 500;

export async function resolveFlightControlsCached(userId: string | null): Promise<ResolvedFlightControls> {
  if (!userId) return { enabled: [], governedSkillSlugs: [] };

  const cached = controlsCache.get(userId);
  if (cached && cached.expires > Date.now()) return cached.resolved;

  const resolved = await resolveFlightControls(userId);

  if (controlsCache.size >= CONTROLS_CACHE_MAX) {
    // Cheapest useful eviction: Map iterates in insertion order, so this drops
    // the oldest entry rather than scanning for the least recently used.
    const oldest = controlsCache.keys().next().value;
    if (oldest !== undefined) controlsCache.delete(oldest);
  }
  controlsCache.set(userId, { expires: Date.now() + CONTROLS_CACHE_TTL_MS, resolved });
  return resolved;
}

/** Drop a user's cached controls, so the next request re-reads them. */
export function invalidateFlightControlsCache(userId: string): void {
  controlsCache.delete(userId);
}

export function enabledSkills(controls: ServerFlightControl[]) {
  return controls.filter(control => control.kind === 'skill' && control.skill_content);
}

/**
 * How many MCP servers one turn may dial.
 *
 * Each is a connection and a tools/list on the hot path, cached but not free,
 * and each contributes schemas competing for the same token budget. Five was
 * already the catalog's limit; user servers share it rather than adding to it.
 */
export const MAX_USER_MCP_SERVERS = 10;
/** Installed skills per user — see api/_lib/skillsRoute.ts. */
export const MAX_USER_SKILLS = 30;
const MAX_MCP_SERVERS_PER_TURN = 5;

export function enabledMcpServers(controls: ServerFlightControl[]) {
  return controls.filter(control => control.kind === 'mcp').slice(0, MAX_MCP_SERVERS_PER_TURN);
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
      .update({ status: 'expired', continuation_state: null, argument_preview: {}, error_code: null })
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
