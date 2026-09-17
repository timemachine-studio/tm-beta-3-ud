/**
 * Document conversion, on the device.
 *
 * Every document is read into one of two models — prose as Markdown, or a
 * table as rows — and written out from there. Markdown is the hub because the
 * app already speaks it (react-markdown, the Notes co-pilot), so a DOCX read
 * through mammoth, a web page read through turndown and a PDF read through
 * pdf.js all meet in the same place, and one writer per target covers all of
 * them.
 *
 * The pure helpers (delimited text, tables, plain text) are exported for the
 * tests; the readers that need a library import it lazily so the chat bundle
 * does not carry mammoth or docx for people who never convert anything.
 */

import type { FileFormat } from './formats';
import { TABLE_DOCUMENT_EXTS } from './formats';
import { ConversionError, type ProgressReporter } from './types';

export type DocumentModel =
  | { kind: 'text'; markdown: string }
  | { kind: 'table'; header: string[]; rows: string[][] };

// ─── Delimited text ─────────────────────────────────────────────────────────

/** RFC 4180-ish: quoted fields, doubled quotes, newlines inside quotes, CRLF. */
export function parseDelimited(text: string, delimiter: ',' | '\t'): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field === '') { quoted = true; continue; }
    if (ch === delimiter) { row.push(field); field = ''; continue; }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
      continue;
    }
    field += ch;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  // A trailing newline leaves one empty row behind.
  return rows.filter((cells, index) => !(index === rows.length - 1 && cells.length === 1 && cells[0] === ''));
}

export function serializeDelimited(header: string[], rows: string[][], delimiter: ',' | '\t'): string {
  const quote = (cell: string) => {
    const needs = cell.includes(delimiter) || cell.includes('"') || cell.includes('\n') || cell.includes('\r');
    return needs ? `"${cell.replace(/"/g, '""')}"` : cell;
  };
  return [header, ...rows].map((cells) => cells.map(quote).join(delimiter)).join('\r\n') + '\r\n';
}

// ─── Tables ↔ other shapes ──────────────────────────────────────────────────

export function tableFromRows(rows: string[][]): DocumentModel {
  const width = Math.max(1, ...rows.map((cells) => cells.length));
  const pad = (cells: string[]) => [...cells, ...Array<string>(width - cells.length).fill('')];
  const [header = [], ...rest] = rows.map(pad);
  return { kind: 'table', header, rows: rest };
}

export function jsonToModel(text: string): DocumentModel {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new ConversionError('This JSON file does not parse.');
  }
  if (Array.isArray(value) && value.length > 0) {
    if (value.every((item) => item !== null && typeof item === 'object' && !Array.isArray(item))) {
      const objects = value as Record<string, unknown>[];
      const header = Array.from(new Set(objects.flatMap((item) => Object.keys(item))));
      const rows = objects.map((item) => header.map((key) => cellText(item[key])));
      return { kind: 'table', header, rows };
    }
    if (value.every((item) => Array.isArray(item))) {
      return tableFromRows((value as unknown[][]).map((cells) => cells.map(cellText)));
    }
  }
  // Not tabular: carry it as a code block so the prose writers can still take it.
  return { kind: 'text', markdown: '```json\n' + JSON.stringify(value, null, 2) + '\n```\n' };
}

function cellText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function tableToJson(header: string[], rows: string[][]): string {
  const keys = header.map((key, index) => key || `column${index + 1}`);
  const coerce = (cell: string): unknown => {
    if (cell === '') return '';
    if (/^-?\d+(\.\d+)?$/.test(cell) && cell.length < 16) return Number(cell);
    if (cell === 'true' || cell === 'false') return cell === 'true';
    return cell;
  };
  const objects = rows.map((cells) => Object.fromEntries(keys.map((key, index) => [key, coerce(cells[index] ?? '')])));
  return JSON.stringify(objects, null, 2) + '\n';
}

export function tableToMarkdown(header: string[], rows: string[][]): string {
  const escape = (cell: string) => cell.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  const line = (cells: string[]) => `| ${cells.map(escape).join(' | ')} |`;
  return [line(header), `| ${header.map(() => '---').join(' | ')} |`, ...rows.map(line)].join('\n') + '\n';
}

export function tableToPlainText(header: string[], rows: string[][]): string {
  return [header, ...rows].map((cells) => cells.join('\t')).join('\n') + '\n';
}

