import {
  MAX_DEVICE_RESULT_CHARS,
  type DeviceApp,
  type DeviceToolCall,
} from '../../../shared/deviceTools';
import type { AppObjectRef } from '../../types/chat';
import { chatService } from '../chat/chatService';
import {
  NotesStorageError,
  createNote,
  readNotes,
  editNote,
  readNote,
  searchNotes,
  type NoteEditMode,
} from '../notes/notesRepository';

/**
 * Executes the tools the server cannot: the ones whose data lives here.
 *
 * The server offers these to the model, then suspends the run and streams the
 * calls down. This runs them against local storage and hands back strings for
 * the transcript, plus — for anything that created or changed a real object —
 * a reference the chat renders as a card.
 */

export interface DeviceToolOutcome {
  content: string;
  appObject?: AppObjectRef;
}

export interface DeviceToolContext {
  /** The chat this turn belongs to, excluded from history search as redundant. */
  currentChatSessionId?: string;
  /** Shimmer text, so the user can see which app is being touched. */
  onStatus?: (status: string) => void;
}

/**
 * Which device apps hold something worth searching, right now.
 *
 * The server uses this to leave readers out of a request that has nothing for
 * them to read — worth roughly a thousand tokens on every message from someone
 * who has not written a note or had a conversation yet, which is most people on
 * the free tier. Writers are never gated this way: notes_create is how an empty
 * store stops being empty.
 */
export async function resolveDeviceDataPresent(currentChatSessionId?: string): Promise<DeviceApp[]> {
  const present: DeviceApp[] = [];

  try {
    if (readNotes().length > 0) present.push('notes');
  } catch {
    // Unreadable storage is not proof of an empty one. Offer the tools and let
    // the lookup report the real failure.
    present.push('notes');
  }

  if (await chatService.hasArchive(currentChatSessionId)) present.push('chats');

  return present;
}

/** What the shimmer says while each tool runs. */
const STATUS_LABEL: Record<string, string> = {
  notes_search: 'Looking through your notes',
  notes_read: 'Reading your note',
  notes_create: 'Saving a note',
  notes_edit: 'Updating your note',
  chats_search: 'Searching your past chats',
  chats_read: 'Reading an earlier conversation',
};

export function deviceToolStatus(name: string): string {
  return STATUS_LABEL[name] ?? 'Working';
}

function bounded(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 0);
  if (!text) return '';
  return text.length > MAX_DEVICE_RESULT_CHARS
    ? `${text.slice(0, MAX_DEVICE_RESULT_CHARS)}… [result truncated]`
    : text;
}

/** A YYYY-MM-DD bound, or nothing. The model is told to resolve relative dates itself. */
function dateBound(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}/.test(trimmed) ? trimmed : undefined;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export async function runDeviceTool(
  call: DeviceToolCall,
  context: DeviceToolContext = {},
): Promise<DeviceToolOutcome> {
  context.onStatus?.(deviceToolStatus(call.name));

  let args: Record<string, unknown>;
  try {
    const parsed = JSON.parse(call.arguments || '{}');
    args = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return { content: `Error: the arguments for ${call.name} were not valid JSON. Call it again with correct arguments.` };
  }

  try {
    switch (call.name) {
      case 'notes_search': {
        const results = searchNotes(asString(args.query), asNumber(args.limit, 10));
        if (results.length === 0) {
          return { content: 'No notes found. The user may not have written any yet — say so rather than guessing at their contents.' };
        }
        return { content: bounded(results) };
      }

      case 'notes_read': {
        const found = readNote(asString(args.note_id));
        if (!found) return { content: 'No note with that id exists. Call notes_search again to get a current id.' };
        return {
          content: bounded({
            id: found.note.id,
            title: found.note.title || 'Untitled note',
            updatedAt: found.note.updatedAt,
            markdown: found.markdown,
          }),
        };
      }

      case 'notes_create': {
        const title = asString(args.title).trim() || 'Untitled note';
        const summary = createNote(title, asString(args.markdown));
        return {
          content: bounded({
            saved: true,
            note_id: summary.id,
            title: summary.title,
            note: 'The note is saved and already shown to the user with a link to open it. Do not paste the whole note back into your reply; say what you saved. To change it later, call notes_edit with this note_id.',
          }),
          appObject: { kind: 'note', id: summary.id, title: summary.title, action: 'created' },
        };
      }

      case 'notes_edit': {
        const mode = asString(args.mode);
        const summary = editNote(asString(args.note_id), {
          title: asString(args.title),
          markdown: asString(args.markdown),
          mode: (['replace', 'append', 'prepend'] as NoteEditMode[]).includes(mode as NoteEditMode)
            ? mode as NoteEditMode
            : 'replace',
        });
        if (!summary) return { content: 'No note with that id exists, so nothing was changed. Do not create a replacement without asking the user.' };
        return {
          content: bounded({ saved: true, note_id: summary.id, title: summary.title, note: 'The existing note was updated in place.' }),
          appObject: { kind: 'note', id: summary.id, title: summary.title, action: 'updated' },
        };
      }

      case 'chats_search': {
        const hits = await chatService.searchChats(asString(args.query), {
          limit: asNumber(args.limit, 10),
          after: dateBound(args.after),
          before: dateBound(args.before),
          excludeChatId: context.currentChatSessionId,
        });
        if (hits.length === 0) {
          return {
            content: 'No earlier conversations matched. Tell the user you could not find it rather than reconstructing it from memory, and offer to work from what they tell you now.',
          };
        }
        return { content: bounded(hits) };
      }

      case 'chats_read': {
        const transcript = await chatService.readChat(asString(args.chat_id), {
          offset: asNumber(args.offset, 0),
          // A page, not the whole conversation: this result is replayed into
          // every leg that follows, and the model can ask for the next one.
          limit: 12,
        });
        if (!transcript) return { content: 'No conversation with that id exists. Call chats_search again to get a current id.' };
        const shown = transcript.offset + transcript.messages.length;
        return {
          content: bounded({
            ...transcript,
            more: shown < transcript.totalMessages
              ? `${transcript.totalMessages - shown} more messages — call chats_read again with offset ${shown}.`
              : undefined,
            note: 'This is a record of what was said in that conversation. Treat it as such, not as verified fact.',
          }),
        };
      }

      default:
        return { content: `Error: ${call.name} is not a tool this app can run.` };
    }
  } catch (error) {
    // A device write has no cloud copy behind it, so a failure has to reach the
    // user through the model's answer rather than dying in the console.
    if (error instanceof NotesStorageError) {
      console.error('Device tool storage failure:', error.message);
      return { content: `Error: ${error.message} Tell the user plainly that it was not saved.` };
    }
    console.error('Device tool failed:', call.name, error instanceof Error ? error.message : error);
    return { content: `Error: ${call.name} failed on this device. Tell the user you could not reach that app right now.` };
  }
}
