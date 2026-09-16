import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronDown, Settings, Wand2, History, Plus, User, LogIn } from 'lucide-react';
import { AI_PERSONAS } from '../../config/constants';
import { useAuth } from '../../context/AuthContext';
import { AgentsModal } from '../agents/AgentsModal';
import { ChatSession } from '../../services/chat/chatService';
import { toLayoutPx } from '../../utils/pageZoom';

export interface BrandOverride {
  name: string;
  watermark?: string;
  textColorClass?: string;
  glowColor?: string;
  personaName?: string;
}

interface BrandLogoProps {
  onPersonaChange: (persona: keyof typeof AI_PERSONAS) => void;
  currentPersona: keyof typeof AI_PERSONAS;
  onLoadChat: (session: ChatSession) => void;
  onStartNewChat: () => void;
  onOpenAuth?: () => void;
  onOpenAccount?: () => void;
  onOpenHistory?: () => void;
  onOpenSettings?: () => void;
  brandOverride?: BrandOverride;
  /**
   * The rail is beside the transcript and already carries the account, new
   * chat, history, Flight Controls and settings; the menu then offers only
   * what the rail does not — which mind answers.
   */
  mindsOnly?: boolean;
  /**
   * The legacy shell: the brand is bare glowing text in the corner, no
   * glass around it, at the size it was drawn at. The current shell keeps
   * its glass pill.
   */
  bare?: boolean;
}

type MenuPersona = 'default' | 'girlie' | 'pro';

const personaColors: Record<MenuPersona, string> = {
  default: 'text-purple-400',
  girlie: 'text-pink-400',
  pro: 'text-cyan-400',
};

/* The three minds' hues, as on the landing page. */
const personaHues: Record<MenuPersona, string> = {
  default: '168 85 247',
  girlie: '236 72 153',
  pro: '34 211 238',
};

const personaRoles: Record<MenuPersona, string> = {
  default: 'Everyday, at speed',
  girlie: 'Gets the vibe',
  pro: 'Deep work',
};

const MENU_PERSONAS: MenuPersona[] = ['default', 'girlie', 'pro'];

const settle = { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const };

