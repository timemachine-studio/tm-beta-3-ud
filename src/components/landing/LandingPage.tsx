import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { AI_PERSONAS } from '../../config/constants';
import SendIcon from '../icons/SendIcon';
import { markEnteredApp, type LandingHandoff } from './entered';
import { Arrow, FeatureList, Glow, Wordmark } from './MarketingShell';
import { settle } from './marketing';
import './landing.css';

// ─── the three minds ─────────────────────────────────────────────────
// Names, greetings and hues come from the app so the page can never drift
// from what a visitor meets one click later.

type PersonaKey = 'default' | 'girlie' | 'pro';

interface Mind {
  key: PersonaKey;
  short: string;
  hue: string;
  /** What a message to this mind starts with. Air is the default: nothing. */
  mention: string;
  role: string;
  detail: string;
  prompts: string[];
}

const MINDS: Mind[] = [
  {
    key: 'default',
    short: 'Air',
    hue: '168 85 247',
    mention: '',
    role: 'Everyday, at speed',
    detail: 'The default. Answers, drafts, plans and quick explanations, back before you finish the thought.',
    prompts: [
      'Plan a three-day Kyoto trip under $600',
      'Explain how vaccines train the immune system, simply',
      'Rewrite this email so it sounds like me, not a robot',
      'What should I cook with eggs, spinach and too much rice?',
    ],
  },
  {
    key: 'girlie',
    short: 'Girlie',
    hue: '236 72 153',
    mention: '@girlie ',
    role: 'Gets the vibe',
    detail: 'Warmer, louder, on your side. Life advice, outfit calls and late-night rants — she keeps the energy right.',
    prompts: [
      'Rooftop dinner, 14°C, what do I wear',
      'Rate my text before I send it to him',
      'I got the job. Hype me up.',
    ],
  },
  {
    key: 'pro',
    short: 'PRO',
    hue: '34 211 238',
    mention: '@pro ',
    role: 'Deep work',
    detail: 'Reasons through the hard ones: analysis, research, code. Switch on Max Mode and it becomes a coding agent.',
    prompts: [
      'Review this function for race conditions',
      'Compare Postgres and SQLite for a side project',
      'Plan the move from REST to tRPC, step by step',
    ],
  },
];

// ─── shared ──────────────────────────────────────────────────────────

// ─── composer ────────────────────────────────────────────────────────
// Real. What is typed here becomes the first turn of the chat.

interface ComposerProps {
  mind: Mind;
  onMind: (m: Mind) => void;
  onSubmit: (text: string) => void;
  reduced: boolean;
}

