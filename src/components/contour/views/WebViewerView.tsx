import React, { useState, useEffect } from 'react';
import { Globe, ExternalLink, Loader2 } from 'lucide-react';
import { ModuleData } from '../moduleRegistry';

export function WebViewerView({
    module,
}: {
    module: ModuleData;
    accent: any;
}) {
    const web = module.webViewer;
    const [loading, setLoading] = useState(true);
    // Initialize to empty string so the very first trigger waits the 800ms debounce
    const [debouncedUrl, setDebouncedUrl] = useState('');

    useEffect(() => {
        if (!web) return;
        setLoading(true);
        const timer = setTimeout(() => {
            setDebouncedUrl(web.url);
        }, 800);
        return () => clearTimeout(timer);
    }, [web?.url]);

    if (!web) return null;

    return (
        <div className="flex flex-col h-full w-full">
            {/* Header bar */}
            <div className="px-4 py-2 flex items-center justify-between bg-black/20 border-b border-white/5">
                <div className="flex items-center gap-2 min-w-0">
                    <Globe className="w-4 h-4 text-white/50 shrink-0" />
                    <span className="text-xs font-medium text-white/70 truncate">
                        {web.query ? `Searching: ${web.query}` : web.url}
                    </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {loading && <Loader2 className="w-3.5 h-3.5 text-white/30 animate-spin" />}
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
                {debouncedUrl ? (
                    <iframe
                        src={debouncedUrl}
                        className="absolute inset-0 w-full h-full border-none"
                        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                        onLoad={() => setLoading(false)}
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