export function BrandLogo({
  onPersonaChange,
  currentPersona,
  onStartNewChat,
  onOpenAuth,
  onOpenAccount,
  onOpenHistory,
  onOpenSettings,
  brandOverride,
  mindsOnly = false,
  bare = false,
}: BrandLogoProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showAgents, setShowAgents] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const reduced = useReducedMotion() ?? false;
  const { user, profile } = useAuth();

  const hue = brandOverride?.glowColor
    ? undefined
    : personaHues[(currentPersona in personaHues ? currentPersona : 'default') as MenuPersona];

  // The menu renders in a portal: the nav it hangs from is glass, and a
  // backdrop-filter cannot see through its parent's backdrop-filter, so a
  // nested lens would show no blur. Anchored to the trigger on open and on
  // every resize while open.
  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    // Rects are real pixels; the menu lives in the zoomed layout.
    const r = el.getBoundingClientRect();
    setAnchor({
      top: toLayoutPx(r.bottom) + 14,
      left: Math.max(12, Math.min(toLayoutPx(r.left) - 8, toLayoutPx(window.innerWidth) - 316)),
    });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [isOpen, place]);

  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setIsOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [isOpen]);

  const close = () => setIsOpen(false);
  const pick = (persona: keyof typeof AI_PERSONAS) => { onPersonaChange(persona); close(); };
  const run = (fn?: () => void) => () => { close(); fn?.(); };

  const rowClass = 'tm-menu-row flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left';
  const glow = brandOverride?.glowColor || `rgb(${hue} / 0.5)`;
  // The legacy corner glow: three rings, fading out.
  const glowAt = (a: number) => brandOverride?.glowColor
    ? brandOverride.glowColor.replace(/[\d.]+\)$/, `${a})`)
    : `rgb(${hue} / ${a})`;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        className={bare
          ? 'tm-press group flex min-h-11 items-center gap-2 rounded-full py-2 outline-hidden focus-visible:ring-2 focus-visible:ring-focus'
          : 'tm-glass tm-press group flex min-h-11 items-center gap-2 rounded-full px-3.5 py-2 outline-hidden focus-visible:ring-2 focus-visible:ring-focus sm:px-4'}
      >
        <span className="flex flex-col items-start">
          <span
            className={`${bare ? 'text-lg sm:text-2xl' : 'text-[17px] tracking-tight sm:text-lg'} font-bold ${brandOverride?.textColorClass || personaColors[(currentPersona in personaColors ? currentPersona : 'default') as MenuPersona]} transition-colors duration-300`}
            style={{
              fontFamily: 'Montserrat, var(--font-display)',
              textShadow: bare
                ? `0 0 20px ${glowAt(0.6)}, 0 0 40px ${glowAt(0.3)}, 0 0 60px ${glowAt(0.1)}`
                : `0 0 20px ${glow}`,
            }}
          >
            {brandOverride?.name || AI_PERSONAS[currentPersona].name}
          </span>
          {brandOverride?.watermark && (
            <span className="-mt-0.5 text-[10px] uppercase tracking-wider" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.5)' }}>
              {brandOverride.watermark}
            </span>
          )}
        </span>
        <ChevronDown
          className={`shrink-0 transition-transform duration-300 ease-out ${isOpen ? 'rotate-180' : ''} ${bare
            ? `h-4 w-4 sm:h-5 sm:w-5 ${brandOverride?.textColorClass || personaColors[(currentPersona in personaColors ? currentPersona : 'default') as MenuPersona]}`
            : 'h-4 w-4'}`}
          style={bare ? undefined : { color: 'rgb(var(--tm-ink-rgb) / 0.5)' }}
          aria-hidden="true"
        />
      </button>

      {createPortal(
        <AnimatePresence>
          {isOpen && anchor && (
            <motion.div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label="TimeMachine"
              initial={reduced ? false : { opacity: 0, y: -8, scale: 0.98, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={reduced ? undefined : { opacity: 0, y: -6, scale: 0.98, filter: 'blur(6px)' }}
              transition={settle}
              className={`tm-glass tm-chat-menu fixed z-[60] origin-top-left rounded-[28px] p-1.5 ${mindsOnly ? 'w-[16rem]' : 'w-[19rem]'}`}
              style={{ top: anchor.top, left: anchor.left, maxHeight: `calc(var(--tm-100dvh) - ${anchor.top + 12}px)` }}
              onKeyDown={(event) => {
                const buttons = Array.from(event.currentTarget.querySelectorAll('button'));
                const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
                }
                if (event.key === 'Home' || event.key === 'End') {
                  event.preventDefault();
                  buttons[event.key === 'Home' ? 0 : buttons.length - 1]?.focus();
                }
                if (event.key === 'Tab') setIsOpen(false);
              }}
            >
              {/* Account */}
              {!mindsOnly && (
              <button type="button" role="menuitem" onClick={run(user ? onOpenAccount : onOpenAuth)} className={rowClass}>
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full"
                  style={{
                    background: profile?.avatar_url ? 'transparent' : `rgb(${hue ?? '168 85 247'} / 0.14)`,
                    border: `1px solid rgb(${hue ?? '168 85 247'} / 0.28)`,
                    boxShadow: 'inset 0 1px 0 rgb(var(--tm-edge-rgb) / 0.2)',
                  }}
                >
                  {user && profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : user ? (
                    <User className="h-4 w-4" style={{ color: `rgb(${hue ?? '168 85 247'})` }} />
                  ) : (
                    <LogIn className="h-4 w-4" style={{ color: `rgb(${hue ?? '168 85 247'})` }} />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.92)' }}>
                    {user ? profile?.nickname || 'My account' : 'Log in or sign up'}
                  </span>
                  <span className="block text-[13px]" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.5)' }}>
                    {user ? 'Profile, memories and images' : 'Unlimited chats with a TimeMachine ID'}
                  </span>
                </span>
              </button>
              )}

              {!mindsOnly && <div className="mx-3 my-1.5 h-px" style={{ background: 'rgb(var(--tm-ink-rgb) / 0.08)' }} />}

              {/* The minds */}
              <div role="group" aria-label="Who answers">
                {MENU_PERSONAS
                  .filter((key) => !('hiddenFromDropdown' in AI_PERSONAS[key] && (AI_PERSONAS[key] as { hiddenFromDropdown?: boolean }).hiddenFromDropdown))
                  .map((key) => {
                    const active = currentPersona === key;
                    const h = personaHues[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        role="menuitemradio"
                        aria-checked={active}
                        onClick={() => pick(key)}
                        className={`${rowClass} justify-between`}
                        style={active ? { background: `linear-gradient(90deg, rgb(${h} / 0.16), rgb(${h} / 0.03))` } : undefined}
                      >
                        <span className="min-w-0">
                          <span
                            className="block text-[15px] font-semibold"
                            style={{ color: active ? `rgb(${h})` : 'rgb(var(--tm-ink-rgb) / 0.92)' }}
                          >
                            {AI_PERSONAS[key].name}
                          </span>
                          <span className="block text-[13px]" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.5)' }}>
                            {personaRoles[key]}
                          </span>
                        </span>
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 shrink-0 rounded-full transition-opacity duration-200"
                          style={{ background: `rgb(${h})`, boxShadow: `0 0 10px rgb(${h} / 0.7)`, opacity: active ? 1 : 0 }}
                        />
                      </button>
                    );
                  })}
              </div>

              {!mindsOnly && <div className="mx-3 my-1.5 h-px" style={{ background: 'rgb(var(--tm-ink-rgb) / 0.08)' }} />}

              {/* Actions */}
              {!mindsOnly && ([
                ['New chat', Plus, run(onStartNewChat)],
                ['Chat history', History, run(onOpenHistory)],
                ['Flight Controls', Wand2, run(() => setShowAgents(true))],
                ['Settings & theme', Settings, run(onOpenSettings)],
              ] as const).map(([label, Icon, onClick]) => (
                <button key={label} type="button" role="menuitem" onClick={onClick} className={rowClass}>
                  <Icon className="h-4 w-4 shrink-0" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.55)' }} aria-hidden="true" />
                  <span className="text-[15px] font-medium" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.88)' }}>{label}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      <AgentsModal
        isOpen={showAgents}
        onClose={() => setShowAgents(false)}
        onSignIn={onOpenAuth}
      />
    </div>
  );
}
