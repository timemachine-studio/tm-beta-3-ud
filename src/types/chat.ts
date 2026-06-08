export interface ImageDimensions {
  width: number;
  height: number;
}

export interface MusicVariation {
  seed: number;
  audioUrl: string;
  imageUrl: string;
}

export interface Message {
  id: number;
  content: string;
  isAI: boolean;
  hasAnimated?: boolean;
  thinking?: string;
  imageData?: string | string[]; // Add imageData field
  audioData?: string; // Add audioData field for base64 encoded audio
  audioUrl?: string; // Add audioUrl field for AI audio responses
  inputImageUrls?: string[]; // Add inputImageUrls field for publicly accessible image URLs
  imageDimensions?: ImageDimensions; // Dimensions of the first uploaded image (for edit operations)
  pdfData?: string; // Base64-encoded PDF file data
  pdfFileName?: string; // Original PDF filename for display
  // Group chat sender info (optional - only present in group mode)
  sender_id?: string;
  sender_nickname?: string;
  sender_avatar?: string;
  // Reply functionality
  replyTo?: {
    id: number;
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
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  isChatMode: boolean;
}

export interface ReplyToData {
  id: number;
  content: string;
  sender_nickname?: string;
  isAI: boolean;
}

export interface ChatActions {
  handleSendMessage: (message: string, imageData?: string | string[], audioData?: string, inputImageUrls?: string[], imageDimensions?: ImageDimensions, replyTo?: ReplyToData, specialMode?: string, pdfData?: string, pdfFileName?: string, flowState?: boolean) => Promise<void>;
  setChatMode: (isChatMode: boolean) => void;
}

export interface ChatInputProps {
  onSendMessage: (message: string, imageData?: string | string[], audioData?: string, inputImageUrls?: string[], imageDimensions?: ImageDimensions, replyTo?: ReplyToData, specialMode?: string, pdfData?: string, pdfFileName?: string, flowState?: boolean) => Promise<void>;
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
  audioData?: string;
  inputImageUrls?: string[]; // URLs of uploaded images (for persistence)
  pdfFileName?: string; // Original PDF filename for display in message bubble
  // Group chat sender info
  sender_nickname?: string;
  sender_avatar?: string;
  isGroupMode?: boolean;
}
