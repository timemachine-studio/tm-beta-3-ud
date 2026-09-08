import { describe, expect, it, vi } from 'vitest';
import type { ProviderContentPart, ProviderMessage } from './providerTypes.js';
import {
  applyNativeVision,
  applyOcrVision,
  attachmentsFrom,
  chainIsAllNative,
  collectAttachments,
  createVisionAdapter,
  resolveVisionMode,
  selectVisionImages,
  type VisionHop,
} from './vision.js';

const DATA_URL = 'data:image/png;base64,AAAA';
const HOSTED = 'https://i.ibb.co/abc/photo.png';

const userTurn = (content: string): ProviderMessage[] => ([
  { role: 'system', content: 'system prompt' },
  { role: 'user', content },
]);

describe('resolveVisionMode', () => {
  it('prefers the hop annotation over the registry', () => {
    // The registry says this model can see; the hop says otherwise, because
    // this route to it cannot take image parts. The hop wins.
    expect(resolveVisionMode({ provider: 'groq', model: 'qwen/qwen3.6-27b' })).toBe('native');
    expect(resolveVisionMode({ provider: 'groq', model: 'qwen/qwen3.6-27b', vision: 'ocr' })).toBe('ocr');
  });

  it('falls back to OCR for a model it has never heard of', () => {
    expect(resolveVisionMode({ provider: 'groq', model: 'some/unlisted-model' })).toBe('ocr');
  });

  it('reads the registry for text-only fallback hops', () => {
    expect(resolveVisionMode({ provider: 'eaon', model: 'glm-5.2-extended' })).toBe('ocr');
    expect(resolveVisionMode({ provider: 'nvidia', model: 'openai/gpt-oss-20b' })).toBe('ocr');
  });
});

describe('selectVisionImages', () => {
  it('prefers hosted URLs over inline base64', () => {
    const attachments = collectAttachments([DATA_URL], [HOSTED]);
    expect(selectVisionImages(attachments, undefined)).toEqual([HOSTED]);
  });

  it('uses base64 when an upload failed and the hosted list is short', () => {
    // Sending only the survivors would silently drop an image the user asked
    // about, so the complete inline copy wins.
    const attachments = collectAttachments([DATA_URL, DATA_URL], [HOSTED]);
    expect(selectVisionImages(attachments, undefined)).toEqual([DATA_URL, DATA_URL]);
  });

  it('honours an explicit base64 transport', () => {
    const attachments = collectAttachments([DATA_URL], [HOSTED]);
    expect(selectVisionImages(attachments, 'base64')).toEqual([DATA_URL]);
  });
});

describe('applyNativeVision', () => {
  it('turns the user turn into text plus image parts', () => {
    const messages = applyNativeVision(userTurn('what is this?'), 1, [HOSTED]);
    const parts = messages[1].content as ProviderContentPart[];

    expect(Array.isArray(parts)).toBe(true);
    expect(parts[0].type).toBe('text');
    expect(String(parts[0].text)).toContain('what is this?');
    expect(parts[1]).toEqual({ type: 'image_url', image_url: { url: HOSTED } });
    // Other turns are untouched.
    expect(messages[0].content).toBe('system prompt');
  });

  it('drops the images-only placeholder from the text part', () => {
    const messages = applyNativeVision(userTurn('[Image message]'), 1, [HOSTED]);
    const parts = messages[1].content as ProviderContentPart[];
    expect(String(parts[0].text)).not.toContain('[Image message]');
  });
});

describe('applyOcrVision', () => {
  it('splices the transcription into the user turn', () => {
    const messages = applyOcrVision(userTurn('read this'), 1, 1, 'HELLO WORLD');
    expect(messages[1].content).toContain('HELLO WORLD');
    expect(messages[1].content).toContain('read this');
  });

  it('says so plainly when the transcription failed', () => {
    const messages = applyOcrVision(userTurn('read this'), 1, 1, null);
    expect(messages[1].content).toContain('extraction failed');
  });
});

describe('chainIsAllNative', () => {
  it('is true only when no hop on the chain can fall back to text', () => {
    // PRO: every hop is K3, so nothing catches a bad endpoint assumption.
    expect(chainIsAllNative([
      { provider: 'nvidia', model: 'moonshotai/kimi-k3' },
      { provider: 'eaon', model: 'logfare/kimi-k3' },
    ])).toBe(true);

    // Air: the fallbacks are text-only, so the chain heals itself.
    expect(chainIsAllNative([
      { provider: 'groq', model: 'qwen/qwen3.6-27b' },
      { provider: 'eaon', model: 'glm-5.2-extended' },
    ])).toBe(false);

    expect(chainIsAllNative([])).toBe(false);
  });
});

