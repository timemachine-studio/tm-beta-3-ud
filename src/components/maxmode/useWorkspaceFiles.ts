import { useEffect, useState } from 'react';
import { listWorkspace, subscribeWorkspace, type WorkspaceEntry } from '../../services/workspace/workspaceStore';

/**
 * The workspace's file list, kept current.
 *
 * Re-reads on every change notification for this session — the harness's
 * writes, the editor's saves, a sync back from the runtime — so the tree is
 * never a stale copy of what the tools see.
 */
export function useWorkspaceFiles(sessionId: string): { entries: WorkspaceEntry[]; error: string | null; refresh: () => void } {
  const [entries, setEntries] = useState<WorkspaceEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listWorkspace(sessionId)
      .then(list => { if (!cancelled) { setEntries(list); setError(null); } })
      .catch((cause: unknown) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Workspace storage failed.'); });
    const unsubscribe = subscribeWorkspace((changed) => {
      if (changed === sessionId) setTick(value => value + 1);
    });
    return () => { cancelled = true; unsubscribe(); };
  }, [sessionId, tick]);

  return { entries, error, refresh: () => setTick(value => value + 1) };
}
