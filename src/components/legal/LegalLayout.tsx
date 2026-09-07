import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
};

interface LegalLayoutProps {
  eyebrow: string;
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}

/** Shared chrome for /privacy and /terms so the two pages stay in step. */
export function LegalLayout({ eyebrow, title, lastUpdated, children }: LegalLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative overflow-auto bg-black">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-black to-purple-950/30" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-purple-500/8 rounded-full blur-[150px]" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-24">
        <motion.nav {...fadeUp} className="flex items-center justify-between mb-12">
          <motion.button
            whileHover={{ scale: 1.05, x: -3 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-white/50 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="text-sm">Back</span>
          </motion.button>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/privacy')}
              className="text-sm text-white/40 hover:text-white/70 transition-colors"
            >
              Privacy
            </button>
            <button
              onClick={() => navigate('/terms')}
              className="text-sm text-white/40 hover:text-white/70 transition-colors"
            >
              Terms
            </button>
          </div>
        </motion.nav>

        <motion.header {...fadeUp} transition={{ delay: 0.1 }} className="mb-12">
          <p className="text-purple-400/70 text-sm font-medium uppercase tracking-widest mb-4">{eyebrow}</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 tracking-tight">{title}</h1>
          <p className="text-white/35 text-sm">Last updated {lastUpdated}</p>
        </motion.header>

        <motion.div {...fadeUp} transition={{ delay: 0.15 }} className="space-y-8">
          {children}
        </motion.div>
      </div>
    </div>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-3xl p-6 sm:p-8"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <h2 className="text-xl font-bold text-white mb-4">{heading}</h2>
      <div className="space-y-4 text-white/50 leading-relaxed text-[15px]">{children}</div>
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
