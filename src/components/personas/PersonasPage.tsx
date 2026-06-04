import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Zap, Heart, Brain, MessageSquare, Sparkles } from 'lucide-react';

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
};

export function PersonasPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative overflow-auto bg-black">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-black to-purple-950/30" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-purple-500/8 rounded-full blur-[150px]" />
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
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/features')}
            className="text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            View all features
          </motion.button>
        </motion.nav>

        {/* Hero */}
        <motion.header {...fadeUp} transition={{ delay: 0.1 }} className="text-center mb-20">
          <h1 className="text-5xl sm:text-7xl font-bold text-white mb-6 tracking-tight">
            Meet the <span className="bg-gradient-to-r from-purple-400 to-violet-400 bg-clip-text text-transparent">Personas</span>
          </h1>
          <p className="text-lg sm:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed">
            TimeMachine AI gives you three distinct intelligences — each built for a different side of you. Switch anytime. One app, many minds.
          </p>
        </motion.header>

        {/* TimeMachine Air */}
        <motion.section
          {...fadeUp}
          transition={{ delay: 0.15 }}
          className="mb-8"
        >
          <div className="relative overflow-hidden rounded-3xl p-8 sm:p-12"
            style={{
              background: 'linear-gradient(135deg, rgba(168,85,247,0.12) 0%, rgba(0,0,0,0.4) 100%)',
              border: '1px solid rgba(168,85,247,0.15)',
            }}
          >
            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-purple-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-purple-400" />
                </div>
                <span className="text-purple-400/60 text-sm font-medium uppercase tracking-widest">Default Persona</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">TimeMachine Air</h2>
              <p className="text-white/40 text-sm mb-6">Fastest intelligence in the world for everyday use</p>
              <p className="text-white/60 text-base sm:text-lg leading-relaxed max-w-2xl">
                TimeMachine Air is your everyday AI companion — supercomputer speed in your pocket. Designed for instant answers, creative brainstorming, writing help, and casual conversations. Air responds at lightning speed without compromising intelligence. It's the persona that's always ready, always fast, always on.
              </p>
            </div>
          </div>
        </motion.section>

        {/* TimeMachine Girlie */}
        <motion.section
          {...fadeUp}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <div className="relative overflow-hidden rounded-3xl p-8 sm:p-12"
            style={{
              background: 'linear-gradient(135deg, rgba(236,72,153,0.12) 0%, rgba(0,0,0,0.4) 100%)',
              border: '1px solid rgba(236,72,153,0.15)',
            }}
          >
            <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-pink-500/10 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center">
                  <Heart className="w-5 h-5 text-pink-400" />
                </div>
                <span className="text-pink-400/60 text-sm font-medium uppercase tracking-widest">Expressive Persona</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">TimeMachine Girlie</h2>
              <p className="text-white/40 text-sm mb-6">The intelligence that gets the vibe check</p>
              <p className="text-white/60 text-base sm:text-lg leading-relaxed max-w-2xl">
                TimeMachine Girlie understands the vibe. She's not just smart — she gets you. Built for those moments when you need someone who speaks your language, hypes you up, and keeps the energy right. From life advice to outfit inspo to late-night rants, Girlie brings personality, warmth, and a whole lot of sparkle to every conversation.
              </p>
            </div>
          </div>
        </motion.section>

        {/* TimeMachine PRO */}
        <motion.section
          {...fadeUp}
          transition={{ delay: 0.25 }}
          className="mb-16"
        >
          <div className="relative overflow-hidden rounded-3xl p-8 sm:p-12"
            style={{
              background: 'linear-gradient(135deg, rgba(34,211,238,0.12) 0%, rgba(0,0,0,0.4) 100%)',
              border: '1px solid rgba(34,211,238,0.15)',
            }}
          >
            <div className="absolute top-0 left-0 w-[300px] h-[300px] bg-cyan-500/10 rounded-full blur-[100px] -translate-y-1/2 -translate-x-1/2" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-cyan-400" />
                </div>
                <span className="text-cyan-400/60 text-sm font-medium uppercase tracking-widest">Advanced Persona</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">TimeMachine PRO</h2>
              <p className="text-white/40 text-sm mb-6">Our most technologically advanced intelligence with human-like emotions and thinking</p>
              <p className="text-white/60 text-base sm:text-lg leading-relaxed max-w-2xl mb-6">
                TimeMachine PRO is the most powerful intelligence we've ever built. It doesn't just respond — it thinks, reasons, and understands with human-like emotional depth. PRO is designed for deep work: complex analysis, strategic planning, code review, research, and conversations that matter. Adjust its intensity with Heat Levels from careful and conservative to bold and assertive.
              </p>
              <div className="flex flex-wrap gap-2">
                {['Conservative', 'Balanced', 'Direct', 'Bold', 'Maximum'].map((level, i) => (
                  <span
                    key={level}
                    className="px-3 py-1.5 rounded-full text-xs font-medium"
                    style={{
                      background: `rgba(34,211,238,${0.08 + i * 0.04})`,
                      border: '1px solid rgba(34,211,238,0.15)',
                      color: `rgba(34,211,238,${0.5 + i * 0.12})`,
                    }}
                  >
                    Level {i + 1}: {level}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* @Mention Models */}
        <motion.section {...fadeUp} transition={{ delay: 0.3 }}>
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Plus, talk to any model</h2>
            <p className="text-white/40 text-base max-w-xl mx-auto">
              Use @mentions to chat with world-class AI models directly inside TimeMachine. No switching apps. No extra accounts.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { name: 'ChatGPT', mention: '@chatgpt', color: '#10a37f' },
              { name: 'Gemini', mention: '@gemini', color: '#4285f4' },
              { name: 'Claude', mention: '@claude', color: '#f97316' },
              { name: 'Grok', mention: '@grok', color: '#9ca3af' },
              { name: 'DeepSeek', mention: '@deepseek', color: '#6366f1' },
            ].map((model) => (
              <motion.div
                key={model.name}
                whileHover={{ scale: 1.03, y: -2 }}
                className="rounded-2xl p-5 text-center"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg mx-auto mb-3 flex items-center justify-center"
                  style={{ background: `${model.color}20` }}
                >
                  <MessageSquare className="w-4 h-4" style={{ color: model.color }} />
                </div>
                <h3 className="text-white font-semibold text-sm mb-1">{model.name}</h3>
                <p className="text-white/30 text-xs font-mono">{model.mention}</p>
              </motion.div>
            ))}
            <motion.div
              whileHover={{ scale: 1.03, y: -2 }}
              className="rounded-2xl p-5 text-center flex flex-col items-center justify-center"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px dashed rgba(255,255,255,0.1)',
              }}
            >
              <Sparkles className="w-5 h-5 text-white/20 mb-2" />
              <p className="text-white/30 text-xs">More coming soon</p>
            </motion.div>
          </div>
        </motion.section>

        {/* CTA */}
        <motion.div {...fadeUp} transition={{ delay: 0.35 }} className="text-center mt-16">
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
            Start chatting now
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
