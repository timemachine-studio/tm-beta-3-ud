import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getFlightControls } from '../services/flightControls/flightControlsService';
import type { EffectiveFlightControl } from '../types/flightControls';
import {
  getAdminStatus,
  streamAdminPlayground,
  type AdminPreset,
  type AdminPlaygroundConfig,
} from '../services/admin/adminService';
import type { Message } from '../types/chat';

const STORAGE_KEY = 'tm_admin_playground_v1';
const DEFAULT_CONFIG: AdminPlaygroundConfig = {
  customSystemPrompt: '',
  temperature: 0.8,
  maxTokens: 67200,
  enabledSkillSlugs: [],
  enabledMcpIds: [],
  customSkills: [],
  customMcpTools: [],
  enableSmartThinking: false,
};

function parseConfigParam(raw: string | null): AdminPlaygroundConfig {
  if (!raw) return { ...DEFAULT_CONFIG };
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    return {
      customSystemPrompt: typeof parsed.customSystemPrompt === 'string' ? parsed.customSystemPrompt : '',
      temperature: typeof parsed.temperature === 'number' ? parsed.temperature : DEFAULT_CONFIG.temperature,
      maxTokens: typeof parsed.maxTokens === 'number' ? parsed.maxTokens : DEFAULT_CONFIG.maxTokens,
      enabledSkillSlugs: Array.isArray(parsed.enabledSkillSlugs) ? parsed.enabledSkillSlugs : [],
      enabledMcpIds: Array.isArray(parsed.enabledMcpIds) ? parsed.enabledMcpIds : [],
      customSkills: Array.isArray(parsed.customSkills) ? parsed.customSkills : [],
      customMcpTools: Array.isArray(parsed.customMcpTools) ? parsed.customMcpTools : [],
      enableSmartThinking: parsed.enableSmartThinking === true,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function mergeConfig(prev: AdminPlaygroundConfig, patch: Partial<AdminPlaygroundConfig>): AdminPlaygroundConfig {
  return { ...prev, ...patch };
}

export interface AdminPlaygroundState {
  loading: boolean;
  notAdmin: boolean;
  presets: AdminPreset[];
  catalog: EffectiveFlightControl[];
  catalogLoading: boolean;
  config: AdminPlaygroundConfig;
  messages: Message[];
  isStreaming: boolean;
  status: string | null;
  error: string | null;
  setConfig: (patch: Partial<AdminPlaygroundConfig>) => void;
  applyPreset: (presetId: string) => void;
  resetToBase: () => void;
  clearChat: () => void;
  sendMessage: (text: string) => void;
  cancel: () => void;
}

export function useAdminPlayground(): AdminPlaygroundState {
  const { user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [notAdmin, setNotAdmin] = useState(false);
  const [presets, setPresets] = useState<AdminPreset[]>([]);
  const [catalog, setCatalog] = useState<EffectiveFlightControl[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [config, setConfigState] = useState<AdminPlaygroundConfig>(() =>
    parseConfigParam(searchParams.get('c')),
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Persist config to localStorage on every change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // ignore
    }
  }, [config]);

  const setConfig = useCallback((patch: Partial<AdminPlaygroundConfig>) => {
    setConfigState((prev) => {
      const next = mergeConfig(prev, patch);
      setSearchParams({ c: encodeURIComponent(JSON.stringify(next)) }, { replace: true });
      return next;
    });
  }, [setSearchParams]);

  const applyPreset = useCallback((presetId: string) => {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;
    setConfig({ customSystemPrompt: preset.prompt });
  }, [presets, setConfig]);

  const resetToBase = useCallback(() => {
    setConfig({ customSystemPrompt: '' });
  }, [setConfig]);

  // Gate: resolve admin status + presets. Redirect happens upstream in the route.
  useEffect(() => {
    if (authLoading) return;
    let mounted = true;
    (async () => {
      const status = await getAdminStatus();
      if (!mounted) return;
      if (!status.isAdmin) {
        setNotAdmin(true);
        setLoading(false);
        return;
      }
      setPresets(status.presets || []);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [authLoading]);

  // Load the flight-control catalog (skills + MCP servers) for toggling.
  useEffect(() => {
    if (authLoading || notAdmin) return;
    let mounted = true;
    (async () => {
      try {
        const items = await getFlightControls(user?.id);
        if (mounted) setCatalog(items);
      } catch (err) {
        console.error('Admin catalog load failed:', err);
      } finally {
        if (mounted) setCatalogLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [authLoading, notAdmin, user?.id]);

  // Seed config from localStorage if URL had no param.
  useEffect(() => {
    if (searchParams.get('c')) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setConfigState(mergeConfig(DEFAULT_CONFIG, JSON.parse(stored)));
    } catch {
      // ignore
    }
  }, [searchParams]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setStatus(null);
    setError(null);
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  function extractThinking(rawContent: string): { content: string; thinking?: string } {
    let thinking = '';
    let content = '';
    let isInside = false;
    let tagType: 'reason' | 'think' | null = null;
    let i = 0;
    while (i < rawContent.length) {
      if (!isInside) {
        const reasonStart = rawContent.indexOf('<reason>', i);
        const thinkStart = rawContent.indexOf('<think>', i);
        let startIdx = -1;
        let tagLen = 0;
        let curTag: 'reason' | 'think' | null = null;
        if (reasonStart !== -1 && (thinkStart === -1 || reasonStart < thinkStart)) {
          startIdx = reasonStart; tagLen = 8; curTag = 'reason';
        } else if (thinkStart !== -1) {
          startIdx = thinkStart; tagLen = 7; curTag = 'think';
        }
        if (startIdx !== -1) {
          content += rawContent.slice(i, startIdx);
          isInside = true; tagType = curTag; i = startIdx + tagLen;
        } else {
          content += rawContent.slice(i);
          break;
        }
      } else {
        const closeTag = tagType === 'think' ? '</think>' : '</reason>';
        const endIdx = rawContent.indexOf(closeTag, i);
        if (endIdx !== -1) {
          thinking += (thinking ? '\n\n' : '') + rawContent.slice(i, endIdx).trim();
          isInside = false; tagType = null; i = endIdx + closeTag.length;
        } else {
          thinking += (thinking ? '\n\n' : '') + rawContent.slice(i).trim();
          break;
        }
      }
    }
    return { content, thinking: thinking.trim() || undefined };
  }

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      setError(null);
      setStatus('thinking');

      const userMsg: Message = { id: Date.now(), content: trimmed, isAI: false };
      const aiMsg: Message = { id: Date.now() + 1, content: '', isAI: true };
      setMessages((prev) => [...prev, userMsg, aiMsg]);
      setIsStreaming(true);
      const controller = new AbortController();
      abortRef.current = controller;

      streamAdminPlayground(
        { messages: [...messages, userMsg], config, signal: controller.signal },
        {
          onChunk: (chunk) => {
            setMessages((prev) => {
              const rawContent = (prev[prev.length - 1] as any)?.rawContent || '';
              const newRaw = rawContent + chunk;
              const extracted = extractThinking(newRaw);
              return prev.map((msg, idx) => {
                if (idx !== prev.length - 1 || !msg.isAI) return msg;
                return { ...msg, content: extracted.content, thinking: extracted.thinking, rawContent: newRaw };
              });
            });
          },
          onStatusChange: (newStatus) => setStatus(newStatus),
          onComplete: () => {
            setIsStreaming(false);
            setStatus(null);
            abortRef.current = null;
          },
          onError: (err) => {
            setIsStreaming(false);
            abortRef.current = null;
            setStatus(null);
            setError(err.message);
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && last.isAI && !last.content) {
                next[next.length - 1] = { ...last, content: `⚠️ ${err.message}` };
              }
              return next;
            });
          },
        },
      );
    },
    [messages, config, isStreaming],
  );

  return {
    loading,
    notAdmin,
    presets,
    catalog,
    catalogLoading,
    config,
    messages,
    isStreaming,
    status,
    error,
    setConfig,
    applyPreset,
    resetToBase,
    clearChat,
    sendMessage,
    cancel,
  };
}