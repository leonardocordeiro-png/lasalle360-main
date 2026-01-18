-- Create system configuration table
CREATE TABLE IF NOT EXISTS public.system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT UNIQUE NOT NULL,
  config_value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Only admins can view and modify system config
CREATE POLICY "Only admins can view system config"
ON public.system_config
FOR SELECT
USING (is_admin_user(auth.uid()));

CREATE POLICY "Only admins can insert system config"
ON public.system_config
FOR INSERT
WITH CHECK (is_admin_user(auth.uid()));

CREATE POLICY "Only admins can update system config"
ON public.system_config
FOR UPDATE
USING (is_admin_user(auth.uid()));

-- Insert default configuration
INSERT INTO public.system_config (config_key, config_value, description)
VALUES 
  ('max_booking_quantity', '50', 'Quantidade máxima de Chromebooks por agendamento'),
  ('max_booking_days_advance', '90', 'Máximo de dias de antecedência para agendamentos'),
  ('default_chromebook_inventory', '200', 'Inventário padrão de Chromebooks'),
  ('maintenance_mode', 'false', 'Modo de manutenção ativo'),
  ('email_notifications', 'true', 'Notificações por email ativas'),
  ('weekend_bookings_allowed', 'false', 'Permitir agendamentos nos finais de semana'),
  ('auto_cancel_past_bookings', 'true', 'Auto-cancelar agendamentos passados')
ON CONFLICT (config_key) DO NOTHING;

-- Create trigger to update updated_at
CREATE TRIGGER update_system_config_updated_at
BEFORE UPDATE ON public.system_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();