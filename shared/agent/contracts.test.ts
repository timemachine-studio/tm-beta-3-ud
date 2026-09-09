import { describe, expect, it } from 'vitest';
import { inputSchemaSpecSchema } from './schemaSpec';
import { parseAgentEventFrame as clientParse } from '../../src/services/agent/contracts';
import { parseAgentEventFrame as serverParse } from '../../api/_lib/agent/contracts';
import { agentEventSchema, ContractFrameError } from './events';
import { canonicalArguments, hashArguments, jsonValueSchema, MAX_JSON_BYTES, timestampSchema } from './primitives';
import { modelMessageSchema, sourceRefSchema, toolCallSchema, toolResultSchema } from './contracts';
import { chatsListInputSchema, chatsReadInputSchema, chatsListOutputSchema, type TrustedExecutionContext } from './interfaces';
import { appDescriptorSchema } from '../apps/contracts';
import { packageManifestSchema } from './packages';

const envelope = { schemaVersion: 1, runId: 'run-1', sequence: 0, timestamp: '2026-09-06T10:00:00Z' };
const frame = { ...envelope, type: 'run.completed', payload: { status: 'completed', artifacts: [] } };
const usage = { inputTokens: 0, outputTokens: 0, toolCalls: 0, costMicrousd: 0, estimated: false };
const common = { invocationId: 'call-1', artifacts: [], sources: [], usage };
const pending = { kind: 'device', invocationId: 'call-1', runId: 'run-1', actorId: 'actor-1', workspaceId: 'workspace-1', toolId: 'notes.create', toolVersion: '1.0.0', argumentDigest: `sha256:${'0'.repeat(64)}`, grantVersion: 1, nonce: 'nonce-1', expiresAt: '2026-09-06T11:00:00Z' };
const error = { code: 'timeout', message: 'Operation timed out', retryable: false };

describe('shared v1 event boundary', () => {
  it('uses exactly the same runtime validator in client and server', () => {
    expect(clientParse).toBe(serverParse);
    expect(clientParse(JSON.stringify(frame))).toEqual(frame);
  });
  it.each(['{', 'null', '[]', JSON.stringify({ ...frame, payload: {} }), JSON.stringify({ ...frame, extra: true }), JSON.stringify({ ...frame, payload: { ...frame.payload, hiddenReasoning: 'private' } }), JSON.stringify({ ...frame, sequence: -1 }), JSON.stringify({ ...frame, timestamp: 'yesterday' })])('rejects malformed or invalid frames: %s', value => {
    expect(() => clientParse(value)).toThrow(ContractFrameError);
  });
  it.each([0, 2, '1'])('explicitly rejects unsupported version %s', schemaVersion => {
    expect(() => clientParse(JSON.stringify({ ...frame, schemaVersion }))).toThrow('unsupported_version');
  });
  it('bounds UTF-8 frame bytes, including multibyte text', () => {
    expect(() => clientParse(' '.repeat(MAX_JSON_BYTES + 1))).toThrow('payload_too_large');
    expect(() => clientParse(JSON.stringify({ ...envelope, type: 'assistant.completed', payload: { messageId: 'm', content: '漢'.repeat(23000) } }))).toThrow('payload_too_large');
  });
  it('rejects mismatched terminal status and pending completion', () => {
    expect(agentEventSchema.safeParse({ ...frame, payload: { status: 'failed', artifacts: [] } }).success).toBe(false);
    expect(agentEventSchema.safeParse({ ...envelope, type: 'tool.completed', payload: { result: { ...common, status: 'pending', pending } } }).success).toBe(false);
  });
  it('validates pending binding and event correlation', () => {
    const event = { ...envelope, type: 'device.requested', payload: { pending, call: { invocationId: 'call-1', toolId: 'notes.create', toolVersion: '1.0.0', arguments: {} } } };
    expect(clientParse(JSON.stringify(event))).toEqual(event);
    expect(() => clientParse(JSON.stringify({ ...event, runId: 'another' }))).toThrow('invalid_event');
    expect(() => clientParse(JSON.stringify({ ...event, payload: { ...event.payload, call: { ...event.payload.call, invocationId: 'another' } } }))).toThrow('invalid_event');
    expect(toolResultSchema.safeParse({ ...common, status: 'pending', pending: { ...pending, nonce: undefined } }).success).toBe(false);
  });
});

