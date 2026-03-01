import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, User, Calendar as CalendarIcon, MessageSquare, AlertTriangle, School, FlaskConical, Lightbulb, Key, MapPin, Layers } from 'lucide-react';
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

  const getRoomIcon = (type: string) => {
    if (type === 'auditorio') return <School className="h-4 w-4" />;
    if (type === 'laboratorio') return <FlaskConical className="h-4 w-4" />;
    if (type === 'sala_criativa') return <Lightbulb className="h-4 w-4" />;
    return <MapPin className="h-4 w-4" />;
  };

  const getRoomAccentColor = (type: string) => {
    if (type === 'auditorio') return 'bg-blue-500';
    if (type === 'laboratorio') return 'bg-purple-500';
    if (type === 'sala_criativa') return 'bg-amber-500';
    return 'bg-gray-500';
  };

  const getRoomIconContainerClass = (type: string) => {
    if (type === 'auditorio') return 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400';
    if (type === 'laboratorio') return 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400';
    if (type === 'sala_criativa') return 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400';
    return 'bg-gray-100 dark:bg-gray-900/50 text-gray-600 dark:text-gray-400';
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-border/40 p-4">
              <Skeleton className="h-4 w-16 mb-2" />
              <Skeleton className="h-8 w-10" />
            </div>
          ))}
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-border/40 p-4 space-y-2">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          </div>
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
      {/* Period Filter + Counter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Tabs value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)} className="w-full sm:w-auto">
          <TabsList className="grid w-full sm:w-auto grid-cols-3 bg-muted/50 backdrop-blur-sm rounded-xl p-1 h-auto">
            <TabsTrigger value="today" className="text-xs sm:text-sm rounded-lg py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5 hidden sm:block" />
              Hoje
            </TabsTrigger>
            <TabsTrigger value="week" className="text-xs sm:text-sm rounded-lg py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm gap-1.5">
              <Layers className="h-3.5 w-3.5 hidden sm:block" />
              Próx. 7 dias
            </TabsTrigger>
            <TabsTrigger value="month" className="text-xs sm:text-sm rounded-lg py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm gap-1.5">
              <Layers className="h-3.5 w-3.5 hidden sm:block" />
              Próx. 30 dias
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary">
            <Key className="h-3 w-3" />
          </div>
          <p className="text-xs font-medium text-muted-foreground">
            <span className="text-foreground font-bold">{groupedBookings.length}</span> reserva(s) {getFilterLabel()}
          </p>
        </div>
      </div>

      {/* Empty State */}
      {bookings.length === 0 && !loading && (
        <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-muted/30 via-background to-muted/20 p-10 text-center">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          <div className="relative">
            <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-muted/60 flex items-center justify-center">
              <CalendarIcon className="h-8 w-8 text-muted-foreground/60" />
            </div>
            <p className="text-base font-semibold text-muted-foreground">
              Nenhum agendamento {getFilterLabel()}
            </p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Não há salas reservadas para o período selecionado
            </p>
          </div>
        </div>
      )}

      {/* Room Stats Cards */}
      {groupedBookings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Auditório */}
          <div className="relative overflow-hidden rounded-xl border border-blue-200/60 dark:border-blue-800/40 bg-gradient-to-br from-blue-50 via-blue-50/50 to-white dark:from-blue-950/40 dark:via-blue-950/20 dark:to-background p-4 transition-all duration-200 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700">
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center ring-2 ring-blue-200/50 dark:ring-blue-800/30 flex-shrink-0">
                <School className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-blue-600/70 dark:text-blue-400/70 font-semibold">Auditório</p>
                <p className="text-2xl font-black text-blue-600 dark:text-blue-400 leading-tight">{auditorioCount}</p>
              </div>
            </div>
          </div>

          {/* Laboratório */}
          <div className="relative overflow-hidden rounded-xl border border-purple-200/60 dark:border-purple-800/40 bg-gradient-to-br from-purple-50 via-purple-50/50 to-white dark:from-purple-950/40 dark:via-purple-950/20 dark:to-background p-4 transition-all duration-200 hover:shadow-md hover:border-purple-300 dark:hover:border-purple-700">
            <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center ring-2 ring-purple-200/50 dark:ring-purple-800/30 flex-shrink-0">
                <FlaskConical className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-purple-600/70 dark:text-purple-400/70 font-semibold">Laboratório</p>
                <p className="text-2xl font-black text-purple-600 dark:text-purple-400 leading-tight">{laboratorioCount}</p>
              </div>
            </div>
          </div>

          {/* Sala Criativa */}
          <div className="relative overflow-hidden rounded-xl border border-amber-200/60 dark:border-amber-800/40 bg-gradient-to-br from-amber-50 via-amber-50/50 to-white dark:from-amber-950/40 dark:via-amber-950/20 dark:to-background p-4 transition-all duration-200 hover:shadow-md hover:border-amber-300 dark:hover:border-amber-700">
            <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center ring-2 ring-amber-200/50 dark:ring-amber-800/30 flex-shrink-0">
                <Lightbulb className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-amber-600/70 dark:text-amber-400/70 font-semibold">Sala Criativa</p>
                <p className="text-2xl font-black text-amber-600 dark:text-amber-400 leading-tight">{salaCriativaCount}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Special Requests Alert */}
      {bookingsWithObservations.length > 0 && (
        <div className="relative overflow-hidden rounded-xl border border-amber-200/60 dark:border-amber-800/40 bg-gradient-to-r from-amber-50 to-orange-50/50 dark:from-amber-950/30 dark:to-orange-950/20 p-3.5">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                {bookingsWithObservations.length} reserva(s) com solicitações especiais
              </span>
              <p className="text-[11px] text-amber-600/70 dark:text-amber-400/60">Verifique as observações nos agendamentos abaixo</p>
            </div>
          </div>
        </div>
      )}

      {/* Bookings List grouped by date */}
      {sortedDates.map((date) => {
        const dateBookings = bookingsByDate[date];
        const isToday = date === todayStr;
        const formattedDate = format(new Date(date + 'T12:00:00'), "EEEE, dd/MM", { locale: ptBR });
        
        return (
          <div key={date} className="space-y-3">
            {/* Date Section Header */}
            {(sortedDates.length > 1 || !isToday) && (
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold ${
                  isToday 
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' 
                    : 'bg-muted/60 text-muted-foreground'
                }`}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  <span className="capitalize">{isToday ? 'Hoje' : formattedDate}</span>
                </div>
                <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 rounded-md font-medium border-border/50">
                  {dateBookings.length} reserva{dateBookings.length > 1 ? 's' : ''}
                </Badge>
                <div className="flex-1 h-px bg-border/40" />
              </div>
            )}

            {/* Booking Cards */}
            <div className="space-y-2.5">
              {dateBookings.map((booking) => {
                const isActive = isCurrentlyActive(booking.booking_date, booking.start_time, booking.end_time);
                const hasObservations = booking.observations.length > 0;
                const uniqueObservations = [...new Set(booking.observations)];
                
                return (
                  <div 
                    key={booking.ids.join('-')} 
                    className={`group relative overflow-hidden rounded-xl border transition-all duration-200 ${
                      isActive 
                        ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-md shadow-emerald-500/10' 
                        : 'border-border/40 bg-card/50 hover:bg-card/80 hover:shadow-sm hover:border-border/60'
                    }`}
                  >
                    {/* Left Accent Bar */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l ${
                      isActive ? 'bg-emerald-500' : getRoomAccentColor(booking.room_type)
                    }`} />

                    <div className="pl-4 pr-4 py-3.5">
                      <div className="flex items-start gap-3">
                        {/* Room Icon */}
                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors duration-200 ${
                          isActive 
                            ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400' 
                            : getRoomIconContainerClass(booking.room_type)
                        }`}>
                          {getRoomIcon(booking.room_type)}
                        </div>
                        
                        {/* Main Content */}
                        <div className="flex-1 min-w-0">
                          {/* Top Row: Name + Badges */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm truncate">{booking.full_name}</span>
                            {isActive && (
                              <span className="relative flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded-md">
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-600" />
                                </span>
                                EM USO
                              </span>
                            )}
                            {booking.slots_count > 1 && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 rounded-md border-border/50 font-medium">
                                <Layers className="h-2.5 w-2.5 mr-0.5" />
                                {booking.slots_count}h
                              </Badge>
                            )}
                          </div>
                          
                          {/* Info Row */}
                          <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                            <Badge className={`${getRoomTypeBadgeClass(booking.room_type)} text-[10px] px-2 py-0 h-5 rounded-md font-semibold`}>
                              {getRoomTypeLabel(booking.room_type)}
                            </Badge>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                              <Clock className="h-3 w-3" />
                              {booking.start_time.substring(0, 5)} - {booking.end_time.substring(0, 5)}
                            </span>
                            {booking.class_name && (
                              <span className="text-xs text-muted-foreground/80">{booking.class_name}</span>
                            )}
                          </div>
                          
                          {/* Observations */}
                          {hasObservations && (
                            <div className="mt-2.5 p-2.5 bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/40 dark:border-amber-800/30 rounded-lg">
                              <div className="flex items-start gap-1.5">
                                <MessageSquare className="h-3 w-3 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                                <span className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">{uniqueObservations.join(' | ')}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
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