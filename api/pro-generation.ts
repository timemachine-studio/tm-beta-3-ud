import type { ModelConfig, SpecialModeConfig, VisionCapability } from './_lib/providerTypes.js';
import type { ProviderMessage, ProviderTool } from './_lib/providerTypes.js';
import type { VercelRequest, VercelResponse } from './_lib/vercelTypes.js';
import { tasks } from '@trigger.dev/sdk';
import {
  AI_PERSONAS,
  buildProviderChain,
  checkRateLimit,
  extractImageContent,
  fetchHealthcareRAGContext,
  fetchUserMemories,
  formatMemoriesForContext,
  personaFallbacks,
  runProviderNames,
} from './ai-proxy.js';
import { TOOL_GUARDRAIL, THINKING_DIRECTIVE, selectTools, resolveImageAllowed, resolveWebSearchAllowed, toApiMessages } from './_lib/tools.js';
import { SPECIAL_MODE_CONFIGS } from './_lib/specialModePrompts.js';
import {
  getAuthenticatedRequestUser,
  getRequestAccessToken,
  createUserScopedClient,
  assertOwnUserId,
} from './_lib/auth.js';
import { applyCors, hasAcceptableOrigin } from './_lib/cors.js';
import {
  attachProJobRunId,
  createProJob,
  failProJob,
  getActiveProJob,
  getProJobByRunId,
} from './_lib/proJobs.js';
import type { ProGenerationPayload } from '../trigger/proGeneration.js';
import { proGenerationBodySchema, parseOrReject, rejectIfTooLarge } from './_lib/validation.js';
import {
  applyOcrVision,
  collectAttachments,
  hasAttachments,
  resolveVisionMode,
  selectOcrImages,
  selectVisionImages,
  type VisionHop,
} from './_lib/vision.js';

/**
 * How much inline image data may travel in a PRO job payload.
 *
 * PRO's model call happens on Trigger.dev, so anything the task needs has to
 * be serialised into the payload. Hosted image URLs are a few hundred bytes;
 * base64 data URLs are megabytes, and the composer only falls back to those
 * when an upload failed. Above this budget the route transcribes the image
 * itself and ships the text, trading the better answer for a job that starts.
 */
const PRO_INLINE_IMAGE_BUDGET = 512 * 1024;

// ─── TimeMachine PRO: background generation entry point ─────────────────────
// POST /api/pro-generation  → validates quota, builds the full prompt/messages
//                             (identical to /api/ai-proxy), starts a Trigger.dev
//                             run and returns { runId } within seconds.
// GET  /api/pro-generation?chatSessionId=… → { active, runId? } for reattach
// GET  /api/pro-generation?runId=…         → { status, error? } for polling

const personaConfig = AI_PERSONAS.pro;