describe('canonical arguments and untrusted data', () => {
  it('has a reproducible SHA-256 known vector', async () => {
    expect(await hashArguments({})).toBe('sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a');
    expect(await hashArguments({ b: [1, { z: true, a: 'বাংলা' }], a: -0 })).toBe(await hashArguments({ a: 0, b: [1, { a: 'বাংলা', z: true }] }));
    expect(await hashArguments({ a: [1, 2] })).not.toBe(await hashArguments({ a: [2, 1] }));
    expect(canonicalArguments({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  });
  it.each([undefined, NaN, Infinity, new Date(), { a: undefined }, { a: BigInt(1) }, { a: () => 1 }, Array(2), JSON.parse('{"__proto__":{}}')])('rejects non-JSON or unsafe values %#', value => {
    expect(jsonValueSchema.safeParse(value).success).toBe(false);
  });
  it('rejects cycles, deep nesting, excessive data and getters without invoking them', () => {
    const cyclic: { self?: unknown } = {}; cyclic.self = cyclic;
    expect(jsonValueSchema.safeParse(cyclic).success).toBe(false);
    expect(jsonValueSchema.safeParse({ [Symbol('hidden')]: 1 }).success).toBe(false);
    expect(jsonValueSchema.safeParse(Object.defineProperty({}, 'hidden', { value: 1 })).success).toBe(false);
    let nested: unknown = null;
    for (let i = 0; i < 22; i++) nested = { nested };
    expect(jsonValueSchema.safeParse(nested).success).toBe(false);
    expect(jsonValueSchema.safeParse('x'.repeat(MAX_JSON_BYTES)).success).toBe(false);
    expect(jsonValueSchema.safeParse({ get secret() { throw new Error('must not execute'); } }).success).toBe(false);
  });
  it('never treats model arguments as trusted execution context', () => {
    const call = toolCallSchema.parse({ invocationId: 'c', toolId: 'notes.create', toolVersion: '1.0.0', arguments: { userId: 'forged', grants: ['admin'] } });
    // @ts-expect-error A parsed model call cannot mint the broker's opaque context.
    const context: TrustedExecutionContext = call;
    expect(context).toBe(call);
    expect(toolCallSchema.safeParse({ ...call, actorId: 'forged' }).success).toBe(false);
  });
});

describe('Zod 4 validation semantics', () => {
  it('accepts UTC and explicit offsets while rejecting local or invalid datetimes', () => {
    expect(timestampSchema.safeParse('2026-09-09T12:00:00Z').success).toBe(true);
    expect(timestampSchema.safeParse('2026-09-09T18:00:00+06:00').success).toBe(true);
    expect(timestampSchema.safeParse('2026-09-09T12:00:00').success).toBe(false);
    expect(timestampSchema.safeParse('2026-13-40T12:00:00Z').success).toBe(false);
  });

  it('keeps web sources limited to valid HTTP(S) URLs', () => {
    const source = { type: 'web', title: 'Fixture', retrievedAt: '2026-09-09T12:00:00Z' };
    expect(sourceRefSchema.safeParse({ ...source, url: 'https://example.test/path' }).success).toBe(true);
    expect(sourceRefSchema.safeParse({ ...source, url: 'ftp://example.test/file' }).success).toBe(false);
    expect(sourceRefSchema.safeParse({ ...source, url: 'not a URL' }).success).toBe(false);
  });
});

describe('results, repositories and descriptors', () => {
  it.each([
    { ...common, status: 'success', data: { saved: true } },
    { ...common, status: 'pending', pending },
    { ...common, status: 'error', error },
    { ...common, status: 'denied', error: { ...error, code: 'unauthorized' } },
    { ...common, status: 'unknown_outcome', error, reconciliationId: 'receipt-1' },
  ])('round-trips a typed $status result', result => {
    expect(toolResultSchema.parse(JSON.parse(JSON.stringify(result)))).toEqual(result);
  });
  it('requires reconciliation for unknown outcome and forbids success data on pending', () => {
    expect(toolResultSchema.safeParse({ ...common, status: 'unknown_outcome', error }).success).toBe(false);
    expect(toolResultSchema.safeParse({ ...common, status: 'pending', pending, data: 'saved' }).success).toBe(false);
  });
  it('bounds history queries and keeps list results metadata-only', () => {
    expect(chatsListInputSchema.safeParse({ limit: 10, dateField: 'createdAt', from: '2026-09-07T00:00:00Z', to: '2026-09-06T00:00:00Z' }).success).toBe(false);
    expect(chatsListInputSchema.safeParse({ limit: 101, dateField: 'createdAt' }).success).toBe(false);
    expect(chatsReadInputSchema.safeParse({ chatId: 'c', limit: 10, beforeMessageId: 'a', afterMessageId: 'b' }).success).toBe(false);
    expect(chatsListOutputSchema.safeParse({ items: [], nextCursor: null, messages: ['private'] }).success).toBe(false);
  });
  it('rejects hidden model-message fields and arbitrary privileged URLs', () => {
    expect(modelMessageSchema.safeParse({ role: 'assistant', content: '', toolCalls: [], thinking: 'secret' }).success).toBe(false);
    expect(appDescriptorSchema.safeParse({ schemaVersion: 1, id: 'notes', version: '1.0.0', name: 'Notes', tools: [], resourceSchemas: [], grants: [], cards: ['note'], deepLinkResolvers: ['javascript:alert(1)'] }).success).toBe(false);
  });
  it('validates immutable package metadata without treating claims as authority', () => {
    const manifest = { schemaVersion: 1, id: 'package', version: '1.0.0', contentHash: `sha256:${'a'.repeat(64)}`, ownerId: 'owner', author: 'TM', visibility: 'private', sourceKind: 'template', description: 'Fixture', tools: [], entryPoint: 'src/main.ts', requiredGrants: [], networkDestinations: [], resourceEffects: [], runtimeLimits: { timeoutMs: 1000, memoryMb: 128, maxCostMicrousd: 0 }, dependencies: [], lockfile: 'lock.json', testFixtures: ['tests/fixture.json'], testReport: { status: 'pending' }, license: 'MIT', provenance: 'Synthetic test fixture' };
    expect(packageManifestSchema.parse(manifest)).toEqual(manifest);
    expect(packageManifestSchema.safeParse({ ...manifest, entryPoint: '../escape.ts' }).success).toBe(false);
    expect(packageManifestSchema.safeParse({ ...manifest, credentials: 'secret' }).success).toBe(false);
    expect(packageManifestSchema.safeParse({ ...manifest, version: 'latest' }).success).toBe(false);
  });
});

 it('validates the supported schema subset before a tool can advertise it', () => {
   expect(inputSchemaSpecSchema.safeParse({ type: 'object', properties: { title: { type: 'string', maxLength: 256 } }, required: ['title'], additionalProperties: false }).success).toBe(true);
   for (const schema of [{}, { type: 'object' }, { type: 'object', properties: {}, required: ['missing'], additionalProperties: false }, { type: 'object', properties: {}, additionalProperties: false, $ref: 'https://untrusted.test/schema' }]) {
     expect(inputSchemaSpecSchema.safeParse(schema).success).toBe(false);
   }
 });
