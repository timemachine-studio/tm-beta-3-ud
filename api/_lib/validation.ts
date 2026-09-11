import { z } from 'zod';
import type { VercelRequest, VercelResponse } from './vercelTypes.js';
import { apiErrorBody } from './errors.js';
import { MAX_SESSION_TOOLS } from '../../shared/toolRegistry.js';
import { sessionToolSummarySchema } from '../../shared/toolRegistrySchema.js';

/**
 * Input bounds for the API (production-check.md 1.8).
 *
 * `ai-proxy` used to check only that `messages` was an array — no cap on
 * message count, message length, total payload, pdfData size or image count.
 * A single request with a 50 MB pdfData string or 10,000 messages ran to the
 * 300-second limit and billed us for the tokens.
 */
export const LIMITS = {
  // Whole-request ceiling. Not the 1 MB the plan suggested: image attachments
  // are sent as base64 in the body and nothing downsizes them client-side, so
  // 1 MB would reject ordinary photo messages. 4 MB sits just under Vercel's
  // own ~4.5 MB serverless payload limit, which means an oversized request now
  // gets a clear 413 from us instead of a platform error.
  maxBodyBytes: 4 * 1024 * 1024,
  // Everything that is not an attachment. This is where the 1 MB bound lives.
  maxTextBytes: 1024 * 1024,
  maxMessages: 100,
  maxMessageChars: 32_000,
  maxImageUrls: 10,
  maxImageData: 10,
  maxImageDataBytes: 3 * 1024 * 1024,
  maxPdfChars: 400_000,
  maxPromptChars: 4_000,
  // One device tool result, and the whole replayed transcript. Matches
  // MAX_DEVICE_RESULT_CHARS in shared/deviceTools.ts, which is what the
  // executors truncate to before sending.
  maxDeviceResultChars: 12_000,
  maxToolTranscript: 64,
} as const;

/**
 * Reject an oversized body before parsing it.
 *
 * Vercel buffers and JSON-parses the body before the handler runs, so this is
 * a cost ceiling on what we then do with it, not a true streaming limit. The
 * dev middleware mirrors Vercel's separate 4.5 MB platform ceiling before it
 * constructs this parsed request object.
 */
export function bodyTooLarge(req: VercelRequest): boolean {
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > LIMITS.maxBodyBytes) return true;
  if (!req.body) return false;
  try {
    const body = req.body as Record<string, unknown>;
    if (JSON.stringify(body).length > LIMITS.maxBodyBytes) return true;

    // Attachments get their own budget; everything else is held to 1 MB.
    const { imageData, ...rest } = body;
    if (JSON.stringify(rest).length > LIMITS.maxTextBytes) return true;

    const images = Array.isArray(imageData) ? imageData : imageData ? [imageData] : [];
    const imageBytes = images.reduce<number>(
      (total, image) => total + (typeof image === 'string' ? image.length : 0),
      0,
    );
    return imageBytes > LIMITS.maxImageDataBytes;
  } catch {
    return true; // Unserialisable body: refuse rather than guess.
  }
}

/** Hosts we are willing to hand to an upstream image pipeline. */
function allowedImageHosts(): string[] {
  const hosts = new Set<string>(['i.ibb.co', 'ibb.co']);
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  if (supabaseUrl) {
    try { hosts.add(new URL(supabaseUrl).host); } catch { /* malformed env */ }
  }
  for (const extra of (process.env.ALLOWED_IMAGE_HOSTS || '').split(',')) {
    const host = extra.trim();
    if (host) hosts.add(host);
  }
  return [...hosts];
}

/**
 * An absolute https URL on a host we control or trust.
 *
 * These URLs are handed to an upstream image pipeline that fetches them, so an
 * unvalidated value is an SSRF surface. A prefix test like
 * `startsWith('http')` is not a scheme check.
 */
export function isAllowedImageUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  return allowedImageHosts().includes(url.host);
}

/**
 * The assistant/tool turns a device round trip carries back into the next leg.
 *
 * This is client-supplied prompt content, same as `messages` — it grants no
 * new authority, since the device tools ran under the user's own session on
 * the user's own device. What it does need is a bound: it is replayed into
 * the model verbatim, and a device tool result is the one part of the prompt
 * the user never typed.
 */
const toolTranscriptMessageSchema = z.object({
  role: z.enum(['assistant', 'tool']),
  content: z.string().max(LIMITS.maxDeviceResultChars).nullable(),
  tool_calls: z.array(z.object({
    id: z.string().min(1).max(200),
    type: z.string().max(32),
    function: z.object({
      name: z.string().min(1).max(64),
      arguments: z.string().max(LIMITS.maxMessageChars),
    }),
  })).max(16).optional(),
  tool_call_id: z.string().max(200).optional(),
  name: z.string().max(64).optional(),
}).strict();

const messageSchema = z.object({
  content: z.string().max(LIMITS.maxMessageChars),
  isAI: z.boolean().optional(),
}).passthrough();

export const PERSONAS = ['default', 'girlie', 'pro'] as const;

// A base64 data URL, or an https URL on an allowed host.
const imageDataSchema = z.string().max(LIMITS.maxImageDataBytes).refine(
  value => value.startsWith('data:image/') || isAllowedImageUrl(value),
  { message: 'imageData must be an image data URL or an allowed https image URL' },
);

const imageUrlSchema = z.string().refine(isAllowedImageUrl, {
  message: 'inputImageUrls must be https URLs on an allowed host',
});

