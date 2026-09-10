import { z } from 'zod';
import type { Message } from '../../types/chat';
import type { ChatSession } from './chatService';
import { AI_PERSONAS } from '../../config/constants';

const dimensions = z.object({ width: z.number(), height: z.number() });
const errorCode = z.enum(['RETENTION_UNVERIFIED', 'RATE_LIMITED', 'AUTH_EXPIRED', 'PROVIDER_DOWN', 'PAYLOAD_TOO_LARGE', 'TIMEOUT', 'TRUNCATED', 'EMPTY', 'ABORTED', 'NETWORK', 'UNKNOWN']);
const approval = z.object({
  runId: z.string(), serverName: z.string(), toolName: z.string(),
  argumentPreview: z.record(z.string(), z.unknown()), expiresAt: z.string(),
  status: z.enum(['pending', 'approved', 'denied', 'expired', 'failed']).optional(),
  error: z.string().optional(),
});
const musicVariations = z.array(z.object({ seed: z.number(), audioUrl: z.string(), imageUrl: z.string() }));
// Notes the AI saved during a turn. Reopening the chat has to bring the card
// back with it, or the "Open in Notes" link only exists until a refresh.
const appObjects = z.array(z.object({
  kind: z.literal('note'), id: z.string(), title: z.string(),
  action: z.enum(['created', 'updated']),
})).max(10);
export const storedMetadataSchema = z.object({
  hasAnimated: z.boolean().nullish(), imageDimensions: dimensions.nullish(),
  specialMode: z.string().nullish(),
  musicVariations: musicVariations.nullish(),
  mcpApproval: approval.nullish(), status: z.enum(['streaming', 'complete', 'error']).nullish(),
  errorCode: errorCode.nullish(), partialContent: z.string().nullish(),
  appObjects: appObjects.nullish(),
});

/** A malformed optional field must not discard another field's retry state. */
export function parseStoredMetadata(value: unknown): z.infer<typeof storedMetadataSchema> {
  const source = z.record(z.string(), z.unknown()).safeParse(value);
  const fields = Object.fromEntries(Object.entries(storedMetadataSchema.shape).map(([key, schema]) => {
    const field = schema.safeParse(source.success ? source.data[key] : undefined);
    return [key, field.success ? field.data : undefined];
  }));
  return storedMetadataSchema.parse(fields);
}

const messageSchema = storedMetadataSchema.extend({
  id: z.union([z.string().min(1), z.number().int().min(-8640000000000000).max(8640000000000000)]),
  content: z.string(), isAI: z.boolean(), createdAt: z.string().optional(),
  hasAnimated: z.boolean().optional(), imageDimensions: dimensions.optional(),
  specialMode: z.string().optional(), musicVariations: musicVariations.optional(),
  mcpApproval: approval.optional(), status: z.enum(['streaming', 'complete', 'error']).optional(),
  errorCode: errorCode.optional(), partialContent: z.string().optional(),
  appObjects: appObjects.optional(),
  thinking: z.string().optional(), rawContent: z.string().optional(),
  imageData: z.union([z.string(), z.array(z.string())]).optional(),
  audioUrl: z.string().optional(), inputImageUrls: z.array(z.string()).optional(),
  pdfData: z.string().optional(), pdfFileName: z.string().optional(),
  sender_id: z.string().optional(), sender_nickname: z.string().optional(), sender_avatar: z.string().optional(),
  replyTo: z.object({ id: z.string(), content: z.string(), sender_nickname: z.string().optional(), isAI: z.boolean() }).optional(),
  reactions: z.record(z.string(), z.array(z.string())).optional(),
  retryContext: z.object({
    persona: z.string(), heatLevel: z.number().optional(), specialMode: z.string().optional(),
    flowState: z.boolean().optional(), imageData: z.union([z.string(), z.array(z.string())]).optional(),
    inputImageUrls: z.array(z.string()).optional(), imageDimensions: dimensions.optional(),
    pdfData: z.string().optional(), pdfFileName: z.string().optional(),
  }).optional(),
}).passthrough().transform((message): Message => ({
  ...message, id: String(message.id),
  ...(typeof message.id === 'number' && !message.createdAt
    ? { createdAt: new Date(message.id).toISOString() } : {}),
}));
const sessionSchema = z.object({
  id: z.string().min(1), user_id: z.string().optional(), name: z.string().min(1),
  messages: z.array(messageSchema),
  persona: z.custom<ChatSession['persona']>(value => typeof value === 'string' && Object.prototype.hasOwnProperty.call(AI_PERSONAS, value)),
  heat_level: z.number().optional(), createdAt: z.string().min(1), lastModified: z.string().min(1),
}).passthrough();

/** Validate imported JSON before either local or cloud history receives it. */
export function parseChatImport(value: unknown): ChatSession[] {
  const archive = z.object({ sessions: z.array(z.unknown()) }).parse(value);
  return archive.sessions.flatMap(session => {
    const parsed = sessionSchema.safeParse(session);
    return parsed.success ? [parsed.data] : [];
  });
}
