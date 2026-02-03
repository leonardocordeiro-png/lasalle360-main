import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Chrome, Calendar, Clock, Users, LogOut, School, FlaskConical, ListChecks, Eye, Package, DoorOpen, Lightbulb, Shield, ClipboardCheck } from 'lucide-react';
import estrelaLogo from '@/assets/Estrela_La_Salle.png';
import { toast } from '@/hooks/use-toast';
import BookingDialog from '@/components/BookingDialog';
import { AvailabilityTable } from '@/components/AvailabilityTable';
import ConsolidatedBookingsList from '@/components/ConsolidatedBookingsList';
import { RoomBookingPage } from '@/components/room-booking/RoomBookingPage';
import { RoomBookingsList } from '@/components/RoomBookingsList';
import { TodayRoomBookings } from '@/components/TodayRoomBookings';
import { PendingApprovalsTab } from '@/components/PendingApprovalsTab';
import { TodayChromebookBookings } from '@/components/TodayChromebookBookings';
import { LoansManagement } from '@/components/loans/LoansManagement';
import { ChromebookBookingPage } from '@/components/chromebook-booking';
import { NotificationBell } from '@/components/NotificationBell';
import { UserDropdown } from '@/components/ui/user-dropdown';
import { ProfileDialog } from '@/components/profile/ProfileDialog';
import { format } from 'date-fns';

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
}

interface RoomBooking {
  id: string;
  room_type: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  class_name: string;
  observations: string | null;
  status: string;
  full_name: string;
  approval_status?: string;
}

interface Profile {
  full_name: string;
  email: string;
  is_admin: boolean;
  avatar_url?: string;
}

interface ModulePermissions {
  chromebooks: boolean;
  auditorio: boolean;
  laboratorio: boolean;
  sala_criativa: boolean;
  loans_management: boolean;
  admin_salas_hoje: boolean;
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [todayBookings, setTodayBookings] = useState<Booking[]>([]);
  const [availableChromebooks, setAvailableChromebooks] = useState(0);
  const [totalInventory, setTotalInventory] = useState(200);
  const [maxBookingQuantity, setMaxBookingQuantity] = useState(50);
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [auditorioBookings, setAuditorioBookings] = useState<RoomBooking[]>([]);
  const [laboratorioBookings, setLaboratorioBookings] = useState<RoomBooking[]>([]);
  const [salaCriativaBookings, setSalaCriativaBookings] = useState<RoomBooking[]>([]);
  const [modulePermissions, setModulePermissions] = useState<ModulePermissions>({
    chromebooks: true,
    auditorio: true,
    laboratorio: true,
    sala_criativa: true,
    loans_management: true,
    admin_salas_hoje: false,
  });

  const [userRoles, setUserRoles] = useState<any[]>([]);
  const [userPermissions, setUserPermissions] = useState<any[]>([]);
  const [unreadApprovals, setUnreadApprovals] = useState(0);

