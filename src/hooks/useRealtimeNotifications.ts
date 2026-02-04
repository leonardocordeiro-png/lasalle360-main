import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNotificationPermission } from './useNotificationPermission';

export function useRealtimeNotifications() {
  const { showNotification, permission } = useNotificationPermission();
  const [lastNotification, setLastNotification] = useState<string | null>(null);

  useEffect(() => {
    if (!permission.granted) return;

    // Listen for new approval notifications
    const channel = supabase
      .channel('approval-notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'approval_notifications' as any,
          filter: 'is_read=eq.false'
        },
        async (payload) => {
          const { new: notification } = payload;
          
          // Get current user
          const { data: { user } } = await supabase.auth.getUser();
          
          // Only show notification if it's for the current user
          if (user && notification.approver_id === user.id) {
            const notificationTitle = '🔔 Nova Aprovação Pendente';
            const notificationBody = `${notification.requester_name} solicitou reserva do ${notification.room_name} para ${notification.time_slots}`;
            
            const notificationObj = showNotification(notificationTitle, {
              body: notificationBody,
              data: {
                bookingId: notification.booking_id,
                approverId: notification.approver_id,
              },
            });

            if (notificationObj) {
              // Handle notification click
              notificationObj.onclick = () => {
                // Focus on the window/tab
                window.focus();
                
                // Navigate to approvals tab
                const approvalsTab = document.querySelector('[data-value="approvals"]') as HTMLElement;
                if (approvalsTab) {
                  approvalsTab.click();
                }
                
                // Close the notification
                notificationObj.close();
              };

              // Auto-close after 10 seconds
              setTimeout(() => {
                notificationObj.close();
              }, 10000);
            }

            setLastNotification(notification.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [permission.granted, showNotification]);

  return {
    lastNotification,
    isSupported: permission.granted,
  };
}
