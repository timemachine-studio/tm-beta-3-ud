/**
 * The history page: every chat as a card on a wall.
 *
 * Each card carries when the chat was last touched, the name the namer gave
 * it and either the opening of the first answer or, when the chat was about
 * a thing with a picture, that picture (src/services/chat/chatTitleService).
 * Pinned cards come first. The controls float in the corners: back, filter,
 * search, and a new chat. A card's own menu — pin, rename, delete — opens
 * from the dots in its corner, a right click, or a long press.
 *
 * Storage goes through ChatService only; the page never knows which store
 * a person is on.
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft, Check, Download, MessageCircle, MoreHorizontal, Pencil, Pin, PinOff, Search, SlidersHorizontal, SquarePen, Trash2, Upload, Users, X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { DEV_MOCK_AUTH } from '../../context/devMockAuth';
import { AppAtmosphere } from '../shared/AppAtmosphere';
import { chatService, type ChatSession } from '../../services/chat/chatService';
import type { ChatCardMeta } from '../../services/chat/chatCards';
import { getUserGroupChats } from '../../services/groupChat/groupChatService';
import { parseChatImport } from '../../services/chat/storedChatValidation';
import { toLayoutPx } from '../../utils/pageZoom';
import {
  itemsFrom, matchesFilter, matchesQuery, whenLabel,
  type GroupChatItem, type HistoryFilter, type HistoryItem,
} from './historyCards';

const FILTERS: Array<{ id: HistoryFilter; label: string }> = [
  { id: 'all', label: 'All chats' },
  { id: 'default', label: 'TimeMachine Air' },
  { id: 'girlie', label: 'TimeMachine Girlie' },
  { id: 'pro', label: 'TimeMachine PRO' },
  { id: 'group', label: 'Group chats' },
];

/**
 * Chats saved before the namer existed still wear their opening words. The
 * page names a few of them each visit, newest first, one at a time — the
 * whole archive gets there over a few visits without a burst of requests.
 */
const NAMINGS_PER_VISIT = 8;
const LONG_PRESS_MS = 480;

function columnCount() {
  if (window.matchMedia('(min-width: 1024px)').matches) return 4;
  if (window.matchMedia('(min-width: 640px)').matches) return 3;
  return 2;
}

function subscribeColumns(changed: () => void) {
  const queries = ['(min-width: 640px)', '(min-width: 1024px)'].map(query => window.matchMedia(query));
  queries.forEach(query => query.addEventListener('change', changed));
  return () => queries.forEach(query => query.removeEventListener('change', changed));
}

interface ChatHistoryPageProps {
  onLoadChat: (session: ChatSession) => void;
}

/** The card menu's width in layout pixels, for keeping it on screen. */
const MENU_WIDTH = 216;

const MENU_MOTION = {
  initial: { y: -6, scale: 0.96 },
  animate: { y: 0, scale: 1 },
  exit: { y: -4, scale: 0.97 },
  transition: { duration: 0.16, ease: [0.22, 1, 0.36, 1] as const },
};

