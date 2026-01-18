-- Fix function search path security warnings
CREATE OR REPLACE FUNCTION public.validate_booking()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
$$;

CREATE OR REPLACE FUNCTION public.check_booking_availability(
  p_booking_date date,
  p_start_time time,
  p_end_time time,
  p_quantity integer,
  p_exclude_booking_id uuid DEFAULT NULL
)
RETURNS boolean 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_inventory integer;
  booked_quantity integer;
BEGIN
  -- Get total available inventory for the date
  SELECT COALESCE(total_available, 200) 
  INTO total_inventory
  FROM public.chromebook_inventory 
  WHERE date = p_booking_date;
  
  -- Calculate overlapping bookings
  SELECT COALESCE(SUM(quantity), 0)
  INTO booked_quantity
  FROM public.chromebook_bookings
  WHERE booking_date = p_booking_date
    AND status = 'active'
    AND (p_exclude_booking_id IS NULL OR id != p_exclude_booking_id)
    AND (
      (start_time <= p_start_time AND end_time > p_start_time) OR
      (start_time < p_end_time AND end_time >= p_end_time) OR
      (start_time >= p_start_time AND end_time <= p_end_time)
    );
  
  -- Check if requested quantity is available
  RETURN (booked_quantity + p_quantity) <= total_inventory;
END;
$$;