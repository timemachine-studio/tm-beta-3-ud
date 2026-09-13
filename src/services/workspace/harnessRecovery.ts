import type { Message, RetryContext } from '../../types/chat';
import type { MaxModeKind } from '../../../shared/maxMode';
import type { WorkspaceMeta } from './workspaceStore';
import { newId } from '../../utils/id';

export function harnessTurnKey(message: Pick<Message, 'id' | 'createdAt'>): string {
  return message.createdAt ?? message.id;
}

/** Recover an unsaved user turn without rewinding over newer conversation work. */
export function prepareHarnessRecovery(messages: readonly Message[], checkpoint: NonNullable<WorkspaceMeta['resume']>, mode: MaxModeKind) {
  let index = messages.length - 1;
  while (index >= 0 && messages[index].isAI) index--;
  const lastUser = index >= 0 ? messages[index] : null;
  const matches = lastUser?.content === checkpoint.userContent
    && (!checkpoint.turnId || harnessTurnKey(lastUser) === checkpoint.turnId);
  if (!matches && lastUser) {
    const savedTime = Date.parse(checkpoint.turnId ?? '');
    const currentTime = Date.parse(lastUser.createdAt ?? '');
    if (!Number.isFinite(savedTime) || !Number.isFinite(currentTime) || currentTime >= savedTime) {
      throw new Error('This checkpoint belongs to an earlier task. It cannot replace newer conversation messages.');
    }
  }
  const context: RetryContext = matches && lastUser?.retryContext
    ? { ...lastUser.retryContext, persona: 'pro', maxMode: mode }
    : { persona: 'pro', maxMode: mode };
  const user: Message = matches && lastUser ? lastUser : {
    id: newId(), content: checkpoint.userContent, isAI: false, retryContext: context,
    createdAt: Number.isFinite(Date.parse(checkpoint.turnId ?? '')) ? checkpoint.turnId : new Date().toISOString(),
  };
  const history = matches ? messages.slice(0, index + 1) : [...messages, user];
  const previous = matches && messages[index + 1]?.isAI ? messages[index + 1] : null;
  return { history, user, context, actions: previous?.harnessActions?.filter(action => action.status !== 'running') };
}
