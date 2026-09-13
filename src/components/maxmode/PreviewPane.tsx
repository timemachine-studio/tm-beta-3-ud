/**
 * The Preview tab: whatever previewController is showing, plus its console.
 *
 * HTML previews are `srcdoc` in a sandbox with no allow-same-origin — the
 * rule for every iframe in the app (CLAUDE.md 0.6). Dev-server previews are
 * a URL on the runtime's own origin.
 */

import { useEffect, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { PREVIEW_SANDBOX, previewController, type PreviewTarget } from '../../services/workspace/previewController';
import { toSafeExternalUrl } from '../contour/modules/webViewer';

export function PreviewPane() {
  const [target, setTarget] = useState<PreviewTarget | null>(previewController.current());
  const [log, setLog] = useState<readonly string[]>(previewController.consoleLog());
  const [showConsole, setShowConsole] = useState(true);

  useEffect(() => previewController.subscribe((next, nextLog) => {
    setTarget(next);
    setLog([...nextLog]);
  }), []);

  if (!target) {
    return (
      <div className="h-full flex items-center justify-center p-6 text-center text-sm text-white/40 leading-relaxed">
        Nothing to preview yet. In Auto mode PRO opens a preview when it has something to show; you can also ask for one.
      </div>
    );
  }

  const url = target.kind === 'url' ? toSafeExternalUrl(target.url) : null;

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/10 text-xs">
        <span className="font-mono text-white/60 truncate flex-1">
          {target.kind === 'html' ? target.path : `${target.command} → ${target.url}`}
        </span>
        {target.kind === 'html' && (
          <button type="button" onClick={() => { previewController.refresh().catch(() => undefined); }} className="p-1 rounded hover:bg-white/10 text-white/60" aria-label="Reload preview">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-white/10 text-white/60" aria-label="Open in a new tab">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
        <button type="button" onClick={() => setShowConsole(value => !value)} className="px-2 py-0.5 rounded hover:bg-white/10 text-white/60">
          Console{log.length > 0 ? ` (${log.length})` : ''}
        </button>
      </div>
      <div className="flex-1 min-h-0 bg-[#fff]">
        {target.kind === 'html' ? (
          <iframe
            key={target.generation}
            title="Preview"
            srcDoc={target.srcdoc}
            ref={frame => previewController.bindFrame(frame?.contentWindow ?? null, target.generation)}
            sandbox={PREVIEW_SANDBOX}
            className="w-full h-full border-0"
          />
        ) : url ? (
          // No sandbox attribute: this document is on the runtime's own
          // origin, not ours, and it needs that origin intact — the preview
          // is served through a service worker there. A sandbox without
          // allow-same-origin would give it an opaque origin and break it;
          // one with it is the pairing 0.6 forbids. An ordinary cross-origin
          // frame is the honest option, and no more than any embed.
          <iframe
            key={target.generation}
            title="Preview"
            src={url}
            onLoad={() => previewController.markLoaded(target.generation)}
            className="w-full h-full border-0"
          />
        ) : (
          <div className="p-4 text-sm text-rose-300">The preview URL was not a safe http(s) address.</div>
        )}
      </div>
      {showConsole && (
        <div className="h-32 shrink-0 border-t border-white/10 overflow-y-auto font-mono text-[11px] leading-5 px-3 py-1">
          {log.length === 0
            ? <div className="text-white/30">Console is empty.</div>
            : log.map((line, index) => (
              <div key={index} className={line.startsWith('[error]') ? 'text-rose-300' : line.startsWith('[warn]') ? 'text-amber-200' : 'text-white/60'}>{line}</div>
            ))}
        </div>
      )}
    </div>
  );
}
