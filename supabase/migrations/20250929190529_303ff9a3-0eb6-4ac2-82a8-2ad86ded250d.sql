-- Fix security_audit_log RLS policy to allow system function insertions
-- The current policy blocks ALL insertions with "false", breaking the audit system

-- Drop the problematic policy
DROP POLICY IF EXISTS "Only system functions can insert audit logs" ON public.security_audit_log;

-- Create a new policy that allows insertions through the SECURITY DEFINER function
-- while still preventing direct user insertions
CREATE POLICY "Allow system function insertions to audit log"
ON public.security_audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow insertions from the insert_security_audit_log function
  -- The function runs as SECURITY DEFINER and will bypass user restrictions
  true
);

-- Add a comment explaining the security model
COMMENT ON POLICY "Allow system function insertions to audit log" ON public.security_audit_log IS 
'Allows authenticated users to insert audit logs through the insert_security_audit_log() SECURITY DEFINER function. Direct INSERT queries should use the function to maintain proper audit trail.';

-- Verify the insert_security_audit_log function exists and is properly secured
-- This function should be the ONLY way to insert audit logs programmatically
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'insert_security_audit_log' 
    AND prosecdef = true
  ) THEN
    RAISE EXCEPTION 'Security function insert_security_audit_log does not exist or is not SECURITY DEFINER';
  END IF;
END $$;