export function ChatHistoryPage({ onLoadChat }: ChatHistoryPageProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const columns = useSyncExternalStore(subscribeColumns, columnCount, () => 2);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [groups, setGroups] = useState<GroupChatItem[]>([]);
  const [cards, setCards] = useState<Map<string, ChatCardMeta>>(new Map());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadVersion = useRef(0);

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    try {
      // Arriving here directly, nothing has told the service who is signed
      // in yet. The mock dev user keeps its chats on the device, as in useChat.
      chatService.setUserId(DEV_MOCK_AUTH ? null : (user?.id ?? null));
      const [list, cardMap, groupList] = await Promise.all([
        chatService.getSessions(),
        chatService.listChatCards(),
        user ? getUserGroupChats(user.id).catch(() => [] as GroupChatItem[]) : Promise.resolve([] as GroupChatItem[]),
      ]);
      if (version !== loadVersion.current) return;
      setSessions(list);
      setCards(cardMap);
      setGroups(groupList);

      const unnamed = list
        .filter(session => !cardMap.get(session.id)?.namedAt && chatService.isUnnamed(session))
        .sort((a, b) => (b.lastModified || '').localeCompare(a.lastModified || ''))
        .slice(0, NAMINGS_PER_VISIT);
      void (async () => {
        for (const session of unnamed) {
          if (version !== loadVersion.current) return;
          try {
            const title = await chatService.nameChat(session);
            if (version !== loadVersion.current) return;
            if (!title) continue;
            setSessions(current => current.map(s => s.id === session.id ? { ...s, name: title } : s));
            const card = await chatService.getChatCard(session.id);
            if (card) setCards(current => new Map(current).set(session.id, card));
          } catch (error) {
            // The card keeps its opening words; the next visit tries again.
            console.error('[ChatTitle] naming failed:', error instanceof Error ? error.message : error);
          }
        }
      })();
    } catch (error) {
      if (version !== loadVersion.current) return;
      console.error('Failed to load chat history:', error);
      setSessions([]);
      setGroups([]);
      setNotice("Couldn't load chat history");
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) void load(); });
    return () => { cancelled = true; loadVersion.current += 1; };
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    let next = 0;
    // Every chat is considered, including old named chats. Two workers keep
    // the page responsive without requiring repeated visits to fill it in.
    const fillCovers = async () => {
      while (!cancelled && next < sessions.length) {
        const session = sessions[next++];
        try {
          const card = await chatService.ensureChatCover(session);
          if (card && !cancelled) setCards(current => new Map(current).set(session.id, card));
        } catch {
          // Transient failures remain eligible on the next visit.
        }
      }
    };
    void fillCovers();
    void fillCovers();
    return () => { cancelled = true; };
  }, [sessions]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2800);
    return () => clearTimeout(timer);
  }, [notice]);

  // One menu at a time, and none once the page is clicked elsewhere.
  useEffect(() => {
    if (!menuFor && !filterOpen) return;
    const close = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-history-menu]')) return;
      setMenuFor(null);
      setFilterOpen(false);
      setConfirmDelete(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMenuFor(null); setFilterOpen(false); setConfirmDelete(false); }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuFor, filterOpen]);

  const items = useMemo(() => itemsFrom(sessions, groups, cards), [sessions, groups, cards]);
  const shown = useMemo(
    () => items.filter(item => matchesFilter(item, filter) && matchesQuery(item, query)),
    [items, filter, query],
  );

  const open = (item: HistoryItem) => {
    if (item.kind === 'group') navigate(`/groupchat/${item.id}`);
    else if (item.session) onLoadChat(item.session);
  };

  const togglePin = async (item: HistoryItem) => {
    setMenuFor(null);
    const pinned = !item.pinned;
    await chatService.setChatPinned(item.id, pinned);
    const card = await chatService.getChatCard(item.id);
    setCards(current => {
      const next = new Map(current);
      if (card) next.set(item.id, card);
      return next;
    });
  };

  const startRename = (item: HistoryItem) => {
    setMenuFor(null);
    setRenaming({ id: item.id, value: item.title });
  };

  const commitRename = async () => {
    if (!renaming) return;
    const name = renaming.value.trim();
    const id = renaming.id;
    setRenaming(null);
    if (!name) return;
    const ok = await chatService.renameSession(id, name).catch(() => false);
    if (!ok) { setNotice("Couldn't rename that chat"); return; }
    setSessions(current => current.map(session => session.id === id ? { ...session, name } : session));
  };

  const remove = async (item: HistoryItem) => {
    setMenuFor(null);
    setConfirmDelete(false);
    const ok = await chatService.deleteSession(item.id).catch(() => false);
    if (!ok) { setNotice("Couldn't delete that chat"); return; }
    setSessions(current => current.filter(session => session.id !== item.id));
    setNotice('Chat deleted');
  };

  const exportAll = () => {
    try {
      const blob = new Blob([JSON.stringify({ exportDate: new Date().toISOString(), version: '1.0', sessions }, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `timemachine_chat_history_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      setNotice('Exported');
    } catch {
      setNotice("Couldn't export");
    }
    setFilterOpen(false);
  };

  const importFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const imported = parseChatImport(JSON.parse(await file.text()));
      if (imported.length === 0) throw new Error('empty');
      for (const session of imported) await chatService.saveSession(session);
      await load();
      setNotice(`Imported ${imported.length} chat${imported.length === 1 ? '' : 's'}`);
    } catch {
      setNotice("Couldn't read that file");
    }
  };

  const fabGlass = 'tm-glass tm-press tm-history-fab';
  const fabBorder = { border: '1px solid rgb(var(--tm-ink-rgb) / 0.12)' };

  return (
    <div className="tm-chat-shell relative min-h-screen overflow-hidden" style={{ minHeight: 'var(--tm-100vh)' }}>
      <AppAtmosphere />
      <h1 className="sr-only">Chat history</h1>

      <div
        className="tm-notes-scroll relative overflow-y-auto"
        style={{ height: 'var(--tm-100vh)' }}
        // A card menu is pinned to where its dots were; a scroll moves the dots.
        onScroll={() => { if (menuFor) { setMenuFor(null); setConfirmDelete(false); } }}
      >
        <div
          className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8"
          style={{
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 76px)',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 112px)',
          }}
        >
          {loading ? (
            <div className="tm-history-grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }} aria-busy="true" aria-label="Loading chats">
              {Array.from({ length: columns }, (_, index) => (
                <div key={index} className="tm-history-column">
                  <div className="tm-history-skeleton" style={{ height: 240 }} />
                  <div className="tm-history-skeleton" style={{ height: 280 }} />
                </div>
              ))}
            </div>
          ) : shown.length === 0 ? (
            <Empty
              query={query}
              filter={filter}
              signedIn={!!user}
              onNewChat={() => navigate('/', { state: { newChat: true } })}
              onClear={() => { setQuery(''); setFilter('all'); }}
            />
          ) : (
            <div className="tm-history-grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
              {Array.from({ length: columns }, (_, column) => (
                <div key={column} className="tm-history-column">
                  {shown.filter((_, index) => index % columns === column).map(item => (
                <HistoryCard
                  key={`${item.kind}:${item.id}`}
                  item={item}
                  menuOpen={menuFor === item.id}
                  confirmDelete={menuFor === item.id && confirmDelete}
                  renaming={renaming?.id === item.id ? renaming.value : null}
                  reduced={!!reduced}
                  onOpen={() => open(item)}
                  onMenu={(openIt) => { setMenuFor(openIt ? item.id : null); setConfirmDelete(false); setFilterOpen(false); }}
                  onPin={() => togglePin(item)}
                  onRename={() => startRename(item)}
                  onRenameChange={(value) => setRenaming(current => current && { ...current, value })}
                  onRenameCommit={commitRename}
                  onRenameCancel={() => setRenaming(null)}
                  onDelete={() => (confirmDelete ? remove(item) : setConfirmDelete(true))}
                />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Corners. */}
      <div className="pointer-events-none fixed inset-x-0 z-40 flex items-start justify-between px-3 sm:px-5" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 14px)' }}>
        <button type="button" onClick={() => navigate('/')} aria-label="Back to chat" className={`pointer-events-auto ${fabGlass}`} style={fabBorder}>
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="pointer-events-auto relative" data-history-menu>
          <button
            type="button"
            onClick={() => { setFilterOpen(open => !open); setMenuFor(null); }}
            aria-label="Filter chats"
            aria-haspopup="menu"
            aria-expanded={filterOpen}
            className={fabGlass}
            style={{ ...fabBorder, ...(filter !== 'all' ? { color: 'rgb(var(--tm-accent-rgb, 168 85 247))' } : {}) }}
          >
            <SlidersHorizontal className="h-5 w-5" />
          </button>
          <AnimatePresence>
            {filterOpen && (
              <motion.div
                role="menu"
                aria-label="Filter"
                {...(reduced ? {} : MENU_MOTION)}
                className="tm-glass tm-chat-menu absolute right-0 top-[56px] w-[15.5rem] origin-top-right rounded-[24px] p-1.5"
              >
                {FILTERS.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={filter === option.id}
                    onClick={() => { setFilter(option.id); setFilterOpen(false); }}
                    className="tm-history-menu-row justify-between"
                  >
                    <span className="flex items-center gap-2.5">
                      {option.id === 'group' && <Users className="h-4 w-4 shrink-0" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.55)' }} aria-hidden="true" />}
                      {option.label}
                    </span>
                    {filter === option.id && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                  </button>
                ))}
                <div className="mx-3 my-1.5 h-px" style={{ background: 'rgb(var(--tm-ink-rgb) / 0.08)' }} />
                <button type="button" role="menuitem" onClick={exportAll} className="tm-history-menu-row">
                  <Download className="h-4 w-4 shrink-0" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.55)' }} aria-hidden="true" /> Export all
                </button>
                <button type="button" role="menuitem" onClick={() => { setFilterOpen(false); fileInputRef.current?.click(); }} className="tm-history-menu-row">
                  <Upload className="h-4 w-4 shrink-0" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.55)' }} aria-hidden="true" /> Import
                </button>
                <p className="px-3 pb-2 pt-1.5 text-[12px]" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.45)' }}>
                  {user ? 'Chats are kept with your TimeMachine ID.' : 'Chats are kept on this device.'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 z-40 flex items-end justify-between gap-3 px-3 sm:px-5" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
        <div className="pointer-events-auto min-w-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            {searchOpen ? (
              <motion.form
                key="field"
                {...(reduced ? {} : { initial: { scale: 0.92, y: 6 }, animate: { scale: 1, y: 0 }, exit: { scale: 0.94, y: 4 }, transition: { duration: 0.16 } })}
                onSubmit={event => event.preventDefault()}
                className="tm-glass tm-history-search w-full max-w-md origin-bottom-left"
                style={fabBorder}
                role="search"
              >
                <Search className="h-4 w-4 shrink-0" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.5)' }} aria-hidden="true" />
                <input
                  autoFocus
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  onKeyDown={event => { if (event.key === 'Escape') { setQuery(''); setSearchOpen(false); } }}
                  placeholder="Search chats"
                  aria-label="Search chats"
                  enterKeyHint="search"
                />
                <button
                  type="button"
                  onClick={() => { setQuery(''); setSearchOpen(false); }}
                  aria-label="Close search"
                  className="tm-notes-icon shrink-0 rounded-full"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.form>
            ) : (
              <motion.button
                key="button"
                type="button"
                {...(reduced ? {} : { initial: { scale: 0.9 }, animate: { scale: 1 }, exit: { scale: 0.9 }, transition: { duration: 0.14 } })}
                onClick={() => setSearchOpen(true)}
                aria-label="Search chats"
                className={fabGlass}
                style={fabBorder}
              >
                <Search className="h-5 w-5" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <button
          type="button"
          onClick={() => navigate('/', { state: { newChat: true } })}
          aria-label="New chat"
          className="tm-glass tm-press tm-history-fab tm-history-fab-primary pointer-events-auto shrink-0"
        >
          <SquarePen className="h-5 w-5" />
        </button>
      </div>

      <AnimatePresence>
        {notice && (
          <motion.div
            role="status"
            initial={{ y: 12, scale: 0.96 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 8, scale: 0.97 }}
            className="tm-glass pointer-events-none fixed left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-[13px]"
            style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)', ...fabBorder, color: 'rgb(var(--tm-ink-rgb) / 0.85)' }}
          >
            {notice}
          </motion.div>
        )}
      </AnimatePresence>

      <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={importFile} className="hidden" />
    </div>
  );
}

// ─── A card ──────────────────────────────────────────────────────────────

interface HistoryCardProps {
  item: HistoryItem;
  menuOpen: boolean;
  confirmDelete: boolean;
  /** The name being typed, when this card is being renamed. */
  renaming: string | null;
  reduced: boolean;
  onOpen: () => void;
  onMenu: (open: boolean) => void;
  onPin: () => void;
  onRename: () => void;
  onRenameChange: (value: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onDelete: () => void;
}

function HistoryCard({
  item, menuOpen, confirmDelete, renaming, reduced,
  onOpen, onMenu, onPin, onRename, onRenameChange, onRenameCommit, onRenameCancel, onDelete,
}: HistoryCardProps) {
  const [pressed, setPressed] = useState(false);
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const cover = item.cover?.url === failedCover ? null : item.cover;
  const renameFinished = useRef(false);
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // The menu renders in a portal: the card clips its own overflow (its
  // picture has to stop at its corners) and on a phone it is narrower than
  // the menu. Anchored to the dots, kept inside the viewport, re-placed on
  // resize. Rects are real pixels; the menu lives in the zoomed layout.
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
  const place = useCallback(() => {
    const el = moreRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = toLayoutPx(window.innerWidth);
    const viewport = window.visualViewport;
    const topEdge = toLayoutPx(viewport?.offsetTop ?? 0) + 10;
    const bottomEdge = toLayoutPx((viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight)) - 10;
    const height = menuRef.current?.offsetHeight ?? 210;
    const right = Math.max(10, Math.min(width - toLayoutPx(r.right), width - 10 - MENU_WIDTH));
    const below = toLayoutPx(r.bottom) + 6;
    const top = Math.max(topEdge, Math.min(below + height <= bottomEdge ? below : toLayoutPx(r.top) - height - 6, bottomEdge - height));
    setAnchor({ top, right });
  }, []);
  useLayoutEffect(() => {
    if (!menuOpen) return;
    place();
    const frame = requestAnimationFrame(() => {
      place();
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
    });
    window.addEventListener('resize', place);
    window.visualViewport?.addEventListener('resize', place);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('resize', place);
    };
  }, [menuOpen, confirmDelete, place]);

  useEffect(() => () => { if (longPress.current) clearTimeout(longPress.current); }, []);

  // A long press opens the menu where there is no right button. The press is
  // cancelled by any movement, so a scroll that starts on a card is a scroll.
  const startPress = (event: React.PointerEvent) => {
    if (event.pointerType === 'mouse' || renaming !== null) return;
    longPressed.current = false;
    longPress.current = setTimeout(() => {
      longPressed.current = true;
      onMenu(true);
    }, LONG_PRESS_MS);
  };
  const endPress = () => {
    if (longPress.current) clearTimeout(longPress.current);
    longPress.current = null;
    setPressed(false);
  };

  const label = whenLabel(item.updatedAt);
  const ratio = cover ? Math.min(1.35, Math.max(0.78, cover.width / cover.height)) : 1;

  const text = (
    <>
      <p className="tm-history-meta">
        {item.pinned && <Pin className="h-3 w-3 shrink-0 fill-current" aria-label="Pinned" />}
        {item.kind === 'group' && <Users className="h-3 w-3 shrink-0" aria-hidden="true" />}
        <span>{label}</span>
      </p>
      {renaming !== null ? (
        <input
          autoFocus
          value={renaming}
          onFocus={() => { renameFinished.current = false; }}
          onChange={event => onRenameChange(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') { event.preventDefault(); renameFinished.current = true; onRenameCommit(); }
            if (event.key === 'Escape') { renameFinished.current = true; onRenameCancel(); }
          }}
          onBlur={() => { if (!renameFinished.current) onRenameCommit(); }}
          onClick={event => event.stopPropagation()}
          aria-label="Chat name"
          className="tm-history-rename"
          maxLength={80}
        />
      ) : (
        <h2 className="tm-history-title">{item.title}</h2>
      )}
    </>
  );

  return (
    <article
      className="tm-history-card"
      data-pressed={pressed ? 'true' : 'false'}
      data-bleed={item.bleed && cover ? 'true' : 'false'}
      onContextMenu={event => { event.preventDefault(); onMenu(true); }}
    >
      <div
        role="button"
        tabIndex={renaming !== null ? -1 : 0}
        className="tm-history-card-open"
        aria-label={`Open ${item.title}`}
        onClick={() => {
          if (renaming !== null) return;
          if (longPressed.current) { longPressed.current = false; return; }
          onOpen();
        }}
        onKeyDown={event => {
          if (renaming !== null) return;
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(); }
        }}
        onPointerDown={event => { setPressed(true); startPress(event); }}
        onPointerUp={endPress}
        onPointerCancel={endPress}
        onPointerMove={() => { if (longPress.current) endPress(); }}
        onPointerLeave={endPress}
      >
        {item.bleed && cover ? (
          <>
            <img
              src={cover.url}
              onError={() => setFailedCover(cover.url)}
              alt=""
              loading="lazy"
              decoding="async"
              className="tm-history-bleed-picture"
              style={{ aspectRatio: String(Math.min(0.9, ratio)) }}
            />
            <div className="tm-history-bleed-scrim" aria-hidden="true" />
            <div className="tm-history-bleed-text">{text}</div>
          </>
        ) : (
          <>
            {text}
            {cover ? (
              <img
                src={cover.url}
                onError={() => setFailedCover(cover.url)}
                alt=""
                loading="lazy"
                decoding="async"
                className="tm-history-picture"
                style={{ aspectRatio: String(ratio) }}
              />
            ) : item.preview ? (
              <p className="tm-history-preview">{item.preview}</p>
            ) : null}
          </>
        )}
      </div>

      <div data-history-menu>
        <button
          ref={moreRef}
          type="button"
          onClick={event => { event.stopPropagation(); onMenu(!menuOpen); }}
          onPointerDown={event => event.stopPropagation()}
          aria-label={`Options for ${item.title}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="tm-history-more"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {createPortal(
          <AnimatePresence>
            {menuOpen && anchor && (
              <motion.div
                ref={menuRef}
                role="menu"
                aria-label={item.title}
                data-history-menu
                {...(reduced ? {} : MENU_MOTION)}
                className="tm-glass tm-chat-menu fixed z-[70] origin-top-right rounded-[22px] p-1.5"
                style={{ top: anchor.top, right: anchor.right, width: MENU_WIDTH, maxHeight: 'calc(var(--tm-100dvh, 100dvh) - 20px)', overflowY: 'auto' }}
                onKeyDown={event => {
                  const rows = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
                  const index = rows.indexOf(document.activeElement as HTMLElement);
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    rows[(index + (event.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length]?.focus();
                  }
                  if (event.key === 'Escape') moreRef.current?.focus();
                }}
              >
                <button type="button" role="menuitem" onClick={onPin} className="tm-history-menu-row">
                  {item.pinned
                    ? <PinOff className="h-4 w-4 shrink-0" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.55)' }} aria-hidden="true" />
                    : <Pin className="h-4 w-4 shrink-0" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.55)' }} aria-hidden="true" />}
                  {item.pinned ? 'Unpin' : 'Pin'}
                </button>
                {item.kind === 'chat' && (
                  <>
                    <button type="button" role="menuitem" onClick={onRename} className="tm-history-menu-row">
                      <Pencil className="h-4 w-4 shrink-0" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.55)' }} aria-hidden="true" /> Rename
                    </button>
                    <button type="button" role="menuitem" onClick={onDelete} data-danger="true" className="tm-history-menu-row">
                      <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {confirmDelete ? 'Delete for good?' : 'Delete'}
                    </button>
                  </>
                )}
                {item.kind === 'group' && (
                  <button type="button" role="menuitem" onClick={onOpen} className="tm-history-menu-row">
                    <MessageCircle className="h-4 w-4 shrink-0" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.55)' }} aria-hidden="true" /> Open
                  </button>
                )}
                {item.cover && (
                  <a
                    href={item.cover.pageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    role="menuitem"
                    className="block px-3 pb-2 pt-1.5 text-[11.5px] leading-snug"
                    style={{ color: 'rgb(var(--tm-ink-rgb) / 0.42)' }}
                  >
                    Picture: Wikipedia, “{item.cover.pageTitle}”
                  </a>
                )}
              </motion.div>
            )}
          </AnimatePresence>,
        document.body,
        )}
      </div>
    </article>
  );
}

// ─── Nothing to show ─────────────────────────────────────────────────────

function Empty({ query, filter, signedIn, onNewChat, onClear }: {
  query: string;
  filter: HistoryFilter;
  signedIn: boolean;
  onNewChat: () => void;
  onClear: () => void;
}) {
  // A filter with nothing behind it is a narrowing too — except group chats
  // for a visitor, where the honest answer is "sign in".
  const groupsNeedSignIn = filter === 'group' && !signedIn;
  const narrowed = !groupsNeedSignIn && (!!query.trim() || filter !== 'all');
  return (
    <div className="flex flex-col items-center gap-4 px-6 pt-[18vh] text-center">
      <MessageCircle className="h-9 w-9" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.35)' }} aria-hidden="true" />
      <div>
        <p className="text-[19px] font-semibold" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.9)' }}>
          {narrowed ? 'Nothing matches' : groupsNeedSignIn ? 'Group chats' : 'No chats yet'}
        </p>
        <p className="mt-1 text-[14px]" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.5)' }}>
          {narrowed
            ? 'Try another word, or show every chat.'
            : groupsNeedSignIn
              ? 'Sign in to see your group chats.'
              : 'Start one and it will show up here.'}
        </p>
      </div>
      <button
        type="button"
        onClick={narrowed ? onClear : onNewChat}
        className="tm-glass tm-press inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[14px] font-medium"
        style={{ border: '1px solid rgb(var(--tm-ink-rgb) / 0.12)', color: 'rgb(var(--tm-ink-rgb) / 0.9)' }}
      >
        {narrowed ? 'Show all chats' : <><SquarePen className="h-4 w-4" aria-hidden="true" /> Start a chat</>}
      </button>
    </div>
  );
}
