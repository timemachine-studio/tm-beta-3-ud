/**
 * Stop prices from being read as maths.
 *
 * `remark-math` is configured with single-dollar inline maths on purpose, and
 * `markdownRendering.test.tsx` asserts it — `$x^2 + y^2$` is meant to render.
 * The cost is that any answer containing two prices turns everything between
 * them into italic LaTeX: "Total: **$426.00** (3 chairs @ $45, 1 desk @ $220)"
 * came out as a wall of mathematical italics with the numbers scrambled.
 * Generated invoices made that common enough to matter.
 *
 * Turning single-dollar maths off would have fixed it and broken the thing the
 * existing test protects. So the narrower rule: a `$` immediately followed by a
 * digit is a price, and is escaped. What survives untouched:
 *
 *  - `$x^2$`, `$\theta$` — inline maths, which starts with a symbol
 *  - `$$…$$` — display maths, guarded explicitly so `$$3x$$` still works
 *  - anything inside a code fence or backticks, where a literal `\$` would be
 *    a visible bug rather than a fix
 *
 * What it does break is inline maths that starts with a bare digit — `$3x$`.
 * That is rarer in a chat app than a price, and it is the whole trade.
 */

const isDigit = (character: string | undefined) => !!character && character >= '0' && character <= '9';

export function escapeCurrencyAmounts(markdown: string): string {
  if (!markdown.includes('$')) return markdown;

  let out = '';
  let index = 0;
  /** Length of the backtick run that opened the current code span, or 0. */
  let codeRun = 0;

  while (index < markdown.length) {
    const character = markdown[index];

    if (character === '`') {
      let run = 0;
      while (markdown[index + run] === '`') run++;
      // A run of the same length closes the span it opened; a different length
      // inside one is ordinary text, which is how ``a ` b`` works.
      if (codeRun === 0) codeRun = run;
      else if (codeRun === run) codeRun = 0;
      out += markdown.slice(index, index + run);
      index += run;
      continue;
    }

    if (
      codeRun === 0
      && character === '$'
      && isDigit(markdown[index + 1])
      && markdown[index - 1] !== '$'
      && markdown[index - 1] !== '\\'
      && markdown[index + 1] !== undefined
    ) {
      out += '\\$';
      index++;
      continue;
    }

    out += character;
    index++;
  }

  return out;
}
