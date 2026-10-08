import { schedules } from '@trigger.dev/sdk';
import { z } from 'zod';
import { workDatabase, WorkError } from '../api/_lib/work/store.js';
import { deliverOpenHandsStop } from '../api/_lib/work/runtimeStop.js';
import { recoverAbandonedOpenHandsLaunches } from '../api/_lib/work/runtimeHandoff.js';

const pendingStop = z.object({ task_id: z.uuid(), user_id: z.uuid(), generation: z.number().int().nonnegative() });

/** Trusted worker only. Owner/target are read from service-owned outbox rows,
 * never payload input. Counts are safe for operational telemetry. */
export async function recoverWorkRuntimeStops() {
  if (process.env.TM_WORK_UPSTREAM_ENABLED !== 'true' || process.env.TM_WORK_RUNTIME_STOP_RECOVERY_ENABLED !== 'true') {
    return { enabled: false, checked: 0, acknowledged: 0, pending: 0 };
  }
  const now = new Date().toISOString();
  const { data, error } = await workDatabase().from('work_runtime_stops')
    .select('task_id,user_id,generation').eq('status', 'pending').lte('next_attempt_at', now)
    .or('lease_id.is.null,lease_expires_at.lte.' + now).order('next_attempt_at').limit(5);
  if (error) throw new WorkError('WORK_RUNTIME_STOP_SETUP_REQUIRED');
  // One corrupt/stale target cannot prevent delivery to other owners. Leases in
  // the RPC serialize concurrent schedules and owner-triggered Stop retries.
  const results = await Promise.all((data ?? []).map(async row => {
    const parsed = pendingStop.safeParse(row);
    if (!parsed.success) return false;
    try { return await deliverOpenHandsStop(parsed.data.task_id, parsed.data.user_id, parsed.data.generation); }
    catch { return false; }
  }));
  const acknowledged = results.filter(Boolean).length;
  return { enabled: true, checked: results.length, acknowledged, pending: results.length - acknowledged };
}

export async function recoverWorkRuntimeLifecycle() {
  // Old monitoring-only deployments may not have handoff tables yet. A setup
  // failure there must not prevent existing stop-outbox delivery.
  const launches = await recoverAbandonedOpenHandsLaunches().catch(() => {
    console.warn('work_runtime_launch_recovery_required'); return null;
  });
  const stops = await recoverWorkRuntimeStops();
  return { launches, stops };
}

// No declarative cron: loading/deploying this file does not create a recurring
// service. Attach a schedule explicitly in staging after canary verification.
export const workRuntimeRecovery = schedules.task({
  id: 'tm-work-runtime-stop-recovery', maxDuration: 180, ttl: '5m',
  queue: { concurrencyLimit: 1 },
  run: recoverWorkRuntimeLifecycle,
});
