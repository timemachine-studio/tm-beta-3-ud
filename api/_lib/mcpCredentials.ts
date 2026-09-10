/**
 * Encrypting the tokens users give us for their own MCP servers.
 *
 * Until now the only auth mode was `bearer_env`: an operator sets an
 * environment variable and the catalog row names it. That cannot express "this
 * user's token", which is what a user-added server needs — and the moment we
 * accept one, we are storing someone else's credential to a third-party
 * service. So it is encrypted at rest, decrypted only to build one outbound
 * Authorization header, and never sent to a browser or written to a log.
 *
 * AES-256-GCM, because it authenticates as well as encrypts: a row someone
 * tampered with fails to decrypt rather than producing a different token. The
 * key lives in `MCP_CREDENTIAL_KEY` and never in the database, so a database
 * dump on its own does not yield credentials.
 *
 * **This fails closed.** With no key configured, a user-supplied credential
 * cannot be stored and the attempt is refused. Storing it in plaintext because
 * the deployment forgot a variable is not an option.
 */

import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** Version prefix, so the format can change without guessing at old rows. */
const FORMAT = 'v1';

export class McpCredentialError extends Error {}

/**
 * The encryption key, or null when the deployment has none.
 *
 * Accepts base64 or hex. Length is checked rather than assumed: a 31-byte key
 * would throw deep inside createCipheriv with an opaque message.
 */
export function credentialKey(): Buffer | null {
  const raw = (process.env.MCP_CREDENTIAL_KEY || '').trim();
  if (!raw) return null;

  const decoded = /^[0-9a-f]{64}$/i.test(raw)
    ? Buffer.from(raw, 'hex')
    : Buffer.from(raw, 'base64');

  if (decoded.length !== KEY_BYTES) {
    throw new McpCredentialError(
      `MCP_CREDENTIAL_KEY must decode to ${KEY_BYTES} bytes; got ${decoded.length}. Generate one with: openssl rand -base64 32`,
    );
  }
  return decoded;
}

export function credentialsAvailable(): boolean {
  try {
    return credentialKey() !== null;
  } catch {
    // A misconfigured key is not the same as no key, but for the purpose of
    // "can we accept a credential right now" both answers are no.
    return false;
  }
}

/** Encrypt a token for storage. Returns `v1.<iv>.<tag>.<ciphertext>`, base64url parts. */
export function encryptCredential(plaintext: string): string {
  const key = credentialKey();
  if (!key) {
    throw new McpCredentialError(
      'This deployment cannot store credentials: MCP_CREDENTIAL_KEY is not set. Servers that need a token cannot be added until it is.',
    );
  }
  if (!plaintext) throw new McpCredentialError('Refusing to store an empty credential');

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [FORMAT, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
}

/** Decrypt a stored token. Throws if the key is wrong or the row was tampered with. */
export function decryptCredential(stored: string): string {
  const key = credentialKey();
  if (!key) throw new McpCredentialError('MCP_CREDENTIAL_KEY is not set, so stored credentials cannot be read');

  const parts = (stored || '').split('.');
  if (parts.length !== 4 || parts[0] !== FORMAT) {
    throw new McpCredentialError('Stored credential is not in the expected format');
  }

  const iv = Buffer.from(parts[1], 'base64url');
  const tag = Buffer.from(parts[2], 'base64url');
  const ciphertext = Buffer.from(parts[3], 'base64url');
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new McpCredentialError('Stored credential has an invalid envelope');
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    // Deliberately vague: which of "wrong key" or "tampered" it was is not
    // something to report back, and the distinction is not actionable anyway.
    throw new McpCredentialError('Stored credential could not be decrypted');
  }
}

/**
 * Whether two stored credentials hold the same secret.
 *
 * Used to tell "the user re-submitted the same token" from "the user changed
 * it", without either value reaching a log. Constant-time on the plaintext.
 */
export function sameCredential(a: string, b: string): boolean {
  try {
    const left = Buffer.from(decryptCredential(a), 'utf8');
    const right = Buffer.from(decryptCredential(b), 'utf8');
    return left.length === right.length && timingSafeEqual(left, right);
  } catch {
    return false;
  }
}
