import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Square, Plus, X, CornerDownRight, ImagePlus, Code, Music, HeartPulse, FileText } from 'lucide-react';
import SendIcon from '../icons/SendIcon';
import { useNavigate } from 'react-router-dom';
import { SpeechTranscriptionButton } from './SpeechTranscriptionButton';
import { ChatInputProps, ImageDimensions, type AttachedFile } from '../../types/chat';
import { LoadingSpinner } from '../loading/LoadingSpinner';
import { ImagePreview } from './ImagePreview';
import { FilePreview } from './FilePreview';
import { AI_PERSONAS } from '../../config/constants';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { MentionCall } from './MentionCall';
import { PlusMenu, PlusMenuOption } from './PlusMenu';
import { uploadImage } from '../../services/image/imageService';
import { GroupChatParticipant } from '../../types/groupChat';
import { useContour } from '../contour/useContour';
import { ContourPanel } from '../contour/ContourPanel';
import { ContourCommand, recordCommandUsage } from '../contour/modules/commands';
import { saveQuickNote } from '../contour/modules/quickNote';
import { saveQuickEvent } from '../contour/modules/quickEvent';

type Persona = keyof typeof AI_PERSONAS;

export interface ReplyTo {
  id: string;
  content: string;
  sender_nickname?: string;
  isAI: boolean;
}

const personaStyles = {
  // Subtle tint colors for glass buttons
  tintColors: {
    default: 'rgba(168, 85, 247, 0.2)',    // Purple tint (brighter)
    girlie: 'rgba(236, 72, 153, 0.15)',    // Pink tint
    pro: 'rgba(34, 211, 238, 0.15)'        // Cyan tint
  },
  borderColors: {
    default: 'rgba(168, 85, 247, 0.4)',    // Purple border (brighter)
    girlie: 'rgba(236, 72, 153, 0.3)',      // Pink border
    pro: 'rgba(34, 211, 238, 0.3)'          // Cyan border
  },
  glowShadow: {
    default: '0 0 15px rgba(168, 85, 247, 0.35)',  // Purple glow (brighter, larger)
    girlie: '0 0 12px rgba(236, 72, 153, 0.25)',
    pro: '0 0 12px rgba(34, 211, 238, 0.25)'
  }
} as const;

const convertImageToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert image to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};


const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Get image dimensions from a File
const getImageDimensions = (file: File): Promise<ImageDimensions> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
};

interface ExtendedChatInputProps extends ChatInputProps {
  currentPersona?: Persona;
  isGroupMode?: boolean;
  participants?: GroupChatParticipant[];
  replyTo?: ReplyTo | null;
  onClearReply?: () => void;
  initialMode?: PlusMenuOption | null;
  onModeChange?: (mode: PlusMenuOption | null) => void;
  /** Cancel the generation in flight. Turns the send button into Stop (1.5). */
  onStop?: () => void;
}

/**
 * Files worth attaching that have no text to extract.
 *
 * These exist for run_python: a spreadsheet read as text is line noise, and
 * reading it with pandas is the whole point. Before the sandbox existed there
 * was nothing that could open one, which is why they were rejected outright.
 */
const DATA_EXTENSIONS = [
  'xlsx', 'xls', 'xlsm', 'docx', 'pptx', 'ods', 'odt', 'parquet', 'db',
  'sqlite', 'zip', 'tsv', 'numbers', 'rtf',
];

const TEXT_EXTENSIONS = [
  'md', 'txt', 'js', 'jsx', 'ts', 'tsx', 'json', 'csv', 'xml', 'yaml', 'yml',
  'ini', 'cfg', 'log', 'toml', 'env', 'sh', 'py', 'java', 'c', 'cpp', 'h',
  'hpp', 'cs', 'go', 'rs', 'rb', 'php', 'sql',
];

function isTextFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return file.type.startsWith('text/') || TEXT_EXTENSIONS.includes(ext) || file.type === '';
}

/** Matches the file store's own per-file limit. */
const MAX_ATTACHMENT_BYTES = 25_000_000;

/**
 * Put the raw bytes in the device file store so run_python can open them.
 *
 * Additional to the text extraction, not instead of it: the model still gets
 * the text of a PDF in its prompt, and now the PDF itself is on disk, which is
 * what makes "change this document" possible rather than only "read it".
 *
 * Returns null if the store refuses. The attachment still sends — losing the
 * ability to open it in Python is worth much less than losing the message.
 */
