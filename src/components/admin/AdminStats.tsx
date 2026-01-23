import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Calendar, 
  Laptop, 
  TrendingUp, 
  Shield, 
  Clock, 
  Activity,
  AlertCircle,
  CheckCircle,
  XCircle,
  ChevronUp,
  ChevronDown,
  MoreHorizontal,
  BarChart3,
  PieChart,
  RefreshCw,
  Zap
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

interface Stats {
  totalUsers: number;
  adminUsers: number;
  totalBookings: number;
  activeBookings: number;
  cancelledBookings: number;
  todayBookings: number;
  weekBookings: number;
  monthBookings: number;
  chromeUsageToday: number;
  peakUsageTime: string;
  averageBookingDuration: number;
  newUsersThisMonth: number;
}

interface BookingTrend {
  date: string;
  count: number;
  status: string;
}

export default function AdminStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [bookingTrends, setBookingTrends] = useState<BookingTrend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchBookingTrends();
  }, []);

  const fetchStats = async () => {
    try {
      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');
      const weekAgo = format(subDays(now, 7), 'yyyy-MM-dd');
      const monthAgo = format(subDays(now, 30), 'yyyy-MM-dd');

      // Otimização: executar TODAS as queries em paralelo
      const [
        totalUsersResult,
        adminRolesResult,
        newUsersResult,
        totalBookingsResult,
        activeBookingsResult,
        cancelledBookingsResult,
        todayBookingsResult,
        weekBookingsResult,
        monthBookingsResult,
        avgDurationResult
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('user_roles').select('user_id').eq('role', 'admin'),
        supabase.from('profiles').select('user_id').gte('created_at', monthAgo),
        supabase.from('chromebook_bookings').select('*', { count: 'exact', head: true }),
        supabase.from('chromebook_bookings').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('chromebook_bookings').select('*', { count: 'exact', head: true }).eq('status', 'cancelled'),
        supabase.from('chromebook_bookings').select('quantity, start_time, end_time').eq('booking_date', today).eq('status', 'active'),
        supabase.from('chromebook_bookings').select('*', { count: 'exact', head: true }).gte('booking_date', weekAgo).lte('booking_date', today),
        supabase.from('chromebook_bookings').select('*', { count: 'exact', head: true }).gte('booking_date', monthAgo).lte('booking_date', today),
        supabase.from('chromebook_bookings').select('start_time, end_time').limit(500)
      ]);

      const totalUsers = totalUsersResult.count || 0;
      const adminUsers = adminRolesResult.data?.length || 0;
      const newUsersThisMonth = newUsersResult.data?.length || 0;

      const totalBookings = totalBookingsResult.count || 0;
      const activeBookings = activeBookingsResult.count || 0;
      const cancelledBookings = cancelledBookingsResult.count || 0;
      
      const todayBookingsData = todayBookingsResult.data || [];
      const todayBookings = todayBookingsData.length;
      const weekBookings = weekBookingsResult.count || 0;
      const monthBookings = monthBookingsResult.count || 0;
      const allBookingsForAvg = avgDurationResult.data || [];

      // Calculate chrome usage today
      const chromeUsageToday = todayBookingsData?.reduce((sum, b) => sum + b.quantity, 0) || 0;

      // Find peak usage time (simplified)
      const timeSlots = todayBookingsData?.reduce((acc, booking) => {
        const hour = booking.start_time.split(':')[0];
        acc[hour] = (acc[hour] || 0) + booking.quantity;
        return acc;
      }, {} as Record<string, number>) || {};

      const peakHour = Object.entries(timeSlots).sort(([,a], [,b]) => b - a)[0]?.[0];
      const peakUsageTime = peakHour ? `${peakHour}:00` : 'N/A';

      // Calculate average booking duration (in hours)
      const averageBookingDuration = allBookingsForAvg?.reduce((sum, booking) => {
        const start = new Date(`1970-01-01T${booking.start_time}`);
        const end = new Date(`1970-01-01T${booking.end_time}`);
        const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        return sum + duration;
      }, 0) / (allBookingsForAvg?.length || 1) || 0;

      setStats({
        totalUsers,
        adminUsers,
        totalBookings,
        activeBookings,
        cancelledBookings,
        todayBookings,
        weekBookings,
        monthBookings,
        chromeUsageToday,
        peakUsageTime,
        averageBookingDuration,
        newUsersThisMonth
      });

    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBookingTrends = async () => {
    try {
      const { data: bookings, error } = await supabase
        .from('chromebook_bookings')
        .select('booking_date, status')
        .gte('booking_date', format(subDays(new Date(), 30), 'yyyy-MM-dd'))
        .order('booking_date', { ascending: true });

      if (error) throw error;

      // Group bookings by date and status
      const trends = bookings.reduce((acc, booking) => {
        const key = `${booking.booking_date}-${booking.status}`;
        if (!acc[key]) {
          acc[key] = {
            date: booking.booking_date,
            status: booking.status,
            count: 0
          };
        }
        acc[key].count++;
        return acc;
      }, {} as Record<string, BookingTrend>);

      setBookingTrends(Object.values(trends));
    } catch (error) {
      console.error('Error fetching booking trends:', error);
    }
  };

  // Prepare chart data
  const bookingStatusData = stats ? [
    { name: 'Ativos', value: stats.activeBookings, color: '#10B981' },
    { name: 'Cancelados', value: stats.cancelledBookings, color: '#EF4444' },
  ] : [];

  const periodData = stats ? [
    { name: 'Hoje', value: stats.todayBookings, fill: '#8B5CF6' },
    { name: 'Semana', value: stats.weekBookings, fill: '#06B6D4' },
    { name: 'Mês', value: stats.monthBookings, fill: '#F59E0B' },
  ] : [];

  const userDistributionData = stats ? [
    { name: 'Administradores', value: stats.adminUsers, color: '#8B5CF6' },
    { name: 'Usuários', value: stats.totalUsers - stats.adminUsers, color: '#06B6D4' },
  ] : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando estatísticas...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">Erro ao carregar estatísticas</h3>
        <p className="text-muted-foreground">Tente recarregar a página.</p>
      </div>
    );
  }

  const utilizationRate = Math.round((stats.chromeUsageToday / 200) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Estatísticas do Sistema</h2>
          <p className="text-sm text-muted-foreground mt-1">Visão geral de uso e atividade</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => { setLoading(true); fetchStats(); fetchBookingTrends(); }}
          className="h-9"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {/* Overview Cards - Modern Gradient Style */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-violet-100 text-sm font-medium">Total Usuários</p>
                <p className="text-2xl font-bold mt-1">{stats.totalUsers.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              <Shield className="h-4 w-4" />
              <span className="text-sm">{stats.adminUsers} administradores</span>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-sm font-medium">Agendamentos Ativos</p>
                <p className="text-2xl font-bold mt-1">{stats.activeBookings.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <CheckCircle className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              <ChevronUp className="h-4 w-4" />
              <span className="text-sm">de {stats.totalBookings} total</span>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-cyan-500 to-blue-500 text-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-cyan-100 text-sm font-medium">Chromebooks Hoje</p>
                <p className="text-2xl font-bold mt-1">{stats.chromeUsageToday.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Laptop className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              <Zap className="h-4 w-4" />
              <span className="text-sm">{utilizationRate}% utilização</span>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-sm font-medium">Novos Usuários</p>
                <p className="text-2xl font-bold mt-1">{stats.newUsersThisMonth.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">últimos 30 dias</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Booking Period Chart */}
        <Card className="overflow-hidden border-0 shadow-lg bg-white dark:bg-neutral-900">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-violet-500" />
                <CardTitle className="text-lg font-semibold">Agendamentos por Período</CardTitle>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={periodData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={60} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} 
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {periodData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
              <div className="text-center">
                <p className="text-2xl font-bold text-violet-500">{stats.todayBookings}</p>
                <p className="text-xs text-muted-foreground">Hoje</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-cyan-500">{stats.weekBookings}</p>
                <p className="text-xs text-muted-foreground">Esta Semana</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-500">{stats.monthBookings}</p>
                <p className="text-xs text-muted-foreground">Este Mês</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Distribution Chart */}
        <Card className="overflow-hidden border-0 shadow-lg bg-white dark:bg-neutral-900">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-emerald-500" />
                <CardTitle className="text-lg font-semibold">Status dos Agendamentos</CardTitle>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="h-[180px] w-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={bookingStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {bookingStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-sm">Ativos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">{stats.activeBookings}</span>
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      {stats.totalBookings > 0 ? Math.round((stats.activeBookings / stats.totalBookings) * 100) : 0}%
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-sm">Cancelados</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">{stats.cancelledBookings}</span>
                    <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      {stats.totalBookings > 0 ? Math.round((stats.cancelledBookings / stats.totalBookings) * 100) : 0}%
                    </Badge>
                  </div>
                </div>
                <div className="pt-3 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Total</span>
                    <span className="text-xl font-bold">{stats.totalBookings}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Usage Analysis */}
        <Card className="overflow-hidden border-0 shadow-lg bg-white dark:bg-neutral-900">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-cyan-500" />
              <CardTitle className="text-lg font-semibold">Análise de Uso</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Horário de Pico</span>
                <Badge variant="outline" className="font-mono">
                  <Clock className="h-3 w-3 mr-1" />
                  {stats.peakUsageTime}
                </Badge>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Duração Média</span>
                <Badge variant="outline" className="font-mono">
                  {stats.averageBookingDuration.toFixed(1)}h
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Taxa de Utilização</span>
                  <span className="text-sm font-semibold">{utilizationRate}%</span>
                </div>
                <Progress 
                  value={utilizationRate} 
                  className={cn(
                    "h-2",
                    utilizationRate > 80 ? "[&>div]:bg-red-500" :
                    utilizationRate > 60 ? "[&>div]:bg-amber-500" : "[&>div]:bg-emerald-500"
                  )}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* User Distribution */}
        <Card className="overflow-hidden border-0 shadow-lg bg-white dark:bg-neutral-900">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-violet-500" />
              <CardTitle className="text-lg font-semibold">Distribuição de Usuários</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-[120px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={userDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={55}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {userDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-violet-500" />
                  <span>Administradores</span>
                </div>
                <span className="font-semibold">{stats.adminUsers}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-cyan-500" />
                  <span>Usuários Regulares</span>
                </div>
                <span className="font-semibold">{stats.totalUsers - stats.adminUsers}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Activity Summary */}
        <Card className="overflow-hidden border-0 shadow-lg bg-white dark:bg-neutral-900">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-lg font-semibold">Resumo 30 Dias</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="p-3 rounded-lg bg-violet-50 dark:bg-violet-950/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Agendamentos</span>
                  <span className="text-xl font-bold text-violet-600 dark:text-violet-400">{stats.monthBookings}</span>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Novos Usuários</span>
                  <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{stats.newUsersThisMonth}</span>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Média/Dia</span>
                  <span className="text-xl font-bold text-amber-600 dark:text-amber-400">
                    {(stats.monthBookings / 30).toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}