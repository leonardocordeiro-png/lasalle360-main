-- Create room_bookings table for Sala Google and Laboratório
CREATE TABLE public.room_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  room_type TEXT NOT NULL CHECK (room_type IN ('sala_google', 'laboratorio')),
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  class_name TEXT NOT NULL,
  observations TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.room_bookings ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own room bookings" 
ON public.room_bookings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own room bookings" 
ON public.room_bookings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own room bookings" 
ON public.room_bookings 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all room bookings" 
ON public.room_bookings 
FOR SELECT 
USING (is_admin_user(auth.uid()));

CREATE POLICY "Admins can update any room booking" 
ON public.room_bookings 
FOR UPDATE 
USING (is_admin_user(auth.uid()));

CREATE POLICY "Admins can delete room bookings" 
ON public.room_bookings 
FOR DELETE 
USING (is_admin_user(auth.uid()));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_room_bookings_updated_at
BEFORE UPDATE ON public.room_bookings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create validation trigger for room bookings
CREATE OR REPLACE FUNCTION public.validate_room_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  
  -- Validate time slots
  IF NEW.start_time >= NEW.end_time THEN
    RAISE EXCEPTION 'Start time must be before end time';
  END IF;
  
  -- Check for conflicting bookings for the same room
  IF EXISTS (
    SELECT 1
    FROM public.room_bookings
    WHERE room_type = NEW.room_type
      AND booking_date = NEW.booking_date
      AND status = 'active'
      AND (NEW.id IS NULL OR id != NEW.id)
      AND (
        (start_time <= NEW.start_time AND end_time > NEW.start_time) OR
        (start_time < NEW.end_time AND end_time >= NEW.end_time) OR
        (start_time >= NEW.start_time AND end_time <= NEW.end_time)
      )
  ) THEN
    RAISE EXCEPTION 'Room is already booked for this time slot';
  END IF;
  
  -- Sanitize text inputs
  NEW.class_name = trim(NEW.class_name);
  NEW.full_name = trim(NEW.full_name);
  IF NEW.observations IS NOT NULL THEN
    NEW.observations = trim(NEW.observations);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for validation
CREATE TRIGGER validate_room_booking_trigger
BEFORE INSERT OR UPDATE ON public.room_bookings
FOR EACH ROW
EXECUTE FUNCTION public.validate_room_booking();