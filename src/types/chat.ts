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
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  isChatMode: boolean;
}

export interface ChatActions {
  handleSendMessage: (message: string, imageData?: string | string[], audioData?: string, inputImageUrls?: string[]) => Promise<void>;
  setChatMode: (isChatMode: boolean) => void;
}

export interface ChatInputProps {
  onSendMessage: (message: string, imageData?: string | string[], audioData?: string, inputImageUrls?: string[]) => Promise<void>;
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
}
