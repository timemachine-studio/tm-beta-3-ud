import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Arrow, Display, Glow, MarketingShell } from '../landing/MarketingShell';
import { useEnterApp, useReveal } from '../landing/marketing';

const VALUES = [
  ['Fast', 'Air answers at the speed of a thought. Waiting for a spinner is a bug we fix, not a cost we accept.', '/landing/fig-1.webp', '168 85 247'],
  ['Private first', 'No ads, no data brokers, and every AI provider that processes a message is named in the privacy policy.', '/landing/fig-3.webp', '52 211 153'],
  ['Built with care', 'Every pixel, interaction and reply is crafted around you. You are the main character here, not the product.', '/landing/icon-about.webp', '236 72 153'],
  ['One app, three minds', 'Air, Girlie and PRO in one interface. No switching apps, no extra subscriptions.', '/landing/persona-3.webp', '34 211 238'],
] as const;

export function AboutPage() {
  const navigate = useNavigate();
  const { reveal } = useReveal();
  const { startChatting } = useEnterApp();

  return (
    <MarketingShell hue="168 85 247">
      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <motion.div {...reveal()}>
            <Display className="max-w-3xl text-[2.9rem] leading-[1] sm:text-6xl lg:text-[76px]">
              AI for the betterment
              <br />
              <em>of humanity.</em>
            </Display>
          </motion.div>
          <motion.p {...reveal(0.06)} className="mt-6 max-w-xl text-lg leading-relaxed text-white/60 sm:text-xl">
            TimeMachine is the super app that brings your tech essentials into one intelligent, safe chat. We are building how people will talk to technology next — and doing it with your privacy as the headline, not the footnote.
          </motion.p>
        </div>
        <motion.div {...reveal(0.08)} className="tm-panel relative hidden overflow-hidden rounded-3xl lg:block">
          <Glow hue="168 85 247" className="left-1/2 top-1/2 h-[60vmax] w-[60vmax] -translate-x-1/2 -translate-y-1/2" alpha={0.1} />
          <img src="/landing/illo-ring.webp" alt="" width={1672} height={941} aria-hidden="true" className="tm-art relative block w-full" />
        </motion.div>
      </section>

      {/* ── Values ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pt-20 sm:px-8 lg:pt-28" aria-label="What we stand for">
        <motion.ul {...reveal()} className="grid gap-4 sm:grid-cols-2">
          {VALUES.map(([name, what, src, hue]) => (
            <li key={name} className="tm-panel relative grid overflow-hidden rounded-3xl sm:grid-cols-[150px_1fr]">
              <Glow hue={hue} className="left-[-10%] top-1/2 h-[260px] w-[260px] -translate-y-1/2" alpha={0.12} />
              <div className="relative flex items-center justify-center p-5">
                <img src={src} alt="" width={512} height={512} loading="lazy" aria-hidden="true" className="tm-art block max-h-[140px] w-auto" />
              </div>
              <div className="relative border-t p-6 sm:border-l sm:border-t-0" style={{ borderColor: 'rgb(var(--tm-ink-rgb) / 0.08)' }}>
                <p className="text-lg font-semibold text-white">{name}</p>
                <p className="mt-2 text-[15px] leading-relaxed text-white/55">{what}</p>
              </div>
            </li>
          ))}
        </motion.ul>
      </section>

      {/* ── The three minds ─────────────────────────────────────── */}
      <section className="relative mx-auto max-w-6xl px-5 pt-20 sm:px-8 lg:pt-28" aria-labelledby="a-minds">
        <Glow hue="236 72 153" className="right-[-10%] top-[30%] h-[50vmax] w-[50vmax]" alpha={0.07} />
        <div className="relative">
          <motion.div {...reveal()}>
            <Display as="h2" id="a-minds" className="max-w-2xl text-[2.5rem] leading-[1] sm:text-5xl lg:text-[60px]">
              Three minds, <em>on purpose.</em>
            </Display>
          </motion.div>
          <motion.p {...reveal(0.06)} className="mt-5 max-w-xl text-lg leading-relaxed text-white/60">
            We didn&apos;t want one AI that is fine at everything. Air is fast, Girlie gets the vibe, PRO goes deep — and all three sit in the same conversation, one @mention apart.
          </motion.p>
          <motion.figure {...reveal(0.1)} className="tm-panel mt-10 overflow-hidden rounded-3xl">
            <img src="/landing/illo-minds.webp" alt="Three plinths in a row: a violet cube in flight, a pink sphere with two orbits, and a cyan wireframe crystal." width={1672} height={941} loading="lazy" className="tm-art block w-full" />
          </motion.figure>
          <motion.div {...reveal(0.12)}>
            <button onClick={() => navigate('/personas')} className="group mt-6 inline-flex items-center gap-1.5 text-sm text-white/70 transition-colors hover:text-white">
              Meet the personas <Arrow />
            </button>
          </motion.div>
        </div>
      </section>

      {/* ── The team ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pt-20 sm:px-8 lg:pt-28" aria-labelledby="a-team">
        <motion.div {...reveal()} className="tm-panel relative overflow-hidden rounded-3xl p-7 sm:p-12">
          <Glow hue="168 85 247" className="right-[-10%] top-[-30%] h-[50vmax] w-[50vmax]" alpha={0.08} />
          <div className="relative max-w-2xl">
            <Display as="h2" id="a-team" className="text-4xl leading-[1] sm:text-5xl">
              TimeMachine <em>Mafia.</em>
            </Display>
            <p className="mt-5 text-[17px] leading-relaxed text-white/65">
              Tanzim Ibne Mahboob founded TimeMachine Mafia with co-founder Shafin Sheikh. As co-owners, they're on a mission to change how people interact with technology. We believe AI should be accessible, personal, and built with integrity.
            </p>
            <p className="mt-4 text-[17px] leading-relaxed text-white/65">
              We are not building an assistant that answers questions. We are building a companion that understands you — and every decision, from the storage model to the wording of a settings toggle, puts you first.
            </p>
          </div>
        </motion.div>
      </section>

      {/* ── Close ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pt-24 sm:px-8 lg:pt-32">
        <motion.div {...reveal()}>
          <Display as="h2" className="max-w-2xl text-5xl leading-[0.98] sm:text-7xl">
            Hey there, <em>from future.</em>
          </Display>
        </motion.div>
        <motion.div {...reveal(0.08)} className="mt-8 flex flex-wrap items-center gap-3">
          <button onClick={startChatting} className="tm-press inline-flex items-center gap-2 rounded-full bg-pill px-6 py-3 text-base font-medium text-pill-ink hover:opacity-90">
            Start chatting <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <button onClick={() => navigate('/contact')} className="tm-press tm-glass tm-glass-pill rounded-full px-6 py-3 text-base text-white/85 transition-colors hover:text-white">
            Contact us
          </button>
        </motion.div>
      </section>
    </MarketingShell>
  );
}
