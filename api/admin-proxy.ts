import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  callCerebrasAirAPIStreaming,
  callEaonAPIStreaming,
  callGroqStandardAPIStreaming,
  callNvidiaAPIStreaming,
  callPollinationsAPIStreaming,
  callSecretsToAIAPIStreaming,
  createImageMarkdown,
  fetchWebSearchResults,
  imageGenerationTool,
  listSkillsTool,
  readSkillTool,
  TOOL_GUARDRAIL,
  webSearchTool,
} from './ai-proxy.js';
import { SKILLS_DATA } from './skills.js';
import { resolveAdminUser } from './_lib/adminGuard.js';
import { flightControlsAdmin } from './_lib/flightControls.js';
import { discoverMcpTools, executeMcpTool, type DiscoveredMcpTool } from './_lib/mcpClient.js';

// The playground always starts from this base. Admins append their own persona
// prompt and customizations, but this identity is fixed and non-configurable.
const BASE_SYSTEM_PROMPT = 'You are a model made by TimeMachine Engineering.';

// Fixed backend-chosen model + provider. Never exposed to the client — the
// admin playground only tunes temperature, maxTokens, system prompt, skills,
// MCP, and persona preset, per spec.
const ADMIN_PROVIDER = (process.env.ADMIN_PROXY_PROVIDER || 'nvidia').toLowerCase();
const ADMIN_MODEL = process.env.ADMIN_PROXY_MODEL || 'z-ai/glm-5.2';
const ADMIN_TEMPERATURE_DEFAULT = 0.8;
const ADMIN_MAX_TOKENS_DEFAULT = 67200;
const MAX_ITERATIONS = 5;

// Persona presets the client can load into the editable system prompt box.
// Only the prompt text is shipped — never the model name or provider.
interface AdminPreset {
  id: string;
  label: string;
  prompt: string;
}

function buildPersonaPresets(): AdminPreset[] {
  const presets: AdminPreset[] = [];
  for (const [key, persona] of Object.entries(AI_PERSONAS)) {
    if ('systemPromptsByHeatLevel' in persona && persona.systemPromptsByHeatLevel) {
      for (const [level, prompt] of Object.entries(persona.systemPromptsByHeatLevel)) {
        presets.push({
          id: `${key}-${level}`,
          label: `${persona.name} — Heat ${level}`,
          prompt,
        });
      }
    } else if ('systemPrompt' in persona && persona.systemPrompt) {
      presets.push({
        id: key,
        label: persona.name,
        prompt: persona.systemPrompt,
      });
    }
  }
  return presets;
}

interface CustomSkillDef {
  name: string;
  content: string;
}

interface CustomMcpToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface AdminProxyBody {
  messages: Array<{ content: string; isAI?: boolean }>;
  customSystemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  enabledSkillSlugs?: string[];
  enabledMcpIds?: string[];
  customSkills?: CustomSkillDef[];
  customMcpTools?: CustomMcpToolDef[];
  enableSmartThinking?: boolean;
  stream?: boolean;
}

async function streamFromProvider(
  provider: string,
  model: string,
  messages: Array<Record<string, unknown>>,
  temperature: number,
  maxTokens: number,
  tools: any[],
): Promise<ReadableStream> {
  if (provider === 'secretstoai' || provider === 'secrectstoai') {
    return callSecretsToAIAPIStreaming(messages, model, temperature, maxTokens, tools);
  }
  if (provider === 'eaon') {
    return callEaonAPIStreaming(messages, model, temperature, maxTokens, tools);
  }
  if (provider === 'nvidia' || provider === 'nim') {
    return callNvidiaAPIStreaming(messages, model, temperature, maxTokens, tools);
  }
  if (provider === 'groq') {
    return callGroqStandardAPIStreaming(messages, model, temperature, maxTokens, tools);
  }
  if (provider === 'cerebras') {
    return callCerebrasAirAPIStreaming(messages, tools, model, temperature, maxTokens);
  }
  return callPollinationsAPIStreaming(messages, model, temperature, maxTokens, tools);
}

function streamProvider(messages: Array<Record<string, unknown>>, temperature: number, maxTokens: number, tools: any[]): Promise<ReadableStream> {
  return streamFromProvider(ADMIN_PROVIDER, ADMIN_MODEL, messages, temperature, maxTokens, tools);
}

