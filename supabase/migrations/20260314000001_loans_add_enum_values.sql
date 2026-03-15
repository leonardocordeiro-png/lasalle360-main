-- ============================================================================
-- MIGRATION: Adicionar valores faltantes aos ENUMs do módulo de Empréstimos
-- Problema 1: equipment_status usava 'EMPRESTIMO' no trigger, mas o frontend
--             usa 'EM_USO'. Adicionamos 'EM_USO' ao ENUM para alinhar.
-- Problema 2: equipment_type_loan não tinha 'colaborador', causando falha de
--             constraint em todo empréstimo criado para colaboradores.
--
-- ATENÇÃO: ALTER TYPE ... ADD VALUE não pode rodar dentro de um bloco de
--          transação no PostgreSQL. Este arquivo deve ser executado separado.
-- ============================================================================

-- 1. Adicionar 'EM_USO' ao ENUM equipment_status
--    O valor 'EMPRESTIMO' permanece por compatibilidade retroativa;
--    a migration seguinte migra os registros existentes para 'EM_USO'.
ALTER TYPE public.equipment_status ADD VALUE IF NOT EXISTS 'EM_USO';

-- 2. Adicionar 'colaborador' ao ENUM equipment_type_loan
--    Sem este valor, qualquer INSERT de empréstimo com equipment_type =
--    'colaborador' falha com violação de constraint de tipo.
ALTER TYPE public.equipment_type_loan ADD VALUE IF NOT EXISTS 'colaborador';