  useEffect(() => {
    if (user) {
      // Primeiro verificar se é admin, depois buscar agendamentos
      const initializeData = async () => {
        // Verificar se é admin
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();
        
        const isUserAdmin = !!roleData;

        // Agora buscar dados com a informação de admin
        await Promise.all([
          fetchProfile(),
          fetchModulePermissions(),
          fetchBookings(isUserAdmin),
          fetchSystemConfigAndAvailability(),
          fetchRoomBookings(isUserAdmin),
          fetchUnreadApprovals()
        ]);
        
        setLoading(false);
      };

      initializeData();

      // Armazenar referência do status admin para os channels
      let isAdminRef = false;
      supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle()
        .then(({ data }) => {
          isAdminRef = !!data;
        });

      const chromebookChannel = supabase
        .channel('chromebook-bookings-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'chromebook_bookings'
          },
          () => {
            fetchBookings(isAdminRef);
            fetchSystemConfigAndAvailability();
          }
        )
        .subscribe();

      const roomChannel = supabase
        .channel('room-bookings-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'room_bookings'
          },
          () => {
            fetchRoomBookings(isAdminRef);
          }
        )
        .subscribe();

      // Removido polling de 30s - realtime subscriptions já cuidam das atualizações

      return () => {
        chromebookChannel.unsubscribe();
        roomChannel.unsubscribe();
      };
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      // Otimização: buscar profile e role em paralelo, selecionando apenas colunas necessárias
      const [profileResult, roleResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('full_name, email, avatar_url')
          .eq('user_id', user?.id)
          .single(),
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user?.id)
          .eq('role', 'admin')
          .maybeSingle()
      ]);

      if (profileResult.error) throw profileResult.error;

      setProfile({ ...profileResult.data, is_admin: !!roleResult.data });
    } catch (error: any) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchModulePermissions = async () => {
    try {
      if (!user?.id) return;

      // Otimização: buscar roles e permissions em paralelo
      const [rolesResult, permissionsResult] = await Promise.all([
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id),
        supabase
          .from('user_permissions' as any)
          .select('module_name, can_access')
          .eq('user_id', user.id)
      ]);

      const roles = rolesResult.data;
      const permissions = permissionsResult.data;

      setUserRoles(roles || []);
      setUserPermissions(permissions || []);

      const isAdmin = roles?.some((r: any) => r.role === 'admin');

      if (isAdmin) {
        setModulePermissions({
          chromebooks: true,
          auditorio: true,
          laboratorio: true,
          sala_criativa: true,
          loans_management: true,
          admin_salas_hoje: true,
        });
        return;
      }

      const permissionsMap: Record<string, boolean> = {};
      (permissions as any)?.forEach((p: any) => {
        permissionsMap[p.module_name] = p.can_access;
      });

      setModulePermissions({
        chromebooks: permissionsMap['chromebooks'] ?? true,
        auditorio: permissionsMap['auditorio'] ?? true,
        laboratorio: permissionsMap['laboratorio'] ?? true,
        sala_criativa: permissionsMap['sala_criativa'] ?? true,
        loans_management: permissionsMap['loans_management'] ?? false,
        admin_salas_hoje: permissionsMap['admin_salas_hoje'] ?? false,
      });
    } catch (error: any) {
      console.error('Error fetching module permissions:', error);
      setModulePermissions({
        chromebooks: true,
        auditorio: true,
        laboratorio: true,
        sala_criativa: true,
        loans_management: false,
        admin_salas_hoje: false,
      });
    }
  };

  const fetchUnreadApprovals = async () => {
    try {
      if (!user?.id) return;
      
      const { count, error } = await supabase
        .from('approval_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('approver_id', user.id)
        .eq('is_read', false);
      
      if (!error) {
        setUnreadApprovals(count || 0);
      }
    } catch (error) {
      console.error('Error fetching unread approvals:', error);
    }
  };

  const fetchRoomBookings = async (isUserAdmin = false) => {
    try {
      if (!user?.id) return;

      // Admins veem todos os agendamentos, usuários normais veem apenas os seus
      let query = supabase
        .from('room_bookings')
        .select('id, room_type, booking_date, start_time, end_time, class_name, observations, status, full_name, user_id')
        .eq('status', 'active')
        .in('room_type', ['auditorio', 'laboratorio', 'sala_criativa'])
        .order('booking_date', { ascending: true });

      if (!isUserAdmin) {
        query = query.eq('user_id', user.id);
      }

      const { data: allRoomBookings, error } = await query;

      if (error) throw error;

      // Separar por tipo de sala no cliente (mais rápido que 3 queries)
      const auditorio = allRoomBookings?.filter(b => b.room_type === 'auditorio') || [];
      const laboratorio = allRoomBookings?.filter(b => b.room_type === 'laboratorio') || [];
      const salaCriativa = allRoomBookings?.filter(b => b.room_type === 'sala_criativa') || [];

      setAuditorioBookings(auditorio);
      setLaboratorioBookings(laboratorio);
      setSalaCriativaBookings(salaCriativa);
    } catch (error) {
      console.error('Error fetching room bookings:', error);
    }
  };

  const fetchBookings = async (isUserAdmin = false) => {
    try {
      if (!user?.id) return;

      // Admins veem todos os agendamentos, usuários normais veem apenas os seus
      let query = supabase
        .from('chromebook_bookings')
        .select('id, user_id, full_name, class_name, quantity, booking_date, start_time, end_time, status, created_at')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!isUserAdmin) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setBookings(data || []);
    } catch (error: any) {
      console.error('Error fetching bookings:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar os agendamentos",
      });
    }
  };

  const fetchSystemConfigAndAvailability = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      // Otimização: buscar config e agendamentos de hoje em paralelo
      const [configResult, todayBookingsResult] = await Promise.all([
        supabase
          .from('system_config')
          .select('config_key, config_value'),
        supabase
          .from('chromebook_bookings')
          .select('user_id, quantity')
          .eq('booking_date', today)
          .eq('status', 'active')
      ]);

      if (configResult.error) throw configResult.error;
      if (todayBookingsResult.error) throw todayBookingsResult.error;

      const configMap = configResult.data.reduce((acc, item) => {
        acc[item.config_key] = item.config_value;
        return acc;
      }, {} as Record<string, any>);

      const fetchedDefaultInventory = parseInt(configMap.default_chromebook_inventory) || 200;
      const fetchedMaxBookingQuantity = parseInt(configMap.max_booking_quantity) || 50;

      setTotalInventory(fetchedDefaultInventory);
      setMaxBookingQuantity(fetchedMaxBookingQuantity);

      const todayBookingsData = todayBookingsResult.data || [];
      setTodayBookings(todayBookingsData as any);

      // Calcular uso de hoje somando as quantidades de todos os agendamentos ativos
      // Agrupa por usuário e pega o máximo de cada usuário para evitar contagem dupla
      const userMaxQuantities = new Map<string, number>();
      (todayBookingsData || []).forEach((booking: Booking) => {
        const currentMax = userMaxQuantities.get(booking.user_id) || 0;
        if (booking.quantity > currentMax) {
          userMaxQuantities.set(booking.user_id, booking.quantity);
        }
      });
      
      const totalInUse = Array.from(userMaxQuantities.values()).reduce((sum, qty) => sum + qty, 0);
      const available = fetchedDefaultInventory - totalInUse;

      setAvailableChromebooks(Math.max(0, available));
    } catch (error: any) {
      console.error('Error fetching system config or today availability:', error);
      setTotalInventory(200);
      setMaxBookingQuantity(50);
      setAvailableChromebooks(200);
    }
  };

  const handleBookingCreated = () => {
    fetchBookings();
    fetchSystemConfigAndAvailability();
  };

  const handleBookingCancelled = async (bookingId: string) => {
    await fetchBookings();
    await fetchSystemConfigAndAvailability();
  };

  const handleUserAction = (action: string) => {
    switch (action) {
      case 'admin':
        navigate('/admin');
        break;
      case 'users':
        navigate('/admin');
        break;
      case 'reports':
        navigate('/admin');
        break;
      case 'settings':
        toast({ title: "Configurações", description: "Em breve disponível!" });
        break;
      case 'profile':
        setShowProfileDialog(true);
        break;
      case 'notifications':
        toast({ title: "Notificações", description: "Clique no sino para ver suas notificações." });
        break;
      case 'help':
        toast({ title: "Ajuda", description: "Entre em contato com o suporte técnico." });
        break;
      case 'about':
        toast({ title: "La Salle 360", description: "Sistema de gestão escolar - Versão 1.0" });
        break;
      default:
        break;
    }
  };

  const handleProfileUpdated = () => {
    fetchProfile();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  const defaultTab = modulePermissions.chromebooks ? "chromebooks" :
    modulePermissions.loans_management ? "emprestimos" :
      (modulePermissions.auditorio || modulePermissions.laboratorio || modulePermissions.sala_criativa) ? "salas" :
        "bookings";

  // Dados do usuário para o dropdown
  const userDropdownData = {
    name: profile?.full_name || 'Usuário',
    email: profile?.email || '',
    avatar: profile?.avatar_url,
    initials: profile?.full_name?.split(' ').map(n => n[0]).join('').substring(0, 2) || 'U',
    isAdmin: profile?.is_admin || false,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header Moderno */}
      <header className="bg-gradient-to-r from-primary via-primary to-primary/90 text-primary-foreground shadow-xl">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            {/* Logo e Título */}
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="bg-white/15 backdrop-blur-sm p-2.5 rounded-xl shadow-lg">
                <img src={estrelaLogo} alt="La Salle Logo" className="h-9 w-9 object-contain" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">La Salle Sobradinho 360</h1>
                <p className="text-primary-foreground/70 text-xs sm:text-sm font-medium">Gestão completa. Olhar Lasallista.</p>
              </div>
            </div>

            {/* Área de Ações e Usuário */}
            <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
              {/* Notificações */}
              <NotificationBell />

              {/* User Dropdown com Avatar */}
              <UserDropdown
                user={userDropdownData}
                onAction={handleUserAction}
                onLogout={signOut}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950 dark:to-background">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Disponíveis Hoje</CardTitle>
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900 rounded-lg">
                <Chrome className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{availableChromebooks}</div>
              <p className="text-xs text-muted-foreground mt-1">
                de {totalInventory} chromebooks
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-50 to-white dark:from-amber-950 dark:to-background">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Em Uso Hoje</CardTitle>
              <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-lg">
                <Users className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">{totalInventory - availableChromebooks}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {todayBookings.length} agendamentos
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-white dark:from-blue-950 dark:to-background">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Meus Agendamentos</CardTitle>
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {bookings.filter(b => b.user_id === user?.id && b.status === 'active').length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                ativos
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-white dark:from-purple-950 dark:to-background">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Agendamentos</CardTitle>
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Clock className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                {bookings.filter(b => b.status === 'active').length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                ativos no sistema
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Alert Message */}
        <Card className="mb-8 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950 border-red-200 dark:border-red-800 shadow-lg">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <div className="text-3xl flex-shrink-0 bg-red-100 dark:bg-red-900 p-3 rounded-xl">🚨</div>
              <div className="flex-1">
                <h3 className="text-red-700 dark:text-red-400 font-bold text-lg mb-3">AGENDAMENTO OBRIGATÓRIO!</h3>
                <div className="text-red-900 dark:text-red-300 space-y-2 text-sm">
                  <p><strong>Chromebooks</strong> → entrega exclusiva pela equipe de TI/TE.</p>
                  <p><strong>Chave do Auditório</strong> → retirada com a equipe do SCT.</p>
                  <p className="mt-3 pt-3 border-t border-red-200 dark:border-red-700">
                    A entrega dos Chromebooks é realizada exclusivamente mediante agendamento.
                  </p>
                  <p className="mt-2">
                    <strong>Obs:</strong> Alunos não estão autorizados a retirar os equipamentos.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Module Tabs */}
        <Tabs defaultValue={defaultTab} className="space-y-6">
          <div className="overflow-x-auto pb-2">
            <TabsList className="flex flex-nowrap justify-start sm:justify-center min-w-max sm:min-w-0 bg-muted/50 p-1 rounded-xl">
              {modulePermissions.chromebooks && (
                <TabsTrigger value="chromebooks" className="flex-shrink-0 flex items-center gap-2 text-xs sm:text-sm rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Chrome className="h-4 w-4" />
                  <span>Chromebooks</span>
                </TabsTrigger>
              )}
              {modulePermissions.loans_management && (
                <TabsTrigger value="emprestimos" className="flex-shrink-0 flex items-center gap-2 text-xs sm:text-sm rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Package className="h-4 w-4" />
                  <span>Empréstimos</span>
                </TabsTrigger>
              )}
              {(modulePermissions.auditorio || modulePermissions.laboratorio || modulePermissions.sala_criativa) && (
                <TabsTrigger value="salas" className="flex-shrink-0 flex items-center gap-2 text-xs sm:text-sm rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <DoorOpen className="h-4 w-4" />
                  <span>Salas</span>
                </TabsTrigger>
              )}
              {modulePermissions.admin_salas_hoje && (
                <TabsTrigger value="today-rooms" className="flex-shrink-0 flex items-center gap-2 text-xs sm:text-sm rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Eye className="h-4 w-4" />
                  <span>Salas Hoje</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="approvals" className="flex-shrink-0 flex items-center gap-2 text-xs sm:text-sm rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm relative">
                <ClipboardCheck className="h-4 w-4" />
                <span>Aprovações</span>
                {unreadApprovals > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                    {unreadApprovals > 9 ? '9+' : unreadApprovals}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="bookings" className="flex-shrink-0 flex items-center gap-2 text-xs sm:text-sm rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <ListChecks className="h-4 w-4" />
                <span>Todos Agendamentos</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="chromebooks" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3">
                <ChromebookBookingPage
                  onBookingCreated={handleBookingCreated}
                  totalInventory={totalInventory}
                />
              </div>
              <div>
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Chrome className="h-5 w-5 text-primary" />
                      Agendamentos de Hoje
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TodayChromebookBookings totalInventory={totalInventory} />
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {modulePermissions.loans_management && (
            <TabsContent value="emprestimos" className="space-y-6">
              <LoansManagement />
            </TabsContent>
          )}

          {(modulePermissions.auditorio || modulePermissions.laboratorio || modulePermissions.sala_criativa) && (
            <TabsContent value="salas" className="space-y-6">
              <RoomBookingPage
                onBookingCreated={fetchRoomBookings}
                initialRoomType={modulePermissions.auditorio ? 'auditorio' : modulePermissions.laboratorio ? 'laboratorio' : 'sala_criativa'}
              />
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle>Meus Agendamentos de Salas</CardTitle>
                  <CardDescription>
                    Todos os seus agendamentos de Auditório, Laboratório e Sala Criativa
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {auditorioBookings.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-3 flex items-center gap-2">
                        <School className="h-4 w-4" />
                        Auditório
                      </h4>
                      <RoomBookingsList
                        bookings={auditorioBookings}
                        onBookingDeleted={fetchRoomBookings}
                        roomName="Auditório"
                      />
                    </div>
                  )}
                  {laboratorioBookings.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-3 flex items-center gap-2">
                        <FlaskConical className="h-4 w-4" />
                        Laboratório
                      </h4>
                      <RoomBookingsList
                        bookings={laboratorioBookings}
                        onBookingDeleted={fetchRoomBookings}
                        roomName="Laboratório"
                      />
                    </div>
                  )}
                  {salaCriativaBookings.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-3 flex items-center gap-2">
                        <Lightbulb className="h-4 w-4" />
                        Sala Criativa
                      </h4>
                      <RoomBookingsList
                        bookings={salaCriativaBookings}
                        onBookingDeleted={fetchRoomBookings}
                        roomName="Sala Criativa"
                      />
                    </div>
                  )}
                  {auditorioBookings.length === 0 && laboratorioBookings.length === 0 && salaCriativaBookings.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <DoorOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Você ainda não possui agendamentos de salas.</p>
                      <p className="text-sm">Selecione uma sala e data acima para fazer sua reserva.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {modulePermissions.admin_salas_hoje && (
            <TabsContent value="today-rooms" className="space-y-6">
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-primary" />
                    Controle de Chaves - Agendamentos do Dia
                  </CardTitle>
                  <CardDescription>
                    Visualização simplificada dos agendamentos de hoje para controle de liberação das chaves de Auditório, Laboratório e Sala Criativa
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TodayRoomBookings />
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="approvals" className="space-y-6">
            <PendingApprovalsTab />
          </TabsContent>

          <TabsContent value="bookings" className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Todos os Agendamentos</CardTitle>
                <CardDescription>
                  Visualize todos os seus agendamentos de Chromebooks, Auditório e Laboratório
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ConsolidatedBookingsList
                  bookings={bookings}
                  onBookingCancelled={handleBookingCancelled}
                  isAdmin={profile?.is_admin || false}
                  currentUserId={user?.id || ''}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Booking Dialog */}
      <BookingDialog
        open={showBookingDialog}
        onOpenChange={setShowBookingDialog}
        onSuccess={handleBookingCreated}
        totalInventory={totalInventory}
        maxBookingQuantity={maxBookingQuantity}
      />

      {/* Profile Dialog */}
      {user && (
        <ProfileDialog
          open={showProfileDialog}
          onOpenChange={setShowProfileDialog}
          user={{
            id: user.id,
            email: user.email || '',
            name: profile?.full_name || 'Usuário',
            avatar: profile?.avatar_url,
          }}
          onProfileUpdated={handleProfileUpdated}
        />
      )}
    </div>
  );
}