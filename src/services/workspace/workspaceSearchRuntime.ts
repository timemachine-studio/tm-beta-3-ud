import type { WorkspaceToolResult } from '../agent/deviceToolRunner';

export interface WorkspaceSearchRequest { sessionId: string; query: string; pathGlob: string }
export const WORKSPACE_SEARCH_TIMEOUT_MS = 10_000;

/** A regex can block its worker indefinitely; only the owning thread can stop it. */
export function createWorkspaceSearch(createWorker: () => Worker) {
  return (request: WorkspaceSearchRequest, signal?: AbortSignal): Promise<WorkspaceToolResult> => {
    if (signal?.aborted) return Promise.resolve({ ok: false, content: 'Error: workspace search was cancelled.' });
    if (request.query.length > 2048 || request.pathGlob.length > 512) {
      return Promise.resolve({ ok: false, content: 'Error: search query or path glob is too long. Narrow the search.' });
    }
    let worker: Worker;
    try { worker = createWorker(); }
    catch { return Promise.resolve({ ok: false, content: 'Error: this browser could not start the search worker. Use list_files and read_file.' }); }
    return new Promise(resolve => {
      let settled = false;
      const finish = (result: WorkspaceToolResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        worker.terminate();
        resolve(result);
      };
      const onAbort = () => finish({ ok: false, content: 'Error: workspace search was cancelled.' });
      const timer = setTimeout(() => finish({ ok: false, content: 'Error: search exceeded 10 seconds and was stopped. Simplify the regular expression or narrow path_glob before trying again.' }), WORKSPACE_SEARCH_TIMEOUT_MS);
      worker.onmessage = (event: MessageEvent<WorkspaceToolResult>) => finish(event.data);
      worker.onerror = event => { event.preventDefault(); finish({ ok: false, content: 'Error: workspace search failed. Try a simpler query or read a file directly.' }); };
      signal?.addEventListener('abort', onAbort, { once: true });
      if (signal?.aborted) onAbort();
      else {
        try { worker.postMessage(request); }
        catch { finish({ ok: false, content: 'Error: could not send the query to the workspace search worker.' }); }
      }
    });
  };
}

export const runWorkspaceSearch = createWorkspaceSearch(() => new Worker(new URL('./workspaceSearchWorker.ts', import.meta.url), { type: 'module' }));
