-- Fix security issue: Remove overly permissive INSERT policy on security_audit_log
-- This prevents malicious users from poisoning audit logs with fake entries
-- The insert_security_audit_log() SECURITY DEFINER function will still work
-- because it runs with elevated privileges and bypasses RLS

DROP POLICY IF EXISTS "Allow system function insertions to audit log" ON public.security_audit_log;

-- Audit logs should only be inserted through the secure function, not directly by users
-- No new INSERT policy needed - the SECURITY DEFINER function will handle all inserts