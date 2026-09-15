import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { AI_PERSONAS } from '../../config/constants';
import { Arrow, Display, FeatureList, Glow, MarketingShell } from '../landing/MarketingShell';
import { useEnterApp, useReveal } from '../landing/marketing';

/* One plate per mind. Names and greetings come from the app; the portraits
   are the three objects of the landing page's minds illustration. */

const MINDS = [
  {
    key: 'default' as const,
    hue: '168 85 247',
    role: 'Everyday, at speed',
    art: '/landing/persona-1.webp',
    alt: 'A violet cube in flight, trailing three lines of light',
    body: 'The default mind. Answers, drafts, plans, quick explanations and casual conversation, back before you finish the thought. Air is the one that is always on.',
    good: ['Fast answers and explanations', 'Writing and rewriting', 'Plans, lists, everyday questions'],
  },
  {
    key: 'girlie' as const,
    hue: '236 72 153',
    role: 'Gets the vibe',
    art: '/landing/persona-2.webp',
    alt: 'A pink sphere with two orbit rings',
    body: 'Warmer, louder, on your side. Girlie speaks your language, hypes you up and keeps the energy right — life advice, outfit calls, and the late-night rant.',
    good: ['Life and style advice', 'Reading a text before you send it', 'A hype-up when you need one'],
  },
  {
    key: 'pro' as const,
    hue: '34 211 238',
    role: 'Deep work',
    art: '/landing/persona-3.webp',
    alt: 'A cyan wireframe octahedron',
    body: 'The most capable mind. PRO reasons through the hard ones — analysis, research, strategy and code — and in Max Mode becomes a coding agent with a workspace on your device.',
    good: ['Analysis and research', 'Code review and debugging', 'Max Mode: a coding agent'],
  },
];

