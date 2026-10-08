import { task } from '@trigger.dev/sdk';
import { failOpenHandsLaunch, runOpenHandsLaunch } from '../api/_lib/work/runtimeHandoff.js';

export const workOpenHandsLaunch = task({
  id: 'tm-work-openhands-launch', maxDuration: 150, retry: { maxAttempts: 1 },
  queue: { concurrencyLimit: 5 },
  run: async ({ launchId }: { launchId: string }) => { await runOpenHandsLaunch(launchId); },
  onFailure: async ({ payload }) => {
    await failOpenHandsLaunch(payload.launchId).catch(() => console.warn('work_runtime_launch_recovery_required'));
  },
});
