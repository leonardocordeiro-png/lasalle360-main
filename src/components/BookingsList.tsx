import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Clock, X, AlertCircle, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Booking {
  id: string;
  user_id: string;
  full_name: string;
  class_name: string;
  quantity: number;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  created_at: string;
}

interface BookingsListProps {
  bookings: Booking[];
  onBookingCancelled: (bookingId: string) => void;
  isAdmin: boolean;
  currentUserId: string;
}

export default function BookingsList({ 
  bookings, 
  onBookingCancelled, 
  isAdmin, 
  currentUserId 
}: BookingsListProps) {
  const [cancellingBookings, setCancellingBookings] = useState<Set<string>>(new Set());

  const handleCancelBooking = async (booking: Booking) => {
    if (!isAdmin && booking.user_id !== currentUserId) {
      toast({
        variant: "destructive",
        title: "Acesso negado",
        description: "Você só pode cancelar seus próprios agendamentos",
      });
      return;
    }

    setCancellingBookings(prev => new Set(prev).add(booking.id));

    try {
      const { error } = await supabase
        .from('chromebook_bookings')
        .update({ status: 'cancelled' })
        .eq('id', booking.id);

      if (error) throw error;

      toast({
        title: "Agendamento cancelado",
        description: `Agendamento de ${booking.quantity} chromebooks foi cancelado`,
      });

      onBookingCancelled(booking.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao cancelar",
        description: error.message,
      });
    } finally {
      setCancellingBookings(prev => {
        const newSet = new Set(prev);
        newSet.delete(booking.id);
        return newSet;
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      active: { label: 'Ativo', variant: 'default' as const, className: 'bg-success text-success-foreground' },
      cancelled: { label: 'Cancelado', variant: 'secondary' as const, className: 'bg-muted text-muted-foreground' }
    };
    
    const statusInfo = statusMap[status as keyof typeof statusMap] || statusMap.active;
    
    return (
      <Badge variant={statusInfo.variant} className={statusInfo.className}>
        {statusInfo.label}
      </Badge>
    );
  };

  const canCancelBooking = (booking: Booking) => {
    return booking.status === 'active' && (isAdmin || booking.user_id === currentUserId);
  };

  const isUpcoming = (bookingDate: string) => {
    const today = new Date();
    const booking = parseISO(bookingDate);
    return booking >= today;
  };

  if (!bookings?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Agendamentos Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum agendamento encontrado</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Agendamentos Recentes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {bookings.map((booking) => (
          <div
            key={booking.id}
            className={`p-4 border rounded-lg transition-colors ${
              booking.status === 'active' 
                ? 'border-border hover:bg-muted/50' 
                : 'border-muted bg-muted/30'
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-sm">{booking.class_name}</h4>
                  {getStatusBadge(booking.status)}
                </div>
                <p className="text-xs text-muted-foreground mb-1">
                  {booking.full_name}
                </p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {format(parseISO(booking.booking_date), "dd/MM/yyyy", { locale: ptBR })}
                  <span className="mx-1">•</span>
                  {booking.start_time} - {booking.end_time}
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-sm font-medium text-primary">
                  {booking.quantity} chromebooks
                </div>
                {canCancelBooking(booking) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCancelBooking(booking)}
                    disabled={cancellingBookings.has(booking.id)}
                    className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 mt-1"
                  >
                    <X className="h-3 w-3 mr-1" />
                    {cancellingBookings.has(booking.id) ? 'Cancelando...' : 'Cancelar'}
                  </Button>
                )}
              </div>
            </div>

            {booking.status === 'active' && !isUpcoming(booking.booking_date) && (
              <div className="flex items-center gap-1 text-xs text-warning mt-2 p-2 bg-warning/10 rounded">
                <AlertCircle className="h-3 w-3" />
                <span>Agendamento passado</span>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}