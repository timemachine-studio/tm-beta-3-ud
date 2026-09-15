import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Arrow, Display, FeatureList, Glow, MarketingShell } from '../landing/MarketingShell';
import { useEnterApp, useReveal } from '../landing/marketing';

/* Every feature the chat holds, each with its own plate. Copy stays literally
   true — see CLAUDE.md on privacy claims. */

const TILES = [
  ['Contour', 'Type / and thirty tools open inside the chat: calculator, converters, timer, translator, JSON, regex, notes, events.', '/landing/icon-contour.webp', '168 85 247'],
  ['Memory', 'Tell it once. Facts and preferences carry across chats, and you can read and delete every entry.', '/landing/icon-memory.webp', '168 85 247'],
  ['Flight Controls', 'Turn tools, web search and MCP servers on or off, per conversation.', '/landing/icon-flight.webp', '52 211 153'],
  ['Notes', 'A block editor for thoughts, lists and tables. The AI can search them when you ask.', '/landing/tile-1.webp', '168 85 247'],
  ['Group chat', 'One conversation, your friends, the same AI in the room. Share a link to invite.', '/landing/tile-2.webp', '96 165 250'],
  ['TM Healthcare', 'Medicines, generics, dosages and side effects from a real drug index.', '/landing/tile-3.webp', '248 113 113'],
  ['Images', 'Describe it and it appears in the chat. Everything you make lands in your album.', '/landing/tile-4.webp', '251 191 36'],
  ['Album', 'Every generated and uploaded image, kept in one place.', '/landing/icon-album.webp', '236 72 153'],
  ['Music', 'A player that follows the mood of the conversation.', '/landing/tile-5.webp', '236 72 153'],
  ['Voice', 'Talk, watch the transcript appear, edit it, then send.', '/landing/tile-6.webp', '34 211 238'],
  ['Web coding mode', 'Build small web pages in the chat and preview them live.', '/landing/icon-webcode.webp', '34 211 238'],
  ['Themes', 'Seasons in dark, a paper-warmth slider in light, and a pure black mode.', '/landing/icon-themes.webp', '251 191 36'],
] as const;

