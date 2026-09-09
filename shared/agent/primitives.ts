import { z } from 'zod';

export const SCHEMA_VERSION = 1 as const;
export const MAX_JSON_BYTES = 65_536;
export const idSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
export const versionSchema = z.string().regex(/^\d+\.\d+\.\d+$/).max(32);
export const timestampSchema = z.iso.datetime({ offset: true });
export const digestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);
export const personaSchema = z.enum(['default', 'girlie', 'pro']);
export const storageSchema = z.enum(['device', 'cloud']);
export const revisionSchema = z.number().int().nonnegative().safe();
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

// Validate before recursion/serialization: reject cycles, exotic objects, getters,
// sparse arrays and values JSON would silently drop or coerce.
function isBoundedJson(value: unknown): value is JsonValue {
  let nodes = 0;
  const seen = new Set<object>();
  function visit(item: unknown, depth: number): boolean {
    if (++nodes > 10_000 || depth > 20) return false;
    if (item === null || typeof item === 'boolean') return true;
    if (typeof item === 'string') return item.length <= MAX_JSON_BYTES;
    if (typeof item === 'number') return Number.isFinite(item);
    if (typeof item !== 'object' || seen.has(item)) return false;
    if (!Array.isArray(item) && Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) return false;
    seen.add(item);
    const keys = Object.keys(item);
    const ownKeys = Reflect.ownKeys(item);
    if (ownKeys.some(key => typeof key === 'symbol' || (key !== 'length' && !Object.prototype.propertyIsEnumerable.call(item, key)))) return false;
    if (!Array.isArray(item) && ownKeys.length !== keys.length) return false;
    if (Array.isArray(item) && keys.length !== item.length) return false;
    const valid = keys.every(key => {
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      return key !== '__proto__' && key !== 'constructor' && key !== 'prototype' &&
        !!descriptor && 'value' in descriptor && visit(descriptor.value, depth + 1);
    });
    seen.delete(item);
    return valid;
  }
  return visit(value, 0) && new TextEncoder().encode(JSON.stringify(value)).length <= MAX_JSON_BYTES;
}
export const jsonValueSchema = z.custom<JsonValue>(isBoundedJson, 'Expected bounded JSON (64 KiB, depth 20, 10000 nodes)');
export const argumentsSchema = jsonValueSchema.refine(
  value => value !== null && typeof value === 'object' && !Array.isArray(value),
  'Arguments must be a JSON object',
);

/** TM canonical JSON v1: sorted UTF-16 object keys, preserved array order,
 * JSON number/string encoding, no Unicode normalization. Not RFC 8785. */
export function canonicalArguments(input: unknown): string {
  const value = argumentsSchema.parse(input);
  function encode(item: JsonValue): string {
    if (item === null || typeof item !== 'object') return JSON.stringify(item);
    if (Array.isArray(item)) return `[${item.map(encode).join(',')}]`;
    return `{${Object.keys(item).sort().map(key => `${JSON.stringify(key)}:${encode(item[key])}`).join(',')}}`;
  }
  return encode(value);
}
export async function hashArguments(input: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalArguments(input));
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return `sha256:${Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')}`;
}
