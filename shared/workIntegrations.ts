import { z } from 'zod';

export const workIntegrationNameSchema = z.enum(['openhands', 'agenta']);
export type WorkIntegrationName = z.infer<typeof workIntegrationNameSchema>;
export const workIntegrationSnapshotSchema = z.object({
  service: workIntegrationNameSchema,
  connected: z.boolean(),
  executionEnabled: z.literal(false),
  message: z.string().max(300).nullable(),
  conversation: z.object({
    id: z.uuid(),
    status: z.enum(['idle', 'running', 'paused', 'waiting_for_confirmation', 'finished', 'error', 'stuck', 'deleting']),
    runtimeStatus: z.enum(['available', 'starting', 'missing', 'ownership_lost', 'error']).nullable(),
    canResume: z.boolean(),
  }).nullable(),
  events: z.array(z.object({ id: z.string().min(1).max(96), kind: z.string().regex(/^[a-zA-Z0-9_.-]{1,100}$/), timestamp: z.iso.datetime({ offset: true }) })).max(30),
  eventPage: z.object({ hasMore: z.boolean(), nextCursor: z.string().max(3010).nullable() }).optional(),
  traces: z.array(z.object({
    id: z.string().max(64), phase: z.string().max(100), provider: z.string().max(100), model: z.string().max(200),
    outcome: z.enum(['failed', 'invalid_output', 'completed']), configVersion: z.string().max(100),
    latencyMs: z.number().int().nonnegative().nullable(), inputTokens: z.number().int().nonnegative().nullable(),
    outputTokens: z.number().int().nonnegative().nullable(), estimatedCost: z.number().nonnegative().nullable(),
  })).max(20),
});
export type WorkIntegrationSnapshot = z.infer<typeof workIntegrationSnapshotSchema>;
export const workConnectionStatusSchema = z.object({
  service: workIntegrationNameSchema, configured: z.boolean(), monitoringEnabled: z.boolean(),
  exportEnabled: z.boolean(), executionEnabled: z.literal(false), message: z.string().max(300),
});
export const workConnectionStatusesSchema = z.object({
  connections: z.array(workConnectionStatusSchema).length(2),
});
export type WorkConnectionStatus = z.infer<typeof workConnectionStatusSchema>;