export function FeaturesPage() {
  const navigate = useNavigate();
  const { reveal } = useReveal();
  const { startChatting } = useEnterApp();

  return (
    <MarketingShell hue="168 85 247">
      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 sm:px-8">
        <motion.div {...reveal()}>
          <Display className="max-w-3xl text-[2.9rem] leading-[1] sm:text-6xl lg:text-[76px]">
            Everything you need,
            <br />
            <em>in one chat.</em>
          </Display>
        </motion.div>
        <motion.p {...reveal(0.06)} className="mt-6 max-w-xl text-lg leading-relaxed text-white/60 sm:text-xl">
          TimeMachine replaces a dozen apps with one conversation: three minds, a coding agent, thirty tools, notes, images, music — and a privacy policy you can actually read.
        </motion.p>
        <motion.div {...reveal(0.1)} className="mt-8 flex flex-wrap items-center gap-3">
          <button onClick={startChatting} className="tm-press inline-flex items-center gap-2 rounded-full bg-pill px-5 py-2.5 text-sm font-medium text-pill-ink hover:opacity-90">
            Start chatting <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <button onClick={() => navigate('/personas')} className="group inline-flex items-center gap-1.5 px-2 text-sm text-white/70 transition-colors hover:text-white">
            Meet the personas <Arrow />
          </button>
        </motion.div>
      </section>

      {/* ── Contour ──────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-6xl px-5 pt-20 sm:px-8 lg:pt-28" aria-labelledby="f-contour">
        <Glow hue="168 85 247" className="left-[-10%] top-[40%] h-[50vmax] w-[50vmax]" alpha={0.08} />
        <div className="relative">
          <motion.div {...reveal()}>
            <Display as="h2" id="f-contour" className="max-w-2xl text-[2.5rem] leading-[1] sm:text-5xl lg:text-[60px]">
              Type <span className="font-mono text-[0.8em] text-white/70">/</span> and the tools <em>come to you.</em>
            </Display>
          </motion.div>
          <motion.p {...reveal(0.06)} className="mt-5 max-w-xl text-lg leading-relaxed text-white/60">
            Contour is a command palette inside the chat. Calculator, unit and currency converters, timezone and colour converters, a timer, a translator, JSON and regex tools, quick notes and events, a hash generator — thirty in all, no tab switching.
          </motion.p>
          <motion.figure {...reveal(0.1)} className="tm-panel mt-10 overflow-hidden rounded-3xl">
            <img
              src="/landing/screen-contour.webp"
              alt="The Contour palette open in the chat, listing the unit, currency, timezone and colour converters."
              width={1684}
              height={792}
              loading="lazy"
              className="block w-full"
            />
          </motion.figure>
        </div>
      </section>

      {/* ── Max Mode ─────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-6xl px-5 pt-20 sm:px-8 lg:pt-28" aria-labelledby="f-max">
        <Glow hue="34 211 238" className="right-[-10%] top-[40%] h-[60vmax] w-[60vmax]" alpha={0.08} />
        <div className="relative">
          <motion.div {...reveal()}>
            <Display as="h2" id="f-max" className="max-w-2xl text-[2.5rem] leading-[1] sm:text-5xl lg:text-[60px]">
              PRO, with its hands <em>on the keyboard.</em>
            </Display>
          </motion.div>
          <motion.p {...reveal(0.06)} className="mt-5 max-w-xl text-lg leading-relaxed text-white/60">
            Max Mode turns PRO into a coding agent. The project lives in a workspace on your device, the code runs in a Node runtime inside your browser, and when it&apos;s done it opens the pull request on GitHub.
          </motion.p>
          <motion.figure {...reveal(0.1)} className="tm-panel relative mt-10 overflow-hidden rounded-3xl">
            <img
              src="/landing/screen-maxmode.webp"
              alt="Max Mode in Auto: PRO writing the files for a 3D racing game, with the workspace file tree and editor beside the chat."
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
          <FeatureList
            items={[
              ['Plan', 'Reads and explains. Changes nothing.'],
              ['Edit', 'Reads and writes files. Never runs anything.'],
              ['Auto', 'The full loop: edit, run, preview, fix, repeat.'],
              ['Workspace on your device', 'The project is stored in your browser, one workspace per chat. No upload.'],
              ['Node runtime in the browser', 'npm install, tests and dev servers run in a WebContainer, with a live preview.'],
              ['GitHub', 'Clone a repository, commit to a branch, or open a pull request for review.'],
            ]}
            label="Max Mode"
          />
        </div>
      </section>

      {/* ── Everything else ─────────────────────────────────────── */}
      <section className="relative mx-auto max-w-6xl px-5 pt-20 sm:px-8 lg:pt-28" aria-labelledby="f-all">
        <motion.div {...reveal()}>
          <Display as="h2" id="f-all" className="max-w-2xl text-[2.5rem] leading-[1] sm:text-5xl lg:text-[60px]">
            Already <em>in the chat.</em>
          </Display>
        </motion.div>
        <motion.ul {...reveal(0.08)} className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Features">
          {TILES.map(([name, what, src, hue]) => (
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
      </section>

      {/* ── Notes ────────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-6xl px-5 pt-20 sm:px-8 lg:pt-28" aria-labelledby="f-notes">
        <motion.div {...reveal()}>
          <Display as="h2" id="f-notes" className="max-w-2xl text-[2.5rem] leading-[1] sm:text-5xl lg:text-[60px]">
            Notes that the AI <em>can read.</em>
          </Display>
        </motion.div>
        <motion.p {...reveal(0.06)} className="mt-5 max-w-xl text-lg leading-relaxed text-white/60">
          Headings, checklists, tables, code, quotes and dividers in a block editor on your device. Ask the chat to search or update them and it does, without the notes ever leaving your browser to be stored anywhere else.
        </motion.p>
        <motion.figure {...reveal(0.1)} className="tm-panel mt-10 overflow-hidden rounded-3xl">
          <img
            src="/landing/screen-notes.webp"
            alt="TimeMachine Notes with a Kyoto trip note open: headings, a checklist, a bullet list and a quote, and the Notes composer below."
            width={2848}
            height={1800}
            loading="lazy"
            className="block w-full"
          />
        </motion.figure>
      </section>

      {/* ── Close ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pt-24 sm:px-8 lg:pt-32">
        <motion.div {...reveal()}>
          <Display as="h2" className="max-w-2xl text-5xl leading-[0.98] sm:text-7xl">
            Try it <em>now.</em>
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
