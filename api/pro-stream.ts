import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runs } from '@trigger.dev/sdk';
import { proOutputStream } from '../trigger/streams.js';
import { getAuthenticatedRequestUser } from './_lib/auth.js';
import { getProJobByRunId } from './_lib/proJobs.js';

// ─── TimeMachine PRO: stream proxy ──────────────────────────────────────────
// Reads the durable Trigger.dev output stream server-side (no wall-clock
// limit there) and forwards chunks to the browser as NDJSON frames:
//   { "i": <absolute chunk index>, "d": "<raw chunk text>" }\n
//
// The function intentionally caps its own lifetime below Vercel's 300s Hobby
// limit. The client reconnects with ?start=<nextIndex> and continues exactly
// where it left off — the Trigger.dev stream keeps every chunk for 28 days,
// so nothing is ever lost, and a generation can run for as long as it needs.

const MAX_PROXY_MS = 240_000; // stay well under the 300s platform limit
const READ_TIMEOUT_SECONDS = 60; // how long one read() waits for new data
const TERMINAL_STATUSES = new Set([
  'COMPLETED',
  'CANCELED',
  'FAILED',
  'CRASHED',
  'SYSTEM_FAILURE',
  'EXPIRED',
  'TIMED_OUT',
]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const runId = typeof req.query.runId === 'string' ? req.query.runId : '';
  const start = Math.max(0, parseInt(String(req.query.start ?? '0'), 10) || 0);

  if (!runId) {
    return res.status(400).json({ error: 'runId is required' });
  }

  // Authorize: the job must exist and belong to the requester. Anonymous jobs
  // are keyed by the unguessable run id itself.
  const [user, job] = await Promise.all([
    getAuthenticatedRequestUser(req),
    getProJobByRunId(runId),
  ]);

  if (!job) {
    return res.status(404).json({ error: 'Unknown run id' });
  }

  if (job.user_id && job.user_id !== user?.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const abort = new AbortController();
  req.on('close', () => abort.abort());

  const startedAt = Date.now();
  let index = start;

  try {
    while (Date.now() - startedAt < MAX_PROXY_MS && !abort.signal.aborted) {
      try {
        const stream = await proOutputStream.read(runId, {
          startIndex: index,
          timeoutInSeconds: READ_TIMEOUT_SECONDS,
          signal: abort.signal,
        });

        let timeUp = false;
        for await (const chunk of stream) {
          if (abort.signal.aborted) break;
          res.write(JSON.stringify({ i: index, d: chunk }) + '\n');
          index++;
          if (Date.now() - startedAt >= MAX_PROXY_MS) {
            timeUp = true;
            break;
          }
        }

        // Either the stream ended (run finished) or we hit our time cap and
        // the client should reconnect from `index`. Both cases end here.
        void timeUp;
        return res.end();
      } catch (err: any) {
        if (abort.signal.aborted) {
          return res.end();
        }

        const isTimeout =
          err?.name === 'TimeoutError' || /timed?\s*out/i.test(String(err?.message ?? err));

        if (!isTimeout) {
          // Transient read failure: brief pause, then resume from last index.
          console.error('[pro-stream] Stream read error:', err);
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        // No new data for READ_TIMEOUT_SECONDS: if the run is over, close the
        // response so the client can do its terminal handling; otherwise keep
        // waiting for more chunks.
        try {
          const run = await runs.retrieve(runId);
          if (TERMINAL_STATUSES.has(run.status as string)) {
            return res.end();
          }
        } catch (statusError) {
          console.error('[pro-stream] Run status check failed:', statusError);
        }
      }
    }

    return res.end();
  } finally {
    if (!res.writableEnded) {
      res.end();
    }
  }
}
