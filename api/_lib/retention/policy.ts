// TM-02: these are application limits, not claims about processor deletion.
export const RETENTION = Object.freeze({
  version: '1.0.0',
  recoveryMs: 60 * 60 * 1000,
  maxRunAgeMs: 24 * 60 * 60 * 1000,
  abandonedRunMs: 2 * 60 * 60 * 1000,
  metadataMs: 30 * 24 * 60 * 60 * 1000,
});

// No environment toggle can substitute for verifying Trigger payload/output,
// stream/checkpoint deletion and deployed cleanup. Reopen only with evidence
// recorded in docs/agent/data-lifecycle.md (TM-02/TM-16).
export function durableProcessingAvailable(): boolean { return false; }
export const RETENTION_UNAVAILABLE = {
  code: 'RETENTION_UNVERIFIED',
  message: 'Background PRO generation is unavailable while data retention is being verified. You can use Air.',
} as const;

export function proContentExpired(job: { created_at: string; updated_at: string; status: string; final_content?: string | null; error?: string | null }, now = Date.now()): boolean {
  // Database UPDATE triggers advance updated_at during scrubbing. A scrubbed
  // receipt must never reopen access to the processor's older output stream.
  if ((job.status === 'completed' && job.final_content === null) ||
      (job.status === 'failed' && job.error === null) || job.error === 'PROCESSING_EXPIRED') return true;
  const created = Date.parse(job.created_at);
  const updated = Date.parse(job.updated_at);
  if (!Number.isFinite(created) || !Number.isFinite(updated) || created > now || updated > now) return true;
  return now >= created + RETENTION.maxRunAgeMs ||
    (job.status === 'running' ? now >= created + RETENTION.abandonedRunMs : now >= updated + RETENTION.recoveryMs);
}
