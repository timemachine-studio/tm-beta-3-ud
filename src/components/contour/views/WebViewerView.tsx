import type { AccentTheme } from './shared';
import React, { useState, useEffect } from 'react';
import { Globe, ExternalLink, Loader2, Search, AlertCircle } from 'lucide-react';
import { ModuleData } from '../moduleRegistry';
import { searchWeb, type WebSearchResult } from '../../../services/search/webSearchService';

/** Results list for a search query — see webSearchService for why we render our own. */
function SearchResults({ query }: { query: string }) {
    const [response, setResponse] = useState<{
        query: string;
        results: WebSearchResult[] | null;
        error: string | null;
    } | null>(null);
    const currentResponse = response?.query === query ? response : null;
    const results = currentResponse?.results ?? null;
    const error = currentResponse?.error ?? null;

    useEffect(() => {
        let cancelled = false;
        // Same 800ms debounce the iframe used: this fires while the user types.
        const timer = setTimeout(() => {
            searchWeb(query)
                .then((items) => { if (!cancelled) setResponse({ query, results: items, error: null }); })
                .catch((err: Error) => { if (!cancelled) setResponse({ query, results: null, error: err.message }); });
        }, 800);

        return () => { cancelled = true; clearTimeout(timer); };
    }, [query]);

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 h-full text-black/50 px-6 text-center">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm font-medium">{error}</span>
            </div>
        );
    }

    if (!results) {
        return (
            <div className="flex flex-col items-center gap-2 opacity-50">
                <Loader2 className="w-6 h-6 animate-spin text-black" />
                <span className="text-sm font-medium text-black">Searching...</span>
            </div>
        );
    }

    if (!results.length) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 h-full text-black/50">
                <Search className="w-5 h-5" />
                <span className="text-sm font-medium">No results for "{query}"</span>
            </div>
        );
    }

    return (
        <div className="absolute inset-0 overflow-y-auto p-4 space-y-3">
            {results.map((result) => (
                <a
                    key={result.url}
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg p-3 hover:bg-black/5 transition-colors group"
                >
                    <div className="text-[13px] font-semibold text-blue-700 group-hover:underline truncate">
                        {result.title}
                    </div>
                    <div className="text-[11px] text-green-800/70 truncate mt-0.5">{result.url}</div>
                    {result.snippet && (
                        <p className="text-xs text-black/65 mt-1 line-clamp-3">{result.snippet}</p>
                    )}
                </a>
            ))}
        </div>
    );
}

export function WebViewerView({
    module,
}: {
    module: ModuleData;
    accent: AccentTheme;
}) {
    const web = module.webViewer;
    const [loadedUrl, setLoadedUrl] = useState('');
    // Initialize to empty string so the very first trigger waits the 800ms debounce
    const [debouncedUrl, setDebouncedUrl] = useState('');

    // A query means "search"; its `url` is only ever used by the open-in-new-tab
    // link, where Google works fine — it is framing that is blocked.
    const isSearch = Boolean(web?.query);
    const detectedUrl = web?.url;

    useEffect(() => {
        if (!detectedUrl || isSearch) return;
        const timer = setTimeout(() => {
            setDebouncedUrl(detectedUrl);
        }, 800);
        return () => clearTimeout(timer);
    }, [detectedUrl, isSearch]);

    if (!web) return null;
    const loading = !isSearch && Boolean(debouncedUrl) && loadedUrl !== debouncedUrl;

    return (
        <div className="flex flex-col h-full w-full">
            {/* Header bar */}
            <div className="px-4 py-2 flex items-center justify-between bg-black/20 border-b border-white/5">
                <div className="flex items-center gap-2 min-w-0">
                    {isSearch
                        ? <Search className="w-4 h-4 text-white/50 shrink-0" />
                        : <Globe className="w-4 h-4 text-white/50 shrink-0" />}
                    <span className="text-xs font-medium text-white/70 truncate">
                        {web.query ? `Searching: ${web.query}` : web.url}
                    </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {!isSearch && loading && <Loader2 className="w-3.5 h-3.5 text-white/30 animate-spin" />}
                    <a
                        href={web.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 hover:bg-white/10 rounded-md text-white/40 hover:text-white transition-colors"
                        title="Open in new tab"
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                </div>
            </div>

            {/* Browser Canvas */}
            <div className="w-full bg-white relative flex-1 flex items-center justify-center" style={{ minHeight: '350px' }}>
                {/*
                    The iframe below deliberately omits allow-same-origin. Sites
                    embedded here render fine without it, and keeping it meant any
                    URL that resolved back to our own origin got a scripted frame
                    with full access to the Supabase session in localStorage.
                    toSafeExternalUrl now guarantees an absolute http(s) URL; this
                    is the second lock on the same door. See production-check.md 0.6.
                */}
                {isSearch ? (
                    <SearchResults query={web.query as string} />
                ) : debouncedUrl ? (
                    <iframe
                        src={debouncedUrl}
                        className="absolute inset-0 w-full h-full border-none"
                        sandbox="allow-scripts allow-forms allow-popups"
                        onLoad={() => setLoadedUrl(debouncedUrl)}
                        title="Web Viewer"
                    />
                ) : (
                    <div className="flex flex-col items-center gap-2 opacity-50">
                        <Loader2 className="w-6 h-6 animate-spin text-black" />
                        <span className="text-sm font-medium text-black">Waiting for input...</span>
                    </div>
                )}
            </div>
        </div>
    );
}