describe('createVisionAdapter', () => {
  it('sends the image to a native hop without transcribing', async () => {
    const extractText = vi.fn().mockResolvedValue('transcribed');
    const adapt = createVisionAdapter({
      attachments: attachmentsFrom([HOSTED]),
      imageIndex: 1,
      extractText,
    });

    const out = await adapt({ provider: 'groq', model: 'qwen/qwen3.6-27b' }, userTurn('hi'));

    expect(extractText).not.toHaveBeenCalled();
    expect(Array.isArray(out[1].content)).toBe(true);
  });

  it('transcribes once for a chain of text-only hops', async () => {
    const extractText = vi.fn().mockResolvedValue('transcribed');
    const adapt = createVisionAdapter({
      attachments: attachmentsFrom([HOSTED]),
      imageIndex: 1,
      extractText,
    });

    const hops: VisionHop[] = [
      { provider: 'eaon', model: 'glm-5.2-extended' },
      { provider: 'nvidia', model: 'openai/gpt-oss-20b' },
    ];
    const first = await adapt(hops[0], userTurn('hi'));
    const second = await adapt(hops[1], userTurn('hi'));

    expect(extractText).toHaveBeenCalledTimes(1);
    expect(first[1].content).toContain('transcribed');
    expect(second[1].content).toContain('transcribed');
  });

  it('only transcribes when the run actually falls through to a text-only hop', async () => {
    const extractText = vi.fn().mockResolvedValue('transcribed');
    const adapt = createVisionAdapter({
      attachments: attachmentsFrom([HOSTED]),
      imageIndex: 1,
      extractText,
    });

    await adapt({ provider: 'groq', model: 'qwen/qwen3.6-27b' }, userTurn('hi'));
    expect(extractText).not.toHaveBeenCalled();

    const fallback = await adapt({ provider: 'eaon', model: 'glm-5.2-extended' }, userTurn('hi'));
    expect(extractText).toHaveBeenCalledTimes(1);
    expect(fallback[1].content).toContain('transcribed');
  });

  it('degrades rather than throwing when the transcriber fails', async () => {
    const extractText = vi.fn().mockRejectedValue(new Error('upstream down'));
    const adapt = createVisionAdapter({
      attachments: attachmentsFrom([HOSTED]),
      imageIndex: 1,
      extractText,
    });

    const out = await adapt({ provider: 'eaon', model: 'glm-5.2-extended' }, userTurn('hi'));
    expect(out[1].content).toContain('extraction failed');
  });

  it('transcribes for a native hop when the caller forces it', async () => {
    // The backstop after an all-native chain has failed outright: the same hop
    // is walked again, this time with text instead of image parts.
    const extractText = vi.fn().mockResolvedValue('transcribed');
    const adapt = createVisionAdapter({
      attachments: attachmentsFrom([HOSTED]),
      imageIndex: 1,
      extractText,
    });

    const hop: VisionHop = { provider: 'nvidia', model: 'moonshotai/kimi-k3' };
    const native = await adapt(hop, userTurn('hi'));
    expect(Array.isArray(native[1].content)).toBe(true);

    const forced = await adapt(hop, userTurn('hi'), { forceOcr: true });
    expect(extractText).toHaveBeenCalledTimes(1);
    expect(forced[1].content).toContain('transcribed');
  });

  it('adapts the captured image index, not the last message', async () => {
    // The agent loop appends assistant and tool turns after the user's, so
    // "the last message" stops being the one holding the images.
    const adapt = createVisionAdapter({
      attachments: attachmentsFrom([HOSTED]),
      imageIndex: 1,
      extractText: vi.fn().mockResolvedValue('transcribed'),
    });

    const withToolTurns: ProviderMessage[] = [
      ...userTurn('hi'),
      { role: 'assistant', content: null },
      { role: 'tool', content: 'tool result', tool_call_id: 'call_1' },
    ];

    const out = await adapt({ provider: 'groq', model: 'qwen/qwen3.6-27b' }, withToolTurns);
    expect(Array.isArray(out[1].content)).toBe(true);
    expect(out[3].content).toBe('tool result');
  });
});
