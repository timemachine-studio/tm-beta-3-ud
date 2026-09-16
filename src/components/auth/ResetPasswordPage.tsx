import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, Check, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { AppAtmosphere } from '../shared/AppAtmosphere';

/* Where the password-reset email link lands. Supabase puts a recovery
   session in the URL hash; the client picks it up on load and fires
   PASSWORD_RECOVERY, at which point the person is signed in just enough to
   set a new password. A link that is expired or already used yields no
   session, and the page says so and offers the code route in the sign-in
   modal instead. The in-app "Forgot password?" flow (a 6-digit code) does
   not come through here at all. */

type Stage = 'checking' | 'ready' | 'expired' | 'done';

const field = {
  background: 'rgb(var(--tm-ink-rgb) / 0.05)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgb(var(--tm-ink-rgb) / 0.1)',
  boxShadow: 'inset 0 1px 0 rgb(var(--tm-edge-rgb) / 0.1)',
} as const;

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();
  const [stage, setStage] = useState<Stage>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let settled = false;
    const ready = () => { settled = true; setStage((s) => (s === 'done' ? s : 'ready')); };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) ready();
    });
    // The hash may already have been consumed before this effect ran.
    void supabase.auth.getSession().then(({ data }) => { if (data.session) ready(); });
    // Nothing after a few seconds means the link did not carry a session.
    const timer = setTimeout(() => { if (!settled) setStage('expired'); }, 4000);
    return () => { subscription.unsubscribe(); clearTimeout(timer); };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setBusy(true);
    const { error: err } = await updatePassword(password);
    setBusy(false);
    if (err) { setError(err.message); return; }
    setStage('done');
    setTimeout(() => navigate('/', { replace: true }), 1200);
  };

  return (
    <div className="tm-chat-shell relative min-h-screen overflow-hidden" style={{ minHeight: 'var(--tm-100vh)' }}>
      <AppAtmosphere />
      <div className="relative flex min-h-screen items-center justify-center p-4" style={{ minHeight: 'var(--tm-100vh)' }}>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="tm-workspace tm-auth tm-glass tm-surface w-full max-w-[440px] rounded-[28px] p-6 sm:p-8"
        >
          <h1 className="tm-display tm-dialog-heading text-white mb-3">
            {stage === 'done' ? 'Password updated' : stage === 'expired' ? 'Link expired' : 'Set a new password'}
          </h1>

          {stage === 'checking' && (
            <p className="text-ink-muted text-sm">Checking your link…</p>
          )}

          {stage === 'expired' && (
            <>
              <p className="text-ink-muted text-sm mb-6">
                This reset link is no longer valid — they work once and expire after a while. Ask for a fresh one from the sign-in screen; you can also use the 6-digit code it emails you.
              </p>
              <button
                type="button"
                onClick={() => navigate('/', { replace: true, state: { openAuth: true } })}
                className="tm-press w-full rounded-full bg-pill px-5 py-3 text-sm font-medium text-pill-ink"
              >
                Back to sign in
              </button>
            </>
          )}

          {stage === 'done' && (
            <p className="flex items-center gap-2 text-sm text-emerald-400">
              <Check size={16} aria-hidden="true" /> You&apos;re signed in with your new password. Taking you to the chat…
            </p>
          )}

          {stage === 'ready' && (
            <form onSubmit={submit} className="space-y-4">
              <p className="text-ink-muted text-sm">Choose a new password for your TimeMachine ID.</p>
              <div className="tm-auth-field relative">
                <div className="tm-auth-field-icon absolute left-4 top-1/2 -translate-y-1/2"><Lock size={18} /></div>
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="New password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className="w-full pl-12 pr-12 py-3.5 rounded-xl text-white placeholder-ink-muted focus:outline-hidden transition-all text-[15px]"
                  style={field}
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="tm-auth-toggle absolute right-4 top-1/2 -translate-y-1/2"
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div className="tm-auth-field relative">
                <div className="tm-auth-field-icon absolute left-4 top-1/2 -translate-y-1/2"><Lock size={18} /></div>
                <input
                  type={show ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl text-white placeholder-ink-muted focus:outline-hidden transition-all text-[15px]"
                  style={field}
                />
              </div>
              {error && (
                <p className="flex items-center gap-2 text-sm text-red-400" role="alert">
                  <AlertCircle size={16} aria-hidden="true" /> {error}
                </p>
              )}
              <button
                type="submit"
                disabled={busy}
                className="tm-press w-full rounded-full bg-pill px-5 py-3 text-sm font-medium text-pill-ink disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Save new password'}
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}
