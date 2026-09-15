import React from 'react';
import { motion } from 'framer-motion';
import { Display, MarketingShell } from '../landing/MarketingShell';
import { useReveal } from '../landing/marketing';

interface LegalLayoutProps {
  eyebrow: string;
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}

/** Shared chrome for /privacy and /terms so the two pages stay in step. */
export function LegalLayout({ eyebrow, title, lastUpdated, children }: LegalLayoutProps) {
  const { reveal } = useReveal();
  return (
    <MarketingShell hue="52 211 153">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <motion.header {...reveal()} className="mb-12">
          <p className="text-sm font-semibold text-emerald-300">{eyebrow}</p>
          <Display className="mt-2 text-[2.6rem] leading-[1] sm:text-6xl">{title}</Display>
          <p className="mt-4 text-sm text-white/40">Last updated {lastUpdated}</p>
        </motion.header>
        <motion.div {...reveal(0.06)} className="space-y-6">
          {children}
        </motion.div>
      </div>
    </MarketingShell>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="tm-panel rounded-3xl p-6 sm:p-8">
      <h2 className="mb-4 text-xl font-semibold text-white">{heading}</h2>
      <div className="space-y-4 text-[15px] leading-relaxed text-white/55">{children}</div>
    </section>
  );
}

export function LegalList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2 list-disc pl-5 marker:text-purple-400/50">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
