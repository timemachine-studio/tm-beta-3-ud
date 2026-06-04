import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Terminal,
  Users,
  HeartPulse,
  Image,
  Music,
  BrainCircuit,
  Mic,
  Palette,
  Wrench,
  Globe,
  Sparkles,
} from 'lucide-react';

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
};

const glassCard = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.06)',
};

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: string;
  delay: number;
}

function FeatureCard({ icon, title, description, accent, delay }: FeatureCardProps) {
  return (
    <motion.article
      {...fadeUp}
      transition={{ delay }}
      whileHover={{ y: -4, scale: 1.01 }}
      className="rounded-3xl p-6 sm:p-8 h-full"
      style={glassCard}
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: `${accent}15` }}
      >
        {icon}
      </div>
      <h3 className="text-lg sm:text-xl font-bold text-white mb-3">{title}</h3>
      <p className="text-white/45 text-sm sm:text-base leading-relaxed">{description}</p>
    </motion.article>
  );
}

export function FeaturesPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative overflow-auto bg-black">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-black to-violet-950/20" />
        <div className="absolute top-[60%] left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-violet-500/6 rounded-full blur-[150px]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-8 pb-24">
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
            onClick={() => navigate('/about')}
            className="text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            About us
          </motion.button>
        </motion.nav>

        {/* Hero */}
        <motion.header {...fadeUp} transition={{ delay: 0.1 }} className="text-center mb-20">
          <h1 className="text-5xl sm:text-7xl font-bold text-white mb-6 tracking-tight">
            Everything you need.<br />
            <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">One chat.</span>
          </h1>
          <p className="text-lg sm:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed">
            TimeMachine is more than a chat app. It's an intelligent platform packed with tools, AI models, and features that replace a dozen apps on your phone.
          </p>
        </motion.header>

        {/* Main Features Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <FeatureCard
            icon={<Terminal className="w-6 h-6 text-emerald-400" />}
            title="TimeMachine Contour"
            description="A powerful command palette with 30+ built-in tools. Calculator, unit converter, JSON formatter, hash generator, regex tester, translator, timer, and more — all accessible by typing / in chat. No extra apps needed."
            accent="#34d399"
            delay={0.15}
          />
          <FeatureCard
            icon={<Users className="w-6 h-6 text-blue-400" />}
            title="Group Chat"
            description="Invite friends into a shared AI conversation. Chat together in real-time with the same AI persona. Share links, react to messages, and collaborate on anything from homework to trip planning."
            accent="#60a5fa"
            delay={0.2}
          />
          <FeatureCard
            icon={<HeartPulse className="w-6 h-6 text-red-400" />}
            title="TM Healthcare"
            description="A dedicated health and wellness assistant built into TimeMachine. Get thoughtful guidance on health topics, wellness tips, and general medical information in a safe, private environment."
            accent="#f87171"
            delay={0.25}
          />
          <FeatureCard
            icon={<Image className="w-6 h-6 text-amber-400" />}
            title="Image Generation"
            description="Describe any image and TimeMachine brings it to life. Generated images are automatically saved to your personal album. Create art, visualize ideas, or generate content — all inside chat."
            accent="#fbbf24"
            delay={0.3}
          />
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-16">
          <FeatureCard
            icon={<Music className="w-6 h-6 text-pink-400" />}
            title="Music Streaming"
            description="Mood-responsive music that adapts to your conversation. Built-in YouTube player with persona-based ambient soundscapes."
            accent="#f472b6"
            delay={0.35}
          />
          <FeatureCard
            icon={<BrainCircuit className="w-6 h-6 text-violet-400" />}
            title="Memory System"
            description="TimeMachine remembers your preferences, facts, and instructions across conversations. It learns who you are and gets better over time."
            accent="#8b5cf6"
            delay={0.4}
          />
          <FeatureCard
            icon={<Mic className="w-6 h-6 text-orange-400" />}
            title="Voice Input"
            description="Talk instead of type. Record voice messages with real-time waveform visualization and let TimeMachine understand your audio."
            accent="#fb923c"
            delay={0.45}
          />
        </section>

        {/* More features */}
        <motion.section {...fadeUp} transition={{ delay: 0.5 }} className="mb-16">
          <div className="rounded-3xl p-8 sm:p-10" style={glassCard}>
            <h2 className="text-xl font-bold text-white mb-6">And so much more</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              {[
                { icon: <Palette className="w-4 h-4 text-purple-400" />, text: 'Seasonal themes, dark mode, light mode, monochrome' },
                { icon: <Globe className="w-4 h-4 text-blue-400" />, text: 'Access ChatGPT, Gemini, Claude, Grok with @mentions' },
                { icon: <Wrench className="w-4 h-4 text-emerald-400" />, text: 'Web coding mode for developers' },
                { icon: <Sparkles className="w-4 h-4 text-amber-400" />, text: 'Music composition and creative writing' },
                { icon: <Image className="w-4 h-4 text-pink-400" />, text: 'Personal album for all generated and uploaded images' },
                { icon: <BrainCircuit className="w-4 h-4 text-violet-400" />, text: 'Chat history with full session restore' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 py-2">
                  <div className="mt-0.5">{item.icon}</div>
                  <p className="text-white/50 text-sm">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Personas Preview */}
        <motion.section {...fadeUp} transition={{ delay: 0.55 }}>
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Three intelligences. Your choice.</h2>
            <p className="text-white/40 max-w-lg mx-auto">
              TimeMachine AI personas are built for different sides of you. Explore them all.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {[
              { name: 'TimeMachine Air', tag: 'Everyday speed', color: '#a855f7' },
              { name: 'TimeMachine Girlie', tag: 'Gets the vibe', color: '#ec4899' },
              { name: 'TimeMachine PRO', tag: 'Deep intelligence', color: '#22d3ee' },
            ].map((persona) => (
              <div
                key={persona.name}
                className="rounded-2xl p-6 text-center"
                style={{
                  background: `linear-gradient(135deg, ${persona.color}10 0%, rgba(0,0,0,0.3) 100%)`,
                  border: `1px solid ${persona.color}18`,
                }}
              >
                <h3 className="text-white font-bold mb-1">{persona.name}</h3>
                <p className="text-white/35 text-sm">{persona.tag}</p>
              </div>
            ))}
          </div>
          <div className="text-center">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/personas')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white/70 hover:text-white text-sm font-medium transition-colors"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              Explore all personas
              <ArrowRight size={16} />
            </motion.button>
          </div>
        </motion.section>

        {/* CTA */}
        <motion.div {...fadeUp} transition={{ delay: 0.6 }} className="text-center mt-16">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/')}
            className="px-8 py-4 rounded-2xl text-white font-semibold text-base"
            style={{
              background: 'linear-gradient(135deg, rgba(139,92,246,0.3) 0%, rgba(124,58,237,0.2) 100%)',
              border: '1px solid rgba(139,92,246,0.25)',
            }}
          >
            Try TimeMachine now
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
