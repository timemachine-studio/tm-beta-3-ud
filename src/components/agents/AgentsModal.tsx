import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Switch from '@radix-ui/react-switch';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LockKeyhole,
  Palette,
  PenLine,
  RefreshCw,
  Server,
  Sigma,
  Sparkles,
  X,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { getFlightControls, setFlightControlEnabled } from '../../services/flightControls/flightControlsService';
import type { EffectiveFlightControl, FlightControlKind } from '../../types/flightControls';

interface AgentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignIn?: () => void;
}

const iconMap = {
  palette: Palette,
  'pen-line': PenLine,
  sigma: Sigma,
  server: Server,
  sparkles: Sparkles,
} as const;

export function AgentsModal({ isOpen, onClose, onSignIn }: AgentsModalProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<FlightControlKind>('skill');
  const [items, setItems] = useState<EffectiveFlightControl[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await getFlightControls(user?.id));
    } catch (loadError) {
      console.error('Failed to load Flight Controls:', loadError);
      setError('Flight Controls could not be loaded. Run the Supabase setup script, then retry.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  const visibleItems = useMemo(() => items.filter(item => item.kind === activeTab), [activeTab, items]);
  const enabledMcpCount = items.filter(item => item.kind === 'mcp' && item.enabled).length;

  const toggleItem = async (item: EffectiveFlightControl, enabled: boolean) => {
    if (!user || savingIds.has(item.id)) return;
    if (item.kind === 'mcp' && enabled && enabledMcpCount >= 5) {
      setError('You can enable up to five MCP servers at once.');
      return;
    }

    const previous = item.enabled;
    setError(null);
    setItems(current => current.map(candidate => candidate.id === item.id ? { ...candidate, enabled } : candidate));
    setSavingIds(current => new Set(current).add(item.id));
    try {
      await setFlightControlEnabled(user.id, item.id, enabled);
    } catch (saveError) {
      console.error('Failed to save Flight Control:', saveError);
      setItems(current => current.map(candidate => candidate.id === item.id ? { ...candidate, enabled: previous } : candidate));
      setError(`Couldn't update ${item.name}. Please try again.`);
    } finally {
      setSavingIds(current => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }
  };

  const handleSignIn = () => {
    onClose();
    onSignIn?.();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog.Root open={isOpen} onOpenChange={open => !open && onClose()}>
          <Dialog.Portal>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`fixed inset-0 ${theme.modal.overlay} backdrop-blur-md z-50`}
              />
            </Dialog.Overlay>

            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                className="fixed inset-0 flex items-center justify-center p-4 z-50"
              >
                <div className={`relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-black/55 shadow-2xl backdrop-blur-3xl ${theme.glow.secondary}`}>
                  <div className="border-b border-white/10 px-6 pb-4 pt-6 sm:px-8">
                    <Dialog.Title className={`text-2xl font-light tracking-wide ${theme.text}`}>
                      Flight Controls
                    </Dialog.Title>
                    <Dialog.Description className={`mt-1 text-sm ${theme.text} opacity-55`}>
                      Choose which specialized skills and external tools TimeMachine PRO may use.
                    </Dialog.Description>

                    <div className="mt-5 flex gap-2" role="tablist" aria-label="Flight Control categories">
                      {(['skill', 'mcp'] as const).map(tab => (
                        <button
                          key={tab}
                          role="tab"
                          aria-selected={activeTab === tab}
                          onClick={() => setActiveTab(tab)}
                          className={`rounded-full px-4 py-2 text-sm transition ${activeTab === tab ? 'bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-300/25' : 'bg-white/5 text-white/50 hover:text-white/80'}`}
                        >
                          {tab === 'skill' ? 'Skills' : 'MCP servers'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="min-h-[280px] overflow-y-auto px-6 py-5 sm:px-8">
                    {loading ? (
                      <div className="space-y-3" aria-label="Loading Flight Controls">
                        {[0, 1, 2].map(index => <div key={index} className="h-24 animate-pulse rounded-2xl bg-white/5" />)}
                      </div>
                    ) : error && items.length === 0 ? (
                      <div className="flex min-h-[230px] flex-col items-center justify-center text-center">
                        <p className="max-w-sm text-sm text-white/55">{error}</p>
                        <button onClick={load} className="mt-4 flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white/80 hover:bg-white/15">
                          <RefreshCw className="h-4 w-4" /> Retry
                        </button>
                      </div>
                    ) : visibleItems.length === 0 ? (
                      <div className="flex min-h-[230px] items-center justify-center text-center text-sm text-white/45">
                        No {activeTab === 'skill' ? 'skills' : 'MCP servers'} have been published yet.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {visibleItems.map(item => {
                          const Icon = iconMap[item.icon_name as keyof typeof iconMap] || (item.kind === 'mcp' ? Server : Sparkles);
                          const saving = savingIds.has(item.id);
                          return (
                            <div key={item.id} className="flex items-start gap-4 rounded-2xl border border-white/8 bg-white/[0.035] p-4">
                              <div className={`mt-0.5 rounded-xl p-2.5 ${item.kind === 'mcp' ? 'bg-violet-400/10 text-violet-300' : 'bg-cyan-400/10 text-cyan-300'}`}>
                                <Icon className="h-5 w-5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-sm font-semibold text-white/90">{item.name}</h3>
                                  <span className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-cyan-200/70">PRO</span>
                                  {item.kind === 'mcp' && (
                                    <span className="text-[10px] text-white/35">{item.mcp_allowed_tools.length} allowed tool{item.mcp_allowed_tools.length === 1 ? '' : 's'}</span>
                                  )}
                                </div>
                                <p className="mt-1 text-xs leading-relaxed text-white/48">{item.description}</p>
                                {item.kind === 'mcp' && (
                                  <p className="mt-2 flex items-center gap-1 text-[11px] text-white/35">
                                    <LockKeyhole className="h-3 w-3" /> Unapproved actions always ask first
                                  </p>
                                )}
                              </div>
                              <Switch.Root
                                checked={item.enabled}
                                disabled={!user || saving}
                                onCheckedChange={enabled => toggleItem(item, enabled)}
                                aria-label={`${item.enabled ? 'Disable' : 'Enable'} ${item.name}`}
                                className="relative mt-1 h-6 w-11 shrink-0 rounded-full bg-white/10 transition data-[state=checked]:bg-cyan-400/45 disabled:cursor-not-allowed disabled:opacity-45"
                              >
                                <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
                              </Switch.Root>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {error && items.length > 0 && <p className="mt-4 text-center text-xs text-rose-300/80">{error}</p>}
                  </div>

                  {!user && (
                    <div className="flex items-center justify-between gap-4 border-t border-white/10 bg-white/[0.025] px-6 py-4 sm:px-8">
                      <p className="text-xs text-white/45">Sign in to save settings and use capabilities.</p>
                      <button onClick={handleSignIn} className="shrink-0 rounded-full bg-cyan-300/15 px-4 py-2 text-sm text-cyan-100 ring-1 ring-cyan-200/20 hover:bg-cyan-300/20">
                        Sign in
                      </button>
                    </div>
                  )}

                  <Dialog.Close asChild>
                    <button aria-label="Close Flight Controls" className="absolute right-4 top-4 rounded-full bg-white/5 p-2 text-white/50 transition hover:bg-white/10 hover:text-white">
                      <X className="h-5 w-5" />
                    </button>
                  </Dialog.Close>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </AnimatePresence>
  );
}
