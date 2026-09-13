/**
 * Where useChat meets the workspace.
 *
 * useChat knows a turn is a Max Mode turn and which mode; it does not know
 * where the project lives or how to run a command, and it should not. This
 * hands it the three things the stream bridge needs — a summary of the
 * workspace for the prompt, an executor for the tools, and a way to be told
 * about cards — built on the store, the runtime and the preview.
 */

import type { DeviceApp } from '../../../shared/deviceTools';
import type { MaxModeKind, MaxModeRuntime } from '../../../shared/maxMode';
import type { HarnessAction, HarnessResume } from '../../types/chat';
import type { HarnessBridgeOptions } from '../ai/aiProxyService';
import { createWorkspaceExecutor } from './workspaceTools';
import { getWorkspaceMeta, summarizeWorkspace, updateWorkspaceMeta } from './workspaceStore';

/** Whether this page can boot the Node runtime — see nodeRuntime.ts. */
function nodeSupported(): boolean {
  return typeof window !== 'undefined'
    && typeof SharedArrayBuffer !== 'undefined'
    && (window as { crossOriginIsolated?: boolean }).crossOriginIsolated === true;
}

/** What this browser can run for the harness, for the request summary. */
export function harnessRuntimes(): MaxModeRuntime[] {
  return nodeSupported() ? ['node', 'python'] : ['python'];
}

/**
 * The device apps a Max Mode turn declares.
 *
 * 'workspace' is what makes the server offer the file tools at all; 'node'
 * is declared only where the runtime can actually boot, so a browser that
 * cannot is never offered run_command. Notes and chat history stay out: the
 * harness's tool set is closed on the server, and declaring them would only
 * make the data-presence lookup run for nothing.
 */
export function harnessDeviceApps(): DeviceApp[] {
  return nodeSupported() ? ['workspace', 'python', 'node'] : ['workspace', 'python'];
}

export function createHarnessBridge(options: {
  sessionId: string;
  mode: MaxModeKind;
  userContent: string;
  turnId?: string;
  signal?: AbortSignal;
  onAction?: (action: HarnessAction) => void;
  resume?: HarnessResume;
}): HarnessBridgeOptions {
  const { sessionId, mode, signal, onAction, resume, userContent, turnId } = options;
  return {
    mode,
    summarizeWorkspace: () => summarizeWorkspace(sessionId, harnessRuntimes()),
    executor: createWorkspaceExecutor({ sessionId, signal, mode }),
    onAction,
    resume,
    onStart: async () => {
      await updateWorkspaceMeta(sessionId, {
        activeHarnessTurnId: turnId,
        resume: { userContent, turnId, mode, ...(resume ?? { toolTranscript: [], deviceRounds: 0, content: '' }) },
      });
    },
    onCheckpoint: async checkpoint => {
      // A receipt must be durable before a side effect starts. Failing this
      // write stops the turn rather than claiming crash recovery is available.
      const meta = await updateWorkspaceMeta(sessionId, { resume: { userContent, turnId, mode, ...checkpoint } }, turnId);
      if (turnId && meta.activeHarnessTurnId !== turnId) throw new Error('This task was superseded by a newer task. Its checkpoint was not changed.');
    },
  };
}

/** Remember the mode with the workspace, so reopening the chat restores it. */
export function rememberWorkspaceMode(sessionId: string, mode: MaxModeKind | null): void {
  updateWorkspaceMeta(sessionId, { mode }).catch((error: unknown) => {
    // Not fatal — the chat still works, the mode just will not be restored
    // next time — but the user is owed a line in the console, not silence.
    console.error('Could not remember the Max Mode setting:', error instanceof Error ? error.message : error);
  });
}

/** Keep where a failed turn got to, so Retry can continue it after a reload. */
export function rememberHarnessResume(sessionId: string, userContent: string, resume: HarnessResume, turnId?: string, mode?: MaxModeKind): void {
  updateWorkspaceMeta(sessionId, { resume: { userContent, turnId, mode, ...resume } }, turnId).catch((error: unknown) => {
    console.error('Could not remember where the turn got to:', error instanceof Error ? error.message : error);
  });
}

/**
 * The resume state for the turn this user prompt started, if the workspace
 * still has it. Match both the prompt and stable turn key so repeated
 * prompts cannot pick up the wrong task. Older checkpoints keep their fallback.
 */
export async function recallHarnessResume(sessionId: string, userContent: string, turnId?: string): Promise<HarnessResume | null> {
  try {
    const meta = await getWorkspaceMeta(sessionId);
    if (!meta?.resume || meta.resume.userContent !== userContent || (meta.resume.turnId && meta.resume.turnId !== turnId)) return null;
    const { toolTranscript, deviceRounds, content } = meta.resume;
    return { toolTranscript, deviceRounds, content };
  } catch {
    return null;
  }
}

/** A turn finished: nothing to continue any more. */
export function forgetHarnessResume(sessionId: string, turnId?: string): void {
  updateWorkspaceMeta(sessionId, { resume: undefined }, turnId).catch(() => undefined);
}

/** The mode a chat's workspace was left in, or null. */
export async function workspaceModeFor(sessionId: string): Promise<MaxModeKind | null> {
  try {
    return (await getWorkspaceMeta(sessionId))?.mode ?? null;
  } catch {
    return null;
  }
}
