import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resendVerificationEmail: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Web app is hosted at e.g. app.getpeaktrack.com; staging at the CloudFront
// default domain. We send users back to /sign-in after email confirmation.
function emailRedirectUrl(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return `${window.location.origin}/sign-in`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [currentSession, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data: { user: verifiedUser }, error } = await supabase!.auth.getUser();
        if (error || !verifiedUser) {
          await supabase!.auth.signOut();
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuthError = (error: AuthError): never => {
    if (error.message.includes('Email not confirmed')) {
      throw new Error('Please check your email and confirm your account before signing in.');
    }
    if (error.message.includes('Invalid login credentials')) {
      throw new Error('Invalid email or password');
    }
    if (error.status === 400) {
      if (error.message.includes('password')) throw new Error('Invalid password format');
      if (error.message.includes('email')) throw new Error('Invalid email format');
      throw new Error('Invalid credentials. Please check your email and password.');
    }
    if (error.status === 429) {
      throw new Error('Too many attempts. Please try again in a few minutes.');
    }
    if (error.status === 422) {
      throw new Error('Email address is invalid or already taken.');
    }
    throw new Error(`Authentication failed: ${error.message}`);
  };

  const value: AuthContextType = {
    session: currentSession,
    user,
    loading,
    signUp: async (email, password) => {
      if (!supabase) throw new Error('Supabase client not initialized');
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: emailRedirectUrl() },
      });
      if (error) throw handleAuthError(error);
      if (data?.user?.identities?.length === 0) {
        throw new Error('This email is already registered. Please sign in instead.');
      }
    },
    signIn: async (email, password) => {
      if (!supabase) throw new Error('Supabase client not initialized');
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw handleAuthError(error);
      if (!data.session) throw new Error('No session created. Please try again.');
    },
    signOut: async () => {
      if (!supabase) throw new Error('Supabase client not initialized');
      const { error } = await supabase.auth.signOut();
      if (error && error.message !== 'Auth session missing!') throw error;
      setSession(null);
      setUser(null);
    },
    resendVerificationEmail: async (email) => {
      if (!supabase) throw new Error('Supabase client not initialized');
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: emailRedirectUrl() },
      });
      if (error) throw handleAuthError(error);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
