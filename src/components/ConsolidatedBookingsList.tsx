import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Clock, X, Calendar, ChevronLeft, ChevronRight, Laptop, Users } from 'lucide-react';
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

interface GroupedByDate {
  date: string;
  dateFormatted: string;
  dayOfWeek: string;
  bookings: DayBooking[];
}

interface DayBooking {
  user_id: string;
  full_name: string;
  quantity: number;
  status: string;
  classes: string[];
  timeRange: string;
  bookingIds: string[];
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

  // Agrupar por data, depois por usuário/quantidade/status
  const groupedByDate = useMemo((): GroupedByDate[] => {
    const dateMap = new Map<string, Map<string, DayBooking>>();
    
    filteredBookings.forEach(booking => {
      const date = booking.booking_date;
      const key = `${booking.user_id}-${booking.quantity}-${booking.status}`;
      
      if (!dateMap.has(date)) {
        dateMap.set(date, new Map());
      }
      
      const dayMap = dateMap.get(date)!;
      
      if (dayMap.has(key)) {
        const existing = dayMap.get(key)!;
        if (!existing.classes.includes(booking.class_name)) {
          existing.classes.push(booking.class_name);
        }
        existing.bookingIds.push(booking.id);
        // Atualizar range de horários
        const times = [...existing.bookingIds, booking.id]
          .map(id => filteredBookings.find(b => b.id === id))
          .filter(Boolean)
          .map(b => ({ start: b!.start_time, end: b!.end_time }))
          .sort((a, b) => a.start.localeCompare(b.start));
        
        if (times.length > 0) {
          const firstTime = times[0].start.substring(0, 5);
          const lastTime = times[times.length - 1].end.substring(0, 5);
          existing.timeRange = `${firstTime} - ${lastTime}`;
        }
      } else {
        dayMap.set(key, {
          user_id: booking.user_id,
          full_name: booking.full_name,
          quantity: booking.quantity,
          status: booking.status,
          classes: [booking.class_name],
          timeRange: `${booking.start_time.substring(0, 5)} - ${booking.end_time.substring(0, 5)}`,
          bookingIds: [booking.id]
        });
      }
    });
    
    // Converter para array e ordenar por data (mais recente primeiro)
    return Array.from(dateMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, dayMap]) => ({
        date,
        dateFormatted: format(parseISO(date), "dd/MM", { locale: ptBR }),
        dayOfWeek: format(parseISO(date), "EEE", { locale: ptBR }),
        bookings: Array.from(dayMap.values())
      }));
  }, [filteredBookings]);

  const handleCancelBooking = async (dayBooking: DayBooking) => {
    if (!isAdmin && dayBooking.user_id !== currentUserId) {
      toast({
        variant: "destructive",
        title: "Acesso negado",
        description: "Você só pode cancelar seus próprios agendamentos",
      });
      return;
    }

    dayBooking.bookingIds.forEach(id => setCancellingBookings(prev => new Set(prev).add(id)));

    try {
      const { error } = await supabase
        .from('chromebook_bookings')
        .update({ status: 'cancelled' })
        .in('id', dayBooking.bookingIds);

      if (error) throw error;

      toast({
        title: "Cancelado",
        description: `${dayBooking.quantity} chromebooks cancelados`,
      });

      dayBooking.bookingIds.forEach(id => onBookingCancelled(id));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao cancelar",
        description: error.message,
      });
    } finally {
      dayBooking.bookingIds.forEach(id => 
        setCancellingBookings(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        })
      );
    }
  };

  const canCancel = (dayBooking: DayBooking) => {
    return dayBooking.status === 'active' && (isAdmin || dayBooking.user_id === currentUserId);
  };

  const isCancelling = (dayBooking: DayBooking) => {
    return dayBooking.bookingIds.some(id => cancellingBookings.has(id));
  };

  const handlePreviousMonth = () => setSelectedMonth(prev => subMonths(prev, 1));
  const handleNextMonth = () => setSelectedMonth(prev => addMonths(prev, 1));
  const handleCurrentMonth = () => setSelectedMonth(new Date());

  // Contagem
  const totalBookings = filteredBookings.length;
  const activeCount = filteredBookings.filter(b => b.status === 'active').length;
  const cancelledCount = filteredBookings.filter(b => b.status === 'cancelled').length;

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Laptop className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Chromebooks</CardTitle>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  {activeCount} ativos
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-gray-400" />
                  {cancelledCount} cancelados
                </span>
              </div>
            </div>
          </div>
          
          {/* Navegação de Mês */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={handlePreviousMonth} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" onClick={handleCurrentMonth} className="h-8 px-3 text-sm font-medium">
              {format(selectedMonth, "MMM yyyy", { locale: ptBR })}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleNextMonth} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {groupedByDate.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhum agendamento em {format(selectedMonth, "MMMM", { locale: ptBR })}</p>
          </div>
        ) : (
          <div className="space-y-1">
            {groupedByDate.map((dateGroup) => (
              <div key={dateGroup.date} className="rounded-lg overflow-hidden">
                {/* Cabeçalho da Data */}
                <div className="flex items-center gap-2 py-2 px-3 bg-muted/50 sticky top-0">
                  <span className="text-sm font-semibold text-foreground">
                    {dateGroup.dateFormatted}
                  </span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {dateGroup.dayOfWeek}
                  </span>
                </div>
                
                {/* Bookings do dia */}
                <div className="divide-y divide-border/50">
                  {dateGroup.bookings.map((booking, idx) => (
                    <div
                      key={`${booking.user_id}-${idx}`}
                      className={`flex items-center justify-between py-3 px-3 ${
                        booking.status === 'cancelled' ? 'opacity-50' : 'hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Horário */}
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 w-24">
                          <Clock className="h-3.5 w-3.5" />
                          <span className="font-mono">{booking.timeRange}</span>
                        </div>
                        
                        {/* Turma(s) e Usuário */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">
                              {booking.classes.length === 1 
                                ? booking.classes[0] 
                                : `${booking.classes.length} turmas`}
                            </span>
                            {booking.status === 'cancelled' && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                Cancelado
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Users className="h-3 w-3" />
                            <span className="truncate">{booking.full_name}</span>
                            {booking.classes.length > 1 && (
                              <span className="truncate hidden sm:inline">• {booking.classes.join(', ')}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Quantidade e Ações */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span className="text-sm font-semibold text-primary">
                            {booking.quantity}
                          </span>
                          <span className="text-xs text-muted-foreground ml-1">
                            un.
                          </span>
                        </div>
                        
                        {canCancel(booking) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelBooking(booking)}
                            disabled={isCancelling(booking)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}