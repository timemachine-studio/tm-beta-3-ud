import { describe, expect, it } from 'vitest';
import { parseDeterministicTimerIntent } from './deterministicActions';

describe('deterministic timer routing', () => {
  it('recognises high-confidence start requests without stealing ordinary duration talk', () => {
    expect(parseDeterministicTimerIntent('Set a timer for 2 minutes called tea.')).toEqual({ kind: 'start', amount: 2, unit: 'minutes', label: 'tea' });
    expect(parseDeterministicTimerIntent('start countdown 30 secs')).toEqual({ kind: 'start', amount: 30, unit: 'seconds', label: 'Timer' });
    expect(parseDeterministicTimerIntent('the shop is 2 minutes away')).toBeNull();
  });

  it('recognises controls and normalises stop to cancel', () => {
    expect(parseDeterministicTimerIntent('pause the timer')).toEqual({ kind: 'control', action: 'pause' });
    expect(parseDeterministicTimerIntent('stop my countdown')).toEqual({ kind: 'control', action: 'cancel' });
  });
});

