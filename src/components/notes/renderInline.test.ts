import { describe, it, expect } from 'vitest';
import { renderInline } from './renderInline';

// Regression tests for production-check.md 0.5 — stored XSS in Notes.
//
// renderInline's output goes straight into dangerouslySetInnerHTML, and the
// colour tags interpolate a captured group into an HTML *attribute*. Before the
// fix, a value carrying a double quote closed the attribute early and the rest
// became new attributes — including event handlers.
describe('renderInline — XSS', () => {
  it('does not let a colour value break out of the style attribute', () => {
    const payload = '[color:red" onmouseover="alert(document.domain)]hover me[/color]';
    const html = renderInline(payload);

    expect(html).not.toContain('onmouseover');
    expect(html).toBe('<span style="color:inherit">hover me</span>');
  });

  it('does not let a background value break out either', () => {
    const html = renderInline('[bg:blue" onload="alert(1)]x[/bg]');

    expect(html).not.toContain('onload');
    expect(html).toContain('background-color:inherit');
  });

  it('escapes quotes in ordinary text', () => {
    expect(renderInline('say "hi"')).toBe('say &quot;hi&quot;');
    expect(renderInline("it's fine")).toBe('it&#39;s fine');
  });

  it('escapes angle brackets so raw tags cannot be injected', () => {
    expect(renderInline('<img src=x onerror=alert(1)>')).toBe(
      '&lt;img src=x onerror=alert(1)&gt;',
    );
  });

  it('rejects a javascript: url dressed up as a colour', () => {
    expect(renderInline('[color:javascript:alert(1)]x[/color]')).toBe(
      '<span style="color:inherit">x</span>',
    );
  });

  it('rejects a colour value carrying extra CSS declarations', () => {
    const html = renderInline('[color:red;background:url(https://evil.example)]x[/color]');
    expect(html).toBe('<span style="color:inherit">x</span>');
  });
});

describe('renderInline — legitimate formatting still works', () => {
  it('keeps hex colours', () => {
    expect(renderInline('[color:#ff0000]red[/color]')).toBe(
      '<span style="color:#ff0000">red</span>',
    );
  });

  it('keeps named colours', () => {
    expect(renderInline('[color:rebeccapurple]p[/color]')).toBe(
      '<span style="color:rebeccapurple">p</span>',
    );
  });

  it('keeps rgb() and rgba() colours', () => {
    expect(renderInline('[color:rgb(255, 0, 0)]r[/color]')).toBe(
      '<span style="color:rgb(255, 0, 0)">r</span>',
    );
    expect(renderInline('[bg:rgba(0, 0, 0, 0.5)]b[/bg]')).toContain(
      'background-color:rgba(0, 0, 0, 0.5)',
    );
  });

  it('still renders bold, italic, underline and line breaks', () => {
    expect(renderInline('**b**')).toBe('<strong>b</strong>');
    expect(renderInline('*i*')).toBe('<em>i</em>');
    expect(renderInline('__u__')).toBe('<u>u</u>');
    expect(renderInline('a\nb')).toBe('a<br>b');
  });
});
