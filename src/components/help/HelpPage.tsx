import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { ArrowRight, Plus } from 'lucide-react';
import { Arrow, Display, Glow, MarketingShell } from '../landing/MarketingShell';
import { useEnterApp, useReveal } from '../landing/marketing';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const faqs: FAQItem[] = [
  {
    category: 'Getting Started',
    question: 'What is TimeMachine?',
    answer: 'TimeMachine is an AI-powered chat application that offers multiple personas and advanced features. You can have conversations with different AI personalities, generate images, and even enjoy music recommendations.'
  },
  {
    category: 'Getting Started',
    question: 'Do I need an account?',
    answer: 'You can try TimeMachine with 3 free messages without an account. To unlock unlimited chats, save your history, and access all features, create a free TimeMachine ID.'
  },
  {
    category: 'Personas',
    question: 'What are the different personas?',
    answer: 'TimeMachine offers three main personas: Default (fast everyday intelligence), Girlie (understands the vibe), and PRO (advanced intelligence with emotional understanding). Each has a unique personality and style.'
  },
  {
    category: 'Personas',
    question: 'How do I switch persona mid-conversation?',
    answer: 'Start your message with @girlie or @pro to route that single message to another TimeMachine persona, without changing the persona for the rest of the chat.'
  },
  {
    category: 'Features',
    question: 'Can TimeMachine generate images?',
    answer: 'Yes! TimeMachine can generate images based on your descriptions. Just ask it to create, draw, or generate an image of something. Your generated images are saved in your Albums.'
  },
  {
    category: 'Features',
    question: 'What are Memories?',
    answer: 'Memories help TimeMachine remember things about you across conversations. You can add facts, preferences, or instructions that the AI will recall in future chats.'
  },
  {
    category: 'Features',
    question: 'How does music work?',
    answer: 'TimeMachine can play ambient music that matches the mood of your conversation. The music adapts based on the persona you\'re using and the emotions detected in the chat.'
  },
  {
    category: 'Group Chat',
    question: 'What is Group Chat?',
    answer: 'Group Chat lets you invite friends to chat together with TimeMachine. Share a link, and anyone with it can join the conversation. Everyone sees messages in real-time, like WhatsApp but with AI!'
  },
  {
    category: 'Group Chat',
    question: 'How do I start a Group Chat?',
    answer: 'Click the "Group Chat" button in the top right corner while in a chat. This will enable group mode and give you a shareable link to invite others.'
  },
  {
    category: 'Customization',
    question: 'Can I customize the appearance?',
    answer: 'Absolutely! Go to Settings > Themes to choose from various seasonal themes, switch between light/dark/monochrome modes, and set your default preferences.'
  },
  {
    category: 'Privacy',
    question: 'Is my data private?',
    answer: 'Your chat history is only visible to you (and to group members in group chats). To generate a reply, each message is sent to one of the AI providers named in our Privacy Policy — we don\'t run our own models. We don\'t sell your data or use it for advertising, and you can delete your history anytime.'
  },
  {
    category: 'Privacy',
    question: 'Can I delete my data?',
    answer: 'Yes. You can delete individual chats from your Chat History, remove specific memories, or delete images from your Albums. For complete account deletion, contact support.'
  }
];

const categories = [...new Set(faqs.map((f) => f.category))];

export function HelpPage() {
  const navigate = useNavigate();
  const { reveal } = useReveal();
  const { startChatting } = useEnterApp();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);

  const shown = category ? faqs.filter((f) => f.category === category) : faqs;

  return (
    <MarketingShell hue="96 165 250">
      <Helmet>
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqs.map((faq) => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: { '@type': 'Answer', text: faq.answer },
          })),
        })}</script>
      </Helmet>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <motion.div {...reveal()}>
            <Display className="max-w-3xl text-[2.9rem] leading-[1] sm:text-6xl lg:text-[76px]">
              How can we <em>help?</em>
            </Display>
          </motion.div>
          <motion.p {...reveal(0.06)} className="mt-6 max-w-xl text-lg leading-relaxed text-white/60 sm:text-xl">
            The questions people ask most, answered plainly. If yours isn&apos;t here, write to us — a person reads every message.
          </motion.p>
          <motion.div {...reveal(0.1)} className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Filter by topic">
            <button
              type="button"
              aria-pressed={category === null}
              onClick={() => setCategory(null)}
              className={`tm-press rounded-full px-3.5 py-1.5 text-sm ${category === null ? 'bg-pill text-pill-ink' : 'tm-glass tm-glass-pill text-white/75 hover:text-white'}`}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
                className={`tm-press rounded-full px-3.5 py-1.5 text-sm ${category === c ? 'bg-pill text-pill-ink' : 'tm-glass tm-glass-pill text-white/75 hover:text-white'}`}
              >
                {c}
              </button>
            ))}
          </motion.div>
        </div>
        <motion.div {...reveal(0.08)} className="tm-panel relative hidden overflow-hidden rounded-3xl lg:block">
          <Glow hue="96 165 250" className="left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2" alpha={0.14} />
          <img src="/landing/icon-help.webp" alt="" width={512} height={512} aria-hidden="true" className="tm-art relative block w-full" />
        </motion.div>
      </section>

      {/* ── Questions ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pt-14 sm:px-8 lg:pt-20" aria-label="Frequently asked questions">
        <ul className="grid gap-3 lg:grid-cols-2">
          {shown.map((faq) => {
            const isOpen = expanded === faq.question;
            return (
              <li key={faq.question} className="tm-glass tm-glass-pill self-start rounded-2xl">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : faq.question)}
                  aria-expanded={isOpen}
                  className="tm-press flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
                >
                  <span>
                    <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-white/35">{faq.category}</span>
                    <span className="mt-1 block text-[15px] font-medium text-white/90">{faq.question}</span>
                  </span>
                  <Plus className={`mt-1 h-4 w-4 shrink-0 text-white/45 transition-transform duration-200 ${isOpen ? 'rotate-45' : ''}`} aria-hidden="true" />
                </button>
                <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}>
                  <p className="overflow-hidden text-sm leading-relaxed text-white/60">
                    <span className="block px-5 pb-5">{faq.answer}</span>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── Still stuck ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pt-20 sm:px-8 lg:pt-28">
        <motion.div {...reveal()} className="tm-panel relative grid overflow-hidden rounded-3xl lg:grid-cols-[1fr_auto]">
          <Glow hue="168 85 247" className="left-[-10%] top-1/2 h-[50vmax] w-[50vmax] -translate-y-1/2" alpha={0.08} />
          <div className="relative p-7 sm:p-10">
            <Display as="h2" className="text-4xl leading-[1] sm:text-5xl">
              Still <em>stuck?</em>
            </Display>
            <p className="mt-4 max-w-md text-[17px] leading-relaxed text-white/65">Tell us what happened and where. We answer from a real inbox.</p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button onClick={() => navigate('/contact')} className="tm-press inline-flex items-center gap-2 rounded-full bg-pill px-5 py-2.5 text-sm font-medium text-pill-ink hover:opacity-90">
                Contact us <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <button onClick={startChatting} className="group inline-flex items-center gap-1.5 px-2 text-sm text-white/70 transition-colors hover:text-white">
                Or just ask the chat <Arrow />
              </button>
            </div>
          </div>
          <div className="relative hidden w-[280px] items-center justify-center p-6 lg:flex">
            <img src="/landing/icon-contact.webp" alt="" width={512} height={512} aria-hidden="true" className="tm-art block w-full" />
          </div>
        </motion.div>
      </section>
    </MarketingShell>
  );
}
