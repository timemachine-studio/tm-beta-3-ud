/**
 * A small line diff, for the cards.
 *
 * The harness card for an edit shows what changed — not the whole file, and
 * not just "edited". This produces a compact unified-style hunk list with a
 * few lines of context, plus the +/− counts for the one-line summary.
 *
 * LCS over lines, which is quadratic, so it is capped: past the cap the
 * counts come from a multiset difference (cheap, and exact for the totals
 * when lines do not move) and the hunk text is omitted. A 3,000-line file
 * being rewritten is a card that says "+2,981 −2,977"; nobody reads that
 * diff anyway.
 */

export interface LineDiff {
  added: number;
  removed: number;
  /** Unified-style text, or null when the file was too large to align. */
  unified: string | null;
}

const MAX_LCS_LINES = 1_500;
const CONTEXT = 2;
const MAX_UNIFIED_CHARS = 12_000;

function splitLines(text: string): string[] {
  if (text === '') return [];
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function countsOnly(oldLines: string[], newLines: string[]): LineDiff {
  const counts = new Map<string, number>();
  for (const line of oldLines) counts.set(line, (counts.get(line) ?? 0) + 1);
  let added = 0;
  for (const line of newLines) {
    const left = counts.get(line) ?? 0;
    if (left > 0) counts.set(line, left - 1);
    else added++;
  }
  let removed = 0;
  for (const left of counts.values()) removed += left;
  return { added, removed, unified: null };
}

type Op = { kind: ' ' | '+' | '-'; line: string; oldNo: number; newNo: number };

export function lineDiff(oldText: string, newText: string): LineDiff {
  const oldLines = splitLines(oldText);
  const newLines = splitLines(newText);
  if (oldLines.length > MAX_LCS_LINES || newLines.length > MAX_LCS_LINES) {
    return countsOnly(oldLines, newLines);
  }

  const n = oldLines.length;
  const m = newLines.length;
  // lcs[i][j] = length of the LCS of oldLines[i..] and newLines[j..].
  const lcs: Uint16Array[] = [];
  for (let i = 0; i <= n; i++) lcs.push(new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = oldLines[i] === newLines[j]
        ? lcs[i + 1][j + 1] + 1
        : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      ops.push({ kind: ' ', line: oldLines[i], oldNo: i + 1, newNo: j + 1 });
      i++; j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ kind: '-', line: oldLines[i], oldNo: i + 1, newNo: j + 1 });
      i++;
    } else {
      ops.push({ kind: '+', line: newLines[j], oldNo: i + 1, newNo: j + 1 });
      j++;
    }
  }
  while (i < n) { ops.push({ kind: '-', line: oldLines[i], oldNo: i + 1, newNo: j + 1 }); i++; }
  while (j < m) { ops.push({ kind: '+', line: newLines[j], oldNo: i + 1, newNo: j + 1 }); j++; }

  const added = ops.filter(op => op.kind === '+').length;
  const removed = ops.filter(op => op.kind === '-').length;
  if (added === 0 && removed === 0) return { added, removed, unified: '' };

  // Hunks: every change with CONTEXT lines either side, merged when they touch.
  const keep = new Array<boolean>(ops.length).fill(false);
  for (let k = 0; k < ops.length; k++) {
    if (ops[k].kind === ' ') continue;
    for (let c = Math.max(0, k - CONTEXT); c <= Math.min(ops.length - 1, k + CONTEXT); c++) keep[c] = true;
  }
  const out: string[] = [];
  let inHunk = false;
  for (let k = 0; k < ops.length; k++) {
    if (!keep[k]) { inHunk = false; continue; }
    if (!inHunk) {
      out.push(`@@ -${ops[k].oldNo} +${ops[k].newNo} @@`);
      inHunk = true;
    }
    out.push(`${ops[k].kind}${ops[k].line}`);
  }
  let unified = out.join('\n');
  if (unified.length > MAX_UNIFIED_CHARS) unified = `${unified.slice(0, MAX_UNIFIED_CHARS)}\n… (diff truncated)`;
  return { added, removed, unified };
}

/** "+12 −3", the way every code host writes it. */
export function diffSummary(diff: Pick<LineDiff, 'added' | 'removed'>): string {
  return `+${diff.added.toLocaleString()} −${diff.removed.toLocaleString()}`;
}
