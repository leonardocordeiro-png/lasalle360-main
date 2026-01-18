-- CRITICAL SECURITY FIX: Add authentication requirement to all sensitive tables
-- This prevents anonymous users from accessing any data

-- Profiles: Prevent anonymous access to user PII
CREATE POLICY "Require authentication to view profiles"
ON public.profiles FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Chromebook Bookings: Prevent tracking of user schedules
CREATE POLICY "Require authentication to view bookings"
ON public.chromebook_bookings FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Room Bookings: Prevent location tracking
CREATE POLICY "Require authentication to view room bookings"
ON public.room_bookings FOR SELECT
USING (auth.uid() IS NOT NULL);

-- IT Equipment: Prevent theft targeting
CREATE POLICY "Require authentication to view equipment"
ON public.it_equipment FOR SELECT
USING (auth.uid() IS NOT NULL);

-- User Permissions: Prevent privilege mapping exposure
CREATE POLICY "Require authentication to view permissions"
ON public.user_permissions FOR SELECT
USING (auth.uid() IS NOT NULL);

-- User Roles: Prevent admin identification
CREATE POLICY "Require authentication to view roles"
ON public.user_roles FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Security Audit Log: Prevent behavior analysis
CREATE POLICY "Require authentication to view audit logs"
ON public.security_audit_log FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Chromebook Inventory: Prevent theft planning
CREATE POLICY "Require authentication to view inventory"
ON public.chromebook_inventory FOR SELECT
USING (auth.uid() IS NOT NULL);

-- System Config: Prevent system info exposure
CREATE POLICY "Require authentication to view config"
ON public.system_config FOR SELECT
USING (auth.uid() IS NOT NULL);