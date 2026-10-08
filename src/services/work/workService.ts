import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { workActivitySchema, workFileSchema, workTaskSchema, workTraceSchema, type WorkCapabilities, type WorkRequest, type WorkSnapshot, type WorkTask } from '../../../shared/work';
import { workConnectionStatusesSchema, workIntegrationSnapshotSchema, type WorkConnectionStatus, type WorkIntegrationName, type WorkIntegrationSnapshot } from '../../../shared/workIntegrations';
import { workHermesSnapshotSchema, type WorkHermesSnapshot } from '../../../shared/workHermes';

const capabilitiesSchema = z.object({ access: z.enum(['allowed', 'sign_in', 'premium', 'setup']), cloud: z.boolean(), local: z.boolean(), background: z.boolean(), openhands: z.boolean(), agenta: z.boolean(), message: z.string().nullable() });
const snapshotSchema = z.object({ task: workTaskSchema, files: z.array(workFileSchema).max(24), activity: z.array(workActivitySchema).max(200), traces: z.array(workTraceSchema).max(100) });
export class WorkRequestError extends Error {
  constructor(message: string, public code: string) { super(message); }
}
async function request<T>(url: string, schema: z.ZodType<T>, body?: WorkRequest, signal?: AbortSignal): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const response = await fetch(url, {
    method: body ? 'POST' : 'GET', signal,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const error = z.object({ error: z.object({ message: z.string(), code: z.string() }) }).safeParse(payload);
    throw new WorkRequestError(error.success ? error.data.error.message : 'Work could not connect. Your draft is still here.', error.success ? error.data.error.code : 'WORK_UNAVAILABLE');
  }
  return schema.parse(payload);
}
export const getWorkCapabilities = (signal?: AbortSignal): Promise<WorkCapabilities> => request('/api/work?capabilities=1', capabilitiesSchema, undefined, signal);
export const getWorkSnapshot = (taskId: string, signal?: AbortSignal): Promise<WorkSnapshot> => request('/api/work?taskId=' + encodeURIComponent(taskId), snapshotSchema, undefined, signal);
export const listWorkTasks = (signal?: AbortSignal): Promise<WorkTask[]> => request('/api/work', z.object({ tasks: z.array(workTaskSchema).max(30) }), undefined, signal).then(result => result.tasks);
export const mutateWork = (body: WorkRequest): Promise<WorkSnapshot> => request('/api/work', snapshotSchema, body);
export const getWorkConnectionStatuses = (signal?: AbortSignal): Promise<WorkConnectionStatus[]> => request('/api/work?connections=1', workConnectionStatusesSchema, undefined, signal).then(result => result.connections);
export const getWorkHermes = (signal?: AbortSignal): Promise<WorkHermesSnapshot> => request('/api/work?hermes=1', workHermesSnapshotSchema, undefined, signal);
export const getWorkIntegration = (taskId: string, service: WorkIntegrationName, signal?: AbortSignal, eventCursor?: string): Promise<WorkIntegrationSnapshot> => request('/api/work?taskId=' + encodeURIComponent(taskId) + '&integration=' + service + (eventCursor ? '&eventCursor=' + encodeURIComponent(eventCursor) : ''), workIntegrationSnapshotSchema, undefined, signal);
