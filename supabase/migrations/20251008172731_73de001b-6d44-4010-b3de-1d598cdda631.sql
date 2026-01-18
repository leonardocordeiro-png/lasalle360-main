-- Inserir anos letivos de 2025 a 2030
INSERT INTO public.school_years (year, is_active)
VALUES 
  (2025, true),
  (2026, false),
  (2027, false),
  (2028, false),
  (2029, false),
  (2030, false)
ON CONFLICT DO NOTHING;