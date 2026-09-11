/**
 * What publishing a tool came to, and how to say so.
 *
 * Its own module so the device-tool runner can phrase the outcome without
 * importing the Supabase client — that import is deferred until a tool is
 * actually being published.
 */

export type PublishResult =
  | { published: true; id: string; version: number; /** An identical tool already existed. */ reused: boolean }
  | { published: false; reason: 'anonymous' | 'slug_taken' | 'rate_limited' | 'unavailable'; detail?: string };

/** What the model is told, in one line, about where the tool ended up. */
export function describePublish(result: PublishResult): string {
  if (result.published) {
    return result.reused
      ? 'An identical tool was already in the shared registry, so that one is reused.'
      : 'It is published to the shared TimeMachine registry, so other users can call it too.';
  }
  switch (result.reason) {
    case 'anonymous':
      return 'It is available in this conversation only — the user is not signed in, so it was not published for others.';
    case 'slug_taken':
      return 'It works in this conversation, but that slug already belongs to another user\'s tool in the shared registry, so it was not published. To share it, create it again with a different slug.';
    case 'rate_limited':
      return 'It works in this conversation, but was not published: too many tools were published from this account in the last hour.';
    default:
      return 'It works in this conversation, but the shared registry could not be reached, so it was not published.';
  }
}
