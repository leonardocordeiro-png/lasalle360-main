import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface NotificationPermission {
  granted: boolean;
  denied: boolean;
  default: boolean;
}

export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission>({
    granted: false,
    denied: false,
    default: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    if (!('Notification' in window)) {
      setPermission(prev => ({ ...prev, default: false }));
      setIsLoading(false);
      return;
    }

    const checkPermission = () => {
      const permissionStatus = Notification.permission;
      setPermission({
        granted: permissionStatus === 'granted',
        denied: permissionStatus === 'denied',
        default: permissionStatus === 'default',
      });
      setIsLoading(false);
    };

    checkPermission();

    // Listen for permission changes
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'notifications' }).then((permissionStatus) => {
        permissionStatus.addEventListener('change', checkPermission);
        return () => {
          permissionStatus.removeEventListener('change', checkPermission);
        };
      });
    }
  }, []);

  const requestPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    // Check if we're in a secure context (HTTPS or localhost)
    if (window.isSecureContext === false) {
      console.warn('Notifications require a secure context (HTTPS or localhost)');
      return false;
    }

    try {
      setIsRequesting(true);
      const result = await Notification.requestPermission();
      const granted = result === 'granted';
      
      setPermission({
        granted,
        denied: result === 'denied',
        default: result === 'default',
      });

      if (granted) {
        // Send a welcome notification
        try {
          new Notification('🔔 Notificações Ativadas', {
            body: 'Você receberá alertas sobre novas aprovações pendentes!',
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: 'welcome',
          });
        } catch (notificationError) {
          console.warn('Could not show welcome notification:', notificationError);
        }
      }

      return granted;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    } finally {
      setIsRequesting(false);
    }
  };

  const showNotification = (title: string, options?: NotificationOptions) => {
    if (permission.granted && 'Notification' in window) {
      return new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'approval-notification',
        requireInteraction: true,
        ...options,
      });
    }
    return null;
  };

  return {
    permission,
    isLoading,
    isRequesting,
    requestPermission,
    showNotification,
    isSupported: 'Notification' in window,
  };
}
