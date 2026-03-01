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

// Função para formatar nome: primeiro nome + último sobrenome
const formatUserName = (fullName: string) => {
  if (!fullName) return '';
  
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 2) return fullName;
  
  return `${parts[0]} ${parts[parts.length - 1]}`;
};

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
        <div className="text-xs text-muted-foreground font-medium">
          {groupedBookings.length} {groupedBookings.length === 1 ? 'agendamento' : 'agendamentos'} {isToday ? 'hoje' : `em ${dateLabel}`}
        </div>
      </div>

      <ScrollArea className="h-[600px] pr-3">
        <div className="space-y-2.5">
          {groupedBookings.map((group) => {
            const isActive = isGroupActive(group);
            
            return (
              <div 
                key={group.key} 
                className={`relative overflow-hidden rounded-xl border transition-all duration-200 ${
                  isActive 
                    ? 'border-primary/40 bg-primary/5 shadow-md' 
                    : 'border-border/40 bg-muted/10 hover:bg-muted/20'
                }`}
              >
                {/* Left accent bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l ${isActive ? 'bg-primary' : 'bg-muted-foreground/20'}`} />
                
                <div className="pl-4 pr-3 py-3 space-y-2.5">
                  {isActive && (
                    <Badge className="bg-primary text-primary-foreground text-[10px] px-2 py-0 h-5 rounded-md font-semibold">
                      Em Uso Agora
                    </Badge>
                  )}
                  
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{formatUserName(group.full_name)}</p>
                      <p className="text-[11px] text-muted-foreground">{group.class_name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pl-0.5">
                    <Chrome className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    <span className="text-sm font-bold text-primary">
                      {group.quantity} {group.quantity === 1 ? 'Chromebook' : 'Chromebooks'}
                    </span>
                  </div>

                  <div className="flex items-start gap-2 pl-0.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      {group.timeSlots.length > 1 ? (
                        <div className="space-y-1">
                          <span className="text-[10px] text-muted-foreground font-medium">{group.timeSlots.length} horários:</span>
                          <div className="flex flex-wrap gap-1">
                            {group.timeSlots.map((slot, idx) => (
                              <Badge key={idx} variant="outline" className="text-[10px] px-1.5 py-0 h-5 rounded-md border-border/50 font-medium">
                                {slot.start} - {slot.end}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm font-medium">
                          {group.timeSlots[0].start} - {group.timeSlots[0].end}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}