import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  User, 
  Calendar, 
  School,
  Loader2,
  Volume2,
  Monitor,
  Projector,
  Droplets,
  Sparkles,
  PresentationIcon,
  MessageSquare,
  AlertTriangle
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PendingBooking {
  id: string;
  user_id: string;
  full_name: string;
  class_name: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  resources: string[];
  observations: string | null;
  approval_deadline: string;
  created_at: string;
}

interface GroupedBooking {
  userId: string;
  fullName: string;
  className: string;
  bookingDate: string;
  observations: string | null;
  resources: string[];
  approvalDeadline: string;
  bookings: PendingBooking[];
  timeRange: string;
}

const RESOURCE_INFO: Record<string, { label: string; icon: typeof Volume2 }> = {
  'som': { label: 'Som', icon: Volume2 },
  'computador': { label: 'Computador', icon: Monitor },
  'projetor': { label: 'Projetor', icon: Projector },
  'agua': { label: 'Água', icon: Droplets },
  'limpeza': { label: 'Limpeza', icon: Sparkles },
  'quadro_branco': { label: 'Quadro Branco', icon: PresentationIcon },
};

export function PendingApprovalsTab() {
  const [pendingBookings, setPendingBookings] = useState<GroupedBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isApprover, setIsApprover] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: 'approve' | 'reject';
    booking: GroupedBooking | null;
  }>({ open: false, action: 'approve', booking: null });
  const [rejectReason, setRejectReason] = useState('');

  const checkApproverStatus = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('room_booking_approvers')
      .select('is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    return !error && data?.is_active === true;
  }, []);

  const markNotificationsAsRead = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('approval_notifications')
      .update({ is_read: true })
      .eq('approver_id', user.id)
      .eq('is_read', false);
  }, []);

  const fetchPendingBookings = useCallback(async () => {
    try {
      setLoading(true);

      const isUserApprover = await checkApproverStatus();
      setIsApprover(isUserApprover);

      if (!isUserApprover) {
        setPendingBookings([]);
        return;
      }

      // Mark notifications as read when viewing
      markNotificationsAsRead();

      const { data, error } = await supabase
        .from('room_bookings')
        .select('*')
        .eq('room_type', 'auditorio')
        .eq('approval_status', 'pending')
        .eq('status', 'active')
        .order('booking_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;

      // Group bookings by user, date, and class
      const grouped: Record<string, GroupedBooking> = {};
      
      (data || []).forEach((booking: any) => {
        const key = `${booking.user_id}-${booking.booking_date}-${booking.class_name}`;
        
        if (!grouped[key]) {
          grouped[key] = {
            userId: booking.user_id,
            fullName: booking.full_name,
            className: booking.class_name,
            bookingDate: booking.booking_date,
            observations: booking.observations,
            resources: booking.resources || [],
            approvalDeadline: booking.approval_deadline,
            bookings: [],
            timeRange: '',
          };
        }
        
        grouped[key].bookings.push(booking);
      });

      // Calculate time ranges
      Object.values(grouped).forEach(group => {
        group.bookings.sort((a, b) => a.start_time.localeCompare(b.start_time));
        const firstTime = group.bookings[0].start_time.substring(0, 5);
        const lastTime = group.bookings[group.bookings.length - 1].end_time.substring(0, 5);
        group.timeRange = `${firstTime} - ${lastTime}`;
      });

      setPendingBookings(Object.values(grouped));
    } catch (error) {
      console.error('Error fetching pending bookings:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar as aprovações pendentes',
      });
    } finally {
      setLoading(false);
    }
  }, [checkApproverStatus]);

  useEffect(() => {
    fetchPendingBookings();

    const channel = supabase
      .channel('pending-approvals')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_bookings',
          filter: 'room_type=eq.auditorio'
        },
        () => {
          fetchPendingBookings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPendingBookings]);

  const handleApprove = async (group: GroupedBooking) => {
    setConfirmDialog({ open: true, action: 'approve', booking: group });
  };

  const handleReject = async (group: GroupedBooking) => {
    setConfirmDialog({ open: true, action: 'reject', booking: group });
    setRejectReason('');
  };

  const confirmAction = async () => {
    if (!confirmDialog.booking) return;

    const group = confirmDialog.booking;
    const action = confirmDialog.action;
    const bookingIds = group.bookings.map(b => b.id);

    setProcessingId(group.bookings[0].id);
    setConfirmDialog({ open: false, action: 'approve', booking: null });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const newStatus = action === 'approve' ? 'approved' : 'rejected';

      const { error } = await supabase
        .from('room_bookings')
        .update({
          approval_status: newStatus,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .in('id', bookingIds);

      if (error) throw error;

      // Send notification email to user
      try {
        await supabase.functions.invoke('send-approval-result-email-gmail', {
          body: {
            bookings: group.bookings,
            userName: group.fullName,
            roomName: 'Auditório',
            action: newStatus,
            approverName: user.email,
            rejectReason: action === 'reject' ? rejectReason : null,
          },
        });
      } catch (emailError) {
        console.error('Error sending result email:', emailError);
      }

      toast({
        title: action === 'approve' ? 'Aprovado!' : 'Rejeitado',
        description: action === 'approve' 
          ? `Reserva de ${group.fullName} foi aprovada.`
          : `Reserva de ${group.fullName} foi rejeitada.`,
      });

      fetchPendingBookings();
    } catch (error: any) {
      console.error('Error processing approval:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Não foi possível processar a solicitação',
      });
    } finally {
      setProcessingId(null);
      setRejectReason('');
    }
  };

  const getTimeRemaining = (deadline: string) => {
    const deadlineDate = new Date(deadline);
    const now = new Date();
    
    if (deadlineDate < now) {
      return { text: 'Expirado', isExpired: true };
    }
    
    return { 
      text: formatDistanceToNow(deadlineDate, { locale: ptBR, addSuffix: true }),
      isExpired: false 
    };
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-xl overflow-hidden bg-card/95 backdrop-blur-sm">
        <div className="bg-gradient-to-br from-amber-600 via-amber-500 to-orange-500 dark:from-amber-700 dark:via-amber-600 dark:to-orange-600 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
              <Clock className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">Aprovações Pendentes</h3>
              <p className="text-[11px] text-white/70 font-medium">Carregando...</p>
            </div>
          </div>
        </div>
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
          <span className="ml-2.5 text-sm text-muted-foreground">Carregando aprovações...</span>
        </CardContent>
      </Card>
    );
  }

  if (!isApprover) {
    return (
      <Card className="border-0 shadow-xl overflow-hidden bg-card/95 backdrop-blur-sm">
        <div className="bg-gradient-to-br from-amber-600 via-amber-500 to-orange-500 dark:from-amber-700 dark:via-amber-600 dark:to-orange-600 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
              <Clock className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">Aprovações Pendentes</h3>
              <p className="text-[11px] text-white/70 font-medium">Reservas do Auditório</p>
            </div>
          </div>
        </div>
        <CardContent className="text-center py-16 text-muted-foreground">
          <div className="h-16 w-16 rounded-2xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-amber-400" />
          </div>
          <p className="font-semibold text-sm">Acesso Restrito</p>
          <p className="text-[12px] mt-1.5 text-muted-foreground/70 max-w-[280px] mx-auto leading-relaxed">
            Você não está configurado como aprovador de reservas do Auditório.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-0 shadow-xl overflow-hidden bg-card/95 backdrop-blur-sm">
        {/* Gradient Header */}
        <div className="bg-gradient-to-br from-amber-600 via-amber-500 to-orange-500 dark:from-amber-700 dark:via-amber-600 dark:to-orange-600 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">Aprovações Pendentes</h3>
                <p className="text-[11px] text-white/70 font-medium">Reservas do Auditório aguardando sua aprovação</p>
              </div>
            </div>
            {pendingBookings.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-xl">
                <span className="text-xl font-black text-white">{pendingBookings.length}</span>
                <span className="text-[10px] text-white/80 font-medium">pendente{pendingBookings.length > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        </div>

        <CardContent className="p-5">
          {pendingBookings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="h-16 w-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              </div>
              <p className="font-semibold text-sm">Nenhuma aprovação pendente</p>
              <p className="text-[12px] mt-1.5 text-muted-foreground/70 max-w-[240px] mx-auto leading-relaxed">
                Todas as solicitações foram processadas.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingBookings.map((group) => {
                const timeRemaining = getTimeRemaining(group.approvalDeadline);
                const isProcessing = processingId === group.bookings[0].id;

                return (
                  <div
                    key={`${group.userId}-${group.bookingDate}-${group.className}`}
                    className="relative overflow-hidden rounded-xl border border-border/40 hover:border-border/60 hover:shadow-sm transition-all duration-200"
                  >
                    {/* Left Accent Bar */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l ${
                      timeRemaining.isExpired ? 'bg-red-400' : 'bg-amber-400'
                    }`} />

                    <div className="pl-4 pr-4 py-4 space-y-3.5">
                      {/* Header */}
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center ring-2 ring-amber-200/50 dark:ring-amber-800/30 flex-shrink-0">
                            <School className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm">{group.fullName}</h4>
                            <p className="text-[11px] text-muted-foreground">{group.className}</p>
                          </div>
                        </div>
                        <Badge 
                          variant="outline"
                          className={`text-[10px] px-2 py-0.5 h-5 rounded-md font-semibold flex items-center gap-1 ${
                            timeRemaining.isExpired 
                              ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200/60 dark:border-red-800/40' 
                              : 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200/60 dark:border-amber-800/40'
                          }`}
                        >
                          <Clock className="h-2.5 w-2.5" />
                          {timeRemaining.isExpired ? 'Expirado' : `Expira ${timeRemaining.text}`}
                        </Badge>
                      </div>

                      {/* Details */}
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground bg-muted/30 px-2.5 py-1 rounded-lg">
                          <Calendar className="h-3 w-3" />
                          <span className="font-medium">{format(new Date(group.bookingDate + 'T00:00:00'), "dd 'de' MMMM", { locale: ptBR })}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground bg-muted/30 px-2.5 py-1 rounded-lg">
                          <Clock className="h-3 w-3" />
                          <span className="font-medium">{group.timeRange}</span>
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 rounded font-semibold ml-0.5">
                            {group.bookings.length} horário{group.bookings.length > 1 ? 's' : ''}
                          </Badge>
                        </div>
                      </div>

                      {/* Resources */}
                      {group.resources.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Recursos solicitados</p>
                          <div className="flex flex-wrap gap-1.5">
                            {group.resources.map((resourceId) => {
                              const resource = RESOURCE_INFO[resourceId];
                              if (!resource) return null;
                              const Icon = resource.icon;
                              return (
                                <Badge key={resourceId} variant="outline" className="text-[10px] px-2 py-0 h-5 rounded-md font-medium flex items-center gap-1 border-border/50">
                                  <Icon className="h-2.5 w-2.5" />
                                  {resource.label}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Observations */}
                      {group.observations && (
                        <div className="p-2.5 bg-blue-50/80 dark:bg-blue-950/20 border border-blue-200/40 dark:border-blue-800/30 rounded-lg">
                          <div className="flex items-start gap-2">
                            <MessageSquare className="h-3.5 w-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-400">Observações</p>
                              <p className="text-[12px] text-blue-600 dark:text-blue-300 leading-relaxed">{group.observations}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                          onClick={() => handleApprove(group)}
                          disabled={isProcessing || timeRemaining.isExpired}
                          className="flex-1 sm:flex-none h-9 text-sm font-semibold rounded-xl bg-gradient-to-r from-emerald-600 to-green-500 hover:opacity-90 transition-opacity shadow-md"
                        >
                          {isProcessing ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          Aprovar
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleReject(group)}
                          disabled={isProcessing || timeRemaining.isExpired}
                          className="flex-1 sm:flex-none h-9 text-sm font-semibold rounded-xl shadow-md"
                        >
                          {isProcessing ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          Rejeitar
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.action === 'approve' ? 'Confirmar Aprovação' : 'Confirmar Rejeição'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.action === 'approve' ? (
                <>
                  Você está prestes a <strong>aprovar</strong> a reserva do Auditório para{' '}
                  <strong>{confirmDialog.booking?.fullName}</strong>.
                  <br /><br />
                  O solicitante será notificado por e-mail.
                </>
              ) : (
                <>
                  Você está prestes a <strong>rejeitar</strong> a reserva do Auditório para{' '}
                  <strong>{confirmDialog.booking?.fullName}</strong>.
                  <br /><br />
                  O horário será liberado e o solicitante será notificado.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {confirmDialog.action === 'reject' && (
            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Motivo da rejeição (opcional)</label>
              <Textarea
                placeholder="Informe o motivo da rejeição..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                className="rounded-xl border-border/40 text-sm"
              />
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAction}
              className={`rounded-xl font-semibold ${confirmDialog.action === 'approve' ? 'bg-gradient-to-r from-emerald-600 to-green-500 hover:opacity-90' : ''}`}
            >
              {confirmDialog.action === 'approve' ? 'Aprovar' : 'Rejeitar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
