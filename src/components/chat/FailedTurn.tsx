import { AlertTriangle, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import type { ChatErrorCode } from '../../types/chat';
import { chatErrorCopy } from '../../services/ai/chatErrors';

interface FailedTurnProps {
  messageId: string;
  errorCode?: ChatErrorCode;
  /** Whatever streamed before the failure, if anything. */
  partialContent?: string;
  onRetry?: (messageId: string) => void;
  retrying?: boolean;
}

// Codes where re-running the same request is pointless — the user has to do
// something first (sign in, wait, shrink the attachment).
const NOT_RETRYABLE: ChatErrorCode[] = ['RATE_LIMITED', 'AUTH_EXPIRED', 'PAYLOAD_TOO_LARGE'];

/**
 * A failed assistant turn, rendered in place of the bubble.
 *
 * Failures used to go into global `error` state and render as a banner at the
 * top of the transcript — detached from the message that failed, and with
 * "please try again" meaning *retype your message* (production-check.md 1.10).
 */
export function FailedTurn({ messageId, errorCode, partialContent, onRetry, retrying }: FailedTurnProps) {
  const canRetry = Boolean(onRetry) && !NOT_RETRYABLE.includes(errorCode ?? 'UNKNOWN');

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      {partialContent && (
        <div className="mb-2 text-white/40 text-sm whitespace-pre-wrap border-l-2 border-white/10 pl-3">
          {partialContent}
        </div>
      )}
      <div className="inline-flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2">
        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400/80" />
        <span className="text-sm text-amber-100/70">{chatErrorCopy(errorCode)}</span>
        {canRetry && (
          <button
            type="button"
            onClick={() => onRetry?.(messageId)}
            disabled={retrying}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-white/80 transition-colors hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw className={`w-3 h-3 ${retrying ? 'animate-spin' : ''}`} />
            {retrying ? 'Retrying' : 'Retry'}
          </button>
        )}
      </div>
    </motion.div>
  );
}
