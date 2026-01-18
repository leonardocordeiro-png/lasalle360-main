import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type PermissionLevel = 'none' | 'read' | 'write';

export interface ModulePermission {
  canAccess: boolean;
  level: PermissionLevel;
}

/**
 * Verifica permissão do usuário para um módulo administrativo
 * Admins têm acesso 'write' automático
 */
export const checkUserPermission = async (
  userId: string,
  moduleName: string
): Promise<ModulePermission> => {
  try {
    // Verificar se é admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleData) {
      return { canAccess: true, level: 'write' };
    }

    // Verificar permissão específica
    const { data: permData } = await supabase
      .from('user_permissions')
      .select('can_access, permission_level')
      .eq('user_id', userId)
      .eq('module_name', moduleName)
      .maybeSingle();

    if (!permData || !permData.can_access) {
      return { canAccess: false, level: 'none' };
    }

    return {
      canAccess: true,
      level: (permData.permission_level || 'write') as PermissionLevel
    };
  } catch (error) {
    console.error('Error checking user permission:', error);
    return { canAccess: false, level: 'none' };
  }
};

/**
 * Hook para verificar permissões em componentes React
 */
export const useModulePermission = (moduleName: string) => {
  const [permission, setPermission] = useState<ModulePermission>({
    canAccess: false,
    level: 'none'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkPermission = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setPermission({ canAccess: false, level: 'none' });
        setLoading(false);
        return;
      }

      const perm = await checkUserPermission(user.id, moduleName);
      setPermission(perm);
      setLoading(false);
    };

    checkPermission();
  }, [moduleName]);

  return { ...permission, loading };
};