export function tableToHtml(header: string[], rows: string[][], title: string): string {
  const cell = (tag: 'th' | 'td', text: string) => `<${tag}>${escapeHtml(text)}</${tag}>`;
  const body = [
    `<thead><tr>${header.map((text) => cell('th', text)).join('')}</tr></thead>`,
    `<tbody>${rows.map((cells) => `<tr>${cells.map((text) => cell('td', text)).join('')}</tr>`).join('\n')}</tbody>`,
  ].join('\n');
  return htmlDocument(title, `<table>\n${body}\n</table>`);
}

// ─── Markdown ↔ other shapes ────────────────────────────────────────────────

export async function markdownToHtml(markdown: string, title: string): Promise<string> {
  const [{ unified }, { default: remarkParse }, { default: remarkGfm }, { default: remarkRehype }, { default: rehypeStringify }] = await Promise.all([
    import('unified'), import('remark-parse'), import('remark-gfm'), import('remark-rehype'), import('rehype-stringify'),
  ]);
  const file = await unified().use(remarkParse).use(remarkGfm).use(remarkRehype).use(rehypeStringify).process(markdown);
  return htmlDocument(title, String(file));
}

/** Markdown with the markup taken off, keeping the structure people read. */
export async function markdownToPlainText(markdown: string): Promise<string> {
  const [{ unified }, { default: remarkParse }, { default: remarkGfm }] = await Promise.all([
    import('unified'), import('remark-parse'), import('remark-gfm'),
  ]);
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown);
  return blocksToText(tree.children as MdNode[]).replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/** The subset of mdast this module walks. */
export interface MdNode {
  type: string;
  value?: string;
  url?: string;
  alt?: string;
  depth?: number;
  ordered?: boolean;
  start?: number;
  checked?: boolean | null;
  lang?: string;
  align?: (string | null)[];
  children?: MdNode[];
}

export function inlineToText(nodes: MdNode[] | undefined): string {
  if (!nodes) return '';
  return nodes.map((node) => {
    switch (node.type) {
      case 'text':
      case 'inlineCode': return node.value ?? '';
      case 'break': return '\n';
      case 'image': return node.alt ?? '';
      case 'link': {
        const text = inlineToText(node.children);
        return node.url && node.url !== text ? `${text} (${node.url})` : text;
      }
      default: return inlineToText(node.children);
    }
  }).join('');
}

/** `tight` is a list item's body: its paragraphs sit one line apart, not a blank line. */
function blocksToText(nodes: MdNode[], indent = '', tight = false): string {
  return nodes.map((node) => {
    switch (node.type) {
      case 'heading':
      case 'paragraph': return `${indent}${inlineToText(node.children)}${tight ? '\n' : '\n\n'}`;
      case 'code': return `${node.value ?? ''}\n\n`;
      case 'html': return `${node.value ?? ''}\n\n`;
      case 'blockquote': return blocksToText(node.children ?? [], `${indent}> `);
      case 'thematicBreak': return `${indent}---\n\n`;
      case 'list': {
        const items = (node.children ?? []).map((item, index) => {
          const marker = node.ordered ? `${(node.start ?? 1) + index}. ` : '- ';
          const box = item.checked == null ? '' : item.checked ? '[x] ' : '[ ] ';
          // One line per item; a nested list or second paragraph follows on
          // its own lines, and the item ends with exactly one newline.
          const body = blocksToText(item.children ?? [], `${indent}  `, true).trimStart().replace(/\n+$/, '\n');
          return `${indent}${marker}${box}${body}`;
        });
        return items.join('') + '\n';
      }
      case 'table': {
        const rows = (node.children ?? []).map((row) => (row.children ?? []).map((cell) => inlineToText(cell.children)));
        return rows.map((cells) => `${indent}${cells.join('\t')}`).join('\n') + '\n\n';
      }
      default: return node.children ? blocksToText(node.children, indent) : '';
    }
  }).join('');
}

