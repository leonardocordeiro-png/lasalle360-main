-- Adicionar 'professor_chromebook' ao ENUM equipment_type_loan
-- Permite que professores façam empréstimo de Chromebook de forma explícita,
-- evitando o uso de filtro undefined que causava busca vazia no sistema.
ALTER TYPE public.equipment_type_loan ADD VALUE IF NOT EXISTS 'professor_chromebook';