async function handlePost(req: VercelRequest, res: VercelResponse) {
  // Bound every input before starting a paid background run (1.8).
  if (rejectIfTooLarge(req, res)) return;
  const body = parseOrReject(res, proGenerationBodySchema, req.body ?? {});
  if (!body) return;

  const {
    messages,
    heatLevel,
    imageData,
    inputImageUrls,
    imageDimensions,
    userMemories,
    specialMode,
    pdfData,
    pdfFileName,
    pdfExtractedText,
    chatSessionId,
  } = body;

  // Identify the user from the Supabase access token (falls back to anonymous)
  const authUser = await getAuthenticatedRequestUser(req);
  const userId = authUser?.id ?? null;

  // Rate limiting (same Supabase-backed limits as /api/ai-proxy)
  const clientIP = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress || 'unknown';
  const ip = Array.isArray(clientIP) ? clientIP[0] : clientIP;

  // PRO has no anonymous allowance — an account is required.
  if (!userId) {
    return res.status(401).json({ error: 'Sign in to use TimeMachine PRO', type: 'authRequired' });
  }

  const proProvider = (personaConfig as { provider?: string }).provider || 'pollinations';
  const limitOutcome = await checkRateLimit(userId, ip, 'pro', {
    providers: runProviderNames(proProvider, personaConfig),
  });
  if (!limitOutcome.allowed) {
    if (limitOutcome.reason === 'backend_error' || limitOutcome.reason === 'spend_ceiling') {
      return res.status(503).json({
        error: 'Service temporarily unavailable',
        type: limitOutcome.reason === 'backend_error' ? 'rateLimitBackend' : 'spendCeiling',
      });
    }
    return res.status(429).json({
      error: 'Rate limit exceeded',
      type: 'rateLimit',
    });
  }

  // ─── Prompt building — mirrors the pro branch of /api/ai-proxy ──────────
  const specialModeConfig = specialMode && (SPECIAL_MODE_CONFIGS as Record<string, Record<'default' | 'girlie' | 'pro', SpecialModeConfig>>)[specialMode]
    ? (SPECIAL_MODE_CONFIGS as Record<string, Record<'default' | 'girlie' | 'pro', SpecialModeConfig>>)[specialMode]['pro']
    : null;

  let systemPrompt: string;
  if (specialModeConfig) {
    systemPrompt = specialModeConfig.systemPrompt;
  } else {
    const validHeatLevel = heatLevel >= 1 && heatLevel <= 5 ? heatLevel : 2;
    systemPrompt = personaConfig.systemPromptsByHeatLevel[validHeatLevel as keyof typeof personaConfig.systemPromptsByHeatLevel];
  }

  let memoryContext = '';
  if (userId) {
    assertOwnUserId(userId, authUser?.id ?? null);
    const accessToken = getRequestAccessToken(req);
    const userClient = (accessToken && createUserScopedClient(accessToken)) || undefined;
    const memories = await fetchUserMemories(userId, 'pro', userClient);
    const userProfile = userMemories as { nickname?: string; about_me?: string } | undefined;
    memoryContext = formatMemoriesForContext(memories, userProfile);
  }

  const memoryInstructions = (userId && specialMode !== 'music-compose') ? `

## Memory
When the user shares important information about themselves that you should remember for future conversations (like preferences, facts about their life, things they like/dislike, etc.), save it by writing the information inside <memory> tags at the END of your message. Only save genuinely important, lasting information - not temporary things.

Example: If user says "My favorite song is Attention by Charlie Puth", you would end your response with:
<memory>User's favorite song is Attention by Charlie Puth</memory>

The memory tags will be processed and removed from the visible response, so write your actual response normally before the tags.` : '';

  const thinkingDirective = specialMode === 'music-compose' ? '' : THINKING_DIRECTIVE;

  const enhancedSystemPrompt = `${systemPrompt}${memoryContext}${memoryInstructions}

${TOOL_GUARDRAIL}
${thinkingDirective}`;

  const modelToUse = specialModeConfig?.model || personaConfig.model;
  let systemPromptToUse = enhancedSystemPrompt;
  // PRO always gets the skills library tools
  // Decided in code, not asked of the model: see api/_lib/tools.ts.
  const imageAllowed = resolveImageAllowed(messages, !!imageData);
  const searchAllowed = resolveWebSearchAllowed(messages);
  const toolsToUse: ProviderTool[] = selectTools({
    specialModeConfig,
    includeSkills: true,
    imageAllowed,
    searchAllowed,
  });

  const temperatureToUse = specialModeConfig?.temperature ?? personaConfig.temperature;
  const maxTokensToUse = specialModeConfig?.maxTokens ?? personaConfig.maxTokens;
  const reasoningEffortToUse: string | undefined = specialModeConfig?.reasoningEffort ?? (personaConfig as ModelConfig).reasoningEffort;
  const providerToUse: string = proProvider;

  // Healthcare RAG (tm-healthcare special mode)
  if (specialMode === 'tm-healthcare') {
    const recentMessages = messages.slice(-6);
    const combinedText = recentMessages.map((m) => m.content).join(' ');
    if (combinedText.trim()) {
      const ragContext = await fetchHealthcareRAGContext(combinedText);
      if (ragContext) {
        systemPromptToUse = systemPromptToUse + ragContext;
      }
    }
  }

  // Build apiMessages (pro always uses a system prompt)
  const apiMessages: ProviderMessage[] = [
    { role: 'system', content: systemPromptToUse },
    ...toApiMessages(messages),
  ];

  // PDF/document text injection
  const pdfTextContent = pdfData || pdfExtractedText || '';
  if (pdfTextContent && apiMessages.length > 0) {
    const lastMsgIndex = apiMessages.length - 1;
    const lastMsg = apiMessages[lastMsgIndex];
    // Runs before any image parts are attached, so content is still a string.
    const lastText = typeof lastMsg.content === 'string' ? lastMsg.content : '';
    const isPlaceholderOnly = lastText.startsWith('[PDF:') || lastText.startsWith('[File:');
    const userPrompt = isPlaceholderOnly ? '' : lastText;
    const ext = pdfFileName?.split('.').pop()?.toLowerCase() || '';
    const isPdf = ext === 'pdf';
    const fileLabel = pdfFileName ? `"${pdfFileName}"` : (isPdf ? 'the uploaded PDF' : 'the uploaded file');

    const fileContext = isPdf
      ? `<pdf_document name=${JSON.stringify(fileLabel)}>\n${pdfTextContent}\n</pdf_document>`
      : `<uploaded_file name=${JSON.stringify(fileLabel)} type=${JSON.stringify(ext)}>\n${pdfTextContent}\n</uploaded_file>`;

    const enrichedContent = userPrompt
      ? `${fileContext}\n\nUser's question about ${fileLabel}: ${userPrompt}`
      : `${fileContext}\n\nThe user uploaded ${fileLabel}. Please provide a comprehensive summary of the document above.`;

    apiMessages[lastMsgIndex] = { ...lastMsg, content: enrichedContent };
  }

  // ─── Vision ─────────────────────────────────────────────────────────────
  // K3 takes image parts, so PRO normally sends the image itself and never
  // transcribes. The chain is built here rather than at payload-assembly time
  // because the decision below depends on what is in it.
  const primaryCapability: VisionCapability = specialModeConfig
    ? { vision: specialModeConfig.vision, imageTransport: specialModeConfig.imageTransport }
    : {
        vision: personaConfig.vision,
        imageTransport: (personaConfig as ModelConfig).imageTransport,
      };

  const providerChain = buildProviderChain(
    providerToUse,
    modelToUse,
    personaFallbacks(personaConfig),
    primaryCapability,
  ).filter(hop => limitOutcome.providers.includes(hop.provider));

  const attachments = collectAttachments(imageData, inputImageUrls);
  const hasImageInput = hasAttachments(attachments);
  const imageIndex = apiMessages.length - 1;

  // Images that travel with the job, for the task to attach or transcribe as
  // whichever hop serves the run requires. Empty means the route already
  // settled it and the messages are final.
  let visionImages: string[] = [];

  if (hasImageInput) {
    const chainCanSee = providerChain.some(hop => resolveVisionMode(hop as VisionHop) === 'native');
    const selected = selectVisionImages(attachments, primaryCapability.imageTransport);
    const inlineBytes = selected.reduce(
      (total, image) => total + (image.startsWith('data:') ? image.length : 0),
      0,
    );

    if (chainCanSee && selected.length > 0 && inlineBytes <= PRO_INLINE_IMAGE_BUDGET) {
      visionImages = selected;
    } else {
      // No hop on this chain can see, or the images are too big to serialise
      // into the payload: transcribe here and send text, as PRO always did.
      //
      // Logged because the second case is a silent quality downgrade with an
      // upstream cause worth knowing about — it only happens when the
      // composer's image upload failed and left nothing but base64 behind.
      console.warn(
        `[pro] vision falling back to transcription (chainCanSee=${chainCanSee}, inlineBytes=${inlineBytes})`,
      );
      const ocrImages = selectOcrImages(attachments);
      let extractedText: string | null = null;
      try {
        extractedText = await extractImageContent(ocrImages);
      } catch (ocrError) {
        console.error('Image OCR pipeline error (pro-generation):', ocrError);
      }
      const enriched = applyOcrVision(apiMessages, imageIndex, ocrImages.length, extractedText);
      apiMessages.splice(0, apiMessages.length, ...enriched);
    }
  }

  // ─── Create the job row, then start the background run ──────────────────
  const job = await createProJob(userId, typeof chatSessionId === 'string' ? chatSessionId : null);

  const payload: ProGenerationPayload = {
    jobId: job.id,
    apiMessages,
    tools: toolsToUse,
    model: modelToUse,
    temperature: temperatureToUse,
    maxTokens: maxTokensToUse,
    provider: providerToUse,
    // The whole chain travels with the job: the task runs on Trigger.dev and
    // cannot resolve AI_PERSONAS' fallbacks for itself. Hops whose provider is
    // out of budget for the day are dropped here, same as in /api/ai-proxy.
    // Each hop carries its own vision capability, so the task can shape the
    // messages for whichever one ends up serving the run.
    providerChain,
    reasoningEffort: reasoningEffortToUse,
    userId,
    ip,
    inputImageUrls,
    imageDimensions,
    hadImageInput: hasImageInput,
    ...(visionImages.length > 0 ? { visionImages, visionImageIndex: imageIndex } : {}),
    imageAllowed,
    searchAllowed,
  };

  try {
    const handle = await tasks.trigger('pro-generation', payload, {
      tags: [
        'persona:pro',
        userId ? `user:${userId}` : 'user:anonymous',
        job.chat_session_id ? `chat:${job.chat_session_id}` : 'chat:none',
      ],
    });

    await attachProJobRunId(job.id, handle.id);

    return res.status(200).json({ runId: handle.id });
  } catch (error) {
    console.error('Failed to trigger PRO generation run:', error);
    await failProJob(job.id, error instanceof Error ? error.message : String(error));
    return res.status(500).json({ error: 'Failed to start PRO generation. Please try again.' });
  }
}

