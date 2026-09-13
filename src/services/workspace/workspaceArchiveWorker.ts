import { decodeWorkspaceArchive } from './workspaceArchive';
self.onmessage = (event: MessageEvent<Uint8Array>) => {
  try { self.postMessage({ result: decodeWorkspaceArchive(event.data) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'Could not unpack this ZIP archive.' }); }
};
