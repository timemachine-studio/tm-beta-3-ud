/**
 * `localStorage` is not guaranteed to be there. Safari's private mode, a
 * browser configured to block site data, and an over-quota origin all make the
 * accessor itself throw rather than return null — and a throw inside a `useState`
 * initializer or a provider's render kills the whole app at the root boundary,
 * on every reload, with no way for the user to recover.
 *
 * These helpers are for *preferences*: values with a sane default, where losing
 * one costs the user a re-pick. They are deliberately NOT for conversation
 * content. A local-only chat store has no cloud copy, so a failed write there
 * has to surface (see Gate LS in production-check.md) — which is why the write
 * helpers report success instead of swallowing it silently.
 */

export function readStoredString(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Reads and parses a stored JSON value, returning null unless it parses AND
 * satisfies `isValid`. A stored value that has gone bad — hand-edited, written
 * by an older build, truncated by a quota error mid-write — must not be able to
 * take the app down, and must not come back as a malformed object either.
 */
export function readStoredJson<T>(key: string, isValid: (value: unknown) => value is T): T | null {
  const raw = readStoredString(key);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Returns false when the value could not be persisted. */
export function writeStoredString(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Returns false when the value could not be persisted. */
export function writeStoredJson(key: string, value: unknown): boolean {
  try {
    return writeStoredString(key, JSON.stringify(value));
  } catch {
    return false;
  }
}

/** Returns false when the key could not be removed. */
export function removeStored(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
