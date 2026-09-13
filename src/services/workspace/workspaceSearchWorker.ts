import { searchWorkspace } from './workspaceSearch';
import type { WorkspaceSearchRequest } from './workspaceSearchRuntime';

self.onmessage = async (event: MessageEvent<WorkspaceSearchRequest>) => {
  const { sessionId, query, pathGlob } = event.data;
  try { self.postMessage(await searchWorkspace(sessionId, query, pathGlob)); }
  catch { self.postMessage({ ok: false, content: 'Error: could not read the workspace for search.' }); }
};
