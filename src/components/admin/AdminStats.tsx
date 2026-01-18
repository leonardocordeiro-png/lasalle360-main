import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Calendar, 
  Chrome, 
  TrendingUp, 
  Shield, 
  Clock, 
  Activity,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

      // Optimize: Get user statistics with count
      const { count: totalUsersCount, error: profilesError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      if (profilesError) throw profilesError;

      const { data: adminRoles, error: adminError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      if (adminError) throw adminError;

      const { data: newUsers, error: newUsersError } = await supabase
        .from('profiles')
        .select('user_id')
        .gte('created_at', monthAgo);

      if (newUsersError) throw newUsersError;

      // Optimize: Get booking statistics with filters
      const { count: totalBookingsCount } = await supabase
        .from('chromebook_bookings')
        .select('*', { count: 'exact', head: true });

      const { count: activeBookingsCount } = await supabase
        .from('chromebook_bookings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      const { count: cancelledBookingsCount } = await supabase
        .from('chromebook_bookings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'cancelled');

      const { data: todayBookingsData } = await supabase
        .from('chromebook_bookings')
        .select('quantity, start_time, end_time')
        .eq('booking_date', today)
        .eq('status', 'active');

      const { count: weekBookingsCount } = await supabase
        .from('chromebook_bookings')
        .select('*', { count: 'exact', head: true })
        .gte('booking_date', weekAgo)
        .lte('booking_date', today);

      const { count: monthBookingsCount } = await supabase
        .from('chromebook_bookings')
        .select('*', { count: 'exact', head: true })
        .gte('booking_date', monthAgo)
        .lte('booking_date', today);

      const { data: allBookingsForAvg } = await supabase
        .from('chromebook_bookings')
        .select('start_time, end_time');

      const totalUsers = totalUsersCount || 0;
      const adminUsers = adminRoles?.length || 0;
      const newUsersThisMonth = newUsers?.length || 0;

      const totalBookings = totalBookingsCount || 0;
      const activeBookings = activeBookingsCount || 0;
      const cancelledBookings = cancelledBookingsCount || 0;
      
      const todayBookings = todayBookingsData?.length || 0;
      const weekBookings = weekBookingsCount || 0;
      const monthBookings = monthBookingsCount || 0;

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              {stats.adminUsers} administradores
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agendamentos Ativos</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.activeBookings}</div>
            <p className="text-xs text-muted-foreground">
              de {stats.totalBookings} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chromebooks em Uso</CardTitle>
            <Chrome className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.chromeUsageToday}</div>
            <p className="text-xs text-muted-foreground">
              hoje ({Math.round((stats.chromeUsageToday / 200) * 100)}% do total)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Novos Usuários</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.newUsersThisMonth}</div>
            <p className="text-xs text-muted-foreground">
              últimos 30 dias
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Estatísticas de Agendamentos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{stats.todayBookings}</div>
                <p className="text-sm text-muted-foreground">Hoje</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-secondary">{stats.weekBookings}</div>
                <p className="text-sm text-muted-foreground">Esta Semana</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-accent">{stats.monthBookings}</div>
                <p className="text-sm text-muted-foreground">Este Mês</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Status dos Agendamentos</span>
              </div>
              <div className="flex items-center gap-4">
                <Badge className="bg-success text-success-foreground">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Ativos: {stats.activeBookings}
                </Badge>
                <Badge variant="secondary">
                  <XCircle className="h-3 w-3 mr-1" />
                  Cancelados: {stats.cancelledBookings}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Análise de Uso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Horário de Pico</span>
                <Badge variant="outline">
                  <Clock className="h-3 w-3 mr-1" />
                  {stats.peakUsageTime}
                </Badge>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Duração Média</span>
                <Badge variant="outline">
                  {stats.averageBookingDuration.toFixed(1)}h
                </Badge>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Taxa de Utilização</span>
                <Badge className={
                  stats.chromeUsageToday > 160 ? 'bg-destructive' :
                  stats.chromeUsageToday > 120 ? 'bg-warning' : 'bg-success'
                }>
                  {Math.round((stats.chromeUsageToday / 200) * 100)}%
                </Badge>
              </div>
            </div>

            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-3">Distribuição de Usuários</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Administradores</span>
                  <span>{stats.adminUsers}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Usuários Regulares</span>
                  <span>{stats.totalUsers - stats.adminUsers}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 mt-2">
                  <div 
                    className="bg-primary h-2 rounded-full" 
                    style={{ width: `${(stats.adminUsers / stats.totalUsers) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Resumo de Atividade Recente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-2">{stats.monthBookings}</div>
              <p className="text-sm text-muted-foreground">Agendamentos nos últimos 30 dias</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-secondary mb-2">{stats.newUsersThisMonth}</div>
              <p className="text-sm text-muted-foreground">Novos usuários nos últimos 30 dias</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-accent mb-2">
                {Math.round(((stats.monthBookings / 30) * 100)) / 100}
              </div>
              <p className="text-sm text-muted-foreground">Média de agendamentos/dia</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}