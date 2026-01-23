import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, User, Calendar as CalendarIcon, MessageSquare, AlertTriangle, ChevronRight } from 'lucide-react';
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

type DateFilter = 'today' | 'week' | 'month';

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

  const isCurrentlyActive = (startTime: string, endTime: string) => {
    const now = new Date();
    const currentTime = format(now, 'HH:mm:ss');
    return currentTime >= startTime && currentTime <= endTime;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
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

  const auditorioBookings = bookings.filter(b => b.room_type === 'auditorio');
  const laboratorioBookings = bookings.filter(b => b.room_type === 'laboratorio');
  const salaCriativaBookings = bookings.filter(b => b.room_type === 'sala_criativa');
  const bookingsWithObservations = bookings.filter(b => b.observations && b.observations.trim());

  // Agrupar por data
  const bookingsByDate = bookings.reduce((acc, booking) => {
    const date = booking.booking_date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(booking);
    return acc;
  }, {} as Record<string, RoomBooking[]>);

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

      {/* Resumo */}
      {bookings.length > 0 && (
        <Card className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Resumo - {dateFilter === 'today' ? format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : `Próximos ${dateFilter === 'week' ? '7' : '30'} dias`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                <p className="text-sm text-muted-foreground mb-1">Auditório</p>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{auditorioBookings.length}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                <p className="text-sm text-muted-foreground mb-1">Laboratório</p>
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{laboratorioBookings.length}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                <p className="text-sm text-muted-foreground mb-1">Sala Criativa</p>
                <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{salaCriativaBookings.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerta de solicitações especiais */}
      {bookingsWithObservations.length > 0 && (
        <Card className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 border-amber-300 dark:border-amber-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              Atenção: {bookingsWithObservations.length} reserva(s) com solicitações especiais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-800 dark:text-amber-300 mb-4">
              Os agendamentos abaixo possuem observações ou solicitações de recursos. Organize com antecedência!
            </p>
            <div className="space-y-3">
              {bookingsWithObservations.map((booking) => {
                const isBookingToday = booking.booking_date === todayStr;
                const bookingDateFormatted = format(new Date(booking.booking_date + 'T12:00:00'), "dd/MM (EEEE)", { locale: ptBR });
                
                return (
                  <div 
                    key={booking.id} 
                    className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-amber-200 dark:border-amber-700"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Badge className={getRoomTypeBadgeClass(booking.room_type)}>
                            {getRoomTypeLabel(booking.room_type)}
                          </Badge>
                          <Badge variant={isBookingToday ? "default" : "outline"} className={isBookingToday ? "bg-green-600" : ""}>
                            {isBookingToday ? '📍 Hoje' : bookingDateFormatted}
                          </Badge>
                          <span className="text-sm font-medium">
                            {booking.start_time.substring(0, 5)} - {booking.end_time.substring(0, 5)}
                          </span>
                        </div>
                        <p className="font-medium">{booking.full_name}</p>
                        <p className="text-sm text-muted-foreground">{booking.class_name}</p>
                      </div>
                    </div>
                    <div className="mt-3 p-3 bg-amber-100 dark:bg-amber-900/30 rounded-md">
                      <div className="flex items-start gap-2">
                        <MessageSquare className="h-4 w-4 text-amber-700 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-amber-800 dark:text-amber-300">
                          {booking.observations}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de agendamentos agrupados por data */}
      {sortedDates.map((date) => {
        const dateBookings = bookingsByDate[date];
        const isToday = date === todayStr;
        const formattedDate = format(new Date(date + 'T12:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR });
        const dateObservations = dateBookings.filter(b => b.observations && b.observations.trim());
        
        return (
          <div key={date} className="space-y-3">
            {/* Cabeçalho da data */}
            <div className={`flex items-center gap-3 p-3 rounded-lg ${isToday ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
              <CalendarIcon className={`h-5 w-5 ${isToday ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`} />
              <div className="flex-1">
                <p className={`font-semibold capitalize ${isToday ? 'text-green-700 dark:text-green-300' : ''}`}>
                  {isToday ? '📍 Hoje - ' : ''}{formattedDate}
                </p>
                <p className="text-xs text-muted-foreground">
                  {dateBookings.length} agendamento(s)
                  {dateObservations.length > 0 && (
                    <span className="text-amber-600 dark:text-amber-400 ml-2">
                      • {dateObservations.length} com solicitações
                    </span>
                  )}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>

            {/* Bookings do dia */}
            {dateBookings.map((booking) => {
              const isActive = isToday && isCurrentlyActive(booking.start_time, booking.end_time);
              const hasObservations = booking.observations && booking.observations.trim();
              
              return (
                <Card 
                  key={booking.id} 
                  className={`transition-all ml-4 ${isActive ? 'border-2 border-green-500 shadow-lg bg-green-50 dark:bg-green-950' : ''} ${hasObservations ? 'border-l-4 border-l-amber-500' : ''}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Badge className={getRoomTypeBadgeClass(booking.room_type)}>
                            {getRoomTypeLabel(booking.room_type)}
                          </Badge>
                          {isActive && (
                            <Badge className="bg-green-600 hover:bg-green-700 text-white animate-pulse">
                              EM USO AGORA
                            </Badge>
                          )}
                          {hasObservations && (
                            <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
                              <MessageSquare className="h-3 w-3 mr-1" />
                              Tem solicitação
                            </Badge>
                          )}
                        </div>
                        <h3 className="font-semibold text-lg">{booking.class_name}</h3>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {booking.start_time.substring(0, 5)} - {booking.end_time.substring(0, 5)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{booking.full_name}</span>
                      </div>
                    </div>
                    
                    {hasObservations && (
                      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-3 rounded-md">
                        <div className="flex items-start gap-2">
                          <MessageSquare className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">
                              Observações / Solicitações:
                            </p>
                            <p className="text-sm text-amber-800 dark:text-amber-300">
                              {booking.observations}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}