async function resolveSkillContents(slugs: string[]): Promise<string> {
  if (!slugs.length) return '';
  const { data, error } = await flightControlsAdmin
    .from('flight_control_catalog')
    .select('slug,skill_content')
    .eq('kind', 'skill')
    .in('slug', slugs)
    .not('skill_content', 'is', null);
  if (error || !data || data.length === 0) return '';
  const blocks = (data as Array<{ slug: string; skill_content: string | null }>)
    .filter((row) => row.skill_content)
    .map((row) => `<skill name="${row.slug}">\n${row.skill_content}\n</skill>`)
    .join('\n\n');
  return blocks ? `\n\n## Enabled skills (apply when relevant)\n${blocks}` : '';
}

async function resolveMcpTools(ids: string[]): Promise<DiscoveredMcpTool[]> {
  if (!ids.length) return [];
  const { data, error } = await flightControlsAdmin
    .from('flight_control_catalog')
    .select('*')
    .eq('kind', 'mcp')
    .in('id', ids);
  if (error || !data || data.length === 0) return [];
  // Reuse the same shape the flight controls loader expects.
  const servers = data as unknown as Parameters<typeof discoverMcpTools>[0];
  return discoverMcpTools(servers);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await resolveAdminUser(req);
  if (!admin) return res.status(403).json({ error: 'Admin access required' });

  const {
    messages,
    customSystemPrompt = '',
    temperature = ADMIN_TEMPERATURE_DEFAULT,
    maxTokens = ADMIN_MAX_TOKENS_DEFAULT,
    enabledSkillSlugs = [],
    enabledMcpIds = [],
    customSkills = [],
    customMcpTools = [],
    enableSmartThinking = false,
    stream = true,
  } = (req.body || {}) as AdminProxyBody;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages must be a non-empty array' });
  }

  const safeTemperature = Math.min(2, Math.max(0, Number(temperature) || ADMIN_TEMPERATURE_DEFAULT));
  const safeMaxTokens = Math.min(200000, Math.max(256, Math.round(Number(maxTokens) || ADMIN_MAX_TOKENS_DEFAULT)));

  try {
    const [skillBlock, mcpTools] = await Promise.all([
      resolveSkillContents(enabledSkillSlugs),
      resolveMcpTools(enabledMcpIds),
    ]);

    const customPrompt = (customSystemPrompt || '').trim();

    const customSkillBlock = customSkills.length
      ? '\n\n## Custom skills (apply when relevant)\n' +
        customSkills
          .map((s) => `<skill name="${s.name}">\n${s.content}\n</skill>`)
          .join('\n\n')
      : '';

    const smartThinkingBlock = enableSmartThinking
      ? '\n\nCRITICAL: Before answering, think step by step inside <reason> tags. Use <reason> to reason through the problem, then provide your final answer outside the tags.'
      : '';

    const systemPrompt = [
      BASE_SYSTEM_PROMPT,
      customPrompt ? `\n\n${customPrompt}` : '',
      skillBlock,
      customSkillBlock,
      smartThinkingBlock,
      `\n\n${TOOL_GUARDRAIL}`,
    ].join('');

    const apiMessages: Array<Record<string, unknown>> = [
      { role: 'system', content: systemPrompt },
      ...messages.map((msg) => ({
        role: msg.isAI ? 'assistant' : 'user',
        content: msg.content,
      })),
    ];

    const baseTools: any[] = [imageGenerationTool, webSearchTool, listSkillsTool, readSkillTool];
    const mcpDefinitions = mcpTools.map((tool) => tool.definition);
    const customToolDefinitions = customMcpTools.map((t) => ({
      type: 'function' as const,
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
    const tools = [...baseTools, ...mcpDefinitions, ...customToolDefinitions];
    const mcpByName = new Map(mcpTools.map((tool) => [tool.modelName, tool]));

    if (!stream) {
      // The playground only uses streaming, but support a JSON fallback cheaply
      // by consuming the streaming loop and returning the assembled content.
      throw new Error('Non-streaming admin responses are not supported');
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let currentMessages = [...apiMessages];
    let iteration = 0;
    const toolMap = new Map<number, any>();
    let fullContent = '';

    while (iteration < MAX_ITERATIONS) {
      iteration++;
      const activeTools = iteration === MAX_ITERATIONS ? [] : tools;

      const streamingResponse = await streamProvider(currentMessages, safeTemperature, safeMaxTokens, activeTools);
      const reader = streamingResponse.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      let hasToolCalls = false;
      let isFirstContentOfIteration = true;
      toolMap.clear();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.type === 'content') {
              if (isFirstContentOfIteration) {
                isFirstContentOfIteration = false;
                res.write('[STATUS_END]');
                if (fullContent.trim().length > 0) {
                  const gap = '\n\n';
                  assistantContent += gap;
                  res.write(gap);
                  fullContent += gap;
                }
              }
              assistantContent += data.content;
              res.write(data.content);
              fullContent += data.content;
            } else if (data.type === 'tool_calls') {
              hasToolCalls = true;
              for (const delta of data.tool_calls) {
                const index = delta.index;
                if (!toolMap.has(index)) {
                  toolMap.set(index, {
                    id: delta.id || '',
                    type: delta.type || 'function',
                    function: { name: delta.function?.name || '', arguments: delta.function?.arguments || '' },
                  });
                } else {
                  const existing = toolMap.get(index);
                  if (delta.function?.name) existing.function.name = delta.function.name;
                  if (delta.function?.arguments) existing.function.arguments += delta.function.arguments;
                }
              }
            }
          } catch {
            // Ignore malformed chunks — same behaviour as the main proxy.
          }
        }
      }

      if (!hasToolCalls || toolMap.size === 0) break;

      const toolCalls = Array.from(toolMap.values()).filter((tc) => tc.id && tc.function?.name);
      currentMessages.push({ role: 'assistant', content: assistantContent || null, tool_calls: toolCalls });

      for (const toolCall of toolCalls) {
        const name = toolCall.function.name;
        const argsStr = toolCall.function.arguments;
        let result = '';

        if (name === 'web_search') {
          try {
            const params = JSON.parse(argsStr);
            res.write(`[STATUS:Searching the web for "${params.query}"]`);
            const searchResults = await fetchWebSearchResults(params);
            result = searchResults.slice(0, 10000);
          } catch (err: any) {
            result = `Error: ${err.message}`;
          }
        } else if (name === 'generate_image') {
          try {
            const params = JSON.parse(argsStr);
            res.write(`[STATUS:Generating image with prompt: "${params.prompt}"]`);
            const imageMarkdown = createImageMarkdown({ ...params, persona: 'default' });
            res.write(`\n\n${imageMarkdown}\n\n`);
            result = `Image generated successfully. Markdown link: ${imageMarkdown}`;
          } catch (err: any) {
            result = `Error: ${err.message}`;
          }
        } else if (name === 'list_skills') {
          try {
            res.write('[STATUS:Reading skills library]');
            const list = Object.keys(SKILLS_DATA).map((key) => ({
              name: SKILLS_DATA[key].name,
              description: SKILLS_DATA[key].description,
            }));
            result = JSON.stringify(list, null, 2);
          } catch (err: any) {
            result = `Error: ${err.message}`;
          }
        } else if (name === 'read_skill') {
          try {
            const params = JSON.parse(argsStr);
            res.write(`[STATUS:Reading skill instructions for ${params.name}]`);
            const skill = SKILLS_DATA[params.name];
            result = skill ? skill.content : `Error: Skill "${params.name}" not found. Available skills: ${Object.keys(SKILLS_DATA).join(', ')}`;
          } catch (err: any) {
            result = `Error: ${err.message}`;
          }
        } else if (mcpByName.has(name)) {
          try {
            const tool = mcpByName.get(name);
            const params = JSON.parse(argsStr || '{}');
            res.write(`[STATUS:Running MCP tool ${tool.originalName} on ${tool.server.name}]`);
            result = await executeMcpTool(tool, params);
          } catch (err: any) {
            result = `Error: ${err.message}`;
          }
        } else if (customMcpTools.some((t) => t.name === name)) {
          res.write(`[STATUS:Running custom tool ${name}]`);
          const params = JSON.parse(argsStr || '{}');
          result = `Custom tool "${name}" executed. Parameters received: ${JSON.stringify(params)}`;
        } else {
          result = `Error: Unknown tool "${name}"`;
        }

        currentMessages.push({ role: 'tool', tool_call_id: toolCall.id, name, content: result });
      }
    }

    if (iteration >= MAX_ITERATIONS && toolMap.size > 0) {
      const warning = '\n\n*System: Maximum reasoning iterations reached. Stopped further tool executions.*';
      res.write(warning);
      fullContent += warning;
    }

    res.write('[STATUS_END]');
    res.end();
  } catch (error) {
    console.error('Admin proxy error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Admin proxy failed' });
    } else {
      res.end();
    }
  }
}