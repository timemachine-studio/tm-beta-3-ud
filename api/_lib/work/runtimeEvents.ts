import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { WorkTask } from '../../../shared/work.js';
import { WorkError } from './store.js';

const event = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,96}$/),
  kind: z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/),
  timestamp: z.iso.datetime({ offset: true }),
});
const pageId = z.string().min(1).max(1024).refine(value => Buffer.byteLength(value) <= 1024);
const page = z.object({ items: z.array(event).max(30), next_page_id: pageId.nullable().optional() });
const scope = z.object({
  taskId: z.uuid(), userId: z.uuid(), connectionId: z.uuid(), conversationId: z.uuid(),
  generation: z.number().int().nonnegative(), revision: z.number().int().nonnegative(),
});
const cursor = scope.extend({ pageId, depth: z.number().int().min(1).max(20), expiresAt: z.number().int() }).strict();
export type WorkEventScope = z.infer<typeof scope>;
const aad = Buffer.from('tm-work-event-page-v1');

export function workEventScope(task: WorkTask, connectionId: string, conversationId: string): WorkEventScope {
  return scope.parse({ taskId: task.id, userId: task.user_id, generation: task.generation, revision: task.revision, connectionId, conversationId });
}
function key() {
  const secret = process.env.TM_WORK_EVENT_CURSOR_SECRET;
  if (!secret) return null;
  if (secret.length < 32 || secret.length > 256) throw new WorkError('WORK_INTEGRATION_SETUP_REQUIRED');
  return createHash('sha256').update(aad).update(secret).digest();
}
function stale(): never { throw new WorkError('WORK_EVENT_CURSOR_EXPIRED', 409); }

/** Authenticated encryption keeps the upstream pagination token server-private.
 * A cursor is only read authority, never tool approval or execution authority. */
export function readWorkEventCursor(token: string, expected: WorkEventScope) {
  try {
    const secret = key();
    if (!secret || !/^tme1\.[A-Za-z0-9_-]{40,3000}$/.test(token)) stale();
    const bytes = Buffer.from(token.slice(5), 'base64url');
    if (bytes.toString('base64url') !== token.slice(5)) stale();
    const decipher = createDecipheriv('aes-256-gcm', secret, bytes.subarray(0, 12));
    decipher.setAAD(aad); decipher.setAuthTag(bytes.subarray(12, 28));
    const parsed = cursor.parse(JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8')));
    if (parsed.expiresAt <= Date.now() || parsed.expiresAt > Date.now() + 600000
      || Object.entries(expected).some(([name, value]) => parsed[name as keyof typeof parsed] !== value)) stale();
    return parsed;
  } catch { stale(); }
}
function seal(value: z.infer<typeof cursor>): string | null {
  const secret = key();
  if (!secret) return null; // Metadata monitoring remains available without paging setup.
  const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', secret, nonce);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(cursor.parse(value))), cipher.final()]);
  return 'tme1.' + Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]).toString('base64url');
}

/** Allowlisted metadata only: no action, prompt, observation, error or reasoning
 * bodies cross this boundary. A page is history, not pending-action authority. */
export function readWorkEventPage(raw: unknown, context: WorkEventScope, previous?: ReturnType<typeof readWorkEventCursor>) {
  const parsed = page.safeParse(raw);
  if (!parsed.success) throw new WorkError('WORK_UPSTREAM_INVALID_RESPONSE', 502);
  const events: z.infer<typeof event>[] = [], seen = new Map<string, string>();
  let last = Infinity;
  for (const item of parsed.data.items) {
    const timestamp = Date.parse(item.timestamp);
    if (timestamp > last) throw new WorkError('WORK_UPSTREAM_INVALID_RESPONSE', 502);
    last = timestamp;
    const fingerprint = JSON.stringify(item);
    if (seen.has(item.id)) {
      if (seen.get(item.id) !== fingerprint) throw new WorkError('WORK_UPSTREAM_INVALID_RESPONSE', 502);
      continue;
    }
    seen.set(item.id, fingerprint); events.push(item);
  }
  const next = parsed.data.next_page_id ?? null;
  if (next && (next === previous?.pageId || !events.length)) throw new WorkError('WORK_UPSTREAM_INVALID_RESPONSE', 502);
  const depth = (previous?.depth ?? 0) + 1;
  return { events, eventPage: { hasMore: Boolean(next), nextCursor: next && depth <= 20
    ? seal({ ...context, pageId: next, depth, expiresAt: previous?.expiresAt ?? Date.now() + 600000 }) : null } };
}
