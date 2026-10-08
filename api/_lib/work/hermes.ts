import { z } from 'zod';
import { workHermesFeatureSchema, workHermesSkillSchema, type WorkHermesSnapshot } from '../../../shared/workHermes.js';
import { requireWorkEntitlement, WorkError, workDatabase } from './store.js';
import { workUpstreamJson, type WorkHermesConnection } from './upstreamTransport.js';

const connectionSchema = z.object({ id: z.uuid(), user_id: z.uuid(), base_url: z.string().max(2048),
  credential_ref: z.string().regex(/^[A-Z][A-Z0-9_]{2,79}$/), enabled: z.literal(true),
  scope_verified_at: z.iso.datetime({ offset: true }), revision: z.number().int().positive() });
const capabilitiesSchema = z.object({ object: z.literal('hermes.api_server.capabilities'), platform: z.literal('hermes-agent'),
  auth: z.object({ type: z.literal('bearer'), required: z.literal(true) }),
  runtime: z.object({ mode: z.literal('server_agent'), tool_execution: z.literal('server'), split_runtime: z.literal(false) }),
  features: z.object({ skills_api: z.boolean().optional(), session_resources: z.boolean().optional(),
    run_events_sse: z.boolean().optional(), approval_events: z.boolean().optional(), run_stop: z.boolean().optional(),
    run_steer: z.boolean().optional(), model_options: z.boolean().optional() }) });
const catalogSchema = z.object({ object: z.literal('list'), data: z.array(workHermesSkillSchema).max(5000) });
const empty = (message: string): WorkHermesSnapshot => ({ configured: false, connected: false,
  executionEnabled: false, message, features: [], skills: [], skillCatalogTruncated: false });

async function readConnection(userId: string) {
  const { data, error } = await workDatabase().from('work_hermes_connections')
    .select('id,user_id,base_url,credential_ref,enabled,scope_verified_at,revision').eq('user_id', userId).eq('enabled', true).maybeSingle();
  if (error) throw new WorkError('WORK_INTEGRATION_SETUP_REQUIRED');
  if (!data) return null;
  const parsed = connectionSchema.safeParse(data);
  if (!parsed.success || parsed.data.user_id !== userId) throw new WorkError('WORK_INTEGRATION_SETUP_REQUIRED');
  return parsed.data;
}

/** Account-scoped, opt-in metadata only. No chats, runs, tools, credentials,
 * raw skills, model configuration or advertised endpoint URLs reach the UI. */
export async function readWorkHermes(userId: string): Promise<WorkHermesSnapshot> {
  await requireWorkEntitlement(userId);
  if (process.env.TM_WORK_HERMES_MONITORING_ENABLED !== 'true') return empty('Hermes discovery is disabled on this server. Execution is not connected.');
  const assigned = await readConnection(z.uuid().parse(userId));
  if (!assigned) return empty('No owner-dedicated Hermes server is assigned to this account.');
  const connection: WorkHermesConnection = { ...assigned, service: 'hermes', scope_id: null };
  const capabilities = capabilitiesSchema.safeParse(await workUpstreamJson(connection, '/v1/capabilities'));
  if (!capabilities.success) throw new WorkError('WORK_UPSTREAM_INVALID_RESPONSE', 502);
  const features = workHermesFeatureSchema.options.filter(key => capabilities.data.features[key] === true);
  let skills: WorkHermesSnapshot['skills'] = [], truncated = false;
  if (features.includes('skills_api')) {
    const catalog = catalogSchema.safeParse(await workUpstreamJson(connection, '/v1/skills'));
    if (!catalog.success || new Set(catalog.data.data.map(skill => skill.name)).size !== catalog.data.data.length) throw new WorkError('WORK_UPSTREAM_INVALID_RESPONSE', 502);
    skills = catalog.data.data.slice(0, 50); truncated = catalog.data.data.length > 50;
  }
  await requireWorkEntitlement(userId);
  const current = await readConnection(userId);
  if (!current || current.id !== assigned.id || current.base_url !== assigned.base_url
    || current.credential_ref !== assigned.credential_ref || current.scope_verified_at !== assigned.scope_verified_at
    || current.revision !== assigned.revision || process.env.TM_WORK_HERMES_MONITORING_ENABLED !== 'true') throw new WorkError('WORK_STATE_CHANGED', 409);
  return { configured: true, connected: true, executionEnabled: false,
    message: 'Hermes returned its capabilities and skill metadata. This does not enable task execution or install skills.',
    features, skills, skillCatalogTruncated: truncated };
}
