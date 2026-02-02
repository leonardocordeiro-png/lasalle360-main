import { supabase } from "@/integrations/supabase/client";

// Buscar equipamento por múltiplos campos (ID, Patrimônio ou Série)
// Prioridade: 1) Match exato por ID, 2) Match exato por Patrimônio/Série, 3) Match parcial
export async function searchEquipmentForLoan(searchTerm: string) {
  const trimmedSearch = searchTerm.trim();
  
  if (!trimmedSearch) return [];

  // 1) Primeiro: buscar match EXATO por id_number (prioridade máxima)
  const { data: exactIdMatch, error: exactIdError } = await supabase
    .from('it_equipment')
    .select('id, id_number, patrimony, serial_number, brand, model, status, equipment_type')
    .eq('status', 'ATIVO')
    .ilike('equipment_type', '%chromebook%')
    .eq('id_number', trimmedSearch)
    .limit(10);

  if (exactIdError) throw exactIdError;
  
  // Se encontrou match exato por ID, retorna apenas esses
  if (exactIdMatch && exactIdMatch.length > 0) {
    return exactIdMatch;
  }

  // 2) Segundo: buscar match EXATO por patrimônio ou serial
  const { data: exactOtherMatch, error: exactOtherError } = await supabase
    .from('it_equipment')
    .select('id, id_number, patrimony, serial_number, brand, model, status, equipment_type')
    .eq('status', 'ATIVO')
    .ilike('equipment_type', '%chromebook%')
    .or(`patrimony.eq.${trimmedSearch},serial_number.eq.${trimmedSearch}`)
    .limit(10);

  if (exactOtherError) throw exactOtherError;
  
  // Se encontrou match exato por patrimônio/série, retorna esses
  if (exactOtherMatch && exactOtherMatch.length > 0) {
    return exactOtherMatch;
  }

  // 3) Terceiro: busca parcial (fallback) - mas prioriza id_number no início
  const { data: partialMatch, error: partialError } = await supabase
    .from('it_equipment')
    .select('id, id_number, patrimony, serial_number, brand, model, status, equipment_type')
    .eq('status', 'ATIVO')
    .ilike('equipment_type', '%chromebook%')
    .or(`id_number.ilike.${trimmedSearch}%,patrimony.ilike.%${trimmedSearch}%,serial_number.ilike.%${trimmedSearch}%`)
    .limit(15);

  if (partialError) throw partialError;
  
  // Ordenar resultados: priorizar matches de id_number que começam com o termo
  const results = partialMatch || [];
  results.sort((a, b) => {
    const aIdStartsWith = a.id_number?.toLowerCase().startsWith(trimmedSearch.toLowerCase()) ? 0 : 1;
    const bIdStartsWith = b.id_number?.toLowerCase().startsWith(trimmedSearch.toLowerCase()) ? 0 : 1;
    return aIdStartsWith - bIdStartsWith;
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
export async function validateEquipmentForLoan(identifier: string) {
  const trimmed = identifier.trim();

  // 1) Primeiro: tentar por Patrimônio ou N° Série (costumam ser únicos)
  const { data: patOrSerialData, error: patOrSerialErr } = await supabase
    .from('it_equipment')
    .select('id, status, brand, model, equipment_type, id_number, patrimony, serial_number')
    .ilike('equipment_type', '%chromebook%')
    .or(`patrimony.eq.${trimmed},serial_number.eq.${trimmed}`);

  if (patOrSerialErr) throw patOrSerialErr;

  const patOrSerial = patOrSerialData || [];

  if (patOrSerial.length === 1) {
    const equipment = patOrSerial[0];
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

  if (patOrSerial.length > 1) {
    return { 
      valid: false, 
      message: 'Mais de um equipamento com esse Patrimônio/N° Série. Selecione pela lista para evitar ambiguidades.' 
    };
  }

  // 2) Se não encontrou por Patrimônio/Série, tentar por ID (pode haver duplicatas)
  const { data: byIdData, error: byIdErr } = await supabase
    .from('it_equipment')
    .select('id, status, brand, model, equipment_type, id_number, patrimony, serial_number')
    .ilike('equipment_type', '%chromebook%')
    .eq('id_number', trimmed);

  if (byIdErr) throw byIdErr;

  const byId = byIdData || [];

  if (byId.length === 0) {
    return { valid: false, message: 'Equipamento não encontrado no inventário' };
  }

  if (byId.length > 1) {
    return { 
      valid: false, 
      message: 'Mais de um equipamento corresponde ao ID informado. Selecione pela lista para evitar ambiguidades.' 
    };
  }

  const equipment = byId[0];

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

export async function getAvailableEquipments() {
  const { data, error } = await supabase
    .from('it_equipment')
    .select('id, patrimony, brand, model, status, equipment_type')
    .eq('status', 'ATIVO')
    .ilike('equipment_type', '%chromebook%')
    .order('patrimony');

  if (error) throw error;
  return data || [];
}