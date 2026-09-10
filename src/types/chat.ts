import type { AI_PERSONAS } from '../config/constants';

/**
 * The one persona union. Components used to declare their own — several still
 * said `'default' | 'girlie' | 'x'`, a persona that no longer exists — so the
 * same value was legal in one component and a type error in the next
 * (production-check.md 1.1).
 */
export type Persona = keyof typeof AI_PERSONAS;

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface MusicVariation {
  seed: number;
  audioUrl: string;
  imageUrl: string;
}

// Why a turn failed. Mirrors the codes the API returns in
// `{ error: { code, message } }` so the client never has to string-match.
export type ChatErrorCode =
  | 'RETENTION_UNVERIFIED'
  | 'RATE_LIMITED'
  | 'AUTH_EXPIRED'
  | 'PROVIDER_DOWN'
  | 'PAYLOAD_TOO_LARGE'
  | 'TIMEOUT'
  | 'TRUNCATED'
  | 'EMPTY'
  | 'ABORTED'
  | 'NETWORK'
  | 'UNKNOWN';

// Everything a retry needs to re-run a turn exactly as it was first sent.
// Captured on the user message at send time so retry never has to
// reconstruct it from current UI state (production-check.md 1.10).
export interface RetryContext {
  persona: string;
  heatLevel?: number;
  specialMode?: string;
  flowState?: boolean;
  imageData?: string | string[];
  inputImageUrls?: string[];
  imageDimensions?: ImageDimensions;
  pdfData?: string;
  pdfFileName?: string;
}

export interface Message {
  id: string;
  // ISO timestamp. Ids used to double as the message's clock (they were
  // `Date.now()`); now that they are UUIDs, ordering needs its own field.
  createdAt?: string;
  content: string;
  isAI: boolean;
  // Lifecycle of an assistant turn. `error` renders the inline retry row
  // instead of a bubble (production-check.md 1.10).
  status?: 'streaming' | 'complete' | 'error';
  errorCode?: ChatErrorCode;
  // Whatever did stream before the failure, kept so the user can see it.
  partialContent?: string;
  retryContext?: RetryContext;
  hasAnimated?: boolean;
  thinking?: string;
  rawContent?: string; // Raw content received during streaming before parsing
  imageData?: string | string[]; // Add imageData field
  audioUrl?: string; // Add audioUrl field for AI audio responses
  inputImageUrls?: string[]; // Add inputImageUrls field for publicly accessible image URLs
  imageDimensions?: ImageDimensions; // Dimensions of the first uploaded image (for edit operations)
  pdfData?: string; // Text content of the uploaded document (PDF, TXT, MD, etc.)
  pdfFileName?: string; // Original filename of the uploaded document for display
  // Group chat sender info (optional - only present in group mode)
  sender_id?: string;
  sender_nickname?: string;
  sender_avatar?: string;
  // Reply functionality
  replyTo?: {
    id: string;
    content: string;
    sender_nickname?: string;
    isAI: boolean;
  };
  // Reactions (emoji -> user_ids)
  reactions?: Record<string, string[]>;
  // Special mode that triggered this message (e.g. 'web-coding', 'music-compose')
  specialMode?: string;
  // Saved music variations with permanent Supabase URLs (for music-compose history)
  musicVariations?: MusicVariation[];
  mcpApproval?: import('./flightControls').McpApprovalRequest;
  // Real app objects this turn created or changed — today a TM Notes note.
  // Rendered as a card with a link that opens that exact object.
  appObjects?: AppObjectRef[];
  // Python this turn ran on the device, with whatever it put in front of the
  // user: charts, tables, generated files.
  pythonRuns?: PythonRun[];
  // Files the user attached to this message, by reference into the device file
  // store. The bytes are not here; only what is needed to find them again.
  attachments?: AttachedFile[];
}

/**
 * Something a Python run put in front of the user.
 *
 * Anything with bytes behind it — a chart, a generated document — carries a
 * `fileId` into the device file store rather than the bytes themselves, so a
 * spreadsheet does not travel inside the conversation. `dataUrl` is the older
 * form and is still read, because messages saved before the store existed have
 * it; nothing writes it any more. `dropped` marks a payload that is gone: left
 * out by the old size budget, or stored on a device this is not.
 */
export type PythonArtifact =
  | { kind: 'image'; caption?: string; fileId?: string; dataUrl?: string; dropped?: boolean }
  | {
      kind: 'table';
      caption?: string;
      columns: string[];
      index?: string[];
      rows: string[][];
      totalRows: number;
      totalColumns: number;
    }
  | { kind: 'text'; caption?: string; text: string }
  | { kind: 'file'; name: string; size: number; mime: string; fileId?: string; dataUrl?: string; dropped?: boolean };

/** One `run_python` call, as the chat shows it. */
export interface PythonRun {
  id: string;
  code: string;
  ok: boolean;
  durationMs: number;
  stdout?: string;
  error?: string;
  timedOut?: boolean;
  artifacts: PythonArtifact[];
}

/**
 * A file the user attached, kept in the device file store.
 *
 * The message records the reference so the attachment survives a reload and so
 * every later turn in the conversation can still reach it — a spreadsheet
 * attached five messages ago is still openable from `run_python`.
 */
export interface AttachedFile {
  id: string;
  name: string;
  mime: string;
  size: number;
}

/** A note the AI saved or edited from chat. */
export interface AppObjectRef {
  kind: 'note';
  id: string;
  title: string;
  action: 'created' | 'updated';
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  isChatMode: boolean;
}

export interface ReplyToData {
  id: string;
  content: string;
  sender_nickname?: string;
  isAI: boolean;
}

export interface ChatActions {
  handleSendMessage: (message: string, imageData?: string | string[], inputImageUrls?: string[], imageDimensions?: ImageDimensions, replyTo?: ReplyToData, specialMode?: string, pdfData?: string, pdfFileName?: string, attachments?: AttachedFile[]) => Promise<void>;
  setChatMode: (isChatMode: boolean) => void;
}

export interface ChatInputProps {
  onSendMessage: (message: string, imageData?: string | string[], inputImageUrls?: string[], imageDimensions?: ImageDimensions, replyTo?: ReplyToData, specialMode?: string, pdfData?: string, pdfFileName?: string, attachments?: AttachedFile[]) => Promise<void>;
  isLoading?: boolean;
}

export interface ShowHistoryProps {
  isChatMode: boolean;
  onToggle: () => void;
}

export interface MessageProps {
  content: string;
  isLoading?: boolean;
  hasAnimated?: boolean;
  onAnimationComplete?: () => void;
  thinking?: string;
  imageData?: string | string[];
  inputImageUrls?: string[]; // URLs of uploaded images (for persistence)
  pdfFileName?: string; // Original PDF filename for display in message bubble
  // Group chat sender info
  sender_nickname?: string;
  sender_avatar?: string;
  isGroupMode?: boolean;
}

// Additive compatibility names; legacy Message and wire framing stay intact.
export type { AgentEvent, ArtifactRef, SourceRef, ToolResult } from "../../shared/agent";
