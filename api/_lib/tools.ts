import type { ProviderTool } from './providerTypes.js';
// Single source of truth for tool definitions, tool selection and tool execution.
//
// Before this module existed, tool selection was duplicated across
// api/ai-proxy.ts and api/pro-generation.ts, and the generate_image /
// web_search handlers were copy-pasted into five separate call sites. Fixes
// landed in some copies and not others, which is why they never fully stuck.
// Everything tool-related now lives here; call sites supply an emitter.

import { SKILLS_DATA } from '../../shared/skills.js';

const POLLINATIONS_API_KEY = (process.env.POLLINATIONS_API_KEY || '').trim();

// ─── Tool definitions ───────────────────────────────────────────────────────

// Stated positively on purpose. The previous version named generate_image in
// the same breath as "coding", "design", "HTML/CSS" and "website" four times
// over, which associated the tool with exactly the requests it should stay out
// of — the negations carried far less weight than the topic words around them.
// Which tools exist is now decided in selectTools() instead of asked for here.
export const TOOL_GUARDRAIL = `
## Tool Usage Policy
1. Prefer your own knowledge and reasoning over tools. Reach for a tool only when the user needs something you cannot produce yourself.
2. When the user asks for a website, app, game, or any other code, write the code directly in a fenced code block.
3. The tools listed in this request are the only ones available to you. If a tool is not listed, it does not exist for this turn.
`;

// The <reason> mechanism is the thinking feature, so it goes last in the
// assembled system prompt. Each persona already describes it mid-prompt, but
// memory instructions and the tool policy come after that — and the model
// follows whatever it read most recently. Restating it in the final position
// makes the behaviour independent of how long a persona's prompt grows.
export const THINKING_DIRECTIVE = `
## Thinking
When a question needs actual working out — math, counting, logic puzzles, riddles, multi-step problems, tricky code — reason it through inside <reason></reason> tags before you answer, then give the answer after the closing tag. What is inside the tags is for you, not for the user. For simple questions skip it entirely and answer straight away; you are meant to be fast.
`;

export const imageGenerationTool = {
  type: "function" as const,
  function: {
    name: "generate_image",
    strict: true,
    description: "Produce a picture from a text description, for when the user wants a photo, illustration, or artwork as the thing they receive.",
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "What the picture should show: subject, setting, composition, style, lighting."
        },
        orientation: {
          type: "string",
          description: "Shape of the picture.",
          enum: ["portrait", "landscape"]
        },
        process: {
          type: "string",
          description: "Use 'create' for a new picture, 'edit' to alter one the user supplied.",
          enum: ["create", "edit"]
        }
      },
      required: ["prompt", "orientation", "process"],
      additionalProperties: false
    }
  }
};

export const webSearchTool = {
  type: "function" as const,
  function: {
    name: "web_search",
    strict: true,
    description: "Look up current information on the web: recent events, live data, or anything newer than your training.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query."
        }
      },
      required: ["query"],
      additionalProperties: false
    }
  }
};

export const listSkillsTool = {
  type: "function" as const,
  function: {
    name: "list_skills",
    strict: true,
    description: "Get a list of all available specialized skills and prompt instructions that you can read to perform tasks better.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  }
};

export const readSkillTool = {
  type: "function" as const,
  function: {
    name: "read_skill",
    strict: true,
    description: "Read the detailed instructions and guidelines of a specific skill to apply to the user's task.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "The name of the skill to read (e.g., 'frontend_design')."
        }
      },
      required: ["name"],
      additionalProperties: false
    }
  }
};

export const TOOL_MAP: Record<string, ProviderTool> = {
  imageGeneration: imageGenerationTool,
  webSearch: webSearchTool,
  listSkills: listSkillsTool,
  readSkill: readSkillTool
};

// ─── Image + search primitives ──────────────────────────────────────────────

export interface ImageGenerationParams {
  prompt: string;
  orientation?: 'portrait' | 'landscape';
  process?: 'create' | 'edit';
  inputImageUrls?: string[];
  persona?: string;
  imageWidth?: number;
  imageHeight?: number;
}

export interface WebSearchParams {
  query: string;
}

