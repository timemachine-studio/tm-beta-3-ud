import { useEffect, useState } from 'react';

/**
 * A blob URL for a file in the device store, or a reason there isn't one.
 *
 * Artifacts carry an id rather than bytes, so the chart under a message has to
 * be fetched before it can be shown. Two things this has to get right:
 *
 *  - **Revoke the URL.** `createObjectURL` pins the blob for the life of the
 *    document. A conversation with twenty charts scrolled past would otherwise
 *    hold every one of them in memory until the tab closed.
 *  - **Say when the file is not here.** These files are device-first: the same
 *    chat opened on another device has the id and not the bytes. That is a
 *    real state with a sentence attached, not a loading spinner that never
 *    finishes.
 */
export type StoredFileState =
  | { status: 'loading' }
  | { status: 'ready'; url: string }
  | { status: 'missing' };

export function useStoredFile(fileId: string | undefined): StoredFileState {
  // Keyed by the id it was loaded for, so the derived state below can fall
  // back to "loading" the moment the id changes — without an effect that
  // synchronously sets state, which cascades renders (Hooks lint, CLAUDE.md).
  const [loaded, setLoaded] = useState<{ id: string; state: StoredFileState } | null>(null);

  useEffect(() => {
    if (!fileId) return;

    let cancelled = false;
    let url: string | null = null;

    void (async () => {
      let next: StoredFileState = { status: 'missing' };
      try {
        const { readFile } = await import('../../services/files/fileStore');
        const blob = await readFile(fileId);
        if (blob && !cancelled) {
          url = URL.createObjectURL(blob);
          next = { status: 'ready', url };
        }
      } catch {
        // An unreadable store is indistinguishable, from here, from a file that
        // was never on this device. Both mean: show the name, not the bytes.
      }
      if (!cancelled) setLoaded({ id: fileId, state: next });
    })();

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [fileId]);

  if (!fileId) return { status: 'missing' };
  return loaded?.id === fileId ? loaded.state : { status: 'loading' };
}
