/**
 * Who sees the landing page at "/".
 *
 * The rule is the one claude.ai uses: a signed-in person never sees marketing
 * at the root, they get the product. A signed-out person sees the landing
 * page only until they step into the app — after that "/" is the chat for
 * them too, because the anonymous trial is a real use of the product and
 * every "Back" button in the app points at "/". Bouncing a trial user to a
 * hero section mid-session would be a bug, not a funnel.
 *
 * The flag is display-only. Nothing is authorised on it.
 */
const ENTERED_KEY = 'tm_entered';

export function hasEnteredApp(): boolean {
  try {
    return window.localStorage.getItem(ENTERED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markEnteredApp(): void {
  try {
    window.localStorage.setItem(ENTERED_KEY, '1');
  } catch {
    // Private mode with storage blocked: the landing shows again next visit,
    // which is the harmless outcome.
  }
}

/** Router state the landing page hands to MainChatPage when it opens the chat. */
export interface LandingHandoff {
  /** Sent as the first turn the moment the chat mounts. */
  initialPrompt?: string;
  /** Open the sign-in modal on arrival. */
  openAuth?: boolean;
  /** Set on plain "Start chatting" so the root route knows this is an entry. */
  enter?: true;
}
