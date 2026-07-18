import type { VercelRequest, VercelResponse } from '@vercel/node';
import { tasks } from '@trigger.dev/sdk';
import {
  AI_PERSONAS,
  TOOL_GUARDRAIL,
  imageGenerationTool,
  webSearchTool,
  listSkillsTool,
  readSkillTool,
  checkRateLimit,
  extractImageContent,
  fetchHealthcareRAGContext,
  fetchUserMemories,
  formatMemoriesForContext,
} from './ai-proxy.js';
import { SPECIAL_MODE_CONFIGS } from './specialModePrompts.js';
import { getAuthenticatedRequestUser } from './lib/auth.js';
import {
  attachProJobRunId,
  createProJob,
  failProJob,
  getActiveProJob,
  getProJobByRunId,
} from './lib/proJobs.js';
import type { ProGenerationPayload } from '../trigger/proGeneration.js';

// ─── TimeMachine PRO: background generation entry point ─────────────────────
// POST /api/pro-generation  → validates quota, builds the full prompt/messages
//                             (identical to /api/ai-proxy), starts a Trigger.dev
//                             run and returns { runId } within seconds.
// GET  /api/pro-generation?chatSessionId=… → { active, runId? } for reattach
// GET  /api/pro-generation?runId=…         → { status, error? } for polling

const personaConfig = AI_PERSONAS.pro;

async function handlePost(req: VercelRequest, res: VercelResponse) {
  const {
    messages,
    heatLevel = 2,
    imageData,
    inputImageUrls,
    imageDimensions,
    userMemories,
    specialMode,
    pdfData,
    pdfFileName,
    pdfExtractedText,
    chatSessionId,
  } = req.body ?? {};

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid messages format' });
  }

  // Identify the user from the Supabase access token (falls back to anonymous)
  const authUser = await getAuthenticatedRequestUser(req);
  const userId = authUser?.id ?? null;

  // Rate limiting (same Supabase-backed limits as /api/ai-proxy)
  const clientIP = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress || 'unknown';
  const ip = Array.isArray(clientIP) ? clientIP[0] : clientIP;

  const withinLimit = await checkRateLimit(userId, ip, 'pro');
  if (!withinLimit) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      type: 'rateLimit',
    });
  }

  // ─── Prompt building — mirrors the pro branch of /api/ai-proxy ──────────
  const toolMap: Record<string, any> = {
    imageGeneration: imageGenerationTool,
    webSearch: webSearchTool,
    listSkills: listSkillsTool,
    readSkill: readSkillTool,
  };

  const specialModeConfig = specialMode && (SPECIAL_MODE_CONFIGS as Record<string, any>)[specialMode]
    ? (SPECIAL_MODE_CONFIGS as Record<string, any>)[specialMode]['pro']
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
    const memories = await fetchUserMemories(userId, 'pro');
    const userProfile = userMemories as { nickname?: string; about_me?: string } | undefined;
    memoryContext = formatMemoriesForContext(memories, userProfile);
  }

  const memoryInstructions = (userId && specialMode !== 'music-compose') ? `

## Memory
When the user shares important information about themselves that you should remember for future conversations (like preferences, facts about their life, things they like/dislike, etc.), save it by writing the information inside <memory> tags at the END of your message. Only save genuinely important, lasting information - not temporary things.

Example: If user says "My favorite song is Attention by Charlie Puth", you would end your response with:
<memory>User's favorite song is Attention by Charlie Puth</memory>

The memory tags will be processed and removed from the visible response, so write your actual response normally before the tags.` : '';

  const enhancedSystemPrompt = `${systemPrompt}${memoryContext}${memoryInstructions}

${TOOL_GUARDRAIL}

.`;

  const modelToUse = specialModeConfig?.model || personaConfig.model;
  let systemPromptToUse = enhancedSystemPrompt;
  const toolsToUse: any[] = specialModeConfig && 'tools' in specialModeConfig
    ? specialModeConfig.tools.map((t: string) => toolMap[t]).filter(Boolean)
    : [imageGenerationTool, webSearchTool];

  // PRO always gets the skills library tools
  toolsToUse.push(listSkillsTool, readSkillTool);

  const temperatureToUse = specialModeConfig?.temperature ?? personaConfig.temperature;
  const maxTokensToUse = specialModeConfig?.maxTokens ?? personaConfig.maxTokens;
  const reasoningEffortToUse: string | undefined = specialModeConfig?.reasoningEffort ?? (personaConfig as any).reasoningEffort;
  const providerToUse: string = (personaConfig as any).provider || 'pollinations';

  // Healthcare RAG (tm-healthcare special mode)
  if (specialMode === 'tm-healthcare') {
    const recentMessages = messages.slice(-6);
    const combinedText = recentMessages.map((m: any) => m.content).join(' ');
    if (combinedText.trim()) {
      const ragContext = await fetchHealthcareRAGContext(combinedText);
      if (ragContext) {
        systemPromptToUse = systemPromptToUse + ragContext;
      }
    }
  }

  // Build apiMessages (pro always uses a system prompt)
  let apiMessages: any[] = [
    { role: 'system', content: systemPromptToUse },
    ...messages.map((msg: any) => ({
      role: msg.isAI ? 'assistant' : 'user',
      content: msg.content,
    })),
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
    reasoningEffort: reasoningEffortToUse,
    userId,
    ip,
    inputImageUrls,
    imageDimensions,
    hadImageInput: hasImageInput && imageUrlsForOCR.length > 0,
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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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