export const aiProxyBodySchema = z.object({
  messages: z.array(messageSchema).min(1).max(LIMITS.maxMessages),
  persona: z.enum(PERSONAS).default('default'),
  imageData: z.union([imageDataSchema, z.array(imageDataSchema).max(LIMITS.maxImageData)]).optional(),
  heatLevel: z.number().int().min(1).max(5).default(2),
  stream: z.boolean().default(false),
  flowState: z.boolean().default(false),
  inputImageUrls: z.array(imageUrlSchema).max(LIMITS.maxImageUrls).optional(),
  imageDimensions: z.object({
    width: z.number().int().positive().max(20_000),
    height: z.number().int().positive().max(20_000),
  }).optional(),
  userMemories: z.object({
    nickname: z.string().max(200).optional(),
    about_me: z.string().max(4_000).optional(),
  }).optional(),
  // Special modes are declared in specialModePrompts.js and change over time;
  // bound the shape here and let the lookup decide whether it exists.
  specialMode: z.string().max(64).optional(),
  pdfData: z.string().max(LIMITS.maxPdfChars).optional(),
  pdfFileName: z.string().max(300).optional(),
  pdfExtractedText: z.string().max(LIMITS.maxPdfChars).optional(),
  chatSessionId: z.string().max(100).optional(),
  // ─── Device tool bridge (shared/deviceTools.ts) ───────────────────────────
  // Which device apps this client can execute for. Absent means none: an
  // older cached bundle must not be offered tools it cannot run.
  deviceApps: z.array(z.enum(['notes', 'chats', 'python'])).max(8).optional(),
  // Of those, the ones that actually hold data. Readers are left out of a
  // request with nothing to read; writers never are.
  deviceDataPresent: z.array(z.enum(['notes', 'chats', 'python'])).max(8).optional(),
  deviceRounds: z.number().int().min(0).max(16).default(0),
  // Files the user attached, by reference. The bytes never leave the device —
  // this is metadata so the model can be told what it can open, and nothing
  // here is trusted for anything but wording.
  deviceFiles: z.array(z.object({
    name: z.string().max(200),
    mime: z.string().max(120),
    size: z.number().int().min(0),
  })).max(8).optional(),
  toolTranscript: z.array(toolTranscriptMessageSchema).max(LIMITS.maxToolTranscript).optional(),
  // Tools this conversation created (shared/toolRegistry.ts). Summaries only:
  // the code stays on the device that wrote it. Each becomes a descriptor the
  // model may call, so every field is validated as if it came from the model —
  // which is where it did come from, one leg ago.
  sessionTools: z.array(sessionToolSummarySchema).max(MAX_SESSION_TOOLS).optional(),
}).passthrough();

export type AiProxyBody = z.infer<typeof aiProxyBodySchema>;

export const proGenerationBodySchema = aiProxyBodySchema;

export const mcpApprovalBodySchema = z.object({
  runId: z.string().min(1).max(200),
  decision: z.enum(['approve', 'deny']),
});

const noteBlockSchema = z.object({
  index: z.number().int().min(0),
  id: z.string().max(200),
  type: z.string().max(64),
  content: z.string().max(LIMITS.maxMessageChars),
  checked: z.boolean().optional(),
}).passthrough();

export const notesAiBodySchema = z.object({
  title: z.string().max(500).optional(),
  blocks: z.array(noteBlockSchema).max(2_000),
  instruction: z.string().min(1).max(LIMITS.maxPromptChars),
}).passthrough();

/**
 * Validate, or send a 400 and return null.
 *
 * The message names the offending fields but never echoes their values —
 * a rejected payload should not come back as a reflection of itself.
 */
export function parseOrReject<T extends z.ZodType>(
  res: VercelResponse,
  schema: T,
  data: unknown,
): z.infer<T> | null {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const fields = result.error.issues
    .slice(0, 5)
    .map(issue => (issue.path.length ? issue.path.join('.') : 'body'));
  res.status(400).json(apiErrorBody('BAD_REQUEST', `Invalid request: ${[...new Set(fields)].join(', ')}`));
  return null;
}

/** Guard for oversized payloads. Returns true when it has already responded. */
export function rejectIfTooLarge(req: VercelRequest, res: VercelResponse): boolean {
  if (!bodyTooLarge(req)) return false;
  res.status(413).json(apiErrorBody(
    'PAYLOAD_TOO_LARGE',
    'That message is too large to send. Try a smaller attachment.',
  ));
  return true;
}

/**
 * Query-parameter endpoints (image, music, musicCover, search). These take a
 * prompt straight into a provider URL, so the bound matters as much as it does
 * for the JSON bodies.
 */
export const promptQuerySchema = z.object({
  prompt: z.string().min(1).max(LIMITS.maxPromptChars),
});

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(300),
});

export const webSearchQuerySchema = z.object({
  web: z.string().min(1).max(300),
});

/** Query params arrive as strings, so numbers are coerced then bounded. */
const optionalSeed = z.coerce.number().int().min(0).max(2_147_483_647).optional();

export const musicQuerySchema = promptQuerySchema.extend({
  duration: z.coerce.number().int().min(1).max(300).default(60),
  seed: optionalSeed,
});

export const musicCoverQuerySchema = promptQuerySchema.extend({
  width: z.coerce.number().int().min(64).max(2_048).default(1024),
  height: z.coerce.number().int().min(64).max(2_048).default(1024),
  seed: optionalSeed,
});
