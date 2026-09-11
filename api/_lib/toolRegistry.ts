/**
 * The shared tool registry, server side: rows out of Supabase and onto the
 * catalogue.
 *
 * A registry tool is one another user's session wrote, tested and published.
 * From here it is data, and it is treated as untrusted at every step: each
 * row is validated against the same schema the browser used to create it,
 * a row that fails is skipped and named in the log, and only the code that
 * passed reaches a suspension frame. The browser checks the digest again
 * before running any of it.
 *
 * Nothing here executes a tool. The sandbox is on the device; this module
 * decides which tools the model may see and hands the code down when it
 * calls one.
 */

import { flightControlsAdmin } from './flightControls.js';
import type { DeviceToolCall } from '../../shared/deviceTools.js';
import type { ToolDescriptor } from '../../shared/toolCatalog.js';
import {
  MAX_SESSION_TOOLS,
  registryToolDescriptor,
  registryToolName,
  registryToolPayload,
  sessionToolDescriptor,
  type PublishedTool,
  type SessionToolSummary,
} from '../../shared/toolRegistry.js';
import { parsePublishedTool } from '../../shared/toolRegistrySchema.js';

/**
 * How many published tools one request considers.
 *
 * Every candidate is scored against the message and every unoffered one is
 * lexically ranked by find_tools, so this is a CPU bound as much as anything.
 * Ordered by use, so the tools people actually call are the ones that fit;
 * the long tail past this is simply not on the catalogue until it earns a
 * place. Raising it is one number, but the honest fix for a registry of
 * thousands is embeddings in `rankFindableTools`, not a bigger scan.
 */
const MAX_LOADED_TOOLS = 300;

/**
 * Cached per warm instance. A published tool is available to everyone a
 * minute later at most, and nothing here is a permission — a stale read can
 * only offer a tool that was published, never one that was not.
 */
const REGISTRY_CACHE_TTL_MS = 60_000;

let registryCache: { expires: number; tools: PublishedTool[] } | null = null;

/** Column names in the table, as the row comes back. */
interface ToolRegistryRow {
  id: string;
  slug: string;
  version: number;
  digest: string;
  title: string;
  description: string;
  summary: string;
  parameters: unknown;
  source: string;
  terms: string[];
  tests: unknown;
  author_id: string | null;
  created_at: string;
}

function fromRow(row: ToolRegistryRow): PublishedTool | null {
  return parsePublishedTool({
    id: row.id,
    slug: row.slug,
    version: row.version,
    digest: row.digest,
    title: row.title,
    description: row.description,
    summary: row.summary,
    parameters: row.parameters,
    source: row.source,
    terms: row.terms,
    tests: row.tests,
    authorId: row.author_id,
    createdAt: row.created_at,
  });
}

/**
 * One version per slug: the newest that validates.
 *
 * Rows arrive ordered by use, so the reduce also keeps the most-used slugs
 * when the table is bigger than the load cap.
 */
export function latestPerSlug(tools: readonly PublishedTool[]): PublishedTool[] {
  const bySlug = new Map<string, PublishedTool>();
  for (const tool of tools) {
    const current = bySlug.get(tool.slug);
    if (!current || tool.version > current.version) bySlug.set(tool.slug, tool);
  }
  return [...bySlug.values()];
}

export async function loadPublishedTools(): Promise<PublishedTool[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];

  const { data, error } = await flightControlsAdmin
    .from('tool_registry')
    .select('id,slug,version,digest,title,description,summary,parameters,source,terms,tests,author_id,created_at')
    .eq('status', 'published')
    .order('use_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(MAX_LOADED_TOOLS);

  if (error) {
    // A missing table reads the same as a broken one from here: no registry
    // tools this turn, and the turn proceeds. Never a failed message because
    // the shared registry is unreachable.
    console.error('[Tool Registry] Load failed:', error.message);
    return [];
  }

  const tools: PublishedTool[] = [];
  for (const row of (data || []) as ToolRegistryRow[]) {
    const tool = fromRow(row);
    if (tool) {
      tools.push(tool);
    } else {
      // The id, never the content: a row that failed validation is exactly
      // the row whose content should not be trusted in a log line.
      console.error(`[Tool Registry] Skipping row ${row.id}: failed validation`);
    }
  }
  return latestPerSlug(tools);
}

export async function loadPublishedToolsCached(): Promise<PublishedTool[]> {
  if (registryCache && registryCache.expires > Date.now()) return registryCache.tools;
  const tools = await loadPublishedTools();
  registryCache = { expires: Date.now() + REGISTRY_CACHE_TTL_MS, tools };
  return tools;
}

/** For tests, and for a route that just wrote a row. */
export function invalidateRegistryCache(): void {
  registryCache = null;
}

export interface RequestTools {
  /** What joins the catalogue for this request. */
  descriptors: ToolDescriptor[];
  /** Registry tools by model-facing name, for the suspension frame. */
  registryByName: Map<string, PublishedTool>;
}

/**
 * The generated tools this request may offer.
 *
 * Session tools first, and a session tool shadows a registry tool with the
 * same slug: the user watched this one being built, and their browser holds
 * its code. Bounded, because the summaries come from the request body.
 */
export function resolveRequestTools(
  sessionTools: readonly SessionToolSummary[] | undefined,
  published: readonly PublishedTool[],
): RequestTools {
  const descriptors: ToolDescriptor[] = [];
  const registryByName = new Map<string, PublishedTool>();
  const taken = new Set<string>();

  for (const tool of (sessionTools || []).slice(0, MAX_SESSION_TOOLS)) {
    if (taken.has(tool.slug)) continue;
    taken.add(tool.slug);
    descriptors.push(sessionToolDescriptor(tool));
  }

  for (const tool of published) {
    if (taken.has(tool.slug)) continue;
    taken.add(tool.slug);
    descriptors.push(registryToolDescriptor(tool));
    registryByName.set(registryToolName(tool.slug), tool);
  }

  return { descriptors, registryByName };
}

/**
 * Put the code on the calls that need it.
 *
 * Only registry tools carry a payload; a session tool's code is already on
 * the device, and a built-in device tool has none.
 */
export function attachToolPayloads(
  calls: readonly DeviceToolCall[],
  registryByName: ReadonlyMap<string, PublishedTool>,
): DeviceToolCall[] {
  return calls.map(call => {
    const tool = registryByName.get(call.name);
    return tool ? { ...call, tool: registryToolPayload(tool) } : call;
  });
}

/**
 * Count a use, without waiting for it.
 *
 * Use is what orders the registry — it decides which tools are loaded when
 * there are more than fit, and which are offered when several match. The
 * count is bumped when the call is handed to the device, not when it
 * succeeds: the model chose the tool, which is the signal this measures.
 * A failed bump is logged and forgotten; the turn does not depend on it.
 */
export function recordToolUse(calls: readonly DeviceToolCall[]): void {
  const ids = calls.map(call => call.tool?.id).filter((id): id is string => !!id);
  if (ids.length === 0 || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  for (const id of new Set(ids)) {
    void flightControlsAdmin.rpc('increment_tool_use', { tool_id: id }).then(({ error }) => {
      if (error) console.error('[Tool Registry] Use count failed:', error.message);
    });
  }
}
