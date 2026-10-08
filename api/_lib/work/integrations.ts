import { z } from 'zod';
import { OpenHandsClient, type OpenHandsRequestOptions } from '@openhands/typescript-client/clients';
import type { ConversationInfo, ConversationRuntimeInfo } from '@openhands/typescript-client';
import type { WorkTask } from '../../../shared/work.js';
import { readWorkEventCursor, readWorkEventPage, workEventScope } from './runtimeEvents.js';
import { workIntegrationSnapshotSchema, type WorkConnectionStatus, type WorkIntegrationName, type WorkIntegrationSnapshot } from '../../../shared/workIntegrations.js';
import { readWorkTask, requireWorkEntitlement, WorkError, workDatabase } from './store.js';
import { readWorkConnection, workUpstreamJson, type WorkServiceConnection } from './upstreamTransport.js';

const conversationSchema = workIntegrationSnapshotSchema.shape.conversation.unwrap();
const runtimeSchema = z.object({ runtime_status: conversationSchema.shape.runtimeStatus.unwrap(), can_resume: z.boolean() });
const traceSchema = workIntegrationSnapshotSchema.shape.traces.element;
export const workCallMetadataSchema = traceSchema.omit({ id: true });
export type WorkCallMetadata = z.infer<typeof workCallMetadataSchema>;

/** Official SDK base with TM's bounded transport; only this assigned catalog is readable. */
class TMOpenHandsReader extends OpenHandsClient {
  readonly kind = 'agent-server' as const;
  constructor(private readonly connection: WorkServiceConnection, private readonly conversationId: string, private readonly pageId?: string) {
    super({ host: connection.base_url, timeout: 10000 });
  }
  async request<T = unknown>(options: OpenHandsRequestOptions): Promise<T> {
    const root = '/api/conversations/' + this.conversationId;
    if (options.method !== 'GET' || ![root, root + '/runtime', root + '/events/search'].includes(options.path)
      || options.hostOverride || options.headers || options.authMode || options.sessionApiKey || options.body !== undefined
      || options.params || options.responseType || options.acceptableStatusCodes || options.timeoutSeconds) {
      throw new WorkError('WORK_UPSTREAM_INVALID_REQUEST', 400);
    }
    return await workUpstreamJson(this.connection, options.path, {
      query: options.path.endsWith('/events/search') ? { limit: '30', sort_order: 'TIMESTAMP_DESC', ...(this.pageId ? { page_id: this.pageId } : {}) } : undefined,
    }) as T;
  }
}

function disconnected(service: WorkIntegrationName, message: string): WorkIntegrationSnapshot {
  return { service, connected: false, executionEnabled: false, message, conversation: null, events: [], traces: [] };
}

/** Configuration only, not a health check or permission to execute. */
export async function readWorkConnectionStatuses(userId: string): Promise<{ connections: WorkConnectionStatus[] }> {
  await requireWorkEntitlement(userId);
  const enabled = process.env.TM_WORK_UPSTREAM_ENABLED === 'true';
  const connections = await Promise.all((['openhands', 'agenta'] as const).map(async service => {
    const connection = enabled ? await readWorkConnection(userId, service) : null;
    return { service, configured: Boolean(connection), monitoringEnabled: enabled,
      exportEnabled: Boolean(connection && service === 'agenta' && process.env.TM_WORK_AGENTA_EXPORT === 'true'),
      executionEnabled: false as const,
      message: !enabled ? 'Upstream monitoring is disabled on this server.' : !connection
        ? 'No verified connection is assigned to this account.'
        : 'Account configuration is assigned. Check a task’s Activity view to verify the remote response.',
    };
  }));
  return { connections };
}

async function openHandsSnapshot(task: WorkTask, connection: WorkServiceConnection, cursor?: string): Promise<WorkIntegrationSnapshot> {
  const taskId = task.id, userId = task.user_id;
  const { data, error } = await workDatabase().from('work_runtime_bindings')
    .select('remote_conversation_id').eq('task_id', taskId).eq('user_id', userId).eq('connection_id', connection.id).maybeSingle();
  if (error) throw new WorkError('WORK_INTEGRATION_SETUP_REQUIRED');
  if (!data) return disconnected('openhands', 'No OpenHands conversation is assigned to this task.');
  const binding = z.object({ remote_conversation_id: z.uuid() }).safeParse(data);
  if (!binding.success) throw new WorkError('WORK_INTEGRATION_SETUP_REQUIRED');
  const id = binding.data.remote_conversation_id;
  const context = workEventScope(task, connection.id, id);
  const previous = cursor ? readWorkEventCursor(cursor, context) : undefined;
  const client = new TMOpenHandsReader(connection, id, previous?.pageId);
  // Never return a raw ConversationInfo: it can contain agent credentials,
  // workspace paths, hooks and LLM configuration.
  const [rawInfo, rawRuntime, rawEvents] = await Promise.all([
    client.get<ConversationInfo>('/api/conversations/' + id),
    client.get<ConversationRuntimeInfo>('/api/conversations/' + id + '/runtime'),
    client.get('/api/conversations/' + id + '/events/search'),
  ]);
  const info = z.object({ id: z.literal(id), execution_status: conversationSchema.shape.status }).parse(rawInfo);
  const runtime = runtimeSchema.parse(rawRuntime);
  const events = readWorkEventPage(rawEvents, context, previous);
  // Stop, generation transfer, reassignment and revoked connection authority
  // invalidate a response that arrived after the original owner check.
  await requireWorkEntitlement(userId);
  const currentTask = await readWorkTask(taskId, userId);
  const currentConnection = await readWorkConnection(userId, 'openhands');
  const currentBinding = await workDatabase().from('work_runtime_bindings').select('remote_conversation_id')
    .eq('task_id', taskId).eq('user_id', userId).eq('connection_id', connection.id).maybeSingle();
  if (currentBinding.error) throw new WorkError('WORK_INTEGRATION_SETUP_REQUIRED');
  if (currentTask.id !== taskId || currentTask.user_id !== userId || currentTask.generation !== task.generation
    || currentTask.revision !== task.revision || currentTask.status !== task.status || currentTask.worker_id !== task.worker_id
    || !currentConnection || currentConnection.id !== connection.id
    || currentConnection.base_url !== connection.base_url || currentConnection.credential_ref !== connection.credential_ref
    || currentConnection.scope_verified_at !== connection.scope_verified_at
    || currentBinding.data?.remote_conversation_id !== id || process.env.TM_WORK_UPSTREAM_ENABLED !== 'true') {
    throw new WorkError('WORK_STATE_CHANGED', 409);
  }
  return { service: 'openhands', connected: true, executionEnabled: false,
    message: 'Conversation monitoring only. TM sandbox execution is not enabled.',
    conversation: { id: info.id, status: info.execution_status, runtimeStatus: runtime.runtime_status, canResume: runtime.can_resume },
    ...events, traces: [] };
}

