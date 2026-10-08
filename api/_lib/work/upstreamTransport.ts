import { z } from 'zod';
import { WorkError, workDatabase } from './store.js';
import type { WorkIntegrationName } from '../../../shared/workIntegrations.js';

const connectionSchema = z.object({
  id: z.uuid(), user_id: z.uuid(), service: z.enum(['openhands', 'agenta']),
  base_url: z.string().max(2048), credential_ref: z.string().regex(/^[A-Z][A-Z0-9_]{2,79}$/),
  scope_id: z.uuid().nullable(), enabled: z.literal(true), scope_verified_at: z.iso.datetime({ offset: true }),
});
export type WorkServiceConnection = z.infer<typeof connectionSchema>;
export type WorkHermesConnection = Omit<WorkServiceConnection, 'service'> & { service: 'hermes' };
type WorkUpstreamConnection = WorkServiceConnection | WorkHermesConnection;

/** This store is service-only. Callers must verify the task owner first. */
export async function readWorkConnection(userId: string, service: WorkIntegrationName): Promise<WorkServiceConnection | null> {
  const { data, error } = await workDatabase().from('work_service_connections')
    .select('id,user_id,service,base_url,credential_ref,scope_id,enabled,scope_verified_at')
    .eq('user_id', userId).eq('service', service).eq('enabled', true).maybeSingle();
  if (error) throw new WorkError('WORK_INTEGRATION_SETUP_REQUIRED');
  if (!data) return null;
  const parsed = connectionSchema.safeParse(data);
  if (!parsed.success || parsed.data.user_id !== userId || parsed.data.service !== service
    || (service === 'agenta' ? !parsed.data.scope_id : parsed.data.scope_id !== null)) {
    throw new WorkError('WORK_INTEGRATION_SETUP_REQUIRED');
  }
  return parsed.data;
}

/** Execution eligibility is separate from monitoring. Requires the handoff
 * migration; old monitoring-only connections remain readable above. */
export async function readWorkExecutionConnection(userId: string) {
  const connection = await readWorkConnection(userId, 'openhands');
  if (!connection) throw new WorkError('WORK_RUNTIME_LAUNCH_SETUP_REQUIRED');
  const { data, error } = await workDatabase().from('work_service_connections').select('execution_verified_at')
    .eq('id', connection.id).eq('user_id', userId).eq('enabled', true).maybeSingle();
  if (error || !z.object({ execution_verified_at: z.iso.datetime({ offset: true }) }).safeParse(data).success) {
    throw new WorkError('WORK_RUNTIME_LAUNCH_SETUP_REQUIRED');
  }
  return connection;
}

function upstreamTarget(connection: WorkUpstreamConnection, path: string) {
  try {
    const base = new URL(connection.base_url);
    const allowed = (process.env.TM_WORK_UPSTREAM_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
    const localAllowed = loopback && process.env.TM_WORK_ALLOW_LOOPBACK === 'true'
      && process.env.NODE_ENV !== 'production' && !process.env.VERCEL;
    if (base.username || base.password || base.search || base.hash || !allowed.includes(base.origin)
      || (base.protocol !== 'https:' && !(base.protocol === 'http:' && localAllowed))
      || (loopback && !localAllowed) || !/^\/[a-zA-Z0-9_/-]+$/.test(path) || path.includes('//') || path.includes('..')) {
      throw new Error('invalid target');
    }
    base.pathname = base.pathname.replace(/\/+$/, '') + path;
    return base;
  } catch { throw new WorkError('WORK_INTEGRATION_SETUP_REQUIRED'); }
}

/** Bounded JSON-only server transport. Never follows a redirect with a key. */
export async function workUpstreamJson(connection: WorkUpstreamConnection, path: string,
  options: { method?: 'GET' | 'POST'; query?: Record<string, string>; body?: unknown } = {}): Promise<unknown> {
  const target = upstreamTarget(connection, path);
  for (const [key, value] of Object.entries(options.query ?? {})) target.searchParams.set(key, value);
  const secret = process.env['TM_WORK_UPSTREAM_SECRET_' + connection.credential_ref];
  if (!secret || secret.length < 8 || secret.length > 4096 || /[\r\n]/.test(secret)) throw new WorkError('WORK_INTEGRATION_SETUP_REQUIRED');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (connection.service === 'openhands') headers['X-Session-API-Key'] = secret;
  else if (connection.service === 'hermes') headers.Authorization = 'Bearer ' + secret;
  else headers.Authorization = 'ApiKey ' + secret;
  const body = options.body === undefined ? undefined : JSON.stringify(options.body);
  if (body && Buffer.byteLength(body) > 65536) throw new WorkError('WORK_UPSTREAM_INVALID_REQUEST', 400);
  if (body) headers['Content-Type'] = 'application/json';
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 10000);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await fetch(target, { method: options.method ?? 'GET', headers, body,
      redirect: 'error', credentials: 'omit', cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new WorkError('WORK_UPSTREAM_UNAVAILABLE', 502);
    if (!/^application\/(?:[a-zA-Z0-9.-]+\+)?json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')
      || Number(response.headers.get('content-length') ?? 0) > 524288 || !response.body) {
      throw new WorkError('WORK_UPSTREAM_INVALID_RESPONSE', 502);
    }
    reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 524288) throw new WorkError('WORK_UPSTREAM_INVALID_RESPONSE', 502);
      chunks.push(chunk.value);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new WorkError('WORK_UPSTREAM_INVALID_RESPONSE', 502); }
  } catch (error) {
    if (error instanceof WorkError) throw error;
    throw new WorkError(controller.signal.aborted ? 'WORK_UPSTREAM_TIMEOUT' : 'WORK_UPSTREAM_UNAVAILABLE', controller.signal.aborted ? 504 : 502);
  } finally {
    controller.abort();
    clearTimeout(deadline);
    await reader?.cancel().catch(() => undefined);
    reader?.releaseLock();
  }
}
