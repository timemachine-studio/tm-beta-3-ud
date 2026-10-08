import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { dispatchStreamingProvider } from '../../ai-proxy.js';
import { AIR_ROUTE, PRO_ROUTE } from '../personaRoutes.js';
import { runWithProviderFallback } from '../providerResilience.js';
import { checkRateLimit, incrementRateLimit } from '../rateLimit.js';
import type { ProviderMessage } from '../providerTypes.js';
import type { WorkTask } from '../../../shared/work.js';
import { WORK_CONFIG_VERSION } from './prompt.js';
import { readWorkTask, requireWorkEntitlement, WorkError, workDatabase } from './store.js';
import { readWorkContent } from './stream.js';
import { exportWorkModelCall } from './integrations.js';

export function parseWorkJson<T>(content: string, schema: z.ZodType<T>): T {
  const text = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return schema.parse(JSON.parse(text));
}
/** TM's existing provider adapters, routes, ceilings and fallbacks are authority. */
export async function workModel<T>(task: WorkTask, phase: string, messages: ProviderMessage[], schema: z.ZodType<T>): Promise<T> {
  await requireWorkEntitlement(task.user_id);
  const route = task.persona === 'pro' ? PRO_ROUTE : AIR_ROUTE;
  const chain = [{ ...route }, ...route.fallbacks];
  const quota = await checkRateLimit(task.user_id, 'work', task.persona, { providers: [...new Set(chain.map(hop => hop.provider))] });
  if (!quota.allowed) throw new WorkError('WORK_QUOTA_REACHED', 429);
  const available = chain.filter(hop => quota.providers.includes(hop.provider));
  if (!available.length) throw new WorkError('WORK_MODELS_UNAVAILABLE');
  const { value } = await runWithProviderFallback(available, async hop => {
    await requireWorkEntitlement(task.user_id);
    const current = await readWorkTask(task.id, task.user_id);
    if (!['planning', 'running'].includes(current.status) || current.worker_id !== task.worker_id || current.generation !== task.generation) throw new WorkError('WORK_STATE_CHANGED', 409);
    const currentQuota = await checkRateLimit(task.user_id, 'work', task.persona, { providers: [hop.provider] });
    if (!currentQuota.allowed || !currentQuota.providers.includes(hop.provider)) throw new WorkError('WORK_QUOTA_REACHED', 429);
    const started = Date.now();
    let consumed = false, outcome: 'failed' | 'invalid_output' | 'completed' = 'failed', result: T | undefined, failure: unknown;
    try {
      const stream = await dispatchStreamingProvider(hop.provider, messages, [], { model: hop.model, temperature: 0.3, maxTokens: task.persona === 'pro' ? 10000 : 7000 });
      consumed = true;
      const output = await readWorkContent(stream);
      outcome = 'invalid_output';
      result = parseWorkJson(output, schema);
      outcome = 'completed';
    } catch (cause) { failure = cause; }
    // Each opened completion attempt consumes quota, including invalid output
    // and partial streams. Usage/cost remain unknown, not fabricated zero.
    if (consumed) await incrementRateLimit(task.user_id, 'work', task.persona, { provider: hop.provider });
    const id = randomUUID();
    const latencyMs = Date.now() - started;
    const { error } = await workDatabase().from('work_model_calls').insert({ id, task_id: task.id, phase, provider: hop.provider, model: hop.model, outcome, config_version: WORK_CONFIG_VERSION, latency_ms: latencyMs, input_tokens: null, output_tokens: null, estimated_cost: null });
    if (error) throw new WorkError('WORK_TRACE_WRITE_FAILED');
    await exportWorkModelCall(task.id, task.user_id, id, { phase, provider: hop.provider, model: hop.model,
      outcome, configVersion: WORK_CONFIG_VERSION,
      latencyMs, inputTokens: null, outputTokens: null, estimatedCost: null });
    if (failure) throw failure;
    return result as T;
  }, () => { console.warn('work_provider_attempt_failed'); });
  return value;
}
