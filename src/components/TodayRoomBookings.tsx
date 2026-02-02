import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, User, Calendar as CalendarIcon, MessageSquare, AlertTriangle } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface RoomBooking {
  id: string;
  room_type: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  class_name: string;
  full_name: string;
  observations: string | null;
  status: string;
}

// Interface para agrupamento de horários consecutivos
interface GroupedBooking {
  ids: string[];
  room_type: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  class_name: string;
  full_name: string;
  observations: string[];
  slots_count: number;
}

type DateFilter = 'today' | 'week' | 'month';

// Função para agrupar horários consecutivos do mesmo usuário/sala/data
function groupConsecutiveBookings(bookings: RoomBooking[]): GroupedBooking[] {
  if (bookings.length === 0) return [];
  
  // Ordenar por data, sala, usuário e horário
  const sorted = [...bookings].sort((a, b) => {
    if (a.booking_date !== b.booking_date) return a.booking_date.localeCompare(b.booking_date);
    if (a.room_type !== b.room_type) return a.room_type.localeCompare(b.room_type);
    if (a.full_name !== b.full_name) return a.full_name.localeCompare(b.full_name);
    return a.start_time.localeCompare(b.start_time);
  });

  const grouped: GroupedBooking[] = [];
  let current: GroupedBooking | null = null;

  for (const booking of sorted) {
    // Verifica se pode agrupar com o anterior
    const canGroup = current && 
      current.booking_date === booking.booking_date &&
      current.room_type === booking.room_type &&
      current.full_name === booking.full_name &&
      current.end_time === booking.start_time;

    if (canGroup && current) {
      // Estende o grupo atual
      current.ids.push(booking.id);
      current.end_time = booking.end_time;
      current.slots_count++;
      if (booking.observations?.trim()) {
        current.observations.push(booking.observations.trim());
      }
    } else {
      // Salva o grupo anterior e inicia um novo
      if (current) grouped.push(current);
      current = {
        ids: [booking.id],
        room_type: booking.room_type,
        booking_date: booking.booking_date,
        start_time: booking.start_time,
        end_time: booking.end_time,
        class_name: booking.class_name,
        full_name: booking.full_name,
        observations: booking.observations?.trim() ? [booking.observations.trim()] : [],
        slots_count: 1
      };
    }
  }
  
  if (current) grouped.push(current);
  return grouped;
}

