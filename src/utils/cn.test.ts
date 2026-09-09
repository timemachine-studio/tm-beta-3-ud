import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('resolves Tailwind 4 utility conflicts with the last class winning', () => {
    expect(cn(
      'bg-linear-to-r shadow-xs rounded-xs blur-xs backdrop-blur-xs',
      'bg-linear-to-b shadow-sm rounded-sm blur-sm backdrop-blur-sm',
    )).toBe('bg-linear-to-b shadow-sm rounded-sm blur-sm backdrop-blur-sm');
  });

  // The app pins every gradient to sRGB interpolation, so the merge has to keep
  // treating the modified utilities as the same conflict group.
  it('still resolves gradient conflicts when an interpolation modifier is set', () => {
    expect(cn('bg-linear-to-r/srgb', 'bg-linear-to-b/srgb')).toBe('bg-linear-to-b/srgb');
    expect(cn('bg-linear-to-r', 'bg-linear-to-b/srgb')).toBe('bg-linear-to-b/srgb');
    expect(cn('bg-linear-to-r/srgb', 'bg-linear-to-b')).toBe('bg-linear-to-b');
  });
});
