import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Calendar as CalendarIcon, User, GraduationCap, Briefcase } from "lucide-react";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const editLoanSchema = z.object({
  borrower_name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  borrower_type: z.enum(["aluno", "professor", "funcionario"]),
  responsible_teacher: z.string().optional(),
  class_name: z.string().optional(),
  expected_return_date: z.date().optional(),
  observations: z.string().optional(),
}).refine((data) => {
  if (data.borrower_type === "aluno") {
    return !!data.responsible_teacher && !!data.class_name;
  }
  return true;
}, {
  message: "Professor responsável e turma são obrigatórios para alunos",
  path: ["responsible_teacher"],
});

type EditLoanFormData = z.infer<typeof editLoanSchema>;

interface LoanEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan: any;
  onSuccess: () => void;
}

export function LoanEditDialog({ open, onOpenChange, loan, onSuccess }: LoanEditDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<EditLoanFormData>({
    resolver: zodResolver(editLoanSchema),
    defaultValues: {
      borrower_name: "",
      borrower_type: "aluno",
      responsible_teacher: "",
      class_name: "",
      observations: "",
    },
  });

  const borrowerType = form.watch("borrower_type");

  useEffect(() => {
    if (open && loan) {
      form.reset({
        borrower_name: loan.borrower_name || "",
        borrower_type: loan.borrower_type || "aluno",
        responsible_teacher: loan.responsible_teacher || "",
        class_name: loan.class_name || "",
        expected_return_date: loan.expected_return_date 
          ? parse(loan.expected_return_date, "yyyy-MM-dd", new Date()) 
          : undefined,
        observations: loan.observations || "",
      });
    }
  }, [open, loan, form]);

  const onSubmit = async (data: EditLoanFormData) => {
    if (!loan) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("chromebook_loans")
        .update({
          borrower_name: data.borrower_name,
          borrower_type: data.borrower_type,
          responsible_teacher: data.responsible_teacher || null,
          class_name: data.class_name || null,
          expected_return_date: data.expected_return_date ? formatLocalDate(data.expected_return_date) : null,
          observations: data.observations || null,
        })
        .eq("id", loan.id);

      if (error) throw error;

      toast({
        title: "Empréstimo atualizado!",
        description: "As informações foram salvas com sucesso.",
      });

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Error updating loan:", error);
      toast({
        variant: "destructive",
        title: "Erro ao atualizar empréstimo",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!loan) return null;

  const borrowerTypeOptions = [
    { value: "aluno", label: "Aluno", icon: GraduationCap },
    { value: "professor", label: "Professor", icon: User },
    { value: "funcionario", label: "Funcionário", icon: Briefcase },
  ];

  // Obter lista de equipamentos
  const equipmentsList = loan.chromebook_number 
    ? loan.chromebook_number.split(',').map((num: string) => num.trim()).filter((num: string) => num.length > 0)
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Icon icon="solar:pen-bold-duotone" className="h-6 w-6 text-primary" />
            Editar Empréstimo
          </DialogTitle>
        </DialogHeader>

        {/* Informações do Empréstimo (somente leitura) */}
        <div className="px-6 py-4 bg-muted/30 border-b space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Data do Empréstimo</p>
              <p className="font-medium">
                {format(parse(loan.loan_date, "yyyy-MM-dd", new Date()), "dd 'de' MMMM, yyyy", { locale: ptBR })}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Horário de Retirada</p>
              <p className="font-medium">{loan.pickup_time}</p>
            </div>
          </div>
          <div>
            <p className="text-muted-foreground text-sm mb-1">Equipamento(s)</p>
            <div className="flex flex-wrap gap-2">
              {equipmentsList.map((eq: string, index: number) => (
                <span 
                  key={index} 
                  className="inline-flex items-center px-2.5 py-1 rounded-md bg-background border text-sm font-mono"
                >
                  {eq}
                </span>
              ))}
            </div>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 pt-4 space-y-5">
            
            {/* Tipo de Solicitante */}
            <FormField
              control={form.control}
              name="borrower_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Tipo de Solicitante</FormLabel>
                  <div className="grid grid-cols-3 gap-3 mt-2">
                    {borrowerTypeOptions.map((option) => {
                      const IconComponent = option.icon;
                      const isSelected = field.value === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => field.onChange(option.value)}
                          className={cn(
                            "flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all",
                            isSelected
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border hover:border-primary/50 hover:bg-muted/50"
                          )}
                        >
                          <IconComponent className={cn("h-5 w-5 mb-1", isSelected ? "text-primary" : "text-muted-foreground")} />
                          <span className="font-medium text-sm">{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Nome do Solicitante */}
            <FormField
              control={form.control}
              name="borrower_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Nome do Solicitante</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Nome completo" className="pl-10" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Campos condicionais para Aluno */}
            {borrowerType === "aluno" && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="responsible_teacher"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Professor Responsável</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="Nome do professor" className="pl-10" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="class_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Turma</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Icon icon="solar:notebook-line-duotone" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="Ex: 9A" className="pl-10" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Previsão de Devolução */}
            <FormField
              control={form.control}
              name="expected_return_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    Previsão de Devolução <span className="text-muted-foreground font-normal">(Opcional)</span>
                  </FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal justify-start",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? format(field.value, "dd/MM/yyyy") : "Selecionar data"}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Observações */}
            <FormField
              control={form.control}
              name="observations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Observações</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Adicione observações sobre o empréstimo..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Botões */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading}
                className="bg-primary hover:bg-primary/90"
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Icon icon="solar:diskette-bold" className="mr-2 h-4 w-4" />
                Salvar Alterações
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}