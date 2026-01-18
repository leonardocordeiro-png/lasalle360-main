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
}

interface TodayChromebookBookingsProps {
  totalInventory: number;
}

export function TodayChromebookBookings({ totalInventory }: TodayChromebookBookingsProps) {
  const [bookings, setBookings] = useState<ChromebookBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTodayBookings();

    // Set up realtime subscription
    const channel = supabase
      .channel('today-chromebook-bookings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chromebook_bookings'
        },
        () => {
          fetchTodayBookings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTodayBookings = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('chromebook_bookings')
        .select('*')
        .eq('booking_date', today)
        .eq('status', 'active')
        .order('start_time', { ascending: true });

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error('Error fetching today chromebook bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const isCurrentlyActive = (startTime: string, endTime: string) => {
    const now = new Date();
    const currentTime = format(now, 'HH:mm');
    return currentTime >= startTime && currentTime <= endTime;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Chrome className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Nenhum agendamento de Chromebooks para hoje</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {bookings.length} {bookings.length === 1 ? 'agendamento' : 'agendamentos'} hoje
        </div>
      </div>

      <ScrollArea className="h-[600px] pr-4">
        <div className="space-y-3">
          {bookings.map((booking) => {
            const isActive = isCurrentlyActive(booking.start_time, booking.end_time);
            
            return (
              <Card 
                key={booking.id} 
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
                      <p className="text-sm font-medium truncate">{booking.full_name}</p>
                      <p className="text-xs text-muted-foreground">{booking.class_name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Chrome className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-semibold text-primary">
                      {booking.quantity} {booking.quantity === 1 ? 'Chromebook' : 'Chromebooks'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm">
                      {booking.start_time} - {booking.end_time}
                    </span>
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