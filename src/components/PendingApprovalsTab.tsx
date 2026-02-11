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
      <Card className="border-0 shadow-lg">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Carregando aprovações...</span>
        </CardContent>
      </Card>
    );
  }

  if (!isApprover) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="text-center py-12 text-muted-foreground">
          <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">Acesso Restrito</p>
          <p className="text-sm mt-1">
            Você não está configurado como aprovador de reservas do Auditório.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Aprovações Pendentes
          </CardTitle>
          <CardDescription>
            Reservas do Auditório aguardando sua aprovação
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingBookings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500 opacity-50" />
              <p className="font-medium">Nenhuma aprovação pendente</p>
              <p className="text-sm mt-1">
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
                    className="border rounded-lg p-4 space-y-4"
                  >
                    {/* Header */}
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg">
                          <School className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <h4 className="font-semibold">{group.fullName}</h4>
                          <p className="text-sm text-muted-foreground">{group.className}</p>
                        </div>
                      </div>
                      <Badge 
                        variant={timeRemaining.isExpired ? "destructive" : "secondary"}
                        className="flex items-center gap-1"
                      >
                        <Clock className="h-3 w-3" />
                        {timeRemaining.isExpired ? 'Expirado' : `Expira ${timeRemaining.text}`}
                      </Badge>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{format(new Date(group.bookingDate + 'T00:00:00'), "dd 'de' MMMM", { locale: ptBR })}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{group.timeRange} ({group.bookings.length} horário{group.bookings.length > 1 ? 's' : ''})</span>
                      </div>
                    </div>

                    {/* Resources */}
                    {group.resources.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Recursos solicitados:</p>
                        <div className="flex flex-wrap gap-2">
                          {group.resources.map((resourceId) => {
                            const resource = RESOURCE_INFO[resourceId];
                            if (!resource) return null;
                            const Icon = resource.icon;
                            return (
                              <Badge key={resourceId} variant="outline" className="flex items-center gap-1">
                                <Icon className="h-3 w-3" />
                                {resource.label}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Observations */}
                    {group.observations && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                        <div className="flex items-start gap-2">
                          <MessageSquare className="h-4 w-4 text-blue-600 mt-0.5" />
                          <div>
                            <p className="font-medium text-blue-800">Observações:</p>
                            <p className="text-blue-700">{group.observations}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button
                        onClick={() => handleApprove(group)}
                        disabled={isProcessing || timeRemaining.isExpired}
                        className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700"
                      >
                        {isProcessing ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                        )}
                        Aprovar
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => handleReject(group)}
                        disabled={isProcessing || timeRemaining.isExpired}
                        className="flex-1 sm:flex-none"
                      >
                        {isProcessing ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <XCircle className="h-4 w-4 mr-2" />
                        )}
                        Rejeitar
                      </Button>
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
              <label className="text-sm font-medium">Motivo da rejeição (opcional):</label>
              <Textarea
                placeholder="Informe o motivo da rejeição..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
              />
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAction}
              className={confirmDialog.action === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              {confirmDialog.action === 'approve' ? 'Aprovar' : 'Rejeitar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
