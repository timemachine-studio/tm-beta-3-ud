import { z } from 'zod';
import type { AgentBase } from '@openhands/typescript-client';
import type { CreateConversationPayload } from '@openhands/typescript-client/clients';
import { authorizeWorkRuntimeGrant, runtimeModelAlias, verifyWorkRuntimeGrant } from './runtimeGrant.js';
import { WorkError } from './store.js';

export function workRuntimeGatewayBaseUrl() {
  try {
    const url = new URL(process.env.TM_WORK_MODEL_GATEWAY_BASE_URL ?? '');
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    const allowLocal = local && process.env.TM_WORK_ALLOW_LOOPBACK === 'true'
      && process.env.NODE_ENV !== 'production' && !process.env.VERCEL;
    if (url.username || url.password || url.search || url.hash
      || url.pathname.replace(/\/$/, '') !== '/api/work-model/v1'
      || (url.protocol !== 'https:' && !(url.protocol === 'http:' && allowLocal)) || (local && !allowLocal)) throw new Error();
    return url.href.replace(/\/$/, '');
  } catch { throw new WorkError('WORK_RUNTIME_LAUNCH_SETUP_REQUIRED'); }
}

/** Trusted provisioner contract, not an HTTP launch endpoint. A task must already
 * have an attested binding and an approved external handoff. This helper does
 * not create a container, mutate ownership, issue a grant, or start a run.
 * Never log or return its credential-bearing output to a browser. */
export async function prepareOpenHandsLaunch(taskId: string, userId: string, apiKey: string) {
  const baseUrl = workRuntimeGatewayBaseUrl();
  const claims = verifyWorkRuntimeGrant(apiKey);
  if (claims.taskId !== taskId || claims.userId !== userId) throw new WorkError('WORK_RUNTIME_UNAUTHORIZED', 403);
  const task = await authorizeWorkRuntimeGrant(claims);
  if (!task.plan || claims.expiresAt < Math.floor(Date.now() / 1000) + 180) {
    throw new WorkError('WORK_RUNTIME_LAUNCH_SETUP_REQUIRED');
  }
  // Setting this path is not isolation: an administrator must provision an
  // owner-dedicated container/VM without host mounts or a Docker socket first.
  const workspace = { kind: 'LocalWorkspace', working_dir: '/workspace/tm/' + task.id };
  const llm = {
    model: 'openai/' + runtimeModelAlias(task.persona), api_key: apiKey, base_url: baseUrl,
    api_mode: 'chat', auth_type: 'api_key', num_retries: 0, timeout: 125,
    max_input_tokens: 24000, max_output_tokens: task.persona === 'pro' ? 10000 : 7000,
    temperature: 0.3, stream: false, native_tool_calling: true, disable_vision: true,
    log_completions: false, caching_prompt: false,
  } satisfies AgentBase['llm'];
  const tools = [{ name: 'TerminalTool' }, { name: 'FileEditorTool' }, { name: 'TaskTrackerTool' }];
  const agent = { kind: 'Agent', llm, tools, tool_concurrency_limit: 1,
    include_default_tools: ['FinishTool', 'ThinkTool'],
  } satisfies AgentBase;
  return {
    conversation_id: claims.conversationId, agent, workspace,
    initial_message: null, autotitle: false, worktree: false,
    max_iterations: 24, stuck_detection: true,
    confirmation_policy: { kind: 'AlwaysConfirm' },
    tags: { tm_task_id: task.id, tm_generation: String(task.generation) },
    // Fixed imports only; never accept arbitrary module names or shell hooks.
    tool_module_qualnames: {
      TerminalTool: 'openhands.tools.terminal.definition', FileEditorTool: 'openhands.tools.file_editor.definition',
      TaskTrackerTool: 'openhands.tools.task_tracker.definition',
    },
  } satisfies CreateConversationPayload;
}

/** Check creation before a future provisioner may send any initial message.
 * Deliberately return no raw ConversationInfo (it can contain secrets). */
export function verifyOpenHandsLaunchResponse(value: unknown, conversationId: string, taskId: string,
  expectedModel?: { model: string; baseUrl: string }): void {
  const parsed = z.object({
    id: z.uuid(), execution_status: z.literal('idle'),
    confirmation_policy: z.object({ kind: z.literal('AlwaysConfirm') }),
    workspace: z.object({ kind: z.literal('LocalWorkspace'), working_dir: z.string().max(200) }),
  }).safeParse(value);
  if (!parsed.success || parsed.data.id !== conversationId
    || parsed.data.workspace.working_dir !== '/workspace/tm/' + z.uuid().parse(taskId)) {
    throw new WorkError('WORK_RUNTIME_LAUNCH_INVALID_RESPONSE', 502);
  }
  if (expectedModel) {
    const model = z.object({ agent: z.object({ llm: z.object({ model: z.string(), base_url: z.string(), api_mode: z.literal('chat') }) }) }).safeParse(value);
    if (!model.success || model.data.agent.llm.model !== expectedModel.model || model.data.agent.llm.base_url !== expectedModel.baseUrl) {
      throw new WorkError('WORK_RUNTIME_LAUNCH_INVALID_RESPONSE', 502);
    }
  }
}
