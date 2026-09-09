export function RouteLoadingFallback() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-black text-white"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-purple-400" />
        <span className="text-sm text-white/50">Loading page…</span>
      </div>
    </div>
  );
}
