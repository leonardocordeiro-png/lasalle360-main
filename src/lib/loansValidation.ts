import { supabase } from "@/integrations/supabase/client";

// Filtro de tipo de equipamento: chromebook ou notebook (para professores)
// equipmentCategory: 'chromebook' | 'notebook' | undefined (qualquer)
function buildEquipmentTypeFilter(equipmentCategory?: string) {
  if (equipmentCategory === 'notebook') return 'ilike.equipment_type.*notebook*';
  if (equipmentCategory === 'chromebook') return 'ilike.equipment_type.*chromebook*';
  return null; // sem filtro de tipo
}

// Buscar equipamento por múltiplos campos (ID, Patrimônio ou Série)
// Prioridade: 1) Match exato por ID, 2) Match exato por Patrimônio/Série, 3) Match parcial
// equipmentCategory: 'chromebook' | 'notebook' — filtra pelo tipo correto
export async function searchEquipmentForLoan(searchTerm: string, equipmentCategory?: string) {
  const trimmedSearch = searchTerm.trim();

  if (!trimmedSearch) return [];

  const baseQuery = () =>
    supabase
      .from('it_equipment')
      .select('id, id_number, patrimony, serial_number, brand, model, status, equipment_type')
      .eq('status', 'ATIVO');

  const applyTypeFilter = (query: any) => {
    if (equipmentCategory === 'notebook') return query.ilike('equipment_type', '%notebook%');
    if (equipmentCategory === 'chromebook') return query.ilike('equipment_type', '%chromebook%');
    return query; // professores podem usar chromebook ou notebook
  };

  // 1) Match exato por id_number
  const { data: exactIdMatch, error: exactIdError } = await applyTypeFilter(baseQuery())
    .eq('id_number', trimmedSearch)
    .limit(10);
  if (exactIdError) throw exactIdError;
  if (exactIdMatch && exactIdMatch.length > 0) return exactIdMatch;

  // 2) Match exato por patrimônio ou serial
  const { data: exactOtherMatch, error: exactOtherError } = await applyTypeFilter(baseQuery())
    .or(`patrimony.eq.${trimmedSearch},serial_number.eq.${trimmedSearch}`)
    .limit(10);
  if (exactOtherError) throw exactOtherError;
  if (exactOtherMatch && exactOtherMatch.length > 0) return exactOtherMatch;

  // 3) Busca parcial
  const { data: partialMatch, error: partialError } = await applyTypeFilter(baseQuery())
    .or(`id_number.ilike.${trimmedSearch}%,patrimony.ilike.%${trimmedSearch}%,serial_number.ilike.%${trimmedSearch}%`)
    .limit(15);
  if (partialError) throw partialError;

  const results = partialMatch || [];
  results.sort((a: any, b: any) => {
    const aFirst = a.id_number?.toLowerCase().startsWith(trimmedSearch.toLowerCase()) ? 0 : 1;
    const bFirst = b.id_number?.toLowerCase().startsWith(trimmedSearch.toLowerCase()) ? 0 : 1;
    return aFirst - bFirst;
  });

  return results.slice(0, 10);
}

// NOVO: validação por ID único (quando usuário seleciona um item da lista)
export async function validateEquipmentById(id: string) {
  const { data: equipment, error: eqError } = await supabase
    .from('it_equipment')
    .select('id, status, brand, model, equipment_type')
    .eq('id', id)
    .single();

  if (eqError) throw eqError;

  if (!equipment) {
    return { valid: false, message: 'Equipamento não encontrado no inventário' };
  }

  if (equipment.status !== 'ATIVO') {
    return { 
      valid: false, 
      message: `Equipamento com status ${equipment.status}. Apenas equipamentos ATIVO podem ser emprestados.` 
    };
  }

  const { data: activeLoan } = await supabase
    .from('chromebook_loans')
    .select('id, borrower_name, loan_date')
    .eq('equipment_id', equipment.id)
    .in('status', ['em_uso', 'atrasado'])
    .maybeSingle();

  if (activeLoan) {
    return {
      valid: false,
      message: `Equipamento já emprestado para ${activeLoan.borrower_name} desde ${activeLoan.loan_date?.split('-').reverse().join('/')}`
    };
  }

  return { valid: true, equipment };
}

