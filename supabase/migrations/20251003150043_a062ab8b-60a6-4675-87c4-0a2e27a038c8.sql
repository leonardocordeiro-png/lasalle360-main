-- Fix: rewrite user_has_module_access to remove dependency on non-existent profiles.is_admin
CREATE OR REPLACE FUNCTION public.user_has_module_access(
  p_user_id uuid,
  p_module_name text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_blocked boolean;
  v_is_admin boolean;
  v_has_permission boolean;
BEGIN
  -- If user profile indicates blocked, deny access
  SELECT is_blocked INTO v_is_blocked
  FROM public.profiles
  WHERE user_id = p_user_id;

  IF COALESCE(v_is_blocked, false) THEN
    RETURN false;
  END IF;

  -- Admins have access to all modules
  v_is_admin := public.has_role(p_user_id, 'admin');
  IF v_is_admin THEN
    RETURN true;
  END IF;

  -- Check explicit permission record
  SELECT can_access INTO v_has_permission
  FROM public.user_permissions
  WHERE user_id = p_user_id AND module_name = p_module_name;

  -- Default to true for backward compatibility when no record exists
  RETURN COALESCE(v_has_permission, true);
END;
$function$;