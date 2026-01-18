-- Drop existing function to recreate with new logic
DROP FUNCTION IF EXISTS public.check_booking_availability(date, time without time zone, time without time zone, integer, uuid);

-- Recreate function with logic to handle same-user bookings on the same day
CREATE OR REPLACE FUNCTION public.check_booking_availability(
  p_booking_date date,
  p_start_time time without time zone,
  p_end_time time without time zone,
  p_quantity integer,
  p_exclude_booking_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_inventory integer;
  booked_quantity integer;
  user_max_quantity integer := 0;
BEGIN
  -- Get total available inventory for the date
  SELECT COALESCE(total_available, 200) 
  INTO total_inventory
  FROM public.chromebook_inventory 
  WHERE date = p_booking_date;
  
  -- If user_id is provided, get the maximum quantity already booked by this user on the same date
  -- (excluding the current booking if updating)
  IF p_user_id IS NOT NULL THEN
    SELECT COALESCE(MAX(quantity), 0)
    INTO user_max_quantity
    FROM public.chromebook_bookings
    WHERE booking_date = p_booking_date
      AND user_id = p_user_id
      AND status = 'active'
      AND (p_exclude_booking_id IS NULL OR id != p_exclude_booking_id);
  END IF;
  
  -- Calculate total booked quantity considering user consolidation
  -- For each user on this date, we only count their maximum quantity once
  WITH user_max_bookings AS (
    SELECT 
      user_id,
      MAX(quantity) as max_quantity
    FROM public.chromebook_bookings
    WHERE booking_date = p_booking_date
      AND status = 'active'
      AND (p_exclude_booking_id IS NULL OR id != p_exclude_booking_id)
      AND (
        (start_time <= p_start_time AND end_time > p_start_time) OR
        (start_time < p_end_time AND end_time >= p_end_time) OR
        (start_time >= p_start_time AND end_time <= p_end_time)
      )
    GROUP BY user_id
  )
  SELECT COALESCE(SUM(max_quantity), 0)
  INTO booked_quantity
  FROM user_max_bookings
  WHERE user_id != p_user_id OR p_user_id IS NULL;
  
  -- For the requesting user, add their new/updated quantity if it's higher than their current max
  IF p_user_id IS NOT NULL THEN
    booked_quantity := booked_quantity + GREATEST(p_quantity, user_max_quantity);
  ELSE
    booked_quantity := booked_quantity + p_quantity;
  END IF;
  
  -- Check if the total is within inventory limits
  RETURN booked_quantity <= total_inventory;
END;
$$;

COMMENT ON FUNCTION public.check_booking_availability IS 
'Checks if a booking is available considering that the same user can reuse equipment across different time slots on the same day. Only the maximum quantity booked by a user on a given day is counted towards inventory usage.';