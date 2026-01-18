-- Add ID and Description columns to it_equipment table
ALTER TABLE public.it_equipment 
ADD COLUMN id_number TEXT,
ADD COLUMN description TEXT;

COMMENT ON COLUMN public.it_equipment.id_number IS 'Optional ID field for equipment identification';
COMMENT ON COLUMN public.it_equipment.description IS 'Optional description field for equipment observations';