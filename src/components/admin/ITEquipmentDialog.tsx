import { useState, useEffect } from "react";
import { format, parse } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Package } from "lucide-react";

const SECTORS = [
  'TI/TE', 'AEE', 'SOE', 'SAP', 'SCT', 'RH', 'DIREÇÃO', 'BIBLIOTECA',
  'RECEPÇÃO', 'SECRETARIA', 'REFEITÓRIO', 'AUDITÓRIO', 'COORDENAÇÃO',
  'SL. PROFESSORES', 'REPROGRAFIA', 'SUP. EDUC', 'SUP. ADM', 'SALA DE AULA'
];

interface ITEquipmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment?: any;
  onSuccess: () => void;
}

export function ITEquipmentDialog({ open, onOpenChange, equipment, onSuccess }: ITEquipmentDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<Array<{ full_name: string }>>([]);
  const [loanInfo, setLoanInfo] = useState<any>(null);
  const [formData, setFormData] = useState({
    id_number: '',
    patrimony: '',
    equipment_type: '',
    brand: '',
    model: '',
    serial_number: '',
    mac_address: '',
    sector: '',
    status: 'ATIVO' as 'ATIVO' | 'DEFEITO' | 'EM_USO',
    responsible: '',
    description: ''
  });

  useEffect(() => {
    if (equipment) {
      setFormData({
        id_number: equipment.id_number || '',
        patrimony: equipment.patrimony || '',
        equipment_type: equipment.equipment_type || '',
        brand: equipment.brand || '',
        model: equipment.model || '',
        serial_number: equipment.serial_number || '',
        mac_address: equipment.mac_address || '',
        sector: equipment.sector || '',
        status: equipment.status || 'ATIVO',
        responsible: equipment.responsible || '',
        description: equipment.description || ''
      });
    } else {
      setFormData({
        id_number: '',
        patrimony: '',
        equipment_type: '',
        brand: '',
        model: '',
        serial_number: '',
        mac_address: '',
        sector: '',
        status: 'ATIVO',
        responsible: '',
        description: ''
      });
    }
  }, [equipment]);

  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .order('full_name');
      
      if (data) {
        setUsers(data);
      }
    };

    const fetchLoanInfo = async () => {
      if (equipment?.status === 'EM_USO') {
        let activeLoan = null;

        // 1. Try to find a direct loan (quantity = 1)
        const { data: directLoan } = await supabase
          .from('chromebook_loans')
          .select('borrower_name, loan_date, responsible_teacher, status, quantity')
          .eq('equipment_id', equipment.id)
          .in('status', ['em_uso', 'atrasado'])
          .maybeSingle();

        if (directLoan) {
          activeLoan = directLoan;
        } else {
          // 2. If not direct, try to find in a consolidated loan (quantity > 1)
          const { data: consolidatedLoan } = await supabase
            .from('chromebook_loans')
            .select('borrower_name, loan_date, responsible_teacher, status, quantity')
            .like('chromebook_number', `%${equipment.patrimony}%`) // Search in comma-separated string
            .in('status', ['em_uso', 'atrasado'])
            .maybeSingle(); // Assuming one equipment is part of only one consolidated loan at a time
          
          if (consolidatedLoan) {
            activeLoan = consolidatedLoan;
          }
        }
        setLoanInfo(activeLoan);
      } else {
        setLoanInfo(null);
      }
    };
    
    if (open) {
      fetchUsers();
      if (equipment) {
        fetchLoanInfo();
      }
    }
  }, [open, equipment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // Verificar se está tentando mudar status de EM_USO para ATIVO manualmente
      if (equipment?.status === 'EM_USO' && formData.status === 'ATIVO') {
        // Check for active direct loan
        let activeLoan = null;
        const { data: directLoan } = await supabase
          .from('chromebook_loans')
          .select('id, borrower_name')
          .eq('equipment_id', equipment.id)
          .in('status', ['em_uso', 'atrasado'])
          .maybeSingle();
        
        if (directLoan) {
          activeLoan = directLoan;
        } else {
          // Check for active consolidated loan
          const { data: consolidatedLoan } = await supabase
            .from('chromebook_loans')
            .select('id, borrower_name')
            .like('chromebook_number', `%${equipment.patrimony}%`)
            .in('status', ['em_uso', 'atrasado'])
            .maybeSingle();
          activeLoan = consolidatedLoan;
        }

        if (activeLoan) {
          const confirmChange = window.confirm(
            `⚠️ ATENÇÃO!\n\n` +
            `Este equipamento está emprestado para ${activeLoan.borrower_name}.\n\n` +
            `Alterar o status manualmente pode causar inconsistências no sistema.\n\n` +
            `RECOMENDAÇÃO: Registre a devolução no módulo "Empréstimos" para atualizar automaticamente.\n\n` +
            `Deseja realmente alterar o status manualmente?`
          );
          
          if (!confirmChange) {
            setLoading(false);
            return;
          }
          
          // Registrar auditoria de mudança manual
          await supabase.rpc('insert_security_audit_log', {
            p_action: 'equipment_status_manual_override',
            p_user_id: user.id,
            p_resource_type: 'it_equipment',
            p_resource_id: equipment.id,
            p_additional_data: {
              old_status: 'EM_USO',
              new_status: 'ATIVO',
              active_loan_id: activeLoan.id,
              reason: 'Manual override by user'
            }
          });
        }
      }

      // Check for duplicates (patrimony and serial_number)
      // Allow multiple equipment with "SEM PATRIMÔNIO" - completely skip duplicate check
      const patrimonyValue = formData.patrimony.trim().toUpperCase();
      const serialNumberValue = formData.serial_number.trim();
      
      // Skip duplicate check completely if patrimony is "SEM PATRIMÔNIO"
      if (patrimonyValue !== 'SEM PATRIMÔNIO') {
        let duplicateConditions = [];
        
        // Add serial number check
        duplicateConditions.push(`serial_number.eq.${serialNumberValue}`);
        
        // Add patrimony check
        duplicateConditions.push(`patrimony.eq.${patrimonyValue}`);

        const { data: existingEquipment, error: checkError } = await supabase
          .from('it_equipment')
          .select('id, patrimony, serial_number')
          .or(duplicateConditions.join(','))
          .neq('id', equipment?.id || '00000000-0000-0000-0000-000000000000');

        if (checkError) throw checkError;

        if (existingEquipment && existingEquipment.length > 0) {
          const duplicateFields = [];
          existingEquipment.forEach(eq => {
            if (eq.patrimony === patrimonyValue) {
              duplicateFields.push(`Patrimônio "${patrimonyValue}"`);
            }
            if (eq.serial_number === serialNumberValue) {
              duplicateFields.push(`N° Série "${serialNumberValue}"`);
            }
          });

          throw new Error(`Equipamento duplicado encontrado: ${duplicateFields.join(', ')} já está cadastrado no sistema.`);
        }
      }

      const dataToSave = {
        ...formData,
        id_number: formData.id_number.trim() || null,
        mac_address: formData.mac_address.trim() || null,
        description: formData.description.trim() || null,
        created_by: equipment ? undefined : user.id
      };

      if (equipment) {
        const { error } = await supabase
          .from('it_equipment')
          .update(dataToSave)
          .eq('id', equipment.id);

        if (error) throw error;

        toast({
          title: "Equipamento atualizado",
          description: "O equipamento foi atualizado com sucesso.",
        });

        const { auditLog } = await import('@/lib/auditLogger');
        await auditLog({
          action: 'update',
          module: 'it_equipment',
          description: `Equipamento "${formData.equipment_name}" atualizado`,
          resourceId: equipment.id,
          newData: { name: formData.equipment_name, type: formData.equipment_type, status: formData.status }
        });
      } else {
        const { error } = await supabase
          .from('it_equipment')
          .insert([dataToSave]);

        if (error) throw error;

        toast({
          title: "Equipamento cadastrado",
          description: "O equipamento foi cadastrado com sucesso.",
        });

        const { auditLog } = await import('@/lib/auditLogger');
        await auditLog({
          action: 'create',
          module: 'it_equipment',
          description: `Equipamento "${formData.equipment_name}" cadastrado`,
          newData: { name: formData.equipment_name, type: formData.equipment_type, status: formData.status }
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {equipment ? 'Editar Equipamento' : 'Cadastrar Equipamento'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="id_number">ID</Label>
              <Input
                id="id_number"
                value={formData.id_number}
                onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="patrimony">Patrimônio *</Label>
              <Input
                id="patrimony"
                value={formData.patrimony}
                onChange={(e) => setFormData({ ...formData, patrimony: e.target.value })}
                placeholder="Digite o número do patrimônio ou 'SEM PATRIMÔNIO'"
                required
              />
              <p className="text-xs text-muted-foreground">
                Use "SEM PATRIMÔNIO" caso o equipamento não tenha número de patrimônio
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="equipment_type">Equipamento *</Label>
              <Input
                id="equipment_type"
                placeholder="Ex: notebook, impressora, projetor"
                value={formData.equipment_type}
                onChange={(e) => setFormData({ ...formData, equipment_type: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="brand">Marca *</Label>
              <Input
                id="brand"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Modelo *</Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="serial_number">N° Série *</Label>
              <Input
                id="serial_number"
                value={formData.serial_number}
                onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mac_address">MAC</Label>
              <Input
                id="mac_address"
                placeholder="XX:XX:XX:XX:XX:XX"
                value={formData.mac_address}
                onChange={(e) => setFormData({ ...formData, mac_address: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sector">Setor *</Label>
              <Select
                value={formData.sector}
                onValueChange={(value) => setFormData({ ...formData, sector: value })}
                required
              >
                <SelectTrigger id="sector">
                  <SelectValue placeholder="Selecione o setor" />
                </SelectTrigger>
                <SelectContent>
                  {SECTORS.map((sector) => (
                    <SelectItem key={sector} value={sector}>
                      {sector}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select
                value={formData.status}
                onValueChange={(value: 'ATIVO' | 'DEFEITO' | 'EM_USO') => setFormData({ ...formData, status: value })}
                required
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ATIVO">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      ATIVO
                    </div>
                  </SelectItem>
                  <SelectItem value="EM_USO">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-500" />
                      EM_USO
                    </div>
                  </SelectItem>
                  <SelectItem value="DEFEITO">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      DEFEITO
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {equipment?.status === 'EM_USO' && loanInfo && (
              <div className="col-span-1 sm:col-span-2">
                <Alert className="bg-yellow-50 border-yellow-200">
                  <Package className="h-4 w-4 text-yellow-600" />
                  <AlertTitle className="text-yellow-800">Equipamento em Empréstimo</AlertTitle>
                  <AlertDescription className="text-yellow-700">
                    <div className="space-y-1 text-sm mt-2">
                      <p><strong>Emprestado para:</strong> {loanInfo.borrower_name}</p>
                      <p><strong>Data:</strong> {format(parse(loanInfo.loan_date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy')}</p>
                      {loanInfo.responsible_teacher && (
                        <p><strong>Professor Responsável:</strong> {loanInfo.responsible_teacher}</p>
                      )}
                      {loanInfo.quantity > 1 && (
                        <p><strong>Quantidade:</strong> {loanInfo.quantity} Chromebooks (Empréstimo Consolidado)</p>
                      )}
                      <p><strong>Status:</strong> {loanInfo.status === 'em_uso' ? 'Em uso' : 'Atrasado'}</p>
                    </div>
                  </AlertDescription>
                </Alert>
              </div>
            )}

            <div className="space-y-2 col-span-1 sm:col-span-2">
              <Label htmlFor="responsible">Responsável *</Label>
              <Select
                value={formData.responsible}
                onValueChange={(value) => setFormData({ ...formData, responsible: value })}
                required
              >
                <SelectTrigger id="responsible">
                  <SelectValue placeholder="Selecione o responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TI/TE">TI/TE</SelectItem>
                  {users.map((user, index) => (
                    <SelectItem key={`${user.full_name}-${index}`} value={user.full_name}>
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 col-span-1 sm:col-span-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                placeholder="Observações sobre o equipamento"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="flex flex-wrap gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {equipment ? 'Atualizar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}