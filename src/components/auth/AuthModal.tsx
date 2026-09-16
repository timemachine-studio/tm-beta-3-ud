import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Lock, Eye, EyeOff, ArrowLeft, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
  message?: string;
}

type AuthStep = 'credentials' | 'otp-verify' | 'forgot-password-email' | 'forgot-password-otp' | 'forgot-password-new';

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'signup',
  message,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [step, setStep] = useState<AuthStep>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const { signIn, signUp, signUpWithOtp, verifyOtp, updatePassword } = useAuth();

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) setMode(initialMode); });
    return () => { cancelled = true; };
  }, [initialMode]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setError('');
      setSuccess('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setOtpCode('');
      setStep('credentials');
    });
    return () => { cancelled = true; };
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (step === 'credentials') {
          // Validate passwords match
          if (password !== confirmPassword) {
            setError('Passwords do not match');
            setLoading(false);
            return;
          }
          if (password.length < 8) {
            setError('Password must be at least 8 characters');
            setLoading(false);
            return;
          }

          // Step 1: Create account with email/password, then send OTP for verification
          const { error: signUpError } = await signUp(email, password);
          if (signUpError) {
            // If user already exists, try sending OTP for verification
            if (signUpError.message.includes('already registered')) {
              setError('This email is already registered. Please sign in instead.');
            } else {
              setError(signUpError.message);
            }
          } else {
            // Account created, Supabase sends the verification email automatically
            setSuccess('Verification code sent to your email!');
            setStep('otp-verify');
          }
        } else if (step === 'otp-verify') {
          // Step 2: Verify OTP to confirm email
          const { error: verifyError } = await verifyOtp(email, otpCode);
          if (verifyError) {
            setError(verifyError.message);
          } else {
            setSuccess('Email verified! Welcome to TimeMachine!');
            setTimeout(() => onClose(), 1000);
          }
        }
      } else {
        // Sign in mode
        if (step === 'credentials') {
          // Regular sign in
          const { error } = await signIn(email, password);
          if (error) {
            setError(error.message);
          } else {
            onClose();
          }
        } else if (step === 'forgot-password-email') {
          // Send OTP for password reset
          const { error } = await signUpWithOtp(email);
          if (error) {
            setError(error.message);
          } else {
            setSuccess('Verification code sent to your email!');
            setStep('forgot-password-otp');
          }
        } else if (step === 'forgot-password-otp') {
          // Verify OTP for password reset
          const { error } = await verifyOtp(email, otpCode);
          if (error) {
            setError(error.message);
          } else {
            setSuccess('Code verified! Set your new password.');
            setStep('forgot-password-new');
          }
        } else if (step === 'forgot-password-new') {
          // Set new password
          if (newPassword !== confirmNewPassword) {
            setError('Passwords do not match');
            setLoading(false);
            return;
          }
          if (newPassword.length < 8) {
            setError('Password must be at least 8 characters');
            setLoading(false);
            return;
          }
          const { error } = await updatePassword(newPassword);
          if (error) {
            setError(error.message);
          } else {
            setSuccess('Password updated successfully!');
            setTimeout(() => {
              setStep('credentials');
              setPassword('');
              setNewPassword('');
              setConfirmNewPassword('');
              setOtpCode('');
            }, 1500);
          }
        }
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setError('');
    setSuccess('');
    if (step === 'otp-verify') {
      setStep('credentials');
      setOtpCode('');
    } else if (step === 'forgot-password-email' || step === 'forgot-password-otp' || step === 'forgot-password-new') {
      setStep('credentials');
      setOtpCode('');
      setNewPassword('');
      setConfirmNewPassword('');
    }
  };

  const handleForgotPassword = () => {
    setError('');
    setSuccess('');
    setStep('forgot-password-email');
  };

  const renderTitle = () => {
    if (step === 'otp-verify') return 'Verify Your Email';
    if (step === 'forgot-password-email') return 'Reset Password';
    if (step === 'forgot-password-otp') return 'Enter Verification Code';
    if (step === 'forgot-password-new') return 'Set New Password';
    return mode === 'signup' ? 'Create a TimeMachine ID' : 'Sign in';
  };

  const renderSubtitle = () => {
    if (step === 'otp-verify') return `Enter the 6-digit code sent to ${email}`;
    if (step === 'forgot-password-email') return 'Enter your email to receive a verification code';
    if (step === 'forgot-password-otp') return `Enter the 6-digit code sent to ${email}`;
    if (step === 'forgot-password-new') return 'Create a new password for your account';
    return message || (mode === 'signup'
      ? 'Unified ID for everything at TimeMachine Mafia'
      : 'Welcome back to TimeMachine');
  };

  const renderButtonText = () => {
    if (loading) return null;
    if (step === 'otp-verify') return 'Verify Code';
    if (step === 'forgot-password-email') return 'Send OTP';
    if (step === 'forgot-password-otp') return 'Verify Code';
    if (step === 'forgot-password-new') return 'Update Password';
    if (mode === 'signup') return 'Continue';
    return 'Sign In';
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AnimatePresence>
        {isOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="tm-modal-scrim fixed inset-0 z-50"
              />
            </Dialog.Overlay>

            <Dialog.Content asChild aria-describedby={undefined}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
              >
                <div
                  className="tm-workspace tm-auth tm-glass tm-surface tm-dialog-card relative w-full max-w-[440px] rounded-[28px]"
                >
                  {/* Content */}
                  <div className="p-6 pt-12 sm:p-8 sm:pt-12">
                    {/* Close button */}
                    <Dialog.Close asChild>
                      <button aria-label="Close sign in" className="absolute top-3 right-3 p-3 rounded-full hover:bg-white/10 transition-colors">
                        <X size={20} className="text-ink-muted" />
                      </button>
                    </Dialog.Close>

                    {/* Back button for sub-steps */}
                    {step !== 'credentials' && (
                      <button
                        onClick={handleBack}
                        className="absolute top-4 left-4 p-2 rounded-full hover:bg-white/10 transition-colors"
                      >
                        <ArrowLeft size={20} className="text-ink-muted" />
                      </button>
                    )}

                    {/* Header */}
                    <div className="text-center mb-8">
                      <Dialog.Title className="tm-display tm-dialog-heading text-white mb-3">
                        {renderTitle()}
                      </Dialog.Title>
                      <p className="text-ink-muted text-sm">
                        {renderSubtitle()}
                      </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                      {/* OTP Input (for verification steps) */}
                      {(step === 'otp-verify' || step === 'forgot-password-otp') && (
                        <div className="tm-auth-field relative">
                          <div className="tm-auth-field-icon absolute left-4 top-1/2 -translate-y-1/2">
                            <KeyRound size={18} />
                          </div>
                          <input
                            type="text"
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="Enter 6-digit code"
                            required
                            maxLength={6}
                            className="w-full pl-12 pr-4 py-3.5 rounded-xl text-white placeholder-ink-muted focus:outline-hidden transition-all text-[15px] text-center tracking-[0.5em] font-mono"
                            style={{
                              background: 'rgb(var(--tm-ink-rgb) / 0.05)',
                              backdropFilter: 'blur(20px)',
                              WebkitBackdropFilter: 'blur(20px)',
                              border: '1px solid rgb(var(--tm-ink-rgb) / 0.1)',
                              boxShadow: 'inset 0 1px 0 rgb(var(--tm-edge-rgb) / 0.1)'
                            }}
                          />
                        </div>
                      )}

                      {/* Email Input */}
                      {(step === 'credentials' || step === 'forgot-password-email') && (
                        <div className="tm-auth-field relative">
                          <div className="tm-auth-field-icon absolute left-4 top-1/2 -translate-y-1/2">
                            <Mail size={18} />
                          </div>
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Email"
                            required
                            className="w-full pl-12 pr-4 py-3.5 rounded-xl text-white placeholder-ink-muted focus:outline-hidden transition-all text-[15px]"
                            style={{
                              background: 'rgb(var(--tm-ink-rgb) / 0.05)',
                              backdropFilter: 'blur(20px)',
                              WebkitBackdropFilter: 'blur(20px)',
                              border: '1px solid rgb(var(--tm-ink-rgb) / 0.1)',
                              boxShadow: 'inset 0 1px 0 rgb(var(--tm-edge-rgb) / 0.1)'
                            }}
                          />
                        </div>
                      )}

                      {/* Password Input (Sign In and Sign Up) */}
                      {step === 'credentials' && (
                        <div className="tm-auth-field relative">
                          <div className="tm-auth-field-icon absolute left-4 top-1/2 -translate-y-1/2">
                            <Lock size={18} />
                          </div>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Password"
                            required
                            className="w-full pl-12 pr-12 py-3.5 rounded-xl text-white placeholder-ink-muted focus:outline-hidden transition-all text-[15px]"
                            style={{
                              background: 'rgb(var(--tm-ink-rgb) / 0.05)',
                              backdropFilter: 'blur(20px)',
                              WebkitBackdropFilter: 'blur(20px)',
                              border: '1px solid rgb(var(--tm-ink-rgb) / 0.1)',
                              boxShadow: 'inset 0 1px 0 rgb(var(--tm-edge-rgb) / 0.1)'
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="tm-auth-toggle absolute right-4 top-1/2 -translate-y-1/2"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      )}

                      {/* Confirm Password (Sign Up only) */}
                      {step === 'credentials' && mode === 'signup' && (
                        <div className="tm-auth-field relative">
                          <div className="tm-auth-field-icon absolute left-4 top-1/2 -translate-y-1/2">
                            <Lock size={18} />
                          </div>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm password"
                            required
                            className="w-full pl-12 pr-4 py-3.5 rounded-xl text-white placeholder-ink-muted focus:outline-hidden transition-all text-[15px]"
                            style={{
                              background: 'rgb(var(--tm-ink-rgb) / 0.05)',
                              backdropFilter: 'blur(20px)',
                              WebkitBackdropFilter: 'blur(20px)',
                              border: '1px solid rgb(var(--tm-ink-rgb) / 0.1)',
                              boxShadow: 'inset 0 1px 0 rgb(var(--tm-edge-rgb) / 0.1)'
                            }}
                          />
                        </div>
                      )}

                      {/* New Password Fields (for forgot password flow) */}
                      {step === 'forgot-password-new' && (
                        <>
                        <div className="tm-auth-field relative">
                          <div className="tm-auth-field-icon absolute left-4 top-1/2 -translate-y-1/2">
                              <Lock size={18} />
                            </div>
                            <input
                              type={showPassword ? 'text' : 'password'}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="New password"
                              required
                              className="w-full pl-12 pr-12 py-3.5 rounded-xl text-white placeholder-ink-muted focus:outline-hidden transition-all text-[15px]"
                              style={{
                                background: 'rgb(var(--tm-ink-rgb) / 0.05)',
                                backdropFilter: 'blur(20px)',
                                WebkitBackdropFilter: 'blur(20px)',
                                border: '1px solid rgb(var(--tm-ink-rgb) / 0.1)',
                                boxShadow: 'inset 0 1px 0 rgb(var(--tm-edge-rgb) / 0.1)'
                              }}
                            />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="tm-auth-toggle absolute right-4 top-1/2 -translate-y-1/2"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                          </div>
                        <div className="tm-auth-field relative">
                          <div className="tm-auth-field-icon absolute left-4 top-1/2 -translate-y-1/2">
                              <Lock size={18} />
                            </div>
                            <input
                              type={showPassword ? 'text' : 'password'}
                              value={confirmNewPassword}
                              onChange={(e) => setConfirmNewPassword(e.target.value)}
                              placeholder="Confirm new password"
                              required
                              className="w-full pl-12 pr-4 py-3.5 rounded-xl text-white placeholder-ink-muted focus:outline-hidden transition-all text-[15px]"
                              style={{
                                background: 'rgb(var(--tm-ink-rgb) / 0.05)',
                                backdropFilter: 'blur(20px)',
                                WebkitBackdropFilter: 'blur(20px)',
                                border: '1px solid rgb(var(--tm-ink-rgb) / 0.1)',
                                boxShadow: 'inset 0 1px 0 rgb(var(--tm-edge-rgb) / 0.1)'
                              }}
                            />
                          </div>
                        </>
                      )}

                      {/* Forgot Password Link */}
                      {step === 'credentials' && mode === 'signin' && (
                        <div className="text-right">
                          <button
                            type="button"
                            onClick={handleForgotPassword}
                            className="text-ink-muted hover:text-ink text-sm transition-colors"
                          >
                            Forgot password?
                          </button>
                        </div>
                      )}

                      {/* Error/Success Messages */}
                      <AnimatePresence mode="wait">
                        {error && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                          >
                            {error}
                          </motion.div>
                        )}
                        {success && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm"
                          >
                            {success}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Submit Button */}
                      <motion.button
                        type="submit"
                        disabled={loading}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        className="tm-press w-full min-h-12 py-3.5 rounded-full bg-pill text-pill-ink font-medium disabled:opacity-50 disabled:cursor-not-allowed text-base"
                      >
                        {loading ? (
                          <div className="w-5 h-5 border-2 border-white/20 border-t-white/70 rounded-full animate-spin mx-auto" />
                        ) : (
                          renderButtonText()
                        )}
                      </motion.button>

                      {/* Resend OTP option */}
                      {(step === 'otp-verify' || step === 'forgot-password-otp') && (
                        <p className="text-center text-ink-muted text-sm">
                          Didn't receive the code?{' '}
                          <button
                            type="button"
                            onClick={async () => {
                              setLoading(true);
                              setError('');
                              const { error } = await signUpWithOtp(email);
                              if (error) {
                                setError(error.message);
                              } else {
                                setSuccess('New code sent!');
                              }
                              setLoading(false);
                            }}
                            disabled={loading}
                            className="text-ink hover:text-white font-medium transition-colors"
                          >
                            Resend
                          </button>
                        </p>
                      )}
                    </form>

                    {/* Toggle Mode - Only show on credentials step */}
                    {step === 'credentials' && (
                      <p className="text-center text-ink-muted text-sm mt-6">
                        {mode === 'signup' ? (
                          <>
                            Already have a TimeMachine ID?{' '}
                            <button
                              type="button"
                              onClick={() => setMode('signin')}
                              className="text-ink hover:text-white font-medium transition-colors"
                            >
                              Sign in
                            </button>
                          </>
                        ) : (
                          <>
                            Don't have a TimeMachine ID?{' '}
                            <button
                              type="button"
                              onClick={() => setMode('signup')}
                              className="text-ink hover:text-white font-medium transition-colors"
                            >
                              Create one
                            </button>
                          </>
                        )}
                      </p>
                    )}

                    {/* Legal notice — required on the signup form (production-check.md 0.8) */}
                    {step === 'credentials' && mode === 'signup' && (
                      <p className="text-center text-ink-muted text-xs mt-4 leading-relaxed">
                        By creating an account you agree to our{' '}
                        <a
                          href="/terms"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-ink-muted hover:text-ink underline underline-offset-2 transition-colors"
                        >
                          Terms of Service
                        </a>{' '}
                        and{' '}
                        <a
                          href="/privacy"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-ink-muted hover:text-ink underline underline-offset-2 transition-colors"
                        >
                          Privacy Policy
                        </a>
                        .
                      </p>
                    )}

                    {step === 'credentials' && mode === 'signup' && (
                      <p className="text-center text-ink-muted text-xs mt-2 leading-relaxed">
                        Signed-in chat history is currently stored in the cloud. Messages and attachments are sent to AI providers to generate replies.
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
};

export default AuthModal;
