-- Fix Critical Privacy Issue: Restrict booking visibility to users and admins only

-- Create security definer function to check admin role (prevents infinite recursion)
CREATE OR REPLACE FUNCTION public.is_admin_user(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = is_admin_user.user_id
      AND profiles.is_admin = true
  );
$$;

-- Drop the overly permissive policy that exposes all student data
DROP POLICY IF EXISTS "Users can view all bookings" ON public.chromebook_bookings;

-- Create new restricted policies for booking visibility
CREATE POLICY "Users can view their own bookings" 
ON public.chromebook_bookings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all bookings" 
ON public.chromebook_bookings 
FOR SELECT 
USING (public.is_admin_user(auth.uid()));

-- Update the update policy to use the security definer function
DROP POLICY IF EXISTS "Users can update their own bookings or admins can update any" ON public.chromebook_bookings;

CREATE POLICY "Users can update their own bookings" 
ON public.chromebook_bookings 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can update any booking" 
ON public.chromebook_bookings 
FOR UPDATE 
USING (public.is_admin_user(auth.uid()));

-- Add delete policy for admins only
CREATE POLICY "Admins can delete bookings" 
ON public.chromebook_bookings 
FOR DELETE 
USING (public.is_admin_user(auth.uid()));

-- Update profiles policy to allow admins to view all profiles (for admin dashboard)
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (public.is_admin_user(auth.uid()));

-- Add audit logging table for security monitoring
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Only admins can view audit logs" 
ON public.security_audit_log 
FOR SELECT 
USING (public.is_admin_user(auth.uid()));

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_chromebook_bookings_user_id ON public.chromebook_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_chromebook_bookings_status ON public.chromebook_bookings(status);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_created_at ON public.security_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_user_id ON public.security_audit_log(user_id);