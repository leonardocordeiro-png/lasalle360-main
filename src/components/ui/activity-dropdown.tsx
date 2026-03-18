"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Bell, MessageCircle, Award, Calendar, Tag, CheckSquare, ChevronUp, Package, AlertCircle, CheckCircle, Clock, Loader2, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/hooks/useAuth"
import { formatDistanceToNow, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "@/components/ui/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface Notification {
  id: string
  user_id: string
  message: string
  type: string
  related_id: string | null
  is_read: boolean
  created_at: string
}

export function ActivityDropdown() {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [markingAsRead, setMarkingAsRead] = useState(false)
  const [browserNotificationPermission, setBrowserNotificationPermission] = useState<NotificationPermission>('default')

  const unreadCount = notifications.filter(n => !n.is_read).length

  useEffect(() => {
    if ('Notification' in window) {
      setBrowserNotificationPermission(Notification.permission)
    }
  }, [])

  useEffect(() => {
    if (user) {
      fetchNotifications()
      
      const channel = supabase
        .channel('notifications-channel')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            fetchNotifications()
            
            if (payload.eventType === 'INSERT' && payload.new) {
              const newNotification = payload.new as Notification
              if (!newNotification.is_read) {
                showBrowserNotification(newNotification)
              }
            }
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [user])

  const fetchNotifications = async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('notifications' as any)
        .select('id, user_id, message, type, related_id, is_read, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error
      setNotifications((data as any) || [])
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const markAllAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user || unreadCount === 0) return
    setMarkingAsRead(true)
    try {
      const { error } = await supabase
        .from('notifications' as any)
        .update({ is_read: true } as any)
        .eq('user_id', user.id)
        .eq('is_read', false)

      if (error) throw error
      
      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true }))
      )
      
      toast({ 
        title: "Pronto!", 
        description: "Todas as notificações foram marcadas como lidas." 
      })

    } catch (error) {
      console.error('Error marking all as read:', error)
      toast({ 
        title: "Erro", 
        description: "Não foi possível marcar as notificações como lidas.",
        variant: "destructive"
      })
      await fetchNotifications()
    } finally {
      setMarkingAsRead(false)
    }
  }

  const clearAllNotifications = async () => {
    if (!user) return
    try {
      const { error } = await supabase
        .from('notifications' as any)
        .delete()
        .eq('user_id', user.id)

      if (error) throw error

      setNotifications([])
      toast({ 
        title: "Notificações limpas!", 
        description: "Todas as suas notificações foram removidas." 
      })
    } catch (error) {
      console.error('Error clearing notifications:', error)
      toast({ 
        title: "Erro", 
        description: "Não foi possível limpar as notificações.",
        variant: "destructive"
      })
    }
  }

  const requestNotificationPermission = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission()
      setBrowserNotificationPermission(permission)
      
      if (permission === 'granted') {
        toast({ 
          title: "Notificações ativadas!", 
          description: "Você receberá avisos no navegador." 
        })
      }
    }
  }

  const showBrowserNotification = (notification: Notification) => {
    if ('Notification' in window && Notification.permission === 'granted' && !isOpen) {
      const notif = new window.Notification(getNotificationTitle(notification.type), {
        body: notification.message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: notification.id,
        requireInteraction: false,
        silent: false,
      })

      notif.onclick = () => {
        window.focus()
        setIsOpen(true)
        notif.close()
      }

      setTimeout(() => notif.close(), 5000)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'booking_confirmation':
        return <CheckCircle className="h-4 w-4" />
      case 'loan_overdue':
        return <AlertCircle className="h-4 w-4" />
      case 'loan_returned':
        return <Package className="h-4 w-4" />
      case 'room_booking':
        return <Calendar className="h-4 w-4" />
      default:
        return <MessageCircle className="h-4 w-4" />
    }
  }

  const getNotificationTitle = (type: string) => {
    switch (type) {
      case 'booking_confirmation':
        return 'Agendamento Confirmado'
      case 'loan_overdue':
        return 'Empréstimo Atrasado'
      case 'loan_returned':
        return 'Empréstimo Devolvido'
      case 'room_booking':
        return 'Reserva de Sala'
      default:
        return 'Nova Notificação'
    }
  }

  const getIconBgColor = (type: string, isRead: boolean) => {
    if (isRead) return "bg-neutral-200 dark:bg-neutral-700"
    switch (type) {
      case 'booking_confirmation':
        return "bg-green-100 dark:bg-green-900/30"
      case 'loan_overdue':
        return "bg-red-100 dark:bg-red-900/30"
      case 'loan_returned':
        return "bg-blue-100 dark:bg-blue-900/30"
      case 'room_booking':
        return "bg-purple-100 dark:bg-purple-900/30"
      default:
        return "bg-neutral-200 dark:bg-neutral-700"
    }
  }

  const getIconColor = (type: string, isRead: boolean) => {
    if (isRead) return "text-neutral-500 dark:text-neutral-400"
    switch (type) {
      case 'booking_confirmation':
        return "text-green-600 dark:text-green-400"
      case 'loan_overdue':
        return "text-red-600 dark:text-red-400"
      case 'loan_returned':
        return "text-blue-600 dark:text-blue-400"
      case 'room_booking':
        return "text-purple-600 dark:text-purple-400"
      default:
        return "text-neutral-600 dark:text-neutral-300"
    }
  }

  return (
    <div className="relative">
      <div
        className={cn(
          "w-[calc(100vw-2rem)] sm:w-80 max-w-80 rounded-2xl shadow-2xl overflow-hidden cursor-pointer select-none",
          "bg-white dark:bg-neutral-900",
          "shadow-xl shadow-black/10 dark:shadow-black/50",
          "transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]",
          "fixed sm:absolute right-4 sm:right-0 top-16 sm:top-full sm:mt-2 z-50",
          isOpen ? "rounded-3xl opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-2 pointer-events-none",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-4 p-4" onClick={() => setIsOpen(!isOpen)}>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 dark:bg-primary/20 transition-colors duration-300">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 overflow-hidden">
            <h3 className="text-base font-semibold text-neutral-900 dark:text-white">
              {unreadCount > 0 ? `${unreadCount} Nova(s) Notificação(ões)` : 'Notificações'}
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
              {notifications.length > 0 ? 'Suas atividades recentes' : 'Nenhuma notificação'}
            </p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center">
            <ChevronUp
              className={cn(
                "h-5 w-5 text-neutral-400 transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]",
                "rotate-180",
              )}
            />
          </div>
        </div>

        {/* Actions */}
        {notifications.length > 0 && (
          <div className="px-4 pb-2 flex items-center gap-2">
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={markAllAsRead} 
                disabled={markingAsRead}
                className="h-7 px-2 text-xs text-primary hover:text-primary"
              >
                {markingAsRead ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                Marcar como lidas
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Limpar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                  <AlertDialogTitle>Limpar todas as notificações?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. Todas as suas notificações serão permanentemente excluídas.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={clearAllNotifications} className="bg-destructive hover:bg-destructive/90">
                    Limpar tudo
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {/* Activity List */}
        <div className="max-h-[350px] overflow-y-auto">
          <div className="px-2 pb-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Bell className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>Nenhuma notificação</p>
              </div>
            ) : (
              <div className="space-y-1">
                {notifications.map((notification, index) => (
                  <div
                    key={notification.id}
                    className={cn(
                      "flex items-start gap-3 rounded-xl p-3",
                      "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                      "hover:bg-neutral-100 dark:hover:bg-neutral-800/50",
                      !notification.is_read && "bg-primary/5 dark:bg-primary/10",
                    )}
                    style={{
                      animationDelay: `${index * 75}ms`,
                    }}
                  >
                    <div className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-300",
                      getIconBgColor(notification.type, notification.is_read)
                    )}>
                      <span className={getIconColor(notification.type, notification.is_read)}>
                        {getNotificationIcon(notification.type)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={cn(
                        "text-sm font-semibold",
                        notification.is_read ? "text-neutral-500 dark:text-neutral-400" : "text-neutral-900 dark:text-white"
                      )}>
                        {getNotificationTitle(notification.type)}
                      </h4>
                      <p className={cn(
                        "text-sm truncate",
                        notification.is_read ? "text-neutral-400 dark:text-neutral-500" : "text-neutral-600 dark:text-neutral-300"
                      )}>
                        {notification.message}
                      </p>
                    </div>
                    <span className="text-xs text-neutral-400 dark:text-neutral-500 shrink-0 pt-0.5 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(parseISO(notification.created_at), { addSuffix: false, locale: ptBR })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Browser Notification Permission */}
        {browserNotificationPermission === 'default' && (
          <div className="px-4 pb-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={requestNotificationPermission}
              className="w-full text-xs"
            >
              <Bell className="h-3 w-3 mr-2" />
              Ativar notificações do navegador
            </Button>
          </div>
        )}
      </div>

      {/* Trigger Button */}
      <Button 
        variant="ghost" 
        size="icon" 
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs animate-pulse"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </Button>

      {/* Backdrop to close dropdown */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}