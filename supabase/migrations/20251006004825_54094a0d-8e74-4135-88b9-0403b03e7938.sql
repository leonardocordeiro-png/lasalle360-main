-- Clear existing data
DELETE FROM grade_series;
DELETE FROM academic_levels;

-- Insert academic levels with proper ordering and colors
INSERT INTO academic_levels (id, name, color_code, display_order) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Educação Infantil', '#FF6B6B', 1),
  ('22222222-2222-2222-2222-222222222222', 'Ensino Fundamental I', '#4ECDC4', 2),
  ('33333333-3333-3333-3333-333333333333', 'Ensino Fundamental II', '#45B7D1', 3),
  ('44444444-4444-4444-4444-444444444444', 'Ensino Médio', '#96CEB4', 4);

-- Insert grade series for Educação Infantil
INSERT INTO grade_series (academic_level_id, name, display_order) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Creche-II', 1),
  ('11111111-1111-1111-1111-111111111111', 'Creche-III', 2),
  ('11111111-1111-1111-1111-111111111111', 'Pré-Escola I', 3),
  ('11111111-1111-1111-1111-111111111111', 'Pré-Escola II', 4);

-- Insert grade series for Ensino Fundamental I
INSERT INTO grade_series (academic_level_id, name, display_order) VALUES
  ('22222222-2222-2222-2222-222222222222', '1º Ano', 1),
  ('22222222-2222-2222-2222-222222222222', '2º Ano', 2),
  ('22222222-2222-2222-2222-222222222222', '3º Ano', 3),
  ('22222222-2222-2222-2222-222222222222', '4º Ano', 4),
  ('22222222-2222-2222-2222-222222222222', '5º Ano', 5);

-- Insert grade series for Ensino Fundamental II
INSERT INTO grade_series (academic_level_id, name, display_order) VALUES
  ('33333333-3333-3333-3333-333333333333', '6º Ano', 1),
  ('33333333-3333-3333-3333-333333333333', '7º Ano', 2),
  ('33333333-3333-3333-3333-333333333333', '8º Ano', 3),
  ('33333333-3333-3333-3333-333333333333', '9º Ano', 4);

-- Insert grade series for Ensino Médio
INSERT INTO grade_series (academic_level_id, name, display_order) VALUES
  ('44444444-4444-4444-4444-444444444444', '1º EM', 1),
  ('44444444-4444-4444-4444-444444444444', '2º EM', 2),
  ('44444444-4444-4444-4444-444444444444', '3º EM', 3);