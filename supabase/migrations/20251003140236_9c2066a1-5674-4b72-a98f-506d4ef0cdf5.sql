-- =====================================================
-- CRITICAL SECURITY FIX: Privilege Escalation Prevention
-- =====================================================
-- This migration fixes a critical vulnerability where users could
-- self-assign admin privileges by updating profiles.is_admin

-- Step 1: Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Step 2: Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    granted_by UUID REFERENCES auth.users(id),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Step 3: Create Security Definer Function for Role Checks
-- This prevents recursive RLS issues
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Step 4: Create RLS Policies for user_roles
CREATE POLICY "Only admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Step 5: Migrate existing admins to user_roles table
INSERT INTO public.user_roles (user_id, role, granted_by)
SELECT user_id, 'admin'::app_role, user_id
FROM public.profiles
WHERE is_admin = true;

-- Step 6: Update ALL RLS policies to use has_role() instead of is_admin_user()

-- Update chromebook_bookings policies
DROP POLICY IF EXISTS "Admins can delete bookings" ON public.chromebook_bookings;
CREATE POLICY "Admins can delete bookings"
ON public.chromebook_bookings
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update any booking" ON public.chromebook_bookings;
CREATE POLICY "Admins can update any booking"
ON public.chromebook_bookings
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view all bookings" ON public.chromebook_bookings;
CREATE POLICY "Admins can view all bookings"
ON public.chromebook_bookings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Update chromebook_inventory policies
DROP POLICY IF EXISTS "Only admins can modify inventory" ON public.chromebook_inventory;
CREATE POLICY "Only admins can modify inventory"
ON public.chromebook_inventory
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Update it_equipment policies
DROP POLICY IF EXISTS "Admins can manage all IT equipment" ON public.it_equipment;
CREATE POLICY "Admins can manage all IT equipment"
ON public.it_equipment
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Update profiles policies
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Update room_bookings policies
DROP POLICY IF EXISTS "Admins can delete room bookings" ON public.room_bookings;
CREATE POLICY "Admins can delete room bookings"
ON public.room_bookings
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update any room booking" ON public.room_bookings;
CREATE POLICY "Admins can update any room booking"
ON public.room_bookings
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view all room bookings" ON public.room_bookings;
CREATE POLICY "Admins can view all room bookings"
ON public.room_bookings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Update security_audit_log policies
DROP POLICY IF EXISTS "Only admins can view audit logs" ON public.security_audit_log;
CREATE POLICY "Only admins can view audit logs"
ON public.security_audit_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Update system_config policies
DROP POLICY IF EXISTS "Only admins can insert system config" ON public.system_config;
CREATE POLICY "Only admins can insert system config"
ON public.system_config
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Only admins can update system config" ON public.system_config;
CREATE POLICY "Only admins can update system config"
ON public.system_config
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Only admins can view system config" ON public.system_config;
CREATE POLICY "Only admins can view system config"
ON public.system_config
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Update user_permissions policies
DROP POLICY IF EXISTS "Admins can manage all permissions" ON public.user_permissions;
CREATE POLICY "Admins can manage all permissions"
ON public.user_permissions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view all permissions" ON public.user_permissions;
CREATE POLICY "Admins can view all permissions"
ON public.user_permissions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Step 7: Drop the old is_admin_user function (now safe after all policy updates)
DROP FUNCTION IF EXISTS public.is_admin_user(uuid);

-- Step 8: Remove is_admin column from profiles (after migration)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_admin;

-- Step 9: Create view for IT equipment with masked sensitive data
CREATE OR REPLACE VIEW public.it_equipment_limited AS
SELECT 
  id, 
  equipment_type, 
  brand, 
  model, 
  sector, 
  status, 
  responsible,
  equipment_number,
  patrimony,
  created_at,
  updated_at,
  created_by,
  CASE 
    WHEN public.has_role(auth.uid(), 'admin') THEN mac_address
    ELSE '**:**:**:**:**:**'
  END as mac_address,
  CASE 
    WHEN public.has_role(auth.uid(), 'admin') THEN serial_number
    ELSE SUBSTRING(serial_number, 1, 4) || '****'
  END as serial_number
FROM public.it_equipment;