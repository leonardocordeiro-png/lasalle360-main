-- FASE 1: Expandir enum equipment_status para incluir EMPRESTIMO
ALTER TYPE equipment_status ADD VALUE IF NOT EXISTS 'EMPRESTIMO';

-- Adicionar comentário sobre cores
COMMENT ON COLUMN it_equipment.status IS 'Status do equipamento: ATIVO (verde), DEFEITO (vermelho), EMPRESTIMO (amarelo)';

-- Adicionar coluna equipment_id em chromebook_loans para relacionamento direto
ALTER TABLE chromebook_loans 
ADD COLUMN IF NOT EXISTS equipment_id UUID REFERENCES it_equipment(id);

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_chromebook_loans_equipment_id 
ON chromebook_loans(equipment_id);

-- Comentário explicativo
COMMENT ON COLUMN chromebook_loans.equipment_id IS 
  'Referência ao equipamento na tabela it_equipment (se existir no inventário)';

-- Função para sincronizar status do equipamento com empréstimo
CREATE OR REPLACE FUNCTION sync_equipment_loan_status()
RETURNS TRIGGER AS $$
DECLARE
  equip_id UUID;
BEGIN
  -- Buscar equipamento pelo número (patrimônio)
  SELECT id INTO equip_id
  FROM it_equipment
  WHERE patrimony = NEW.chromebook_number
  LIMIT 1;
  
  IF equip_id IS NOT NULL THEN
    -- Atualizar equipment_id no empréstimo
    NEW.equipment_id := equip_id;
    
    -- Se criando empréstimo ou mudando para em_uso/atrasado
    IF (TG_OP = 'INSERT' AND NEW.status IN ('em_uso', 'atrasado')) OR
       (TG_OP = 'UPDATE' AND NEW.status IN ('em_uso', 'atrasado') AND OLD.status != NEW.status) THEN
      
      UPDATE it_equipment
      SET status = 'EMPRESTIMO'
      WHERE id = equip_id;
      
      -- Registrar auditoria
      INSERT INTO security_audit_log (
        action,
        user_id,
        resource_type,
        resource_id,
        additional_data
      ) VALUES (
        'equipment_loaned',
        auth.uid(),
        'it_equipment',
        equip_id::text,
        jsonb_build_object(
          'loan_id', NEW.id,
          'patrimony', NEW.chromebook_number,
          'borrower', NEW.borrower_name,
          'old_status', 'ATIVO',
          'new_status', 'EMPRESTIMO'
        )
      );
      
    -- Se devolvendo
    ELSIF TG_OP = 'UPDATE' AND NEW.status = 'devolvido' AND OLD.status != 'devolvido' THEN
      
      UPDATE it_equipment
      SET status = 'ATIVO'
      WHERE id = equip_id;
      
      -- Registrar auditoria
      INSERT INTO security_audit_log (
        action,
        user_id,
        resource_type,
        resource_id,
        additional_data
      ) VALUES (
        'equipment_returned',
        auth.uid(),
        'it_equipment',
        equip_id::text,
        jsonb_build_object(
          'loan_id', NEW.id,
          'patrimony', NEW.chromebook_number,
          'borrower', NEW.borrower_name,
          'old_status', 'EMPRESTIMO',
          'new_status', 'ATIVO'
        )
      );
      
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Comentário da função
COMMENT ON FUNCTION sync_equipment_loan_status IS 
  'Sincroniza automaticamente o status do equipamento com o status do empréstimo';

-- Criar trigger para INSERT e UPDATE
DROP TRIGGER IF EXISTS update_equipment_status_on_loan ON chromebook_loans;
CREATE TRIGGER update_equipment_status_on_loan
  BEFORE INSERT OR UPDATE OF status ON chromebook_loans
  FOR EACH ROW
  EXECUTE FUNCTION sync_equipment_loan_status();

-- FASE 2: Atualizar RLS policies de chromebook_loans
DROP POLICY IF EXISTS "Admins and IT can manage loans" ON chromebook_loans;
DROP POLICY IF EXISTS "Admins can view all loans" ON chromebook_loans;
DROP POLICY IF EXISTS "Users can view their own loans" ON chromebook_loans;

-- Nova policy: Usuários com permissão write podem gerenciar empréstimos
CREATE POLICY "Users with write permission can manage loans"
  ON chromebook_loans FOR ALL
  USING (
    has_role(auth.uid(), 'admin') OR 
    user_has_permission_level(auth.uid(), 'loans_management', 'write')
  );

-- Nova policy: Usuários com read permission podem ver empréstimos
CREATE POLICY "Users with read permission can view loans"
  ON chromebook_loans FOR SELECT
  USING (
    has_role(auth.uid(), 'admin') OR 
    user_has_permission_level(auth.uid(), 'loans_management', 'read') OR
    auth.uid() = created_by
  );

-- Comentário sobre módulo de permissões
COMMENT ON TABLE chromebook_loans IS 
  'Empréstimos de Chromebooks. Permissões controladas via user_permissions.module_name = "loans_management"';