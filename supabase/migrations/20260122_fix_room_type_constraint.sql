-- Fix room_type constraint to allow 'auditorio' instead of 'sala_google'

-- Drop the existing constraint
ALTER TABLE room_bookings DROP CONSTRAINT IF EXISTS room_bookings_room_type_check;

-- Create new constraint with 'auditorio' instead of 'sala_google'
ALTER TABLE room_bookings ADD CONSTRAINT room_bookings_room_type_check 
CHECK (room_type IN ('auditorio', 'laboratorio', 'sala_criativa'));

-- Also update calendar_blocks if it has a similar constraint
ALTER TABLE calendar_blocks DROP CONSTRAINT IF EXISTS calendar_blocks_resource_type_check;

-- Recreate with auditorio
ALTER TABLE calendar_blocks ADD CONSTRAINT calendar_blocks_resource_type_check 
CHECK (resource_type IN ('chromebook', 'auditorio', 'laboratorio', 'sala_criativa'));
