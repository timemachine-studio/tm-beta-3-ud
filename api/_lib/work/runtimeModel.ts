import { randomUUID } from 'node:crypto';
import { dispatchStreamingProvider } from '../../ai-proxy.js';
import { AIR_ROUTE, PRO_ROUTE } from '../personaRoutes.js';
import { runWithProviderFallback } from '../providerResilience.js';
import { checkRateLimit, incrementRateLimit } from '../rateLimit.js';
import { workDatabase, WorkError } from './store.js';
import { authorizeWorkRuntimeGrant, type WorkRuntimeGrant } from './runtimeGrant.js';
import { exportWorkModelCall } from './integrations.js';
import { readWorkRuntimeCompletion, runtimePrompt, type WorkRuntimeCompletion, type WorkRuntimeRequest } from './runtimeProtocol.js';

type Attempt = { completion?: WorkRuntimeCompletion; terminal?: unknown };
/** Same TM routes and quota buckets; never accept a caller-selected provider. */
export async function workRuntimeModel(claims: WorkRuntimeGrant, leaseId: string, request: WorkRuntimeRequest, signal: AbortSignal): Promise<WorkRuntimeCompletion> {
  const task = await authorizeWorkRuntimeGrant(claims, leaseId);
  const prompt = runtimePrompt(task, request);
  const { error: configError } = await workDatabase().from('work_config_versions').upsert({ version: prompt.version, prompt: prompt.snapshot }, { onConflict: 'version', ignoreDuplicates: true });
  if (configError) throw new WorkError('WORK_TRACE_WRITE_FAILED', 503);
  const route = task.persona === 'pro' ? PRO_ROUTE : AIR_ROUTE;
  const chain = [{ ...route }, ...route.fallbacks];
  const quota = await checkRateLimit(task.user_id, 'work', task.persona, { providers: [...new Set(chain.map(hop => hop.provider))] });
  if (!quota.allowed) throw new WorkError('WORK_QUOTA_REACHED', 429);
  const available = chain.filter(hop => quota.providers.includes(hop.provider));
  if (!available.length) throw new WorkError('WORK_MODELS_UNAVAILABLE', 503);
  const { value } = await runWithProviderFallback<Attempt>(available, async hop => {
    if (signal.aborted) return { terminal: new WorkError('WORK_MODEL_CANCELLED', 409) };
    try { await authorizeWorkRuntimeGrant(claims, leaseId); } catch (terminal) { return { terminal }; }
    let currentQuota: Awaited<ReturnType<typeof checkRateLimit>>;
    try { currentQuota = await checkRateLimit(task.user_id, 'work', task.persona, { providers: [hop.provider] }); }
    catch { return { terminal: new WorkError('WORK_QUOTA_UNAVAILABLE', 503) }; }
    if (!currentQuota.allowed || !currentQuota.providers.includes(hop.provider)) return { terminal: new WorkError('WORK_QUOTA_REACHED', 429) };
    try { await authorizeWorkRuntimeGrant(claims, leaseId); } catch (terminal) { return { terminal }; }
    if (signal.aborted) return { terminal: new WorkError('WORK_MODEL_CANCELLED', 409) };
    const started = Date.now();
    let opened = false, outcome: 'failed' | 'invalid_output' | 'completed' = 'failed';
    let completion: WorkRuntimeCompletion | undefined, failure: unknown, terminal: unknown;
    try {
      const stream = await dispatchStreamingProvider(hop.provider, prompt.messages, prompt.tools, { model: hop.model,
        temperature: request.temperature ?? 0.3,
        maxTokens: Math.min(task.persona === 'pro' ? 10000 : 7000, request.max_tokens ?? 12000, request.max_completion_tokens ?? 12000),
      });
      opened = true; outcome = 'invalid_output';
      completion = await readWorkRuntimeCompletion(stream, prompt.tools, signal);
      if (request.parallel_tool_calls === false && completion.toolCalls.length > 1) throw new WorkError('WORK_MODEL_INVALID_COMPLETION', 502);
      try { await authorizeWorkRuntimeGrant(claims, leaseId); } catch (cause) { terminal = cause; throw cause; }
      outcome = 'completed';
    } catch (cause) { failure = cause; }
    // Existing TM counters, not a fabricated token/cost estimate. Count opened
    // completions including partial/invalid output. A pre-open failure is not charged.
    if (opened) await incrementRateLimit(task.user_id, 'work', task.persona, { provider: hop.provider });
    const id = randomUUID(), latencyMs = Date.now() - started;
    // A successful paid attempt is NEVER rerun because an audit write failed.
    try {
      const { error } = await workDatabase().from('work_model_calls').insert({ id, task_id: task.id, phase: 'runtime_completion',
        provider: hop.provider, model: hop.model, outcome, config_version: prompt.version, latency_ms: latencyMs,
        input_tokens: null, output_tokens: null, estimated_cost: null });
      if (error) return { terminal: new WorkError('WORK_TRACE_WRITE_FAILED', 503) };
    } catch { return { terminal: new WorkError('WORK_TRACE_WRITE_FAILED', 503) }; }
    await exportWorkModelCall(task.id, task.user_id, id, { phase: 'runtime_completion', provider: hop.provider, model: hop.model,
      outcome, configVersion: prompt.version, latencyMs, inputTokens: null, outputTokens: null, estimatedCost: null });
    if (signal.aborted || terminal) return { terminal: terminal ?? new WorkError('WORK_MODEL_CANCELLED', 409) };
    if (failure) throw failure;
    return { completion };
  }, () => { console.warn('work_gateway_provider_attempt_failed'); });
  if (value.terminal) throw value.terminal;
  if (!value.completion) throw new WorkError('WORK_MODEL_INVALID_COMPLETION', 502);
  return value.completion;
}
