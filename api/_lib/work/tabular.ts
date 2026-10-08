import { parseDelimited } from '../../../src/services/convert/documentEngine.js';

/** Deterministic, bounded table facts. No code/eval or spreadsheet formulas. */
export function analyzeWorkTable(content: string, delimiter: ',' | '\t' = ',') {
  const parsed = parseDelimited(content, delimiter);
  const header = parsed.shift() ?? [];
  const rows = parsed;
  if (!header.length || header.length > 100 || rows.length > 10000) throw new Error('TABLE_LIMIT');
  return {
    rows: rows.length, columns: header.length, raggedRows: rows.filter(row => row.length !== header.length).length,
    note: 'First row treated as headers. Numeric statistics use only finite decimal/scientific literals, never formulas, currency or formatted values.',
    fields: header.map((name, column) => {
      const cells = rows.map(row => row[column] ?? '');
      const numbers = cells.map(cell => cell.trim()).filter(cell => /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(cell)).map(Number).filter(Number.isFinite);
      const sum = numbers.reduce((sum, number) => sum + number, 0);
      return { name: name.slice(0, 120), blank: cells.filter(cell => !cell.trim()).length, numeric: numbers.length,
        sum: numbers.length && Number.isFinite(sum) ? sum : null, mean: numbers.length && Number.isFinite(sum) ? sum / numbers.length : null,
        min: numbers.length ? Math.min(...numbers) : null, max: numbers.length ? Math.max(...numbers) : null,
        sample: cells.slice(0, 3).map(cell => cell.slice(0, 200)) };
    }),
  };
}
