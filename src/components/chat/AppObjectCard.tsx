import { ArrowUpRight, NotebookPen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { AppObjectRef } from '../../types/chat';

interface AppObjectCardProps {
  objects: AppObjectRef[];
}

/**
 * A real thing the assistant made, shown inline with a way to open it.
 *
 * The point is that the object exists outside the conversation: the note is
 * saved to TM Notes before this renders, and the link opens that exact note
 * rather than dropping the user at the app's front door.
 */
export function AppObjectCard({ objects }: AppObjectCardProps) {
  const navigate = useNavigate();
  if (objects.length === 0) return null;

  return (
    <div className="mt-3 flex max-w-2xl flex-col gap-2">
      {objects.map((object) => (
        <button
          key={`${object.kind}:${object.id}`}
          type="button"
          onClick={() => navigate(`/notes?note=${encodeURIComponent(object.id)}`)}
          className="group flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition hover:border-white/20 hover:bg-white/[0.07]"
        >
          <div className="rounded-xl bg-purple-500/12 p-2 text-purple-300">
            <NotebookPen className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white/90">{object.title}</p>
            <p className="text-[11px] text-white/40">
              {object.action === 'created' ? 'Saved to TM Notes' : 'Updated in TM Notes'}
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-1 text-[11px] text-white/45 transition group-hover:text-white/75">
            Open in Notes <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </button>
      ))}
    </div>
  );
}
