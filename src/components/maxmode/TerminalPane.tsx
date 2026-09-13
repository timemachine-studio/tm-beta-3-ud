/**
 * The Terminal tab: a shell in the Node runtime, and a log of what the
 * harness ran there.
 *
 * Two things share the terminal. Output from the harness's own commands is
 * echoed here as it happens, so the user can watch `npm test` scroll by, and
 * an interactive `jsh` the user can type into. Files the user changes from
 * the shell are pulled back into the workspace when they press Enter, so
 * the model's next read sees them.
 *
 * Where the runtime cannot boot (no cross-origin isolation — Safari, or a
 * page that was not served from /max), the tab says so rather than hanging.
 */

import { useEffect, useRef, useState } from 'react';
import { nodeRuntime, nodeRuntimeSupported } from '../../services/workspace/nodeRuntime';

interface TerminalPaneProps {
  sessionId: string;
}

export function TerminalPane({ sessionId }: TerminalPaneProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const supported = nodeRuntimeSupported();
  const [state, setState] = useState<'idle' | 'booting' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hostRef.current || !supported) return;
    let disposed = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      const [{ Terminal }, { FitAddon }] = await Promise.all([import('@xterm/xterm'), import('@xterm/addon-fit')]);
      await import('@xterm/xterm/css/xterm.css');
      if (disposed || !hostRef.current) return;

      const terminal = new Terminal({
        convertEol: true,
        cursorBlink: true,
        fontSize: 12,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        theme: { background: '#00000000', foreground: '#e5e7eb', cursor: '#22d3ee' },
        allowTransparency: true,
      });
      const fit = new FitAddon();
      terminal.loadAddon(fit);
      terminal.open(hostRef.current);
      fit.fit();

      // Whatever the harness runs, mirrored here.
      const unsubscribe = nodeRuntime().onOutput((chunk, source) => {
        terminal.write(source === 'system' ? `\x1b[36m${chunk}\x1b[0m` : chunk);
      });

      setState('booting');
      let process: Awaited<ReturnType<ReturnType<typeof nodeRuntime>['spawnShell']>> | null = null;
      try {
        process = await nodeRuntime().spawnShell(sessionId, { cols: terminal.cols, rows: terminal.rows });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'The Node runtime could not start.');
        setState('error');
        unsubscribe();
        return;
      }
      if (disposed) { process.kill(); unsubscribe(); return; }
      setState('ready');

      const writer = process.input.getWriter();
      const onData = terminal.onData((data) => {
        writer.write(data).catch(() => undefined);
        // Enter: the user may have changed files. Pull them in shortly after
        // the command has had a chance to run.
        if (data.includes('\r')) setTimeout(() => nodeRuntime().pullChanges(sessionId).catch(() => undefined), 1_500);
      });
      const reader = process.output.getReader();
      void (async () => {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          terminal.write(value);
        }
      })().catch(() => undefined);

      const observer = new ResizeObserver(() => {
        fit.fit();
        process?.resize({ cols: terminal.cols, rows: terminal.rows });
      });
      observer.observe(hostRef.current);

      cleanup = () => {
        observer.disconnect();
        onData.dispose();
        unsubscribe();
        writer.releaseLock();
        process?.kill();
        terminal.dispose();
      };
    })().catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : 'The terminal could not open.');
      setState('error');
    });

    return () => { disposed = true; cleanup?.(); };
  }, [sessionId, supported]);

  if (!supported) {
    return (
      <div className="h-full flex items-center justify-center p-6 text-center text-sm text-white/40 leading-relaxed">
        This browser cannot run the Node runtime here (it needs cross-origin isolation, which Safari does not offer yet). File editing and previews of plain HTML still work; commands will not.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      {state !== 'ready' && (
        <div className={`px-3 py-1 text-xs border-b border-white/10 ${state === 'error' ? 'text-rose-300' : 'text-white/40'}`}>
          {state === 'error' ? error : 'Starting the Node runtime…'}
        </div>
      )}
      <div ref={hostRef} className="flex-1 min-h-0 p-2" />
    </div>
  );
}