function Composer({ mind, onMind, onSubmit, reduced }: ComposerProps) {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [promptIndex, setPromptIndex] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);

  // The placeholder cycles through what this mind is for, only while the
  // field is empty and idle — a suggestion, never a distraction under the
  // caret.
  useEffect(() => {
    if (value || focused || reduced) return;
    const id = setInterval(() => setPromptIndex((i) => i + 1), 4200);
    return () => clearInterval(id);
  }, [value, focused, reduced]);

  const prompt = mind.prompts[promptIndex % mind.prompts.length];

  const submit = useCallback(() => {
    const text = value.trim();
    if (!text) return;
    onSubmit(mind.mention + text);
  }, [value, mind.mention, onSubmit]);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, []);

  return (
    <div className="w-full">
      <form
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        className="tm-glass relative flex items-end gap-2 rounded-[32px] p-2 pl-5"
        style={{
          borderColor: focused ? `rgb(${mind.hue} / 0.5)` : undefined,
          transition: 'border-color 200ms ease-out',
        }}
      >
        {mind.mention && (
          <span
            className="mb-3 shrink-0 rounded-md px-1.5 py-0.5 font-mono text-xs"
            style={{ color: `rgb(${mind.hue})`, background: `rgb(${mind.hue} / 0.12)` }}
            aria-hidden="true"
          >
            {mind.mention.trim()}
          </span>
        )}
        <label htmlFor="landing-composer" className="sr-only">
          Message {AI_PERSONAS[mind.key].name}
        </label>
        <div className="relative flex-1">
          <textarea
            id="landing-composer"
            ref={ref}
            rows={1}
            value={value}
            onChange={(e) => { setValue(e.target.value); resize(); }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            aria-describedby="landing-composer-hint"
            className="block w-full resize-none bg-transparent py-2.5 text-base text-white outline-hidden sm:text-[17px]"
            style={{ maxHeight: 180 }}
          />
          {!value && (
            <div className="pointer-events-none absolute inset-0 flex items-center overflow-hidden" aria-hidden="true">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={`${mind.key}-${promptIndex % mind.prompts.length}`}
                  initial={reduced ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduced ? undefined : { opacity: 0, y: -6 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="truncate text-base text-white/40 sm:text-[17px]"
                >
                  {prompt}
                </motion.span>
              </AnimatePresence>
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={!value.trim()}
          aria-label="Send and open the chat"
          className="tm-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pill text-pill-ink disabled:opacity-30"
        >
          <SendIcon className="h-5 w-5" />
        </button>
      </form>

      {/* Which mind answers. This is the @mention feature, as a control. */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5" role="radiogroup" aria-label="Who answers">
        {MINDS.map((m) => {
          const active = m.key === mind.key;
          return (
            <button
              key={m.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => { onMind(m); setPromptIndex(0); ref.current?.focus(); }}
              className={`tm-press rounded-full px-3.5 py-1.5 text-sm ${active ? '' : 'tm-glass-pill'}`}
              style={{
                color: active ? `rgb(${m.hue})` : 'rgb(var(--tm-ink-rgb) / 0.7)',
                background: active ? `linear-gradient(135deg, rgb(${m.hue} / 0.22), rgb(${m.hue} / 0.1))` : undefined,
                border: `1px solid ${active ? `rgb(${m.hue} / 0.4)` : 'rgb(var(--tm-ink-rgb) / 0.12)'}`,
                boxShadow: active ? `inset 0 1px 0 rgb(var(--tm-edge-rgb) / 0.35), 0 0 18px rgb(${m.hue} / 0.18)` : undefined,
              }}
            >
              <span className="hidden sm:inline">TimeMachine </span>{m.short}
            </button>
          );
        })}
      </div>
      <p id="landing-composer-hint" className="mt-4 text-center text-xs text-white/40">
        {mind.mention
          ? `${mind.short} answers with a free TimeMachine ID. You'll be asked to create one first.`
          : 'Free to try, no account needed. Three messages, then a TimeMachine ID keeps you going.'}
      </p>
    </div>
  );
}

// ─── product stills ──────────────────────────────────────────────────

const HARNESS_STEPS = [
  { tool: 'write_file', arg: 'package.json', note: 'new · 20 lines' },
  { tool: 'write_file', arg: 'vite.config.js', note: 'new · 6 lines' },
  { tool: 'write_file', arg: 'index.html', note: 'new · 12 lines' },
  { tool: 'write_file', arg: 'src/main.jsx', note: 'new · 10 lines' },
  { tool: 'write_file', arg: 'src/game/engine.js', note: 'new · 407 lines' },
];

/** The transcript of the session in the screenshot, replayed once it scrolls into view. */
function HarnessLive({ reduced }: { reduced: boolean }) {
  const row = (i: number) => ({
    initial: reduced ? false : { opacity: 0, y: 8 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-15% 0px' },
    transition: { ...settle, duration: 0.5, delay: reduced ? 0 : 0.3 + i * 0.35 },
  });
  return (
    <div className="tm-glass flex h-full flex-col rounded-3xl p-4 font-mono text-[13px] sm:p-5" aria-hidden="true">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-full p-1" style={{ border: '1px solid rgb(var(--tm-ink-rgb) / 0.1)' }}>
          {(['Plan', 'Edit', 'Auto'] as const).map((m) => (
            <span key={m} className={`rounded-full px-3 py-1 font-sans text-xs ${m === 'Auto' ? 'bg-white/10 text-white' : 'text-white/40'}`}>{m}</span>
          ))}
        </div>
        <span className="font-sans text-xs font-semibold text-cyan-300/80">TimeMachine PRO</span>
      </div>
      <motion.p {...row(0)} className="mb-3 self-end rounded-2xl rounded-br-md px-4 py-2 font-sans text-[15px] text-white" style={{ background: 'rgb(var(--tm-ink-rgb) / 0.1)' }}>
        Make me a 3d racing game. In react.
      </motion.p>
      <motion.p {...row(1)} className="mb-3 px-1 font-sans text-sm leading-relaxed text-white/75">
        I&apos;ll build a 3D racing game in React using Three.js. Let me set up the project structure first.
      </motion.p>
      <ul className="flex flex-col gap-1.5">
        {HARNESS_STEPS.map((st, i) => (
          <motion.li key={st.arg} {...row(2 + i)} className="tm-glass-pill flex items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5" style={{ border: '1px solid rgb(var(--tm-ink-rgb) / 0.08)' }}>
            <span className="min-w-0 truncate"><span className="text-cyan-300">{st.tool}</span><span className="text-white/40"> {st.arg}</span></span>
            <span className="shrink-0 text-white/40">{st.note}</span>
          </motion.li>
        ))}
      </ul>
      <motion.p {...row(2 + HARNESS_STEPS.length)} className="px-1 pt-4 font-sans text-sm text-white/75">
        Now the core game engine — an endless 3D racer with Three.js
        <span className="tm-caret ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[3px] bg-cyan-300" />
      </motion.p>
    </div>
  );
}

// ─── page ────────────────────────────────────────────────────────────

export function LandingPage() {
  const navigate = useNavigate();
  const reduced = useReducedMotion() ?? false;
  const [mind, setMind] = useState<Mind>(MINDS[0]);

  const open = useCallback((state: LandingHandoff) => {
    markEnteredApp();
    navigate('/', { state });
  }, [navigate]);
  const startChatting = useCallback(() => open({ enter: true }), [open]);
  const logIn = useCallback(() => open({ openAuth: true }), [open]);
  const sendFirst = useCallback((text: string) => open({ initialPrompt: text }), [open]);

  const enter = (delay: number) => ({
    initial: reduced ? false : { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { ...settle, delay: reduced ? 0 : delay },
  });
  const reveal = (delay = 0) => ({
    initial: reduced ? false : { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-10% 0px' },
    transition: { ...settle, delay: reduced ? 0 : delay },
  });

  return (
    // body is overflow:hidden for the chat shell (index.css), so like every
    // other page this one scrolls inside its own root. `isolate` keeps the
    // negative-z layers inside this element instead of behind <body>.
    <div className="tm-landing tm-landing-home relative isolate h-screen overflow-y-auto overflow-x-hidden bg-black text-white">
      <Helmet>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..500;1,6..72,300..500&display=swap"
        />
      </Helmet>

      {/* ── Nav: a floating pill of glass ───────────────────────── */}
      <header className="fixed inset-x-0 top-3 z-30 px-3 sm:top-4 sm:px-6">
        <div className="tm-glass tm-nav mx-auto flex max-w-5xl items-center justify-between py-2 pl-3 pr-2 sm:pl-6">
          <a
            href="/welcome"
            onClick={(e) => { e.preventDefault(); (document.querySelector('.tm-landing') as HTMLElement | null)?.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); }}
            className="rounded-md"
            aria-label="TimeMachine, back to top"
          >
            <Wordmark className="text-[17px] sm:text-lg" />
          </a>
          <nav className="hidden items-center gap-7 text-sm text-white/65 md:flex" aria-label="Site">
            <button onClick={() => navigate('/features')} className="transition-colors hover:text-white">Features</button>
            <button onClick={() => navigate('/personas')} className="transition-colors hover:text-white">Personas</button>
            <button onClick={() => navigate('/about')} className="transition-colors hover:text-white">About</button>
            <button onClick={() => navigate('/help')} className="transition-colors hover:text-white">Help</button>
          </nav>
          <div className="flex items-center gap-1.5">
            <button onClick={logIn} className="tm-press tm-glass-pill rounded-full px-3 py-2 text-sm text-white/85 transition-colors hover:text-white sm:px-4">Log in</button>
            <button onClick={startChatting} className="tm-press rounded-full bg-pill px-3 py-2 text-sm font-medium text-pill-ink hover:opacity-90 sm:px-4">Start chatting</button>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ────────────────────────────────────────────────── */}
        {/* The atmosphere: Autumn Ember, and the three minds as weather. A
            page-level layer that fades out under the product shot, so no
            section edge ever cuts it. */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[150vh] overflow-x-clip"
          aria-hidden="true"
          style={{ maskImage: 'linear-gradient(to bottom, #000 55%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, #000 55%, transparent 100%)' }}
        >
          <div className="absolute inset-x-0 top-0 h-[135svh]" style={{ background: 'linear-gradient(to bottom, #000 0%, #0a0318 30%, #3b0764 62%, rgb(59 7 100 / 0) 100%)' }} />
          <div className="tm-orb tm-orb-a left-[8%] top-[6%] h-[52vmax] w-[52vmax]" style={{ background: 'rgb(168 85 247 / 0.28)' }} />
          <div className="tm-orb tm-orb-b right-[4%] top-[18%] h-[40vmax] w-[40vmax]" style={{ background: 'rgb(236 72 153 / 0.16)' }} />
          <div className="tm-orb tm-orb-c left-[36%] top-[45%] h-[38vmax] w-[38vmax]" style={{ background: 'rgb(34 211 238 / 0.12)' }} />
        </div>

        <section className="relative flex min-h-[78svh] items-center overflow-x-clip px-5 pb-24 pt-28 sm:min-h-[92svh] sm:px-8 sm:pb-48 sm:pt-44">

          <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
            <motion.h1
              {...enter(0.1)}
              className="tm-display text-[3.1rem] leading-[0.98] sm:text-7xl lg:text-[6rem]"
            >
              Hey there,
              <br />
              <em>from future.</em>
            </motion.h1>
            <motion.p {...enter(0.25)} className="mt-5 max-w-xl text-[17px] leading-[1.5] text-white/65 sm:mt-6 sm:text-xl sm:leading-relaxed">
              One chat. Three minds. A coding agent when you need one, and nothing about you for sale.
            </motion.p>
            <motion.div
              // No CSS filter on the way in: the glass composer inside would
              // flash black on iOS while the blur resolves.
              initial={reduced ? false : { opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ ...settle, delay: reduced ? 0 : 0.42 }}
              className="mt-10 w-full max-w-2xl sm:mt-16"
            >
              <Composer mind={mind} onMind={setMind} onSubmit={sendFirst} reduced={reduced} />
            </motion.div>
          </div>
        </section>

        {/* ── The product, as it is ────────────────────────────────── */}
        <section className="relative z-10 -mt-24 overflow-x-clip px-5 sm:-mt-40 sm:px-8" aria-label="The TimeMachine chat">
          <Glow hue="168 85 247" className="left-1/2 top-[20%] h-[50vmax] w-[70vmax] -translate-x-1/2" alpha={0.12} />
          <motion.figure
            initial={reduced ? false : { opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...settle, duration: 1.1, delay: reduced ? 0 : 0.6 }}
            className="tm-panel relative mx-auto m-0 max-w-6xl overflow-hidden rounded-3xl"
           
          >
            <img
              src="/landing/screen-chat.webp"
              alt="The TimeMachine chat: a three-day Kyoto plan from TimeMachine Air, with a budget table and the composer below."
              width={2848}
              height={1800}
              fetchPriority="high"
              className="block w-full"
            />
          </motion.figure>
        </section>

        {/* ── What it is ──────────────────────────────────────────── */}
        <section className="relative mx-auto max-w-6xl px-5 pb-8 pt-20 sm:px-8 lg:pt-28" aria-label="What TimeMachine is">
          <motion.p {...reveal()} className="tm-display max-w-3xl text-3xl leading-[1.15] text-white/75 sm:text-4xl lg:text-[44px]">
            <span className="text-white">A new kind of app.</span> One chat holding three minds, a coding agent and the tools you reach for every day — built around <em className="text-white">your privacy,</em> not your data.
          </motion.p>
          <motion.dl {...reveal(0.08)} className="tm-panel relative mt-14 grid overflow-hidden rounded-3xl sm:grid-cols-3">
            {[
              ['FIG 0.1', 'Three minds', 'Air for speed, Girlie for the vibe, PRO for depth. Switch mid-conversation with an @mention.', '/landing/fig-1.webp', 'Three cubes clustered together, their top edges lit violet, pink and cyan', '168 85 247'],
              ['FIG 0.2', 'Made for agents', 'PRO reads, edits and runs code in a workspace on your device, then opens the pull request.', '/landing/fig-2.webp', 'A stack of thin slabs with the top one lifted on guide lines and a small cube above it', '34 211 238'],
              ['FIG 0.3', 'Private by design', 'No ads, no data brokers, and every AI provider that sees a message is named.', '/landing/fig-3.webp', 'A closed box with a single violet seam of light, inside a dashed boundary', '168 85 247'],
            ].map(([fig, term, what, src, alt, hue], i) => (
              <div
                key={term}
                className={`relative flex flex-col p-7 sm:p-8 ${i > 0 ? 'border-t sm:border-l sm:border-t-0' : ''}`}
                style={{ borderColor: 'rgb(var(--tm-ink-rgb) / 0.08)' }}
              >
                <Glow hue={hue} className="left-1/2 top-[38%] h-[260px] w-[260px] -translate-x-1/2 -translate-y-1/2" alpha={0.1} />
                <span className="relative font-mono text-[11px] tracking-[0.14em] text-white/35">{fig}</span>
                <img src={src} alt={alt} width={512} height={512} loading="lazy" className="tm-art relative my-4 w-full max-w-[280px] self-center sm:my-6" />
                <dt className="relative mt-auto text-[17px] font-semibold text-white">{term}</dt>
                <dd className="relative mt-2 text-[15px] leading-relaxed text-white/55">{what}</dd>
              </div>
            ))}
          </motion.dl>
        </section>

        {/* ── Three minds ─────────────────────────────────────────── */}
        <section className="relative overflow-hidden px-5 py-20 sm:px-8 lg:py-28" aria-labelledby="minds-heading">
          <Glow hue="168 85 247" className="left-[5%] top-[35%] h-[60vmax] w-[60vmax]" alpha={0.12} />
          <Glow hue="236 72 153" className="left-[40%] top-[55%] h-[45vmax] w-[45vmax]" alpha={0.08} />
          <Glow hue="34 211 238" className="right-[-5%] top-[45%] h-[45vmax] w-[45vmax]" alpha={0.08} />
          <div className="relative mx-auto max-w-6xl">
            <motion.h2 {...reveal()} id="minds-heading" className="tm-display max-w-2xl text-[2.75rem] leading-[1] sm:text-6xl lg:text-[68px]">
              Three minds,
              <br />
              <em>one conversation.</em>
            </motion.h2>
            <motion.p {...reveal(0.06)} className="mt-6 max-w-xl text-lg leading-relaxed text-white/60">
              Each mind has its own voice and its own strengths. Start a message with{' '}
              <span className="font-mono text-[15px] text-white/85">@girlie</span> or{' '}
              <span className="font-mono text-[15px] text-white/85">@pro</span> and that one answers, in the same thread, without switching apps.
            </motion.p>
            <motion.div {...reveal(0.1)}>
              <button onClick={() => navigate('/personas')} className="group mt-6 inline-flex items-center gap-1.5 text-sm text-white/70 transition-colors hover:text-white">
                Meet the personas <Arrow />
              </button>
            </motion.div>

            <motion.figure {...reveal(0.12)} className="mt-12">
              <div className="tm-panel overflow-hidden rounded-3xl">
                <img
                  src="/landing/illo-minds.webp"
                  alt="Three plinths in a row: a violet cube in flight with a trail, a pink sphere with two orbits, and a cyan wireframe crystal."
                  width={1672}
                  height={941}
                  loading="lazy"
                  className="tm-art block w-full"
                />
                <div className="grid grid-cols-3 border-t" style={{ borderColor: 'rgb(var(--tm-ink-rgb) / 0.08)' }}>
                  {MINDS.map((m, i) => (
                    <div
                      key={m.key}
                      className={`relative px-4 py-5 sm:px-6 sm:py-6 ${i > 0 ? 'border-l' : ''}`}
                      style={{ borderColor: 'rgb(var(--tm-ink-rgb) / 0.08)', background: `linear-gradient(to bottom, rgb(${m.hue} / 0.07), transparent)` }}
                    >
                      <p className="text-sm font-semibold sm:text-base" style={{ color: `rgb(${m.hue})` }}>{AI_PERSONAS[m.key].name}</p>
                      <p className="mt-1 text-xs text-white/50 sm:text-sm">{m.role}</p>
                      <p className="mt-2 hidden text-sm leading-relaxed text-white/55 md:block">{m.detail}</p>
                      <p className="mt-3 hidden font-mono text-xs text-white/35 md:block">“{AI_PERSONAS[m.key].initialMessage}”</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.figure>

            <FeatureList
              items={[
                ['TimeMachine Air', 'The default mind. Fast answers, drafts, plans and explanations for everyday use.'],
                ['TimeMachine Girlie', 'Warm, expressive and on your side — for life, style and the late-night rant.'],
                ['TimeMachine PRO', 'Deep reasoning for analysis, research and code. Becomes a coding agent in Max Mode.'],
                ['@mentions', 'Start a message with @girlie or @pro and that mind takes the turn, mid-conversation.'],
                ['Flight Controls', 'Turn tools, web search and MCP servers on or off per conversation.'],
                ['Memory', 'Facts and preferences carry across chats. You can read and delete every entry.'],
              ]}
            />
          </div>
        </section>

        {/* ── Max Mode ────────────────────────────────────────────── */}
        <section className="relative overflow-hidden px-5 py-20 sm:px-8 lg:py-28" aria-labelledby="max-heading">
          <Glow hue="34 211 238" className="right-[-10%] top-[45%] h-[70vmax] w-[70vmax]" alpha={0.09} />
          <div className="relative mx-auto max-w-6xl">
            <motion.h2 {...reveal()} id="max-heading" className="tm-display max-w-2xl text-[2.75rem] leading-[1] sm:text-6xl lg:text-[68px]">
              PRO, with its hands
              <br />
              <em>on the keyboard.</em>
            </motion.h2>
            <motion.p {...reveal(0.06)} className="mt-6 max-w-xl text-lg leading-relaxed text-white/60">
              Flip Max Mode on and PRO becomes a coding agent. The project lives in a workspace on your device, the code runs in a Node runtime inside your browser, and when it&apos;s done it opens the pull request on GitHub.
            </motion.p>
            <motion.div {...reveal(0.1)}>
              <button onClick={() => navigate('/personas')} className="group mt-6 inline-flex items-center gap-1.5 text-sm text-white/70 transition-colors hover:text-white">
                Learn more <Arrow />
              </button>
            </motion.div>

            <motion.figure {...reveal(0.12)} className="tm-panel relative mt-12 overflow-hidden rounded-3xl">
              <img
                src="/landing/screen-maxmode.webp"
                alt="Max Mode in Auto: PRO writing package.json, vite.config.js, index.html, src/main.jsx and a 407-line game engine for a 3D racing game, with the workspace file tree and vite.config.js open in the editor beside the chat."
                width={2000}
                height={1412}
                loading="lazy"
                className="block w-full"
              />
              <figcaption className="tm-glass absolute bottom-4 right-4 flex items-center gap-2 rounded-full py-1.5 pl-3 pr-3.5 font-sans text-xs text-white/85 sm:bottom-6 sm:right-6">
                <span className="tm-live-dot h-2 w-2 rounded-full bg-cyan-300" />
                A real Max Mode session · Auto
              </figcaption>
            </motion.figure>

            <motion.div {...reveal(0.1)} className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="min-w-0">
                <HarnessLive reduced={reduced} />
              </div>
              <figure className="tm-panel m-0 overflow-hidden rounded-3xl">
                <img
                  src="/landing/illo-workspace.webp"
                  alt="A transparent cube containing a grid of connected nodes, with a thread of light running down from its base to the ground."
                  width={1672}
                  height={941}
                  loading="lazy"
                  className="tm-art block h-full w-full object-cover"
                />
              </figure>
            </motion.div>

            <FeatureList
              items={[
                ['Plan', 'Reads and explains. Changes nothing.'],
                ['Edit', 'Reads and writes files. Never runs anything.'],
                ['Auto', 'The full loop: edit, run, preview, fix, repeat.'],
                ['Workspace on your device', 'The project is stored in your browser, one workspace per chat. No upload.'],
                ['Node runtime in the browser', 'npm install, tests and dev servers run in a WebContainer, with a live preview.'],
                ['GitHub', 'Clone a repository, commit to a branch, or open a pull request for review.'],
              ]}
            />
          </div>
        </section>

        {/* ── Contour and everything in the chat ───────────────────── */}
        <section className="relative overflow-hidden px-5 py-20 sm:px-8 lg:py-28" aria-labelledby="contour-heading">
          <Glow hue="168 85 247" className="left-[-10%] top-[55%] h-[60vmax] w-[60vmax]" alpha={0.1} />
          <div className="relative mx-auto max-w-6xl">
            <motion.h2 {...reveal()} id="contour-heading" className="tm-display max-w-2xl text-[2.75rem] leading-[1] sm:text-6xl lg:text-[68px]">
              Type <span className="font-mono text-[0.8em] text-white/70">/</span> and the tools
              <br />
              <em>come to you.</em>
            </motion.h2>
            <motion.p {...reveal(0.06)} className="mt-6 max-w-xl text-lg leading-relaxed text-white/60">
              Contour is a command palette inside the chat: a calculator, converters, a timer, a translator, JSON and regex tools, quick notes and events — thirty in all. No tab switching, no other app.
            </motion.p>
            <motion.div {...reveal(0.1)}>
              <button onClick={() => navigate('/features')} className="group mt-6 inline-flex items-center gap-1.5 text-sm text-white/70 transition-colors hover:text-white">
                Every feature <Arrow />
              </button>
            </motion.div>

            <motion.figure {...reveal(0.12)} className="tm-panel mt-12 overflow-hidden rounded-3xl">
              <img
                src="/landing/screen-contour.webp"
                alt="The Contour palette open in the chat, listing the unit, currency, timezone and colour converters."
                width={1684}
                height={792}
                loading="lazy"
                className="block w-full"
              />
            </motion.figure>

            <motion.ul {...reveal(0.1)} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Also in the chat">
              {[
                ['Notes', 'A block editor for thoughts, lists and tables. The AI can search them when you ask.', '/landing/tile-1.webp', '168 85 247'],
                ['Group chat', 'One conversation, your friends, the same AI in the room.', '/landing/tile-2.webp', '96 165 250'],
                ['TM Healthcare', 'Medicines, generics, dosages and side effects from a real drug index.', '/landing/tile-3.webp', '248 113 113'],
                ['Images', 'Describe it and it appears in the chat. Everything lands in your album.', '/landing/tile-4.webp', '251 191 36'],
                ['Music', 'A player that follows the mood of the conversation.', '/landing/tile-5.webp', '236 72 153'],
                ['Voice', 'Talk, watch the transcript appear, edit it, then send.', '/landing/tile-6.webp', '34 211 238'],
              ].map(([name, what, src, hue]) => (
                <li key={name} className="tm-panel group relative overflow-hidden rounded-3xl">
                  <Glow hue={hue} className="left-1/2 top-[30%] h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2" alpha={0.12} />
                  <div className="relative aspect-[3/2] w-full overflow-hidden">
                    <img src={src} alt="" width={512} height={341} loading="lazy" aria-hidden="true" className="tm-art absolute inset-0 h-full w-full object-contain transition-transform duration-500 ease-out group-hover:scale-[1.04]" />
                  </div>
                  <div className="relative border-t px-5 pb-5 pt-4" style={{ borderColor: 'rgb(var(--tm-ink-rgb) / 0.08)' }}>
                    <p className="font-semibold text-white">{name}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-white/55">{what}</p>
                  </div>
                </li>
              ))}
            </motion.ul>

            <motion.figure {...reveal(0.1)} className="tm-panel mt-4 overflow-hidden rounded-3xl">
              <img
                src="/landing/screen-notes.webp"
                alt="TimeMachine Notes with a Kyoto trip note open: headings, a checklist, a bullet list and a quote, and the Notes composer below."
                width={2848}
                height={1800}
                loading="lazy"
                className="block w-full"
              />
              <figcaption className="border-t px-5 py-4 text-sm text-white/50" style={{ borderColor: 'rgb(var(--tm-ink-rgb) / 0.08)' }}>
                <span className="text-white">Notes.</span> A block editor with headings, checklists, tables and code — and an AI composer that can search and edit them.
              </figcaption>
            </motion.figure>
          </div>
        </section>

        {/* ── Privacy ─────────────────────────────────────────────── */}
        <section className="relative overflow-hidden px-5 py-20 sm:px-8 lg:py-28" aria-labelledby="privacy-heading">
          <Glow hue="52 211 153" className="right-[10%] top-[50%] h-[50vmax] w-[50vmax]" alpha={0.06} />
          <div className="relative mx-auto max-w-6xl">
            <motion.div {...reveal()} className="tm-panel grid overflow-hidden rounded-3xl lg:grid-cols-[1.1fr_1fr]">
              <div className="p-8 sm:p-12 lg:p-16">
                <h2 id="privacy-heading" className="tm-display text-[2.75rem] leading-[1] sm:text-6xl">
                  Only what we
                  <br />
                  <em>can say plainly.</em>
                </h2>
                <ul className="mt-8 flex max-w-lg flex-col gap-5 text-[17px] leading-relaxed text-white/70">
                  <li>No ads, and nothing about you is sold or shared with data brokers.</li>
                  <li>Every AI provider that processes a message is named in the privacy policy, so you know where a prompt goes before you send it.</li>
                  <li>Memory is yours to read and delete, one entry at a time, and your account can be deleted from inside the app.</li>
                </ul>
                <button onClick={() => navigate('/privacy')} className="group mt-8 inline-flex items-center gap-1.5 text-sm text-white/70 transition-colors hover:text-white">
                  Read the privacy policy <Arrow />
                </button>
              </div>
              <div className="relative min-h-[320px] overflow-hidden border-t lg:border-l lg:border-t-0" style={{ borderColor: 'rgb(var(--tm-ink-rgb) / 0.08)' }}>
                <Glow hue="168 85 247" className="left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2" alpha={0.16} />
                <Glow hue="52 211 153" className="left-[60%] top-[15%] h-[220px] w-[220px] -translate-x-1/2" alpha={0.08} />
                <img
                  src="/landing/illo-vault.webp"
                  alt="A vault with its round door ajar, violet light spilling from the gap, three glass keys floating around it inside a dashed boundary."
                  width={1254}
                  height={1254}
                  loading="lazy"
                  className="tm-art absolute inset-0 h-full w-full object-cover object-center"
                />
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── Close ───────────────────────────────────────────────── */}
        <section className="relative overflow-hidden px-5 py-20 sm:px-8 lg:py-28">
          <Glow hue="168 85 247" className="right-[0%] top-[50%] h-[60vmax] w-[60vmax]" alpha={0.1} />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <motion.h2 {...reveal()} className="tm-display max-w-2xl text-5xl leading-[0.98] sm:text-7xl">
                See you <em>there.</em>
              </motion.h2>
              <motion.div {...reveal(0.08)} className="mt-9 flex flex-wrap items-center gap-3">
                <button onClick={startChatting} className="tm-press inline-flex items-center gap-2 rounded-full bg-pill px-6 py-3 text-base font-medium text-pill-ink hover:opacity-90">
                  Start chatting <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
                <button onClick={logIn} className="tm-press tm-glass-pill rounded-full px-6 py-3 text-base text-white/85 transition-colors hover:text-white" style={{ border: '1px solid rgb(var(--tm-ink-rgb) / 0.14)' }}>
                  Log in
                </button>
              </motion.div>
            </div>
            <motion.div {...reveal(0.1)} className="hidden lg:block">
              <img
                src="/landing/illo-ring.webp"
                alt=""
                width={1672}
                height={941}
                loading="lazy"
                aria-hidden="true"
                className="tm-art block w-full"
              />
            </motion.div>
          </div>
        </section>
      </main>

      <footer className="px-5 pb-6 sm:px-8">
        <div className="tm-glass mx-auto grid max-w-6xl gap-10 rounded-3xl px-6 py-10 sm:px-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Wordmark className="text-base" />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/40">Everything you need, in one chat. Built by TimeMachine Mafia.</p>
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
