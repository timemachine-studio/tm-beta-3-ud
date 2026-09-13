/**
 * One thing the harness did, inline in the transcript.
 *
 * While the tool runs the label shimmers — the same treatment the status
 * line gets — and settles to plain text with its one-line detail when it
 * finishes. A finished card can be opened to see what the tool produced: a
 * diff, a command's output, the matches. Reopened chats show the settled
 * cards, never a shimmer.
 */

import { memo, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ChevronDown,
  Eye,
  FileCode2,
  FilePlus2,
  FileSearch,
  FolderTree,
  GitPullRequest,
  Pencil,
  Terminal,
  Trash2,
} from 'lucide-react';
import { AnimatedShinyText } from '../ui/AnimatedShinyText';
import { HARNESS_ACTION_MARKER, type HarnessAction } from '../../types/chat';

const ICONS: Record<string, typeof FileCode2> = {
  list_files: FolderTree,
  read_file: FileCode2,
  write_file: FilePlus2,
  edit_file: Pencil,
  delete_file: Trash2,
  grep_files: FileSearch,
  run_command: Terminal,
  open_preview: Eye,
  open_pull_request: GitPullRequest,
};

function DiffOutput({ text }: { text: string }) {
  return (
    <pre className="text-[12px] leading-5 font-mono whitespace-pre overflow-x-auto">
      {text.split('\n').map((line, index) => {
        const tone = line.startsWith('+') ? 'text-emerald-300 bg-emerald-500/10'
          : line.startsWith('-') ? 'text-rose-300 bg-rose-500/10'
          : line.startsWith('@@') ? 'text-cyan-300/70'
          : 'text-white/60';
        return <div key={index} className={`px-2 ${tone}`}>{line || ' '}</div>;
      })}
    </pre>
  );
}

function HarnessActionCardComponent({ action }: { action: HarnessAction }) {
  const [open, setOpen] = useState(false);
  const Icon = ICONS[action.tool] ?? FileCode2;
  const running = action.status === 'running';
  const failed = action.status === 'failed';
  const isDiff = (action.tool === 'edit_file' || action.tool === 'write_file') && !!action.output && action.output.includes('\n');
  const canOpen = !running && !!action.output;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`my-2 max-w-2xl rounded-xl border text-sm ${failed ? 'border-rose-500/30 bg-rose-500/5' : 'border-white/10 bg-white/5'}`}
    >
      <button
        type="button"
        onClick={() => canOpen && setOpen(value => !value)}
        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left ${canOpen ? 'cursor-pointer' : 'cursor-default'}`}
        aria-expanded={canOpen ? open : undefined}
      >
        {failed
          ? <AlertCircle className="w-4 h-4 shrink-0 text-rose-300" />
          : <Icon className={`w-4 h-4 shrink-0 ${running ? 'text-cyan-300' : 'text-white/50'}`} />}
        <span className="min-w-0 flex-1 truncate">
          {running ? (
            <AnimatedShinyText
              text={action.label}
              useShimmer
              baseColor="#06b6d4"
              shimmerColor="var(--color-ink)"
              gradientAnimationDuration={2}
              textClassName="text-sm"
              className="py-0"
            />
          ) : (
            <span className={failed ? 'text-rose-200' : 'text-white/80'}>{action.label}</span>
          )}
        </span>
        {!running && action.detail && (
          <span className={`shrink-0 text-xs font-mono ${failed ? 'text-rose-300/80' : 'text-white/40'}`}>{action.detail}</span>
        )}
        {canOpen && (
          <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>
      {open && action.output && (
        <div className="border-t border-white/10 max-h-80 overflow-y-auto">
          {isDiff
            ? <DiffOutput text={action.output} />
            : <pre className="px-3 py-2 text-[12px] leading-5 font-mono whitespace-pre-wrap break-words text-white/70">{action.output}</pre>}
        </div>
      )}
    </motion.div>
  );
}

export const HarnessActionCard = memo(HarnessActionCardComponent);

/**
 * The message text with its cards in place.
 *
 * Splits on the markers the bridge wrote into the content and renders each
 * text run through the caller's Markdown, with the matching card between.
 * A marker whose action has not arrived yet (the card is created a tick
 * after the marker) renders nothing rather than a hole.
 */
export function HarnessTranscript({
  content,
  actions,
  renderMarkdown,
}: {
  content: string;
  actions: readonly HarnessAction[];
  renderMarkdown: (text: string, key: string) => ReactNode;
}) {
  const byId = new Map(actions.map(action => [action.id, action]));
  const parts = content.split(HARNESS_ACTION_MARKER);
  // split() with a capturing group alternates: text, id, text, id, …, text.
  const nodes: ReactNode[] = [];
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index];
    if (index % 2 === 0) {
      if (part.trim()) nodes.push(renderMarkdown(part, `text-${index}`));
    } else {
      const action = byId.get(part);
      if (action) nodes.push(<HarnessActionCard key={`action-${part}`} action={action} />);
    }
  }
  // Cards for actions whose marker never made it into the text (an aborted
  // leg) still belong to the turn, at the end.
  const placed = new Set(parts.filter((_, index) => index % 2 === 1));
  for (const action of actions) {
    if (!placed.has(action.id)) nodes.push(<HarnessActionCard key={`action-${action.id}`} action={action} />);
  }
  return <>{nodes}</>;
}
