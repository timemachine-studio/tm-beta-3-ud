import type { LoadingPhase } from '../../types/chat';

/** The user-facing label for a retry, tool status, or other loading phase. */
export function loadingLabel(phase: LoadingPhase | undefined): string {
  if (phase === 'analyzing_photo') return 'Analyzing photo...';
  if (typeof phase === 'string' && phase.startsWith('retrying:')) {
    const [n, of] = phase.slice('retrying:'.length).split('/');
    return `Retrying · ${n} of ${of}`;
  }
  if (!phase || phase === 'thinking') return 'Thinking';
  return [...phase].filter(character => {
    const code = character.charCodeAt(0);
    return code >= 32 && code !== 127;
  }).join('').slice(0, 120) || 'Working';
}
