import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  HelpCircle,
  ChevronDown,
  MessageSquare,
  Sparkles,
  Users,
  Image,
  Brain,
  Shield,
  Zap,
  Music,
  Palette,
  Globe
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { Helmet } from 'react-helmet-async';

interface FAQItem {
  question: string;
  answer: string;
  icon: React.ReactNode;
  category: string;
}

const faqs: FAQItem[] = [
  {
    category: 'Getting Started',
    icon: <Zap className="w-5 h-5" />,
    question: 'What is TimeMachine?',
    answer: 'TimeMachine is an AI-powered chat application that offers multiple personas and advanced features. You can have conversations with different AI personalities, generate images, and even enjoy music recommendations.'
  },
  {
    category: 'Getting Started',
    icon: <Users className="w-5 h-5" />,
    question: 'Do I need an account?',
    answer: 'You can try TimeMachine with 3 free messages without an account. To unlock unlimited chats, save your history, and access all features, create a free TimeMachine ID.'
  },
  {
    category: 'Personas',
    icon: <Sparkles className="w-5 h-5" />,
    question: 'What are the different personas?',
    answer: 'TimeMachine offers three main personas: Default (fast everyday intelligence), Girlie (understands the vibe), and PRO (advanced intelligence with emotional understanding). Each has a unique personality and style.'
  },
  {
    category: 'Personas',
    icon: <Globe className="w-5 h-5" />,
    question: 'Can I talk to other AI models?',
    answer: 'Yes! You can mention @chatgpt, @gemini, @claude, or @grok in your message to route it to those AI models. Just type @ followed by the model name at the start of your message.'
  },
  {
    category: 'Features',
    icon: <Image className="w-5 h-5" />,
    question: 'Can TimeMachine generate images?',
    answer: 'Yes! TimeMachine can generate images based on your descriptions. Just ask it to create, draw, or generate an image of something. Your generated images are saved in your Albums.'
  },
  {
    category: 'Features',
    icon: <Brain className="w-5 h-5" />,
    question: 'What are Memories?',
    answer: 'Memories help TimeMachine remember things about you across conversations. You can add facts, preferences, or instructions that the AI will recall in future chats.'
  },
  {
    category: 'Features',
    icon: <Music className="w-5 h-5" />,
    question: 'How does music work?',
    answer: 'TimeMachine can play ambient music that matches the mood of your conversation. The music adapts based on the persona you\'re using and the emotions detected in the chat.'
  },
  {
    category: 'Group Chat',
    icon: <Users className="w-5 h-5" />,
    question: 'What is Group Chat?',
    answer: 'Group Chat lets you invite friends to chat together with TimeMachine. Share a link, and anyone with it can join the conversation. Everyone sees messages in real-time, like WhatsApp but with AI!'
  },
  {
    category: 'Group Chat',
    icon: <MessageSquare className="w-5 h-5" />,
    question: 'How do I start a Group Chat?',
    answer: 'Click the "Group Chat" button in the top right corner while in a chat. This will enable group mode and give you a shareable link to invite others.'
  },
  {
    category: 'Customization',
    icon: <Palette className="w-5 h-5" />,
    question: 'Can I customize the appearance?',
    answer: 'Absolutely! Go to Settings > Themes to choose from various seasonal themes, switch between light/dark/monochrome modes, and set your default preferences.'
  },
  {
    category: 'Privacy',
    icon: <Shield className="w-5 h-5" />,
    question: 'Is my data private?',
    answer: 'Yes! Your conversations are private and only visible to you (and group members in group chats). We don\'t sell your data or use it for advertising. You can delete your history anytime.'
  },
  {
    category: 'Privacy',
    icon: <Shield className="w-5 h-5" />,
    question: 'Can I delete my data?',
    answer: 'Yes. You can delete individual chats from your Chat History, remove specific memories, or delete images from your Albums. For complete account deletion, contact support.'
  }
];

const categories = [...new Set(faqs.map(f => f.category))];

export function HelpPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredFaqs = selectedCategory
    ? faqs.filter(f => f.category === selectedCategory)
    : faqs;

  return (
    <div className={`min-h-screen ${theme.background} ${theme.text} relative overflow-hidden`}>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": faqs.map(faq => ({
            "@type": "Question",
            "name": faq.question,
            "acceptedAnswer": {
              "@type": "Answer",
              "text": faq.answer
            }
          }))
        })}</script>
      </Helmet>
      {/* Ambient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-purple-500/15 rounded-full blur-[100px] animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <motion.button
            whileHover={{ scale: 1.05, x: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="text-sm font-medium">Back</span>
          </motion.button>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20">
              <HelpCircle className="w-5 h-5 text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Help & FAQ</h1>
          </div>

          <div className="w-16" />
        </motion.div>

        {/* Category filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap gap-2 mb-8"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              selectedCategory === null
                ? 'bg-purple-500/30 border-purple-500/50 text-purple-200'
                : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
            } border`}
          >
            All
          </motion.button>
          {categories.map((category) => (
            <motion.button
              key={category}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedCategory === category
                  ? 'bg-purple-500/30 border-purple-500/50 text-purple-200'
                  : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
              } border`}
            >
              {category}
            </motion.button>
          ))}
        </motion.div>

        {/* FAQ list */}
        <div className="space-y-3">
          {filteredFaqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.03 }}
              className="rounded-2xl overflow-hidden"
            >
              <motion.button
                onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl text-left flex items-center gap-4 hover:bg-white/[0.07] transition-all"
              >
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 text-purple-400">
                  {faq.icon}
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">{faq.question}</p>
                  <p className="text-white/40 text-xs mt-1">{faq.category}</p>
                </div>
                <motion.div
                  animate={{ rotate: expandedIndex === index ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="w-5 h-5 text-white/40" />
                </motion.div>
              </motion.button>

              <AnimatePresence>
                {expandedIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 pt-2 -mt-2 bg-white/[0.03] border border-t-0 border-white/10 rounded-b-2xl">
                      <p className="text-white/70 leading-relaxed pl-14">
                        {faq.answer}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        {/* Contact section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-12 p-6 rounded-3xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-white/10 text-center"
        >
          <h2 className="text-lg font-semibold text-white mb-2">Still have questions?</h2>
          <p className="text-white/50 text-sm mb-4">
            We're here to help! Reach out to our support team.
          </p>
          <motion.a
            href="mailto:support@timemachine.ai"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-medium"
          >
            <MessageSquare className="w-4 h-4" />
            Contact Support
          </motion.a>
        </motion.div>
      </div>
    </div>
  );
}
