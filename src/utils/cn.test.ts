import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('resolves Tailwind 4 utility conflicts with the last class winning', () => {
    expect(cn(
      'bg-linear-to-r shadow-xs rounded-xs blur-xs backdrop-blur-xs',
      'bg-linear-to-b shadow-sm rounded-sm blur-sm backdrop-blur-sm',
    )).toBe('bg-linear-to-b shadow-sm rounded-sm blur-sm backdrop-blur-sm');
  });
});
