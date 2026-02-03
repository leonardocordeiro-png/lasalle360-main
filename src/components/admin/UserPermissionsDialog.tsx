import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { Loader2, Shield, Eye, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface UserPermission {
  id: string;
  module_name: string;
  can_access: boolean;
  permission_level: 'none' | 'read' | 'write';
}

interface UserPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

const AVAILABLE_MODULES = [
  // Módulos Dashboard (mantém comportamento ON/OFF simples)
  { 
    name: 'chromebooks', 
    label: 'Chromebooks', 
    category: 'dashboard',
    hasLevels: false,
    icon: '💻'
  },
  { 
    name: 'auditorio', 
    label: 'Auditório', 
    category: 'dashboard',
    hasLevels: false,
    icon: '🏫'
  },
  { 
    name: 'laboratorio', 
    label: 'Laboratório', 
    category: 'dashboard',
    hasLevels: false,
    icon: '🔬'
  },
  
  // Painel Administrativo (níveis de acesso)
  { 
    name: 'loans_management', 
    label: 'Empréstimos', 
    category: 'admin',
    hasLevels: true,
    icon: '📦',
    description: 'Gerenciar empréstimos de equipamentos'
  },
  { 
    name: 'admin_it_equipment', 
    label: 'Equipamentos de TI', 
    category: 'admin',
    hasLevels: true,
    icon: '🖥️',
    description: 'Gerenciar inventário de equipamentos'
  },
  { 
    name: 'admin_school_planning', 
    label: 'Planejamento Escolar', 
    category: 'admin',
    hasLevels: true,
    icon: '🎓',
    description: 'Planejar turmas e cenários'
  },
  { 
    name: 'admin_audit_logs', 
    label: 'Auditoria', 
    category: 'admin',
    hasLevels: false,
    icon: '📋',
    description: 'Visualizar logs do sistema'
  },
  { 
    name: 'admin_council_class', 
    label: 'Conselho de Classe', 
    category: 'admin',
    hasLevels: true,
    icon: '📚',
    description: 'Gerenciar atas de conselho de classe'
  },
  { 
    name: 'admin_salas_hoje', 
    label: 'Salas Hoje', 
    category: 'admin',
    hasLevels: false,
    icon: '🔑',
    description: 'Visualizar agendamentos do dia para controle de chaves'
  },
];

export function UserPermissionsDialog({ open, onOpenChange, userId, userName }: UserPermissionsDialogProps) {
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isApprover, setIsApprover] = useState(false);

  useEffect(() => {
    if (open && userId) {
      fetchPermissions();
      fetchApproverStatus();
    }
  }, [open, userId]);

  const fetchApproverStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('room_booking_approvers')
        .select('id, is_active')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data) {
        setIsApprover(data.is_active);
      } else {
        setIsApprover(false);
      }
    } catch (error) {
      console.error('Error fetching approver status:', error);
      setIsApprover(false);
    }
  };

  const toggleApprover = async (checked: boolean) => {
    setIsApprover(checked);
  };

  const fetchPermissions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_permissions' as any)
        .select('*')
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching permissions:', error);
        // If table doesn't exist yet, just use defaults
        const allPermissions: UserPermission[] = AVAILABLE_MODULES.map(module => ({
          id: '',
          module_name: module.name,
          can_access: true,
          permission_level: 'write' as const
        }));
        setPermissions(allPermissions);
        return;
      }

      // Initialize with default permissions for modules that don't have a record
      const allPermissions: UserPermission[] = AVAILABLE_MODULES.map(module => {
        const existing = (data as any)?.find((p: any) => p.module_name === module.name);
        return existing ? {
          id: (existing as any).id || '',
          module_name: (existing as any).module_name,
          can_access: (existing as any).can_access,
          permission_level: (existing as any).permission_level || 'write'
        } : {
          id: '',
          module_name: module.name,
          can_access: true,
          permission_level: 'write' as const
        };
      });

      setPermissions(allPermissions);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      // Fallback to defaults
      const allPermissions: UserPermission[] = AVAILABLE_MODULES.map(module => ({
        id: '',
        module_name: module.name,
        can_access: true,
        permission_level: 'write' as const
      }));
      setPermissions(allPermissions);
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (moduleName: string) => {
    setPermissions(prev =>
      prev.map(p => {
        if (p.module_name === moduleName) {
          const newCanAccess = !p.can_access;
          return {
            ...p,
            can_access: newCanAccess,
            // If access is granted, default to 'write' if it was 'none', otherwise keep current level.
            // If access is denied, set level to 'none'.
            permission_level: newCanAccess ? (p.permission_level === 'none' ? 'write' : p.permission_level) : 'none'
          };
        }
        return p;
      })
    );
  };

  const updatePermissionLevel = (moduleName: string, level: 'none' | 'read' | 'write') => {
    setPermissions(prev =>
      prev.map(p =>
        p.module_name === moduleName
          ? { 
              ...p, 
              permission_level: level, 
              can_access: level !== 'none' // Ensure can_access is consistent with level
            }
          : p
      )
    );
  };

  const savePermissions = async () => {
    try {
      setSaving(true);
      console.log('Saving permissions for user:', userId, 'Data:', permissions);

      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error("Usuário não autenticado para salvar permissões.");

      // Save approver status
      if (isApprover) {
        const { error: approverError } = await supabase
          .from('room_booking_approvers')
          .upsert({
            user_id: userId,
            is_active: true,
          }, { onConflict: 'user_id' });

        if (approverError) {
          console.error('Error saving approver status:', approverError);
        }
      } else {
        // Remove or deactivate approver
        const { error: deleteError } = await supabase
          .from('room_booking_approvers')
          .delete()
          .eq('user_id', userId);

        if (deleteError) {
          console.error('Error removing approver:', deleteError);
        }
      }

      // Upsert all permissions
      for (const permission of permissions) {
        if (permission.id) {
          // Update existing
          const { error } = await supabase
            .from('user_permissions' as any)
            .update({ 
              can_access: permission.can_access,
              permission_level: permission.permission_level
            })
            .eq('id', permission.id);

          if (error) {
            console.error(`Supabase error during permission update for module ${permission.module_name} (ID: ${permission.id}, User: ${userId}):`, error);
            throw error;
          }
        } else {
          // Insert new
          const { error } = await supabase
            .from('user_permissions' as any)
            .insert({
              user_id: userId,
              module_name: permission.module_name,
              can_access: permission.can_access,
              permission_level: permission.permission_level,
              created_by: currentUser.id // Add created_by for new entries
            });

          if (error) {
            console.error(`Supabase error during permission insert for module ${permission.module_name} (User: ${userId}):`, error);
            throw error;
          }
        }
      }

      toast({
        title: 'Sucesso',
        description: 'Permissões atualizadas com sucesso',
      });

      onOpenChange(false);
    } catch (error: any) { // Explicitly type error as any to access .message
      console.error('Error saving permissions:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Não foi possível salvar as permissões', // Display actual error message if available
      });
    } finally {
      setSaving(false);
    }
  };

  const getModuleLabel = (moduleName: string) => {
    return AVAILABLE_MODULES.find(m => m.name === moduleName)?.label || moduleName;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Shield className="h-5 w-5" />
            Permissões de Módulos
          </DialogTitle>
          <DialogDescription>
            Gerenciar acesso aos módulos para <strong>{userName}</strong>
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Dashboard Modules */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                📱 Módulos do Dashboard
              </h3>
              <div className="space-y-3">
                {permissions
                  .filter(p => AVAILABLE_MODULES.find(m => m.name === p.module_name)?.category === 'dashboard')
                  .map((permission) => {
                    const module = AVAILABLE_MODULES.find(m => m.name === permission.module_name);
                    return (
                      <div
                        key={permission.module_name}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                      >
                        <Label
                          htmlFor={permission.module_name}
                          className="flex flex-col space-y-1 cursor-pointer"
                        >
                          <span className="font-medium flex items-center gap-2">
                            <span>{module?.icon}</span>
                            {getModuleLabel(permission.module_name)}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {permission.can_access ? 'Acesso permitido' : 'Acesso bloqueado'}
                          </span>
                        </Label>
                        <Switch
                          id={permission.module_name}
                          checked={permission.can_access}
                          onCheckedChange={() => togglePermission(permission.module_name)}
                        />
                      </div>
                    );
                  })}
              </div>
            </div>

            <Separator />

            {/* Admin Panel Modules */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                🔧 Painel Administrativo
              </h3>
              <div className="space-y-4">
                {permissions
                  .filter(p => AVAILABLE_MODULES.find(m => m.name === p.module_name)?.category === 'admin')
                  .map((permission) => {
                    const module = AVAILABLE_MODULES.find(m => m.name === permission.module_name);
                    return (
                      <div
                        key={permission.module_name}
                        className="rounded-lg border p-4 space-y-3"
                      >
                        <div className="flex flex-wrap items-start gap-2">
                          <span className="text-xl">{module?.icon}</span>
                          <div className="flex-1">
                            <h4 className="font-medium">{getModuleLabel(permission.module_name)}</h4>
                            {module?.description && (
                              <p className="text-sm text-muted-foreground">{module.description}</p>
                            )}
                          </div>
                        </div>
                        
                        {module?.hasLevels ? (
                          <RadioGroup
                            value={permission.permission_level}
                            onValueChange={(value) => updatePermissionLevel(permission.module_name, value as any)}
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="none" id={`${permission.module_name}-none`} />
                              <Label htmlFor={`${permission.module_name}-none`} className="font-normal cursor-pointer">
                                Sem acesso
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="read" id={`${permission.module_name}-read`} />
                              <Label htmlFor={`${permission.module_name}-read`} className="font-normal cursor-pointer flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                Somente visualização
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="write" id={`${permission.module_name}-write`} />
                              <Label htmlFor={`${permission.module_name}-write`} className="font-normal cursor-pointer">
                                Visualização + Edição
                              </Label>
                            </div>
                          </RadioGroup>
                        ) : (
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <Label htmlFor={`${permission.module_name}-switch`} className="text-sm">
                              {permission.can_access ? 'Acesso permitido' : 'Acesso bloqueado'}
                            </Label>
                            <Switch
                              id={`${permission.module_name}-switch`}
                              checked={permission.can_access}
                              onCheckedChange={() => togglePermission(permission.module_name)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            <Separator />

            {/* Aprovador do Auditório */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                ✅ Aprovações
              </h3>
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex flex-wrap items-start gap-2">
                  <span className="text-xl">🏫</span>
                  <div className="flex-1">
                    <h4 className="font-medium">Aprovador do Auditório</h4>
                    <p className="text-sm text-muted-foreground">
                      Receber e-mails e aprovar reservas do Auditório
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="approver-switch" className="text-sm flex items-center gap-2">
                    {isApprover ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Este usuário é um aprovador
                      </>
                    ) : (
                      'Não é aprovador'
                    )}
                  </Label>
                  <Switch
                    id="approver-switch"
                    checked={isApprover}
                    onCheckedChange={toggleApprover}
                  />
                </div>
                {isApprover && (
                  <p className="text-xs text-muted-foreground bg-amber-50 p-2 rounded">
                    📧 Este usuário receberá e-mails quando alguém solicitar reserva do Auditório e poderá aprovar/rejeitar no sistema.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button onClick={savePermissions} disabled={loading || saving} className="w-full sm:w-auto">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar Permissões
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}