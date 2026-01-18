import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { 
  Search, 
  Calendar as CalendarIcon,
  User,
  Shield,
  RefreshCw,
  GraduationCap,
  FileEdit,
  Plus,
  Trash2,
  Download,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  LogIn,
  Laptop,
  DoorOpen
} from 'lucide-react';
import { Icon } from '@iconify/react';
import { format, subDays, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';

interface AuditLog {
  id: string;
  user_id?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  ip_address?: string | unknown;
  user_agent?: string;
  session_id?: string;
  additional_data?: any;
  created_at: string;
  user_name?: string;
  user_email?: string;
  user_role?: string;
}

interface BookingLog {
  id: string;
  user_id: string;
  full_name: string;
  action: string;
  booking_date: string;
  quantity?: number;
  class_name: string;
  created_at: string;
  status: string;
  booking_type: 'chromebook' | 'room';
  room_type?: string;
}

interface SchoolPlanningLog {
  id: string;
  user_id?: string;
  user_email: string;
  user_name: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  table_name: string;
  record_id: string;
  old_data?: any;
  new_data?: any;
  changes?: any;
  created_at: string;
}

type ActionType = 'all' | 'create' | 'update' | 'delete' | 'cancel' | 'login' | 'logout' | 'backup' | 'access';
type ModuleType = 'all' | 'chromebook' | 'room' | 'planning' | 'auth' | 'permissions' | 'council' | 'database';

const ITEMS_PER_PAGE = 10;

export default function AuditLogs() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [bookingHistory, setBookingHistory] = useState<BookingLog[]>([]);
  const [schoolPlanningLogs, setSchoolPlanningLogs] = useState<SchoolPlanningLog[]>([]);
  const [userProfiles, setUserProfiles] = useState<Record<string, { full_name: string; email: string; avatar_url?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<ActionType>('all');
  const [moduleFilter, setModuleFilter] = useState<ModuleType>('all');
  const [userFilter, setUserFilter] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date()
  });
  const [activeTab, setActiveTab] = useState<'security' | 'bookings' | 'school-planning'>('bookings');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchLogs();
    fetchUserProfiles();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, actionFilter, moduleFilter, userFilter, dateRange, activeTab]);

  const fetchUserProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, avatar_url');
      
      if (error) throw error;
      
      const profilesMap: Record<string, { full_name: string; email: string; avatar_url?: string }> = {};
      data?.forEach(profile => {
        profilesMap[profile.user_id] = {
          full_name: profile.full_name,
          email: profile.email,
          avatar_url: profile.avatar_url || undefined
        };
      });
      setUserProfiles(profilesMap);
    } catch (error) {
      console.error('Error fetching user profiles:', error);
    }
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      
      // Fetch security audit logs
      const { data: securityLogs, error: securityError } = await supabase
        .from('security_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (securityError) {
        console.log('Security logs not accessible:', securityError);
        setAuditLogs([]);
      } else {
        setAuditLogs(securityLogs || []);
      }

      // Fetch chromebook booking history
      const { data: chromebookBookings, error: chromebookError } = await supabase
        .from('chromebook_bookings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (chromebookError) throw chromebookError;

      // Fetch room booking history
      const { data: roomBookings, error: roomError } = await supabase
        .from('room_bookings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (roomError) throw roomError;

      // Transform chromebook bookings into log format
      const chromebookLogs: BookingLog[] = chromebookBookings.map(booking => ({
        id: booking.id,
        user_id: booking.user_id,
        full_name: booking.full_name,
        action: booking.status === 'active' ? 'CREATE_BOOKING' : 'CANCEL_BOOKING',
        booking_date: booking.booking_date,
        quantity: booking.quantity,
        class_name: booking.class_name,
        created_at: booking.created_at,
        status: booking.status,
        booking_type: 'chromebook' as const
      }));

      // Transform room bookings into log format
      const roomLogs: BookingLog[] = roomBookings.map(booking => ({
        id: booking.id,
        user_id: booking.user_id,
        full_name: booking.full_name,
        action: booking.status === 'active' ? 'CREATE_BOOKING' : 'CANCEL_BOOKING',
        booking_date: booking.booking_date,
        class_name: booking.class_name,
        created_at: booking.created_at,
        status: booking.status,
        booking_type: 'room' as const,
        room_type: booking.room_type
      }));

      // Combine and sort all bookings by created_at
      const allBookings = [...chromebookLogs, ...roomLogs].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setBookingHistory(allBookings);

      // Fetch school planning audit logs
      const { data: planningLogs, error: planningError } = await supabase
        .from('school_planning_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (planningError) {
        console.log('School planning logs not accessible:', planningError);
        setSchoolPlanningLogs([]);
      } else {
        setSchoolPlanningLogs((planningLogs || []) as SchoolPlanningLog[]);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (action: string, type?: 'booking' | 'planning' | 'security') => {
    const baseClasses = "flex items-center gap-1.5 font-medium text-xs px-2.5 py-1 rounded-full";
    
    if (type === 'booking') {
      if (action === 'CREATE_BOOKING') {
        return (
          <span className={`${baseClasses} bg-emerald-100 text-emerald-700 border border-emerald-200`}>
            <Plus className="h-3 w-3" />
            Criar
          </span>
        );
      }
      if (action === 'CANCEL_BOOKING') {
        return (
          <span className={`${baseClasses} bg-red-100 text-red-700 border border-red-200`}>
            <Trash2 className="h-3 w-3" />
            Cancelar
          </span>
        );
      }
    }
    
    if (type === 'planning') {
      if (action === 'INSERT') {
        return (
          <span className={`${baseClasses} bg-emerald-100 text-emerald-700 border border-emerald-200`}>
            <Plus className="h-3 w-3" />
            Criar
          </span>
        );
      }
      if (action === 'UPDATE') {
        return (
          <span className={`${baseClasses} bg-blue-100 text-blue-700 border border-blue-200`}>
            <FileEdit className="h-3 w-3" />
            Atualizar
          </span>
        );
      }
      if (action === 'DELETE') {
        return (
          <span className={`${baseClasses} bg-red-100 text-red-700 border border-red-200`}>
            <Trash2 className="h-3 w-3" />
            Excluir
          </span>
        );
      }
    }

    // Security actions
    const actionLower = action.toLowerCase();
    if (actionLower.includes('login') || actionLower.includes('signup')) {
      return (
        <span className={`${baseClasses} bg-violet-100 text-violet-700 border border-violet-200`}>
          <LogIn className="h-3 w-3" />
          Login
        </span>
      );
    }
    if (actionLower.includes('logout')) {
      return (
        <span className={`${baseClasses} bg-gray-100 text-gray-700 border border-gray-200`}>
          <Icon icon="solar:logout-2-outline" className="h-3 w-3" />
          Logout
        </span>
      );
    }
    if (actionLower.includes('update') || actionLower.includes('updated')) {
      return (
        <span className={`${baseClasses} bg-blue-100 text-blue-700 border border-blue-200`}>
          <FileEdit className="h-3 w-3" />
          Atualizar
        </span>
      );
    }
    if (actionLower.includes('create') || actionLower.includes('created')) {
      return (
        <span className={`${baseClasses} bg-emerald-100 text-emerald-700 border border-emerald-200`}>
          <Plus className="h-3 w-3" />
          Criar
        </span>
      );
    }
    if (actionLower.includes('delete') || actionLower.includes('deleted')) {
      return (
        <span className={`${baseClasses} bg-red-100 text-red-700 border border-red-200`}>
          <Trash2 className="h-3 w-3" />
          Excluir
        </span>
      );
    }
    if (actionLower.includes('backup')) {
      return (
        <span className={`${baseClasses} bg-cyan-100 text-cyan-700 border border-cyan-200`}>
          <Icon icon="solar:database-bold" className="h-3 w-3" />
          Backup
        </span>
      );
    }
    if (actionLower.includes('access') || actionLower.includes('permission')) {
      return (
        <span className={`${baseClasses} bg-amber-100 text-amber-700 border border-amber-200`}>
          <Shield className="h-3 w-3" />
          Acesso
        </span>
      );
    }
    
    return (
      <span className={`${baseClasses} bg-gray-100 text-gray-700 border border-gray-200`}>
        {action}
      </span>
    );
  };

  const getModuleDisplay = (log: BookingLog | SchoolPlanningLog | AuditLog, type: 'booking' | 'planning' | 'security') => {
    if (type === 'booking') {
      const bookingLog = log as BookingLog;
      if (bookingLog.booking_type === 'chromebook') {
        return (
          <div>
            <p className="font-medium text-sm text-foreground">Chromebooks</p>
            <p className="text-xs text-muted-foreground">{bookingLog.class_name}</p>
          </div>
        );
      }
      const roomName = bookingLog.room_type === 'sala_google' ? 'Sala Google' : 'Laboratório';
      return (
        <div>
          <p className="font-medium text-sm text-foreground">{roomName}</p>
          <p className="text-xs text-muted-foreground">{bookingLog.class_name}</p>
        </div>
      );
    }
    
    if (type === 'planning') {
      const planningLog = log as SchoolPlanningLog;
      const tableNames: Record<string, string> = {
        'class_planning': 'Planejamento',
        'complementary_programs': 'Programas',
        'school_years': 'Anos Letivos',
        'academic_levels': 'Níveis',
        'grade_series': 'Séries'
      };
      return (
        <div>
          <p className="font-medium text-sm text-foreground">{tableNames[planningLog.table_name] || planningLog.table_name}</p>
          <p className="text-xs text-muted-foreground">ID: {planningLog.record_id.substring(0, 8)}...</p>
        </div>
      );
    }
    
    const securityLog = log as AuditLog;
    return (
      <div>
        <p className="font-medium text-sm text-foreground capitalize">{securityLog.resource_type}</p>
        <p className="text-xs text-muted-foreground">{securityLog.resource_id ? `ID: ${securityLog.resource_id.substring(0, 8)}...` : 'Sistema'}</p>
      </div>
    );
  };

  const getDescription = (log: BookingLog | SchoolPlanningLog | AuditLog, type: 'booking' | 'planning' | 'security') => {
    if (type === 'booking') {
      const bookingLog = log as BookingLog;
      if (bookingLog.action === 'CREATE_BOOKING') {
        if (bookingLog.booking_type === 'chromebook') {
          return `Agendou ${bookingLog.quantity} Chromebook(s) para ${format(new Date(bookingLog.booking_date), 'dd/MM/yyyy')}`;
        }
        const roomName = bookingLog.room_type === 'sala_google' ? 'Sala Google' : 'Laboratório';
        return `Reservou ${roomName} para ${format(new Date(bookingLog.booking_date), 'dd/MM/yyyy')}`;
      }
      return `Cancelou agendamento de ${format(new Date(bookingLog.booking_date), 'dd/MM/yyyy')}`;
    }
    
    if (type === 'planning') {
      const planningLog = log as SchoolPlanningLog;
      const tableNames: Record<string, string> = {
        'class_planning': 'planejamento de turmas',
        'complementary_programs': 'programa complementar',
        'school_years': 'ano letivo',
        'academic_levels': 'nível acadêmico',
        'grade_series': 'série/ano'
      };
      const tableName = tableNames[planningLog.table_name] || planningLog.table_name;
      
      if (planningLog.action === 'INSERT') return `Criou novo ${tableName}`;
      if (planningLog.action === 'UPDATE') return `Atualizou ${tableName}`;
      if (planningLog.action === 'DELETE') return `Excluiu ${tableName}`;
    }
    
    const securityLog = log as AuditLog;
    if (securityLog.additional_data?.description) {
      return securityLog.additional_data.description;
    }
    
    const actionDescriptions: Record<string, string> = {
      'login': 'Realizou login no sistema',
      'logout': 'Realizou logout do sistema',
      'signup': 'Criou nova conta',
      'password_reset': 'Solicitou redefinição de senha',
      'booking_created': 'Criou novo agendamento',
      'booking_updated': 'Atualizou agendamento',
      'booking_cancelled': 'Cancelou agendamento',
      'user_created': 'Criou novo usuário',
      'user_updated': 'Atualizou usuário',
      'user_deleted': 'Excluiu usuário',
      'permission_granted': 'Concedeu permissão',
      'permission_revoked': 'Revogou permissão',
      'admin_access': 'Acessou painel administrativo',
      'valid_email_domain_signup': 'Cadastro com email válido'
    };
    
    return actionDescriptions[securityLog.action.toLowerCase()] || securityLog.action;
  };

  const getUserInfo = (log: BookingLog | SchoolPlanningLog | AuditLog, type: 'booking' | 'planning' | 'security') => {
    if (type === 'booking') {
      const bookingLog = log as BookingLog;
      const profile = userProfiles[bookingLog.user_id];
      return {
        name: bookingLog.full_name,
        role: 'Professor',
        avatar: profile?.avatar_url
      };
    }
    
    if (type === 'planning') {
      const planningLog = log as SchoolPlanningLog;
      const profile = planningLog.user_id ? userProfiles[planningLog.user_id] : null;
      return {
        name: planningLog.user_name,
        role: 'Coordenador',
        avatar: profile?.avatar_url
      };
    }
    
    const securityLog = log as AuditLog;
    const profile = securityLog.user_id ? userProfiles[securityLog.user_id] : null;
    return {
      name: profile?.full_name || 'Sistema',
      role: securityLog.user_id ? 'Usuário' : 'Automático',
      avatar: profile?.avatar_url
    };
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const filterByDateRange = (date: string) => {
    if (!dateRange?.from) return true;
    const logDate = new Date(date);
    const from = startOfDay(dateRange.from);
    const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
    return isWithinInterval(logDate, { start: from, end: to });
  };

  const filteredBookingLogs = bookingHistory.filter(log => {
    const matchesSearch = log.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.class_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = actionFilter === 'all' || 
                         (actionFilter === 'create' && log.action === 'CREATE_BOOKING') ||
                         (actionFilter === 'cancel' && log.action === 'CANCEL_BOOKING');
    
    const matchesModule = moduleFilter === 'all' ||
                         (moduleFilter === 'chromebook' && log.booking_type === 'chromebook') ||
                         (moduleFilter === 'room' && log.booking_type === 'room');
    
    const matchesUser = !userFilter || log.full_name.toLowerCase().includes(userFilter.toLowerCase());
    
    const matchesDate = filterByDateRange(log.created_at);
    
    return matchesSearch && matchesAction && matchesModule && matchesUser && matchesDate;
  });

  const filteredSchoolPlanningLogs = schoolPlanningLogs.filter(log => {
    const matchesSearch = log.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.table_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = actionFilter === 'all' || 
                         (actionFilter === 'create' && log.action === 'INSERT') ||
                         (actionFilter === 'update' && log.action === 'UPDATE') ||
                         (actionFilter === 'delete' && log.action === 'DELETE');
    
    const matchesUser = !userFilter || log.user_name.toLowerCase().includes(userFilter.toLowerCase());
    
    const matchesDate = filterByDateRange(log.created_at);
    
    return matchesSearch && matchesAction && matchesUser && matchesDate;
  });

  const filteredAuditLogs = auditLogs.filter(log => {
    const profile = log.user_id ? userProfiles[log.user_id] : null;
    const userName = profile?.full_name || 'Sistema';
    
    const matchesSearch = log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.resource_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (log.ip_address && String(log.ip_address).includes(searchTerm));
    
    const matchesUser = !userFilter || userName.toLowerCase().includes(userFilter.toLowerCase());
    
    const matchesDate = filterByDateRange(log.created_at);
    
    return matchesSearch && matchesUser && matchesDate;
  });

  const getCurrentLogs = () => {
    if (activeTab === 'bookings') return filteredBookingLogs;
    if (activeTab === 'school-planning') return filteredSchoolPlanningLogs;
    return filteredAuditLogs;
  };

  const currentLogs = getCurrentLogs();
  const totalPages = Math.ceil(currentLogs.length / ITEMS_PER_PAGE);
  const paginatedLogs = currentLogs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const clearFilters = () => {
    setSearchTerm('');
    setActionFilter('all');
    setModuleFilter('all');
    setUserFilter('');
    setDateRange({
      from: subDays(new Date(), 30),
      to: new Date()
    });
  };

  const exportToCSV = () => {
    const logs = getCurrentLogs();
    let csvContent = '';
    
    if (activeTab === 'bookings') {
      csvContent = 'Data,Usuário,Ação,Tipo,Turma,Detalhes\n';
      (logs as BookingLog[]).forEach(log => {
        csvContent += `"${format(new Date(log.created_at), 'dd/MM/yyyy HH:mm')}","${log.full_name}","${log.action}","${log.booking_type}","${log.class_name}","${log.quantity || ''}"\n`;
      });
    } else if (activeTab === 'school-planning') {
      csvContent = 'Data,Usuário,Email,Ação,Tabela\n';
      (logs as SchoolPlanningLog[]).forEach(log => {
        csvContent += `"${format(new Date(log.created_at), 'dd/MM/yyyy HH:mm')}","${log.user_name}","${log.user_email}","${log.action}","${log.table_name}"\n`;
      });
    } else {
      csvContent = 'Data,Usuário,Ação,Recurso,IP\n';
      (logs as AuditLog[]).forEach(log => {
        const profile = log.user_id ? userProfiles[log.user_id] : null;
        csvContent += `"${format(new Date(log.created_at), 'dd/MM/yyyy HH:mm')}","${profile?.full_name || 'Sistema'}","${log.action}","${log.resource_type}","${log.ip_address || ''}"\n`;
      });
    }
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `audit_logs_${activeTab}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const getDateRangeLabel = () => {
    if (!dateRange?.from) return 'Selecionar período';
    if (!dateRange.to) return format(dateRange.from, 'dd/MM/yyyy', { locale: ptBR });
    return `${format(dateRange.from, 'dd/MM', { locale: ptBR })} - ${format(dateRange.to, 'dd/MM/yyyy', { locale: ptBR })}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
          <p className="text-muted-foreground">Carregando logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Icon icon="solar:document-text-bold-duotone" className="h-7 w-7 text-primary" />
            Logs de Auditoria
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitoramento completo de atividades, ações e modificações no sistema.
          </p>
        </div>
        <Button onClick={exportToCSV} className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="bg-card border rounded-xl p-4 space-y-4">
        {/* Search Bar */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição, ID ou endereço IP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-background"
            />
          </div>
          <div className="relative md:w-64">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filtrar por usuário..."
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="pl-10 bg-background"
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span className="font-medium">FILTROS:</span>
          </div>

          {/* Date Range Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-2">
                <CalendarIcon className="h-3.5 w-3.5" />
                {getDateRangeLabel()}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>

          {/* Action Filter */}
          <Select value={actionFilter} onValueChange={(v) => setActionFilter(v as ActionType)}>
            <SelectTrigger className="h-8 w-auto min-w-[120px]">
              <SelectValue placeholder="Ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ação: Todas</SelectItem>
              <SelectItem value="create">Criações</SelectItem>
              <SelectItem value="update">Atualizações</SelectItem>
              <SelectItem value="delete">Exclusões</SelectItem>
              <SelectItem value="cancel">Cancelamentos</SelectItem>
              <SelectItem value="login">Logins</SelectItem>
            </SelectContent>
          </Select>

          {/* Module Filter (only for bookings) */}
          {activeTab === 'bookings' && (
            <Select value={moduleFilter} onValueChange={(v) => setModuleFilter(v as ModuleType)}>
              <SelectTrigger className="h-8 w-auto min-w-[130px]">
                <SelectValue placeholder="Módulo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Módulo: Todos</SelectItem>
                <SelectItem value="chromebook">Chromebooks</SelectItem>
                <SelectItem value="room">Salas</SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* Clear Filters */}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearFilters}
            className="h-8 text-primary hover:text-primary/80"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Limpar filtros
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        <Button 
          variant={activeTab === 'bookings' ? 'default' : 'outline'}
          onClick={() => setActiveTab('bookings')}
          className="flex items-center gap-2"
        >
          <CalendarIcon className="h-4 w-4" />
          Agendamentos
          <Badge variant="secondary" className="ml-1">{filteredBookingLogs.length}</Badge>
        </Button>
        <Button 
          variant={activeTab === 'school-planning' ? 'default' : 'outline'}
          onClick={() => setActiveTab('school-planning')}
          className="flex items-center gap-2"
        >
          <GraduationCap className="h-4 w-4" />
          Planejamento Escolar
          <Badge variant="secondary" className="ml-1">{filteredSchoolPlanningLogs.length}</Badge>
        </Button>
        <Button 
          variant={activeTab === 'security' ? 'default' : 'outline'}
          onClick={() => setActiveTab('security')}
          className="flex items-center gap-2"
        >
          <Shield className="h-4 w-4" />
          Segurança
          <Badge variant="secondary" className="ml-1">{filteredAuditLogs.length}</Badge>
        </Button>
        <Button variant="outline" onClick={fetchLogs} className="ml-auto">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left py-4 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                  Data/Hora
                </th>
                <th className="text-left py-4 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                  Usuário
                </th>
                <th className="text-left py-4 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                  Ação
                </th>
                <th className="text-left py-4 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                  Módulo / Alvo
                </th>
                <th className="text-left py-4 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                  Descrição
                </th>
                {activeTab === 'security' && (
                  <th className="text-right py-4 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    Endereço IP
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'security' ? 6 : 5} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Icon icon="solar:document-text-line-duotone" className="h-12 w-12 text-muted-foreground/50" />
                      <h3 className="font-medium text-foreground">Nenhum log encontrado</h3>
                      <p className="text-sm text-muted-foreground">Tente ajustar os filtros de busca.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => {
                  const type = activeTab === 'bookings' ? 'booking' : activeTab === 'school-planning' ? 'planning' : 'security';
                  const userInfo = getUserInfo(log, type);
                  const action = type === 'booking' ? (log as BookingLog).action : 
                                type === 'planning' ? (log as SchoolPlanningLog).action : 
                                (log as AuditLog).action;
                  
                  return (
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-4 px-4">
                        <div className="text-sm">
                          <p className="font-medium text-foreground">
                            {format(new Date(log.created_at), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border">
                            <AvatarImage src={userInfo.avatar} />
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {getInitials(userInfo.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm text-foreground">{userInfo.name}</p>
                            <p className="text-xs text-muted-foreground">{userInfo.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        {getActionBadge(action, type)}
                      </td>
                      <td className="py-4 px-4">
                        {getModuleDisplay(log, type)}
                      </td>
                      <td className="py-4 px-4">
                        <p className="text-sm text-foreground max-w-xs truncate">
                          {getDescription(log, type)}
                        </p>
                      </td>
                      {activeTab === 'security' && (
                        <td className="py-4 px-4 text-right">
                          <span className="font-mono text-xs text-muted-foreground">
                            {(log as AuditLog).ip_address ? String((log as AuditLog).ip_address) : '—'}
                          </span>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
            <p className="text-sm text-muted-foreground">
              Mostrando <span className="font-medium text-foreground">{((currentPage - 1) * ITEMS_PER_PAGE) + 1}</span> a{' '}
              <span className="font-medium text-foreground">{Math.min(currentPage * ITEMS_PER_PAGE, currentLogs.length)}</span> de{' '}
              <span className="font-medium text-foreground">{currentLogs.length}</span> resultados
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? 'default' : 'ghost'}
                      size="sm"
                      className="w-8 h-8 p-0"
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Próximo
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}