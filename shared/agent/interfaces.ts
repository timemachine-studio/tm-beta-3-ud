import { z } from 'zod';
import type { ModelEvent, ModelMessage, PermissionGrant, Run, ToolCall, ToolDefinition, ToolResult, Usage } from './contracts.js';
import { idSchema, timestampSchema } from './primitives.js';

// This opaque, non-serializable context is constructed by the future authenticated
// broker. Parsing model arguments can never produce one. No public factory yet.
declare const trustedContext: unique symbol;
export interface TrustedExecutionContext {
  readonly [trustedContext]: true;
  readonly actor: Readonly<{ kind: 'authenticated' | 'anonymous'; id: string; sessionId: string }>;
  readonly runId: string;
  readonly workspaceId: string;
  readonly grants: readonly PermissionGrant[];
  readonly policyVersion: string;
  readonly signal: AbortSignal;
  readonly budget: { reserve(estimate: Usage): Promise<string>; reconcile(reservationId: string, actual: Usage): Promise<void> };
}
export interface ToolExecutor {
  execute(call: ToolCall, context: TrustedExecutionContext): Promise<ToolResult>;
  reconcile(invocationId: string, context: TrustedExecutionContext): Promise<ToolResult>;
}
export interface ModelAdapter {
  stream(input: { messages: readonly ModelMessage[]; tools: readonly ToolDefinition[]; signal: AbortSignal }): AsyncIterable<ModelEvent>;
}
export interface RunRepository {
  read(id: string, context: TrustedExecutionContext): Promise<Run | null>;
  compareAndSwap(run: Run, expectedSequence: number, context: TrustedExecutionContext): Promise<boolean>;
}
const page = { cursor: z.string().max(2048).optional(), limit: z.number().int().min(1).max(100) };
const dates = { from: timestampSchema.optional(), to: timestampSchema.optional() };
const orderedDates = (value: { from?: string; to?: string }) => !value.from || !value.to || Date.parse(value.from) < Date.parse(value.to);
export const chatsListInputSchema = z.object({ ...page, ...dates, dateField: z.enum(['createdAt', 'updatedAt', 'messageCreatedAt']) }).strict().refine(orderedDates, 'from must precede to');
export const chatsSearchInputSchema = z.object({ ...page, ...dates, query: z.string().min(1).max(512) }).strict().refine(orderedDates, 'from must precede to');
export const chatsReadInputSchema = z.object({ chatId: idSchema, beforeMessageId: idSchema.optional(), afterMessageId: idSchema.optional(), limit: page.limit }).strict().refine(value => !(value.beforeMessageId && value.afterMessageId), 'Use only one message boundary');
export const chatSummarySchema = z.object({ id: idSchema, title: z.string().max(256), createdAt: timestampSchema, updatedAt: timestampSchema, messageCount: z.number().int().nonnegative(), storage: z.enum(['device', 'cloud']) }).strict();
export const chatsListOutputSchema = z.object({ items: z.array(chatSummarySchema).max(100), nextCursor: z.string().max(2048).nullable() }).strict();
export const chatsSearchOutputSchema = z.object({
  items: z.array(z.object({ chat: chatSummarySchema, messageId: idSchema, createdAt: timestampSchema, excerpt: z.string().max(1024) }).strict()).max(100),
  nextCursor: z.string().max(2048).nullable(), semantics: z.literal('lexical'),
}).strict();
export const chatsReadOutputSchema = z.object({
  chatId: idSchema, messages: z.array(z.object({ id: idSchema, createdAt: timestampSchema, role: z.enum(['user', 'assistant']), content: z.string().max(32768) }).strict()).max(100),
  nextCursor: z.object({ direction: z.enum(['before', 'after']), messageId: idSchema }).strict().nullable(),
}).strict();
/** Both adapters use identical model inputs. Ownership, exclusions, deletion and
 * entitlement checks happen at the repository boundary on every call. Stable
 * pagination orders by (timestamp,id); ranges are inclusive from/exclusive to. */
export interface ChatRepository {
  readonly storage: 'device' | 'cloud';
  list(input: z.infer<typeof chatsListInputSchema>, context: TrustedExecutionContext): Promise<z.infer<typeof chatsListOutputSchema>>;
  search(input: z.infer<typeof chatsSearchInputSchema>, context: TrustedExecutionContext): Promise<z.infer<typeof chatsSearchOutputSchema>>;
  read(input: z.infer<typeof chatsReadInputSchema>, context: TrustedExecutionContext): Promise<z.infer<typeof chatsReadOutputSchema>>;
}
