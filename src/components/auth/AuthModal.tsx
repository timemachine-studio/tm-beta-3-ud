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
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (isOpen) {
      setError('');
      setSuccess('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setOtpCode('');
      setStep('credentials');
    }
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
          if (password.length < 6) {
            setError('Password must be at least 6 characters');
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
          if (newPassword.length < 6) {
            setError('Password must be at least 6 characters');
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
    } catch (err) {
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
                className="fixed inset-0 bg-black/80 backdrop-blur-md z-50"
              />
            </Dialog.Overlay>

            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
              >
                <div
                  className="relative w-full max-w-[420px] overflow-hidden rounded-3xl"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                  }}
                >
                  {/* Content */}
                  <div className="p-8">
                    {/* Close button */}
                    <Dialog.Close asChild>
                      <button className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors">
                        <X size={20} className="text-white/50" />
                      </button>
                    </Dialog.Close>

                    {/* Back button for sub-steps */}
                    {step !== 'credentials' && (
                      <button
                        onClick={handleBack}
                        className="absolute top-4 left-4 p-2 rounded-full hover:bg-white/10 transition-colors"
                      >
                        <ArrowLeft size={20} className="text-white/50" />
                      </button>
                    )}

                    {/* Header */}
                    <div className="text-center mb-8">
                      <h2 className="text-2xl font-semibold text-white mb-2">
                        {renderTitle()}
                      </h2>
                      <p className="text-white/50 text-sm">
                        {renderSubtitle()}
                      </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                      {/* OTP Input (for verification steps) */}
                      {(step === 'otp-verify' || step === 'forgot-password-otp') && (
                        <div className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
                            <KeyRound size={18} />
                          </div>
                          <input
                            type="text"
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="Enter 6-digit code"
                            required
                            maxLength={6}
                            className="w-full pl-12 pr-4 py-3.5 rounded-xl text-white placeholder-white/30 focus:outline-none transition-all text-[15px] text-center tracking-[0.5em] font-mono"
                            style={{
                              background: 'rgba(255, 255, 255, 0.05)',
                              backdropFilter: 'blur(20px)',
                              WebkitBackdropFilter: 'blur(20px)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                            }}
                          />
                        </div>
                      )}

                      {/* Email Input */}
                      {(step === 'credentials' || step === 'forgot-password-email') && (
                        <div className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
                            <Mail size={18} />
                          </div>
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Email"
                            required
                            className="w-full pl-12 pr-4 py-3.5 rounded-xl text-white placeholder-white/30 focus:outline-none transition-all text-[15px]"
                            style={{
                              background: 'rgba(255, 255, 255, 0.05)',
                              backdropFilter: 'blur(20px)',
                              WebkitBackdropFilter: 'blur(20px)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                            }}
                          />
                        </div>
                      )}

                      {/* Password Input (Sign In and Sign Up) */}
                      {step === 'credentials' && (
                        <div className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
                            <Lock size={18} />
                          </div>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Password"
                            required
                            className="w-full pl-12 pr-12 py-3.5 rounded-xl text-white placeholder-white/30 focus:outline-none transition-all text-[15px]"
                            style={{
                              background: 'rgba(255, 255, 255, 0.05)',
                              backdropFilter: 'blur(20px)',
                              WebkitBackdropFilter: 'blur(20px)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/50 transition-colors"
                          >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      )}

                      {/* Confirm Password (Sign Up only) */}
                      {step === 'credentials' && mode === 'signup' && (
                        <div className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
                            <Lock size={18} />
                          </div>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm password"
                            required
                            className="w-full pl-12 pr-4 py-3.5 rounded-xl text-white placeholder-white/30 focus:outline-none transition-all text-[15px]"
                            style={{
                              background: 'rgba(255, 255, 255, 0.05)',
                              backdropFilter: 'blur(20px)',
                              WebkitBackdropFilter: 'blur(20px)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                            }}
                          />
                        </div>
                      )}

                      {/* New Password Fields (for forgot password flow) */}
                      {step === 'forgot-password-new' && (
                        <>
                          <div className="relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
                              <Lock size={18} />
                            </div>
                            <input
                              type={showPassword ? 'text' : 'password'}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="New password"
                              required
                              className="w-full pl-12 pr-12 py-3.5 rounded-xl text-white placeholder-white/30 focus:outline-none transition-all text-[15px]"
                              style={{
                                background: 'rgba(255, 255, 255, 0.05)',
                                backdropFilter: 'blur(20px)',
                                WebkitBackdropFilter: 'blur(20px)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/50 transition-colors"
                            >
                              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                          </div>
                          <div className="relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
                              <Lock size={18} />
                            </div>
                            <input
                              type={showPassword ? 'text' : 'password'}
                              value={confirmNewPassword}
                              onChange={(e) => setConfirmNewPassword(e.target.value)}
                              placeholder="Confirm new password"
                              required
                              className="w-full pl-12 pr-4 py-3.5 rounded-xl text-white placeholder-white/30 focus:outline-none transition-all text-[15px]"
                              style={{
                                background: 'rgba(255, 255, 255, 0.05)',
                                backdropFilter: 'blur(20px)',
                                WebkitBackdropFilter: 'blur(20px)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)'
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
                            className="text-white/50 hover:text-white/70 text-sm transition-colors"
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
                        className="w-full py-3.5 rounded-xl text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed text-[15px]"
                        style={{
                          background: 'rgba(168, 85, 247, 0.3)',
                          backdropFilter: 'blur(20px)',
                          WebkitBackdropFilter: 'blur(20px)',
                          border: '1px solid rgba(168, 85, 247, 0.5)',
                          boxShadow: '0 4px 12px rgba(168, 85, 247, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                        }}
                      >
                        {loading ? (
                          <div className="w-5 h-5 border-2 border-white/20 border-t-white/70 rounded-full animate-spin mx-auto" />
                        ) : (
                          renderButtonText()
                        )}
                      </motion.button>

                      {/* Resend OTP option */}
                      {(step === 'otp-verify' || step === 'forgot-password-otp') && (
                        <p className="text-center text-white/40 text-sm">
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
                            className="text-white/70 hover:text-white font-medium transition-colors"
                          >
                            Resend
                          </button>
                        </p>
                      )}
                    </form>

                    {/* Toggle Mode - Only show on credentials step */}
                    {step === 'credentials' && (
                      <p className="text-center text-white/40 text-sm mt-6">
                        {mode === 'signup' ? (
                          <>
                            Already have a TimeMachine ID?{' '}
                            <button
                              type="button"
                              onClick={() => setMode('signin')}
                              className="text-white/70 hover:text-white font-medium transition-colors"
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
                              className="text-white/70 hover:text-white font-medium transition-colors"
                            >
                              Create one
                            </button>
                          </>
                        )}
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
