import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, Clock3, Server, X } from 'lucide-react';
import type { McpApprovalDecision, McpApprovalRequest } from '../../types/flightControls';

interface McpApprovalCardProps {
  approval: McpApprovalRequest;
  onDecision: (decision: McpApprovalDecision) => void;
}

export function McpApprovalCard({ approval, onDecision }: McpApprovalCardProps) {
  const [expired, setExpired] = useState(new Date(approval.expiresAt).getTime() <= Date.now());
  const busy = approval.status === 'approved' || approval.status === 'denied';

  useEffect(() => {
    const remaining = new Date(approval.expiresAt).getTime() - Date.now();
    if (remaining <= 0) {
      setExpired(true);
      return;
    }
    const timer = window.setTimeout(() => setExpired(true), remaining);
    return () => window.clearTimeout(timer);
  }, [approval.expiresAt]);

  return (
    <div className="max-w-2xl overflow-hidden rounded-2xl border border-amber-300/20 bg-amber-300/[0.045] shadow-[0_14px_50px_rgba(0,0,0,0.2)]">
      <div className="flex items-start gap-3 border-b border-white/8 px-4 py-4 sm:px-5">
        <div className="rounded-xl bg-amber-300/10 p-2 text-amber-200"><Server className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white/90">Allow external action?</p>
          <p className="mt-1 text-xs text-white/48">
            <span className="text-white/70">{approval.serverName}</span> wants to run <code className="rounded bg-white/5 px-1.5 py-0.5 text-amber-100/80">{approval.toolName}</code>.
          </p>
        </div>
      </div>

      <div className="px-4 py-4 sm:px-5">
        <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-white/32">Arguments</p>
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-black/25 p-3 text-xs leading-relaxed text-white/60">
          {JSON.stringify(approval.argumentPreview, null, 2)}
        </pre>

        {approval.error && (
          <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-rose-200/80">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {approval.error}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-[11px] text-white/32">
            <Clock3 className="h-3.5 w-3.5" /> {expired ? 'Approval expired' : 'Expires in 10 minutes'}
          </p>
          <div className="flex gap-2">
            <button
              disabled={busy || expired || approval.status === 'failed'}
              onClick={() => onDecision('deny')}
              className="flex items-center gap-1.5 rounded-full bg-white/5 px-4 py-2 text-xs text-white/65 ring-1 ring-white/10 transition hover:bg-white/10 disabled:opacity-40"
            >
              <X className="h-3.5 w-3.5" /> Deny
            </button>
            <button
              disabled={busy || expired || approval.status === 'failed'}
              onClick={() => onDecision('approve')}
              className="flex items-center gap-1.5 rounded-full bg-amber-300/15 px-4 py-2 text-xs text-amber-100 ring-1 ring-amber-200/25 transition hover:bg-amber-300/20 disabled:opacity-40"
            >
              <Check className="h-3.5 w-3.5" /> {busy ? 'Working…' : 'Allow once'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
