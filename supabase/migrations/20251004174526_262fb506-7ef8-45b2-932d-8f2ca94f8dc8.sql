-- Add comprehensive RLS policies for security_audit_log table
-- to prevent unauthorized log tampering

-- Policy 1: Prevent all direct INSERTs (logs should only be created via the security definer function)
CREATE POLICY "Prevent direct inserts to audit log"
ON public.security_audit_log
FOR INSERT
TO authenticated
WITH CHECK (false);

-- Policy 2: Prevent all UPDATEs (audit logs should be immutable)
CREATE POLICY "Audit logs are immutable - no updates"
ON public.security_audit_log
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

-- Policy 3: Prevent all DELETEs except by admins (for data retention management)
CREATE POLICY "Only admins can delete audit logs"
ON public.security_audit_log
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add comment explaining the security model
COMMENT ON TABLE public.security_audit_log IS 
'Security audit log table with immutable records. INSERT only via insert_security_audit_log() function. UPDATE blocked. DELETE admin-only.';