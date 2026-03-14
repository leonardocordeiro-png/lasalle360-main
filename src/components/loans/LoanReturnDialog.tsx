import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, parse } from "date-fns";
import { Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

const returnSchema = z.object({
  return_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato inválido (HH:MM)"),
  observations: z.string().optional(),
  notify_it: z.boolean().default(true),
  return_quantity: z.number().min(1),
});

type ReturnFormData = z.infer<typeof returnSchema>;

interface LoanReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan: any;
  onSuccess: () => void;
}

export function LoanReturnDialog({ open, onOpenChange, loan, onSuccess }: LoanReturnDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEquipments, setSelectedEquipments] = useState<number[]>([]);
  const [equipmentMap, setEquipmentMap] = useState<Record<string, string>>({});

  // Buscar mapa de IDs dos equipamentos
  useEffect(() => {
    const fetchEquipmentIds = async () => {
      if (!loan?.chromebook_number) return;
      
      const patrimonyList = loan.chromebook_number.split(',').map((s: string) => s.trim());
      
      try {
        const { data, error } = await supabase
          .from('it_equipment')
          .select('patrimony, id_number')
          .in('patrimony', patrimonyList);
        
        if (error) throw error;
        
        const map: Record<string, string> = {};
        data?.forEach(eq => {
          if (eq.patrimony && eq.id_number) {
            map[eq.patrimony.trim()] = eq.id_number;
          }
        });
        setEquipmentMap(map);
      } catch (error) {
        console.error('Error fetching equipment IDs:', error);
      }
    };
    
    if (open && loan) {
      fetchEquipmentIds();
    }
  }, [open, loan]);

  // Função para obter o identificador do equipamento (prioriza ID sobre patrimônio)
  const getEquipmentDisplay = (patrimony: string): string => {
    const trimmed = patrimony.trim();
    return equipmentMap[trimmed] || trimmed;
  };

  // Calcular quantidade pendente (total - já devolvidos)
  const alreadyReturned = loan?.returned_quantity || 0;
  const pendingQuantity = loan ? loan.quantity - alreadyReturned : 0;
  const returnQuantity = selectedEquipments.length;
  const isPartialReturn = returnQuantity > 0 && returnQuantity < pendingQuantity;

  // Reset selected equipments when loan changes
  useEffect(() => {
    if (loan) {
      // Por padrão, NÃO selecionar nenhum equipamento (usuário deve escolher explicitamente)
      setSelectedEquipments([]);
    }
  }, [loan, alreadyReturned]);

  const toggleEquipment = (globalIndex: number) => {
    // Converter índice global para índice relativo aos equipamentos pendentes
    const relativeIndex = globalIndex - alreadyReturned;
    setSelectedEquipments(prev => 
      prev.includes(relativeIndex) 
        ? prev.filter(i => i !== relativeIndex)
        : [...prev, relativeIndex].sort((a, b) => a - b)
    );
  };

  const selectAll = () => {
    // Selecionar todos os equipamentos pendentes (índices relativos)
    const pendingIndexes = Array.from({ length: pendingQuantity }, (_, i) => i);
    setSelectedEquipments(pendingIndexes);
  };

  const deselectAll = () => {
    setSelectedEquipments([]);
  };

  const form = useForm<ReturnFormData>({
    resolver: zodResolver(returnSchema),
    defaultValues: {
      return_time: format(new Date(), "HH:mm"),
      notify_it: true,
      return_quantity: pendingQuantity,
    },
  });

  // Update form when returnQuantity changes
  useEffect(() => {
    form.setValue('return_quantity', returnQuantity);
  }, [returnQuantity, form]);

  const onSubmit = async (data: ReturnFormData) => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const newReturnedQuantity = alreadyReturned + returnQuantity;
      const isFullReturn = newReturnedQuantity >= loan.quantity;

      // Preparar observação com lista de equipamentos devolvidos
      const patrimonyNumbers = loan.chromebook_number?.split(',').map((s: string) => s.trim()) || [];
      
      // CORREÇÃO: Usar apenas os equipamentos pendentes para seleção
      const pendingEquipments = patrimonyNumbers.slice(alreadyReturned);
      const returnedEquipmentsList = selectedEquipments.map(index => pendingEquipments[index]).filter(Boolean);
      
      // Debug para verificar a seleção
      console.log('Equipment return debug:', {
        patrimonyNumbers,
        pendingEquipments,
        selectedEquipments,
        returnedEquipmentsList,
        alreadyReturned,
        pendingQuantity
      });
      
      const returnObservation = data.observations 
        ? `Devolução ${isFullReturn ? 'completa' : 'parcial'} (${returnQuantity}/${pendingQuantity}): ${returnedEquipmentsList.join(', ')}. ${data.observations}`
        : `Devolução ${isFullReturn ? 'completa' : 'parcial'} de ${returnQuantity} equipamento(s): ${returnedEquipmentsList.join(', ')}`;
      
      const newObservations = loan.observations 
        ? `${loan.observations}\n\n${format(new Date(), 'dd/MM/yyyy HH:mm')} - ${returnObservation}`
        : `${format(new Date(), 'dd/MM/yyyy HH:mm')} - ${returnObservation}`;

      // Preparar dados de atualização do empréstimo
      const updateData: any = {
        returned_quantity: newReturnedQuantity,
        observations: newObservations,
      };

      if (isFullReturn) {
        updateData.status = "devolvido";
        updateData.return_time = data.return_time;
        updateData.returned_by = user.id;
        updateData.returned_at = new Date().toISOString();
      }

      // Executar operações principais em paralelo
      const promises: Promise<any>[] = [];

      // 1. Atualizar empréstimo
      const loanUpdateData = {
        ...updateData,
        // Limpar equipment_id para equipamentos devolvidos
        ...(isFullReturn ? { equipment_id: null } : {})
      };
      
      promises.push(
        supabase
          .from("chromebook_loans")
          .update(loanUpdateData)
          .eq("id", loan.id)
      );

      // 2. Atualizar status dos equipamentos em batch
      if (returnedEquipmentsList.length > 0) {
        console.log('Updating equipment status to ATIVO:', {
          returnedEquipmentsList,
          patrimonyNumbers
        });
        
        // Tentar atualizar por patrimony primeiro
        const patrimonyUpdate = supabase
          .from('it_equipment')
          .update({ status: 'ATIVO' })
          .in('patrimony', returnedEquipmentsList);
        
        // Também tentar atualizar por id_number como fallback
        const idNumberUpdate = supabase
          .from('it_equipment')
          .update({ status: 'ATIVO' })
          .in('id_number', returnedEquipmentsList);
        
        promises.push(patrimonyUpdate, idNumberUpdate);
      }

      // 3. Criar notificação interna
      promises.push(
        supabase.from('notifications' as any).insert({
          user_id: user.id,
          message: isFullReturn 
            ? `Devolução completa registrada: ${loan.chromebook_number} (${loan.borrower_name})`
            : `Devolução parcial registrada: ${returnQuantity} de ${pendingQuantity} equipamentos (${loan.borrower_name})`,
          type: 'loan_returned',
          related_id: loan.id,
        } as any)
      );

      // Aguardar todas as operações principais
      const results = await Promise.all(promises);
      
      // Verificar erros
      const updateError = results[0]?.error;
      if (updateError) throw updateError;

      toast({
        title: isFullReturn ? "Devolução Completa!" : "Devolução Parcial Registrada!",
        description: isFullReturn 
          ? "Todos os equipamentos foram devolvidos"
          : `${returnQuantity} equipamento(s) devolvido(s). Restam ${pendingQuantity - returnQuantity} com o solicitante.`,
      });

      form.reset();
      setSelectedEquipments([]);
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Error returning loan:", error);
      toast({
        variant: "destructive",
        title: "Erro ao registrar devolução",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!loan) return null;

  const equipmentsList = loan.chromebook_number?.split(',').map((s: string) => s.trim()) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Devolução</DialogTitle>
          <DialogDescription>
            {pendingQuantity > 1 
              ? <span>
                <span className="text-red-600 font-semibold">Vermelho</span>: Equipamentos que SERÃO devolvidos • 
                <span className="text-green-600 font-semibold"> Verde</span>: Equipamentos que PERMANECERÃO emprestados
              </span>
              : "Confirme a devolução do equipamento"
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Info do solicitante */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <div className="text-sm text-muted-foreground">Solicitante</div>
              <div className="font-medium">{loan.borrower_name}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Data Empréstimo</div>
              <div className="font-medium">{format(parse(loan.loan_date, "yyyy-MM-dd", new Date()), "dd/MM/yyyy")}</div>
            </div>
          </div>

          {/* Status de devolução parcial anterior */}
          {alreadyReturned > 0 && (
            <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/30">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 dark:text-blue-200">
                <strong>{alreadyReturned}</strong> de <strong>{loan.quantity}</strong> equipamento(s) já foram devolvidos anteriormente.
                Restam <strong>{pendingQuantity}</strong> para devolver.
              </AlertDescription>
            </Alert>
          )}

          {/* Seleção de equipamentos para devolução */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Selecione os equipamentos a devolver</div>
              {pendingQuantity > 1 && (
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={selectAll} className="text-xs h-7">
                    Selecionar todos
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={deselectAll} className="text-xs h-7">
                    Limpar
                  </Button>
                </div>
              )}
            </div>
            
            <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded-lg p-2">
              {equipmentsList.map((num: string, globalIndex: number) => {
                const isAlreadyReturned = globalIndex < alreadyReturned;
                const relativeIndex = globalIndex - alreadyReturned;
                const isSelected = !isAlreadyReturned && selectedEquipments.includes(relativeIndex);
                
                if (isAlreadyReturned) {
                  return (
                    <div 
                      key={globalIndex}
                      className="flex items-center gap-3 p-2 rounded bg-muted/30 opacity-60"
                    >
                      <Checkbox checked disabled className="data-[state=checked]:bg-gray-400" />
                      <span className="font-mono text-sm line-through">{getEquipmentDisplay(num)}</span>
                      <Badge variant="secondary" className="ml-auto text-xs">Já devolvido</Badge>
                    </div>
                  );
                }
                
                return (
                  <div 
                    key={globalIndex}
                    onClick={() => toggleEquipment(globalIndex)}
                    className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                      isSelected 
                        ? 'bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700' 
                        : 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700'
                    }`}
                  >
                    <Checkbox 
                      checked={isSelected} 
                      onCheckedChange={() => toggleEquipment(globalIndex)}
                      className={isSelected ? "data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600" : "data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"}
                    />
                    <span className={`font-mono text-sm ${isSelected ? 'font-medium text-red-700' : 'text-green-700'}`}>{getEquipmentDisplay(num)}</span>
                    {isSelected ? (
                      <Badge className="ml-auto text-xs bg-red-600 text-white">SERÁ DEVOLVIDO</Badge>
                    ) : (
                      <Badge className="ml-auto text-xs bg-green-600 text-white">PERMANECERÁ</Badge>
                    )}
                  </div>
                );
              })}
            </div>
            
            <div className="text-center text-sm">
              <span className="font-medium text-primary">{returnQuantity}</span>
              <span className="text-muted-foreground"> de {pendingQuantity} selecionado(s)</span>
            </div>
          </div>

          {/* Alerta de devolução parcial */}
          {isPartialReturn && returnQuantity > 0 && (
            <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/30">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                <strong>Devolução parcial:</strong> {pendingQuantity - returnQuantity} equipamento(s) continuarão 
                atribuídos a {loan.borrower_name}.
              </AlertDescription>
            </Alert>
          )}

          {loan.responsible_teacher && (
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Professor Responsável</div>
              <div className="font-medium">{loan.responsible_teacher}</div>
            </div>
          )}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="return_time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Horário de Devolução</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="observations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Adicione observações sobre a devolução..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notify_it"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Notificar equipe TI</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Enviar notificação sobre a devolução
                    </p>
                  </div>
                </FormItem>
              )}
            />

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading || returnQuantity === 0}
                className={`w-full sm:w-auto ${isPartialReturn ? "bg-amber-600 hover:bg-amber-700" : "bg-green-600 hover:bg-green-700"}`}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {returnQuantity === 0 
                  ? "Selecione"
                  : isPartialReturn 
                    ? `Devolver ${returnQuantity}` 
                    : "Confirmar Devolução"
                }
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
