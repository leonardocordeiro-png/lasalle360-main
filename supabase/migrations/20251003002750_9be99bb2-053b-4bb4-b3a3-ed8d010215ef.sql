-- Create enum for equipment status
CREATE TYPE public.equipment_status AS ENUM ('ATIVO', 'DEFEITO');

-- Create table for IT equipment inventory
CREATE TABLE public.it_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_number INTEGER GENERATED ALWAYS AS IDENTITY,
  patrimony TEXT NOT NULL,
  equipment_type TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  serial_number TEXT NOT NULL,
  mac_address TEXT,
  sector TEXT NOT NULL,
  status public.equipment_status NOT NULL DEFAULT 'ATIVO',
  responsible TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  CONSTRAINT valid_mac_address CHECK (
    mac_address IS NULL OR 
    mac_address ~* '^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$'
  )
);

-- Enable RLS
ALTER TABLE public.it_equipment ENABLE ROW LEVEL SECURITY;

-- Create index for faster searches
CREATE INDEX idx_it_equipment_sector ON public.it_equipment(sector);
CREATE INDEX idx_it_equipment_status ON public.it_equipment(status);
CREATE INDEX idx_it_equipment_number ON public.it_equipment(equipment_number);

-- RLS Policies
-- Admins can do everything
CREATE POLICY "Admins can manage all IT equipment"
ON public.it_equipment
FOR ALL
USING (is_admin_user(auth.uid()));

-- Users with permission can view
CREATE POLICY "Authorized users can view IT equipment"
ON public.it_equipment
FOR SELECT
USING (
  user_has_module_access(auth.uid(), 'it_equipment')
);

-- Trigger for updated_at
CREATE TRIGGER update_it_equipment_updated_at
  BEFORE UPDATE ON public.it_equipment
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to validate bulk import
CREATE OR REPLACE FUNCTION public.validate_it_equipment_import(
  p_patrimony TEXT,
  p_equipment_type TEXT,
  p_brand TEXT,
  p_model TEXT,
  p_serial_number TEXT,
  p_mac_address TEXT,
  p_sector TEXT,
  p_status TEXT,
  p_responsible TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  valid_sectors TEXT[] := ARRAY['TI/TE', 'AEE', 'SOE', 'SAP', 'SCT', 'RH', 'DIREÇÃO', 'BIBLIOTECA', 'RECEPÇÃO', 'SECRETARIA', 'REFEITÓRIO', 'AUDITÓRIO', 'COORDENAÇÃO', 'SL. PROFESSORES', 'REPROGRAFIA', 'SUP. EDUC', 'SUP. ADM', 'SALA DE AULA'];
  valid_statuses TEXT[] := ARRAY['ATIVO', 'DEFEITO'];
BEGIN
  -- Validate required fields
  IF p_patrimony IS NULL OR trim(p_patrimony) = '' THEN
    RETURN 'Campo PATRIMÔNIO é obrigatório';
  END IF;
  
  IF p_equipment_type IS NULL OR trim(p_equipment_type) = '' THEN
    RETURN 'Campo EQUIPAMENTO é obrigatório';
  END IF;
  
  IF p_brand IS NULL OR trim(p_brand) = '' THEN
    RETURN 'Campo MARCA é obrigatório';
  END IF;
  
  IF p_model IS NULL OR trim(p_model) = '' THEN
    RETURN 'Campo MODELO é obrigatório';
  END IF;
  
  IF p_serial_number IS NULL OR trim(p_serial_number) = '' THEN
    RETURN 'Campo N° SÉRIE é obrigatório';
  END IF;
  
  -- Validate sector
  IF p_sector IS NULL OR NOT (p_sector = ANY(valid_sectors)) THEN
    RETURN 'Setor inválido. Valores aceitos: ' || array_to_string(valid_sectors, ', ');
  END IF;
  
  -- Validate status
  IF p_status IS NULL OR NOT (p_status = ANY(valid_statuses)) THEN
    RETURN 'Status inválido. Valores aceitos: ATIVO, DEFEITO';
  END IF;
  
  -- Validate responsible
  IF p_responsible IS NULL OR trim(p_responsible) = '' THEN
    RETURN 'Campo RESPONSÁVEL é obrigatório';
  END IF;
  
  -- Validate MAC address format if provided
  IF p_mac_address IS NOT NULL AND trim(p_mac_address) != '' THEN
    IF NOT (p_mac_address ~* '^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$') THEN
      RETURN 'Formato de endereço MAC inválido. Use formato: XX:XX:XX:XX:XX:XX ou XX-XX-XX-XX-XX-XX';
    END IF;
  END IF;
  
  RETURN 'OK';
END;
$$;