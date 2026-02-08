import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { checkUserPermission, type PermissionLevel } from '@/lib/permissionsUtils';
import { toast } from '@/hooks/use-toast';
import { 
  Users, 
  Settings, 
  Activity, 
  BarChart3, 
  Chrome, 
  Shield, 
  ArrowLeft,
  Database,
  Clock,
  AlertCircle,
  Monitor,
  GraduationCap,
  BookOpen
} from 'lucide-react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import UserManagement from '@/components/admin/UserManagement';
import SystemSettings from '@/components/admin/SystemSettings';
import AuditLogs from '@/components/admin/AuditLogs';
import AdminStats from '@/components/admin/AdminStats';
import InventoryManagement from '@/components/admin/InventoryManagement';
import SecurityMonitoring from '@/components/admin/SecurityMonitoring';
import { ITEquipmentManagement } from '@/components/admin/ITEquipmentManagement';
import { SchoolPlanningModule } from '@/components/admin/SchoolPlanningModule';
import { CouncilClassModule } from '@/components/admin/CouncilClassModule';

interface Profile {
  full_name: string;
  email: string;
  avatar_url?: string;
  is_admin?: boolean; // Computed from user_roles
}

export default function AdminPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stats');
  const [adminPermissions, setAdminPermissions] = useState({
    it_equipment: { canAccess: false, level: 'none' as PermissionLevel },
    school_planning: { canAccess: false, level: 'none' as PermissionLevel },
    audit_logs: { canAccess: false, level: 'none' as PermissionLevel },
    council_class: { canAccess: false, level: 'none' as PermissionLevel }
  });

  useEffect(() => {
    // Check for tab parameter in URL
    const tabParam = searchParams.get('tab');
    if (tabParam && ['stats', 'users', 'inventory', 'it-equipment', 'school-planning', 'council-class', 'audit-logs', 'settings'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (profileError) throw profileError;

      // Check if user has admin role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user?.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (roleError && roleError.code !== 'PGRST116') throw roleError;

      const isAdmin = !!roleData;
      
      setProfile({
        ...profileData,
        is_admin: isAdmin
      });

      // Check admin module permissions if not admin
      if (!isAdmin && user?.id) {
        const [itEquip, schoolPlan, auditLogs, councilClass] = await Promise.all([
          checkUserPermission(user.id, 'admin_it_equipment'),
          checkUserPermission(user.id, 'admin_school_planning'),
          checkUserPermission(user.id, 'admin_audit_logs'),
          checkUserPermission(user.id, 'admin_council_class')
        ]);

        setAdminPermissions({
          it_equipment: itEquip,
          school_planning: schoolPlan,
          audit_logs: auditLogs,
          council_class: councilClass
        });
      } else if (isAdmin) {
        // Admins have full access to everything
        setAdminPermissions({
          it_equipment: { canAccess: true, level: 'write' },
          school_planning: { canAccess: true, level: 'write' },
          audit_logs: { canAccess: true, level: 'write' },
          council_class: { canAccess: true, level: 'write' }
        });
      }
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar o perfil",
      });
    } finally {
      setLoading(false);
    }
  };

  // Redirect if not admin
  if (!loading && (!profile || !profile.is_admin)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground shadow-lg border-b">
        <div className="container mx-auto px-2 sm:px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="text-primary-foreground hover:bg-primary-foreground/10"
              >
                <ArrowLeft className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Voltar</span>
              </Button>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="bg-white/10 p-1.5 sm:p-2 rounded-lg">
                  <Shield className="h-6 w-6 sm:h-8 sm:w-8" />
                </div>
                <div>
                  <h1 className="text-lg sm:text-2xl font-bold">Painel Administrativo</h1>
                  <p className="text-primary-foreground/80 text-xs sm:text-sm hidden sm:block">Gestão completa do sistema</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
              <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                <AvatarImage 
                  src={profile?.avatar_url} 
                  alt={profile?.full_name || 'Admin'} 
                />
                <AvatarFallback className="bg-primary-foreground/20 text-primary-foreground text-xs">
                  {profile?.full_name?.split(' ').map(n => n[0]).join('').substring(0, 2) || 'A'}
                </AvatarFallback>
              </Avatar>
              <div className="text-left sm:text-right">
                <p className="text-xs sm:text-sm font-medium">{profile?.full_name}</p>
                <Badge variant="secondary" className="text-xs">
                  <Shield className="h-3 w-3 mr-1" />
                  Admin
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
          <div className="overflow-x-auto pb-2">
            <TabsList className="flex flex-nowrap justify-start sm:justify-center min-w-max sm:min-w-0">
              <TabsTrigger value="stats" className="flex-shrink-0 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">
                <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Estatísticas</span>
                <span className="sm:hidden">Stats</span>
              </TabsTrigger>
              <TabsTrigger value="users" className="flex-shrink-0 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">
                <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Usuários</span>
                <span className="sm:hidden">Users</span>
              </TabsTrigger>
              <TabsTrigger value="inventory" className="flex-shrink-0 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">
                <Database className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Inventário</span>
                <span className="sm:hidden">Inv.</span>
              </TabsTrigger>
              {(profile?.is_admin || adminPermissions.it_equipment.canAccess) && (
                <TabsTrigger value="it-equipment" className="flex-shrink-0 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">
                  <Monitor className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden lg:inline">Equip. TI</span>
                  <span className="lg:hidden">TI</span>
                  {!profile?.is_admin && adminPermissions.it_equipment.level === 'read' && (
                    <Badge variant="outline" className="ml-1 text-xs px-1 py-0">R</Badge>
                  )}
                </TabsTrigger>
              )}
              {(profile?.is_admin || adminPermissions.school_planning.canAccess) && (
                <TabsTrigger value="school-planning" className="flex-shrink-0 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">
                  <GraduationCap className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden lg:inline">Planejamento</span>
                  <span className="lg:hidden">Planej.</span>
                  {!profile?.is_admin && adminPermissions.school_planning.level === 'read' && (
                    <Badge variant="outline" className="ml-1 text-xs px-1 py-0">R</Badge>
                  )}
                </TabsTrigger>
              )}
              {(profile?.is_admin || adminPermissions.council_class.canAccess) && (
                <TabsTrigger value="council-class" className="flex-shrink-0 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">
                  <BookOpen className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden lg:inline">Conselho</span>
                  <span className="lg:hidden">Cons.</span>
                  {!profile?.is_admin && adminPermissions.council_class.level === 'read' && (
                    <Badge variant="outline" className="ml-1 text-xs px-1 py-0">R</Badge>
                  )}
                </TabsTrigger>
              )}
              <TabsTrigger value="security" className="flex-shrink-0 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">
                <Shield className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Segurança</span>
                <span className="sm:hidden">Seg.</span>
              </TabsTrigger>
              {(profile?.is_admin || adminPermissions.audit_logs.canAccess) && (
                <TabsTrigger value="logs" className="flex-shrink-0 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">
                  <Activity className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Auditoria</span>
                  <span className="sm:hidden">Audit.</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="settings" className="flex-shrink-0 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">
                <Settings className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Configurações</span>
                <span className="sm:hidden">Config.</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="stats" className="space-y-6">
            <AdminStats />
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <UserManagement />
          </TabsContent>

          <TabsContent value="inventory" className="space-y-6">
            <InventoryManagement />
          </TabsContent>

          <TabsContent value="it-equipment" className="space-y-6">
            <ITEquipmentManagement />
          </TabsContent>

          <TabsContent value="school-planning" className="space-y-6">
            <SchoolPlanningModule />
          </TabsContent>

          <TabsContent value="council-class" className="space-y-6">
            <CouncilClassModule />
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <SecurityMonitoring />
          </TabsContent>

          <TabsContent value="logs" className="space-y-6">
            <AuditLogs />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <SystemSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}