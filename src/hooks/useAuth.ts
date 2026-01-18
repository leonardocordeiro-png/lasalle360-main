import { useState, useEffect, createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<{ error: any }>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useAuthProvider() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Enforce domain restriction after OAuth to avoid Google 403
        if (event === 'SIGNED_IN') {
          const email = session?.user?.email || '';
          if (email && !email.endsWith('@lasalle.org.br')) {
            await supabase.auth.signOut();
            toast({
              variant: "destructive",
              title: "Domínio de e-mail não permitido",
              description: "Apenas e-mails @lasalle.org.br podem acessar.",
            });
          }
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Also enforce for restored sessions (edge case)
      const email = session?.user?.email || '';
      if (email && !email.endsWith('@lasalle.org.br')) {
        await supabase.auth.signOut();
        toast({
          variant: "destructive",
          title: "Domínio de e-mail não permitido",
          description: "Apenas e-mails @lasalle.org.br podem acessar.",
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      // Check if email is from @lasalle.org.br domain
      if (!email.endsWith('@lasalle.org.br')) {
        return {
          error: {
            message: 'Apenas e-mails @lasalle.org.br são permitidos'
          }
        };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        let errorMessage = error.message;
        
        // Handle specific error cases
        if (error.message.includes('Email not confirmed')) {
          errorMessage = 'Você precisa confirmar seu e-mail antes de fazer login. Verifique sua caixa de entrada.';
        } else if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Email ou senha incorretos.';
        }
        
        toast({
          variant: "destructive",
          title: "Erro no login",
          description: errorMessage,
        });
      } else {
        // Check if email is confirmed
        if (data.user && !data.user.email_confirmed_at) {
          await supabase.auth.signOut();
          toast({
            variant: "destructive",
            title: "Email não confirmado",
            description: "Você precisa confirmar seu e-mail antes de acessar o sistema. Verifique sua caixa de entrada.",
          });
          return {
            error: {
              message: 'Email não confirmado'
            }
          };
        }
        
        toast({
          title: "Login realizado com sucesso!",
          description: "Bem-vindo ao sistema de agendamento de Chromebooks.",
        });
      }
      
      return { error };
    } catch (error: any) {
      return { error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      // Check if email is from @lasalle.org.br domain
      if (!email.endsWith('@lasalle.org.br')) {
        return {
          error: {
            message: 'Apenas e-mails @lasalle.org.br são permitidos'
          }
        };
      }

      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
            name: fullName,
          }
        }
      });
      
      if (error) {
        toast({
          variant: "destructive",
          title: "Erro no cadastro",
          description: error.message,
        });
      } else {
        toast({
          title: "Cadastro realizado!",
          description: "Um e-mail de confirmação foi enviado para você. Você precisa confirmar seu e-mail antes de fazer login no sistema.",
        });
      }
      
      return { error };
    } catch (error: any) {
      return { error };
    }
  };

  const signOut = async () => {
    try {
      // Attempt global sign out (invalidates refresh tokens)
      await supabase.auth.signOut({ scope: 'global' });
    } catch (_) {
      // ignore
    } finally {
      // Hard clear any persisted auth tokens just in case
      try {
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith('sb-') || key.startsWith('supabase.')) {
            localStorage.removeItem(key);
          }
        }
        for (const key of Object.keys(sessionStorage)) {
          if (key.startsWith('sb-') || key.startsWith('supabase.')) {
            sessionStorage.removeItem(key);
          }
        }
      } catch (_) {}

      // Hard redirect to auth page to reset all state
      window.location.replace('/#/auth');
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Mantemos o redirect de volta ao app; validação de domínio ocorrerá após retorno
          redirectTo: `${window.location.origin}/`,
        }
      });
      
      if (error) {
        toast({
          variant: "destructive",
          title: "Erro no login com Google",
          description: error.message,
        });
      }
      
      return { error };
    } catch (error: any) {
      return { error };
    }
  };

  return {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    signInWithGoogle,
  };
}