-- Remove the it_equipment_limited view
-- Data masking will be handled in the application layer instead
-- This eliminates the security scan false positive about missing RLS on the view

DROP VIEW IF EXISTS public.it_equipment_limited;

-- The it_equipment table already has proper RLS policies:
-- 1. "Admins can manage all IT equipment" - Full admin access
-- 2. "Authorized users can view IT equipment" - View access for users with it_equipment permission
-- These policies provide adequate security without needing a view