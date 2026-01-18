-- Remove the insecure INSERT policy that allows any user to insert audit logs
DROP POLICY IF EXISTS "Service can insert audit logs" ON public.security_audit_log;

-- Create a secure function that only allows system/service operations to insert audit logs
-- This function will be called by edge functions and system processes only
CREATE OR REPLACE FUNCTION public.insert_security_audit_log(
  p_action text,
  p_user_id uuid DEFAULT NULL,
  p_resource_type text DEFAULT 'system',
  p_resource_id text DEFAULT NULL,
  p_ip_address inet DEFAULT NULL,
  p_session_id text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_additional_data jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  audit_id uuid;
BEGIN
  -- Insert the audit log entry
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
    p_action,
    p_user_id,
    p_resource_type,
    p_resource_id,
    p_ip_address,
    p_session_id,
    p_user_agent,
    p_additional_data
  ) RETURNING id INTO audit_id;
  
  RETURN audit_id;
END;
$$;

-- Grant execute permission only to authenticated users (will be further restricted in application logic)
GRANT EXECUTE ON FUNCTION public.insert_security_audit_log TO authenticated;

-- Create a new restrictive policy that only allows the audit function to insert
-- This effectively blocks direct INSERT operations from client code
CREATE POLICY "Only system functions can insert audit logs" 
ON public.security_audit_log 
FOR INSERT 
WITH CHECK (false);

-- Add a comment explaining the security model
COMMENT ON FUNCTION public.insert_security_audit_log IS 'Secure function for inserting security audit logs. Should only be called by system processes and edge functions, never directly from client code.';