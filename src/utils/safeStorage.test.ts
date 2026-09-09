import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  readStoredJson,
  readStoredString,
  removeStored,
  writeStoredJson,
  writeStoredString,
} from './safeStorage';

function installStorage(store: Partial<Storage>): void {
  vi.stubGlobal('localStorage', store as Storage);
}

/** The shape a browser takes when site data is blocked: the accessor throws. */
function throwingStorage(): Partial<Storage> {
  const blocked = () => { throw new DOMException('The operation is insecure.', 'SecurityError'); };
  return { getItem: blocked, setItem: blocked, removeItem: blocked };
}

function workingStorage(initial: Record<string, string> = {}): Partial<Storage> {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
    removeItem: (key: string) => { map.delete(key); },
  };
}

const isPair = (value: unknown): value is { a: number } =>
  typeof value === 'object' && value !== null && typeof (value as { a?: unknown }).a === 'number';

afterEach(() => { vi.unstubAllGlobals(); });

describe('safeStorage', () => {
  it('reads and writes through a working storage', () => {
    installStorage(workingStorage({ existing: 'value' }));

    expect(readStoredString('existing')).toBe('value');
    expect(readStoredString('absent')).toBeNull();
    expect(writeStoredString('fresh', 'written')).toBe(true);
    expect(readStoredString('fresh')).toBe('written');
    expect(removeStored('fresh')).toBe(true);
    expect(readStoredString('fresh')).toBeNull();
  });

  it('never throws when the storage accessor itself throws', () => {
    installStorage(throwingStorage());

    expect(readStoredString('anything')).toBeNull();
    expect(readStoredJson('anything', isPair)).toBeNull();
    expect(writeStoredString('key', 'value')).toBe(false);
    expect(writeStoredJson('key', { a: 1 })).toBe(false);
    expect(removeStored('key')).toBe(false);
  });

  it('rejects a stored value that is corrupt or no longer the expected shape', () => {
    installStorage(workingStorage({
      broken: '{not json',
      wrongShape: '{"a":"not a number"}',
      good: '{"a":1}',
    }));

    // A corrupt value must come back as null, not as a thrown SyntaxError:
    // parsing it during render would crash the app on every reload.
    expect(readStoredJson('broken', isPair)).toBeNull();
    expect(readStoredJson('wrongShape', isPair)).toBeNull();
    expect(readStoredJson('good', isPair)).toEqual({ a: 1 });
  });

  it('reports failure rather than throwing when a value cannot be serialised', () => {
    installStorage(workingStorage());
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(writeStoredJson('circular', circular)).toBe(false);
  });
});
