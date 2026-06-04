import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Zap, Shield, Heart, Sparkles, Globe } from 'lucide-react';

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
};

export function AboutPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative overflow-auto bg-black">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-black to-purple-950/30" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-purple-500/8 rounded-full blur-[150px]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-24">
        {/* Nav */}
        <motion.nav {...fadeUp} className="flex items-center justify-between mb-16">
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
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/features')}
              className="text-sm text-white/40 hover:text-white/70 transition-colors"
            >
              Features
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/contact')}
              className="text-sm text-white/40 hover:text-white/70 transition-colors"
            >
              Contact
            </motion.button>
          </div>
        </motion.nav>

        {/* Hero */}
        <motion.header {...fadeUp} transition={{ delay: 0.1 }} className="text-center mb-20">
          <p className="text-purple-400/70 text-sm font-medium uppercase tracking-widest mb-4">About TimeMachine</p>
          <h1 className="text-5xl sm:text-7xl font-bold text-white mb-6 tracking-tight">
            AI for the betterment<br />
            <span className="bg-gradient-to-r from-purple-400 to-violet-400 bg-clip-text text-transparent">of humanity.</span>
          </h1>
          <p className="text-lg sm:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed">
            TimeMachine is the super app that brings your tech essentials into an intelligent, safe and secured chat interface. We're building the future of how people interact with technology.
          </p>
        </motion.header>

        {/* Values Grid */}
        <motion.section {...fadeUp} transition={{ delay: 0.15 }} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-16">
          <div
            className="rounded-3xl p-8"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <Zap className="w-8 h-8 text-purple-400 mb-5" />
            <h2 className="text-xl font-bold text-white mb-3">Lightning Fast</h2>
            <p className="text-white/45 leading-relaxed">
              The fastest AI response times in the industry. TimeMachine Air delivers supercomputer speed in your pocket — answers in milliseconds, not seconds.
            </p>
          </div>

          <div
            className="rounded-3xl p-8"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <Shield className="w-8 h-8 text-emerald-400 mb-5" />
            <h2 className="text-xl font-bold text-white mb-3">Privacy First</h2>
            <p className="text-white/45 leading-relaxed">
              Your data is only yours. We prioritize safety and privacy over everything. We never sell your data, never train on your conversations, and never compromise your trust.
            </p>
          </div>

          <div
            className="rounded-3xl p-8"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <Heart className="w-8 h-8 text-pink-400 mb-5" />
            <h2 className="text-xl font-bold text-white mb-3">Built with Care</h2>
            <p className="text-white/45 leading-relaxed">
              Every pixel, every interaction, every response is crafted with care. You're the main character of our story. TimeMachine is designed around you, not the other way around.
            </p>
          </div>

          <div
            className="rounded-3xl p-8"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <Globe className="w-8 h-8 text-blue-400 mb-5" />
            <h2 className="text-xl font-bold text-white mb-3">One App, Every AI</h2>
            <p className="text-white/45 leading-relaxed">
              Access ChatGPT, Gemini, Claude, Grok, DeepSeek, and our own TimeMachine personas — all from one interface. No switching between apps. No extra subscriptions.
            </p>
          </div>
        </motion.section>

        {/* Personas Highlight */}
        <motion.section {...fadeUp} transition={{ delay: 0.2 }} className="mb-16">
          <div
            className="rounded-3xl p-8 sm:p-10"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <Sparkles className="w-8 h-8 text-violet-400 mb-5" />
            <h2 className="text-2xl font-bold text-white mb-4">Three Resonators</h2>
            <p className="text-white/45 leading-relaxed mb-6">
              TimeMachine doesn't give you a one-size-fits-all AI. We built three distinct intelligences, each designed for a different side of you:
            </p>
            <div className="space-y-4 mb-6">
              <div className="flex items-start gap-4">
                <div className="w-2 h-2 rounded-full bg-purple-400 mt-2 shrink-0" />
                <p className="text-white/50"><strong className="text-white">TimeMachine Air</strong> — Fastest intelligence in the world for everyday use.</p>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-2 h-2 rounded-full bg-pink-400 mt-2 shrink-0" />
                <p className="text-white/50"><strong className="text-white">TimeMachine Girlie</strong> — The intelligence that gets the vibe check.</p>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-2 h-2 rounded-full bg-cyan-400 mt-2 shrink-0" />
                <p className="text-white/50"><strong className="text-white">TimeMachine PRO</strong> — Our most advanced intelligence with human-like emotions and thinking.</p>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/personas')}
              className="inline-flex items-center gap-2 text-purple-400/70 hover:text-purple-400 text-sm font-medium transition-colors"
            >
              Explore all personas <ArrowRight size={14} />
            </motion.button>
          </div>
        </motion.section>

        {/* Team */}
        <motion.section {...fadeUp} transition={{ delay: 0.25 }} className="mb-16">
          <div
            className="rounded-3xl p-8 sm:p-10"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <h2 className="text-2xl font-bold text-white mb-4">TimeMachine Mafia</h2>
            <p className="text-white/45 leading-relaxed mb-4">
              Founded by Tanzim Ibne Mahboob, TimeMachine Mafia is on a mission to revolutionize how people interact with technology. We believe AI should be accessible, personal, and built with integrity.
            </p>
            <p className="text-white/45 leading-relaxed">
              We're not just building an AI assistant — we're building an intelligent companion that understands you. From the ground up, every decision we make puts the user first: your privacy, your experience, your future.
            </p>
          </div>
        </motion.section>

        {/* CTA */}
        <motion.div {...fadeUp} transition={{ delay: 0.3 }} className="text-center">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/')}
            className="px-8 py-4 rounded-2xl text-white font-semibold text-base"
            style={{
              background: 'linear-gradient(135deg, rgba(168,85,247,0.3) 0%, rgba(139,92,246,0.2) 100%)',
              border: '1px solid rgba(168,85,247,0.25)',
            }}
          >
            Try TimeMachine now
          </motion.button>
          <p className="text-white/20 text-xs mt-4">TimeMachine v1.0</p>
        </motion.div>
      </div>
    </div>
  );
}
