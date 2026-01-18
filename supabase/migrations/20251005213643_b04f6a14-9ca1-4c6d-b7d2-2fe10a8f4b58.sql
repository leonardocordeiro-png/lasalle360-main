-- Fase 1: Adicionar coluna permission_level à tabela user_permissions
ALTER TABLE user_permissions 
ADD COLUMN IF NOT EXISTS permission_level TEXT DEFAULT 'write' 
CHECK (permission_level IN ('none', 'read', 'write'));

-- Atualizar permissões existentes para 'write' (comportamento padrão atual)
UPDATE user_permissions 
SET permission_level = 'write' 
WHERE permission_level IS NULL;

-- Criar função para verificar nível de permissão
CREATE OR REPLACE FUNCTION user_has_permission_level(
  p_user_id uuid, 
  p_module_name text, 
  p_required_level text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_is_admin boolean;
  v_permission_level text;
  v_can_access boolean;
BEGIN
  -- Admins têm acesso total automático
  v_is_admin := public.has_role(p_user_id, 'admin');
  IF v_is_admin THEN
    RETURN true;
  END IF;

  -- Buscar permissão do usuário
  SELECT permission_level, can_access 
  INTO v_permission_level, v_can_access
  FROM public.user_permissions
  WHERE user_id = p_user_id AND module_name = p_module_name;

  -- Se não tem acesso, retornar false
  IF NOT COALESCE(v_can_access, false) THEN
    RETURN false;
  END IF;

  -- Verificar hierarquia: write > read > none
  CASE p_required_level
    WHEN 'write' THEN
      RETURN v_permission_level = 'write';
    WHEN 'read' THEN
      RETURN v_permission_level IN ('read', 'write');
    ELSE
      RETURN false;
  END CASE;
END;
$$;

-- Atualizar RLS policies da tabela it_equipment
DROP POLICY IF EXISTS "Authorized users can view IT equipment" ON it_equipment;
DROP POLICY IF EXISTS "Admins can manage all IT equipment" ON it_equipment;

-- Nova política para leitura (read ou write)
CREATE POLICY "Users with read permission can view IT equipment"
ON it_equipment FOR SELECT
USING (
  user_has_permission_level(auth.uid(), 'admin_it_equipment', 'read')
);

-- Nova política para escrita (apenas write)
CREATE POLICY "Users with write permission can manage IT equipment"
ON it_equipment FOR ALL
USING (
  user_has_permission_level(auth.uid(), 'admin_it_equipment', 'write')
);