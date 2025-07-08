import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const WARNING_TIME = 5 * 60 * 1000; // 5 minutes before timeout

export const useSessionTimeout = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const timeoutRef = useRef<NodeJS.Timeout>();
  const warningRef = useRef<NodeJS.Timeout>();
  const lastActivityRef = useRef<number>(Date.now());

  const resetTimeout = () => {
    lastActivityRef.current = Date.now();
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    if (warningRef.current) {
      clearTimeout(warningRef.current);
    }

    if (user) {
      // Set warning timeout
      warningRef.current = setTimeout(() => {
        toast({
          title: "Sessão expirando",
          description: "Sua sessão expirará em 5 minutos devido à inatividade.",
          variant: "default",
        });
      }, SESSION_TIMEOUT - WARNING_TIME);

      // Set logout timeout
      timeoutRef.current = setTimeout(() => {
        toast({
          title: "Sessão expirada",
          description: "Você foi desconectado devido à inatividade.",
          variant: "destructive",
        });
        signOut();
      }, SESSION_TIMEOUT);
    }
  };

  useEffect(() => {
    if (!user) return;

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const resetTimeoutHandler = () => {
      resetTimeout();
    };

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, resetTimeoutHandler, true);
    });

    // Initial timeout setup
    resetTimeout();

    return () => {
      // Clean up
      events.forEach(event => {
        document.removeEventListener(event, resetTimeoutHandler, true);
      });
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      if (warningRef.current) {
        clearTimeout(warningRef.current);
      }
    };
  }, [user]);

  return { resetTimeout };
};