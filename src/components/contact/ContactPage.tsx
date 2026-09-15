import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Mail } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Display, Glow, MarketingShell } from '../landing/MarketingShell';
import { useReveal } from '../landing/marketing';

const field = 'tm-glass tm-glass-pill w-full rounded-2xl px-4 py-3 text-[15px] text-white placeholder:text-white/35 outline-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

export function ContactPage() {
  const { reveal } = useReveal();
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: insertError } = await supabase
        .from('contact_messages')
        .insert({
          name: formData.name.trim(),
          email: formData.email.trim(),
          message: formData.message.trim(),
        });
      if (insertError) throw insertError;
      setSubmitted(true);
      setTimeout(() => {
        setFormData({ name: '', email: '', message: '' });
        setSubmitted(false);
      }, 3000);
    } catch (err) {
      console.error('Error submitting contact form:', err);
      setError('The message did not send. Check your connection and try again, or email us directly.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MarketingShell hue="168 85 247">
      <section className="mx-auto grid max-w-6xl gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <div>
          <motion.div {...reveal()}>
            <Display className="max-w-xl text-[2.9rem] leading-[1] sm:text-6xl lg:text-[72px]">
              Say <em>hello.</em>
            </Display>
          </motion.div>
          <motion.p {...reveal(0.06)} className="mt-6 max-w-md text-lg leading-relaxed text-white/60 sm:text-xl">
            Questions, feedback, a bug, a collaboration, or just a hi. A person reads every message.
          </motion.p>
          <motion.a
            {...reveal(0.1)}
            href="mailto:hello@timemachine.ai"
            className="tm-glass tm-glass-pill mt-8 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm text-white/85 transition-colors hover:text-white"
          >
            <Mail className="h-4 w-4" aria-hidden="true" /> hello@timemachine.ai
          </motion.a>
          <motion.div {...reveal(0.14)} className="tm-panel relative mt-10 hidden max-w-sm overflow-hidden rounded-3xl lg:block">
            <Glow hue="168 85 247" className="left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2" alpha={0.14} />
            <img src="/landing/icon-contact.webp" alt="" width={512} height={512} aria-hidden="true" className="tm-art relative block w-full" />
          </motion.div>
        </div>

        <motion.form {...reveal(0.08)} onSubmit={handleSubmit} className="tm-panel relative rounded-3xl p-6 sm:p-8" aria-label="Contact form">
          <Glow hue="168 85 247" className="right-[-20%] top-[-20%] h-[50vmax] w-[50vmax]" alpha={0.06} />
          <div className="relative flex flex-col gap-5">
            <div>
              <label htmlFor="contact-name" className="mb-2 block text-sm text-white/60">Name</label>
              <input
                id="contact-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Your name"
                required
                autoComplete="name"
                className={field}
              />
            </div>
            <div>
              <label htmlFor="contact-email" className="mb-2 block text-sm text-white/60">Email</label>
              <input
                id="contact-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className={field}
              />
            </div>
            <div>
              <label htmlFor="contact-message" className="mb-2 block text-sm text-white/60">Message</label>
              <textarea
                id="contact-message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="What's on your mind?"
                required
                rows={6}
                className={`${field} resize-y`}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-red-300">{error}</p>
            )}
            <button
              type="submit"
              disabled={submitted || loading}
              className="tm-press inline-flex items-center justify-center gap-2 self-start rounded-full bg-pill px-6 py-3 text-base font-medium text-pill-ink hover:opacity-90 disabled:opacity-60"
            >
              {loading ? 'Sending…' : submitted ? (<><Check className="h-4 w-4" aria-hidden="true" /> Sent</>) : (<>Send message <ArrowRight className="h-4 w-4" aria-hidden="true" /></>)}
            </button>
          </div>
        </motion.form>
      </section>
    </MarketingShell>
  );
}
