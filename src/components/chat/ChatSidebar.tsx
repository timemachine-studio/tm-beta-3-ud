import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Brain, HeartPulse, LogIn, PanelLeftClose, Plus, Settings, User, Wand2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { chatService } from '../../services/chat/chatService';
import type { ChatSummary } from '../../services/chat/chatArchive';
import { AgentsModal } from '../agents/AgentsModal';
import TimeMachineMark from '../icons/TimeMachineMark';

/* The rail: what stays on the left. The mark and the name, a new chat, the
   apps, then the recent chats grouped by when they were last touched, and
   at the foot the account with settings beside it. It is a column beside
   the transcript on a wide screen and a slide-over on a phone; the shell
   decides which. Kept quiet: one icon per app row, none on a chat. */

interface ChatSidebarProps {
  open: boolean;
  /** Below the desktop breakpoint the rail is an overlay with a scrim. */
  overlay: boolean;
  onClose: () => void;
  currentSessionId: string | null;
  /** Bumped whenever the archive may have changed, so the list refreshes. */
  archiveVersion: number;
  onNewChat: () => void;
  onOpenSession: (id: string) => void;
  onOpenAuth: () => void;
  onOpenAccount: () => void;
  onOpenSettings: () => void;
  hue: string;
}

const RECENTS = 30;

/** Recents fall into the buckets a person thinks in, not a flat list. */
function bucketOf(iso: string, now: number): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 'Older';
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const day = 24 * 60 * 60 * 1000;
  if (t >= startOfToday.getTime()) return 'Today';
  if (t >= startOfToday.getTime() - day) return 'Yesterday';
  if (t >= startOfToday.getTime() - 7 * day) return 'Previous 7 days';
  if (t >= startOfToday.getTime() - 30 * day) return 'Previous 30 days';
  return 'Older';
}

const BUCKET_ORDER = ['Today', 'Yesterday', 'Previous 7 days', 'Previous 30 days', 'Older'];

