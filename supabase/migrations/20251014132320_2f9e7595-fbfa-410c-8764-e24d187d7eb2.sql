-- Criar enums para o módulo de empréstimos
CREATE TYPE equipment_type_loan AS ENUM ('professor', 'aluno');
CREATE TYPE loan_status AS ENUM ('em_uso', 'devolvido', 'atrasado');

-- Tabela de empréstimos de Chromebooks
CREATE TABLE public.chromebook_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Quem retirou
  borrower_name TEXT NOT NULL,
  borrower_type TEXT NOT NULL CHECK (borrower_type IN ('aluno', 'professor', 'funcionario')),
  
  -- Controle acadêmico (se for aluno)
  responsible_teacher TEXT,
  class_name TEXT,
  
  -- Equipamento
  equipment_type equipment_type_loan NOT NULL,
  chromebook_number TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1 AND quantity <= 50),
  
  -- Datas e horários
  loan_date DATE NOT NULL,
  pickup_time TIME NOT NULL,
  expected_return_date DATE,
  return_time TIME,
  
  -- Status e controle
  status loan_status NOT NULL DEFAULT 'em_uso',
  observations TEXT,
  
  -- Auditoria
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  returned_by UUID,
  returned_at TIMESTAMP WITH TIME ZONE,
  
  -- Notificações
  notification_sent BOOLEAN DEFAULT FALSE,
  
  CONSTRAINT valid_return_time CHECK (
    (status = 'devolvido' AND return_time IS NOT NULL) OR
    (status != 'devolvido')
  )
);

-- Índices para performance
CREATE INDEX idx_chromebook_loans_status ON chromebook_loans(status);
CREATE INDEX idx_chromebook_loans_loan_date ON chromebook_loans(loan_date);
CREATE INDEX idx_chromebook_loans_created_by ON chromebook_loans(created_by);
CREATE INDEX idx_chromebook_loans_chromebook_number ON chromebook_loans(chromebook_number);

-- RLS Policies
ALTER TABLE chromebook_loans ENABLE ROW LEVEL SECURITY;

-- Admins podem ver tudo
CREATE POLICY "Admins can view all loans"
  ON chromebook_loans FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Admins e TI podem gerenciar
CREATE POLICY "Admins and IT can manage loans"
  ON chromebook_loans FOR ALL
  USING (
    has_role(auth.uid(), 'admin') OR 
    user_has_permission_level(auth.uid(), 'admin_it_equipment', 'write')
  );

-- Usuários podem ver seus próprios empréstimos
CREATE POLICY "Users can view their own loans"
  ON chromebook_loans FOR SELECT
  USING (auth.uid() = created_by);

-- Trigger para updated_at
CREATE TRIGGER update_chromebook_loans_updated_at
  BEFORE UPDATE ON chromebook_loans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Função para verificar empréstimos atrasados
CREATE OR REPLACE FUNCTION check_loan_overdue()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se passou da data esperada e ainda não devolveu, marca como atrasado
  IF NEW.status = 'em_uso' AND 
     NEW.expected_return_date IS NOT NULL AND 
     NEW.expected_return_date < CURRENT_DATE THEN
    NEW.status = 'atrasado';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para verificar atrasos
CREATE TRIGGER check_overdue_loans
  BEFORE INSERT OR UPDATE ON chromebook_loans
  FOR EACH ROW
  EXECUTE FUNCTION check_loan_overdue();