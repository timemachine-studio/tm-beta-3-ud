import { useEffect, useSyncExternalStore } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { pendingPublication, subscribePublication } from '../../services/workspace/publicationApproval';

export function PublicationApproval({ sessionId }: { sessionId: string }) {
  const proposal = useSyncExternalStore(subscribePublication, () => pendingPublication(sessionId), () => null);
  useEffect(() => () => { pendingPublication(sessionId)?.settle(false); }, [sessionId]);
  return (
    <Dialog.Root open={!!proposal} onOpenChange={open => { if (!open) proposal?.settle(false); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/70" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] max-h-[85vh] w-[min(92vw,720px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-white/15 bg-neutral-900 p-5 text-white">
          <Dialog.Title className="text-lg font-medium">Review GitHub publication</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-white/60">
            Approve to commit these files to {proposal?.repository} on {proposal?.branch} and open or update a pull request against {proposal?.base}.
          </Dialog.Description>
          {proposal && <>
            <h3 className="mt-4 font-medium">{proposal.title}</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-white/70">{proposal.body}</p>
            <p className="mt-4 mb-2 text-sm">{proposal.changes.length} changed files. Expand a file to review the contents that will be sent.</p>
            {proposal.changes.map(change => <details key={change.path} className="border-t border-white/10 py-2 text-sm">
              <summary className="cursor-pointer break-all font-mono">{change.content === null && !change.base64 ? 'Delete' : 'Write'} {change.path}</summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-white/70">{change.base64 ? 'Binary file' : change.content ?? 'This file will be deleted.'}</pre>
            </details>)}
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => proposal.settle(false)} className="rounded-lg border border-white/20 px-4 py-2 text-sm">Cancel</button>
              <button type="button" onClick={() => proposal.settle(true)} className="rounded-lg bg-cyan-500/25 px-4 py-2 text-sm text-cyan-100">Approve and publish</button>
            </div>
          </>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
