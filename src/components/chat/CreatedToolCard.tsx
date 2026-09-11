import { useState } from 'react';
import { ChevronDown, Globe, Wrench } from 'lucide-react';
import type { SessionTool } from '../../../shared/toolRegistry';
import { registryToolName } from '../../../shared/toolRegistry';

interface CreatedToolCardProps {
  tools: SessionTool[];
}

/**
 * A tool the assistant just wrote, tested and — if the user is signed in —
 * published for everyone.
 *
 * The one thing this has to be honest about is *where the tool went*. A
 * published tool is code every other user's device may now run; a card that
 * hid that would be hiding the product's whole position on sharing. So the
 * second line says which of the two happened, and the source is one click
 * away, because a user is entitled to read what they just shipped.
 */
export function CreatedToolCard({ tools }: CreatedToolCardProps) {
  if (tools.length === 0) return null;
  return (
    <div className="mt-3 flex max-w-2xl flex-col gap-2">
      {tools.map((tool) => <ToolView key={tool.slug} tool={tool} />)}
    </div>
  );
}

function ToolView({ tool }: { tool: SessionTool }) {
  const [showSource, setShowSource] = useState(false);
  const parameterNames = Object.keys((tool.parameters as { properties?: Record<string, unknown> }).properties ?? {});

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <button
        type="button"
        onClick={() => setShowSource(current => !current)}
        aria-expanded={showSource}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]"
      >
        <div className="rounded-xl bg-emerald-500/12 p-2 text-emerald-300">
          <Wrench className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white/90">
            New tool: {tool.title}
            <span className="ml-2 font-mono text-[11px] text-white/35">{registryToolName(tool.slug)}</span>
          </p>
          <p className="truncate text-[11px] text-white/40">{tool.summary}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-white/45">
            {tool.published
              ? <><Globe className="h-3 w-3" /> Published to the shared TimeMachine registry · v{tool.version}</>
              : 'Kept in this chat only'}
          </p>
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-white/30 transition-transform ${showSource ? 'rotate-180' : ''}`}
        />
      </button>

      {showSource && (
        <div className="border-t border-white/8 px-4 py-3">
          {parameterNames.length > 0 && (
            <p className="mb-2 text-[11px] text-white/40">
              Takes: <span className="font-mono text-white/55">{parameterNames.join(', ')}</span>
            </p>
          )}
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-black/30 p-3 text-xs leading-relaxed text-white/60">
            {tool.source}
          </pre>
        </div>
      )}
    </div>
  );
}
