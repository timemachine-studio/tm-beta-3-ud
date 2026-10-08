import { strToU8, zipSync } from 'fflate';
import type { WorkFile } from '../../../shared/work';
import { workPathSchema } from '../../../shared/work';
import { workFileDownload } from './workFiles';

/** Export saved deliverables only. Source uploads remain in TM and CSV cells
 * receive the same spreadsheet-safe encoding as individual downloads. */
export function workDeliverablesBundle(files: WorkFile[]): Blob {
  const outputs = files.filter(file => !file.source);
  if (!outputs.length || outputs.length > 24) throw new Error('No saved deliverables are available.');
  const entries: Record<string, Uint8Array> = Object.create(null);
  const seen = new Set<string>();
  const manifest = outputs.map(file => {
    const path = workPathSchema.parse(file.path);
    if (seen.has(path) || path === 'manifest.json') throw new Error('Duplicate deliverable path.');
    seen.add(path);
    entries[path] = strToU8(workFileDownload(file).content);
    return { path, kind: file.kind, revision: file.revision, updatedAt: file.updated_at };
  });
  entries['manifest.json'] = strToU8(JSON.stringify({ format: 'TimeMachine Work deliverables', version: 1, files: manifest }, null, 2));
  return new Blob([new Uint8Array(zipSync(entries, { level: 6 }))], { type: 'application/zip' });
}
