import { MAX_WORKSPACE_ARCHIVE_BYTES, type DecodedWorkspaceArchive } from './workspaceArchive';

export function decodeWorkspaceArchiveInWorker(zip: Uint8Array): Promise<DecodedWorkspaceArchive> {
  if (zip.byteLength > MAX_WORKSPACE_ARCHIVE_BYTES) return Promise.reject(new Error('ZIP archives may be at most 64 MB.'));
  const worker = new Worker(new URL('./workspaceArchiveWorker.ts', import.meta.url), { type: 'module' });
  return new Promise((resolve, reject) => {
    const finish = (result?: DecodedWorkspaceArchive, error?: string) => {
      clearTimeout(timer);
      worker.terminate();
      if (result) resolve(result);
      else reject(new Error(error ?? 'Could not unpack this ZIP archive.'));
    };
    const timer = setTimeout(() => finish(undefined, 'ZIP extraction exceeded 15 seconds and was stopped. Import a smaller archive.'), 15_000);
    worker.onmessage = (event: MessageEvent<{ result?: DecodedWorkspaceArchive; error?: string }>) => finish(event.data.result, event.data.error);
    worker.onerror = event => { event.preventDefault(); finish(undefined, 'The ZIP extraction worker failed.'); };
    try { worker.postMessage(zip); }
    catch { finish(undefined, 'Could not send the ZIP archive to the extraction worker.'); }
  });
}
