-- Enable realtime for chromebook_bookings table
ALTER TABLE public.chromebook_bookings REPLICA IDENTITY FULL;

-- Add chromebook_bookings to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.chromebook_bookings;