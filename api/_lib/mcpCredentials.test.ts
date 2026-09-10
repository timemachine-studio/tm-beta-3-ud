import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import {
  McpCredentialError,
  credentialsAvailable,
  decryptCredential,
  encryptCredential,
  sameCredential,
} from './mcpCredentials.js';

const KEY = randomBytes(32).toString('base64');
let previous: string | undefined;

beforeEach(() => { previous = process.env.MCP_CREDENTIAL_KEY; process.env.MCP_CREDENTIAL_KEY = KEY; });
afterEach(() => {
  if (previous === undefined) delete process.env.MCP_CREDENTIAL_KEY;
  else process.env.MCP_CREDENTIAL_KEY = previous;
});

describe('MCP credential encryption', () => {
  it('round-trips a token', () => {
    const token = 'sk-live-abc123-not-a-real-token';
    expect(decryptCredential(encryptCredential(token))).toBe(token);
  });

  it('never produces the same ciphertext twice', () => {
    // A fresh IV per encryption, so identical tokens are not linkable in a
    // database dump.
    const a = encryptCredential('same-token');
    const b = encryptCredential('same-token');
    expect(a).not.toBe(b);
    expect(decryptCredential(a)).toBe(decryptCredential(b));
  });

  it('does not leak the token into its own ciphertext', () => {
    expect(encryptCredential('hunter2-secret')).not.toContain('hunter2');
  });

  it('refuses a tampered row rather than returning a different token', () => {
    // The point of GCM over CBC: authentication, not just confidentiality.
    const stored = encryptCredential('original');
    const parts = stored.split('.');
    const bytes = Buffer.from(parts[3], 'base64url');
    bytes[0] ^= 0xff;
    parts[3] = bytes.toString('base64url');
    expect(() => decryptCredential(parts.join('.'))).toThrow(McpCredentialError);
  });

  it('refuses a row encrypted under a different key', () => {
    const stored = encryptCredential('original');
    process.env.MCP_CREDENTIAL_KEY = randomBytes(32).toString('base64');
    expect(() => decryptCredential(stored)).toThrow(McpCredentialError);
  });

  it('refuses malformed and unversioned envelopes', () => {
    for (const bad of ['', 'nonsense', 'v1.a.b', 'v2.a.b.c', `v1.${'A'.repeat(4)}.x.y`]) {
      expect(() => decryptCredential(bad)).toThrow(McpCredentialError);
    }
  });

  it('fails closed with no key, rather than storing plaintext', () => {
    delete process.env.MCP_CREDENTIAL_KEY;
    expect(credentialsAvailable()).toBe(false);
    expect(() => encryptCredential('token')).toThrow(/MCP_CREDENTIAL_KEY is not set/);
  });

  it('rejects a key of the wrong length instead of failing obscurely later', () => {
    process.env.MCP_CREDENTIAL_KEY = Buffer.from('too-short').toString('base64');
    expect(credentialsAvailable()).toBe(false);
    expect(() => encryptCredential('token')).toThrow(/32 bytes/);
  });

  it('accepts a hex key as well as base64', () => {
    process.env.MCP_CREDENTIAL_KEY = randomBytes(32).toString('hex');
    expect(credentialsAvailable()).toBe(true);
    expect(decryptCredential(encryptCredential('token'))).toBe('token');
  });

  it('refuses to store an empty credential', () => {
    expect(() => encryptCredential('')).toThrow(/empty/);
  });

  it('compares two stored credentials without exposing either', () => {
    const a = encryptCredential('same');
    const b = encryptCredential('same');
    expect(sameCredential(a, b)).toBe(true);
    expect(sameCredential(a, encryptCredential('different'))).toBe(false);
    expect(sameCredential(a, 'garbage')).toBe(false);
  });
});