export function generateImageUrl(params: ImageGenerationParams): string {
  const {
    prompt,
    orientation = 'portrait',
    process = 'create',
    inputImageUrls,
    persona = 'default',
    imageWidth,
    imageHeight
  } = params;

  // Proxy URL pointing at our secure image endpoint. The real Pollinations URL
  // (with the secret key) is constructed server-side in /api/image.
  const encodedPrompt = encodeURIComponent(prompt);

  let url = `/api/image?prompt=${encodedPrompt}&orientation=${orientation}&process=${process}&persona=${persona}`;

  if (process === 'edit' && imageWidth && imageHeight) {
    url += `&width=${imageWidth}&height=${imageHeight}`;
  }

  if (inputImageUrls && inputImageUrls.length > 0) {
    const imageUrls = inputImageUrls.slice(0, 4).map(encodeURIComponent).join(',');
    url += `&inputImageUrls=${imageUrls}`;
  }

  return url;
}

export function createImageMarkdown(params: ImageGenerationParams): string {
  const imageUrl = generateImageUrl(params);
  return `![Generated Image](${imageUrl})`;
}

export async function fetchWebSearchResults(params: WebSearchParams): Promise<string> {
  const { query } = params;
  const encodedQuery = encodeURIComponent(query);

  const url = `https://gen.pollinations.ai/text/${encodedQuery}?model=perplexity-fast&key=${POLLINATIONS_API_KEY}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Web search failed: ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    console.error('Web search error:', error);
    throw error;
  }
}

// ─── Tool selection ─────────────────────────────────────────────────────────

// Whether the image generator is offered to the model is decided here, in code,
// rather than asked of the model in the prompt. Declining to call a tool is the
// weakest capability in tool-using LLMs, so the reliable fix is to keep the tool
// out of the request entirely on turns that plainly do not want a picture.

/** Asking for a picture as the deliverable. */
const IMAGE_INTENT = /\b(image|images|picture|pictures|pic|pics|photo|photos|photograph|selfie|portrait|wallpaper|poster|logo|illustration|illustrate|drawing|sketch|painting|paint|artwork|art|avatar|meme|thumbnail|render me|draw me|draw a|draw an)\b/i;

/** Asking for code or a built artifact. Always wins over IMAGE_INTENT. */
const BUILD_INTENT = /\b(html|css|js|javascript|typescript|react|vue|svelte|python|java|rust|golang|sql|code|coding|script|scripts|function|class|component|api|endpoint|app|apps|application|website|webpage|web page|site|page|game|snippet|repo|repository|bug|bugs|error|exception|stack ?trace|refactor|debug|compile|npm|yarn|canvas|svg|animation|diagram|chart|graph|table|json|xml|regex|algorithm|database|query|server|backend|frontend|terminal|command|cli|docker|single file|one file)\b/i;

/** Asking for something only a live lookup can answer. */
const SEARCH_INTENT = /\b(search|google|look ?up|find out|check online|browse the web|web ?search|latest|newest|most recent|current|currently|today|tonight|yesterday|this week|this month|this year|right now|recent|recently|up to date|nowadays|news|headlines?|weather|forecast|who won|score|election|stock|share price|price of|how much (is|does|are)|release date|released|announced|launching|launched|update on|20(2[4-9]|3[0-9]))\b/i;

/** Short transform instructions that follow, or accompany, an existing picture. */
const EDIT_INTENT = /\b(make it|make this|turn it|turn this|change it|change this|edit it|edit this|modify it|modify this|redo|again|another one|instead|version of|in the style|restyle|recolou?r|colou?rize|brighter|darker|zoom|crop|remove the|add a|add an|but with|more like)\b/i;

export interface ImageIntentInput {
  /** Text of the most recent user turn. */
  lastUserText: string;
  /** Text of the most recent assistant turn, used to spot picture follow-ups. */
  lastAssistantText: string;
  /** The user attached an image to this turn. */
  hasAttachedImage: boolean;
}

/**
 * Decide whether `generate_image` belongs in this request at all.
 *
 * Biased toward saying no: a false negative costs the user one clarifying
 * message ("make an image of a cat"), while a false positive is the failure
 * this gate exists to stop.
 */
export function wantsImageTool(input: ImageIntentInput): boolean {
  const { lastUserText = "", lastAssistantText = "", hasAttachedImage } = input;

  // A build request never gets the image tool, whatever else it mentions.
  if (BUILD_INTENT.test(lastUserText)) return false;

  // An outright request for a picture.
  if (IMAGE_INTENT.test(lastUserText)) return true;

  // A tweak to the picture produced in the previous turn.
  if (lastAssistantText.includes("/api/image?") && EDIT_INTENT.test(lastUserText)) return true;

  // A tweak to an image the user just attached.
  if (hasAttachedImage && EDIT_INTENT.test(lastUserText)) return true;

  return false;
}

/**
 * Decide whether `web_search` belongs in this request.
 *
 * Gated for the same reason as the image tool. Gating only one of the two just
 * moves the problem: with generate_image removed from a coding turn, web_search
 * became the single remaining tool at index 0, and models that grab a tool
 * because a tool exists went straight for it.
 */
export function wantsWebSearchTool(lastUserText: string = ''): boolean {
  return SEARCH_INTENT.test(lastUserText);
}

export interface MessageLike {
  content?: string;
  isAI?: boolean;
}

/** Pull the last user turn and last assistant turn out of the raw message list. */
export function deriveImageIntentText(messages: MessageLike[] = []): {
  lastUserText: string;
  lastAssistantText: string;
} {
  let lastUserText = "";
  let lastAssistantText = "";

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!lastUserText && !msg?.isAI && typeof msg?.content === "string") {
      lastUserText = msg.content;
    }
    if (!lastAssistantText && msg?.isAI && typeof msg?.content === "string") {
      lastAssistantText = msg.content;
    }
    if (lastUserText && lastAssistantText) break;
  }

  return { lastUserText, lastAssistantText };
}

export interface SelectToolsOptions {
  /** Resolved special-mode config, if any. Its `tools` array picks the base set. */
  specialModeConfig?: { tools?: string[] } | null;
  /** PRO gets the skills library on top of the base set. */
  includeSkills?: boolean;
  /** Raw `{ content, isAI }` message list for this request. */
  messages?: MessageLike[];
  /** The user attached an image to this turn. */
  hasAttachedImage?: boolean;
  /** Pre-computed gate results. Supply them when the caller also needs the values. */
  imageAllowed?: boolean;
  searchAllowed?: boolean;
}

/**
 * Decide which tools are put in front of the model for this request.
 *
 * A special mode's explicit `tools` list picks the base set — that is how modes
 * like `web-coding` opt out of tools entirely — but the image gate applies on
 * top of it either way.
 */
export function selectTools(opts: SelectToolsOptions): ProviderTool[] {
  const {
    specialModeConfig,
    includeSkills = false,
    messages = [],
    hasAttachedImage = false,
  } = opts;

  let tools: ProviderTool[] = specialModeConfig && Array.isArray(specialModeConfig.tools)
    ? specialModeConfig.tools.map((t: string) => TOOL_MAP[t]).filter(Boolean)
    : [webSearchTool, imageGenerationTool];

  // Both tools are gated. When a turn wants neither, the list comes back empty
  // and the provider helpers omit the `tools` field entirely — the same request
  // shape as the web-coding special mode, which has never had this problem.
  const imageAllowed = opts.imageAllowed ?? resolveImageAllowed(messages, hasAttachedImage);
  const searchAllowed = opts.searchAllowed ?? resolveWebSearchAllowed(messages);

  if (!imageAllowed) {
    tools = tools.filter((t) => t?.function?.name !== "generate_image");
  }
  if (!searchAllowed) {
    tools = tools.filter((t) => t?.function?.name !== "web_search");
  }

  if (includeSkills) {
    tools.push(listSkillsTool, readSkillTool);
  }

  return tools;
}

// ─── History sanitising ─────────────────────────────────────────────────────

// Generated images are streamed into the assistant's own message text, and the
// client sends that text back verbatim on the next turn. Tool calls are not
// replayed, so the model does not see "a tool produced this" — it sees an
// assistant turn that simply contains an image, which is a worked example of
// exactly the behaviour we are trying to suppress. One image early in a chat
// teaches the pattern for the rest of it.
//
// Replacing the markdown with a short marker keeps the fact that an image was
// produced while removing the example — and reclaims the URL-encoded prompt,
// which can be hundreds of tokens per image.

const GENERATED_IMAGE_MARKDOWN = /!\[[^\]]*\]\(\/api\/image\?[^)]*\)/g;

export const GENERATED_IMAGE_PLACEHOLDER = '[image generated]';

/** Strip generated-image markdown out of one assistant message. */
export function sanitizeAssistantContent(content: string): string {
  if (!content || !content.includes('/api/image?')) return content;
  return content.replace(GENERATED_IMAGE_MARKDOWN, GENERATED_IMAGE_PLACEHOLDER);
}

/**
 * Turn the client's `{ content, isAI }` list into API messages, sanitising
 * assistant turns on the way through.
 */
export function toApiMessages(messages: MessageLike[] = []): Array<{ role: string; content: string }> {
  return messages.map((msg) => ({
    role: msg.isAI ? 'assistant' : 'user',
    content: msg.isAI ? sanitizeAssistantContent(msg.content || '') : (msg.content as string),
  }));
}

// ─── Runtime backstop ───────────────────────────────────────────────────────

// Gating (above) keeps generate_image out of requests that plainly do not want
// a picture. This is the second line: if a model calls it anyway — hallucinating
// a tool it was not given, or calling it a second time — the call is refused and
// the tool is revoked for the rest of the run, so it cannot be retried. Unlike a
// prompt instruction this holds regardless of how well the model follows it.

export interface ToolPolicy {
  /** Whether generate_image was allowed into this request at all. */
  imageAllowed: boolean;
  /** Whether web_search was allowed into this request at all. */
  searchAllowed: boolean;
  /** How many images may be produced in a single run. */
  maxImageCalls: number;
  imageCallsUsed: number;
  /** Tool names revoked mid-run. The loop re-filters against this each iteration. */
  revoked: Set<string>;
}

export function createToolPolicy(opts: { imageAllowed: boolean; searchAllowed?: boolean; maxImageCalls?: number }): ToolPolicy {
  return {
    imageAllowed: opts.imageAllowed,
    searchAllowed: opts.searchAllowed ?? true,
    maxImageCalls: opts.maxImageCalls ?? 1,
    imageCallsUsed: 0,
    revoked: new Set<string>(),
  };
}

/** Drop tools revoked earlier in this run from the list sent to the model. */
export function applyPolicy(tools: ProviderTool[], policy?: ToolPolicy | null): ProviderTool[] {
  if (!policy || policy.revoked.size === 0) return tools;
  return tools.filter((t) => !policy.revoked.has(t?.function?.name));
}

/** Whether this request should offer web_search, from the raw message list. */
export function resolveWebSearchAllowed(messages: MessageLike[] = []): boolean {
  return wantsWebSearchTool(deriveImageIntentText(messages).lastUserText);
}

/** Whether this request should offer generate_image, from the raw message list. */
export function resolveImageAllowed(messages: MessageLike[] = [], hasAttachedImage = false): boolean {
  const { lastUserText, lastAssistantText } = deriveImageIntentText(messages);
  return wantsImageTool({ lastUserText, lastAssistantText, hasAttachedImage });
}

// ─── Tool execution ─────────────────────────────────────────────────────────

/**
 * How a call site surfaces tool output to the user.
 *
 * `emitText` receives user-visible content and is expected to apply the call
 * site's own spacing convention. `emitMarker` receives control markers such as
 * `[STATUS:…]` and is a no-op for non-streaming call sites.
 */
export interface ToolEmitter {
  emitText: (text: string) => void | Promise<void>;
  emitMarker: (marker: string) => void | Promise<void>;
}

export interface ToolExecutionContext {
  persona: string;
  inputImageUrls?: string[];
  imageDimensions?: { width?: number; height?: number };
  /** Omitted for call sites that have no loop to enforce a refusal in. */
  policy?: ToolPolicy | null;
}

export interface ToolCallLike {
  id?: string;
  function?: { name?: string; arguments?: string };
}

/** Search results are truncated before entering history to protect the context window. */
const SEARCH_RESULT_LIMIT = 10000;

/**
 * Execute a single tool call and return the string to feed back as the
 * `role: 'tool'` result. Any user-visible output goes through `emit`.
 */
export async function executeTool(
  toolCall: ToolCallLike,
  ctx: ToolExecutionContext,
  emit: ToolEmitter
): Promise<string> {
  const name = toolCall.function?.name;
  const argsStr = toolCall.function?.arguments || '{}';

  if (name === 'web_search') {
    if (ctx.policy && !ctx.policy.searchAllowed) {
      // The model called a tool it was not given. Refuse, and take it away.
      ctx.policy.revoked.add('web_search');
      return 'web_search is not available for this request. Do not call it again. Answer the user directly from your own knowledge.';
    }

    try {
      const params: WebSearchParams = JSON.parse(argsStr);
      await emit.emitMarker(`[STATUS:Searching the web for "${params.query}"]`);
      const searchResults = await fetchWebSearchResults(params);
      return searchResults.slice(0, SEARCH_RESULT_LIMIT);
    } catch (err: unknown) {
      return `Error: ${(err instanceof Error ? (err instanceof Error ? (err instanceof Error ? (err instanceof Error ? err.message : String(err)) : String(err)) : String(err)) : String(err))}`;
    }
  }

  if (name === 'generate_image') {
    const policy = ctx.policy;
    if (policy) {
      if (!policy.imageAllowed) {
        // The model called a tool it was not given. Refuse, and take it away.
        policy.revoked.add('generate_image');
        return 'generate_image is not available for this request. Do not call it again. Answer the user directly with text or code.';
      }
      if (policy.imageCallsUsed >= policy.maxImageCalls) {
        policy.revoked.add('generate_image');
        return 'You have already generated an image for this request. Do not call generate_image again — continue your answer in text.';
      }
      policy.imageCallsUsed++;
    }

    try {
      const params: ImageGenerationParams = JSON.parse(argsStr);
      await emit.emitMarker(`[STATUS:Generating image with prompt: "${params.prompt}"]`);

      const imageMarkdown = createImageMarkdown({
        ...params,
        persona: ctx.persona,
        inputImageUrls: ctx.inputImageUrls,
        imageWidth: ctx.imageDimensions?.width,
        imageHeight: ctx.imageDimensions?.height
      });

      await emit.emitText(imageMarkdown);
      return `Image generated successfully. Markdown link: ${imageMarkdown}`;
    } catch (err: unknown) {
      return `Error: ${(err instanceof Error ? (err instanceof Error ? (err instanceof Error ? (err instanceof Error ? err.message : String(err)) : String(err)) : String(err)) : String(err))}`;
    }
  }

  if (name === 'list_skills') {
    try {
      await emit.emitMarker('[STATUS:Reading skills library]');
      const list = Object.keys(SKILLS_DATA).map(key => ({
        name: SKILLS_DATA[key].name,
        description: SKILLS_DATA[key].description
      }));
      return JSON.stringify(list, null, 2);
    } catch (err: unknown) {
      return `Error: ${(err instanceof Error ? (err instanceof Error ? (err instanceof Error ? (err instanceof Error ? err.message : String(err)) : String(err)) : String(err)) : String(err))}`;
    }
  }

  if (name === 'read_skill') {
    try {
      const params = JSON.parse(argsStr);
      await emit.emitMarker(`[STATUS:Reading skill instructions for ${params.name}]`);
      const skill = SKILLS_DATA[params.name];
      if (skill) {
        return skill.content;
      }
      return `Error: Skill "${params.name}" not found. Available skills: ${Object.keys(SKILLS_DATA).join(', ')}`;
    } catch (err: unknown) {
      return `Error: ${(err instanceof Error ? (err instanceof Error ? (err instanceof Error ? (err instanceof Error ? err.message : String(err)) : String(err)) : String(err)) : String(err))}`;
    }
  }

  return `Error: Unknown tool "${name}".`;
}
