import { useState, useEffect, memo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Chrome, Calendar, Clock, Users, LogOut, School, FlaskConical, ListChecks, Eye, Package, DoorOpen, Lightbulb, Shield, ClipboardCheck, Key } from 'lucide-react';
import estrelaLogo from '@/assets/Estrela_La_Salle.png';
import { toast } from '@/hooks/use-toast';
import BookingDialog from '@/components/BookingDialog';
import { AvailabilityTable } from '@/components/AvailabilityTable';
import ConsolidatedBookingsList from '@/components/ConsolidatedBookingsList';
import ModernConsolidatedBookingsList from '@/components/ModernConsolidatedBookingsList';
import { RoomBookingPage } from '@/components/room-booking/RoomBookingPage';
import { RoomBookingsList } from '@/components/RoomBookingsList';
import { CurrentRoomBookingsList } from '@/components/CurrentRoomBookingsList';
import { RoomBookingsArchive } from '@/components/RoomBookingsArchive';
import { TodayRoomBookings } from '@/components/TodayRoomBookings';
import { PendingApprovalsTab } from '@/components/PendingApprovalsTab';
import { TodayChromebookBookings } from '@/components/TodayChromebookBookings';
import { LoansManagement } from '@/components/loans/LoansManagement';
import { ChromebookBookingPage } from '@/components/chromebook-booking';
import { NotificationBell } from '@/components/NotificationBell';
import { UserDropdown } from '@/components/ui/user-dropdown';
import { ProfileDialog } from '@/components/profile/ProfileDialog';
import { NotificationPermissionBanner } from '@/components/NotificationPermissionBanner';
import { useNotificationPermission } from '@/hooks/useNotificationPermission';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Database } from '@/types/database';

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

