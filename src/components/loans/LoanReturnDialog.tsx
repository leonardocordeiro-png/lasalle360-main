import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, parse } from "date-fns";
import { Loader2, Minus, Plus, AlertCircle } from "lucide-react";
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

  // Calcular quantidade pendente (total - já devolvidos)
  const alreadyReturned = loan?.returned_quantity || 0;
  const pendingQuantity = loan ? loan.quantity - alreadyReturned : 0;
  const returnQuantity = selectedEquipments.length;
  const isPartialReturn = returnQuantity > 0 && returnQuantity < pendingQuantity;

  // Reset selected equipments when loan changes
  useEffect(() => {
    if (loan) {
      // Por padrão, selecionar todos os equipamentos pendentes
      const pending = loan.quantity - (loan.returned_quantity || 0);
      const pendingIndexes = Array.from({ length: pending }, (_, i) => alreadyReturned + i);
      setSelectedEquipments(pendingIndexes);
    }
  }, [loan, alreadyReturned]);

  const toggleEquipment = (index: number) => {
    setSelectedEquipments(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index].sort((a, b) => a - b)
    );
  };

  const selectAll = () => {
    const pendingIndexes = Array.from({ length: pendingQuantity }, (_, i) => alreadyReturned + i);
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
      const returnedEquipmentsList = selectedEquipments.map(index => patrimonyNumbers[index]).filter(Boolean);
      
      const returnObservation = data.observations 
        ? `Devolução ${isFullReturn ? 'completa' : 'parcial'} (${returnQuantity}/${pendingQuantity}): ${returnedEquipmentsList.join(', ')}. ${data.observations}`
        : `Devolução ${isFullReturn ? 'completa' : 'parcial'} de ${returnQuantity} equipamento(s): ${returnedEquipmentsList.join(', ')}`;
      
      const newObservations = loan.observations 
        ? `${loan.observations}\n\n${format(new Date(), 'dd/MM/yyyy HH:mm')} - ${returnObservation}`
        : `${format(new Date(), 'dd/MM/yyyy HH:mm')} - ${returnObservation}`;

      // Atualizar empréstimo
      const updateData: any = {
        returned_quantity: newReturnedQuantity,
        observations: newObservations,
      };

      // Se é devolução completa, marcar como devolvido
      if (isFullReturn) {
        updateData.status = "devolvido";
        updateData.return_time = data.return_time;
        updateData.returned_by = user.id;
        updateData.returned_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from("chromebook_loans")
        .update(updateData)
        .eq("id", loan.id);

      if (updateError) throw updateError;

      // Atualizar status dos equipamentos devolvidos (usando índices selecionados)
      if (loan.chromebook_number) {
        const patrimonyNumbers = loan.chromebook_number.split(',').map((s: string) => s.trim());
        // Atualizar apenas os equipamentos selecionados
        const equipmentsToReturn = selectedEquipments.map(index => patrimonyNumbers[index]).filter(Boolean);
        
        const updateEquipmentPromises = equipmentsToReturn.map(patrimony =>
          supabase.from('it_equipment')
            .update({ status: 'ATIVO' })
            .eq('patrimony', patrimony)
        );
        await Promise.all(updateEquipmentPromises);
      }

      // Create notification
      await supabase.from('notifications' as any).insert({
        user_id: user.id,
        message: isFullReturn 
          ? `Devolução completa registrada: ${loan.chromebook_number} (${loan.borrower_name})`
          : `Devolução parcial registrada: ${returnQuantity} de ${pendingQuantity} equipamentos (${loan.borrower_name})`,
        type: 'loan_returned',
        related_id: loan.id,
      } as any);

      // Enviar notificação se solicitado
      if (data.notify_it) {
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("user_id", user.id)
            .single();

          await supabase.functions.invoke("notify-loan-return", {
            body: {
              loanId: loan.id,
              borrowerName: loan.borrower_name,
              chromebookNumber: loan.chromebook_number,
              returnedBy: profile?.full_name || "Usuário",
              isPartialReturn: !isFullReturn,
              returnedQuantity: returnQuantity,
              totalQuantity: loan.quantity,
            },
          });
        } catch (notifError) {
          console.error("Error sending notification:", notifError);
        }
      }

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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Devolução</DialogTitle>
          <DialogDescription>
            {pendingQuantity > 1 
              ? "Selecione quantos equipamentos estão sendo devolvidos"
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
              {equipmentsList.map((num: string, index: number) => {
                const isAlreadyReturned = index < alreadyReturned;
                const isSelected = selectedEquipments.includes(index);
                
                if (isAlreadyReturned) {
                  return (
                    <div 
                      key={index}
                      className="flex items-center gap-3 p-2 rounded bg-muted/30 opacity-60"
                    >
                      <Checkbox checked disabled className="data-[state=checked]:bg-gray-400" />
                      <span className="font-mono text-sm line-through">{num}</span>
                      <Badge variant="secondary" className="ml-auto text-xs">Já devolvido</Badge>
                    </div>
                  );
                }
                
                return (
                  <div 
                    key={index}
                    onClick={() => toggleEquipment(index)}
                    className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                      isSelected 
                        ? 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700' 
                        : 'bg-muted/30 hover:bg-muted/50'
                    }`}
                  >
                    <Checkbox 
                      checked={isSelected} 
                      onCheckedChange={() => toggleEquipment(index)}
                      className={isSelected ? "data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600" : ""}
                    />
                    <span className={`font-mono text-sm ${isSelected ? 'font-medium' : ''}`}>{num}</span>
                    {isSelected && (
                      <Badge className="ml-auto text-xs bg-green-600">Será devolvido</Badge>
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

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading || returnQuantity === 0}
                className={isPartialReturn ? "bg-amber-600 hover:bg-amber-700" : "bg-green-600 hover:bg-green-700"}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {returnQuantity === 0 
                  ? "Selecione equipamentos"
                  : isPartialReturn 
                    ? `Devolver ${returnQuantity} equipamento(s)` 
                    : "Confirmar Devolução Total"
                }
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}