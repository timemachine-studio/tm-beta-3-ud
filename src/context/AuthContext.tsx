import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/database';
import { syncProfileToMemory } from '../services/memory/memoryService';

interface AuthContextType {
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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

// Eight seconds of blank screen was never the right answer. If the profile is
// slow the app renders without it (1.14).
const AUTH_INIT_TIMEOUT_MS = 3000;

/**
 * Supabase already persists the session in localStorage. Reading it
 * synchronously on mount means we know optimistically whether someone is
 * signed in with no network round trip at all, so the signed-in shell renders
 * on the first frame and reconciles when getSession() confirms.
 *
 * Display only. Nothing is authorised on the strength of this — every request
 * still goes through supabase.auth.getSession(), which validates and refreshes.
 */
function readCachedUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!parsed?.user?.id) continue;
      // An expired token is not a signed-in user. Without this check a stale
      // entry paints the signed-in shell for someone who has no session.
      const expiresAt = Number(parsed.expires_at);
      if (Number.isFinite(expiresAt) && expiresAt * 1000 <= Date.now()) continue;
      return parsed.user as User;
    }
  } catch {
    // A corrupt or unreadable cache just means we wait for getSession().
  }
  return null;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const cachedUser = useRef<User | null>(readCachedUser()).current;
  const [user, setUser] = useState<User | null>(cachedUser);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  // Resolved the moment we have a cached session to render from; getSession()
  // reconciles in the background.
  const [loading, setLoading] = useState(!cachedUser);
  const [profileLoading, setProfileLoading] = useState(Boolean(cachedUser));

  // Check if user needs onboarding (has profile but no nickname)
  const needsOnboarding = !!user && !!profile && !profile.nickname;
  const isOnboarded = !!user && !!profile && !!profile.nickname;

  // Fetch or create user profile
  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      // First try to get existing profile
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle(); // Use maybeSingle instead of single to avoid error when no rows

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }

      // If profile exists, return it
      if (data) {
        return data;
      }

      // Profile doesn't exist, create one
      console.log('Creating new profile for user:', userId);
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({ id: userId })
        .select()
        .single();

      if (createError) {
        console.error('Error creating profile:', createError);
        // Return a minimal profile object so the app can continue
        return {
          id: userId,
          nickname: null,
          about_me: null,
          avatar_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as Profile;
      }

      return newProfile;
    } catch (error) {
      console.error('Error in fetchProfile:', error);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      const newProfile = await fetchProfile(user.id);
      setProfile(newProfile);
    }
  }, [user, fetchProfile]);

  // Track initialization state with ref (survives re-renders and closures)
  const initializingRef = useRef(false);
  const initializedRef = useRef(false);
  const currentUserIdRef = useRef<string | null>(null);

  // Initialize auth state - only runs once
  useEffect(() => {
    // Prevent double initialization (React StrictMode or fast refresh)
    if (initializingRef.current || initializedRef.current) {
      return;
    }
    initializingRef.current = true;

    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Get initial session
        const { data: { session: initialSession } } = await withTimeout(
          supabase.auth.getSession(),
          AUTH_INIT_TIMEOUT_MS,
          'Supabase auth session'
        );

        if (!mounted) return;

        if (initialSession?.user) {
          currentUserIdRef.current = initialSession.user.id;
          setSession(initialSession);
          setUser(initialSession.user);
        } else if (cachedUser) {
          // The optimistic guess was wrong (signed out elsewhere, expired
          // refresh token). Reconcile rather than leaving a phantom user.
          setUser(null);
        }

        // The session is settled: release the app *before* fetching the
        // profile, which is a second round trip nothing structural needs.
        if (mounted) setLoading(false);

        if (initialSession?.user) {
          try {
            const userProfile = await withTimeout(
              fetchProfile(initialSession.user.id),
              AUTH_INIT_TIMEOUT_MS,
              'Supabase profile fetch'
            );
            if (mounted) setProfile(userProfile);
          } catch (profileError) {
            // A slow or failed profile fetch degrades the nickname and avatar,
            // never the app.
            console.error('Profile fetch failed:', profileError);
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        // getSession() timed out or threw, so the optimistic user was never
        // confirmed. Fail closed to the signed-out shell rather than leaving a
        // phantom signed-in state whose every write will 401.
        if (mounted && cachedUser) {
          setUser(null);
          setSession(null);
        }
      } finally {
        if (mounted) {
          initializedRef.current = true;
          initializingRef.current = false;
          setLoading(false);
          setProfileLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes - only handle actual sign in/out, not initial session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('Auth state changed:', event);

        if (!mounted) return;

        // Skip events during initialization or for initial session setup
        // initializeAuth handles the initial load via getSession()
        if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
          return;
        }

        // Only handle actual auth changes after initialization is complete
        if (!initializedRef.current) {
          return;
        }

        // Handle sign out
        if (event === 'SIGNED_OUT') {
          currentUserIdRef.current = null;
          setSession(null);
          setUser(null);
          setProfile(null);
          setProfileLoading(false);
          return;
        }

        // Handle sign in - but skip if same user already logged in
        // (This happens on tab switch when Supabase re-validates the session)
        if (event === 'SIGNED_IN' && newSession?.user) {
          // Skip if this is just a session refresh for the same user
          if (currentUserIdRef.current === newSession.user.id) {
            // Just update session silently without loading state
            setSession(newSession);
            return;
          }

          // New user signing in. The session is already known here, so only
          // profile-dependent UI waits — the app itself never does (1.14).
          currentUserIdRef.current = newSession.user.id;
          setSession(newSession);
          setUser(newSession.user);
          setProfileLoading(true);

          try {
            const userProfile = await withTimeout(
              fetchProfile(newSession.user.id),
              AUTH_INIT_TIMEOUT_MS,
              'Supabase profile fetch'
            );
            if (mounted) {
              setProfile(userProfile);
            }
          } catch (error) {
            console.error('Error fetching profile on sign in:', error);
          } finally {
            if (mounted) {
              setProfileLoading(false);
            }
          }
        }
      }
    );

    return () => {
      mounted = false;
      initializingRef.current = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, cachedUser]);

  // Sign up with email
  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    return { error };
  };

  // Sign in with email
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  // Sign up with OTP (sends verification code to email)
  const signUpWithOtp = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });
    return { error };
  };

  // Verify OTP code
  const verifyOtp = async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
    return { error };
  };

  // Reset password (sends reset link to email)
  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  // Update password (for logged in users or after reset)
  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    return { error };
  };

  // Change password (with old password verification)
  const changePassword = async (oldPassword: string, newPassword: string) => {
    if (!user?.email) {
      return { error: new Error('No user logged in') };
    }

    // First verify the old password by signing in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: oldPassword,
    });

    if (signInError) {
      return { error: new Error('Current password is incorrect') };
    }

    // Then update to the new password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      return { error: new Error(updateError.message) };
    }

    return { error: null };
  };

  // Sign out
  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  // Update profile
  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) {
      return { error: new Error('No user logged in') };
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        return { error: new Error(error.message) };
      }

      // Refresh profile after update
      await refreshProfile();

      // Sync profile to AI memories (nickname, about_me)
      if (updates.nickname || updates.about_me) {
        syncProfileToMemory(user.id, {
          nickname: updates.nickname,
          about_me: updates.about_me
        });
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  // Update last used persona (lightweight update, no profile refresh needed)
  const updateLastPersona = async (persona: string) => {
    if (!user) return;

    try {
      await supabase
        .from('profiles')
        .update({
          last_persona: persona,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      // Update local profile state without full refresh
      setProfile(prev => prev ? { ...prev, last_persona: persona } : prev);
    } catch (error) {
      console.error('Failed to update last persona:', error);
    }
  };

  const value: AuthContextType = {
    user,
    session,
    profile,
    loading,
    profileLoading,
    signUp,
    signIn,
    signOut,
    updateProfile,
    updateLastPersona,
    refreshProfile,
    isOnboarded,
    needsOnboarding,
    // OTP and password functions
    signUpWithOtp,
    verifyOtp,
    resetPassword,
    updatePassword,
    changePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
