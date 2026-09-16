import { useEffect, useState } from 'react';
import type { PluggableList } from 'unified';

/* KaTeX is a quarter of a megabyte that most conversations never need. The
   math plugins (and KaTeX's stylesheet) load the first time a message
   actually contains a formula; until then, and for every message without
   one, Markdown renders without them. One load per session — the result is
   memoised at module level so every message shares it. */

export interface MathPlugins {
  remark: PluggableList;
  rehype: PluggableList;
}

let loaded: MathPlugins | null = null;
let loading: Promise<MathPlugins> | null = null;

/** Whether the text has anything the math plugins would change. */
export function hasMath(text: string): boolean {
  return /\$[^$\n]+\$|\$\$|\\\(|\\\[/.test(text);
}

export function loadMathPlugins(): Promise<MathPlugins> {
  if (loaded) return Promise.resolve(loaded);
  loading ??= Promise.all([
    import('remark-math'),
    import('rehype-katex'),
    import('katex/dist/katex.min.css'),
  ]).then(([remarkMath, rehypeKatex]) => {
    loaded = { remark: [remarkMath.default], rehype: [rehypeKatex.default] };
    return loaded;
  });
  return loading;
}

/**
 * The math plugins for a piece of Markdown, or null until they are needed
 * and loaded. A message without math never triggers the load.
 */
export function useMathPlugins(text: string): MathPlugins | null {
  const [plugins, setPlugins] = useState<MathPlugins | null>(loaded);
  const needed = hasMath(text);
  useEffect(() => {
    if (!needed || plugins) return;
    let live = true;
    void loadMathPlugins().then((p) => { if (live) setPlugins(p); });
    return () => { live = false; };
  }, [needed, plugins]);
  return needed ? plugins : null;
}
