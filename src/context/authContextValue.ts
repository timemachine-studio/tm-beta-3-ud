import { createContext, useContext } from 'react';
import type { User, Session, AuthError } from '@supabase/supabase-js';
import type { Profile } from '../types/database';
export interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  /**
   * True only until the session is known. Auth is progressive enhancement:
   * nothing but genuinely user-specific UI should gate on this, and nothing
   * at all should gate on the profile (production-check.md 1.14).
   */
  loading: boolean;
  /** The slow half — gates avatar/nickname UI, never the app shell. */
  profileLoading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  updateLastPersona: (persona: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  isOnboarded: boolean;
  needsOnboarding: boolean;
  // OTP and password functions
  signUpWithOtp: (email: string) => Promise<{ error: AuthError | null }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: AuthError | null }>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: AuthError | null }>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<{ error: Error | null }>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
