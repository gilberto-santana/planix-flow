
import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    console.log('🔄 useAuth: Starting initialization...');
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log('🔍 useAuth: Getting current session...');
        
        // Get current session first
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ useAuth: Session error:', error);
        } else {
          console.log('✅ useAuth: Current session:', { 
            hasSession: !!currentSession, 
            hasUser: !!currentSession?.user,
            userId: currentSession?.user?.id 
          });
        }

        if (mounted) {
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          setInitialized(true);
          setLoading(false);
        }

        // Set up auth state listener after initial session check
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, newSession) => {
            console.log('🔄 useAuth: Auth state changed:', { 
              event, 
              hasSession: !!newSession,
              hasUser: !!newSession?.user,
              userId: newSession?.user?.id
            });
            
            if (mounted) {
              setSession(newSession);
              setUser(newSession?.user ?? null);
              
              // Only set loading to false if we haven't initialized yet
              if (!initialized) {
                setInitialized(true);
                setLoading(false);
              }
            }
          }
        );

        return () => {
          subscription.unsubscribe();
        };

      } catch (error) {
        console.error('💥 useAuth: Initialization error:', error);
        if (mounted) {
          setLoading(false);
          setInitialized(true);
        }
      }
    };

    const cleanup = initializeAuth();

    return () => {
      mounted = false;
      cleanup.then(cleanupFn => cleanupFn?.());
    };
  }, []);

  const signUp = async (email: string, password: string, displayName?: string) => {
    setLoading(true);
    console.log('📝 useAuth: Starting sign up...', { email, hasDisplayName: !!displayName });
    
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            display_name: displayName
          }
        }
      });

      if (error) {
        console.error('❌ useAuth: Sign up error:', error);
        toast({
          variant: "destructive",
          title: "Erro no cadastro",
          description: error.message
        });
        return { error };
      }

      if (data.user && !data.session) {
        console.log('📧 useAuth: Email confirmation required');
        toast({
          title: "Verifique seu email",
          description: "Um link de confirmação foi enviado para seu email."
        });
      }

      console.log('✅ useAuth: Sign up successful');
      return { data, error: null };
    } catch (error) {
      console.error('💥 useAuth: Sign up exception:', error);
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        variant: "destructive",
        title: "Erro no cadastro",
        description: message
      });
      return { error: { message } };
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    console.log('🔐 useAuth: Starting sign in...', { email });
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('❌ useAuth: Sign in error:', error);
        toast({
          variant: "destructive",
          title: "Erro no login",
          description: error.message
        });
        return { error };
      }

      console.log('✅ useAuth: Sign in successful', { userId: data.user?.id });
      toast({
        title: "Login realizado",
        description: "Bem-vindo ao Planix!"
      });

      return { data, error: null };
    } catch (error) {
      console.error('💥 useAuth: Sign in exception:', error);
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        variant: "destructive",
        title: "Erro no login",
        description: message
      });
      return { error: { message } };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    console.log('🚪 useAuth: Starting sign out...');
    
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('❌ useAuth: Sign out error:', error);
        toast({
          variant: "destructive",
          title: "Erro no logout",
          description: error.message
        });
        return { error };
      }

      console.log('✅ useAuth: Sign out successful');
      toast({
        title: "Logout realizado",
        description: "Até logo!"
      });

      return { error: null };
    } catch (error) {
      console.error('💥 useAuth: Sign out exception:', error);
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        variant: "destructive",
        title: "Erro no logout",
        description: message
      });
      return { error: { message } };
    } finally {
      setLoading(false);
    }
  };

  const verifySession = async () => {
    console.log('🔍 useAuth: Verifying current session...');
    try {
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('❌ useAuth: Session verification error:', error);
        return null;
      }
      
      console.log('✅ useAuth: Session verification result:', { 
        hasSession: !!currentSession,
        hasUser: !!currentSession?.user,
        userId: currentSession?.user?.id
      });
      
      return currentSession;
    } catch (error) {
      console.error('💥 useAuth: Session verification exception:', error);
      return null;
    }
  };

  return {
    user,
    session,
    loading,
    initialized,
    signUp,
    signIn,
    signOut,
    verifySession,
    isAuthenticated: !!user && !!session
  };
};
