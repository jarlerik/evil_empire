import { createContext, useContext, useState, useEffect } from 'react';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Platform } from 'react-native';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resendVerificationEmail: (email: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) return;

    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session check:', session);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for changes on auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Set initial loading state for SSR
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      setLoading(false);
    }
  }, []);

  const handleAuthError = (error: AuthError): never => {
    console.error('Auth error details:', {
      status: error.status,
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    
    if (error.message.includes('Email not confirmed')) {
      throw new Error('Please check your email and confirm your account before signing in.');
    }

    if (error.message.includes('Invalid login credentials')) {
      throw new Error('Invalid email or password');
    }
    
    if (error.status === 400) {
      if (error.message.includes('password')) {
        throw new Error('Invalid password format');
      }
      if (error.message.includes('email')) {
        throw new Error('Invalid email format');
      }
      console.error('400 error details:', error);
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

  const value = {
    session,
    user,
    loading,
    signUp: async (email: string, password: string) => {
      if (!supabase) throw new Error('Supabase client not initialized');
      try {
        console.log('Attempting sign up for:', email);
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: 'evil-empire://sign-in',
          },
        });
        console.log('Sign up response:', { data, error });
        if (error) throw handleAuthError(error);
        if (data?.user?.identities?.length === 0) {
          throw new Error('This email is already registered. Please sign in instead.');
        }
      } catch (error) {
        if (error instanceof Error) throw error;
        throw new Error('An unexpected error occurred during sign up');
      }
    },
    signIn: async (email: string, password: string) => {
      if (!supabase) throw new Error('Supabase client not initialized');
      try {
        console.log('Attempting sign in for:', email);
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        console.log('Sign in response:', { data, error });
        if (error) throw handleAuthError(error);
        if (!data.session) {
          throw new Error('No session created. Please try again.');
        }
      } catch (error) {
        console.error('Sign in error:', error);
        if (error instanceof Error) throw error;
        throw new Error('An unexpected error occurred during sign in');
      }
    },
    signOut: async () => {
      if (!supabase) throw new Error('Supabase client not initialized');
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
    resendVerificationEmail: async (email: string) => {
      if (!supabase) throw new Error('Supabase client not initialized');
      try {
        const { error } = await supabase.auth.resend({
          type: 'signup',
          email,
          options: {
            emailRedirectTo: 'evil-empire://sign-in',
          },
        });
        if (error) throw handleAuthError(error);
      } catch (error) {
        if (error instanceof Error) throw error;
        throw new Error('Failed to resend verification email');
      }
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