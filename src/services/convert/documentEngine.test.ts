import { describe, expect, it } from 'vitest';
import {
  jsonToModel, markdownToHtml, markdownToPlainText, parseDelimited, serializeDelimited,
  tableFromRows, tableToJson, tableToMarkdown, writeDocument,
} from './documentEngine';
import { formatByExt } from './formats';

describe('delimited text', () => {
  it('parses quotes, doubled quotes, embedded newlines and CRLF', () => {
    const rows = parseDelimited('name,note\r\n"Smith, J","said ""hi""\nand left"\r\nLee,\r\n', ',');
    expect(rows).toEqual([['name', 'note'], ['Smith, J', 'said "hi"\nand left'], ['Lee', '']]);
  });

  it('strips a BOM and reads TSV', () => {
    expect(parseDelimited('﻿a\tb\n1\t2', '\t')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('round-trips through the serializer', () => {
    const header = ['id', 'text'];
    const rows = [['1', 'plain'], ['2', 'has, comma'], ['3', 'has "quote"'], ['4', 'two\nlines']];
    expect(parseDelimited(serializeDelimited(header, rows, ','), ',')).toEqual([header, ...rows]);
  });
});

describe('tables', () => {
  it('pads ragged rows to the widest', () => {
    const model = tableFromRows([['a', 'b', 'c'], ['1'], ['2', '3']]);
    expect(model).toEqual({ kind: 'table', header: ['a', 'b', 'c'], rows: [['1', '', ''], ['2', '3', '']] });
  });

  it('reads an array of objects as a table and everything else as prose', () => {
    expect(jsonToModel('[{"a":1,"b":"x"},{"b":"y","c":true}]')).toEqual({
      kind: 'table', header: ['a', 'b', 'c'], rows: [['1', 'x', ''], ['', 'y', 'true']],
    });
    expect(jsonToModel('[[1,2],[3]]')).toEqual({ kind: 'table', header: ['1', '2'], rows: [['3', '']] });
    const prose = jsonToModel('{"nested":{"deep":true}}');
    expect(prose.kind).toBe('text');
    expect(prose.kind === 'text' && prose.markdown).toContain('```json');
    expect(() => jsonToModel('{not json')).toThrow(/does not parse/);
  });

  it('writes JSON with numbers and booleans coerced', () => {
    const json = JSON.parse(tableToJson(['n', 'ok', 's', ''], [['12', 'true', 'text', 'x']]));
    expect(json).toEqual([{ n: 12, ok: true, s: 'text', column4: 'x' }]);
  });

  it('writes a pipe table with pipes escaped', () => {
    expect(tableToMarkdown(['a', 'b'], [['1|2', 'two\nlines']])).toBe('| a | b |\n| --- | --- |\n| 1\\|2 | two lines |\n');
  });
});

describe('markdown writers', () => {
  // The first call pulls the unified/remark/rehype stack in; under a full
  // parallel run that import alone has crossed the 5 s default.
  it('produces a complete HTML document', { timeout: 20_000 }, async () => {
    const html = await markdownToHtml('# Title\n\nSome *text* and a [link](https://example.com).\n\n| a | b |\n| - | - |\n| 1 | 2 |\n', 'Doc <1>');
    expect(html).toContain('<title>Doc &lt;1&gt;</title>');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<em>text</em>');
    expect(html).toContain('<a href="https://example.com">link</a>');
    expect(html).toContain('<td>2</td>');
  });

  it('flattens markdown to readable text', async () => {
    const text = await markdownToPlainText('# Title\n\nA **bold** [link](https://x.y) here.\n\n- one\n- two\n  - nested\n\n1. first\n2. second\n\n```js\ncode()\n```\n\n> quoted\n');
    expect(text).toBe('Title\n\nA bold link (https://x.y) here.\n\n- one\n- two\n  - nested\n\n1. first\n2. second\n\ncode()\n\n> quoted\n');
  });

  it('refuses shapes that make no sense instead of writing junk', async () => {
    await expect(writeDocument({ kind: 'text', markdown: 'hi' }, formatByExt('csv')!, 't')).rejects.toThrow(/Cannot write/);
  });

  it('writes a table as every document target', async () => {
    const model = { kind: 'table' as const, header: ['a', 'b'], rows: [['1', '2']] };
    for (const ext of ['csv', 'tsv', 'json', 'md', 'txt', 'html']) {
      const blob = await writeDocument(model, formatByExt(ext)!, 'rows');
      expect(blob.size, ext).toBeGreaterThan(0);
    }
  });
});
