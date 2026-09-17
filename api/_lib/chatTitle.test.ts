import { expect, it } from 'vitest';
import { chatTitleBodySchema, parseCoverAnswer, parseTitleAnswer } from './chatTitle';

it('only accepts bounded confident image decisions', () => {
  expect(parseCoverAnswer('{"candidateId":"candidate-0","confidence":0.95}')?.candidateId).toBe('candidate-0');
  expect(parseCoverAnswer('{"candidateId":"candidate-0","confidence":0.5}')?.candidateId).toBeNull();
  expect(parseCoverAnswer('{"candidateId":"https://other.example/a.jpg","confidence":1}')).toBeNull();
  expect(parseCoverAnswer('{"candidateId":"candidate-0","confidence":10}')).toBeNull();
});

it('extracts a bounded title from fenced model output', () => {
  expect(parseTitleAnswer('```json\n{"title":"Mushroom Basics.","subject":"Chanterelle"}\n```')).toEqual({ title: 'Mushroom Basics', subject: 'Chanterelle' });
});
it('leaves task chats without a visual subject', () => {
  expect(parseTitleAnswer('{"title":"Fixing React State","subject":null}')?.subject).toBeNull();
  expect(parseTitleAnswer('{"title":"Fixing React State","subject":"none"}')?.subject).toBeNull();
});
it('rejects unusable provider output and oversized input', () => {
  expect(parseTitleAnswer('{"title":23}')).toBeNull();
  expect(parseTitleAnswer('not json')).toBeNull();
  expect(chatTitleBodySchema.safeParse({ messages: [{ role: 'user', content: 'a'.repeat(20_001) }] }).success).toBe(false);
});
