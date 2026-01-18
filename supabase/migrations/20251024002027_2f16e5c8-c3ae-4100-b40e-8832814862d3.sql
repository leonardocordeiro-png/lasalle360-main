-- ============================================================================
-- MIGRATION: Add Input Validation for Observations Fields
-- Description: Create validation trigger for observations fields
-- ============================================================================

-- Create validation function for observations
CREATE OR REPLACE FUNCTION public.validate_observations_field()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Validate length
  IF NEW.observations IS NOT NULL THEN
    IF length(NEW.observations) > 500 THEN
      RAISE EXCEPTION 'Observations field too long: % characters (max 500)', length(NEW.observations);
    END IF;
    
    -- Validate dangerous characters
    IF NEW.observations ~ '[<>{}]' THEN
      RAISE EXCEPTION 'Observations contains invalid characters: < > { }';
    END IF;
    
    -- Trim whitespace
    NEW.observations := trim(NEW.observations);
    
    -- Convert empty to NULL
    IF NEW.observations = '' THEN
      NEW.observations := NULL;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Apply trigger to chromebook_loans
DROP TRIGGER IF EXISTS validate_loan_observations ON public.chromebook_loans;
CREATE TRIGGER validate_loan_observations
  BEFORE INSERT OR UPDATE ON public.chromebook_loans
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_observations_field();

-- Apply trigger to room_bookings
DROP TRIGGER IF EXISTS validate_room_observations ON public.room_bookings;
CREATE TRIGGER validate_room_observations
  BEFORE INSERT OR UPDATE ON public.room_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_observations_field();

COMMENT ON FUNCTION public.validate_observations_field() IS 'SECURITY: Validates and sanitizes observations field: max 500 chars, no dangerous characters';