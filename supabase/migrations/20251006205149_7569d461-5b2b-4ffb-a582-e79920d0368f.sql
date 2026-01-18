-- Create a helper function to compute daily Chromebook usage across all users (bypasses RLS securely)
CREATE OR REPLACE FUNCTION public.get_chromebook_day_usage(p_date date)
RETURNS TABLE (
  used_count integer,
  total_inventory integer,
  available integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
AS $$
  WITH inv AS (
    SELECT COALESCE((SELECT total_available FROM public.chromebook_inventory WHERE date = p_date), 200) AS total_available
  ),
  user_max AS (
    SELECT user_id, MAX(quantity) AS max_quantity
    FROM public.chromebook_bookings
    WHERE booking_date = p_date
      AND status = 'active'
    GROUP BY user_id
  )
  SELECT
    COALESCE((SELECT SUM(max_quantity) FROM user_max), 0) AS used_count,
    (SELECT total_available FROM inv) AS total_inventory,
    (SELECT total_available FROM inv) - COALESCE((SELECT SUM(max_quantity) FROM user_max), 0) AS available;
$$;