import { describe, expect, it } from 'vitest';
import { attachedFilesFor } from './aiProxyService';
import type { Message } from '../../types/chat';

const message = (id: string, attachments?: Message['attachments']): Message => ({
  id, content: 'x', isAI: false, ...(attachments ? { attachments } : {}),
} as Message);

const file = (id: string, name: string, size = 10) => ({
  id, name, size, mime: 'application/octet-stream',
});

describe('which files a turn can reach', () => {
  it('finds one attached several turns ago', () => {
    // The point of reading these off the transcript: a spreadsheet stays
    // openable for as long as the message carrying it is in context, and it
    // comes back after a reload because the reference was saved with it.
    const files = attachedFilesFor([
      message('1', [file('f1', 'sales.xlsx')]),
      message('2'),
      message('3'),
    ]);
    expect(files.map(entry => entry.id)).toEqual(['f1']);
  });

  it('never lists the same file twice, however often it is referenced', () => {
    const files = attachedFilesFor([
      message('1', [file('f1', 'a.csv')]),
      message('2', [file('f1', 'a.csv')]),
    ]);
    expect(files).toHaveLength(1);
  });

  it('makes duplicate names unique, because the name is the path', () => {
    // The model is told "/files/report.pdf" and the runner writes to the same
    // string. Two files called report.pdf would silently be one file.
    const files = attachedFilesFor([
      message('1', [file('f1', 'report.pdf')]),
      message('2', [file('f2', 'report.pdf')]),
    ]);
    expect(files.map(entry => entry.name).sort()).toEqual(['report-2.pdf', 'report.pdf']);
    expect(new Set(files.map(entry => entry.name)).size).toBe(2);
  });

  it('strips separators, so a name cannot escape /files', () => {
    const [entry] = attachedFilesFor([message('1', [file('f1', '../../etc/passwd')])]);
    expect(entry.name).not.toContain('/');
  });

  it('bounds how many one turn carries', () => {
    const many = Array.from({ length: 20 }, (_unused, index) =>
      message(String(index), [file(`f${index}`, `f${index}.csv`)]));
    expect(attachedFilesFor(many).length).toBeLessThanOrEqual(8);
  });

  it('is empty for a conversation with no attachments', () => {
    expect(attachedFilesFor([message('1'), message('2')])).toEqual([]);
  });
});
