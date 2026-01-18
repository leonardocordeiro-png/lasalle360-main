-- CRITICAL FIX: Remove obsolete function that references non-existent is_admin column
-- The old is_admin_user function was attempting to query profiles.is_admin which was removed
-- All code now uses has_role() function with user_roles table instead

DROP FUNCTION IF EXISTS public.is_admin_user(uuid);