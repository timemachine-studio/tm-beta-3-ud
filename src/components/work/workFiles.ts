import { parseDelimited, serializeDelimited } from '../../services/convert/documentEngine';
import type { WorkFile } from '../../../shared/work';

export function workFileDownload(file: WorkFile): { content: string; mime: string } {
  if (file.kind === 'csv') {
    // CSVs open in spreadsheet software: neutralize formula injection without
    // silently transforming the stored artifact or its editing representation.
    const rows = parseDelimited(file.content, ',').map(row => row.map(cell => /^[\s]*[=+@-]/.test(cell) ? "'" + cell : cell));
    return { content: rows.length ? serializeDelimited(rows[0], rows.slice(1), ',') : '', mime: 'text/csv;charset=utf-8' };
  }
  return { content: file.content, mime: file.kind === 'markdown' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8' };
}
