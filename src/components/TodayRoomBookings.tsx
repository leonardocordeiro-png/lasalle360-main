import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, User, Calendar as CalendarIcon, MessageSquare, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

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

export function TodayRoomBookings() {
  const [bookings, setBookings] = useState<RoomBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTodayBookings();
    
    // Set up realtime subscription
    const channel = supabase
      .channel('today-room-bookings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_bookings'
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
      setLoading(true);
      const today = format(new Date(), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('room_bookings')
        .select('*')
        .eq('booking_date', today)
        .eq('status', 'active')
        .order('start_time', { ascending: true });

      if (error) throw error;
      
      setBookings(data || []);
    } catch (error: any) {
      console.error('Error fetching today bookings:', error);
    } finally {
      setLoading(false);
    }
  };

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

  if (bookings.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium text-muted-foreground">
            Nenhum agendamento para hoje
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Não há salas reservadas para o dia de hoje
          </p>
        </CardContent>
      </Card>
    );
  }

  const auditorioBookings = bookings.filter(b => b.room_type === 'auditorio');
  const laboratorioBookings = bookings.filter(b => b.room_type === 'laboratorio');
  const salaCriativaBookings = bookings.filter(b => b.room_type === 'sala_criativa');
  const bookingsWithObservations = bookings.filter(b => b.observations && b.observations.trim());

  return (
    <div className="space-y-6">
      {/* Resumo do dia */}
      <Card className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Agendamentos de Hoje - {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
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
              Os agendamentos abaixo possuem observações ou solicitações de recursos. Verifique antes de liberar as chaves.
            </p>
            <div className="space-y-3">
              {bookingsWithObservations.map((booking) => (
                <div 
                  key={booking.id} 
                  className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-amber-200 dark:border-amber-700"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getRoomTypeBadgeClass(booking.room_type)}>
                          {getRoomTypeLabel(booking.room_type)}
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
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de todos os agendamentos */}
      <div className="space-y-3">
        {bookings.map((booking) => {
          const isActive = isCurrentlyActive(booking.start_time, booking.end_time);
          const hasObservations = booking.observations && booking.observations.trim();
          
          return (
            <Card 
              key={booking.id} 
              className={`transition-all ${isActive ? 'border-2 border-green-500 shadow-lg bg-green-50 dark:bg-green-950' : ''} ${hasObservations ? 'border-l-4 border-l-amber-500' : ''}`}
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
    </div>
  );
}