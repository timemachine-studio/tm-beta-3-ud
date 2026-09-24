import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Clock3, NotebookPen, Pause, Play, Square } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { AppObjectRef, NoteAppObjectRef, TimerAppObjectRef } from '../../types/chat';
import { controlTimer, readTimer, subscribeTimerChanges, type TimerRecord } from '../../services/timer/timerRepository';

interface AppObjectCardProps {
  objects: AppObjectRef[];
}

function NoteCard({ object }: { object: NoteAppObjectRef }) {
  const navigate = useNavigate();
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <button type="button" onClick={() => navigate(`/notes?note=${encodeURIComponent(object.id)}`)} className="group flex w-full items-center gap-3 text-left">
        <div className="rounded-xl bg-purple-500/12 p-2 text-purple-300"><NotebookPen className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white/90">{object.title}</p>
          <p className="text-[11px] text-white/40">{object.action === 'updated' ? 'Updated in TM Notes' : object.action === 'reused' ? 'Already saved in TM Notes' : 'Saved to TM Notes'}</p>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-[11px] text-white/45 transition group-hover:text-white/75">Open in Notes <ArrowUpRight className="h-3.5 w-3.5" /></span>
      </button>
      {object.sourceChatIds && object.sourceChatIds.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-white/[0.06] pt-2">
          <span className="text-[10px] uppercase tracking-[0.12em] text-white/30">Sources</span>
          {object.sourceChatIds.map((chatId, index) => (
            <button key={chatId} type="button" onClick={() => navigate(`/chat/${encodeURIComponent(chatId)}`)} className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-white/50 transition hover:bg-white/[0.06] hover:text-white/80">
              Conversation {index + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatRemaining(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}` : `${minutes}:${String(rest).padStart(2, '0')}`;
}

function TimerCard({ object }: { object: TimerAppObjectRef }) {
  const [timer, setTimer] = useState<TimerRecord | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    let live = true;
    void readTimer(object.id).then(value => { if (live) setTimer(value); });
    const unsubscribe = subscribeTimerChanges(value => { if (value.id === object.id) setTimer(value); });
    return () => { live = false; unsubscribe(); };
  }, [object.id]);
  useEffect(() => {
    if (timer?.status !== 'running') return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [timer?.status]);
  const remaining = useMemo(() => {
    if (!timer) return object.deadlineAt && now > 0 ? Math.max(0, Date.parse(object.deadlineAt) - now) : object.durationMs;
    return timer.status === 'running' && timer.deadlineAt && now > 0 ? Math.max(0, Date.parse(timer.deadlineAt) - now) : timer.remainingMs;
  }, [timer, object.deadlineAt, object.durationMs, now]);
  const status = timer?.status ?? object.status;
  const control = async (action: 'pause' | 'resume' | 'cancel') => {
    const next = await controlTimer(object.id, action);
    if (next) setTimer(next);
  };
  return (
    <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.045] px-4 py-3" role="timer" aria-label={object.title}>
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-cyan-400/10 p-2 text-cyan-300"><Clock3 className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white/90">{object.title}</p>
          <p className="font-mono text-xl tabular-nums text-cyan-100">{status === 'completed' ? 'Done' : status === 'cancelled' ? 'Cancelled' : formatRemaining(remaining)}</p>
          <p className="text-[10px] text-white/35">In-app timer · restored after refresh</p>
        </div>
        {(status === 'running' || status === 'paused') && (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => void control(status === 'running' ? 'pause' : 'resume')} aria-label={status === 'running' ? 'Pause timer' : 'Resume timer'} className="rounded-full border border-white/10 p-2 text-white/55 transition hover:bg-white/[0.07] hover:text-white">
              {status === 'running' ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </button>
            <button type="button" onClick={() => void control('cancel')} aria-label="Cancel timer" className="rounded-full border border-white/10 p-2 text-white/55 transition hover:bg-white/[0.07] hover:text-white"><Square className="h-3.5 w-3.5" /></button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Real app objects created by an assistant turn, with direct controls. */
export function AppObjectCard({ objects }: AppObjectCardProps) {
  if (objects.length === 0) return null;
  return (
    <div className="mt-3 flex max-w-2xl flex-col gap-2">
      {objects.map(object => object.kind === 'timer'
        ? <TimerCard key={`${object.kind}:${object.id}`} object={object} />
        : <NoteCard key={`${object.kind}:${object.id}`} object={object} />)}
    </div>
  );
}