function Row({ icon: Icon, label, onClick, active }: {
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      data-active={active ? 'true' : 'false'}
      className="tm-rail-row flex w-full items-center gap-2.5 text-left"
      title={label}
    >
      {Icon && <Icon className="h-[15px] w-[15px] shrink-0" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.5)' }} aria-hidden="true" />}
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}

export function ChatSidebar({
  open, overlay, onClose, currentSessionId, archiveVersion, onNewChat, onOpenSession,
  onOpenAuth, onOpenAccount, onOpenSettings, hue,
}: ChatSidebarProps) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [recents, setRecents] = useState<ChatSummary[]>([]);
  const [showAgents, setShowAgents] = useState(false);

  // The list is a summary read, never the full archive. It is bucketed by
  // when each chat was last touched, against the clock at the moment of the
  // read — so the grouping is data, not something recomputed per render.
  const [groups, setGroups] = useState<{ label: string; chats: ChatSummary[] }[]>([]);
  useEffect(() => {
    if (!open) return;
    let live = true;
    chatService.listChats({ limit: RECENTS })
      .then((rows) => {
        if (!live) return;
        setRecents(rows);
        const now = Date.now();
        const map = new Map<string, ChatSummary[]>();
        for (const c of rows) {
          const key = bucketOf(c.updatedAt || c.createdAt, now);
          const list = map.get(key);
          if (list) list.push(c); else map.set(key, [c]);
        }
        setGroups(BUCKET_ORDER.filter((k) => map.has(k)).map((k) => ({ label: k, chats: map.get(k)! })));
      })
      .catch(() => { if (live) { setRecents([]); setGroups([]); } });
    return () => { live = false; };
  }, [open, archiveVersion, user?.id]);

  useEffect(() => {
    if (!open || !overlay) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, overlay, onClose]);

  const go = (path: string) => () => { navigate(path); if (overlay) onClose(); };
  const then = (fn: () => void) => () => { fn(); if (overlay) onClose(); };

  const rail = (
    <div className="flex h-full min-h-0 flex-col" style={{ '--tm-rail-hue': hue } as React.CSSProperties}>
      {/* The mark and the name */}
      <div className="flex items-center justify-between gap-2 px-3 pt-3">
        <button
          type="button"
          onClick={then(onNewChat)}
          className="flex min-w-0 items-center gap-2 rounded-xl px-1.5 py-1 text-left"
          aria-label="TimeMachine — new chat"
        >
          <TimeMachineMark className="h-6 w-6 shrink-0" />
          <span
            className="truncate text-[16px] font-bold tracking-tight text-purple-400"
            style={{ fontFamily: 'Montserrat, var(--font-display)', textShadow: '0 0 18px rgb(168 85 247 / 0.45)' }}
          >
            TimeMachine
          </span>
        </button>
        <button type="button" onClick={onClose} aria-label="Hide sidebar" className="tm-notes-icon">
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      {/* New chat */}
      <div className="px-3 pt-3">
        <button
          type="button"
          onClick={then(onNewChat)}
          className="tm-press tm-glass-pill flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-[14px] font-medium"
          style={{ border: '1px solid rgb(var(--tm-ink-rgb) / 0.12)', color: 'rgb(var(--tm-ink-rgb) / 0.92)' }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> New chat
        </button>
      </div>

      {/* Apps */}
      <nav className="px-2 pt-2" aria-label="Apps">
        <Row icon={BookOpen} label="Notes" onClick={go('/notes')} />
        <Row icon={HeartPulse} label="Healthcare" onClick={go('/healthcare')} />
        <Row icon={Brain} label="Memories" onClick={go('/memories')} />
        <Row icon={Wand2} label="Flight Controls" onClick={then(() => setShowAgents(true))} />
      </nav>

      {/* Recents, by when */}
      <div className="tm-notes-scroll tm-rail-recents min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {recents.length === 0 ? (
          <>
            <p className="tm-rail-section">Chats</p>
            <p className="px-3 py-1 text-[13px]" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.42)' }}>
              {user ? 'No chats yet.' : 'Chats you start will show up here.'}
            </p>
          </>
        ) : groups.map((g) => (
          <section key={g.label} aria-label={g.label}>
            <p className="tm-rail-section">{g.label}</p>
            {g.chats.map((c) => (
              <Row
                key={c.id}
                label={c.title || 'New chat'}
                active={c.id === currentSessionId}
                onClick={then(() => onOpenSession(c.id))}
              />
            ))}
          </section>
        ))}
        {recents.length > 0 && (
          <button type="button" onClick={go('/history')} className="tm-rail-row mt-1 flex w-full items-center text-left text-[13px]" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.5)' }}>
            All chats
          </button>
        )}
      </div>

      {/* Foot: the account, with settings beside it */}
      <div className="flex items-center gap-1 px-2 pb-2 pt-2" style={{ borderTop: '1px solid rgb(var(--tm-ink-rgb) / 0.06)' }}>
        <button
          type="button"
          onClick={then(user ? onOpenAccount : onOpenAuth)}
          className="tm-rail-row flex min-w-0 flex-1 items-center gap-2.5 text-left"
          style={{ minHeight: 44 }}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full" style={{ border: '1px solid rgb(var(--tm-ink-rgb) / 0.12)' }}>
            {user && profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : user ? (
              <User className="h-3.5 w-3.5" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.7)' }} aria-hidden="true" />
            ) : (
              <LogIn className="h-3.5 w-3.5" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.7)' }} aria-hidden="true" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px]" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.92)' }}>
              {user ? profile?.nickname || 'My account' : 'Log in or sign up'}
            </span>
            <span className="block truncate text-[12px]" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.45)' }}>
              {user ? 'Account' : 'Unlimited chats with an ID'}
            </span>
          </span>
        </button>
        <button type="button" onClick={then(onOpenSettings)} aria-label="Settings & theme" title="Settings & theme" className="tm-notes-icon shrink-0">
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      <AnimatePresence initial={false}>
        {open && (
          <>
            {overlay && (
              <motion.div
                key="scrim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 z-[55]"
                style={{ background: 'rgb(var(--tm-paper-rgb) / 0.5)' }}
                aria-hidden="true"
              />
            )}
            <motion.aside
              key="rail"
              initial={overlay ? { x: -280 } : { width: 0, opacity: 0 }}
              animate={overlay ? { x: 0 } : { width: 272, opacity: 1 }}
              exit={overlay ? { x: -280 } : { width: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className={`tm-rail shrink-0 overflow-hidden ${overlay ? 'fixed inset-y-0 left-0 z-[60] w-[272px] max-w-[85vw]' : 'relative h-full'}`}
              aria-label="Sidebar"
            >
              <div className="h-full w-[272px] max-w-[85vw]">{rail}</div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <AgentsModal isOpen={showAgents} onClose={() => setShowAgents(false)} onSignIn={onOpenAuth} />
    </>
  );
}
