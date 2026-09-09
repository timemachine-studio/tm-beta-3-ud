import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from './_lib/vercelTypes.js';

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  getProJobByRunId: vi.fn(),
  getAuthenticatedRequestUser: vi.fn(),
}));

vi.mock('@trigger.dev/sdk', () => ({ runs: { retrieve: vi.fn() } }));
vi.mock('../trigger/streams.js', () => ({ proOutputStream: { read: mocks.read } }));
vi.mock('./_lib/proJobs.js', () => ({ getProJobByRunId: mocks.getProJobByRunId }));
vi.mock('./_lib/auth.js', () => ({ getAuthenticatedRequestUser: mocks.getAuthenticatedRequestUser }));
vi.mock('./_lib/retention/policy.js', () => ({ proContentExpired: () => false }));

import handler from './pro-stream.js';

function streamingResponse() {
  const headers = new Map<string, unknown>();
  const chunks: string[] = [];
  const res = {
    statusCode: 200,
    writableEnded: false,
    setHeader: vi.fn((name: string, value: unknown) => { headers.set(name.toLowerCase(), value); }),
    status: vi.fn((code: number) => { res.statusCode = code; return res; }),
    json: vi.fn((body: unknown) => { chunks.push(JSON.stringify(body)); res.writableEnded = true; return res; }),
    send: vi.fn(),
    write: vi.fn((chunk: string) => { chunks.push(chunk); return true; }),
    end: vi.fn(() => { res.writableEnded = true; return res; }),
  };
  return { res, headers, chunks };
}

describe('PRO stream HTTP contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProJobByRunId.mockResolvedValue({ run_id: 'run-1', user_id: null });
    mocks.getAuthenticatedRequestUser.mockResolvedValue(null);
  });

  it('streams NDJSON frames from the requested absolute index and closes once', async () => {
    mocks.read.mockResolvedValue((async function* () {
      yield 'alpha';
      yield 'beta';
    })());
    const req = Object.assign(new EventEmitter(), {
      method: 'GET',
      headers: {},
      query: { runId: 'run-1', start: '4' },
      cookies: {},
      body: undefined,
    }) as unknown as VercelRequest;
    const { res, headers, chunks } = streamingResponse();

    await handler(req, res as unknown as VercelResponse);

    expect(mocks.read).toHaveBeenCalledWith('run-1', expect.objectContaining({ startIndex: 4 }));
    expect(headers.get('content-type')).toBe('application/x-ndjson; charset=utf-8');
    expect(chunks).toEqual([
      '{"i":4,"d":"alpha"}\n',
      '{"i":5,"d":"beta"}\n',
    ]);
    expect(res.end).toHaveBeenCalledTimes(1);
  });
});
