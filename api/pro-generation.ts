import type { ModelConfig, SpecialModeConfig } from './_lib/providerTypes.js';
import type { ProviderMessage, ProviderTool } from './_lib/providerTypes.js';
import { durableProcessingAvailable, RETENTION_UNAVAILABLE } from './_lib/retention/policy.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
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

// ─── TimeMachine PRO: background generation entry point ─────────────────────
// POST /api/pro-generation  → validates quota, builds the full prompt/messages
//                             (identical to /api/ai-proxy), starts a Trigger.dev
//                             run and returns { runId } within seconds.
// GET  /api/pro-generation?chatSessionId=… → { active, runId? } for reattach
// GET  /api/pro-generation?runId=…         → { status, error? } for polling

const personaConfig = AI_PERSONAS.pro;

async function handlePost(req: VercelRequest, res: VercelResponse) {
  if (!durableProcessingAvailable()) return res.status(503).json({ error: RETENTION_UNAVAILABLE });
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
    const isPlaceholderOnly = lastMsg.content?.startsWith('[PDF:') || lastMsg.content?.startsWith('[File:');
    const userPrompt = isPlaceholderOnly ? '' : (lastMsg.content || '');
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

  // Image OCR pipeline (same enrichment as /api/ai-proxy)
  const hasImageInput = !!imageData;
  const imageUrlsForOCR = hasImageInput ? (Array.isArray(imageData) ? imageData : [imageData]) : [];

  if (hasImageInput && imageUrlsForOCR.length > 0) {
    try {
      const extractedText = await extractImageContent(imageUrlsForOCR);

      const lastMsgIndex = apiMessages.length - 1;
      const lastMsg = apiMessages[lastMsgIndex];
      const userPrompt = lastMsg.content === '[Image message]' ? '' : lastMsg.content;

      const imageEditContext = `\n\n[IMPORTANT: The user has attached ${imageUrlsForOCR.length} image(s) to this message. If the user is asking to edit, modify, or transform the image — use the generate_image tool with process="edit" and write a detailed prompt describing the desired result. The image URLs and dimensions are automatically handled by the system.]`;

      const enrichedContent = userPrompt
        ? `[Content extracted from the attached image(s):\n${extractedText}\n]${imageEditContext}\n\nUser's message: ${userPrompt}`
        : `[Content extracted from the attached image(s):\n${extractedText}\n]\n\nThe user shared this image. Respond based on the extracted content above.`;

      apiMessages[lastMsgIndex] = { ...lastMsg, content: enrichedContent };
    } catch (ocrError) {
      console.error('Image OCR pipeline error (pro-generation):', ocrError);
      const lastMsgIndex = apiMessages.length - 1;
      const lastMsg = apiMessages[lastMsgIndex];
      const userPrompt = lastMsg.content === '[Image message]' ? '' : lastMsg.content;
      apiMessages[lastMsgIndex] = {
        ...lastMsg,
        content: userPrompt
          ? `[The user attached an image but text extraction failed. Please respond to their message as best you can. If the user wanted to edit the image, use the generate_image tool with process="edit" and describe what the user wants.]\n\nUser's message: ${userPrompt}`
          : `[The user attached an image but text extraction failed. Let them know you couldn't process the image and ask them to try again.]`,
      };
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
    providerChain: buildProviderChain(providerToUse, modelToUse, personaFallbacks(personaConfig))
      .filter(hop => limitOutcome.providers.includes(hop.provider)),
    reasoningEffort: reasoningEffortToUse,
    userId,
    ip,
    inputImageUrls,
    imageDimensions,
    hadImageInput: hasImageInput && imageUrlsForOCR.length > 0,
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