export function PersonasPage() {
  const navigate = useNavigate();
  const { reveal } = useReveal();
  const { startChatting, sendFirst } = useEnterApp();

  return (
    <MarketingShell hue="236 72 153">
      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 sm:px-8">
        <motion.div {...reveal()}>
          <Display className="max-w-3xl text-[2.9rem] leading-[1] sm:text-6xl lg:text-[76px]">
            Three minds,
            <br />
            <em>one conversation.</em>
          </Display>
        </motion.div>
        <motion.p {...reveal(0.06)} className="mt-6 max-w-xl text-lg leading-relaxed text-white/60 sm:text-xl">
          Each mind opens the conversation in its own words and has its own strengths. Start a message with{' '}
          <span className="font-mono text-[0.95em] text-white/85">@girlie</span> or{' '}
          <span className="font-mono text-[0.95em] text-white/85">@pro</span> and that one answers, in the same thread.
        </motion.p>
      </section>

      {/* ── The three plates ──────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pt-16 sm:px-8 lg:pt-20" aria-label="The personas">
        <div className="flex flex-col gap-6">
          {MINDS.map((m, i) => (
            <motion.article
              key={m.key}
              {...reveal(0.05)}
              className="tm-panel relative grid overflow-hidden rounded-3xl lg:grid-cols-[1fr_1.1fr]"
              aria-labelledby={`persona-${m.key}`}
            >
              <Glow hue={m.hue} className={`top-1/2 h-[60vmax] w-[60vmax] -translate-y-1/2 ${i % 2 === 0 ? 'left-[-20%]' : 'right-[-20%]'}`} alpha={0.1} />
              <div className={`relative flex items-center justify-center p-6 sm:p-10 ${i % 2 === 1 ? 'lg:order-2' : ''}`}>
                <img src={m.art} alt={m.alt} width={556} height={700} loading={i === 0 ? 'eager' : 'lazy'} className="tm-art max-h-[360px] w-auto" />
              </div>
              <div className={`relative border-t p-7 sm:p-10 lg:border-l lg:border-t-0 ${i % 2 === 1 ? 'lg:order-1 lg:border-l-0 lg:border-r' : ''}`} style={{ borderColor: 'rgb(var(--tm-ink-rgb) / 0.08)' }}>
                <p className="text-sm font-semibold" style={{ color: `rgb(${m.hue})` }}>{m.role}</p>
                <Display as="h2" id={`persona-${m.key}`} className="mt-2 text-4xl leading-[1] sm:text-5xl">
                  {AI_PERSONAS[m.key].name.replace('TimeMachine ', '')}
                </Display>
                <p className="mt-4 max-w-lg text-[17px] leading-relaxed text-white/65">{m.body}</p>
                <ul className="mt-6 flex flex-wrap gap-2">
                  {m.good.map((g) => (
                    <li key={g} className="tm-glass tm-glass-pill rounded-full px-3.5 py-1.5 text-sm text-white/80">{g}</li>
                  ))}
                </ul>
                <p className="mt-6 font-mono text-sm text-white/40">“{AI_PERSONAS[m.key].initialMessage}”</p>
                <button
                  onClick={() => sendFirst(m.key === 'default' ? 'Hey' : `@${m.key} Hey`)}
                  className="group mt-6 inline-flex items-center gap-1.5 text-sm transition-colors hover:text-white"
                  style={{ color: `rgb(${m.hue})` }}
                >
                  Say hi to {AI_PERSONAS[m.key].name.replace('TimeMachine ', '')} <Arrow />
                </button>
              </div>
            </motion.article>
          ))}
        </div>

        <FeatureList
          label="How switching works"
          items={[
            ['@mentions', 'Start a message with @girlie or @pro and that mind takes the turn, mid-conversation. The rest of the chat stays with the mind you chose.'],
            ['Persona menu', 'Tap the name at the top of the chat to change the mind for the whole conversation.'],
            ['Girlie and PRO need an ID', 'Air is free to try without an account. Girlie and PRO answer once you have a free TimeMachine ID.'],
          ]}
        />
      </section>

      {/* ── Max Mode callout ─────────────────────────────────────── */}
      <section className="relative mx-auto max-w-6xl px-5 pt-20 sm:px-8 lg:pt-28" aria-labelledby="p-max">
        <div className="tm-panel relative grid overflow-hidden rounded-3xl lg:grid-cols-[1fr_1.2fr]">
          <Glow hue="34 211 238" className="right-[-10%] top-1/2 h-[60vmax] w-[60vmax] -translate-y-1/2" alpha={0.08} />
          <div className="relative p-7 sm:p-10">
            <p className="text-sm font-semibold text-cyan-300">PRO only</p>
            <Display as="h2" id="p-max" className="mt-2 text-4xl leading-[1] sm:text-5xl">
              Max Mode
            </Display>
            <p className="mt-4 max-w-md text-[17px] leading-relaxed text-white/65">
              Flip it on and PRO reads, edits and runs code in a workspace on your device, previews the result, and opens the pull request on GitHub when it&apos;s done.
            </p>
            <button onClick={() => navigate('/features')} className="group mt-6 inline-flex items-center gap-1.5 text-sm text-white/70 transition-colors hover:text-white">
              See it in Features <Arrow />
            </button>
          </div>
          <figure className="relative m-0 border-t lg:border-l lg:border-t-0" style={{ borderColor: 'rgb(var(--tm-ink-rgb) / 0.08)' }}>
            <img
              src="/landing/screen-maxmode.webp"
              alt="Max Mode in Auto: PRO writing the files for a 3D racing game beside the workspace editor."
              width={2000}
              height={1412}
              loading="lazy"
              className="block h-full w-full object-cover object-left-top"
            />
          </figure>
        </div>
      </section>

      {/* ── Close ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pt-24 sm:px-8 lg:pt-32">
        <motion.div {...reveal()}>
          <Display as="h2" className="max-w-2xl text-5xl leading-[0.98] sm:text-7xl">
            Pick a mind, <em>say hi.</em>
          </Display>
        </motion.div>
        <motion.div {...reveal(0.08)} className="mt-8 flex flex-wrap items-center gap-3">
          <button onClick={startChatting} className="tm-press inline-flex items-center gap-2 rounded-full bg-pill px-6 py-3 text-base font-medium text-pill-ink hover:opacity-90">
            Start chatting <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="text-sm text-white/40">Free to try, no account needed.</span>
        </motion.div>
      </section>
    </MarketingShell>
  );
}
