import { z } from 'zod';
import { inputSchemaSpecSchema, schemaSpecSchema } from './schemaSpec';
import { argumentsSchema, digestSchema, idSchema, jsonValueSchema, personaSchema, revisionSchema, storageSchema, timestampSchema, versionSchema } from './primitives';

export const usageSchema = z.object({
  inputTokens: revisionSchema, outputTokens: revisionSchema, toolCalls: revisionSchema,
  costMicrousd: revisionSchema, estimated: z.boolean(),
}).strict();
export const errorSchema = z.object({
  code: z.enum(['invalid_input', 'unauthorized', 'not_found', 'conflict', 'expired', 'revoked', 'budget_exhausted', 'unavailable', 'timeout', 'cancelled', 'internal']),
  message: z.string().min(1).max(1024), retryable: z.boolean(),
}).strict();
export const sourceRefSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('chat'), chatId: idSchema, messageIds: z.array(idSchema).min(1).max(100), workspaceId: idSchema, storage: storageSchema }).strict(),
  z.object({ type: z.literal('web'), url: z.string().url().max(2048).regex(/^https?:\/\//), title: z.string().max(256), retrievedAt: timestampSchema }).strict(),
  z.object({ type: z.literal('app'), appId: idSchema, objectId: idSchema, version: revisionSchema, storage: storageSchema }).strict(),
]);
export const artifactRefSchema = z.object({
  type: z.enum(['note', 'chat', 'healthcare', 'file', 'preview']), objectId: idSchema,
  storage: storageSchema, workspaceId: idSchema, version: revisionSchema,
  title: z.string().max(256), actions: z.array(z.enum(['open', 'download', 'preview'])).max(3),
}).strict();
export const grantScopeSchema = z.object({
  capability: idSchema, effect: z.enum(['read', 'write', 'compute', 'send', 'publish']),
  accountId: idSchema.optional(), resourceId: idSchema.optional(), destination: z.string().max(2048).optional(),
}).strict();
export const permissionGrantSchema = z.object({
  id: idSchema, actorId: idSchema, scope: grantScopeSchema, version: revisionSchema,
  expiresAt: timestampSchema, revokedAt: timestampSchema.optional(), maxCostMicrousd: revisionSchema,
}).strict();
export const pendingOperationSchema = z.object({
  kind: z.enum(['permission', 'device', 'external']), invocationId: idSchema, runId: idSchema,
  actorId: idSchema, workspaceId: idSchema, toolId: idSchema, toolVersion: versionSchema,
  argumentDigest: digestSchema, grantVersion: revisionSchema, nonce: idSchema, expiresAt: timestampSchema,
}).strict();
const resultFields = {
  invocationId: idSchema, sources: z.array(sourceRefSchema).max(100),
  artifacts: z.array(artifactRefSchema).max(100), usage: usageSchema,
};
export const toolResultSchema = z.discriminatedUnion('status', [
  z.object({ ...resultFields, status: z.literal('success'), data: jsonValueSchema }).strict(),
  z.object({ ...resultFields, status: z.literal('error'), error: errorSchema }).strict(),
  z.object({ ...resultFields, status: z.literal('pending'), pending: pendingOperationSchema }).strict(),
  z.object({ ...resultFields, status: z.literal('denied'), error: errorSchema }).strict(),
  z.object({ ...resultFields, status: z.literal('unknown_outcome'), error: errorSchema, reconciliationId: idSchema }).strict(),
]);
export const toolDefinitionSchema = z.object({
  id: idSchema, version: versionSchema, name: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  description: z.string().min(1).max(2048), inputSchema: inputSchemaSpecSchema, outputSchema: schemaSpecSchema,
  execution: z.enum(['builtin', 'device', 'mcp', 'api', 'workflow', 'sandbox']),
  requiredGrants: z.array(grantScopeSchema).max(64),
}).strict();
export const toolCallSchema = z.object({
  invocationId: idSchema, toolId: idSchema, toolVersion: versionSchema, arguments: argumentsSchema,
}).strict();
export const modelMessageSchema = z.discriminatedUnion('role', [
  z.object({ role: z.literal('system'), content: z.string().max(65536) }).strict(),
  z.object({ role: z.literal('user'), content: z.string().max(65536), sources: z.array(sourceRefSchema).max(100) }).strict(),
  z.object({ role: z.literal('assistant'), content: z.string().max(65536), toolCalls: z.array(toolCallSchema).max(32) }).strict(),
  z.object({ role: z.literal('tool'), result: toolResultSchema }).strict(),
]);
export const modelEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text_delta'), text: z.string().max(16384) }).strict(),
  z.object({ type: z.literal('tool_call'), call: toolCallSchema }).strict(),
  z.object({ type: z.literal('completed'), finishReason: z.enum(['stop', 'tool_calls', 'length']), usage: usageSchema }).strict(),
  z.object({ type: z.literal('failed'), error: errorSchema }).strict(),
]);
export const runStatusSchema = z.enum(['queued', 'running', 'waiting_permission', 'waiting_device', 'waiting_external', 'completed', 'partial', 'failed', 'cancelled']);
export const runSchema = z.object({
  schemaVersion: z.literal(1), id: idSchema, actorId: idSchema, workspaceId: idSchema,
  persona: personaSchema, status: runStatusSchema, sequence: revisionSchema,
  policyVersion: versionSchema, createdAt: timestampSchema, updatedAt: timestampSchema,
  artifacts: z.array(artifactRefSchema).max(100),
}).strict();
export type Run = z.infer<typeof runSchema>;
export type ToolResult = z.infer<typeof toolResultSchema>;
export type ToolCall = z.infer<typeof toolCallSchema>;
export type ToolDefinition = z.infer<typeof toolDefinitionSchema>;
export type ModelMessage = z.infer<typeof modelMessageSchema>;
export type ModelEvent = z.infer<typeof modelEventSchema>;
export type ArtifactRef = z.infer<typeof artifactRefSchema>;
export type SourceRef = z.infer<typeof sourceRefSchema>;
export type Usage = z.infer<typeof usageSchema>;
export type PermissionGrant = z.infer<typeof permissionGrantSchema>;