async function keepAttachment(file: File): Promise<AttachedFile | null> {
  try {
    const { putFile } = await import('../../services/files/fileStore');
    const stored = await putFile({
      name: file.name,
      mime: file.type || 'application/octet-stream',
      bytes: file,
      source: 'upload',
    });
    return { id: stored.id, name: stored.name, mime: stored.mime, size: stored.size };
  } catch (error: unknown) {
    console.error('Could not keep an attachment on this device:', error);
    return null;
  }
}

export function ChatInput({ onSendMessage, isLoading, currentPersona = 'default' as Persona, isGroupMode, participants, replyTo, onClearReply, initialMode, onModeChange, onStop }: ExtendedChatInputProps) {
  const [message, setMessage] = useState('');
  // While a generation is running the send button becomes Stop — until now
  // there was no way to cancel one (1.5).
  const canStop = Boolean(isLoading && onStop);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileExtractedText, setFileExtractedText] = useState<string | null>(null);
  /** The same file in the device store, so run_python can open it. */
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const [isFileReading, setIsFileReading] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  const [showMentionCall, setShowMentionCall] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [selectedPlusOption, setSelectedPlusOption] = useState<PlusMenuOption | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const contour = useContour();
  const contourRef = useRef<HTMLDivElement>(null);

  // Auto-set plus option when initialMode is provided (e.g., from healthcare page navigation)
  useEffect(() => {
    // No comparison against current state: setState already no-ops on an
    // identical value, and reading it here made the dependency list dishonest.
    if (initialMode) {
      let cancelled = false;
      queueMicrotask(() => { if (!cancelled) setSelectedPlusOption(initialMode); });
      return () => { cancelled = true; };
    }
  }, [initialMode]);

  // Notify parent of mode changes
  useEffect(() => {
    if (onModeChange) {
      onModeChange(selectedPlusOption);
    }
  }, [selectedPlusOption, onModeChange]);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    return () => {
      imagePreviewUrls.forEach(URL.revokeObjectURL);
    };
  }, [imagePreviewUrls]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Store scroll position before resize
      const scrollTop = textarea.scrollTop;

      // Reset height to measure content
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 150);
      textarea.style.height = `${newHeight}px`;

      // Restore scroll position
      textarea.scrollTop = scrollTop;
    }
  }, [message]);

  // Close plus menu on outside click
  useEffect(() => {
    if (!showPlusMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setShowPlusMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPlusMenu]);

  // Close contour on outside click
  useEffect(() => {
    if (!contour.isVisible) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        contourRef.current && !contourRef.current.contains(e.target as Node) &&
        textareaRef.current && !textareaRef.current.contains(e.target as Node)
      ) {
        contour.dismiss();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contour.isVisible, contour]);

  // Global keydown listener for Cmd+K shortcut and type-to-chat
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      // Cmd+K / Ctrl+K: Toggle Contour command palette
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        if (contour.isVisible) {
          contour.dismiss();
          setMessage('');
        } else {
          textareaRef.current?.focus();
          setMessage('/');
          contour.analyze('/');
        }
        return;
      }

      // Check if any input element is currently focused
      const activeElement = document.activeElement;
      if (activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.tagName === 'SELECT' ||
        activeElement.getAttribute('contenteditable') === 'true'
      )) {
        return; // Don't interfere with other inputs
      }

      // Check if the key is a printable character
      if (
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey
      ) {
        // Focus the textarea and let the browser handle the input
        textareaRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [contour]);

  const handlePlusMenuSelect = useCallback((option: PlusMenuOption) => {
    setSelectedPlusOption(option);
    setShowPlusMenu(false);

    if (option === 'upload-photos') {
      fileInputRef.current?.click();
    } else if (option === 'upload-file') {
      docInputRef.current?.click();
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Don't send messages when contour is focused (textbox belongs to the tool)
    if (contour.isFocused) return;
    if ((message.trim() || selectedImages.length > 0 || selectedFile) && !isLoading && !isUploading && !isFileReading) {
      // Close mention modal when sending message
      setShowMentionCall(false);

      // The composer empties the moment the message leaves it. It used to be
      // cleared after `await onSendMessage(...)`, which only resolves once the
      // model has finished answering — so the text the user just sent sat in
      // the (disabled, faded) textarea for the whole generation.
      const outgoingMessage = message;
      const outgoingImages = selectedImages;
      const outgoingFile = selectedFile;
      const outgoingFileText = fileExtractedText;
      const outgoingAttachment = attachedFile;
      const restoreComposer = () => {
        setMessage(outgoingMessage);
        setSelectedImages(outgoingImages);
        // Clearing the previews revoked their object URLs (see the cleanup
        // effect above), so put the thumbnails back with fresh ones.
        setImagePreviewUrls(outgoingImages.map(file => URL.createObjectURL(file)));
        setSelectedFile(outgoingFile);
        setFileExtractedText(outgoingFileText);
        setAttachedFile(outgoingAttachment);
      };

      setMessage('');
      contour.dismiss();

      const activeMode = selectedPlusOption && selectedPlusOption !== 'upload-photos' && selectedPlusOption !== 'upload-file' ? selectedPlusOption : undefined;

      if (outgoingImages.length > 0) {
        setSelectedImages([]);
        setImagePreviewUrls([]);
        setIsUploading(true);
        try {
          // Get dimensions of the first image (for edit operations)
          const firstImageDimensions = await getImageDimensions(outgoingImages[0]);

          const base64Images = await Promise.all(outgoingImages.map(convertImageToBase64));

          // Upload images using the new service (uses Supabase for logged in users, ImgBB for anonymous)
          const uploadResults = await Promise.all(
            base64Images.map(base64Image => uploadImage(base64Image, user?.id))
          );

          const successfulUploads = uploadResults.filter(result => result.success);

          if (successfulUploads.length === 0) {
            alert('Failed to upload images. Please try again.');
            setIsUploading(false);
            restoreComposer();
            return;
          }

          const publicUrls = successfulUploads.map(result => result.url);

          setIsUploading(false);
          await onSendMessage(outgoingMessage, base64Images, publicUrls, firstImageDimensions, undefined, activeMode);
        } catch (error) {
          setIsUploading(false);
          restoreComposer();
          alert('Failed to process images. Please try again.');
          console.error('Error processing images:', error);
        }
      } else if (outgoingFile) {
        setSelectedFile(null);
        setFileExtractedText(null);
        setAttachedFile(null);
        if (docInputRef.current) docInputRef.current.value = '';
        setIsUploading(true);
        try {
          setIsUploading(false);
          // A spreadsheet has no text worth extracting, and used not to be
          // sendable at all for that reason. It goes now: the model reaches it
          // through run_python instead of through the prompt.
          await onSendMessage(
            outgoingMessage, undefined, undefined, undefined, undefined, activeMode,
            outgoingFileText || undefined, outgoingFile.name,
            outgoingAttachment ? [outgoingAttachment] : undefined,
          );
        } catch (error) {
          setIsUploading(false);
          restoreComposer();
          alert('Failed to process file. Please try again.');
          console.error('Error processing file:', error);
        }
      } else {
        await onSendMessage(outgoingMessage, undefined, undefined, undefined, undefined, activeMode);
      }
    }
  };

  const handleCopyValue = useCallback((value: string) => {
    navigator.clipboard.writeText(value).catch(() => { });
  }, []);

  const handleContourCommandSelect = useCallback((command: ContourCommand) => {
    recordCommandUsage(command.id);
    switch (command.action.type) {
      case 'navigate':
        navigate(command.action.path);
        setMessage('');
        contour.dismiss();
        break;
      case 'mode': {
        const modeMap: Record<string, PlusMenuOption> = {
          'web-coding': 'web-coding',
          'music-compose': 'music-compose',
          'tm-healthcare': 'tm-healthcare',
        };
        const plusOption = modeMap[command.action.mode];
        if (plusOption) {
          handlePlusMenuSelect(plusOption);
        }
        setMessage('');
        contour.dismiss();
        break;
      }
      case 'clipboard': {
        let clipboardValue = '';
        if (command.action.handler === 'uuid') {
          clipboardValue = crypto.randomUUID?.() ||
            'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
              const r = (Math.random() * 16) | 0;
              return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
            });
        } else if (command.action.handler === 'timestamp') {
          clipboardValue = Math.floor(Date.now() / 1000).toString();
        }
        if (clipboardValue) {
          navigator.clipboard.writeText(clipboardValue).catch(() => { });
        }
        setMessage('');
        contour.dismiss();
        break;
      }
      case 'inline':
        // Open the tool INSIDE the contour panel (focused mode)
        if (contour.focusOnModule(command.action.handler)) {
          setMessage('');
        } else {
          setMessage('');
          contour.dismiss();
        }
        break;
    }
  }, [navigate, contour, handlePlusMenuSelect]);

  /**
   * Get a copyable result value from the current module state
   */
  const getModuleCopyValue = (): string | null => {
    const mod = contour.state.module;
    if (!mod) return null;
    if (mod.calculator && !mod.calculator.isPartial) return mod.calculator.result.toString();
    if (mod.units && !mod.units.isPartial) return mod.units.toValue.toFixed(4).replace(/\.?0+$/, '');
    if (mod.currency?.toValue != null && !mod.currency.isPartial && !mod.currency.isLoading) return mod.currency.toValue.toFixed(2);
    if (mod.color) return mod.color.hex;
    if (mod.timezone && !mod.timezone.isPartial) return mod.timezone.toTime;
    if (mod.date && !mod.date.isPartial) return mod.date.display;
    if (mod.random) return mod.random.value;
    if (mod.translator?.translatedText && !mod.translator.isLoading) return mod.translator.translatedText;
    if (mod.dictionary?.meanings?.length && !mod.dictionary.isLoading) {
      const firstDef = mod.dictionary.meanings[0]?.definitions[0]?.definition;
      return firstDef ? `${mod.dictionary.word}: ${firstDef}` : null;
    }
    if (mod.wordcount) return `${mod.wordcount.words} words, ${mod.wordcount.characters} characters`;
    if (mod.lorem && !mod.lorem.isPartial) return mod.lorem.text;
    if (mod.jsonFormat?.isValid && !mod.jsonFormat.isPartial) return mod.jsonFormat.formatted;
    if (mod.base64 && !mod.base64.isPartial && !mod.base64.error) return mod.base64.mode === 'encode' ? mod.base64.encoded : mod.base64.decoded;
    if (mod.urlEncode && !mod.urlEncode.isPartial && !mod.urlEncode.error) return mod.urlEncode.mode === 'encode' ? mod.urlEncode.encoded : mod.urlEncode.decoded;
    if (mod.hash?.sha256 && !mod.hash.isLoading) return mod.hash.sha256;
    if (mod.regex?.isValid && mod.regex.pattern) return `/${mod.regex.pattern}/${mod.regex.flags}`;
    return null;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Command palette navigation
    if (contour.isVisible && contour.state.mode === 'commands') {
      if (e.key === 'ArrowUp') { e.preventDefault(); contour.selectUp(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); contour.selectDown(); return; }
      if (e.key === 'Tab') { e.preventDefault(); contour.selectDown(); return; }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (contour.selectedCommand) handleContourCommandSelect(contour.selectedCommand);
        return;
      }
    }

    // Module mode: Enter copies result or starts timer
    if (contour.isVisible && contour.state.mode === 'module' && contour.state.module) {
      if (e.key === 'Enter' && !e.shiftKey) {
        const mod = contour.state.module;

        // Timer: Enter starts the timer
        if (mod.id === 'timer' && mod.timer && !mod.timer.isRunning && !mod.timer.isComplete) {
          e.preventDefault();
          contour.startTimer();
          return;
        }

        // Interactive modules that consume Enter
        if (['quick-note', 'quick-event', 'navigation'].includes(mod.id)) {
          e.preventDefault();
          if (mod.id === 'quick-note' && mod.quickNote) {
            saveQuickNote(mod.quickNote.content);
            contour.dismiss();
            setMessage('');
          } else if (mod.id === 'quick-event' && mod.quickEvent) {
            saveQuickEvent(mod.quickEvent);
            contour.dismiss();
            setMessage('');
          } else if (mod.id === 'navigation' && mod.navigation) {
            navigate(mod.navigation.path);
            contour.dismiss();
            setMessage('');
          }
          return;
        }

        // Other modules: Enter copies the result
        const copyValue = getModuleCopyValue();
        if (copyValue) {
          e.preventDefault();
          navigator.clipboard.writeText(copyValue).catch(() => { });
          if (!contour.isFocused) {
            setMessage('');
            contour.dismiss();
          }
          return;
        }

        // In focused mode with no result yet, don't send message
        if (contour.isFocused) {
          e.preventDefault();
          return;
        }
      }
    }

    if (e.key === 'Enter' && !e.shiftKey && isDesktop) {
      e.preventDefault();
      handleSubmit(e);
    } else if (e.key === 'Escape') {
      if (contour.isVisible) {
        contour.dismiss();
        return;
      }
      if (showPlusMenu) setShowPlusMenu(false);
      if (showMentionCall) setShowMentionCall(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setMessage(newValue);

    // Feed input to Contour for smart detection
    contour.analyze(newValue);

    if (newValue.endsWith('@')) {
      setShowMentionCall(true);
    } else if (showMentionCall) {
      // Check if user has completed typing a mention (case-insensitive)
      const completedMention = newValue.match(/@(girlie|pro)\s/i);
      if (completedMention || !newValue.includes('@')) {
        setShowMentionCall(false);
      }
    }
  };

  const handleMentionSelect = (command: string) => {
    const cursorPosition = textareaRef.current?.selectionStart || message.length;
    const newMessage = message.slice(0, cursorPosition) + command.slice(1) + ' ' + message.slice(cursorPosition);
    setMessage(newMessage);
    setShowMentionCall(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
      const newCursorPosition = cursorPosition + command.length;
      textareaRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
    }
  };

  const plusOptionIcons: Record<PlusMenuOption, React.ComponentType<{ className?: string }>> = {
    'upload-photos': ImagePlus,
    'upload-file': FileText,
    'web-coding': Code,
    'music-compose': Music,
    'tm-healthcare': HeartPulse,
  };

  const handlePlusButtonClick = () => {
    if (selectedPlusOption) {
      // Already has a selected option — reset and show card
      setSelectedPlusOption(null);
      setShowPlusMenu(true);
    } else {
      // Toggle the card
      setShowPlusMenu(prev => !prev);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 4) {
      alert('You can upload a maximum of 4 images.');
      return;
    }
    const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const validImageFiles = files.filter(file => validImageTypes.includes(file.type));
    if (validImageFiles.length === 0) {
      alert('Please select valid image files (JPEG, PNG, GIF, WebP).');
      return;
    }
    setSelectedImages(validImageFiles);
    const urls = validImageFiles.map(file => URL.createObjectURL(file));
    setImagePreviewUrls(urls);
  };

  const readTextFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        // Basic check for binary content (null bytes)
        if (text.includes('\u0000')) {
          reject(new Error("The file appears to be a binary file. Only text files and PDFs are supported."));
        } else {
          resolve(text);
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file."));
      reader.readAsText(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const isPdf = file.type === 'application/pdf' || ext === 'pdf';
    const isText = isTextFile(file);
    const isData = DATA_EXTENSIONS.includes(ext);

    if (!isPdf && !isText && !isData) {
      alert('Unsupported file format. Please upload a PDF, spreadsheet, document, data file, or text file.');
      return;
    }

    if (file.size > MAX_ATTACHMENT_BYTES) {
      alert('File size must be under 25 MB.');
      return;
    }

    setSelectedFile(file);
    setIsFileReading(true);
    try {
      // Kept whatever else happens: the extracted text is for the prompt, and
      // the bytes are for run_python. A spreadsheet has no useful text at all
      // and is entirely the second.
      setAttachedFile(await keepAttachment(file));
      let extractedText = '';
      if (isData) {
        extractedText = '';
      } else if (isPdf) {
        const { extractPdfText } = await import('../../services/pdf/pdfService');
        const result = await extractPdfText(file);
        extractedText = result.text;
      } else {
        extractedText = await readTextFile(file);
        
        // Truncate to a safe limit if it's too large (e.g. 100,000 characters)
        const MAX_CHARS = 100000;
        if (extractedText.length > MAX_CHARS) {
          const keepEnd = Math.floor(MAX_CHARS * 0.15);
          const keepStart = MAX_CHARS - keepEnd;
          extractedText = extractedText.slice(0, keepStart)
            + '\n\n[... DOCUMENT TRUNCATED — middle portion omitted due to length. The beginning and end of the document are shown. ...]\n\n'
            + extractedText.slice(-keepEnd);
        }
      }
      setFileExtractedText(extractedText);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to read file. Please try again.');
      setSelectedFile(null);
    } finally {
      setIsFileReading(false);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFileExtractedText(null);
    setAttachedFile(null);
    if (docInputRef.current) docInputRef.current.value = '';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (isDesktop) {
      e.preventDefault();
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    if (!isDesktop) return;
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);

    // Check if any dropped file is a PDF or text file
    const docFile = files.find(f => {
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      return f.type === 'application/pdf' || ext === 'pdf' || isTextFile(f) || DATA_EXTENSIONS.includes(ext);
    });

    if (docFile) {
      if (docFile.size > MAX_ATTACHMENT_BYTES) {
        alert('File size must be under 25 MB.');
        return;
      }

      const ext = docFile.name.split('.').pop()?.toLowerCase() || '';
      const isPdf = docFile.type === 'application/pdf' || ext === 'pdf';
      const isData = DATA_EXTENSIONS.includes(ext);

      setSelectedFile(docFile);
      setSelectedPlusOption('upload-file');
      setIsFileReading(true);
      try {
        setAttachedFile(await keepAttachment(docFile));
        let extractedText = '';
        if (isData) {
          extractedText = '';
        } else if (isPdf) {
          const { extractPdfText } = await import('../../services/pdf/pdfService');
          const result = await extractPdfText(docFile);
          extractedText = result.text;
        } else {
          extractedText = await readTextFile(docFile);
          
          // Truncate to a safe limit if it's too large (e.g. 100,000 characters)
          const MAX_CHARS = 100000;
          if (extractedText.length > MAX_CHARS) {
            const keepEnd = Math.floor(MAX_CHARS * 0.15);
            const keepStart = MAX_CHARS - keepEnd;
            extractedText = extractedText.slice(0, keepStart)
              + '\n\n[... DOCUMENT TRUNCATED — middle portion omitted due to length. The beginning and end of the document are shown. ...]\n\n'
              + extractedText.slice(-keepEnd);
          }
        }
        setFileExtractedText(extractedText);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to read file. Please try again.');
        setSelectedFile(null);
      } finally {
        setIsFileReading(false);
      }
      return;
    }

    if (files.length > 4) {
      alert('You can upload a maximum of 4 images.');
      return;
    }
    const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const validImageFiles = files.filter(file => validImageTypes.includes(file.type));
    if (validImageFiles.length === 0) {
      alert('Please drop valid image or document files.');
      return;
    }
    setSelectedImages(validImageFiles);
    const urls = validImageFiles.map(file => URL.createObjectURL(file));
    setImagePreviewUrls(urls);
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviewUrls(prev => {
      const url = prev[index];
      URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== index);
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto sticky bottom-4">
      {/* Reply preview */}
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex items-center gap-2 mb-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl"
          >
            <CornerDownRight className="w-4 h-4 text-purple-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-purple-400 text-xs font-medium">
                Replying to {replyTo.isAI ? 'TimeMachine' : replyTo.sender_nickname || 'User'}
              </span>
              <p className="text-white/50 text-sm truncate">{replyTo.content}</p>
            </div>
            {onClearReply && (
              <button
                type="button"
                onClick={onClearReply}
                className="p-1 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {imagePreviewUrls.length > 0 && currentPersona === 'default' && (
        <div className="flex gap-2 mb-4">
          {imagePreviewUrls.map((url, index) => (
            <ImagePreview
              key={index}
              url={url}
              onRemove={() => removeImage(index)}
              isUploading={isUploading}
            />
          ))}
        </div>
      )}
      {imagePreviewUrls.length > 0 && currentPersona !== 'default' && (
        <div className="flex gap-2 mb-4">
          {imagePreviewUrls.map((url, index) => (
            <ImagePreview
              key={index}
              url={url}
              onRemove={() => removeImage(index)}
              isUploading={isUploading}
            />
          ))}
        </div>
      )}
      {selectedFile && (
        <div className="flex gap-2 mb-4">
          <FilePreview
            fileName={selectedFile.name}
            fileSize={formatFileSize(selectedFile.size)}
            onRemove={removeFile}
            isUploading={isUploading || isFileReading}
          />
        </div>
      )}
      <div className="relative" onDragOver={handleDragOver} onDrop={handleDrop}>
        <div className="relative flex items-center gap-2">
          <input
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={handleImageSelect}
            ref={fileInputRef}
            multiple
          />
          <input
            type="file"
            accept="application/pdf,text/*,application/json,application/javascript,application/typescript,.md,.txt,.js,.jsx,.ts,.tsx,.json,.html,.css,.csv,.xml,.yaml,.yml,.ini,.cfg,.log,.xlsx,.xls,.xlsm,.docx,.pptx,.ods,.odt,.tsv,.parquet,.zip,.rtf,.sqlite,.db"
            className="hidden"
            onChange={handleFileSelect}
            ref={docInputRef}
          />

          <div className="relative" ref={plusMenuRef}>
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handlePlusButtonClick}
              disabled={isLoading || isUploading}
              className={`p-3 rounded-full ${theme.text} disabled:opacity-50 relative group transition-all duration-300`}
              style={{
                background: `linear-gradient(135deg, ${(personaStyles.tintColors as Record<string, string>)[currentPersona] || personaStyles.tintColors.default}, rgb(var(--tm-ink-rgb) / 0.05))`,
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: `1px solid ${(personaStyles.borderColors as Record<string, string>)[currentPersona] || personaStyles.borderColors.default}`,
                boxShadow: `${(personaStyles.glowShadow as Record<string, string>)[currentPersona] || personaStyles.glowShadow.default}, inset 0 1px 0 rgb(var(--tm-edge-rgb) / 0.15)`
              }}
            >
              {selectedPlusOption ? (
                (() => {
                  const IconComponent = plusOptionIcons[selectedPlusOption];
                  return <IconComponent className="w-5 h-5 relative z-10" />;
                })()
              ) : (
                <Plus className="w-5 h-5 relative z-10" />
              )}
            </motion.button>

            <PlusMenu
              isVisible={showPlusMenu}
              onSelect={handlePlusMenuSelect}
            />
          </div>

          <div className="relative flex-1">
            <div className="relative flex items-center">
              <motion.textarea
                ref={textareaRef}
                value={message}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="Type / for contour"
                disabled={isLoading || isUploading}
                className={`w-full px-6 pr-32 rounded-[28px]
                  ${theme.input.text} placeholder-gray-400
                  outline-hidden
                  disabled:opacity-50
                  transition-all duration-300
                  text-base resize-none
                  overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]`}
                style={{
                  background: 'var(--tm-pane-bg)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid var(--tm-pane-border)',
                  boxShadow: 'var(--tm-input-shadow)',
                  fontSize: '1rem',
                  minHeight: '56px',
                  maxHeight: '150px',
                  paddingTop: '16px',
                  paddingBottom: '16px',
                  lineHeight: '24px'
                }}
                rows={1}
              />

              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <SpeechTranscriptionButton
                  value={message}
                  onTranscript={setMessage}
                  disabled={isLoading || isUploading}
                  currentPersona={currentPersona}
                />

                <motion.button
                  type={canStop ? 'button' : 'submit'}
                  onClick={canStop ? onStop : undefined}
                  aria-label={canStop ? 'Stop generating' : 'Send message'}
                  title={canStop ? 'Stop generating' : undefined}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={canStop
                    ? false
                    : (isLoading || isUploading || isFileReading || (!message.trim() && selectedImages.length === 0 && !selectedFile))}
                  className={`p-3 rounded-full ${theme.text} disabled:opacity-50 relative group transition-all duration-300`}
                  style={{
                    background: `linear-gradient(135deg, ${(personaStyles.tintColors as Record<string, string>)[currentPersona] || personaStyles.tintColors.default}, rgb(var(--tm-ink-rgb) / 0.05))`,
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: `1px solid ${(personaStyles.borderColors as Record<string, string>)[currentPersona] || personaStyles.borderColors.default}`,
                    boxShadow: `${(personaStyles.glowShadow as Record<string, string>)[currentPersona] || personaStyles.glowShadow.default}, inset 0 1px 0 rgb(var(--tm-edge-rgb) / 0.15)`
                  }}
                >
                  {canStop ? (
                    <Square className="w-5 h-5 relative z-10 fill-current" />
                  ) : isLoading || isUploading ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <SendIcon className="w-5 h-5 relative z-10" />
                  )}
                </motion.button>
              </div>
            </div>

            <MentionCall
              isVisible={showMentionCall}
              onSelect={handleMentionSelect}
              currentPersona={currentPersona}
              isGroupMode={isGroupMode}
              participants={participants}
              currentUserId={user?.id}
            />

            {/* TimeMachine Contour - Smart Assist Overlay */}
            <div ref={contourRef}>
              <ContourPanel
                state={contour.state}
                isVisible={contour.isVisible}
                onCommandSelect={handleContourCommandSelect}
                selectedIndex={contour.state.selectedIndex}
                persona={currentPersona}
                onTimerStart={contour.startTimer}
                onTimerToggle={contour.toggleTimer}
                onTimerReset={contour.resetTimer}
                onSetTimerDuration={contour.setTimerDuration}
                onCopyValue={handleCopyValue}
                onBack={contour.dismiss}
              />
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