async function agentaSnapshot(taskId: string, connection: WorkServiceConnection): Promise<WorkIntegrationSnapshot> {
  // The API key's bound project is authoritative in Agenta. project_id does
  // not override that key. An administrator must attest to the matching scope.
  const raw = await workUpstreamJson(connection, '/simple/traces/query', { method: 'POST',
    query: { project_id: connection.scope_id! },
    body: { trace: { tags: { tm_task_id: taskId, tm_source: 'work_model_call' } }, windowing: { limit: 20, order: 'descending' } },
  });
  const page = z.object({ traces: z.array(z.object({
    trace_id: z.string().regex(/^[a-fA-F0-9-]{16,64}$/),
    tags: z.object({ tm_task_id: z.literal(taskId), tm_source: z.literal('work_model_call') }),
    data: z.object({ internals: z.object({ tm: workCallMetadataSchema }) }),
  })).max(20) }).parse(raw);
  return { service: 'agenta', connected: true, executionEnabled: false,
    message: 'Model-call telemetry only. Agenta evaluations and automations are not enabled.',
    conversation: null, events: [], traces: page.traces.map(trace => ({ id: trace.trace_id, ...trace.data.internals.tm })) };
}

/** Safe to call from the API: entitlement and ownership precede all service lookups. */
export async function readWorkIntegration(taskId: string, userId: string, service: WorkIntegrationName, cursor?: string): Promise<WorkIntegrationSnapshot> {
  await requireWorkEntitlement(userId);
  const task = await readWorkTask(taskId, userId);
  if (task.id !== taskId || task.user_id !== userId) throw new WorkError('WORK_NOT_FOUND', 404);
  if (cursor !== undefined && (service !== 'openhands' || !cursor || cursor.length > 3010)) throw new WorkError('WORK_INVALID_INPUT', 400);
  if (process.env.TM_WORK_UPSTREAM_ENABLED !== 'true') return disconnected(service, 'Upstream connections are not enabled on this server.');
  const connection = await readWorkConnection(userId, service);
  if (!connection) return disconnected(service, 'No verified ' + (service === 'agenta' ? 'Agenta project' : 'OpenHands server') + ' is connected to this account.');
  try {
    return workIntegrationSnapshotSchema.parse(service === 'openhands'
      ? await openHandsSnapshot(task, connection, cursor) : await agentaSnapshot(taskId, connection));
  } catch (error) {
    if (error instanceof z.ZodError) throw new WorkError('WORK_UPSTREAM_INVALID_RESPONSE', 502);
    throw error;
  }
}

/** Opt-in, metadata-only, best-effort export. Local TM traces remain authoritative. */
export async function exportWorkModelCall(taskId: string, userId: string, callId: string, metadata: WorkCallMetadata): Promise<void> {
  if (process.env.TM_WORK_UPSTREAM_ENABLED !== 'true' || process.env.TM_WORK_AGENTA_EXPORT !== 'true') return;
  try {
    await requireWorkEntitlement(userId);
    await readWorkTask(taskId, userId);
    const safe = workCallMetadataSchema.parse(metadata);
    const connection = await readWorkConnection(userId, 'agenta');
    if (!connection) return;
    const raw = await workUpstreamJson(connection, '/simple/traces/', { method: 'POST', query: { project_id: connection.scope_id! },
      body: { trace: { origin: 'auto', kind: 'adhoc', channel: 'api',
        tags: { tm_task_id: taskId, tm_call_id: z.uuid().parse(callId), tm_source: 'work_model_call' },
        // Agenta normalizes ag.data to parameters/inputs/outputs/internals.
        // A custom top-level data.tm is moved to unsupported and lost to the
        // SimpleTrace query projection; retain TM metadata in internals.tm.
        data: { internals: { tm: safe } }, references: {}, links: {},
      } },
    });
    z.object({ count: z.literal(1), trace: z.object({ trace_id: z.string().min(1) }) }).parse(raw);
  } catch {
    // Never expose a provider key/error body or retry the LLM because telemetry
    // failed. There is no durable export retry queue in this first adapter.
    console.warn('work_agenta_export_failed');
  }
}
