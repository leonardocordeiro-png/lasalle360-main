-- ============================================================================
-- MIGRATION: Harden SECURITY DEFINER Functions
-- Description: Add validation and permission checks to security-critical functions
-- ============================================================================

-- 1. Update insert_security_audit_log with strict validation
CREATE OR REPLACE FUNCTION public.insert_security_audit_log(
  p_action text,
  p_user_id uuid DEFAULT NULL::uuid,
  p_resource_type text DEFAULT 'system'::text,
  p_resource_id text DEFAULT NULL::text,
  p_ip_address inet DEFAULT NULL::inet,
  p_session_id text DEFAULT NULL::text,
  p_user_agent text DEFAULT NULL::text,
  p_additional_data jsonb DEFAULT NULL::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  audit_id uuid;
  v_action TEXT := LEFT(TRIM(p_action), 100);
  v_resource_type TEXT := LEFT(TRIM(p_resource_type), 50);
  v_resource_id TEXT := LEFT(TRIM(p_resource_id), 255);
  v_session_id TEXT := LEFT(TRIM(p_session_id), 255);
  v_user_agent TEXT := LEFT(TRIM(p_user_agent), 500);
  v_calling_user uuid;
  v_jsonb_size int;
BEGIN
  -- Validate calling user matches p_user_id
  v_calling_user := auth.uid();
  
  -- Only admins can log for other users
  IF p_user_id IS NOT NULL AND p_user_id != v_calling_user THEN
    IF NOT public.has_role(v_calling_user, 'admin'::app_role) THEN
      RAISE EXCEPTION 'Unauthorized: Cannot create audit logs for other users';
    END IF;
  END IF;
  
  -- Validate JSONB size (max 100KB)
  IF p_additional_data IS NOT NULL THEN
    v_jsonb_size := length(p_additional_data::text);
    IF v_jsonb_size > 102400 THEN
      RAISE EXCEPTION 'additional_data too large: % bytes (max 100KB)', v_jsonb_size;
    END IF;
  END IF;
  
  -- Validate action whitelist
  IF v_action NOT IN (
    'login', 'logout', 'signup', 'password_reset',
    'booking_created', 'booking_updated', 'booking_cancelled',
    'loan_created', 'loan_returned', 'equipment_loaned', 'equipment_returned',
    'user_created', 'user_updated', 'user_deleted', 'user_blocked',
    'admin_access', 'permission_granted', 'permission_revoked',
    'security_monitoring_accessed', 'audit_log_viewed',
    'council_created', 'council_updated', 'council_approved',
    'email_domain_validated', 'valid_email_domain_signup', 
    'invalid_email_domain_signup_attempt', 'error_occurred'
  ) THEN
    RAISE EXCEPTION 'Invalid action: %', v_action;
  END IF;

  -- Insert with validated values
  INSERT INTO public.security_audit_log (
    action,
    user_id,
    resource_type,
    resource_id,
    ip_address,
    session_id,
    user_agent,
    additional_data
  ) VALUES (
    v_action,
    COALESCE(p_user_id, v_calling_user),
    v_resource_type,
    v_resource_id,
    p_ip_address,
    v_session_id,
    v_user_agent,
    p_additional_data
  ) RETURNING id INTO audit_id;
  
  RETURN audit_id;
END;
$function$;

-- 2. Update sync_equipment_loan_status with permission checks
CREATE OR REPLACE FUNCTION public.sync_equipment_loan_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  equip_id UUID;
  patrimony_number TEXT;
  v_user_has_permission BOOLEAN;
BEGIN
  -- Verify user has write permission on loans_management
  v_user_has_permission := public.user_has_permission_level(
    auth.uid(), 
    'loans_management'::text, 
    'write'::text
  );
  
  IF NOT v_user_has_permission THEN
    RAISE EXCEPTION 'Unauthorized: User does not have permission to manage loans';
  END IF;

  -- Single equipment loan
  IF NEW.equipment_id IS NOT NULL THEN
    equip_id := NEW.equipment_id;
    patrimony_number := NEW.chromebook_number;
  ELSIF NEW.quantity > 1 AND NEW.equipment_id IS NULL THEN
    RETURN NEW;
  ELSE
    SELECT id INTO equip_id
    FROM it_equipment
    WHERE patrimony = NEW.chromebook_number
    LIMIT 1;
    patrimony_number := NEW.chromebook_number;
  END IF;

  IF equip_id IS NOT NULL THEN
    IF NEW.equipment_id IS NULL THEN
      NEW.equipment_id := equip_id;
    END IF;

    -- Creating or changing to em_uso/atrasado
    IF (TG_OP = 'INSERT' AND NEW.status IN ('em_uso', 'atrasado')) OR
       (TG_OP = 'UPDATE' AND NEW.status IN ('em_uso', 'atrasado') AND OLD.status != NEW.status) THEN
      
      -- Verify equipment is not already loaned
      IF EXISTS (
        SELECT 1 FROM it_equipment 
        WHERE id = equip_id AND status = 'EMPRESTIMO'
      ) THEN
        RAISE EXCEPTION 'Equipment % is already on loan', patrimony_number;
      END IF;
      
      UPDATE it_equipment
      SET status = 'EMPRESTIMO'
      WHERE id = equip_id;
      
      INSERT INTO security_audit_log (
        action, user_id, resource_type, resource_id, additional_data
      ) VALUES (
        'equipment_loaned', auth.uid(), 'it_equipment', equip_id::text,
        jsonb_build_object(
          'loan_id', NEW.id,
          'patrimony', patrimony_number,
          'borrower', NEW.borrower_name,
          'old_status', 'ATIVO',
          'new_status', 'EMPRESTIMO'
        )
      );
      
    ELSIF TG_OP = 'UPDATE' AND NEW.status = 'devolvido' AND OLD.status != 'devolvido' THEN
      
      UPDATE it_equipment
      SET status = 'ATIVO'
      WHERE id = equip_id;
      
      INSERT INTO security_audit_log (
        action, user_id, resource_type, resource_id, additional_data
      ) VALUES (
        'equipment_returned', auth.uid(), 'it_equipment', equip_id::text,
        jsonb_build_object(
          'loan_id', NEW.id,
          'patrimony', patrimony_number,
          'borrower', NEW.borrower_name,
          'old_status', 'EMPRESTIMO',
          'new_status', 'ATIVO'
        )
      );
      
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 3. Update log_school_planning_change with NULL checks
CREATE OR REPLACE FUNCTION public.log_school_planning_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_email text;
  v_user_name text;
  v_changes jsonb := '{}'::jsonb;
  v_key text;
  v_user_id uuid;
BEGIN
  -- Get and validate user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: No authenticated user for school planning change';
  END IF;
  
  -- Get user information with fallbacks
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  SELECT full_name INTO v_user_name FROM public.profiles WHERE user_id = v_user_id;
  
  IF v_user_email IS NULL THEN
    v_user_email := 'unknown@lasalle.org.br';
  END IF;
  
  IF v_user_name IS NULL THEN
    v_user_name := 'Unknown User';
  END IF;
  
  -- Build changes object for UPDATE
  IF TG_OP = 'UPDATE' THEN
    FOR v_key IN SELECT jsonb_object_keys(to_jsonb(NEW))
    LOOP
      IF to_jsonb(OLD)->>v_key IS DISTINCT FROM to_jsonb(NEW)->>v_key THEN
        v_changes := v_changes || jsonb_build_object(
          v_key,
          jsonb_build_object(
            'old', to_jsonb(OLD)->v_key,
            'new', to_jsonb(NEW)->v_key
          )
        );
      END IF;
    END LOOP;
  END IF;
  
  -- Insert audit log
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.school_planning_audit_log (
      user_id, user_email, user_name, action, table_name,
      record_id, old_data, new_data, changes
    ) VALUES (
      v_user_id, v_user_email, v_user_name, 'DELETE', TG_TABLE_NAME,
      OLD.id, to_jsonb(OLD), NULL, NULL
    );
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.school_planning_audit_log (
      user_id, user_email, user_name, action, table_name,
      record_id, old_data, new_data, changes
    ) VALUES (
      v_user_id, v_user_email, v_user_name, 'UPDATE', TG_TABLE_NAME,
      NEW.id, to_jsonb(OLD), to_jsonb(NEW), v_changes
    );
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.school_planning_audit_log (
      user_id, user_email, user_name, action, table_name,
      record_id, old_data, new_data, changes
    ) VALUES (
      v_user_id, v_user_email, v_user_name, 'INSERT', TG_TABLE_NAME,
      NEW.id, NULL, to_jsonb(NEW), NULL
    );
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$function$;

COMMENT ON FUNCTION public.insert_security_audit_log IS 'SECURITY: Validates audit log insertions with action whitelist, size limits, and permission checks';
COMMENT ON FUNCTION public.sync_equipment_loan_status IS 'SECURITY: Validates loan permissions before updating equipment status';
COMMENT ON FUNCTION public.log_school_planning_change IS 'SECURITY: Ensures authenticated user before logging school planning changes';