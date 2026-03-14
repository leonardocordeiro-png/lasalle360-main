import { supabase } from "@/integrations/supabase/client";

// Função emergencial para corrigir equipamento 111
export async function emergencyFixEquipment111() {
  try {
    console.log('🚨 EMERGENCY FIX: Starting equipment 111 correction...');
    
    // 1. Buscar equipamento 111
    const { data: equipment, error: findError } = await supabase
      .from('it_equipment')
      .select('*')
      .or('patrimony.eq.111,id_number.eq.111');
    
    if (findError) {
      console.error('Error finding equipment 111:', findError);
      return { success: false, error: findError };
    }
    
    if (!equipment || equipment.length === 0) {
      console.error('Equipment 111 not found');
      return { success: false, error: 'Equipment not found' };
    }
    
    console.log('Found equipment 111:', equipment);
    
    // 2. Buscar todos os empréstimos ativos relacionados
    const { data: activeLoans, error: loansError } = await supabase
      .from('chromebook_loans')
      .select('*')
      .or(`chromebook_number.ilike.%111%,equipment_id.eq.${equipment[0].id}`)
      .in('status', ['ativo', 'EMPRESTIMO']);
    
    if (loansError) {
      console.error('Error finding active loans:', loansError);
      return { success: false, error: loansError };
    }
    
    console.log('Active loans found:', activeLoans);
    
    // 3. Atualizar equipamento 111 para ATIVO e limpar associações
    const { data: updateResult, error: updateError } = await supabase
      .from('it_equipment')
      .update({ 
        status: 'ATIVO',
        // Limpar qualquer campo de associação se existir
        assigned_user: null,
        loan_id: null,
        equipment_id: null
      })
      .eq('id', equipment[0].id);
    
    if (updateError) {
      console.error('Error updating equipment 111:', updateError);
      return { success: false, error: updateError };
    }
    
    console.log('Equipment 111 updated successfully:', updateResult);
    
    // 4. Marcar empréstimos relacionados como devolvidos
    if (activeLoans && activeLoans.length > 0) {
      for (const loan of activeLoans) {
        const { error: loanUpdateError } = await supabase
          .from('chromebook_loans')
          .update({ 
            status: 'devolvido',
            returned_quantity: loan.quantity,
            equipment_id: null
          })
          .eq('id', loan.id);
        
        if (loanUpdateError) {
          console.error(`Error updating loan ${loan.id}:`, loanUpdateError);
        } else {
          console.log(`Loan ${loan.id} marked as returned`);
        }
      }
    }
    
    // 5. Verificação final
    const { data: finalCheck } = await supabase
      .from('it_equipment')
      .select('status, patrimony, id_number')
      .eq('id', equipment[0].id)
      .single();
    
    console.log('Final check - Equipment 111 status:', finalCheck);
    
    return { 
      success: true, 
      equipment: finalCheck,
      loansUpdated: activeLoans?.length || 0
    };
    
  } catch (error) {
    console.error('Emergency fix failed:', error);
    return { success: false, error };
  }
}

// Função para executar via console
if (typeof window !== 'undefined') {
  (window as any).emergencyFixEquipment111 = emergencyFixEquipment111;
  console.log('🔧 Emergency fix function available: emergencyFixEquipment111()');
}
