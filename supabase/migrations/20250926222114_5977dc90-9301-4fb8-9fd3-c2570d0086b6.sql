-- Update validate_booking function to skip validations for cancellations
CREATE OR REPLACE FUNCTION public.validate_booking()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Skip all validations if this is a cancellation
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;
  
  -- Validate booking date is not in the past
  IF NEW.booking_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Booking date cannot be in the past';
  END IF;
  
  -- Validate booking date is within 3 months
  IF NEW.booking_date > CURRENT_DATE + INTERVAL '3 months' THEN
    RAISE EXCEPTION 'Booking date cannot be more than 3 months in advance';
  END IF;
  
  -- Validate weekday only (Monday=1, Sunday=7)
  IF EXTRACT(dow FROM NEW.booking_date) IN (0, 6) THEN
    RAISE EXCEPTION 'Bookings are only allowed on weekdays';
  END IF;
  
  -- Validate quantity is reasonable
  IF NEW.quantity <= 0 OR NEW.quantity > 50 THEN
    RAISE EXCEPTION 'Quantity must be between 1 and 50';
  END IF;
  
  -- Validate time slots
  IF NEW.start_time >= NEW.end_time THEN
    RAISE EXCEPTION 'Start time must be before end time';
  END IF;
  
  -- Sanitize text inputs
  NEW.class_name = trim(NEW.class_name);
  NEW.full_name = trim(NEW.full_name);
  
  RETURN NEW;
END;
$function$;