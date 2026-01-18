-- Fix Security Definer View issue
-- Make the view SECURITY INVOKER so it respects RLS policies

DROP VIEW IF EXISTS public.it_equipment_limited;

CREATE VIEW public.it_equipment_limited
WITH (security_invoker=on)
AS
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