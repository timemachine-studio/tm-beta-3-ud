import type { WorkspaceChange } from './githubService';

export interface PublicationProposal {
  repository: string;
  base: string;
  branch: string;
  title: string;
  body: string;
  changes: readonly WorkspaceChange[];
}
export interface PendingPublication extends PublicationProposal {
  sessionId: string;
  settle: (approved: boolean) => void;
}
const pending = new Map<string, PendingPublication>();
const listeners = new Set<() => void>();
const notify = () => { for (const listener of listeners) listener(); };
export const subscribePublication = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const pendingPublication = (sessionId: string) => pending.get(sessionId) ?? null;

/** Approval belongs to this exact proposal and is never reused by a later call. */
export function requestPublicationApproval(sessionId: string, proposal: PublicationProposal, signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted || pending.has(sessionId)) return Promise.resolve(false);
  return new Promise(resolve => {
    const onAbort = () => settle(false);
    const settle = (approved: boolean) => {
      if (pending.get(sessionId)?.settle !== settle) return;
      pending.delete(sessionId);
      signal?.removeEventListener('abort', onAbort);
      notify();
      resolve(approved && !signal?.aborted);
    };
    pending.set(sessionId, { ...proposal, sessionId, settle });
    signal?.addEventListener('abort', onAbort, { once: true });
    notify();
  });
}
