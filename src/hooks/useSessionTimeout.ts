import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Configurações
const SESSION_TIMEOUT = 60 * 60 * 1000; // 1 hora em milissegundos
const WARNING_TIME = 5 * 60 * 1000; // 5 minutos antes
const FINAL_WARNING = 1 * 60 * 1000; // 1 minuto antes
const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keypress',
  'scroll',
  'touchstart',
  'click'
];

interface SessionTimeoutOptions {
  timeout?: number;
  warningTime?: number;
  finalWarning?: number;
  onTimeout?: () => void;
}

export function useSessionTimeout(options: SessionTimeoutOptions = {}) {
  const {
    timeout = SESSION_TIMEOUT,
    warningTime = WARNING_TIME,
    finalWarning = FINAL_WARNING,
    onTimeout
  } = options;

  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [timeRemaining, setTimeRemaining] = useState(timeout);
  const [showWarning, setShowWarning] = useState(false);
  const [showFinalWarning, setShowFinalWarning] = useState(false);
  const [isWarningOpen, setIsWarningOpen] = useState(false);
  
  const timeoutRef = useRef<NodeJS.Timeout>();
  const warningTimeoutRef = useRef<NodeJS.Timeout>();
  const finalWarningTimeoutRef = useRef<NodeJS.Timeout>();
  const lastActivityRef = useRef(Date.now());

  // Limpar todos os timeouts
  const clearAllTimeouts = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    if (finalWarningTimeoutRef.current) clearTimeout(finalWarningTimeoutRef.current);
  }, []);

  // Atualizar última atividade
  const updateLastActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Resetar o timer de sessão
  const resetSessionTimeout = useCallback(() => {
    clearAllTimeouts();
    updateLastActivity();
    
    // Resetar estados
    setTimeRemaining(timeout);
    setShowWarning(false);
    setShowFinalWarning(false);
    setIsWarningOpen(false);

    // Configurar timeout principal
    timeoutRef.current = setTimeout(() => {
      handleSessionTimeout();
    }, timeout);

    // Configurar aviso inicial (5 minutos antes)
    warningTimeoutRef.current = setTimeout(() => {
      setShowWarning(true);
      setIsWarningOpen(true);
      
      toast({
        title: "Sessão expirando em breve",
        description: "Sua sessão expirará em 5 minutos. Salve seu trabalho.",
        variant: "default",
        duration: 10000,
      });
    }, timeout - warningTime);

    // Configurar aviso final (1 minuto antes)
    finalWarningTimeoutRef.current = setTimeout(() => {
      setShowFinalWarning(true);
      setShowWarning(false);
      setIsWarningOpen(true);
      
      toast({
        title: "⚠️ Sessão expirando em 1 minuto",
        description: "Sua sessão será encerrada em 1 minuto.",
        variant: "destructive",
        duration: 15000,
      });
    }, timeout - finalWarning);
  }, [timeout, warningTime, finalWarning, toast, clearAllTimeouts, updateLastActivity]);

  // Lidar com timeout da sessão
  const handleSessionTimeout = useCallback(async () => {
    console.log('Session timeout - logging out user');
    
    try {
      // Fazer logout no Supabase
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }

    // Notificar usuário
    toast({
      title: "Sessão Encerrada",
      description: "Sua sessão expirou por inatividade. Por favor, faça login novamente.",
      variant: "default",
      duration: 5000,
    });

    // Redirecionar para login
    navigate('/login');
    
    // Chamar callback personalizado se existir
    if (onTimeout) {
      onTimeout();
    }
  }, [navigate, toast, onTimeout]);

  // Estender sessão manualmente
  const extendSession = useCallback(() => {
    resetSessionTimeout();
    
    toast({
      title: "Sessão Estendida",
      description: "Sua sessão foi estendida por mais 1 hora.",
      variant: "default",
      duration: 3000,
    });
    
    setIsWarningOpen(false);
  }, [resetSessionTimeout, toast]);

  // Verificar inatividade e atualizar contador
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const timeSinceActivity = now - lastActivityRef.current;
      const remaining = Math.max(0, timeout - timeSinceActivity);
      
      setTimeRemaining(remaining);
      
      // Se a atividade parou por mais tempo que o timeout, encerrar sessão
      if (timeSinceActivity >= timeout) {
        clearAllTimeouts();
        handleSessionTimeout();
      }
    }, 1000); // Atualizar a cada segundo

    return () => clearInterval(interval);
  }, [timeout, clearAllTimeouts, handleSessionTimeout]);

  // Monitorar atividade do usuário
  useEffect(() => {
    const handleActivity = () => {
      // Resetar timer apenas se não estivermos no período de aviso
      if (!showWarning && !showFinalWarning) {
        resetSessionTimeout();
      }
    };

    // Adicionar event listeners
    ACTIVITY_EVENTS.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    return () => {
      ACTIVITY_EVENTS.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, [resetSessionTimeout, showWarning, showFinalWarning]);

  // Iniciar timeout quando o hook for montado
  useEffect(() => {
    resetSessionTimeout();

    return () => {
      clearAllTimeouts();
    };
  }, [resetSessionTimeout, clearAllTimeouts]);

  // Formatar tempo restante
  const formatTimeRemaining = useCallback((ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  return {
    timeRemaining,
    formattedTimeRemaining: formatTimeRemaining(timeRemaining),
    showWarning,
    showFinalWarning,
    isWarningOpen,
    extendSession,
    resetSessionTimeout
  };
}
