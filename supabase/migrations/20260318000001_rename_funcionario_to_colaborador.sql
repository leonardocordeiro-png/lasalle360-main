-- Renomear 'funcionario' para 'colaborador' na coluna borrower_type da tabela chromebook_loans
-- Atualiza registros existentes e ajusta a CHECK constraint

-- 1. Atualizar registros existentes
UPDATE public.chromebook_loans
SET borrower_type = 'colaborador'
WHERE borrower_type = 'funcionario';

-- 2. Remover a CHECK constraint antiga
ALTER TABLE public.chromebook_loans
DROP CONSTRAINT IF EXISTS chromebook_loans_borrower_type_check;

-- 3. Adicionar nova CHECK constraint com 'colaborador'
ALTER TABLE public.chromebook_loans
ADD CONSTRAINT chromebook_loans_borrower_type_check
CHECK (borrower_type IN ('aluno', 'professor', 'colaborador'));
