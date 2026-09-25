import { describe, expect, it } from 'vitest';
import { appendTimeMachineIdentity, TIMEMACHINE_FOUNDER_BACKGROUND, TIMEMACHINE_IDENTITY_ANSWER } from './brandIdentity.js';

describe('TimeMachine founder identity', () => {
  it('uses the approved answer for every prompt surface', () => {
    expect(TIMEMACHINE_IDENTITY_ANSWER).toBe("TimeMachine's founder and co-owner is Tanzim Ibne Mahboob, and its co-founder and co-owner is Shafin Sheikh.");
    expect(TIMEMACHINE_FOUNDER_BACKGROUND).toContain('Tony Stark-level mindset');
    expect(TIMEMACHINE_FOUNDER_BACKGROUND).toContain('Victor Von Doom-level vision and precision');
    const prompt = appendTimeMachineIdentity('Persona or special-mode instructions');
    expect(prompt).toContain('Persona or special-mode instructions');
    expect(prompt).toContain(`reply with exactly: "${TIMEMACHINE_IDENTITY_ANSWER}"`);
    expect(prompt).toContain('who made, created, founded, or owns TimeMachine');
  });
});
