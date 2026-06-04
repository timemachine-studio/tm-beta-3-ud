/**
 * TimeMachine Contour - Web Viewer Module
 * Parses `/web`, `/search`, `/google` commands and raw URLs to display an iframe.
 */

export interface WebViewerResult {
    url: string;
    query?: string;
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
        // If it doesn't have a protocol, prepend https://
        const finalUrl = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
        return { url: finalUrl };
    }

    return null;
}