const DashboardComponent = () => {
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
  const [selectedChromebookDate, setSelectedChromebookDate] = useState<Date>(new Date());
  const [showNotificationBanner, setShowNotificationBanner] = useState(true);
  const [isUserApprover, setIsUserApprover] = useState(false);
  const [isUserAdmin, setIsUserAdmin] = useState(false);

  // Initialize notification hooks
  const { permission: notificationPermission } = useNotificationPermission();
  const { lastNotification } = useRealtimeNotifications();

  useEffect(() => {
    if (user) {
      // Primeiro verificar se é admin, depois buscar agendamentos
      let isUserAdmin = false;
      const initializeData = async () => {
        // Verificar se é admin
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();
        
        const adminStatus = !!roleData;
        setIsUserAdmin(adminStatus);

        // Verificar se é aprovador
        const { data: approverData } = await supabase
          .from('room_booking_approvers')
          .select('is_active')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();
        
        const approverStatus = !!approverData;
        setIsUserApprover(approverStatus);

        // Debug: Verificar valores reais
        console.log('DEBUG - Status do Usuário:', {
          userId: user.id,
          userEmail: user.email,
          adminStatus,
          approverStatus,
          shouldShowApprovals: adminStatus || approverStatus,
          roleData,
          approverData
        });

        // Agora buscar dados com a informação de admin
        await Promise.all([
          fetchProfile(),
          fetchModulePermissions(),
          fetchBookings(adminStatus),
          fetchSystemConfigAndAvailability(),
          fetchRoomBookings(adminStatus),
          fetchUnreadApprovals()
        ]);
        
        setLoading(false);
      };

      initializeData();

      // Usar status admin já determinado nos channels
      // Nota: isUserAdmin está disponível aqui por closure

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
            fetchBookings(isUserAdmin);
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
            fetchRoomBookings(isUserAdmin);
          }
        )
        .subscribe();

      // Subscription para notificações de aprovação (atualiza badge em tempo real)
      const approvalNotificationsChannel = supabase
        .channel('approval-notifications-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'approval_notifications'
          },
          () => {
            fetchUnreadApprovals();
          }
        )
        .subscribe();

      return () => {
        chromebookChannel.unsubscribe();
        roomChannel.unsubscribe();
        approvalNotificationsChannel.unsubscribe();
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
          .from('user_permissions')
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
      permissions?.forEach((p: Database['public']['Tables']['user_permissions']['Row']) => {
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
        .select('id', { count: 'exact', head: true })
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
      setTodayBookings(todayBookingsData);

      // Calcular uso de hoje somando as quantidades de todos os agendamentos ativos
      // Agrupa por usuário e pega o máximo de cada usuário para evitar contagem dupla
      const userMaxQuantities = new Map<string, number>();
      (todayBookingsData || []).forEach((booking) => {
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
        navigate('/admin?tab=users');
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
        modulePermissions.admin_salas_hoje ? "today-rooms" :
          (isUserAdmin || isUserApprover) ? "approvals" :
            isUserAdmin ? "bookings" :
              "chromebooks";

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
      <header className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/85 text-primary-foreground shadow-2xl">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/[0.04] rounded-full blur-2xl" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-white/[0.03] rounded-full blur-xl" />
          <div className="absolute top-0 right-1/3 w-32 h-32 bg-white/[0.02] rounded-full blur-lg" />
        </div>

        <div className="container mx-auto px-4 py-4 relative z-10">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            {/* Logo e Título */}
            <div className="flex items-center gap-3.5">
              <div className="relative">
                <div className="bg-white/10 backdrop-blur-md p-2.5 rounded-2xl shadow-xl ring-1 ring-white/20">
                  <img src={estrelaLogo} alt="La Salle Logo" className="h-10 w-10 object-contain drop-shadow-lg" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full ring-2 ring-primary shadow-lg" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight leading-tight">La Salle Sobradinho 360</h1>
                <p className="text-primary-foreground/60 text-[11px] sm:text-xs font-medium tracking-wide">Gestão completa. Olhar Lasallista.</p>
              </div>
            </div>

            {/* Área de Ações e Usuário */}
            <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
              <NotificationBell />
              <div className="w-px h-6 bg-white/15 hidden sm:block" />
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
          {/* Disponíveis Hoje */}
          <Card className="relative overflow-hidden border-0 shadow-xl bg-card/95 backdrop-blur-sm group hover:shadow-2xl transition-shadow duration-300">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-400 to-emerald-600 rounded-l" />
            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/[0.04] rounded-full -translate-y-6 translate-x-6" />
            <CardContent className="p-4 sm:p-5 pl-5 sm:pl-6">
              <div className="flex items-start justify-between mb-3">
                <p className="text-[11px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Disponíveis Hoje</p>
                <div className="h-9 w-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center ring-2 ring-emerald-200/50 dark:ring-emerald-800/30 flex-shrink-0">
                  <Chrome className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <div className="text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 leading-none tracking-tight">{availableChromebooks}</div>
              <p className="text-[10px] sm:text-[11px] text-muted-foreground/70 mt-1.5 font-medium">
                de {totalInventory} chromebooks
              </p>
            </CardContent>
          </Card>

          {/* Em Uso Hoje */}
          <Card className="relative overflow-hidden border-0 shadow-xl bg-card/95 backdrop-blur-sm group hover:shadow-2xl transition-shadow duration-300">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-400 to-orange-500 rounded-l" />
            <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/[0.04] rounded-full -translate-y-6 translate-x-6" />
            <CardContent className="p-4 sm:p-5 pl-5 sm:pl-6">
              <div className="flex items-start justify-between mb-3">
                <p className="text-[11px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Em Uso Hoje</p>
                <div className="h-9 w-9 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center ring-2 ring-amber-200/50 dark:ring-amber-800/30 flex-shrink-0">
                  <Users className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
              <div className="text-3xl sm:text-4xl font-black text-amber-600 dark:text-amber-400 leading-none tracking-tight">{totalInventory - availableChromebooks}</div>
              <p className="text-[10px] sm:text-[11px] text-muted-foreground/70 mt-1.5 font-medium">
                {todayBookings.length} agendamento{todayBookings.length !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          {/* Meus Agendamentos */}
          <Card className="relative overflow-hidden border-0 shadow-xl bg-card/95 backdrop-blur-sm group hover:shadow-2xl transition-shadow duration-300">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 to-indigo-500 rounded-l" />
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/[0.04] rounded-full -translate-y-6 translate-x-6" />
            <CardContent className="p-4 sm:p-5 pl-5 sm:pl-6">
              <div className="flex items-start justify-between mb-3">
                <p className="text-[11px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Meus Agendamentos</p>
                <div className="h-9 w-9 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center ring-2 ring-blue-200/50 dark:ring-blue-800/30 flex-shrink-0">
                  <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div className="text-3xl sm:text-4xl font-black text-blue-600 dark:text-blue-400 leading-none tracking-tight">
                {bookings.filter(b => b.user_id === user?.id && b.status === 'active').length}
              </div>
              <p className="text-[10px] sm:text-[11px] text-muted-foreground/70 mt-1.5 font-medium">
                ativos
              </p>
            </CardContent>
          </Card>

          {/* Total Agendamentos */}
          <Card className="relative overflow-hidden border-0 shadow-xl bg-card/95 backdrop-blur-sm group hover:shadow-2xl transition-shadow duration-300">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-400 to-violet-600 rounded-l" />
            <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/[0.04] rounded-full -translate-y-6 translate-x-6" />
            <CardContent className="p-4 sm:p-5 pl-5 sm:pl-6">
              <div className="flex items-start justify-between mb-3">
                <p className="text-[11px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Agendamentos</p>
                <div className="h-9 w-9 rounded-xl bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center ring-2 ring-purple-200/50 dark:ring-purple-800/30 flex-shrink-0">
                  <Clock className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <div className="text-3xl sm:text-4xl font-black text-purple-600 dark:text-purple-400 leading-none tracking-tight">
                {bookings.filter(b => b.status === 'active').length}
              </div>
              <p className="text-[10px] sm:text-[11px] text-muted-foreground/70 mt-1.5 font-medium">
                ativos no sistema
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Notification Permission Banner - Only for Auditório Approvers */}
        {showNotificationBanner && (isUserAdmin || isUserApprover) && (
          <div className="mb-6">
            <NotificationPermissionBanner onDismiss={() => setShowNotificationBanner(false)} />
          </div>
        )}

        {/* Alert Message */}
        <Card className="relative overflow-hidden mb-8 border-0 shadow-xl bg-card/95 backdrop-blur-sm">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-red-400 via-red-500 to-orange-500 rounded-l" />
          <CardContent className="p-5 pl-6">
            <div className="flex items-start gap-4">
              <div className="h-11 w-11 rounded-2xl bg-red-100 dark:bg-red-900/50 flex items-center justify-center ring-2 ring-red-200/50 dark:ring-red-800/30 flex-shrink-0">
                <Shield className="h-5 w-5 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-extrabold text-red-700 dark:text-red-400 uppercase tracking-wide mb-2.5">Agendamento Obrigatório!</h3>
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-foreground/80 bg-muted/40 px-2.5 py-1 rounded-lg">
                      <Chrome className="h-3 w-3 text-emerald-500" />
                      <strong>Chromebooks</strong> → equipe de TI/TE
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-foreground/80 bg-muted/40 px-2.5 py-1 rounded-lg">
                      <Key className="h-3 w-3 text-amber-500" />
                      <strong>Chave do Auditório</strong> → equipe do SCT
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed pt-1 border-t border-border/30">
                    A entrega dos Chromebooks é realizada exclusivamente mediante agendamento.
                    <span className="font-semibold text-red-600 dark:text-red-400 ml-1">Obs: Alunos não estão autorizados a retirar os equipamentos.</span>
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Module Tabs */}
        <Tabs defaultValue={defaultTab} className="space-y-6">
          {/* Navigation - Floating Card Style */}
          <div className="relative">
            {/* Gradient fade hints for scroll on mobile */}
            <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none sm:hidden" />
            <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none sm:hidden" />
            
            <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
              <TabsList className="inline-flex w-auto sm:flex sm:w-full items-center gap-1 sm:gap-1.5 bg-card/80 backdrop-blur-sm border border-border/60 shadow-lg shadow-black/[0.04] dark:shadow-black/[0.15] p-1.5 sm:p-2 rounded-2xl sm:justify-center min-w-max sm:min-w-0">
                {modulePermissions.chromebooks && (
                  <TabsTrigger 
                    value="chromebooks" 
                    className="group relative flex-shrink-0 flex items-center gap-2 sm:gap-2.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-300 text-muted-foreground hover:text-foreground data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-400 data-[state=active]:bg-emerald-50 dark:data-[state=active]:bg-emerald-950/40 data-[state=active]:shadow-sm hover:bg-muted/50"
                  >
                    <div className="flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-lg transition-all duration-300 bg-muted/60 group-data-[state=active]:bg-emerald-100 dark:group-data-[state=active]:bg-emerald-900/50 group-hover:bg-muted">
                      <Chrome className="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-colors duration-300 group-data-[state=active]:text-emerald-600 dark:group-data-[state=active]:text-emerald-400" />
                    </div>
                    <span className="hidden sm:inline">Chromebooks</span>
                    <span className="sm:hidden">Chrome</span>
                    {/* Active indicator bar */}
                    <div className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-emerald-500 scale-x-0 group-data-[state=active]:scale-x-100 transition-transform duration-300 origin-center" />
                  </TabsTrigger>
                )}
                {modulePermissions.loans_management && (
                  <TabsTrigger 
                    value="emprestimos" 
                    className="group relative flex-shrink-0 flex items-center gap-2 sm:gap-2.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-300 text-muted-foreground hover:text-foreground data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-400 data-[state=active]:bg-blue-50 dark:data-[state=active]:bg-blue-950/40 data-[state=active]:shadow-sm hover:bg-muted/50"
                  >
                    <div className="flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-lg transition-all duration-300 bg-muted/60 group-data-[state=active]:bg-blue-100 dark:group-data-[state=active]:bg-blue-900/50 group-hover:bg-muted">
                      <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-colors duration-300 group-data-[state=active]:text-blue-600 dark:group-data-[state=active]:text-blue-400" />
                    </div>
                    <span>Empréstimos</span>
                    <div className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-blue-500 scale-x-0 group-data-[state=active]:scale-x-100 transition-transform duration-300 origin-center" />
                  </TabsTrigger>
                )}
                {(modulePermissions.auditorio || modulePermissions.laboratorio || modulePermissions.sala_criativa) && (
                  <TabsTrigger 
                    value="salas" 
                    className="group relative flex-shrink-0 flex items-center gap-2 sm:gap-2.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-300 text-muted-foreground hover:text-foreground data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-400 data-[state=active]:bg-purple-50 dark:data-[state=active]:bg-purple-950/40 data-[state=active]:shadow-sm hover:bg-muted/50"
                  >
                    <div className="flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-lg transition-all duration-300 bg-muted/60 group-data-[state=active]:bg-purple-100 dark:group-data-[state=active]:bg-purple-900/50 group-hover:bg-muted">
                      <DoorOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-colors duration-300 group-data-[state=active]:text-purple-600 dark:group-data-[state=active]:text-purple-400" />
                    </div>
                    <span>Salas</span>
                    <div className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-purple-500 scale-x-0 group-data-[state=active]:scale-x-100 transition-transform duration-300 origin-center" />
                  </TabsTrigger>
                )}
                {modulePermissions.admin_salas_hoje && (
                  <TabsTrigger 
                    value="today-rooms" 
                    className="group relative flex-shrink-0 flex items-center gap-2 sm:gap-2.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-300 text-muted-foreground hover:text-foreground data-[state=active]:text-amber-700 dark:data-[state=active]:text-amber-400 data-[state=active]:bg-amber-50 dark:data-[state=active]:bg-amber-950/40 data-[state=active]:shadow-sm hover:bg-muted/50"
                  >
                    <div className="flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-lg transition-all duration-300 bg-muted/60 group-data-[state=active]:bg-amber-100 dark:group-data-[state=active]:bg-amber-900/50 group-hover:bg-muted">
                      <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-colors duration-300 group-data-[state=active]:text-amber-600 dark:group-data-[state=active]:text-amber-400" />
                    </div>
                    <span className="hidden sm:inline">Salas Hoje</span>
                    <span className="sm:hidden">Hoje</span>
                    <div className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-amber-500 scale-x-0 group-data-[state=active]:scale-x-100 transition-transform duration-300 origin-center" />
                  </TabsTrigger>
                )}
                {(isUserAdmin || isUserApprover) && (
                  <TabsTrigger 
                    value="approvals" 
                    className="group relative flex-shrink-0 flex items-center gap-2 sm:gap-2.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-300 text-muted-foreground hover:text-foreground data-[state=active]:text-rose-700 dark:data-[state=active]:text-rose-400 data-[state=active]:bg-rose-50 dark:data-[state=active]:bg-rose-950/40 data-[state=active]:shadow-sm hover:bg-muted/50"
                  >
                    <div className="relative flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-lg transition-all duration-300 bg-muted/60 group-data-[state=active]:bg-rose-100 dark:group-data-[state=active]:bg-rose-900/50 group-hover:bg-muted">
                      <ClipboardCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-colors duration-300 group-data-[state=active]:text-rose-600 dark:group-data-[state=active]:text-rose-400" />
                      {unreadApprovals > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center h-4 w-4 sm:h-5 sm:w-5">
                          <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
                          <span className="relative inline-flex items-center justify-center h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-red-500 text-white text-[9px] sm:text-[10px] font-bold shadow-sm">
                            {unreadApprovals > 9 ? '9+' : unreadApprovals}
                          </span>
                        </span>
                      )}
                    </div>
                    <span>Aprovações</span>
                    <div className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-rose-500 scale-x-0 group-data-[state=active]:scale-x-100 transition-transform duration-300 origin-center" />
                  </TabsTrigger>
                )}
                {isUserAdmin && (
                  <TabsTrigger 
                    value="bookings" 
                    className="group relative flex-shrink-0 flex items-center gap-2 sm:gap-2.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-300 text-muted-foreground hover:text-foreground data-[state=active]:text-indigo-700 dark:data-[state=active]:text-indigo-400 data-[state=active]:bg-indigo-50 dark:data-[state=active]:bg-indigo-950/40 data-[state=active]:shadow-sm hover:bg-muted/50"
                  >
                    <div className="flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-lg transition-all duration-300 bg-muted/60 group-data-[state=active]:bg-indigo-100 dark:group-data-[state=active]:bg-indigo-900/50 group-hover:bg-muted">
                      <ListChecks className="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-colors duration-300 group-data-[state=active]:text-indigo-600 dark:group-data-[state=active]:text-indigo-400" />
                    </div>
                    <span className="hidden sm:inline">Todos Agendamentos</span>
                    <span className="sm:hidden">Todos</span>
                    <div className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-indigo-500 scale-x-0 group-data-[state=active]:scale-x-100 transition-transform duration-300 origin-center" />
                  </TabsTrigger>
                )}
              </TabsList>
            </div>
          </div>

          <TabsContent value="chromebooks" className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
              <div className="xl:col-span-3">
                <ChromebookBookingPage
                  onBookingCreated={handleBookingCreated}
                  totalInventory={totalInventory}
                  onDateChange={setSelectedChromebookDate}
                />
              </div>
              <div>
                <Card className="border-0 shadow-xl overflow-hidden bg-card/95 backdrop-blur-sm sticky top-4">
                  {/* Gradient Header */}
                  <div className="bg-gradient-to-br from-primary via-primary to-primary/80 p-4 sm:p-5">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                        <Chrome className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                          Agendamentos {format(selectedChromebookDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') 
                            ? 'de Hoje' 
                            : `de ${format(selectedChromebookDate, "dd/MM", { locale: ptBR })}`}
                        </h3>
                        <p className="text-[11px] text-white/70 font-medium">
                          {format(selectedChromebookDate, "EEEE", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-4 sm:p-5">
                    <TodayChromebookBookings totalInventory={totalInventory} selectedDate={selectedChromebookDate} />
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
                    Seus agendamentos atuais e futuros de Auditório, Laboratório e Sala Criativa
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {auditorioBookings.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-3 flex items-center gap-2">
                        <School className="h-4 w-4" />
                        Auditório
                      </h4>
                      <CurrentRoomBookingsList
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
                      <CurrentRoomBookingsList
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
                      <CurrentRoomBookingsList
                        bookings={salaCriativaBookings}
                        onBookingDeleted={fetchRoomBookings}
                        roomName="Sala Criativa"
                      />
                    </div>
                  )}
                  {auditorioBookings.length === 0 && laboratorioBookings.length === 0 && salaCriativaBookings.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <DoorOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Você não possui agendamentos futuros de salas.</p>
                      <p className="text-sm">Selecione uma sala e data acima para fazer sua reserva.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Componente de Arquivo com agendamentos passados */}
              <RoomBookingsArchive
                auditorioBookings={auditorioBookings}
                laboratorioBookings={laboratorioBookings}
                salaCriativaBookings={salaCriativaBookings}
              />
            </TabsContent>
          )}

          {modulePermissions.admin_salas_hoje && (
            <TabsContent value="today-rooms" className="space-y-6">
              <Card className="border-0 shadow-xl overflow-hidden bg-card/95 backdrop-blur-sm">
                {/* Gradient Header */}
                <div className="bg-gradient-to-br from-amber-600 via-amber-500 to-orange-500 dark:from-amber-700 dark:via-amber-600 dark:to-orange-600 p-5 sm:p-6">
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                      <Key className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                        Controle de Chaves
                      </h3>
                      <p className="text-[11px] sm:text-xs text-white/70 font-medium mt-0.5">
                        Agendamentos para liberação das chaves de Auditório, Laboratório e Sala Criativa
                      </p>
                    </div>
                  </div>
                </div>
                <CardContent className="p-5 sm:p-6">
                  <TodayRoomBookings />
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {(isUserAdmin || isUserApprover) && (
            <TabsContent value="approvals" className="space-y-6">
              <PendingApprovalsTab />
            </TabsContent>
          )}

          {isUserAdmin && (
            <TabsContent value="bookings" className="space-y-6">
              <ModernConsolidatedBookingsList
                bookings={bookings}
                onBookingCancelled={handleBookingCancelled}
                isAdmin={profile?.is_admin || false}
                currentUserId={user?.id || ''}
              />
            </TabsContent>
          )}
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
};

export default memo(DashboardComponent);