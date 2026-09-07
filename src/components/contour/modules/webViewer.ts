/**
 * TimeMachine Contour - Web Viewer Module
 * Parses `/web`, `/search`, `/google` commands and raw URLs to display an iframe.
 */

export interface WebViewerResult {
    url: string;
    query?: string;
}

/**
 * Turn user input into an absolute http(s) URL, or null.
 *
 * `startsWith('http')` is not a scheme check — it also matches `httpfoo.com`,
 * which was then used as an iframe `src` verbatim and resolved *relative to our
 * own origin*. Framing our own origin with `allow-scripts` is exactly the
 * escape production-check.md 0.6 is about, so the scheme is settled here rather
 * than by a prefix test.
 */
export function toSafeExternalUrl(input: string): string | null {
    const trimmed = input.trim();
    if (!trimmed) return null;

    const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;

    let parsed: URL;
    try {
        parsed = new URL(candidate);
    } catch {
        return null;
    }

    // Anything else — javascript:, data:, blob:, file: — never reaches an iframe.
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (!parsed.hostname) return null;

    return parsed.href;
}

export function detectWebViewer(input: string): WebViewerResult | null {
    const trimmed = input.trim();

    // 1. Explicit Search Commands
    // "what is " or "whats " shortcut
    const whatIsMatch = trimmed.match(/^(?:what\s+is|whats|what's)\s+(.+)$/i);
    if (whatIsMatch) {
        const query = trimmed; // the whole question
        return {
            url: `https://www.google.com/search?q=${encodeURIComponent(query)}&igu=1`,
            query
        };
    }

    // Explicit search commands (/search, /google, /web)
    const searchMatch = trimmed.match(/^\/(?:web|search|google)\s+(.+)$/i);
    if (searchMatch) {
        const query = searchMatch[1].trim();
        return {
            url: `https://www.google.com/search?q=${encodeURIComponent(query)}&igu=1`,
            query
        };
    }

    // 2. Raw URL Detection (very permissive for quick entry)
    // Check if it looks like a domain name (e.g., apple.com, www.github.com, https://news.ycombinator.com)
    const urlPattern = /^(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,})(?:\/.*)?$/i;
    const urlMatch = trimmed.match(urlPattern);

    if (urlMatch) {
        const finalUrl = toSafeExternalUrl(trimmed);
        return finalUrl ? { url: finalUrl } : null;
    }

    return null;
}
