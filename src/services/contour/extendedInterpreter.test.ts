import { describe, expect, it } from 'vitest';
import { candidateFromNeedleCompletion } from './extendedInterpreter';

describe('Contour Extended interpretation', () => {
  it('acts immediately on a high-confidence pure result', async () => {
    const candidate = await candidateFromNeedleCompletion({
      function_calls: [{ name: 'contour__calculator', arguments: { expression: '21 * 2' } }],
      confidence: 0.94,
    }, 'multiply 21 by 2');

    expect(candidate).toMatchObject({
      commandId: 'calculator',
      effect: 'pure',
      disposition: 'immediate',
      module: { id: 'calculator', calculator: { result: 42 } },
    });
  });

  it('always asks before a local write, even with high confidence', async () => {
    const candidate = await candidateFromNeedleCompletion({
      function_calls: [{ name: 'contour__quick-note', arguments: { content: 'buy mangoes' } }],
      confidence: 0.99,
    }, 'jot down that I should buy mangoes');

    expect(candidate).toMatchObject({
      commandId: 'quick-note',
      effect: 'local-write',
      disposition: 'confirm',
      module: { id: 'quick-note', quickNote: { content: 'buy mangoes' } },
    });
  });

  it('turns Needle withheld calls into confirmations', async () => {
    const candidate = await candidateFromNeedleCompletion({
      function_calls: [],
      suppressed_calls: [{ name: 'contour__calculator', arguments: { expression: '9 + 4' } }],
      confidence: 0.18,
    }, 'maybe work out 9 and 4');

    expect(candidate).toMatchObject({ commandId: 'calculator', disposition: 'confirm' });
  });

  it('ignores unsupported text and unknown tools', async () => {
    await expect(candidateFromNeedleCompletion({ function_calls: [], confidence: 0.99 }, 'hello')).resolves.toBeNull();
    await expect(candidateFromNeedleCompletion({
      function_calls: [{ name: 'not_a_contour_tool', arguments: {} }],
      confidence: 0.99,
    }, 'do something')).resolves.toBeNull();
  });

  it('rejects ungrounded false-positive tool calls', async () => {
    await expect(candidateFromNeedleCompletion({
      function_calls: [{ name: 'contour__hash', arguments: { text: 'The car wash is 2 minutes away.' } }],
      confidence: 0.72,
    }, 'The car wash is 2 minutes away. Should I walk there or drive?')).resolves.toBeNull();

    await expect(candidateFromNeedleCompletion({
      function_calls: [{ name: 'contour__translator', arguments: { text: 'earthquake', target_language: 'English' } }],
      confidence: 0.81,
    }, 'write me a paragraph on earthquake')).resolves.toBeNull();

    await expect(candidateFromNeedleCompletion({
      function_calls: [{ name: 'contour__convert-units', arguments: { value: 21, from_unit: 'm', to_unit: 'ft' } }],
      confidence: 0.44,
    }, 'would you kindly multiply 21 by 2')).resolves.toBeNull();
  });
});
