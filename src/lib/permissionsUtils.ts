import { useQuery } from '@tanstack/react-query';
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
 * Hook para verificar permissões em componentes React.
 * Usa React Query para cachear resultados por 5 minutos,
 * evitando queries repetidas ao banco para cada render/mount.
 */
export const useModulePermission = (moduleName: string) => {
  const { data, isLoading } = useQuery({
    queryKey: ['module-permission', moduleName],
    queryFn: async (): Promise<ModulePermission> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { canAccess: false, level: 'none' };
      return checkUserPermission(user.id, moduleName);
    },
    staleTime: 5 * 60 * 1000, // cache por 5 minutos
    gcTime: 10 * 60 * 1000,   // mantém em memória por 10 minutos
    retry: 1,
  });

  return {
    canAccess: data?.canAccess ?? false,
    level: data?.level ?? 'none' as PermissionLevel,
    loading: isLoading,
  };
};