// AJUSTE: aceitar ID, Patrimônio ou Série digitado no campo livre e lidar com múltiplos resultados
// equipmentCategory: 'chromebook' | 'notebook' — restringe ao tipo correto do empréstimo
export async function validateEquipmentForLoan(identifier: string, equipmentCategory?: string) {
  const trimmed = identifier.trim();

  const applyTypeFilter = (query: any) => {
    if (equipmentCategory === 'notebook') return query.ilike('equipment_type', '%notebook%');
    if (equipmentCategory === 'chromebook') return query.ilike('equipment_type', '%chromebook%');
    return query;
  };

  const baseSelect = 'id, status, brand, model, equipment_type, id_number, patrimony, serial_number';

  // 1) Tentar por Patrimônio ou N° Série (costumam ser únicos)
  const { data: patOrSerialData, error: patOrSerialErr } = await applyTypeFilter(
    supabase.from('it_equipment').select(baseSelect).or(`patrimony.eq.${trimmed},serial_number.eq.${trimmed}`)
  );
  if (patOrSerialErr) throw patOrSerialErr;

  const patOrSerial = patOrSerialData || [];

  if (patOrSerial.length === 1) {
    const equipment = patOrSerial[0];
    if (equipment.status !== 'ATIVO') {
      return { valid: false, message: `Equipamento com status ${equipment.status}. Apenas equipamentos ATIVO podem ser emprestados.` };
    }
    const { data: activeLoan } = await supabase
      .from('chromebook_loans').select('id, borrower_name, loan_date')
      .eq('equipment_id', equipment.id).in('status', ['em_uso', 'atrasado']).maybeSingle();
    if (activeLoan) {
      return { valid: false, message: `Equipamento já emprestado para ${activeLoan.borrower_name} desde ${activeLoan.loan_date?.split('-').reverse().join('/')}` };
    }
    return { valid: true, equipment };
  }

  if (patOrSerial.length > 1) {
    return { valid: false, message: 'Mais de um equipamento com esse Patrimônio/N° Série. Selecione pela lista para evitar ambiguidades.' };
  }

  // 2) Tentar por id_number
  const { data: byIdData, error: byIdErr } = await applyTypeFilter(
    supabase.from('it_equipment').select(baseSelect).eq('id_number', trimmed)
  );
  if (byIdErr) throw byIdErr;

  const byId = byIdData || [];

  if (byId.length === 0) return { valid: false, message: 'Equipamento não encontrado no inventário' };
  if (byId.length > 1) return { valid: false, message: 'Mais de um equipamento corresponde ao ID informado. Selecione pela lista para evitar ambiguidades.' };

  const equipment = byId[0];
  if (equipment.status !== 'ATIVO') {
    return { valid: false, message: `Equipamento com status ${equipment.status}. Apenas equipamentos ATIVO podem ser emprestados.` };
  }

  const { data: activeLoan } = await supabase
    .from('chromebook_loans').select('id, borrower_name, loan_date')
    .eq('equipment_id', equipment.id).in('status', ['em_uso', 'atrasado']).maybeSingle();
  if (activeLoan) {
    return { valid: false, message: `Equipamento já emprestado para ${activeLoan.borrower_name} desde ${activeLoan.loan_date?.split('-').reverse().join('/')}` };
  }

  return { valid: true, equipment };
}

// equipmentCategory: 'chromebook' | 'notebook' — filtra pelo tipo correto
export async function getAvailableEquipments(equipmentCategory?: string) {
  let query = supabase
    .from('it_equipment')
    .select('id, patrimony, brand, model, status, equipment_type')
    .eq('status', 'ATIVO')
    .order('patrimony');

  if (equipmentCategory === 'notebook') {
    query = query.ilike('equipment_type', '%notebook%');
  } else if (equipmentCategory === 'chromebook') {
    query = query.ilike('equipment_type', '%chromebook%');
  } else {
    // sem filtro: retorna todos os tipos disponíveis
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}