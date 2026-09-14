/**
 * The Preview tab: whatever previewController is showing, plus its console.
 *
 * HTML previews are `srcdoc` in a sandbox with no allow-same-origin — the
 * rule for every iframe in the app (CLAUDE.md 0.6). Dev-server previews are
 * a URL on the runtime's own origin.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Maximize2, Minimize2, Play, RefreshCw } from 'lucide-react';
import { PREVIEW_SANDBOX, previewController, type PreviewTarget } from '../../services/workspace/previewController';
import { nodeRuntime, nodeRuntimeSupported } from '../../services/workspace/nodeRuntime';
import { toSafeExternalUrl } from '../contour/modules/webViewer';
import { GlassPill } from './glass';

interface PreviewPaneProps {
  sessionId: string;
}

export function PreviewPane({ sessionId }: PreviewPaneProps) {
  const [target, setTarget] = useState<PreviewTarget | null>(previewController.current());
  const [log, setLog] = useState<readonly string[]>(previewController.consoleLog());
  // Closed by default; the log is the controller's, so it is all still
  // there when the console is opened later.
  const [showConsole, setShowConsole] = useState(false);
  const [restart, setRestart] = useState<{ phase: string } | { error: string } | null>(null);
  // Full screen is the pane portalled to <body> over everything, not the
  // Fullscreen API: that needs a gesture the browser trusts, prompts in
  // some, and never settles in an embedded view. Portalled, because the
  // card's backdrop-filter makes it the containing block for anything
  // `fixed` inside it — an overlay rendered in place would only fill the
  // card. "Open in a new tab" is not an option: the runtime's preview origin
  // only exists inside this isolated page.
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => previewController.subscribe((next, nextLog) => {
    setTarget(next);
    setLog([...nextLog]);
  }), []);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setFullscreen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  if (!target) {
    return (
      <div className="h-full flex items-center justify-center p-6 text-center text-sm text-white/40 leading-relaxed">
        Nothing to preview yet. In Auto mode PRO opens a preview when it has something to show; you can also ask for one.
      </div>
    );
  }

  if (target.kind === 'stale') {
    const command = target.command;
    const phase = restart !== null && 'phase' in restart ? restart.phase : null;
    const start = async () => {
      setRestart({ phase: 'Starting' });
      try {
        const result = await nodeRuntime().restartServer(sessionId, command, { timeoutMs: 90_000, onPhase: phase => setRestart({ phase }) });
        if (!result.url) setRestart({ error: 'The server did not start listening. The Terminal tab has its output.' });
        else setRestart(null);
      } catch (cause) {
        setRestart({ error: cause instanceof Error ? cause.message : 'The server could not be started.' });
      }
    };
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6 text-center text-sm text-white/50 leading-relaxed">
        <p>
          The preview was <code className="font-mono text-white/70">{command}</code>. The runtime it ran in went away with the page, so it needs starting again.
        </p>
        {nodeRuntimeSupported() ? (
          <GlassPill tone="accent" onClick={start} disabled={phase !== null} className="h-9 px-4 text-sm">
            {phase !== null ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {phase ?? 'Start it again'}
          </GlassPill>
        ) : (
          <p className="text-xs text-white/40">This browser cannot run the Node runtime, so the server cannot be started here.</p>
        )}
        {restart !== null && 'error' in restart && <p className="text-xs text-rose-300">{restart.error}</p>}
        <p className="text-xs text-white/35">Or run it yourself in the Terminal tab — a server started there shows up here too.</p>
      </div>
    );
  }

  const url = target.kind === 'url' ? toSafeExternalUrl(target.url) : null;

  const pane = (
    <div className={`flex flex-col min-h-0 ${fullscreen ? 'fixed inset-0 z-[90] bg-black' : 'h-full'}`}>
      <div className="flex items-center gap-2 px-3 py-2 text-xs">
        {target.kind === 'html' && (
          <GlassPill onClick={() => { previewController.refresh().catch(() => undefined); }} className="h-7 w-7" aria-label="Reload preview" title="Reload preview">
            <RefreshCw className="w-3.5 h-3.5" />
          </GlassPill>
        )}
        <GlassPill onClick={() => setFullscreen(value => !value)} className="h-7 w-7" aria-label={fullscreen ? 'Leave full screen' : 'Full screen'} title={fullscreen ? 'Leave full screen' : 'Full screen'}>
          {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </GlassPill>
        <div className="flex-1" />
        <GlassPill active={showConsole} onClick={() => setShowConsole(value => !value)} className="h-7 px-3" aria-pressed={showConsole}>
          Console{log.length > 0 ? ` (${log.length})` : ''}
        </GlassPill>
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
        <div className="h-32 shrink-0 border-t border-white/[0.06] overflow-y-auto font-mono text-[11px] leading-5 px-3 py-1">
          {log.length === 0
            ? <div className="text-white/30">Console is empty.</div>
            : log.map((line, index) => (
              <div key={index} className={line.startsWith('[error]') ? 'text-rose-300' : line.startsWith('[warn]') ? 'text-amber-200' : 'text-white/60'}>{line}</div>
            ))}
        </div>
      )}
    </div>
  );

  return fullscreen ? createPortal(pane, document.body) : pane;
}
