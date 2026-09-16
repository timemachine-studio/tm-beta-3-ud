/* Proof that this tab arrived through a password-reset link.
 *
 * Supabase announces a reset link exactly once, as a PASSWORD_RECOVERY event
 * on the page that consumes the link's hash, and a session it leaves behind
 * looks like any other. /reset-password must not open its form for any
 * signed-in session — that would let whoever holds an unlocked device change
 * the password without knowing it, which the Account page's old-password
 * check exists to prevent. So the event is recorded here, in this tab only,
 * for a few minutes, and the page opens only against that record (or the
 * event itself). Nothing outside our own code can write it short of running
 * script in the tab, at which point the session is already theirs. */

const KEY = 'tm-password-recovery';
const TTL_MS = 15 * 60 * 1000;

export function markRecovery(): void {
  try { sessionStorage.setItem(KEY, String(Date.now())); } catch { /* private mode: the event itself still opens the page */ }
}

export function hasRecentRecovery(): boolean {
  try {
    const at = Number(sessionStorage.getItem(KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < TTL_MS;
  } catch {
    return false;
  }
}

export function clearRecovery(): void {
  try { sessionStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}
