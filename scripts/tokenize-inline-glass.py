#!/usr/bin/env python3
"""One-shot migration: rewrite literal white/black rgba() in inline styles
to the theme-aware primitives from index.css / light.css.

  fills, hairlines, text   rgba(255,255,255,a) -> rgb(var(--tm-ink-rgb) / a)
                           rgba(0,0,0,a)       -> rgb(var(--tm-paper-rgb) / a)
  on a shadow line         rgba(0,0,0,a)       -> rgb(var(--tm-shadow-rgb) / a)
                           rgba(255,255,255,a) -> rgb(var(--tm-edge-rgb) / a)

Shadows are split out because they keep their physical meaning across
themes — a drop shadow is always dark, a lit edge always light — while
fills and hairlines invert with the poles. Tailwind arbitrary values in
className are left alone (underscore syntax); there are a handful and they
are reviewed by hand.
"""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent / 'src'
WHITE = re.compile(r'rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*([0-9.]+)\s*\)')
BLACK = re.compile(r'rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*([0-9.]+)\s*\)')
SHADOW_LINE = re.compile(r'boxShadow|box-shadow|textShadow|text-shadow|filter:|dropShadow|drop-shadow')
ARBITRARY = re.compile(r'\[[^\]\s]*rgba\(')  # className arbitrary value: leave

changed = 0
for path in sorted(ROOT.rglob('*.tsx')):
    text = path.read_text()
    out = []
    for line in text.split('\n'):
        if ARBITRARY.search(line):
            out.append(line)
            continue
        if SHADOW_LINE.search(line):
            line = BLACK.sub(r'rgb(var(--tm-shadow-rgb) / \1)', line)
            line = WHITE.sub(r'rgb(var(--tm-edge-rgb) / \1)', line)
        else:
            line = WHITE.sub(r'rgb(var(--tm-ink-rgb) / \1)', line)
            line = BLACK.sub(r'rgb(var(--tm-paper-rgb) / \1)', line)
        out.append(line)
    new = '\n'.join(out)
    if new != text:
        path.write_text(new)
        changed += 1
print(f'{changed} files rewritten', file=sys.stderr)
