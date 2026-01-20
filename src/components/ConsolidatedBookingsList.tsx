import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Clock, X, AlertCircle, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, addMonths, subMonths } from 'date-fns';
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

interface ConsolidatedBooking {
  user_id: string;
  full_name: string;
  quantity: number;
  booking_date: string;
  status: string;
  created_at: string;
  bookings: Booking[];
  classTimeSlots: Array<{
    class_name: string;
    start_time: string;
    end_time: string;
    id: string;
  }>;
}

interface ConsolidatedBookingsListProps {
  bookings: Booking[];
  onBookingCancelled: (bookingId: string) => void;
  isAdmin: boolean;
  currentUserId: string;
}

export default function ConsolidatedBookingsList({ 
  bookings, 
  onBookingCancelled, 
  isAdmin, 
  currentUserId 
}: ConsolidatedBookingsListProps) {
  const [cancellingBookings, setCancellingBookings] = useState<Set<string>>(new Set());
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());

  // Filtrar agendamentos pelo mês selecionado
  const filteredBookings = useMemo(() => {
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    
    return bookings.filter(booking => {
      const bookingDate = parseISO(booking.booking_date);
      return isWithinInterval(bookingDate, { start: monthStart, end: monthEnd });
    });
  }, [bookings, selectedMonth]);

  // Consolidar agendamentos por usuário, data e quantidade
  const consolidatedBookings: ConsolidatedBooking[] = filteredBookings.reduce((acc: ConsolidatedBooking[], booking: Booking) => {
    const existingGroup = acc.find(group => 
      group.user_id === booking.user_id &&
      group.booking_date === booking.booking_date &&
      group.quantity === booking.quantity &&
      group.status === booking.status
    );

    if (existingGroup) {
      existingGroup.bookings.push(booking);
      existingGroup.classTimeSlots.push({
        class_name: booking.class_name,
        start_time: booking.start_time,
        end_time: booking.end_time,
        id: booking.id
      });
    } else {
      acc.push({
        user_id: booking.user_id,
        full_name: booking.full_name,
        quantity: booking.quantity,
        booking_date: booking.booking_date,
        status: booking.status,
        created_at: booking.created_at,
        bookings: [booking],
        classTimeSlots: [{
          class_name: booking.class_name,
          start_time: booking.start_time,
          end_time: booking.end_time,
          id: booking.id
        }]
      });
    }

    return acc;
  }, []);

  // Ordenar por data (mais recentes primeiro)
  const sortedConsolidatedBookings = consolidatedBookings.sort((a, b) => 
    new Date(b.booking_date).getTime() - new Date(a.booking_date).getTime()
  );

  const handleCancelBookingGroup = async (consolidatedBooking: ConsolidatedBooking) => {
    if (!isAdmin && consolidatedBooking.user_id !== currentUserId) {
      toast({
        variant: "destructive",
        title: "Acesso negado",
        description: "Você só pode cancelar seus próprios agendamentos",
      });
      return;
    }

    const bookingIds = consolidatedBooking.bookings.map(b => b.id);
    bookingIds.forEach(id => setCancellingBookings(prev => new Set(prev).add(id)));

    try {
      const { error } = await supabase
        .from('chromebook_bookings')
        .update({ status: 'cancelled' })
        .in('id', bookingIds);

      if (error) throw error;

      toast({
        title: "Agendamentos cancelados",
        description: `${bookingIds.length} agendamentos de ${consolidatedBooking.quantity} chromebooks foram cancelados`,
      });

      bookingIds.forEach(id => onBookingCancelled(id));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao cancelar",
        description: error.message,
      });
    } finally {
      bookingIds.forEach(id => 
        setCancellingBookings(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        })
      );
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

  const canCancelBooking = (consolidatedBooking: ConsolidatedBooking) => {
    return consolidatedBooking.status === 'active' && (isAdmin || consolidatedBooking.user_id === currentUserId);
  };

  const isUpcoming = (bookingDate: string) => {
    const today = new Date();
    const booking = parseISO(bookingDate);
    return booking >= today;
  };

  const hasCancellingBookings = (consolidatedBooking: ConsolidatedBooking) => {
    return consolidatedBooking.bookings.some(booking => cancellingBookings.has(booking.id));
  };

  const handlePreviousMonth = () => {
    setSelectedMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setSelectedMonth(prev => addMonths(prev, 1));
  };

  const handleCurrentMonth = () => {
    setSelectedMonth(new Date());
  };

  // Contar agendamentos ativos e cancelados do mês
  const activeCount = sortedConsolidatedBookings.filter(b => b.status === 'active').length;
  const cancelledCount = sortedConsolidatedBookings.filter(b => b.status === 'cancelled').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Agendamentos de Chromebooks
          </CardTitle>
          
          {/* Navegação de Mês */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePreviousMonth}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              onClick={handleCurrentMonth}
              className="min-w-[140px] capitalize"
            >
              {format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR })}
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              onClick={handleNextMonth}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Resumo do mês */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-success flex-shrink-0" />
            <span className="whitespace-nowrap">{activeCount} ativo(s)</span>
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-muted-foreground flex-shrink-0" />
            <span className="whitespace-nowrap">{cancelledCount} cancelado(s)</span>
          </span>
          <span className="text-xs whitespace-nowrap">
            Total: {sortedConsolidatedBookings.length} agendamento(s)
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {sortedConsolidatedBookings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum agendamento encontrado em {format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR })}</p>
            <Button
              variant="link"
              onClick={handleCurrentMonth}
              className="mt-2"
            >
              Ir para o mês atual
            </Button>
          </div>
        ) : (
          sortedConsolidatedBookings.map((consolidatedBooking, index) => (
            <div
              key={`${consolidatedBooking.user_id}-${consolidatedBooking.booking_date}-${index}`}
              className={`p-4 border rounded-lg transition-colors ${
                consolidatedBooking.status === 'active' 
                  ? 'border-border hover:bg-muted/50' 
                  : 'border-muted bg-muted/30'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-sm">
                      {consolidatedBooking.classTimeSlots.length === 1 
                        ? consolidatedBooking.classTimeSlots[0].class_name
                        : `${consolidatedBooking.classTimeSlots.length} turmas`
                      }
                    </h4>
                    {getStatusBadge(consolidatedBooking.status)}
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {consolidatedBooking.full_name}
                  </p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(parseISO(consolidatedBooking.booking_date), "dd/MM/yyyy (EEEE)", { locale: ptBR })}
                    </div>
                    {consolidatedBooking.classTimeSlots.map((slot, slotIndex) => (
                      <div key={slotIndex} className="ml-4 text-xs">
                        {slot.class_name} • {slot.start_time} - {slot.end_time}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-sm font-medium text-primary">
                    {consolidatedBooking.quantity} chromebooks
                  </div>
                  {canCancelBooking(consolidatedBooking) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCancelBookingGroup(consolidatedBooking)}
                      disabled={hasCancellingBookings(consolidatedBooking)}
                      className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 mt-1"
                    >
                      <X className="h-3 w-3 mr-1" />
                      {hasCancellingBookings(consolidatedBooking) ? 'Cancelando...' : 'Cancelar'}
                    </Button>
                  )}
                </div>
              </div>

              {consolidatedBooking.status === 'active' && !isUpcoming(consolidatedBooking.booking_date) && (
                <div className="flex items-center gap-1 text-xs text-warning mt-2 p-2 bg-warning/10 rounded">
                  <AlertCircle className="h-3 w-3" />
                  <span>Agendamento passado</span>
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}