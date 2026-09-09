import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { describe, expect, it } from 'vitest';
import { isMarkdownCodeComplete } from './markdownRuntime';

describe('AI markdown rendering', () => {
  it('preserves typography wrappers and renders KaTeX markup', () => {
    const html = renderToStaticMarkup(
      <div className="prose prose-invert prose-sm max-w-none">
        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
          {'## Result\n\nThe equation is $x^2 + y^2$.'}
        </ReactMarkdown>
      </div>,
    );

    expect(html).toContain('class="prose prose-invert prose-sm max-w-none"');
    expect(html).toContain('<h2>Result</h2>');
    expect(html).toContain('class="katex"');
    expect(html).toContain('x^2 + y^2');
  });
});

describe('streaming code blocks', () => {
  it('marks code complete only after its closing fence arrives', () => {
    expect(isMarkdownCodeComplete('```ts\nconst value = 1', 'const value = 1', true)).toBe(false);
    expect(isMarkdownCodeComplete('```ts\nconst value = 1\n```', 'const value = 1', true)).toBe(true);
  });

  it('treats non-streaming code as complete', () => {
    expect(isMarkdownCodeComplete('', 'missing from content', false)).toBe(true);
  });
});
