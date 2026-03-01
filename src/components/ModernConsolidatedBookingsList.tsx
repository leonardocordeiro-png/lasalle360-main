import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon } from '@/components/ui/calendar';
import { toast } from '@/hooks/use-toast';
import { 
  Clock, 
  X, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Laptop, 
  Users,
  Search,
  Filter,
  School,
  FlaskConical,
  Lightbulb,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  BarChart3,
  Eye,
  Archive,
  RefreshCw,
  RotateCcw,
  PackageCheck
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, addMonths, subMonths, isToday, isFuture, isPast, startOfDay, endOfDay } from 'date-fns';
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
  type?: 'chromebook' | 'room';
  room_type?: string;
  returned_at?: string;
  returned_by?: string;
}

interface GroupedByDate {
  date: string;
  dateFormatted: string;
  dayOfWeek: string;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
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
  type: 'chromebook' | 'room';
  room_type?: string;
  returned_at?: string;
  returned_by?: string;
}

interface ModernConsolidatedBookingsListProps {
  bookings: Booking[];
  onBookingCancelled: (bookingId: string) => void;
  isAdmin: boolean;
  currentUserId: string;
}

// Função para formatar nome do usuário (primeiro nome + último sobrenome)
const formatUserName = (fullName: string) => {
  if (!fullName) return '';
  
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} ${parts[1]}`;
  
  // Pega primeiro nome e último sobrenome
  return `${parts[0]} ${parts[parts.length - 1]}`;
};

export default function ModernConsolidatedBookingsList({ 
  bookings, 
  onBookingCancelled, 
  isAdmin, 
  currentUserId 
}: ModernConsolidatedBookingsListProps) {
  const [cancellingBookings, setCancellingBookings] = useState<Set<string>>(new Set());
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("all");

  // Lógica para determinar status real (incluindo devolvido automaticamente)
  const getRealStatus = (booking: Booking): string => {
    // Se já está marcado como devolvido, mantém
    if (booking.status === 'returned') return 'returned';
    
    // Se está cancelado, mantém
    if (booking.status === 'cancelled') return 'cancelled';
    
    // Se está ativo, verifica se já passou da data
    if (booking.status === 'active') {
      const bookingEndDateTime = new Date(`${booking.booking_date}T${booking.end_time}`);
      const now = new Date();
      
      // Se a data/hora do agendamento já passou, considera devolvido pelo sistema
      if (isPast(bookingEndDateTime)) {
        return 'returned_system';
      }
      
      // Se é hoje, considera ativo hoje
      const bookingDate = parseISO(booking.booking_date);
      if (isToday(bookingDate)) {
        return 'active_today';
      }
      
      // Se é futuro, considera ativo futuro
      if (isFuture(bookingDate)) {
        return 'active_future';
      }
    }
    
    return booking.status;
  };

  // Filtrar agendamentos pelo mês selecionado
  const filteredBookings = useMemo(() => {
    return bookings.filter(booking => {
      const bookingDate = parseISO(booking.booking_date);
      
      // Filtro de mês
      const monthStart = startOfMonth(selectedMonth);
      const monthEnd = endOfMonth(selectedMonth);
      if (!isWithinInterval(bookingDate, { start: monthStart, end: monthEnd })) {
        return false;
      }
      
      // Filtro de busca
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          booking.full_name.toLowerCase().includes(searchLower) ||
          booking.class_name.toLowerCase().includes(searchLower) ||
          booking.status.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }
      
      // Filtro de status (usando status real)
      const realStatus = getRealStatus(booking);
      if (statusFilter !== "all") {
        if (statusFilter === "active" && realStatus !== 'active') return false;
        if (statusFilter === "cancelled" && realStatus !== 'cancelled') return false;
        if (statusFilter === "returned" && !realStatus.includes('returned')) return false;
        if (statusFilter === "today" && !isToday(parseISO(booking.booking_date))) return false;
        if (statusFilter === "future" && !isFuture(parseISO(booking.booking_date))) return false;
        if (statusFilter === "past" && !isPast(parseISO(booking.booking_date))) return false;
      }
      
      // Filtro de tipo
      if (typeFilter !== "all") {
        if (typeFilter === "chromebook" && booking.type !== 'chromebook') return false;
        if (typeFilter === "room" && booking.type !== 'room') return false;
        if (typeFilter === "auditorio" && booking.room_type !== 'auditorio') return false;
        if (typeFilter === "laboratorio" && booking.room_type !== 'laboratorio') return false;
        if (typeFilter === "sala_criativa" && booking.room_type !== 'sala_criativa') return false;
      }
      
      return true;
    });
  }, [bookings, selectedMonth, searchTerm, statusFilter, typeFilter]);

  // Agrupar por data
  const groupedByDate = useMemo((): GroupedByDate[] => {
    const dateMap = new Map<string, Map<string, DayBooking>>();
    
    filteredBookings.forEach(booking => {
      const date = booking.booking_date;
      const realStatus = getRealStatus(booking);
      const key = `${booking.user_id}-${booking.quantity}-${realStatus}-${booking.type || 'chromebook'}`;
      
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
          status: realStatus,
          classes: [booking.class_name],
          timeRange: `${booking.start_time.substring(0, 5)} - ${booking.end_time.substring(0, 5)}`,
          bookingIds: [booking.id],
          type: booking.type || 'chromebook',
          room_type: booking.room_type,
          returned_at: booking.returned_at,
          returned_by: booking.returned_by
        });
      }
    });
    
    // Converter para array e ordenar por data
    return Array.from(dateMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, dayMap]) => {
        const dateObj = parseISO(date);
        return {
          date,
          dateFormatted: format(dateObj, "dd/MM", { locale: ptBR }),
          dayOfWeek: format(dateObj, "EEE", { locale: ptBR }),
          isToday: isToday(dateObj),
          isPast: isPast(dateObj) && !isToday(dateObj),
          isFuture: isFuture(dateObj),
          bookings: Array.from(dayMap.values())
        };
      });
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
      const table = dayBooking.type === 'room' ? 'room_bookings' : 'chromebook_bookings';
      const { error } = await supabase
        .from(table)
        .update({ status: 'cancelled' })
        .in('id', dayBooking.bookingIds);

      if (error) throw error;

      toast({
        title: "Cancelado",
        description: `${dayBooking.quantity} ${dayBooking.type === 'room' ? 'reserva(s)' : 'chromebook(s)'} cancelados`,
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
  const handleCurrentMonth = () => {
    setSelectedMonth(new Date());
  };

  // Estatísticas
  const stats = useMemo(() => {
    const total = filteredBookings.length;
    const active = filteredBookings.filter(b => getRealStatus(b) === 'active').length;
    const cancelled = filteredBookings.filter(b => getRealStatus(b) === 'cancelled').length;
    const returned = filteredBookings.filter(b => getRealStatus(b).includes('returned')).length;
    const chromebooks = filteredBookings.filter(b => b.type !== 'room').length;
    const rooms = filteredBookings.filter(b => b.type === 'room').length;
    
    return { total, active, cancelled, returned, chromebooks, rooms };
  }, [filteredBookings]);

  const getRoomIcon = (roomType?: string) => {
    switch (roomType) {
      case 'auditorio': return <School className="h-4 w-4" />;
      case 'laboratorio': return <FlaskConical className="h-4 w-4" />;
      case 'sala_criativa': return <Lightbulb className="h-4 w-4" />;
      default: return <Laptop className="h-4 w-4" />;
    }
  };

  const getRoomName = (roomType?: string) => {
    switch (roomType) {
      case 'auditorio': return 'Auditório';
      case 'laboratorio': return 'Laboratório';
      case 'sala_criativa': return 'Sala Criativa';
      default: return 'Chromebooks';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'active_today': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'active_future': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-300';
      case 'returned': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'returned_system': return 'bg-amber-100 text-amber-800 border-amber-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle2 className="h-3 w-3" />;
      case 'active_today': return <CheckCircle2 className="h-3 w-3" />;
      case 'active_future': return <CheckCircle2 className="h-3 w-3" />;
      case 'cancelled': return <XCircle className="h-3 w-3" />;
      case 'returned': return <PackageCheck className="h-3 w-3" />;
      case 'returned_system': return <PackageCheck className="h-3 w-3" />;
      default: return <AlertCircle className="h-3 w-3" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'active_today': return 'Ativo';
      case 'active_future': return 'Ativo';
      case 'cancelled': return 'Cancelado';
      case 'returned': return 'Devolvido';
      case 'returned_system': return 'Devolvido';
      default: return status;
    }
  };

  return (
    <div className="space-y-5">
      {/* Header with Gradient + Stats */}
      <Card className="border-0 shadow-xl overflow-hidden bg-card/95 backdrop-blur-sm">
        <div className="bg-gradient-to-br from-indigo-600 via-indigo-500 to-purple-500 dark:from-indigo-700 dark:via-indigo-600 dark:to-purple-600 p-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">Todos os Agendamentos</h3>
                <p className="text-[11px] text-white/70 font-medium">Visualização completa de Chromebooks e Salas</p>
              </div>
            </div>
            
            {/* Stats Pills */}
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/15 backdrop-blur-sm rounded-xl">
                <span className="text-lg font-black text-white">{stats.total}</span>
                <span className="text-[10px] text-white/70 font-medium">Total</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/15 backdrop-blur-sm rounded-xl">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-lg font-black text-white">{stats.active}</span>
                <span className="text-[10px] text-white/70 font-medium">Ativos</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/15 backdrop-blur-sm rounded-xl">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                <span className="text-lg font-black text-white">{stats.returned}</span>
                <span className="text-[10px] text-white/70 font-medium">Devolvidos</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/15 backdrop-blur-sm rounded-xl">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                <span className="text-lg font-black text-white">{stats.cancelled}</span>
                <span className="text-[10px] text-white/70 font-medium">Cancelados</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="p-4 border-t border-border/30">
          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap items-start md:items-center">
            <div className="relative flex-1 md:flex-initial md:w-1/4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por usuário, turma..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-muted/20 rounded-xl border-border/40 h-9 text-sm"
              />
            </div>

            {/* Status Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="rounded-xl border-border/40 h-9 text-sm">
                  <Filter className="h-3.5 w-3.5 mr-1.5" />
                  {statusFilter === "all" && "Todos Status"}
                  {statusFilter === "active" && "Ativos"}
                  {statusFilter === "returned" && "Devolvidos"}
                  {statusFilter === "cancelled" && "Cancelados"}
                  {statusFilter === "today" && "Hoje"}
                  {statusFilter === "future" && "Futuros"}
                  {statusFilter === "past" && "Passados"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setStatusFilter("all")}>Todos Status</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("active")}>Ativos</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("returned")}>Devolvidos</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("cancelled")}>Cancelados</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("today")}>Hoje</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("future")}>Futuros</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("past")}>Passados</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Type Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="rounded-xl border-border/40 h-9 text-sm">
                  <Filter className="h-3.5 w-3.5 mr-1.5" />
                  {typeFilter === "all" && "Todos Tipos"}
                  {typeFilter === "chromebook" && "Chromebooks"}
                  {typeFilter === "room" && "Salas"}
                  {typeFilter === "auditorio" && "Auditório"}
                  {typeFilter === "laboratorio" && "Laboratório"}
                  {typeFilter === "sala_criativa" && "Sala Criativa"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setTypeFilter("all")}>Todos Tipos</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeFilter("chromebook")}>Chromebooks</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeFilter("room")}>Salas</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeFilter("auditorio")}>Auditório</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeFilter("laboratorio")}>Laboratório</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeFilter("sala_criativa")}>Sala Criativa</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </Card>

      {/* Month Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePreviousMonth} className="h-8 w-8 rounded-lg border-border/40">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" onClick={handleCurrentMonth} className="h-8 px-4 text-sm font-semibold rounded-lg capitalize">
            {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
          </Button>
          <Button variant="outline" size="icon" onClick={handleNextMonth} className="h-8 w-8 rounded-lg border-border/40">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground bg-muted/30 px-2.5 py-1 rounded-lg">
          <Eye className="h-3 w-3" />
          <span className="font-medium">{filteredBookings.length} agendamentos</span>
        </div>
      </div>

      {/* Bookings List */}
      {groupedByDate.length === 0 ? (
        <Card className="border-0 shadow-xl overflow-hidden bg-card/95 backdrop-blur-sm">
          <CardContent className="py-16">
            <div className="text-center text-muted-foreground">
              <div className="h-16 w-16 rounded-2xl bg-muted/40 flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="font-semibold text-sm">Nenhum agendamento encontrado</p>
              <p className="text-[12px] mt-1.5 text-muted-foreground/70 max-w-[260px] mx-auto leading-relaxed">
                {searchTerm || statusFilter !== "all" || typeFilter !== "all"
                  ? "Tente ajustar os filtros ou busca"
                  : `Nenhum agendamento em ${format(selectedMonth, "MMMM", { locale: ptBR })}`
                }
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groupedByDate.map((dateGroup) => (
            <Card key={dateGroup.date} className="border-0 shadow-xl overflow-hidden bg-card/95 backdrop-blur-sm">
              {/* Date Header */}
              <div className="relative overflow-hidden">
                {/* Left accent bar for date header */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                  dateGroup.isToday 
                    ? 'bg-blue-500'
                    : dateGroup.isFuture
                    ? 'bg-emerald-500'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`} />
                <div className={`pl-5 pr-5 py-3.5 ${
                  dateGroup.isToday 
                    ? 'bg-gradient-to-r from-blue-50/80 to-indigo-50/40 dark:from-blue-950/30 dark:to-indigo-950/15'
                    : dateGroup.isFuture
                    ? 'bg-gradient-to-r from-emerald-50/80 to-green-50/40 dark:from-emerald-950/30 dark:to-green-950/15'
                    : 'bg-muted/20'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        dateGroup.isToday 
                          ? 'bg-blue-100 dark:bg-blue-900/50'
                          : dateGroup.isFuture
                          ? 'bg-emerald-100 dark:bg-emerald-900/50'
                          : 'bg-muted/50'
                      }`}>
                        <Calendar className={`h-4 w-4 ${
                          dateGroup.isToday 
                            ? 'text-blue-600 dark:text-blue-400'
                            : dateGroup.isFuture
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-muted-foreground'
                        }`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{dateGroup.dateFormatted}</span>
                          <span className="text-[11px] text-muted-foreground capitalize">{dateGroup.dayOfWeek}</span>
                          {dateGroup.isToday && (
                            <Badge className="text-[9px] px-1.5 py-0 h-4 rounded bg-blue-500 text-white border-0 font-semibold">
                              Hoje
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 rounded-md font-medium border-border/50">
                      {dateGroup.bookings.length} agendamento{dateGroup.bookings.length > 1 ? 's' : ''}
                    </Badge>
                  </div>
                </div>
              </div>
              
              {/* Day Bookings */}
              <CardContent className="p-0">
                <div className="divide-y divide-border/30">
                  {dateGroup.bookings.map((booking, idx) => {
                    const realStatus = getRealStatus(booking);
                    const getTypeIconBg = () => {
                      if (booking.room_type === 'auditorio') return 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400';
                      if (booking.room_type === 'laboratorio') return 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400';
                      if (booking.room_type === 'sala_criativa') return 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400';
                      return 'bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400';
                    };
                    const getAccentColor = () => {
                      if (realStatus === 'cancelled') return 'bg-red-300';
                      if (realStatus.includes('returned')) return 'bg-blue-300';
                      if (realStatus === 'active_today') return 'bg-emerald-400';
                      if (realStatus === 'active_future') return 'bg-blue-400';
                      return 'bg-emerald-400';
                    };

                    return (
                      <div
                        key={`${booking.user_id}-${idx}`}
                        className={`relative overflow-hidden transition-all duration-150 ${
                          realStatus === 'cancelled' 
                            ? 'opacity-45' 
                            : realStatus.includes('returned')
                            ? 'opacity-70'
                            : 'hover:bg-muted/20'
                        }`}
                      >
                        {/* Left accent */}
                        <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${getAccentColor()}`} />

                        <div className="pl-4 pr-4 py-3.5">
                          <div className="flex items-start gap-3">
                            {/* Type Icon */}
                            <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${getTypeIconBg()}`}>
                              {getRoomIcon(booking.room_type)}
                            </div>
                            
                            {/* Main Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-bold text-[13px] truncate">
                                      {getRoomName(booking.room_type)}
                                    </h4>
                                    <Badge 
                                      variant="outline" 
                                      className={`text-[9px] px-1.5 py-0 h-4 rounded-md font-semibold border flex items-center gap-0.5 ${getStatusColor(realStatus)}`}
                                    >
                                      {getStatusIcon(realStatus)}
                                      {getStatusText(realStatus)}
                                    </Badge>
                                  </div>
                                  
                                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground mb-1.5">
                                    <span className="flex items-center gap-1 bg-muted/30 px-2 py-0.5 rounded">
                                      <Clock className="h-2.5 w-2.5" />
                                      <span className="font-mono font-medium">{booking.timeRange}</span>
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Users className="h-2.5 w-2.5" />
                                      <span className="font-medium truncate">{formatUserName(booking.full_name)}</span>
                                    </span>
                                  </div>
                                  
                                  {/* Return info */}
                                  {realStatus.includes('returned') && (
                                    <div className="flex items-center gap-1.5 text-[10px] text-blue-600 dark:text-blue-400 mb-1.5">
                                      <PackageCheck className="h-2.5 w-2.5" />
                                      <span>
                                        Devolvido por {booking.returned_by ? formatUserName(booking.returned_by) : 'sistema'}
                                        {booking.returned_at && (
                                          <span> em {format(parseISO(booking.returned_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                                        )}
                                      </span>
                                    </div>
                                  )}
                                  
                                  <div className="flex items-center gap-1.5">
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 rounded font-medium">
                                      {booking.classes.length === 1 
                                        ? booking.classes[0] 
                                        : `${booking.classes.length} turmas`}
                                    </Badge>
                                    {booking.classes.length > 1 && (
                                      <span className="text-[10px] text-muted-foreground hidden sm:inline truncate">
                                        {booking.classes.join(', ')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Quantity + Actions */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <div className="text-right">
                                    <div className="text-lg font-black text-primary leading-tight">
                                      {booking.quantity}
                                    </div>
                                    <div className="text-[9px] text-muted-foreground font-medium">
                                      {booking.type === 'room' ? 'reserva(s)' : 'un.'}
                                    </div>
                                  </div>
                                  
                                  {canCancel(booking) && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleCancelBooking(booking)}
                                      disabled={isCancelling(booking)}
                                      className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                    >
                                      {isCancelling(booking) ? (
                                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <X className="h-3.5 w-3.5" />
                                      )}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
