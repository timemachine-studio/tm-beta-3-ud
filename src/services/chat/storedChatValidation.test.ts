import { describe, expect, it } from 'vitest';
import { parseChatImport, parseStoredMetadata, storedMetadataSchema } from './storedChatValidation';

const session = {
  id: 'fixture-session', name: 'Synthetic import', persona: 'default',
  createdAt: '2026-09-07T00:00:00Z', lastModified: '2026-09-07T00:00:00Z',
  messages: [{ id: 'fixture-message', content: 'Synthetic text', isAI: false }],
};

describe('history import boundary (local fixtures, no Supabase)', () => {
  it('preserves retry state, attachments, approvals and extension fields', () => {
    const message = {
      ...session.messages[0], status: 'error', errorCode: 'RETENTION_UNVERIFIED',
      partialContent: 'Partial fixture', imageDimensions: { width: 1, height: 2 },
      inputImageUrls: ['https://example.invalid/fixture.png'],
      retryContext: { persona: 'pro', pdfData: 'Fixture document' },
      musicVariations: [{ seed: 1, audioUrl: 'fixture.mp3', imageUrl: 'fixture.png' }],
      mcpApproval: { runId: 'fixture', serverName: 'fixture', toolName: 'fixture', argumentPreview: {}, expiresAt: '2026-09-07T01:00:00Z' },
      extensionField: 'preserved',
    };
    expect(parseChatImport({ sessions: [{ ...session, messages: [message] }] })[0].messages[0]).toEqual(message);
  });
  it('normalizes legacy numeric message IDs while retaining their timestamp', () => {
    const id = Date.parse('2026-09-06T10:00:00Z');
    const result = parseChatImport({ sessions: [{ ...session, messages: [{ ...session.messages[0], id }] }] });
    expect(result[0].messages[0]).toMatchObject({ id: String(id), createdAt: '2026-09-06T10:00:00.000Z' });
  });
  it('rejects malformed message content and invalid persona keys', () => {
    expect(parseChatImport({ sessions: [
      { ...session, messages: [{ ...session.messages[0], content: {} }] },
      { ...session, persona: '__proto__' },
      { ...session, messages: [{ ...session.messages[0], id: 1e100 }] },
      session,
    ] })).toEqual([session]);
  });
  it('rejects invalid archive containers before writes can begin', () => {
    for (const value of [null, {}, { sessions: 'invalid' }]) {
      expect(() => parseChatImport(value)).toThrow();
    }
  });
  it('keeps valid retry fields when unrelated optional metadata is malformed', () => {
    expect(parseStoredMetadata({ status: 'error', errorCode: 'TIMEOUT', imageDimensions: { width: 'bad' } })).toMatchObject({ status: 'error', errorCode: 'TIMEOUT', imageDimensions: undefined });
  });
  it('accepts legacy nullable database metadata and validates structured fields', () => {
    expect(storedMetadataSchema.safeParse({ status: null, errorCode: null }).success).toBe(true);
    expect(storedMetadataSchema.safeParse({ imageDimensions: { width: 'bad', height: 1 } }).success).toBe(false);
  });
});