export async function htmlToMarkdown(html: string): Promise<string> {
  const { default: TurndownService } = await import('turndown');
  const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-', emDelimiter: '*' });
  turndown.remove(['script', 'style', 'noscript']);
  // Turndown drops tables to running text; keep them as pipe tables.
  turndown.addRule('table', {
    filter: 'table',
    replacement: (_content, node) => {
      const rows = Array.from((node as HTMLTableElement).querySelectorAll('tr'))
        .map((tr) => Array.from(tr.querySelectorAll('th,td')).map((cell) => (cell.textContent ?? '').trim()));
      if (rows.length === 0) return '';
      const width = Math.max(...rows.map((cells) => cells.length));
      const padded = rows.map((cells) => [...cells, ...Array<string>(width - cells.length).fill('')]);
      const [header, ...rest] = padded;
      return `\n\n${tableToMarkdown(header, rest)}\n`;
    },
  });
  return turndown.turndown(html).trim() + '\n';
}

// ─── HTML shell ─────────────────────────────────────────────────────────────

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string));
}

function htmlDocument(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  body { max-width: 46rem; margin: 3rem auto; padding: 0 1.25rem; font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1a1a1a; }
  pre { padding: 1rem; overflow: auto; background: #f4f4f4; border-radius: 8px; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.9em; }
  table { border-collapse: collapse; width: 100%; }
  th, td { padding: 0.4rem 0.6rem; border: 1px solid #ddd; text-align: left; vertical-align: top; }
  th { background: #f4f4f4; }
  blockquote { margin: 0; padding-left: 1rem; border-left: 3px solid #ddd; color: #555; }
  img { max-width: 100%; }
</style>
</head>
<body>
${body}
</body>
</html>
`;
}

// ─── Readers ────────────────────────────────────────────────────────────────

export async function readDocument(file: File, source: FileFormat): Promise<DocumentModel> {
  switch (source.ext) {
    case 'csv': return tableFromRows(parseDelimited(await file.text(), ','));
    case 'tsv': return tableFromRows(parseDelimited(await file.text(), '\t'));
    case 'json': return jsonToModel(await file.text());
    case 'md':
    case 'txt': return { kind: 'text', markdown: await file.text() };
    case 'html': return { kind: 'text', markdown: await htmlToMarkdown(await file.text()) };
    case 'docx': {
      const { default: mammoth } = await import('mammoth');
      const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
      return { kind: 'text', markdown: await htmlToMarkdown(result.value) };
    }
    case 'pdf': {
      const { extractPdfText } = await import('../pdf/pdfService');
      const { text } = await extractPdfText(file, { truncate: false });
      return { kind: 'text', markdown: text };
    }
    default:
      throw new ConversionError(`Cannot read ${source.label} documents.`);
  }
}

// ─── Writers ────────────────────────────────────────────────────────────────

export async function writeDocument(model: DocumentModel, target: FileFormat, title: string): Promise<Blob> {
  const text = (content: string) => new Blob([content], { type: `${target.mime};charset=utf-8` });
  if (model.kind === 'table') {
    const { header, rows } = model;
    switch (target.ext) {
      case 'csv': return text(serializeDelimited(header, rows, ','));
      case 'tsv': return text(serializeDelimited(header, rows, '\t'));
      case 'json': return text(tableToJson(header, rows));
      case 'md': return text(tableToMarkdown(header, rows));
      case 'txt': return text(tableToPlainText(header, rows));
      case 'html': return text(tableToHtml(header, rows, title));
      case 'docx': {
        const { markdownToDocx } = await import('./markdownToDocx');
        return markdownToDocx(tableToMarkdown(header, rows), title);
      }
    }
  } else {
    const { markdown } = model;
    switch (target.ext) {
      case 'md': return text(markdown.endsWith('\n') ? markdown : markdown + '\n');
      case 'txt': return text(await markdownToPlainText(markdown));
      case 'html': return text(await markdownToHtml(markdown, title));
      case 'docx': {
        const { markdownToDocx } = await import('./markdownToDocx');
        return markdownToDocx(markdown, title);
      }
    }
  }
  throw new ConversionError(`Cannot write ${TABLE_DOCUMENT_EXTS.has(target.ext) ? 'rows' : 'a document'} as ${target.label} from this file.`);
}

export async function convertDocument(file: File, source: FileFormat, target: FileFormat, report: ProgressReporter): Promise<Blob> {
  report({ phase: 'convert', label: 'Reading', ratio: undefined });
  const model = await readDocument(file, source);
  report({ phase: 'convert', label: 'Writing', ratio: undefined });
  const title = file.name.replace(/\.[^.]+$/, '') || 'Document';
  return writeDocument(model, target, title);
}
