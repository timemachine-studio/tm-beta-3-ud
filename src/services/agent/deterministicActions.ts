/** Small, high-confidence actions that should not pay a model round trip. */

export type DeterministicTimerIntent =
  | { kind: 'start'; amount: number; unit: 'seconds' | 'minutes' | 'hours'; label: string }
  | { kind: 'control'; action: 'pause' | 'resume' | 'cancel' };

export function parseDeterministicTimerIntent(input: string): DeterministicTimerIntent | null {
  const text = input.trim();
  const control = text.match(/\b(pause|resume|cancel|stop)\b[\s\S]{0,40}\b(timer|countdown)\b/i);
  if (control) {
    const action = control[1].toLowerCase();
    return { kind: 'control', action: action === 'stop' ? 'cancel' : action as 'pause' | 'resume' | 'cancel' };
  }

  const start = text.match(/\b(?:set|start)\s+(?:(?:a|the)\s+)?(?:timer|countdown)\s+(?:for\s+)?(\d+(?:\.\d+)?)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)\b/i);
  if (!start) return null;
  const amount = Number(start[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const rawUnit = start[2].toLowerCase();
  const unit = rawUnit.startsWith('h') ? 'hours' : rawUnit.startsWith('m') ? 'minutes' : 'seconds';
  const called = text.match(/\bcalled\s+(.+?)[.!?]*$/i)?.[1]?.trim();
  return { kind: 'start', amount, unit, label: called?.slice(0, 80) || 'Timer' };
}

