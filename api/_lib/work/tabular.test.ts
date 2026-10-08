import { describe, expect, it } from 'vitest';
import { analyzeWorkTable } from './tabular';
describe('bounded Work table analysis', () => {
  it('counts quoted fields and calculates real numeric facts without evaluating formulas', () => {
    const facts = analyzeWorkTable('name,value\r\n"A, B",10\r\nC,2.5\r\nD,=10+2\r\nE,\r\n');
    expect(facts.rows).toBe(4);
    expect(facts.fields[1]).toMatchObject({ numeric: 2, sum: 12.5, mean: 6.25, min: 2.5, max: 10, blank: 1 });
  });
  it('marks ragged rows and never invents missing cells', () => {
    expect(analyzeWorkTable('a,b\n1\n2,3,4').raggedRows).toBe(2);
    expect(analyzeWorkTable('a,b\n1\n2,3,4').fields[1].blank).toBe(1);
  });
  it('supports TSV and refuses excessive dimensions', () => {
    expect(analyzeWorkTable('a\tb\n1\t2', '\t').fields[1].sum).toBe(2);
    expect(() => analyzeWorkTable(Array.from({ length: 101 }, (_, i) => 'c' + i).join(','))).toThrow('TABLE_LIMIT');
  });
});
