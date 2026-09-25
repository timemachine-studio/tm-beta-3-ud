import { BrainCircuit, Check, Download, HardDrive, LoaderCircle, Trash2, WifiOff } from 'lucide-react';
import { CONTOUR_EXTENDED_DOWNLOAD_BYTES } from '../../services/contour/extendedManifest';
import { useContourExtended } from '../../services/contour/useContourExtended';

const card = {
  background: 'rgb(var(--tm-ink-rgb) / 0.04)',
  border: '1px solid rgb(var(--tm-ink-rgb) / 0.1)',
  boxShadow: 'inset 0 1px 0 rgb(var(--tm-edge-rgb) / 0.15)',
} as const;

function formatBytes(value: number): string {
  return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)} MB`;
}

export function ContourExtendedSettings() {
  const extended = useContourExtended();
  const installed = extended.phase === 'ready' || extended.phase === 'loading' || extended.phase === 'active';
  const busy = extended.phase === 'downloading' || extended.phase === 'loading';
  const status = extended.phase === 'active'
    ? 'Active on this device'
    : extended.phase === 'loading'
      ? 'Starting local model…'
      : extended.phase === 'ready'
        ? 'Downloaded and ready'
        : extended.phase === 'downloading'
          ? `Downloading ${Math.round(extended.progress * 100)}%`
          : extended.phase === 'unsupported'
            ? 'Not supported in this browser'
            : 'Optional local understanding';

  return (
    <section>
      <p className="tm-display mb-3 text-[1.625rem] italic leading-tight text-ink" style={{ fontWeight: 300 }}>Contour</p>
      <div className="rounded-2xl p-4" style={card}>
        <div className="flex items-start gap-3">
          <div className="rounded-xl p-2" style={{ background: 'rgb(var(--tm-season-rgb) / 0.1)', color: 'var(--tm-season-accent)' }}>
            <BrainCircuit className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-ink">Contour Extended</h3>
              {installed && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                  <Check className="h-3 w-3" /> Installed
                </span>
              )}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              Understands unfamiliar phrasing before you send. Needle runs locally; your draft stays on this device.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-muted">
              <span className="inline-flex items-center gap-1"><HardDrive className="h-3.5 w-3.5" /> {formatBytes(CONTOUR_EXTENDED_DOWNLOAD_BYTES)}</span>
              <span className="inline-flex items-center gap-1"><WifiOff className="h-3.5 w-3.5" /> Works offline after download</span>
            </div>
          </div>
        </div>

        {extended.phase === 'downloading' && (
          <div className="mt-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
              <div className="h-full rounded-full transition-[width]" style={{ width: `${Math.round(extended.progress * 100)}%`, background: 'var(--tm-season-accent)' }} />
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-ink-muted">
              <span>{formatBytes(extended.downloadedBytes)}</span>
              <span>{formatBytes(extended.totalBytes)}</span>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/5 pt-3">
          <div>
            <p className="text-xs font-medium text-ink">{status}</p>
            {extended.persisted === false && installed && (
              <p className="mt-0.5 text-[11px] text-amber-400/80">The browser may clear it under storage pressure.</p>
            )}
            {extended.error && <p className="mt-0.5 max-w-xs text-[11px] text-red-400">{extended.error}</p>}
          </div>

          {installed ? (
            <button
              type="button"
              onClick={() => void extended.remove()}
              disabled={busy}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-red-400/20 px-3 text-xs font-medium text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void extended.install()}
              disabled={busy || extended.phase === 'checking' || extended.phase === 'unsupported'}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ background: 'rgb(var(--tm-season-rgb) / 0.15)', color: 'var(--tm-season-accent)' }}
            >
              {busy || extended.phase === 'checking'
                ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                : <Download className="h-3.5 w-3.5" />}
              Download
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

