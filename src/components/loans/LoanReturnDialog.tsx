import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, parse } from "date-fns";
import { Loader2, AlertCircle, Package } from "lucide-react";
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

// ---------------------------------------------------------------------------
// Schema de validação
// ---------------------------------------------------------------------------
const returnSchema = z.object({
  return_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato inválido (HH:MM)"),
  observations: z.string().optional(),
});

type ReturnFormData = z.infer<typeof returnSchema>;

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
interface EquipmentInfo {
  id: string;
  id_number: string | null;
  patrimony: string | null;
  brand: string;
  model: string;
}

interface LoanReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan: any;
  onSuccess: () => void;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------
export function LoanReturnDialog({ open, onOpenChange, loan, onSuccess }: LoanReturnDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [equipmentDetails, setEquipmentDetails] = useState<Record<string, EquipmentInfo>>({});
  const [isFetchingEquipment, setIsFetchingEquipment] = useState(false);

  // -------------------------------------------------------------------------
  // Helpers: extrair UUIDs confiáveis do empréstimo
  // -------------------------------------------------------------------------

  /** Todos os UUIDs de equipamentos deste empréstimo */
  const getAllUuids = (): string[] => {
    if (!loan) return [];
    // Novo caminho: coluna equipment_ids (UUID[])
    if (loan.equipment_ids && loan.equipment_ids.length > 0) {
      return loan.equipment_ids as string[];
    }
    // Legado: empréstimo simples com equipment_id
    if (loan.equipment_id) {
      return [loan.equipment_id as string];
    }
    return [];
  };

  /** UUIDs que já foram devolvidos */
  const getReturnedUuids = (): string[] => {
    if (!loan) return [];
    // Novo caminho: coluna returned_equipment_ids (UUID[])
    if (loan.returned_equipment_ids && loan.returned_equipment_ids.length > 0) {
      return loan.returned_equipment_ids as string[];
    }
    // Legado: usar returned_quantity para inferir os primeiros N da lista
    const all = getAllUuids();
    if (loan.returned_quantity > 0 && all.length > 0) {
      return all.slice(0, loan.returned_quantity);
    }
    return [];
  };

  const allUuids = getAllUuids();
  const returnedUuids = getReturnedUuids();
  const pendingUuids = allUuids.filter(id => !returnedUuids.includes(id));

  // Empréstimo legado sem UUIDs (multi-equipment criado antes da migration)
  const isLegacyLoan = allUuids.length === 0;

  // -------------------------------------------------------------------------
  // Buscar detalhes dos equipamentos por UUID
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!open || !loan) {
      setSelectedIds([]);
      setEquipmentDetails({});
      return;
    }

    if (allUuids.length === 0) {
      setSelectedIds([]);
      return;
    }

    const fetchDetails = async () => {
      setIsFetchingEquipment(true);
      try {
        const { data, error } = await supabase
          .from("it_equipment")
          .select("id, id_number, patrimony, brand, model")
          .in("id", allUuids);

        if (error) throw error;

        const map: Record<string, EquipmentInfo> = {};
        data?.forEach(eq => {
          map[eq.id] = eq;
        });
        setEquipmentDetails(map);
      } catch (err) {
        console.error("Erro ao buscar detalhes dos equipamentos:", err);
      } finally {
        setIsFetchingEquipment(false);
      }
    };

    fetchDetails();
    setSelectedIds([]);
  }, [open, loan?.id]);

  // -------------------------------------------------------------------------
  // Rótulo de exibição: prioriza id_number → patrimony → brand+model
  // -------------------------------------------------------------------------
  const getDisplayLabel = (uuid: string): string => {
    const eq = equipmentDetails[uuid];
    if (!eq) return uuid.slice(0, 8) + "…";
    if (eq.id_number?.trim()) return eq.id_number.trim();
    if (eq.patrimony?.trim()) return eq.patrimony.trim();
    return `${eq.brand} ${eq.model}`;
  };

  // -------------------------------------------------------------------------
  // Seleção de equipamentos
  // -------------------------------------------------------------------------
  const toggleEquipment = (uuid: string) => {
    setSelectedIds(prev =>
      prev.includes(uuid) ? prev.filter(id => id !== uuid) : [...prev, uuid]
    );
  };

  const selectAll = () => setSelectedIds([...pendingUuids]);
  const deselectAll = () => setSelectedIds([]);

  // -------------------------------------------------------------------------
  // Contadores
  // -------------------------------------------------------------------------
  const returnQuantity = isLegacyLoan ? loan?.quantity - (loan?.returned_quantity || 0) : selectedIds.length;
  const pendingQuantity = isLegacyLoan ? loan?.quantity - (loan?.returned_quantity || 0) : pendingUuids.length;
  const newReturnedCount = returnedUuids.length + (isLegacyLoan ? pendingQuantity : selectedIds.length);
  const isFullReturn = newReturnedCount >= (loan?.quantity || 0);
  const isPartialReturn = !isLegacyLoan && selectedIds.length > 0 && !isFullReturn;

  // -------------------------------------------------------------------------
  // Form
  // -------------------------------------------------------------------------
  const form = useForm<ReturnFormData>({
    resolver: zodResolver(returnSchema),
    defaultValues: {
      return_time: format(new Date(), "HH:mm"),
    },
  });

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------
  const onSubmit = async (data: ReturnFormData) => {
    if (!isLegacyLoan && selectedIds.length === 0) return;
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Rótulos visíveis para o texto da observação
      const returnedLabels = isLegacyLoan
        ? [loan.chromebook_number]
        : selectedIds.map(id => getDisplayLabel(id));

      const returnNote = data.observations
        ? `Devolução ${isFullReturn ? "completa" : "parcial"} (${returnQuantity}/${pendingQuantity}): ${returnedLabels.join(", ")}. ${data.observations}`
        : `Devolução ${isFullReturn ? "completa" : "parcial"} de ${returnQuantity} equipamento(s): ${returnedLabels.join(", ")}`;

      const newObservations = loan.observations
        ? `${loan.observations}\n\n${format(new Date(), "dd/MM/yyyy HH:mm")} - ${returnNote}`
        : `${format(new Date(), "dd/MM/yyyy HH:mm")} - ${returnNote}`;

      // Novos UUIDs devolvidos (acumulativo)
      const newReturnedEquipmentIds = isLegacyLoan
        ? returnedUuids
        : [...returnedUuids, ...selectedIds];

      // Dados de atualização do empréstimo
      const loanUpdate: Record<string, unknown> = {
        returned_quantity: newReturnedCount,
        returned_equipment_ids: newReturnedEquipmentIds,
        observations: newObservations,
      };

      if (isFullReturn) {
        loanUpdate.status = "devolvido";
        loanUpdate.return_time = data.return_time;
        loanUpdate.returned_by = user.id;
        loanUpdate.returned_at = new Date().toISOString();
        loanUpdate.equipment_id = null;
      }

      // -----------------------------------------------------------------------
      // Atualizar empréstimo
      // -----------------------------------------------------------------------
      const { error: loanError } = await supabase
        .from("chromebook_loans")
        .update(loanUpdate)
        .eq("id", loan.id);

      if (loanError) throw loanError;

      // -----------------------------------------------------------------------
      // Atualizar status dos equipamentos — EXCLUSIVAMENTE por UUID
      // Sem conversão de texto, sem ambiguidade.
      // -----------------------------------------------------------------------
      if (!isLegacyLoan && selectedIds.length > 0) {
        const { error: eqError } = await supabase
          .from("it_equipment")
          .update({ status: "ATIVO" })
          .in("id", selectedIds);

        if (eqError) throw eqError;
      } else if (isLegacyLoan) {
        // Fallback para empréstimos legados sem UUIDs:
        // Tenta usar equipment_id (single) ou, como último recurso, id_number
        if (loan.equipment_id) {
          await supabase
            .from("it_equipment")
            .update({ status: "ATIVO" })
            .eq("id", loan.equipment_id);
        } else {
          // Empréstimo múltiplo legado: não temos UUIDs confiáveis.
          // Atualiza apenas os que conseguimos encontrar via id_number.
          const numbers = (loan.chromebook_number || "")
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean);
          if (numbers.length > 0) {
            await supabase
              .from("it_equipment")
              .update({ status: "ATIVO" })
              .in("id_number", numbers);
          }
        }
      }

      // -----------------------------------------------------------------------
      // Notificação interna
      // -----------------------------------------------------------------------
      await supabase.from("notifications" as any).insert({
        user_id: user.id,
        message: isFullReturn
          ? `Devolução completa: ${returnedLabels.join(", ")} (${loan.borrower_name})`
          : `Devolução parcial: ${returnedLabels.join(", ")} devolvido(s) por ${loan.borrower_name}`,
        type: "loan_returned",
        related_id: loan.id,
      } as any);

      toast({
        title: isFullReturn ? "Devolução Completa!" : "Devolução Parcial Registrada!",
        description: isFullReturn
          ? "Todos os equipamentos foram devolvidos e estão disponíveis no inventário."
          : `${returnQuantity} equipamento(s) devolvido(s). Restam ${pendingQuantity - selectedIds.length} com ${loan.borrower_name}.`,
      });

      form.reset();
      setSelectedIds([]);
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Erro ao registrar devolução:", error);
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

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Devolução</DialogTitle>
          <DialogDescription>
            {!isLegacyLoan && pendingQuantity > 1
              ? <span>
                  <span className="text-red-600 font-semibold">Vermelho</span>: Será devolvido •{" "}
                  <span className="text-green-600 font-semibold">Verde</span>: Permanecerá emprestado
                </span>
              : "Confirme a devolução do(s) equipamento(s)"
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
              <div className="font-medium">
                {format(parse(loan.loan_date, "yyyy-MM-dd", new Date()), "dd/MM/yyyy")}
              </div>
            </div>
          </div>

          {/* Alerta: devoluções anteriores */}
          {returnedUuids.length > 0 && (
            <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/30">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 dark:text-blue-200">
                <strong>{returnedUuids.length}</strong> de <strong>{allUuids.length}</strong>{" "}
                equipamento(s) já devolvidos. Restam <strong>{pendingUuids.length}</strong>.
              </AlertDescription>
            </Alert>
          )}

          {/* Seleção de equipamentos */}
          {!isLegacyLoan ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Selecione os equipamentos a devolver</div>
                {pendingUuids.length > 1 && (
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={selectAll} className="text-xs h-7">
                      Todos
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={deselectAll} className="text-xs h-7">
                      Limpar
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto border rounded-lg p-2">
                {isFetchingEquipment ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span className="text-sm text-muted-foreground">Carregando equipamentos…</span>
                  </div>
                ) : (
                  <>
                    {/* Já devolvidos */}
                    {returnedUuids.map(uuid => (
                      <div key={uuid} className="flex items-center gap-3 p-2 rounded bg-muted/30 opacity-60">
                        <Checkbox checked disabled className="data-[state=checked]:bg-gray-400" />
                        <Package className="h-3 w-3 text-muted-foreground" />
                        <span className="font-mono text-sm line-through">{getDisplayLabel(uuid)}</span>
                        <Badge variant="secondary" className="ml-auto text-xs">Já devolvido</Badge>
                      </div>
                    ))}

                    {/* Pendentes */}
                    {pendingUuids.map(uuid => {
                      const isSelected = selectedIds.includes(uuid);
                      return (
                        <div
                          key={uuid}
                          onClick={() => toggleEquipment(uuid)}
                          className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700"
                              : "bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700"
                          }`}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleEquipment(uuid)}
                            className={isSelected
                              ? "data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                              : ""}
                          />
                          <Package className={`h-3 w-3 ${isSelected ? "text-red-600" : "text-green-600"}`} />
                          <span className={`font-mono text-sm ${isSelected ? "font-semibold text-red-700" : "text-green-700"}`}>
                            {getDisplayLabel(uuid)}
                          </span>
                          {isSelected ? (
                            <Badge className="ml-auto text-xs bg-red-600 text-white">SERÁ DEVOLVIDO</Badge>
                          ) : (
                            <Badge className="ml-auto text-xs bg-green-600 text-white">PERMANECERÁ</Badge>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              <div className="text-center text-sm">
                <span className="font-medium text-primary">{selectedIds.length}</span>
                <span className="text-muted-foreground"> de {pendingUuids.length} selecionado(s)</span>
              </div>
            </div>
          ) : (
            // Empréstimo legado sem equipment_ids: confirmação simples
            <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/30">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                <strong>Empréstimo legado.</strong> Equipamento(s): <span className="font-mono">{loan.chromebook_number}</span>.
                Confirme a devolução de <strong>{pendingQuantity}</strong> equipamento(s).
              </AlertDescription>
            </Alert>
          )}

          {/* Alerta devolução parcial */}
          {isPartialReturn && (
            <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/30">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                <strong>Devolução parcial:</strong> {pendingUuids.length - selectedIds.length} equipamento(s)
                continuarão com {loan.borrower_name}.
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
                      placeholder="Adicione observações sobre a devolução…"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
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
                disabled={isLoading || (!isLegacyLoan && selectedIds.length === 0)}
                className={`w-full sm:w-auto ${isPartialReturn ? "bg-amber-600 hover:bg-amber-700" : "bg-green-600 hover:bg-green-700"}`}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {!isLegacyLoan && selectedIds.length === 0
                  ? "Selecione equipamentos"
                  : isPartialReturn
                    ? `Devolver ${selectedIds.length}`
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
