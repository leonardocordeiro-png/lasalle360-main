import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, User, Chrome } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChromebookBooking {
  id: string;
  full_name: string;
  class_name: string;
  quantity: number;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  user_id: string;
}

interface GroupedBooking {
  key: string;
  full_name: string;
  class_name: string;
  quantity: number;
  timeSlots: { start: string; end: string }[];
  user_id: string;
}

interface TodayChromebookBookingsProps {
  totalInventory: number;
  selectedDate?: Date;
}

export function TodayChromebookBookings({ totalInventory, selectedDate }: TodayChromebookBookingsProps) {
  const [bookings, setBookings] = useState<ChromebookBooking[]>([]);
  const [loading, setLoading] = useState(true);
  
  const dateToFetch = selectedDate || new Date();
  const dateStr = format(dateToFetch, 'yyyy-MM-dd');

  useEffect(() => {
    fetchBookings();

    // Set up realtime subscription
    const channel = supabase
      .channel('selected-date-chromebook-bookings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chromebook_bookings'
        },
        () => {
          fetchBookings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dateStr]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('chromebook_bookings')
        .select('*')
        .eq('booking_date', dateStr)
        .eq('status', 'active')
        .order('start_time', { ascending: true });

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error('Error fetching chromebook bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const isCurrentlyActive = (startTime: string, endTime: string) => {
    const now = new Date();
    const currentTime = format(now, 'HH:mm');
    return currentTime >= startTime && currentTime <= endTime;
  };

  // Agrupar agendamentos por usuário e turma
  const groupedBookings: GroupedBooking[] = (() => {
    const groups = new Map<string, GroupedBooking>();
    
    bookings.forEach(booking => {
      const key = `${booking.user_id}-${booking.class_name}`;
      
      if (groups.has(key)) {
        const existing = groups.get(key)!;
        existing.timeSlots.push({ start: booking.start_time, end: booking.end_time });
        // Ordenar slots por horário
        existing.timeSlots.sort((a, b) => a.start.localeCompare(b.start));
      } else {
        groups.set(key, {
          key,
          full_name: booking.full_name,
          class_name: booking.class_name,
          quantity: booking.quantity,
          timeSlots: [{ start: booking.start_time, end: booking.end_time }],
          user_id: booking.user_id,
        });
      }
    });
    
    // Converter para array e ordenar pelo primeiro horário
    return Array.from(groups.values()).sort((a, b) => 
      a.timeSlots[0].start.localeCompare(b.timeSlots[0].start)
    );
  })();

  // Verificar se algum slot do grupo está ativo agora
  const isGroupActive = (group: GroupedBooking) => {
    return group.timeSlots.some(slot => isCurrentlyActive(slot.start, slot.end));
  };

  // Formatar horários do grupo
  const formatTimeSlots = (slots: { start: string; end: string }[]) => {
    if (slots.length === 1) {
      return `${slots[0].start} - ${slots[0].end}`;
    }
    return slots.map(s => `${s.start} - ${s.end}`).join(', ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Verificar se é hoje
  const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr;
  const dateLabel = isToday ? 'hoje' : format(dateToFetch, "dd/MM", { locale: ptBR });

  if (groupedBookings.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Chrome className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Nenhum agendamento para {isToday ? 'hoje' : format(dateToFetch, "dd 'de' MMMM", { locale: ptBR })}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {groupedBookings.length} {groupedBookings.length === 1 ? 'agendamento' : 'agendamentos'} {isToday ? 'hoje' : `em ${dateLabel}`}
        </div>
      </div>

      <ScrollArea className="h-[600px] pr-4">
        <div className="space-y-3">
          {groupedBookings.map((group) => {
            const isActive = isGroupActive(group);
            
            return (
              <Card 
                key={group.key} 
                className={`${isActive ? 'border-primary shadow-md bg-primary/5' : ''}`}
              >
                <CardContent className="pt-4 pb-4 space-y-3">
                  {isActive && (
                    <Badge className="bg-primary text-primary-foreground">
                      Em Uso Agora
                    </Badge>
                  )}
                  
                  <div className="flex items-start gap-2">
                    <User className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{group.full_name}</p>
                      <p className="text-xs text-muted-foreground">{group.class_name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Chrome className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-semibold text-primary">
                      {group.quantity} {group.quantity === 1 ? 'Chromebook' : 'Chromebooks'}
                    </span>
                  </div>

                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      {group.timeSlots.length > 1 ? (
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">{group.timeSlots.length} horários:</span>
                          <div className="flex flex-wrap gap-1">
                            {group.timeSlots.map((slot, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {slot.start} - {slot.end}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm">
                          {group.timeSlots[0].start} - {group.timeSlots[0].end}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}