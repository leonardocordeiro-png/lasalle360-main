import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, parse } from "date-fns";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

const returnSchema = z.object({
  return_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato inválido (HH:MM)"),
  observations: z.string().optional(),
  notify_it: z.boolean().default(true),
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

  const form = useForm<ReturnFormData>({
    resolver: zodResolver(returnSchema),
    defaultValues: {
      return_time: format(new Date(), "HH:mm"),
      notify_it: true,
    },
  });

  const onSubmit = async (data: ReturnFormData) => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Atualizar empréstimo
      const { error: updateError } = await supabase
        .from("chromebook_loans")
        .update({
          status: "devolvido",
          return_time: data.return_time,
          returned_by: user.id,
          returned_at: new Date().toISOString(),
          observations: data.observations ? 
            (loan.observations ? `${loan.observations}\n\nDevolução: ${data.observations}` : `Devolução: ${data.observations}`) 
            : loan.observations,
        })
        .eq("id", loan.id);

      if (updateError) throw updateError;

      // If it's a consolidated loan (quantity > 1), update individual IT equipment statuses
      if (loan.quantity > 1 && loan.chromebook_number) {
        const patrimonyNumbers = loan.chromebook_number.split(',').map((s: string) => s.trim());
        const updateEquipmentPromises = patrimonyNumbers.map(patrimony =>
          supabase.from('it_equipment')
            .update({ status: 'ATIVO' })
            .eq('patrimony', patrimony)
        );
        await Promise.all(updateEquipmentPromises);
      }

      // Create notification for the user who returned the loan
      await supabase.from('notifications' as any).insert({
        user_id: user.id,
        message: `Você registrou a devolução do(s) Chromebook(s) ${loan.chromebook_number} (Empréstimo de ${loan.borrower_name}).`,
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
            },
          });
        } catch (notifError) {
          console.error("Error sending notification:", notifError);
          // Não bloquear a devolução se a notificação falhar
        }
      }

      toast({
        title: "Devolução Registrada!",
        description: data.notify_it ? "Equipe TI foi notificada" : "Devolução confirmada com sucesso",
      });

      form.reset();
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Devolução</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Solicitante</div>
            <div className="font-medium">{loan.borrower_name}</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Chromebook</div>
              <div className="font-medium">
                {loan.chromebook_number.split(',').map((num: string, index: number) => (
                  <div key={index}>{num.trim()}</div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Data Empréstimo</div>
              <div className="font-medium">{format(parse(loan.loan_date, "yyyy-MM-dd", new Date()), "dd/MM/yyyy")}</div>
            </div>
          </div>

          {loan.responsible_teacher && (
            <div className="space-y-2">
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
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar Devolução
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}