async function handleGet(req: VercelRequest, res: VercelResponse) {
  const authUser = await getAuthenticatedRequestUser(req);
  const userId = authUser?.id ?? null;

  // Status poll for a specific run (used by the non-streaming fallback and by
  // the stream reader when it suspects the run ended).
  const runId = typeof req.query.runId === 'string' ? req.query.runId : '';
  if (runId) {
    const job = await getProJobByRunId(runId);
    if (!job) {
      return res.status(404).json({ error: 'Unknown run id' });
    }
    if (job.user_id && job.user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return res.status(200).json({
      status: job.status,
      error: job.error,
      finalContent: job.status === 'completed' ? job.final_content : null,
    });
  }

  // Active-job lookup for reattach-after-refresh
  const chatSessionId = typeof req.query.chatSessionId === 'string' ? req.query.chatSessionId : '';
  if (!chatSessionId) {
    return res.status(400).json({ error: 'chatSessionId or runId is required' });
  }

  const job = await getActiveProJob(chatSessionId, userId);
  if (!job || !job.run_id) {
    return res.status(200).json({ active: false });
  }

  return res.status(200).json({ active: true, runId: job.run_id });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(req, res, 'GET, POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!hasAcceptableOrigin(req)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  try {
    if (req.method === 'POST') {
      return await handlePost(req, res);
    }
    if (req.method === 'GET') {
      return await handleGet(req, res);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('PRO generation route error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('Rate limit') || errorMessage.includes('429')) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        type: 'rateLimit',
      });
    }

    return res.status(500).json({
      error: 'We are facing huge load on our servers and thus we\'ve had to temporarily limit access to maintain system stability. Please be patient, we hate this as much as you do but this thing doesn\'t grow on trees :")',
    });
  }
}
