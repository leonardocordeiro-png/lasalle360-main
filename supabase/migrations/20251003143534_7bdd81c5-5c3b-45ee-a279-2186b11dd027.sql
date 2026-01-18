-- CRITICAL SECURITY FIX: Remove overly permissive authentication-only SELECT policies
-- These policies allowed ANY authenticated user to see ALL data in sensitive tables
-- The existing user-specific and admin-specific policies provide proper access control

-- Remove permissive policy from profiles (users should only see their own profile + admins see all)
DROP POLICY IF EXISTS "Require authentication to view profiles" ON public.profiles;

-- Remove permissive policy from chromebook_bookings (users should only see their own bookings + admins see all)
DROP POLICY IF EXISTS "Require authentication to view bookings" ON public.chromebook_bookings;

-- Remove permissive policy from room_bookings (users should only see their own bookings + admins see all)
DROP POLICY IF EXISTS "Require authentication to view room bookings" ON public.room_bookings;

-- Remove permissive policy from it_equipment (only authorized users + admins should see equipment)
DROP POLICY IF EXISTS "Require authentication to view equipment" ON public.it_equipment;

-- Remove permissive policy from user_permissions (users should only see their own permissions + admins see all)
DROP POLICY IF EXISTS "Require authentication to view permissions" ON public.user_permissions;

-- Remove permissive policy from user_roles (users should only see their own roles + admins see all)
DROP POLICY IF EXISTS "Require authentication to view roles" ON public.user_roles;

-- Remove permissive policy from security_audit_log (only admins should view audit logs)
DROP POLICY IF EXISTS "Require authentication to view audit logs" ON public.security_audit_log;

-- Remove permissive policy from chromebook_inventory 
-- Note: "Authenticated users can view inventory" policy remains as it's needed for booking UI
DROP POLICY IF EXISTS "Require authentication to view inventory" ON public.chromebook_inventory;

-- Remove permissive policy from system_config (only admins should view config)
DROP POLICY IF EXISTS "Require authentication to view config" ON public.system_config;