
import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface UseAuthReturn {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

export const useAuth = (): UseAuthReturn => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    console.log('🔍 useAuth: Initializing auth hook...');
    
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('🔍 useAuth: Auth state changed:', { event, hasSession: !!session, hasUser: !!session?.user });
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        setInitialized(true);
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('❌ useAuth: Error getting session:', error);
      } else {
        console.log('🔍 useAuth: Initial session check:', { hasSession: !!session, hasUser: !!session?.user });
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      setInitialized(true);
    });

    return () => {
      console.log('🔍 useAuth: Cleaning up auth subscription');
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    console.log('🔍 useAuth: Attempting sign in for:', email);
    setLoading(true);
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('❌ useAuth: Sign in error:', error);
      setLoading(false);
    }

    return { error };
  };

  const signUp = async (email: string, password: string) => {
    console.log('🔍 useAuth: Attempting sign up for:', email);
    setLoading(true);
    
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });

    if (error) {
      console.error('❌ useAuth: Sign up error:', error);
      setLoading(false);
    }

    return { error };
  };

  const signOut = async () => {
    console.log('🔍 useAuth: Signing out...');
    setLoading(true);
    
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('❌ useAuth: Sign out error:', error);
    }
    
    setLoading(false);
  };

  const isAuthenticated = !!user && !!session;

  console.log('🔍 useAuth: Current state:', { 
    hasUser: !!user, 
    hasSession: !!session, 
    loading, 
    initialized, 
    isAuthenticated 
  });

  return {
    user,
    session,
    loading,
    initialized,
    isAuthenticated,
    signIn,
    signUp,
    signOut
  };
};
