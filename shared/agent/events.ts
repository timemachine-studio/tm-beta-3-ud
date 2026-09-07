import { z } from 'zod';
import { artifactRefSchema, errorSchema, pendingOperationSchema, runSchema, runStatusSchema, toolCallSchema, toolDefinitionSchema, toolResultSchema, usageSchema } from './contracts';
import { idSchema, MAX_JSON_BYTES, revisionSchema, timestampSchema } from './primitives';

const envelope = { schemaVersion: z.literal(1), runId: idSchema, sequence: revisionSchema, timestamp: timestampSchema };
const artifacts = z.array(artifactRefSchema).max(100);
function event<T extends string, P extends z.ZodTypeAny>(type: T, payload: P) {
  return z.object({ ...envelope, type: z.literal(type), payload }).strict();
}
export const agentEventSchema = z.discriminatedUnion('type', [
  event('run.started', z.object({ run: runSchema }).strict()),
  event('run.status', z.object({ status: runStatusSchema }).strict()),
  event('assistant.delta', z.object({ messageId: idSchema, text: z.string().max(16384) }).strict()),
  event('assistant.completed', z.object({ messageId: idSchema, content: z.string().max(32768) }).strict()),
  event('tool.discovered', z.object({ tool: toolDefinitionSchema }).strict()),
  event('tool.started', z.object({ call: toolCallSchema }).strict()),
  event('tool.completed', z.object({ result: toolResultSchema.options[0] }).strict()),
  event('tool.failed', z.object({ invocationId: idSchema, error: errorSchema }).strict()),
  event('permission.required', z.object({ pending: pendingOperationSchema.extend({ kind: z.literal('permission') }), description: z.string().max(1024) }).strict()),
  event('device.requested', z.object({ pending: pendingOperationSchema.extend({ kind: z.literal('device') }), call: toolCallSchema }).strict()),
  event('artifact.updated', z.object({ artifact: artifactRefSchema }).strict()),
  event('usage.updated', usageSchema),
  event('run.completed', z.object({ status: z.literal('completed'), artifacts }).strict()),
  event('run.partial', z.object({ status: z.literal('partial'), artifacts, error: errorSchema }).strict()),
  event('run.failed', z.object({ status: z.literal('failed'), artifacts, error: errorSchema }).strict()),
  event('run.cancelled', z.object({ status: z.literal('cancelled'), artifacts }).strict()),
]);
export type AgentEvent = z.infer<typeof agentEventSchema>;
export class ContractFrameError extends Error {
  constructor(public readonly code: 'payload_too_large' | 'malformed_frame' | 'unsupported_version' | 'invalid_event') {
    super(code);
    this.name = 'ContractFrameError';
  }
}
/** Accept one complete JSON frame. Incremental transport framing belongs to TM-08. */
export function parseAgentEventFrame(frame: string): AgentEvent {
  if (frame.length > MAX_JSON_BYTES || new TextEncoder().encode(frame).length > MAX_JSON_BYTES) throw new ContractFrameError('payload_too_large');
  let input: unknown;
  try { input = JSON.parse(frame); } catch { throw new ContractFrameError('malformed_frame'); }
  if (typeof input === 'object' && input !== null && 'schemaVersion' in input && input.schemaVersion !== 1) throw new ContractFrameError('unsupported_version');
  const parsed = agentEventSchema.safeParse(input);
  if (!parsed.success) throw new ContractFrameError('invalid_event');
  const value = parsed.data;
  if (value.type === 'run.started' && value.payload.run.id !== value.runId) throw new ContractFrameError('invalid_event');
  if (value.type === 'permission.required' || value.type === 'device.requested') {
    if (value.payload.pending.runId !== value.runId) throw new ContractFrameError('invalid_event');
  }
  if (value.type === 'device.requested') {
    const { pending, call } = value.payload;
    if (pending.invocationId !== call.invocationId || pending.toolId !== call.toolId || pending.toolVersion !== call.toolVersion) throw new ContractFrameError('invalid_event');
  }
  return value;
}
