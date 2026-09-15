import { supabase } from '../../lib/supabase';

/**
 * Fetch a media URL from our own API with the user's bearer token.
 *
 * `<img src>` and `<audio src>` cannot send Authorization, and the server no
 * longer admits media requests on header heuristics (pre-launch-audit.md A.2).
 * Generated-image URLs are signed by the server and load directly; music and
 * cover URLs are built in the browser, so they authenticate this way and are
 * shown through an object URL. One fetch, one generation — the blob is what
 * gets displayed, uploaded and downloaded.
 */
export async function fetchAuthorizedMedia(url: string): Promise<Blob> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new Error(response.status === 401 ? 'Sign in to generate media' : `Media request failed (${response.status})`);
  }
  return response.blob();
}
