import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const [isBlocked, setIsBlocked] = useState<boolean | null>(null);
  const [checkingBlocked, setCheckingBlocked] = useState(true);

  useEffect(() => {
    const checkBlockedStatus = async () => {
      if (!user) {
        setCheckingBlocked(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('is_blocked')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error checking blocked status:', error);
          setIsBlocked(false);
        } else {
          setIsBlocked((data as any)?.is_blocked || false);
        }
      } catch (error) {
        console.error('Error checking blocked status:', error);
        setIsBlocked(false);
      } finally {
        setCheckingBlocked(false);
      }
    };

    checkBlockedStatus();
  }, [user]);

  if (loading || checkingBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Check if email is confirmed
  if (!user.email_confirmed_at) {
    return <Navigate to="/auth" replace />;
  }

  // Check if user is blocked
  if (isBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold mb-4">Acesso Bloqueado</h1>
          <p className="text-muted-foreground mb-6">
            Sua conta foi bloqueada por um administrador. Entre em contato com o suporte para mais informações.
          </p>
          <button
            onClick={() => window.location.href = '/#/auth'}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
          >
            Voltar ao Login
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}