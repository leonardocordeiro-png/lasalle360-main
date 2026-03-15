-- ============================================================================
-- MIGRATION: Corrigir inconsistências críticas no módulo de Empréstimos
--
-- Correções aplicadas:
--   1. Migrar registros 'EMPRESTIMO' → 'EM_USO' em it_equipment
--   2. Adicionar coluna returned_quantity em chromebook_loans (estava faltando)
--   3. Atualizar trigger sync_equipment_loan_status para usar 'EM_USO'
--   4. Aumentar limite do campo observations de 500 → 2000 caracteres
--   5. Atualizar COMMENT da coluna it_equipment.status
-- ============================================================================

-- -----------------------------------------------------------------------
-- 1. Migrar registros existentes com status 'EMPRESTIMO' para 'EM_USO'
--    (requer que o ENUM já tenha sido expandido pela migration anterior)
-- -----------------------------------------------------------------------
UPDATE public.it_equipment
SET status = 'EM_USO'
WHERE status = 'EMPRESTIMO';

-- -----------------------------------------------------------------------
-- 2. Adicionar coluna returned_quantity em chromebook_loans
--    Usada para devoluções parciais: registra quantos equipamentos já
--    foram devolvidos neste empréstimo.
-- -----------------------------------------------------------------------
ALTER TABLE public.chromebook_loans
  ADD COLUMN IF NOT EXISTS returned_quantity INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.chromebook_loans.returned_quantity IS
  'Quantidade de equipamentos já devolvidos neste empréstimo (suporte a devolução parcial)';

-- -----------------------------------------------------------------------
-- 3. Atualizar função sync_equipment_loan_status para usar 'EM_USO'
--    - Usa 'EM_USO' ao marcar equipamento como emprestado
--    - Checagem de duplicata verifica 'EM_USO' (era 'EMPRESTIMO', que o
--      frontend nunca usava — deixando a proteção inoperante)
--    - Mantém a verificação de permissão (loans_management / write)
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_equipment_loan_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  equip_id UUID;
  patrimony_number TEXT;
  v_user_has_permission BOOLEAN;
BEGIN
  -- Verificar permissão do usuário
  v_user_has_permission := public.user_has_permission_level(
    auth.uid(),
    'loans_management'::text,
    'write'::text
  );

  IF NOT v_user_has_permission THEN
    RAISE EXCEPTION 'Unauthorized: User does not have permission to manage loans';
  END IF;

  -- Empréstimo de equipamento único (via equipment_id)
  IF NEW.equipment_id IS NOT NULL THEN
    equip_id := NEW.equipment_id;
    patrimony_number := NEW.chromebook_number;

  -- Empréstimo de múltiplos (quantity > 1 sem equipment_id) — não sincroniza individual
  ELSIF NEW.quantity > 1 AND NEW.equipment_id IS NULL THEN
    RETURN NEW;

  -- Empréstimo único identificado pelo patrimônio
  ELSE
    SELECT id INTO equip_id
    FROM it_equipment
    WHERE patrimony = NEW.chromebook_number
    LIMIT 1;
    patrimony_number := NEW.chromebook_number;
  END IF;

  IF equip_id IS NOT NULL THEN
    -- Garantir que equipment_id está preenchido no registro
    IF NEW.equipment_id IS NULL THEN
      NEW.equipment_id := equip_id;
    END IF;

    -- Criando empréstimo ou mudando para em_uso / atrasado
    IF (TG_OP = 'INSERT' AND NEW.status IN ('em_uso', 'atrasado')) OR
       (TG_OP = 'UPDATE' AND NEW.status IN ('em_uso', 'atrasado') AND OLD.status != NEW.status) THEN

      -- Verificar se o equipamento já está emprestado
      IF EXISTS (
        SELECT 1 FROM it_equipment
        WHERE id = equip_id AND status IN ('EM_USO', 'EMPRESTIMO')
      ) THEN
        RAISE EXCEPTION 'Equipamento % já está em empréstimo', patrimony_number;
      END IF;

      UPDATE it_equipment
      SET status = 'EM_USO'
      WHERE id = equip_id;

      INSERT INTO security_audit_log (
        action, user_id, resource_type, resource_id, additional_data
      ) VALUES (
        'equipment_loaned', auth.uid(), 'it_equipment', equip_id::text,
        jsonb_build_object(
          'loan_id',    NEW.id,
          'patrimony',  patrimony_number,
          'borrower',   NEW.borrower_name,
          'old_status', 'ATIVO',
          'new_status', 'EM_USO'
        )
      );

    -- Devolvendo o equipamento
    ELSIF TG_OP = 'UPDATE' AND NEW.status = 'devolvido' AND OLD.status != 'devolvido' THEN

      UPDATE it_equipment
      SET status = 'ATIVO'
      WHERE id = equip_id;

      INSERT INTO security_audit_log (
        action, user_id, resource_type, resource_id, additional_data
      ) VALUES (
        'equipment_returned', auth.uid(), 'it_equipment', equip_id::text,
        jsonb_build_object(
          'loan_id',    NEW.id,
          'patrimony',  patrimony_number,
          'borrower',   NEW.borrower_name,
          'old_status', 'EM_USO',
          'new_status', 'ATIVO'
        )
      );

    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.sync_equipment_loan_status IS
  'Sincroniza status do it_equipment com o empréstimo. Usa EM_USO (alinhado com o frontend). Requer permissão loans_management/write.';

-- -----------------------------------------------------------------------
-- 4. Atualizar validate_observations_field: limite 500 → 2000 caracteres
--    O campo acumula histórico de devoluções parciais, que pode facilmente
--    ultrapassar 500 chars com poucos registros.
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_observations_field()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.observations IS NOT NULL THEN
    -- Verificar tamanho máximo (aumentado de 500 para 2000)
    IF length(NEW.observations) > 2000 THEN
      RAISE EXCEPTION 'Campo observations muito longo: % caracteres (máximo 2000)', length(NEW.observations);
    END IF;

    -- Bloquear caracteres que podem causar injeção ou problemas de parsing
    IF NEW.observations ~ '[<>{}]' THEN
      RAISE EXCEPTION 'observations contém caracteres inválidos: < > { }';
    END IF;

    -- Remover espaços extras nas bordas
    NEW.observations := trim(NEW.observations);

    -- Converter string vazia em NULL
    IF NEW.observations = '' THEN
      NEW.observations := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.validate_observations_field() IS
  'SECURITY: Valida observations: máx 2000 chars (histórico de devoluções), sem < > { }';

-- -----------------------------------------------------------------------
-- 5. Atualizar comentário da coluna status de it_equipment
-- -----------------------------------------------------------------------
COMMENT ON COLUMN public.it_equipment.status IS
  'Status do equipamento: ATIVO (disponível), DEFEITO (com problema), EM_USO (em empréstimo ativo)';
