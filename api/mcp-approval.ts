import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'node:crypto';
import { getAuthenticatedRequestUser } from './_lib/auth.js';
import { cleanupFlightControlRuns, enabledMcpServers, flightControlsAdmin, loadEnabledFlightControls } from './_lib/flightControls.js';
import { discoverMcpTools, executeMcpTool } from './_lib/mcpClient.js';

interface ContinuationState {
  args: Record<string, unknown>;
  toolCallId: string;
  modelToolName: string;
  currentMessages: Array<Record<string, unknown>>;
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  reasoningEffort?: string;
}

async function completeWithModel(state: ContinuationState, messages: Array<Record<string, unknown>>): Promise<string> {
  const provider = state.provider || 'pollinations';
  let url: string;
  let apiKey: string;
  let body: Record<string, unknown>;

  if (provider === 'groq') {
    url = 'https://api.groq.com/openai/v1/chat/completions';
    apiKey = process.env.GROQ_API_KEY || '';
    body = { model: state.model, messages, temperature: state.temperature, max_tokens: state.maxTokens, stream: false };
  } else if (provider === 'cerebras') {
    url = 'https://api.cerebras.ai/v1/chat/completions';
    apiKey = process.env.CEREBRAS_API_KEY || '';
    body = { model: state.model, messages, temperature: state.temperature, max_completion_tokens: state.maxTokens, stream: false };
  } else if (provider === 'secretstoai' || provider === 'secrectstoai') {
    url = 'https://api.freetheai.xyz/v1/chat/completions';
    apiKey = process.env.SECRETSTOAI_API_KEY || process.env.SECRETS_TO_AI_API_KEY || '';
    body = { model: state.model, messages, temperature: state.temperature, max_tokens: state.maxTokens, stream: false };
  } else if (provider === 'eaon') {
    url = 'https://api.eaon.dev/v1/chat/completions';
    apiKey = process.env.EAON_API_KEY || '';
    body = { model: state.model, messages, temperature: state.temperature, max_tokens: state.maxTokens, stream: false };
  } else if (provider === 'nvidia' || provider === 'nim') {
    url = 'https://integrate.api.nvidia.com/v1/chat/completions';
    apiKey = process.env.NVIDIA_API_KEY || process.env.NIM_API_KEY || '';
    body = { model: state.model, messages, temperature: state.temperature, max_tokens: state.maxTokens, stream: false };
  } else {
    url = 'https://gen.pollinations.ai/v1/chat/completions';
    apiKey = process.env.POLLINATIONS_API_KEY || '';
    body = { model: state.model, messages, temperature: state.temperature, max_tokens: state.maxTokens, stream: false };
  }

  if (state.reasoningEffort) body.reasoning_effort = state.reasoningEffort;
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Model continuation failed (${response.status})`);
  const result = await response.json();
  return result.choices?.[0]?.message?.content || 'The tool call finished, but PRO did not return a final message.';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await getAuthenticatedRequestUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in is required' });
  void cleanupFlightControlRuns();

  const { runId, decision } = req.body || {};
  if (typeof runId !== 'string' || !['approve', 'deny'].includes(decision)) {
    return res.status(400).json({ error: 'Invalid approval request' });
  }

  const { data: run, error: runError } = await flightControlsAdmin
    .from('mcp_tool_runs')
    .select('*')
    .eq('id', runId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (runError || !run) return res.status(404).json({ error: 'Approval request not found' });
  if (run.status !== 'pending') return res.status(409).json({ error: 'This approval was already resolved' });
  if (new Date(run.expires_at).getTime() <= Date.now()) {
    await flightControlsAdmin.from('mcp_tool_runs').update({ status: 'expired', continuation_state: null }).eq('id', run.id).eq('status', 'pending');
    return res.status(410).json({ error: 'Approval expired' });
  }

  const nextStatus = decision === 'approve' ? 'executing' : 'denied';
  const { data: claimed } = await flightControlsAdmin
    .from('mcp_tool_runs')
    .update({ status: nextStatus })
    .eq('id', run.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (!claimed) return res.status(409).json({ error: 'This approval was already resolved' });

  const state = run.continuation_state as unknown as ContinuationState;
  const startedAt = Date.now();
  try {
    if (!state?.args || !state.toolCallId || !state.modelToolName || !Array.isArray(state.currentMessages)) {
      throw new Error('Approval continuation state is invalid');
    }
    const hash = createHash('sha256').update(JSON.stringify(state.args)).digest('hex');
    if (hash !== run.argument_hash) throw new Error('Approval arguments failed integrity validation');

    let toolResult: string;
    if (decision === 'approve') {
      const controls = await loadEnabledFlightControls(user.id);
      const server = enabledMcpServers(controls).find(control => control.id === run.catalog_id);
      if (!server) throw new Error('This MCP server is no longer enabled');
      const tool = (await discoverMcpTools([server])).find(candidate => candidate.originalName === run.tool_name);
      if (!tool) throw new Error('This MCP tool is no longer available');
      toolResult = await executeMcpTool(tool, state.args);
    } else {
      toolResult = 'The user denied this MCP tool call. Do not claim that the action was completed.';
    }
    const messages = [
      ...state.currentMessages,
      { role: 'tool', tool_call_id: state.toolCallId, name: state.modelToolName, content: toolResult },
    ];
    const content = await completeWithModel(state, messages);

    await flightControlsAdmin.from('mcp_tool_runs').update({
      status: decision === 'approve' ? 'succeeded' : 'denied',
      continuation_state: null,
      duration_ms: Date.now() - startedAt,
    }).eq('id', run.id);
    return res.status(200).json({ content, status: decision === 'approve' ? 'succeeded' : 'denied' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'MCP approval failed';
    await flightControlsAdmin.from('mcp_tool_runs').update({
      status: 'failed',
      continuation_state: null,
      error_code: message.slice(0, 160),
      duration_ms: Date.now() - startedAt,
    }).eq('id', run.id);
    return res.status(502).json({ error: message, uncertainOutcome: decision === 'approve' });
  }
}
