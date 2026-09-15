import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { ArrowRight, Plus } from 'lucide-react';
import { useEnterApp, useReveal } from './marketing';
import './landing.css';

/* The marketing pages share one shell: the floating glass nav, the Newsreader
   display voice, the light pools, the glass footer. The landing page is the
   first of them; Features, Personas, Help, About and Contact are the rest. */

export function Wordmark({ className = 'text-lg' }: { className?: string }) {
  return (
    <span
      className={`${className} font-bold text-purple-400 tracking-tight`}
      style={{
        fontFamily: 'Montserrat, var(--font-display)',
        textShadow: '0 0 20px rgb(var(--tm-accent-rgb, 168 85 247) / 0.5)',
      }}
    >
      TimeMachine
    </span>
  );
}

export function Arrow() {
  return <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />;
}

/** A pool of the hero's light under a section, so the page never goes flat. */
export function Glow({ hue, className = '', alpha = 0.12 }: { hue: string; className?: string; alpha?: number }) {
  return <div aria-hidden="true" className={`tm-glow ${className}`} style={{ background: `rgb(${hue} / ${alpha})` }} />;
}

/** A feature list in Linear's manner: a row per feature, "+" to read one line more. */
export function FeatureList({ items, label = 'Features' }: { items: ReadonlyArray<readonly [string, string]>; label?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="mt-12">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/35">{label}</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(([name, what]) => {
          const isOpen = open === name;
          return (
            <li key={name} className="tm-glass tm-glass-pill rounded-2xl">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : name)}
                aria-expanded={isOpen}
                className="tm-press flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left text-[15px] text-white/85 hover:text-white"
              >
                {name}
                <Plus className={`h-4 w-4 shrink-0 text-white/45 transition-transform duration-200 ${isOpen ? 'rotate-45' : ''}`} aria-hidden="true" />
              </button>
              <div
                className="grid transition-[grid-template-rows] duration-300 ease-out"
                style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
              >
                <p className="overflow-hidden text-sm leading-relaxed text-white/55">
                  <span className="block px-4 pb-4">{what}</span>
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The heading voice of these pages: Newsreader, one italic phrase. */
export function Display({ children, as: Tag = 'h1', className = '', id }: { children: React.ReactNode; as?: 'h1' | 'h2' | 'p'; className?: string; id?: string }) {
  return <Tag id={id} className={`tm-display ${className}`}>{children}</Tag>;
}

const NAV = [
  ['Features', '/features'],
  ['Personas', '/personas'],
  ['About', '/about'],
  ['Help', '/help'],
] as const;

interface MarketingShellProps {
  children: React.ReactNode;
  /** The hero's own light, drawn behind the top of the page. */
  hue?: string;
}

export function MarketingShell({ children, hue = '168 85 247' }: MarketingShellProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { reduced } = useReveal();
  const { startChatting, logIn } = useEnterApp();

  return (
    // body is overflow:hidden for the chat shell (index.css), so like every
    // other page this one scrolls inside its own root. `isolate` keeps the
    // negative-z layers inside this element instead of behind <body>.
    <div className="tm-landing relative isolate h-screen overflow-y-auto overflow-x-hidden bg-black text-white">
      <Helmet>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..500;1,6..72,300..500&display=swap"
        />
      </Helmet>

      {/* ── Nav: a floating pill of glass ───────────────────────── */}
      <header className="fixed inset-x-0 top-3 z-30 px-3 sm:top-4 sm:px-6">
        <div className="tm-glass tm-nav mx-auto flex max-w-5xl items-center justify-between py-2 pl-5 pr-2 sm:pl-6">
          <button
            type="button"
            onClick={() => navigate('/welcome')}
            className="rounded-md"
            aria-label="TimeMachine, home"
          >
            <Wordmark />
          </button>
          <nav className="hidden items-center gap-7 text-sm text-white/65 md:flex" aria-label="Site">
            {NAV.map(([label, to]) => (
              <button
                key={to}
                onClick={() => navigate(to)}
                aria-current={pathname === to ? 'page' : undefined}
                className={`transition-colors hover:text-white ${pathname === to ? 'text-white' : ''}`}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-1.5">
            <button onClick={logIn} className="tm-press tm-glass-pill rounded-full px-4 py-2 text-sm text-white/85 transition-colors hover:text-white">Log in</button>
            <button onClick={startChatting} className="tm-press rounded-full bg-pill px-4 py-2 text-sm font-medium text-pill-ink hover:opacity-90">Start chatting</button>
          </div>
        </div>
      </header>

      {/* The page's own light, at the top, where the heading lands. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[120vh] overflow-x-clip"
        aria-hidden="true"
        style={{ maskImage: 'linear-gradient(to bottom, #000 40%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, #000 40%, transparent 100%)' }}
      >
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, #12062a 0%, transparent 60%)' }} />
        <Glow hue={hue} className="left-1/2 top-[-30%] h-[70vmax] w-[70vmax] -translate-x-1/2" alpha={0.14} />
      </div>

      <main className="pt-32 sm:pt-40">{children}</main>

      <footer className="px-5 pb-6 pt-16 sm:px-8">
        <div className="tm-glass mx-auto grid max-w-6xl gap-10 rounded-3xl px-6 py-10 sm:px-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Wordmark className="text-base" />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/40">Everything you need, in one chat. Built by TimeMachine Mafia.</p>
            <motion.button
              whileTap={reduced ? undefined : { scale: 0.97 }}
              onClick={startChatting}
              className="tm-press mt-5 inline-flex items-center gap-2 rounded-full bg-pill px-4 py-2 text-sm font-medium text-pill-ink hover:opacity-90"
            >
              Start chatting <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </motion.button>
          </div>
          {([
            ['Product', [['Features', '/features'], ['Personas', '/personas'], ['Help', '/help']]],
            ['Company', [['About', '/about'], ['Contact', '/contact'], ['Shop', '/shop']]],
            ['Legal', [['Privacy', '/privacy'], ['Terms', '/terms']]],
          ] as const).map(([group, links]) => (
            <nav key={group} aria-label={group}>
              <p className="text-sm font-medium text-white/80">{group}</p>
              <ul className="mt-3 flex flex-col gap-2">
                {links.map(([label, to]) => (
                  <li key={to}>
                    <button onClick={() => navigate(to)} className="text-sm text-white/45 transition-colors hover:text-white">{label}</button>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </footer>
    </div>
  );
}