export function TodayRoomBookings() {
  const [bookings, setBookings] = useState<RoomBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');

  const fetchBookings = useCallback(async (filter: DateFilter) => {
    try {
      setLoading(true);
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      
      let endDate: string;
      if (filter === 'today') {
        endDate = todayStr;
      } else if (filter === 'week') {
        endDate = format(addDays(today, 7), 'yyyy-MM-dd');
      } else {
        endDate = format(addDays(today, 30), 'yyyy-MM-dd');
      }
      
      const { data, error } = await supabase
        .from('room_bookings')
        .select('id, room_type, booking_date, start_time, end_time, class_name, full_name, observations, status')
        .gte('booking_date', todayStr)
        .lte('booking_date', endDate)
        .eq('status', 'active')
        .order('booking_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;
      
      setBookings(data || []);
    } catch (error: any) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings(dateFilter);
    
    // Set up realtime subscription
    const channel = supabase
      .channel('room-bookings-list')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_bookings'
        },
        () => {
          fetchBookings(dateFilter);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dateFilter, fetchBookings]);

  const getRoomTypeLabel = (type: string) => {
    if (type === 'auditorio') return 'Auditório';
    if (type === 'laboratorio') return 'Laboratório';
    if (type === 'sala_criativa') return 'Sala Criativa';
    return type;
  };

  const getRoomTypeBadgeClass = (type: string) => {
    if (type === 'auditorio') return 'bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500';
    if (type === 'laboratorio') return 'bg-purple-600 hover:bg-purple-700 text-white dark:bg-purple-500';
    if (type === 'sala_criativa') return 'bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-500';
    return 'bg-gray-600 hover:bg-gray-700 text-white';
  };

  const isCurrentlyActive = (bookingDate: string, startTime: string, endTime: string) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    if (bookingDate !== today) return false;
    const now = new Date();
    const currentTime = format(now, 'HH:mm:ss');
    return currentTime >= startTime && currentTime <= endTime;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-1/2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-12 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const getFilterLabel = () => {
    if (dateFilter === 'today') return 'hoje';
    if (dateFilter === 'week') return 'nos próximos 7 dias';
    return 'nos próximos 30 dias';
  };

  // Agrupar horários consecutivos
  const groupedBookings = groupConsecutiveBookings(bookings);
  
  // Contar por tipo de sala (usando agrupados para contagem mais precisa)
  const auditorioCount = groupedBookings.filter(b => b.room_type === 'auditorio').length;
  const laboratorioCount = groupedBookings.filter(b => b.room_type === 'laboratorio').length;
  const salaCriativaCount = groupedBookings.filter(b => b.room_type === 'sala_criativa').length;
  
  // Agendamentos com observações
  const bookingsWithObservations = groupedBookings.filter(b => b.observations.length > 0);

  // Agrupar por data
  const bookingsByDate = groupedBookings.reduce((acc, booking) => {
    const date = booking.booking_date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(booking);
    return acc;
  }, {} as Record<string, GroupedBooking[]>);

  const sortedDates = Object.keys(bookingsByDate).sort();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="space-y-6">
      {/* Filtro de período */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Tabs value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)} className="w-full sm:w-auto">
          <TabsList className="grid w-full sm:w-auto grid-cols-3">
            <TabsTrigger value="today" className="text-xs sm:text-sm">Hoje</TabsTrigger>
            <TabsTrigger value="week" className="text-xs sm:text-sm">Próx. 7 dias</TabsTrigger>
            <TabsTrigger value="month" className="text-xs sm:text-sm">Próx. 30 dias</TabsTrigger>
          </TabsList>
        </Tabs>
        <p className="text-sm text-muted-foreground">
          {bookings.length} agendamento(s) {getFilterLabel()}
        </p>
      </div>

      {/* Estado vazio */}
      {bookings.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              Nenhum agendamento {getFilterLabel()}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Não há salas reservadas para o período selecionado
            </p>
          </CardContent>
        </Card>
      )}

      {/* Resumo compacto */}
      {groupedBookings.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Auditório</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{auditorioCount}</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Laboratório</p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{laboratorioCount}</p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Sala Criativa</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{salaCriativaCount}</p>
          </div>
        </div>
      )}

      {/* Alerta compacto de solicitações especiais */}
      {bookingsWithObservations.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-700 rounded-lg p-3">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">
              {bookingsWithObservations.length} reserva(s) com solicitações especiais
            </span>
          </div>
        </div>
      )}

      {/* Lista de agendamentos agrupados por data */}
      {sortedDates.map((date) => {
        const dateBookings = bookingsByDate[date];
        const isToday = date === todayStr;
        const formattedDate = format(new Date(date + 'T12:00:00'), "EEEE, dd/MM", { locale: ptBR });
        
        return (
          <div key={date} className="space-y-2">
            {/* Cabeçalho da data - apenas se não for hoje ou se houver múltiplas datas */}
            {(sortedDates.length > 1 || !isToday) && (
              <div className={`flex items-center gap-2 px-2 py-1 rounded ${isToday ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
                <CalendarIcon className={`h-4 w-4 ${isToday ? 'text-green-600' : 'text-gray-500'}`} />
                <span className={`text-sm font-medium capitalize ${isToday ? 'text-green-700 dark:text-green-300' : ''}`}>
                  {isToday ? '📍 Hoje' : formattedDate}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({dateBookings.length} reserva{dateBookings.length > 1 ? 's' : ''})
                </span>
              </div>
            )}

            {/* Cards dos agendamentos - agrupados */}
            <div className="space-y-2">
              {dateBookings.map((booking) => {
                const isActive = isCurrentlyActive(booking.booking_date, booking.start_time, booking.end_time);
                const hasObservations = booking.observations.length > 0;
                const uniqueObservations = [...new Set(booking.observations)];
                
                return (
                  <div 
                    key={booking.ids.join('-')} 
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                      isActive 
                        ? 'border-green-500 bg-green-50 dark:bg-green-950 shadow-md' 
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
                    }`}
                  >
                    {/* Badge da sala */}
                    <Badge className={`${getRoomTypeBadgeClass(booking.room_type)} shrink-0`}>
                      {getRoomTypeLabel(booking.room_type)}
                    </Badge>
                    
                    {/* Informações principais */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm truncate">{booking.full_name}</span>
                        {booking.slots_count > 1 && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            {booking.slots_count} horários
                          </Badge>
                        )}
                        {isActive && (
                          <Badge className="bg-green-600 text-white text-xs animate-pulse shrink-0">
                            EM USO
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {booking.start_time.substring(0, 5)} - {booking.end_time.substring(0, 5)}
                        </span>
                        <span>{booking.class_name}</span>
                      </div>
                      
                      {/* Observações inline */}
                      {hasObservations && (
                        <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded text-xs text-amber-800 dark:text-amber-300">
                          <div className="flex items-start gap-1">
                            <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                            <span>{uniqueObservations.join(' | ')}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}