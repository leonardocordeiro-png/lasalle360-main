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
    <div className="space-y-6">
      {/* Header com Estatísticas */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-background">
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-xl">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">Todos os Agendamentos</CardTitle>
                <CardDescription>
                  Visualização completa de Chromebooks e Salas
                </CardDescription>
              </div>
            </div>
            
            {/* Estatísticas */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{stats.total}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-600">{stats.active}</div>
                <div className="text-xs text-muted-foreground">Ativos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.returned}</div>
                <div className="text-xs text-muted-foreground">Devolvidos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.cancelled}</div>
                <div className="text-xs text-muted-foreground">Cancelados</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.chromebooks}</div>
                <div className="text-xs text-muted-foreground">Chromebooks</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{stats.rooms}</div>
                <div className="text-xs text-muted-foreground">Salas</div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Super Mega Filters */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="p-4 flex flex-col gap-3 md:flex-row md:flex-wrap items-start md:items-center">
          <div className="relative flex-1 md:flex-initial md:w-1/4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por usuário, turma ou status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-background"
            />
          </div>

          {/* Status Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
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
              <DropdownMenuItem onClick={() => setStatusFilter("all")}>
                Todos Status
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("active")}>
                Ativos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("returned")}>
                Devolvidos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("cancelled")}>
                Cancelados
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("today")}>
                Hoje
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("future")}>
                Futuros
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("past")}>
                Passados
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Type Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                {typeFilter === "all" && "Todos Tipos"}
                {typeFilter === "chromebook" && "Chromebooks"}
                {typeFilter === "room" && "Salas"}
                {typeFilter === "auditorio" && "Auditório"}
                {typeFilter === "laboratorio" && "Laboratório"}
                {typeFilter === "sala_criativa" && "Sala Criativa"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setTypeFilter("all")}>
                Todos Tipos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTypeFilter("chromebook")}>
                Chromebooks
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTypeFilter("room")}>
                Salas
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTypeFilter("auditorio")}>
                Auditório
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTypeFilter("laboratorio")}>
                Laboratório
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTypeFilter("sala_criativa")}>
                Sala Criativa
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Navegação de Mês */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={handlePreviousMonth} className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <Button variant="ghost" onClick={handleCurrentMonth} className="h-8 px-4 text-sm font-medium">
                {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
              </Button>
              
              <Button variant="ghost" size="icon" onClick={handleNextMonth} className="h-8 w-8">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Eye className="h-4 w-4" />
              <span>{filteredBookings.length} agendamentos</span>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Lista de Agendamentos */}
      {groupedByDate.length === 0 ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p className="text-lg font-medium mb-2">Nenhum agendamento encontrado</p>
              <p className="text-sm">
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
            <Card key={dateGroup.date} className="border-0 shadow-lg overflow-hidden">
              {/* Cabeçalho da Data */}
              <div className={`px-6 py-4 ${
                dateGroup.isToday 
                  ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-blue-200 dark:border-blue-800'
                  : dateGroup.isFuture
                  ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-b border-green-200 dark:border-green-800'
                  : 'bg-muted/30 border-b border-border'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      dateGroup.isToday 
                        ? 'bg-blue-100 dark:bg-blue-900'
                        : dateGroup.isFuture
                        ? 'bg-green-100 dark:bg-green-900'
                        : 'bg-gray-100 dark:bg-gray-800'
                    }`}>
                      <Calendar className={`h-5 w-5 ${
                        dateGroup.isToday 
                          ? 'text-blue-600 dark:text-blue-400'
                          : dateGroup.isFuture
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-gray-600 dark:text-gray-400'
                      }`} />
                    </div>
                    <div>
                      <div className="text-lg font-semibold">
                        {dateGroup.dateFormatted}
                      </div>
                      <div className="text-sm text-muted-foreground capitalize">
                        {dateGroup.dayOfWeek}
                        {dateGroup.isToday && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            Hoje
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {dateGroup.bookings.length} agendamento(s)
                  </div>
                </div>
              </div>
              
              {/* Bookings do dia */}
              <CardContent className="p-0">
                <div className="divide-y divide-border/50">
                  {dateGroup.bookings.map((booking, idx) => (
                    <div
                      key={`${booking.user_id}-${idx}`}
                      className={`p-4 transition-colors ${
                        getRealStatus(booking) === 'cancelled' 
                          ? 'opacity-50 bg-gray-50/50' 
                          : getRealStatus(booking).includes('returned')
                          ? 'opacity-75 bg-blue-50/30'
                          : 'hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Tipo e Ícone */}
                        <div className="flex-shrink-0">
                          <div className={`p-2 rounded-lg ${
                            booking.type === 'room' 
                              ? 'bg-purple-100 dark:bg-purple-900'
                              : 'bg-blue-100 dark:bg-blue-900'
                          }`}>
                            {getRoomIcon(booking.room_type)}
                          </div>
                        </div>
                        
                        {/* Informações Principais */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium truncate">
                                  {getRoomName(booking.room_type)}
                                </h4>
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${getStatusColor(getRealStatus(booking))}`}
                                >
                                  <span className="flex items-center gap-1">
                                    {getStatusIcon(getRealStatus(booking))}
                                    {getStatusText(getRealStatus(booking))}
                                  </span>
                                </Badge>
                              </div>
                              
                              <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  <span className="font-mono">{booking.timeRange}</span>
                                </span>
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  <span className="truncate">{formatUserName(booking.full_name)}</span>
                                </span>
                              </div>
                              
                              {/* Informações de devolução */}
                              {getRealStatus(booking).includes('returned') && (
                                <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 mb-2">
                                  <PackageCheck className="h-3 w-3" />
                                  <span>
                                    Devolvido por {booking.returned_by ? formatUserName(booking.returned_by) : 'sistema'}
                                    {booking.returned_at && (
                                      <span> em {format(parseISO(booking.returned_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                                    )}
                                  </span>
                                </div>
                              )}
                              
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs">
                                  {booking.classes.length === 1 
                                    ? booking.classes[0] 
                                    : `${booking.classes.length} turmas`}
                                </Badge>
                                {booking.classes.length > 1 && (
                                  <span className="text-xs text-muted-foreground hidden sm:inline">
                                    {booking.classes.join(', ')}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* Quantidade e Ações */}
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <div className="text-right">
                                <div className="text-lg font-semibold text-primary">
                                  {booking.quantity}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {booking.type === 'room' ? 'reserva(s)' : 'un.'}
                                </div>
                              </div>
                              
                              {canCancel(booking) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCancelBooking(booking)}
                                  disabled={isCancelling(booking)}
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                >
                                  {isCancelling(booking) ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <X className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
