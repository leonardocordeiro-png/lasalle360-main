-- ============================================================================
-- MIGRATION: Create Secure Views for Sensitive Data
-- Description: Create views that mask sensitive borrower and equipment data
-- ============================================================================

-- 1. View for chromebook_loans with data masking
CREATE OR REPLACE VIEW public.loans_safe_view AS
SELECT 
  l.id,
  l.equipment_type,
  l.quantity,
  l.loan_date,
  l.pickup_time,
  l.expected_return_date,
  l.return_time,
  l.status,
  l.created_at,
  l.created_by,
  l.equipment_id,
  
  -- Mask sensitive data for non-admins and non-creators
  CASE 
    WHEN public.has_role(auth.uid(), 'admin'::app_role) OR l.created_by = auth.uid()
    THEN l.borrower_name
    ELSE LEFT(l.borrower_name, 1) || '***' || RIGHT(l.borrower_name, 1)
  END AS borrower_name,
  
  CASE 
    WHEN public.has_role(auth.uid(), 'admin'::app_role) OR l.created_by = auth.uid()
    THEN l.class_name
    ELSE '***'
  END AS class_name,
  
  CASE 
    WHEN public.has_role(auth.uid(), 'admin'::app_role) OR l.created_by = auth.uid()
    THEN l.responsible_teacher
    ELSE '***'
  END AS responsible_teacher,
  
  CASE 
    WHEN public.has_role(auth.uid(), 'admin'::app_role) OR l.created_by = auth.uid()
    THEN l.chromebook_number
    ELSE 'XXXX'
  END AS chromebook_number,
  
  l.borrower_type,
  l.observations,
  l.returned_by,
  l.returned_at,
  l.notification_sent
FROM public.chromebook_loans l;

-- RLS on view using security_invoker
ALTER VIEW public.loans_safe_view SET (security_invoker = on);

-- 2. View for IT equipment with technical data protected
CREATE OR REPLACE VIEW public.it_equipment_safe_view AS
SELECT 
  e.id,
  e.equipment_type,
  e.brand,
  e.model,
  e.patrimony,
  e.sector,
  e.responsible,
  e.status,
  e.created_at,
  e.updated_at,
  e.equipment_number,
  e.description,
  
  -- Mask technical details for non-IT personnel
  CASE 
    WHEN public.has_role(auth.uid(), 'admin'::app_role) OR
         public.user_has_permission_level(auth.uid(), 'admin_it_equipment'::text, 'write'::text)
    THEN e.serial_number
    ELSE '***RESTRICTED***'
  END AS serial_number,
  
  CASE 
    WHEN public.has_role(auth.uid(), 'admin'::app_role) OR
         public.user_has_permission_level(auth.uid(), 'admin_it_equipment'::text, 'write'::text)
    THEN e.mac_address
    ELSE NULL
  END AS mac_address,
  
  CASE 
    WHEN public.has_role(auth.uid(), 'admin'::app_role) OR
         public.user_has_permission_level(auth.uid(), 'admin_it_equipment'::text, 'write'::text)
    THEN e.id_number
    ELSE NULL
  END AS id_number,
  
  e.created_by
FROM public.it_equipment e;

-- RLS on view
ALTER VIEW public.it_equipment_safe_view SET (security_invoker = on);

-- 3. Grant permissions
GRANT SELECT ON public.loans_safe_view TO authenticated;
GRANT SELECT ON public.it_equipment_safe_view TO authenticated;

COMMENT ON VIEW public.loans_safe_view IS 'SECURITY: Masks sensitive borrower information for non-admins and non-creators';
COMMENT ON VIEW public.it_equipment_safe_view IS 'SECURITY: Masks technical details (serial, MAC) for non-IT personnel';