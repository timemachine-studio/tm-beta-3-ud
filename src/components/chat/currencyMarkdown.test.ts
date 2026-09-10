import { describe, expect, it } from 'vitest';
import { escapeCurrencyAmounts } from './currencyMarkdown';

describe('prices in an answer', () => {
  it('stops two prices turning the words between them into maths', () => {
    // The live failure, from a generated invoice: everything from the first $
    // to the second rendered as italic LaTeX with the digits rearranged.
    const escaped = escapeCurrencyAmounts('Total: **$426.00** (3 chairs @ $45, 1 desk @ $220)');
    expect(escaped).toBe('Total: **\\$426.00** (3 chairs @ \\$45, 1 desk @ \\$220)');
  });

  it('leaves inline maths alone, which is what the dollar syntax is for', () => {
    const source = 'The equation is $x^2 + y^2$ and $\\theta$ is the angle.';
    expect(escapeCurrencyAmounts(source)).toBe(source);
  });

  it('leaves display maths alone even when it starts with a number', () => {
    const source = 'Here: $$3x + 2 = 11$$';
    expect(escapeCurrencyAmounts(source)).toBe(source);
  });

  it('does not touch code, where a backslash would be a visible bug', () => {
    const source = 'Run `echo $50` or:\n\n```bash\nPRICE=$99\necho $PRICE\n```\n';
    expect(escapeCurrencyAmounts(source)).toBe(source);
  });

  it('escapes prices again once the code block has closed', () => {
    const escaped = escapeCurrencyAmounts('```\nx = $1\n```\nThat cost $5 and $6.');
    expect(escaped).toContain('x = $1');
    expect(escaped).toContain('\\$5 and \\$6');
  });

  it('leaves text with no dollars in it untouched', () => {
    expect(escapeCurrencyAmounts('nothing to do here')).toBe('nothing to do here');
  });
});
