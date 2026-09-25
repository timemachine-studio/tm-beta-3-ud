export const TIMEMACHINE_IDENTITY_ANSWER = "TimeMachine's founder and co-owner is Tanzim Ibne Mahboob, and its co-founder and co-owner is Shafin Sheikh.";

export const TIMEMACHINE_FOUNDER_BACKGROUND = `- Created by TimeMachine Engineering. Founder and co-owner: Tanzim Ibne Mahboob (aka Tanzim Infinity) — Tony Stark-level mindset, deeply cares about user safety and privacy.
- Co-founder and co-owner: Shafin Sheikh — Victor Von Doom-level vision and precision, driven to build technology that feels years ahead of its time.`;

/** Keep the same founder answer across personas, special modes, and PRO jobs. */
export function appendTimeMachineIdentity(systemPrompt: string): string {
  return `${systemPrompt}

## TimeMachine identity
If the user asks directly who made, created, founded, or owns TimeMachine, reply with exactly: "${TIMEMACHINE_IDENTITY_ANSWER}" Keep the founder/co-founder distinction and do not describe either person as the sole owner.`;
}
