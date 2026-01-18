-- Clean up orphaned user data for Adonias Santos
-- Delete any bookings first (if any exist)
DELETE FROM chromebook_bookings WHERE user_id = 'ba2d7a70-f81b-4f26-9c91-ecf776def72c';

-- Delete the profile record
DELETE FROM profiles WHERE user_id = 'ba2d7a70-f81b-4f26-9c91-ecf776def72c';