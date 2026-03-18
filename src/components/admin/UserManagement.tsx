import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { 
  Users, 
  Search, 
  Shield, 
  ShieldOff, 
  Mail, 
  RotateCcw, 
  UserCheck, 
  Calendar,
  MoreHorizontal,
  Eye,
  EyeOff,
  Trash2,
  Ban,
  CheckCircle,
  Settings,
  UserPlus,
  Upload,
  ArrowDownAZ,
  ArrowUpAZ,
  Clock
} from 'lucide-react';
import { UserPermissionsDialog } from './UserPermissionsDialog';
import { CreateUserDialog } from './CreateUserDialog';
import { BulkUserImportDialog } from './BulkUserImportDialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface User {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at?: string;
  email_confirmed_at?: string;
  raw_user_meta_data?: any;
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  is_admin?: boolean;
  is_blocked: boolean;
  avatar_url?: string;
  created_at: string;
  last_login?: string;
}

interface UserWithProfile extends User {
  profiles: Profile;
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<string>('alpha-asc');
  const [selectedUser, setSelectedUser] = useState<UserWithProfile | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dataMaskingEnabled, setDataMaskingEnabled] = useState(true);
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false);
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);
  const [showBulkImportDialog, setShowBulkImportDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editFormData, setEditFormData] = useState({ full_name: '', email: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUsers();
    logAdminAccess();
  }, []);

  const logAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.rpc('insert_security_audit_log', {
          p_action: 'admin_user_management_access',
          p_user_id: user.id,
          p_resource_type: 'user_management',
          p_additional_data: JSON.stringify({
            timestamp: new Date().toISOString(),
            ip_address: 'masked_for_privacy'
          })
        });
      }
    } catch (error) {
      console.warn('Failed to log admin access:', error);
    }
  };

  const logAdminDataAccess = async (action: string, recordCount: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.rpc('insert_security_audit_log', {
          p_action: action,
          p_user_id: user.id,
          p_resource_type: 'data_access',
          p_additional_data: JSON.stringify({
            record_count: recordCount,
            data_masking_enabled: dataMaskingEnabled,
            timestamp: new Date().toISOString()
          })
        });
      }
    } catch (error) {
      console.warn('Failed to log data access:', error);
    }
  };

  const maskEmail = (email: string): string => {
    if (!dataMaskingEnabled) return email;
    const [local, domain] = email.split('@');
    if (local.length <= 2) return email;
    return `${local.substring(0, 2)}${'*'.repeat(local.length - 2)}@${domain}`;
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, email, full_name, avatar_url, created_at, last_login, is_blocked')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('role', 'admin');

      const adminUserIds = new Set(rolesData?.map(r => r.user_id) || []);

      await logAdminDataAccess('profiles_table_access', data?.length || 0);

      const usersWithProfiles = data.map((profile: any) => {
        const isAdmin = adminUserIds.has(profile.user_id);
        return {
          id: profile.user_id,
          email: profile.email,
          created_at: profile.created_at,
          last_sign_in_at: profile.last_login,
          email_confirmed_at: profile.created_at,
          raw_user_meta_data: {},
          profiles: {
            id: profile.id,
            user_id: profile.user_id,
            full_name: profile.full_name,
            email: profile.email,
            is_admin: isAdmin,
            is_blocked: profile.is_blocked || false,
            avatar_url: profile.avatar_url,
            created_at: profile.created_at,
            last_login: profile.last_login
          }
        };
      });

      setUsers(usersWithProfiles);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar os usuários",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users
    .filter(user => {
      const matchesSearch = user.profiles.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           user.email.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesRole = filterRole === 'all' || 
                         (filterRole === 'admin' && user.profiles.is_admin) ||
                         (filterRole === 'user' && !user.profiles.is_admin);
      
      return matchesSearch && matchesRole;
    })
    .sort((a, b) => {
      if (sortOrder === 'alpha-asc') {
        return a.profiles.full_name.localeCompare(b.profiles.full_name, 'pt-BR');
      } else if (sortOrder === 'alpha-desc') {
        return b.profiles.full_name.localeCompare(a.profiles.full_name, 'pt-BR');
      }
      // Default: recent first (by created_at descending)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const toggleAdminStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (currentStatus) {
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', 'admin');

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_roles')
          .insert({
            user_id: userId,
            role: 'admin',
            granted_by: user?.id
          });

        if (error) throw error;
      }

      await fetchUsers();
      toast({
        title: "Sucesso",
        description: `Privilégios de administrador ${!currentStatus ? 'concedidos' : 'removidos'} com sucesso`,
      });

      await supabase.rpc('insert_security_audit_log', {
        p_action: currentStatus ? 'admin_role_revoked' : 'admin_role_granted',
        p_user_id: user?.id,
        p_resource_type: 'user_roles',
        p_resource_id: userId,
        p_additional_data: JSON.stringify({
          target_user_id: userId,
          action: currentStatus ? 'revoke' : 'grant',
          timestamp: new Date().toISOString()
        })
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao alterar privilégios de administrador",
      });
    }
  };

  const toggleBlockedStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_blocked: !currentStatus } as any)
        .eq('user_id', userId);

      if (error) throw error;

      await fetchUsers();
      toast({
        title: "Sucesso",
        description: `Usuário ${!currentStatus ? 'bloqueado' : 'desbloqueado'} com sucesso`,
      });

      const { auditLog } = await import('@/lib/auditLogger');
      await auditLog({
        action: currentStatus ? 'unblock' : 'block',
        module: 'users',
        description: `Usuário ${!currentStatus ? 'bloqueado' : 'desbloqueado'}`,
        resourceId: userId,
        metadata: { target_user_id: userId }
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao alterar status de bloqueio",
      });
    }
  };

  const handleEditUser = (user: UserWithProfile) => {
    setSelectedUser(user);
    setEditFormData({
      full_name: user.profiles.full_name || '',
      email: user.profiles.email || user.email || ''
    });
    setShowEditDialog(true);
  };

  const saveUserEdit = async () => {
    if (!selectedUser) return;
    
    setSaving(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editFormData.full_name,
          email: editFormData.email
        } as any)
        .eq('user_id', selectedUser.id);

      if (error) throw error;

      await supabase.rpc('insert_security_audit_log', {
        p_action: 'user_profile_edited',
        p_user_id: currentUser?.id,
        p_resource_type: 'profiles',
        p_resource_id: selectedUser.id,
        p_additional_data: JSON.stringify({
          target_user_id: selectedUser.id,
          changes: {
            full_name: editFormData.full_name,
            email: editFormData.email
          },
          timestamp: new Date().toISOString()
        })
      });

      await fetchUsers();
      setShowEditDialog(false);
      toast({
        title: "Sucesso",
        description: "Dados do usuário atualizados com sucesso",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao atualizar dados do usuário",
      });
    } finally {
      setSaving(false);
    }
  };

  const resetUserPassword = async () => {
    if (!selectedUser) return;
    
    const isGoogleUser = selectedUser.raw_user_meta_data?.provider === 'google' || 
                        selectedUser.raw_user_meta_data?.iss === 'https://accounts.google.com';
    
    if (isGoogleUser) {
      toast({
        variant: "destructive",
        title: "Ação não permitida",
        description: "Usuários que fizeram login com Google não podem ter a senha resetada",
      });
      setShowResetDialog(false);
      return;
    }

    try {
      setResetting(true);
      
      const { error } = await supabase.auth.resetPasswordForEmail(selectedUser.email, {
        redirectTo: `${window.location.origin}/auth`
      });

      if (error) throw error;

      toast({
        title: "Email enviado",
        description: "Um email para resetar a senha foi enviado para o usuário",
      });
      
      setShowResetDialog(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao enviar email de reset de senha",
      });
    } finally {
      setResetting(false);
    }
  };
  
  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    try {
      setDeleting(true);
      const { error } = await supabase.functions.invoke('delete-user', {
        body: { user_id: selectedUser.id },
      });
      if (error) throw error;

      toast({
        title: 'Usuário excluído',
        description: 'O usuário foi removido com sucesso.',
      });

      setShowDeleteDialog(false);
      setSelectedUser(null);
      await fetchUsers();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível excluir o usuário.',
      });
    } finally {
      setDeleting(false);
    }
  };
  
  const getProviderBadge = (user: UserWithProfile) => {
    const isGoogleUser = user.raw_user_meta_data?.provider === 'google' || 
                        user.raw_user_meta_data?.iss === 'https://accounts.google.com';
    
    return isGoogleUser ? (
      <Badge variant="outline" className="text-xs">
        <Mail className="h-3 w-3 mr-1" />
        Google
      </Badge>
    ) : (
      <Badge variant="secondary" className="text-xs">
        <Mail className="h-3 w-3 mr-1" />
        Email
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Gerenciamento de Usuários
            </CardTitle>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={() => setShowBulkImportDialog(true)} className="w-full sm:w-auto">
                <Upload className="h-4 w-4 mr-2" />
                Importar em Lote
              </Button>
              <Button onClick={() => setShowCreateUserDialog(true)} className="w-full sm:w-auto">
                <UserPlus className="h-4 w-4 mr-2" />
                Criar Usuário
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuários..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Filtrar por papel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="admin">Administradores</SelectItem>
                <SelectItem value="user">Usuários</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Mais recentes
                  </div>
                </SelectItem>
                <SelectItem value="alpha-asc">
                  <div className="flex items-center gap-2">
                    <ArrowDownAZ className="h-4 w-4" />
                    A - Z
                  </div>
                </SelectItem>
                <SelectItem value="alpha-desc">
                  <div className="flex items-center gap-2">
                    <ArrowUpAZ className="h-4 w-4" />
                    Z - A
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={dataMaskingEnabled ? "default" : "outline"}
              onClick={() => {
                setDataMaskingEnabled(!dataMaskingEnabled);
                logAdminDataAccess('data_masking_toggle', users.length);
              }}
              className="flex items-center gap-2"
            >
              {dataMaskingEnabled ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {dataMaskingEnabled ? 'Dados Mascarados' : 'Mostrar Dados'}
            </Button>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Usuário</TableHead>
                  <TableHead className="whitespace-nowrap hidden md:table-cell">Email</TableHead>
                  <TableHead className="whitespace-nowrap">Papel</TableHead>
                  <TableHead className="whitespace-nowrap hidden lg:table-cell">Provedor</TableHead>
                  <TableHead className="whitespace-nowrap hidden lg:table-cell">Último Login</TableHead>
                  <TableHead className="whitespace-nowrap">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.profiles.avatar_url} alt={user.profiles.full_name} />
                          <AvatarFallback>
                            {user.profiles.full_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{user.profiles.full_name}</p>
                          <p className="text-sm text-muted-foreground">
                            Criado em {format(new Date(user.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-2 max-w-[200px]">
                        <span className="truncate">{maskEmail(user.email)}</span>
                        {dataMaskingEnabled && (
                          <Shield className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        {user.profiles.is_admin ? (
                          <Badge variant="default" className="text-xs">
                            <Shield className="h-3 w-3 mr-1" />
                            Admin
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            <UserCheck className="h-3 w-3 mr-1" />
                            Usuário
                          </Badge>
                        )}
                        {user.profiles.is_blocked && (
                          <Badge variant="destructive" className="text-xs">
                            <Ban className="h-3 w-3 mr-1" />
                            Bloqueado
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {getProviderBadge(user)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {user.last_sign_in_at ? (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm whitespace-nowrap">
                            {format(new Date(user.last_sign_in_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Nunca</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setSelectedUser(user);
                            setShowUserDetails(true);
                          }}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditUser(user)}>
                            <Settings className="h-4 w-4 mr-2" />
                            Editar Usuário
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleAdminStatus(user.id, user.profiles.is_admin)}>
                            {user.profiles.is_admin ? (
                              <>
                                <ShieldOff className="h-4 w-4 mr-2" />
                                Remover Admin
                              </>
                            ) : (
                              <>
                                <Shield className="h-4 w-4 mr-2" />
                                Tornar Admin
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleBlockedStatus(user.id, user.profiles.is_blocked)}>
                            {user.profiles.is_blocked ? (
                              <>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Desbloquear Usuário
                              </>
                            ) : (
                              <>
                                <Ban className="h-4 w-4 mr-2" />
                                Bloquear Usuário
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => {
                              setSelectedUser(user);
                              setShowPermissionsDialog(true);
                            }}
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            Gerenciar Permissões
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => {
                              setSelectedUser(user);
                              setShowResetDialog(true);
                            }}
                            disabled={user.raw_user_meta_data?.provider === 'google'}
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Reset Senha
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => {
                              setSelectedUser(user);
                              setShowDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir Usuário
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum usuário encontrado</h3>
              <p className="text-muted-foreground">Tente ajustar os filtros de busca.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reset Password Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resetar Senha</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja enviar um email de reset de senha para {selectedUser?.profiles.full_name}?
              {selectedUser?.raw_user_meta_data?.provider === 'google' && (
                <div className="mt-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <p className="text-sm text-destructive">
                    ⚠️ Este usuário fez login com Google e não pode ter a senha resetada.
                  </p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={resetUserPassword} 
              disabled={resetting || selectedUser?.raw_user_meta_data?.provider === 'google'}
            >
              {resetting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                  Enviando...
                </>
              ) : (
                'Enviar Email'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {selectedUser?.profiles.full_name}? Esta ação é irreversível e removerá seus dados e acesso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} disabled={deleting}>
              {deleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* User Details Dialog */}
      <Dialog open={showUserDetails} onOpenChange={setShowUserDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Usuário</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={selectedUser.profiles.avatar_url} alt={selectedUser.profiles.full_name} />
                  <AvatarFallback className="text-lg">
                    {selectedUser.profiles.full_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">{selectedUser.profiles.full_name}</h3>
                  <p className="text-muted-foreground">{selectedUser.email}</p>
                  <div className="flex gap-2 mt-2">
                    {selectedUser.profiles.is_admin ? (
                      <Badge variant="default">Administrador</Badge>
                    ) : (
                      <Badge variant="secondary">Usuário</Badge>
                    )}
                    {getProviderBadge(selectedUser)}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-medium">Criado em</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(selectedUser.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <p className="font-medium">Último Login</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedUser.last_sign_in_at 
                      ? format(new Date(selectedUser.last_sign_in_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                      : 'Nunca'
                    }
                  </p>
                </div>
                <div>
                  <p className="font-medium">Email Confirmado</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedUser.email_confirmed_at 
                      ? format(new Date(selectedUser.email_confirmed_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                      : 'Não confirmado'
                    }
                  </p>
                </div>
                <div>
                  <p className="font-medium">ID do Usuário</p>
                  <p className="text-sm text-muted-foreground font-mono break-all">{selectedUser.id}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* User Permissions Dialog */}
      {selectedUser && (
        <UserPermissionsDialog
          open={showPermissionsDialog}
          onOpenChange={setShowPermissionsDialog}
          userId={selectedUser.id}
          userName={selectedUser.profiles.full_name}
        />
      )}

      {/* Create User Dialog */}
      <CreateUserDialog
        open={showCreateUserDialog}
        onOpenChange={setShowCreateUserDialog}
        onUserCreated={fetchUsers}
      />

      {/* Bulk Import Dialog */}
      <BulkUserImportDialog
        open={showBulkImportDialog}
        onOpenChange={setShowBulkImportDialog}
        onUsersCreated={fetchUsers}
      />

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Altere os dados do usuário abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome Completo</label>
              <Input
                value={editFormData.full_name}
                onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
                placeholder="Nome completo do usuário"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                placeholder="Email do usuário"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={saveUserEdit} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}