// Message and session identifiers.
//
// Message ids used to be `Date.now()` with a hand-rolled `+ 1` for the AI
// placeholder. Millisecond resolution collides on rapid sends, on a retry
// fired in the same tick, and on a restored session whose messages land on the
// same millisecond as a new one — and a collision means duplicate React keys,
// so messages merge or vanish (production-check.md 1.12).
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Older browsers (and non-secure contexts, where randomUUID is undefined).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
