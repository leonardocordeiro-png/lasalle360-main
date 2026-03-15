-- ============================================================================
-- MIGRATION: Adicionar rastreamento de UUIDs por empréstimo
--
-- Problema resolvido: chromebook_number armazena texto (patrimônio/id_number),
-- causando ambiguidade na devolução — o sistema não sabia qual equipamento
-- físico atualizar quando patrimônio e id_number tinham valores distintos.
--
-- Solução: equipment_ids[] guarda os UUIDs reais de TODOS os equipamentos
-- do empréstimo. returned_equipment_ids[] rastreia quais já foram devolvidos.
-- A devolução agora opera exclusivamente por UUID — sem conversão de texto.
-- ============================================================================

-- 1. Adicionar coluna de UUIDs de todos os equipamentos do empréstimo
ALTER TABLE public.chromebook_loans
  ADD COLUMN IF NOT EXISTS equipment_ids UUID[] DEFAULT '{}';

-- 2. Adicionar coluna de UUIDs dos equipamentos já devolvidos
ALTER TABLE public.chromebook_loans
  ADD COLUMN IF NOT EXISTS returned_equipment_ids UUID[] DEFAULT '{}';

-- 3. Backfill: para empréstimos simples (equipment_id preenchido),
--    popular equipment_ids com o UUID já existente.
--    Empréstimos múltiplos (equipment_id = NULL) não podem ser backfillados
--    de forma confiável a partir do texto de chromebook_number — eles usarão
--    o fluxo legado no frontend até serem recriados.
UPDATE public.chromebook_loans
SET equipment_ids = ARRAY[equipment_id]
WHERE equipment_id IS NOT NULL
  AND (equipment_ids IS NULL OR equipment_ids = '{}');

-- 4. Backfill de returned_equipment_ids para devoluções completas:
--    Se status = 'devolvido' e equipment_ids preenchido, marcar todos como devolvidos.
UPDATE public.chromebook_loans
SET returned_equipment_ids = equipment_ids
WHERE status = 'devolvido'
  AND equipment_ids IS NOT NULL
  AND array_length(equipment_ids, 1) > 0
  AND (returned_equipment_ids IS NULL OR returned_equipment_ids = '{}');
