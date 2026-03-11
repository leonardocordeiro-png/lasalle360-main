import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Calendar as CalendarIcon, User, GraduationCap, Briefcase, Plus, X } from "lucide-react";
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
  const [equipmentMap, setEquipmentMap] = useState<Record<string, string>>({});
  const [availableEquipments, setAvailableEquipments] = useState<any[]>([]);
  const [newEquipment, setNewEquipment] = useState("");
  const [showAddEquipment, setShowAddEquipment] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);

  const fetchEquipmentMap = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('it_equipment')
        .select('patrimony, id_number')
        .not('id_number', 'is', null);
      
      if (error) throw error;
      
      const map: Record<string, string> = {};
      data?.forEach(eq => {
        if (eq.patrimony && eq.id_number) {
          map[eq.patrimony.trim()] = eq.id_number;
          const normalized = eq.patrimony.replace(/^0+/, '');
          if (normalized !== eq.patrimony.trim()) {
            map[normalized] = eq.id_number;
          }
        }
      });
      setEquipmentMap(map);
    } catch (error) {
      console.error('Error fetching equipment map:', error);
    }
  }, []);

  const fetchAvailableEquipments = useCallback(async () => {
    try {
      // Buscar TODOS os equipamentos (não apenas ATIVOS) para validação
      const { data, error } = await supabase
        .from('it_equipment')
        .select('id, patrimony, id_number, equipment_type, status')
        .not('id_number', 'is', null)
        .order('id_number');
      
      if (error) throw error;
      setAvailableEquipments(data || []);
    } catch (error) {
      console.error('Error fetching equipment:', error);
    }
  }, []);

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
    if (open) {
      fetchEquipmentMap();
      fetchAvailableEquipments();
    }
  }, [open, fetchEquipmentMap, fetchAvailableEquipments]);

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

  const borrowerTypeOptions = [
    { value: "aluno", label: "Aluno", icon: GraduationCap },
    { value: "professor", label: "Professor", icon: User },
    { value: "funcionario", label: "Funcionário", icon: Briefcase },
  ];

  // Obter lista de equipamentos com ID e Patrimônio
  const equipmentsList = loan?.chromebook_number 
    ? loan.chromebook_number.split(',').map((num: string) => num.trim()).filter((num: string) => num.length > 0)
    : [];

  // Função para normalizar patrimônio (remover zeros à esquerda)
  const normalizePatrimony = (patrimony: string): string => {
    return patrimony.replace(/^0+/, '');
  };

  // Função para formatar equipamento para exibição (prioriza ID sobre Patrimônio)
  const formatEquipmentForDisplay = (equipment: string, loan: any): string => {
    const trimmedEquipment = equipment.trim();
    
    // Prioridade 1: Buscar ID no mapa de equipamentos pelo patrimônio
    if (equipmentMap[trimmedEquipment]) {
      return equipmentMap[trimmedEquipment];
    }
    
    // Prioridade 2: Tentar com patrimônio normalizado
    const normalized = normalizePatrimony(trimmedEquipment);
    if (equipmentMap[normalized]) {
      return equipmentMap[normalized];
    }
    
    // Prioridade 3: Se tiver equipment_id e it_equipment com id_number, mostra o ID
    if (loan?.equipment_id && loan.it_equipment?.id_number) {
      return loan.it_equipment.id_number;
    }
    
    // Fallback: mostra o patrimônio normalizado
    return normalized;
  };

  // Verificar se equipamento foi devolvido
  const isEquipmentReturned = (index: number): boolean => {
    return index < (loan?.returned_quantity || 0);
  };

  // Processar observações para substituir patrimônios por IDs
  const processObservations = (observations: string): string => {
    if (!observations || !equipmentMap) return observations;
    
    let processed = observations;
    
    // Para cada equipamento no mapa, substituir patrimônio por ID nas observações
    Object.entries(equipmentMap).forEach(([patrimony, id]) => {
      // Substituir menções do patrimônio pelo ID
      const regex = new RegExp(`\\b${patrimony}\\b`, 'g');
      processed = processed.replace(regex, id);
    });
    
    return processed;
  };

  // Busca em tempo real de equipamentos
  const searchEquipment = useCallback((searchTerm: string) => {
    if (!searchTerm.trim()) {
      setSearchResult(null);
      return;
    }
    
    const trimmedSearch = searchTerm.trim();
    const result = availableEquipments.find(eq => 
      eq.id_number === trimmedSearch || 
      eq.patrimony === trimmedSearch ||
      eq.id_number.toLowerCase().includes(trimmedSearch.toLowerCase()) ||
      eq.patrimony.toLowerCase().includes(trimmedSearch.toLowerCase())
    );
    
    setSearchResult(result);
  }, [availableEquipments]);

  // Atualizar busca quando o input mudar
  useEffect(() => {
    searchEquipment(newEquipment);
  }, [newEquipment, searchEquipment]);

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

  // Adicionar novo equipamento ao empréstimo
  const handleAddEquipment = async () => {
    if (!newEquipment.trim()) return;

    const selectedEquipment = searchResult;

    if (!selectedEquipment) {
      toast({
        variant: "destructive",
        title: "Equipamento não encontrado",
        description: "Verifique o ID ou patrimônio do equipamento."
      });
      return;
    }

    if (selectedEquipment.status !== 'ATIVO') {
      toast({
        variant: "destructive",
        title: "Equipamento não disponível",
        description: `Status atual: ${selectedEquipment.status}. Equipamentos emprestados não podem ser adicionados.`
      });
      return;
    }

    // Verificar se já está no empréstimo
    const alreadyInLoan = equipmentsList.some(eq => 
      formatEquipmentForDisplay(eq, loan) === selectedEquipment.id_number
    );
    
    if (alreadyInLoan) {
      toast({
        variant: "destructive",
        title: "Equipamento já no empréstimo",
        description: "Este equipamento já está incluído neste empréstimo."
      });
      return;
    }

    try {
      // Atualizar o chromebook_number do empréstimo
      const updatedEquipments = [...equipmentsList, selectedEquipment.patrimony || selectedEquipment.id_number];
      const updatedChromebookNumber = updatedEquipments.join(', ');

      // Atualizar quantidade
      const { error } = await supabase
        .from("chromebook_loans")
        .update({
          chromebook_number: updatedChromebookNumber,
          quantity: updatedEquipments.length,
        })
        .eq("id", loan.id);

      if (error) throw error;

      // Atualizar status do equipamento para EM_USO
      await supabase
        .from('it_equipment')
        .update({ status: 'EM_USO' })
        .eq('id', selectedEquipment.id);

      toast({
        title: "Equipamento adicionado!",
        description: `${selectedEquipment.id_number} foi adicionado ao empréstimo.`
      });

      setNewEquipment("");
      setShowAddEquipment(false);
      setSearchResult(null);
      onSuccess(); // Recarregar a lista
      onOpenChange(false); // Fechar e reabrir para atualizar
    } catch (error: any) {
      console.error("Error adding equipment:", error);
      toast({
        variant: "destructive",
        title: "Erro ao adicionar equipamento",
        description: error.message,
      });
    }
  };

  if (!loan) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Icon icon="solar:pen-bold-duotone" className="h-6 w-6 text-primary" />
            Editar Empréstimo
          </DialogTitle>
          <DialogDescription>
            Edite as informações do empréstimo, adicione mais equipamentos ou atualize os dados do solicitante.
          </DialogDescription>
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
            <div className="flex items-center justify-between mb-1">
              <p className="text-muted-foreground text-sm">Equipamento(s)</p>
              {loan.status !== 'devolvido' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddEquipment(!showAddEquipment)}
                  className="text-xs h-7 gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Adicionar
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {equipmentsList.map((eq: string, index: number) => {
                const isReturned = isEquipmentReturned(index);
                return (
                  <span 
                    key={index} 
                    className={`inline-flex items-center px-2.5 py-1 rounded-md border text-sm font-mono transition-all ${
                      isReturned 
                        ? 'bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-700 opacity-60 line-through text-gray-500 dark:text-gray-400' 
                        : 'bg-background border'
                    }`}
                  >
                    {formatEquipmentForDisplay(eq, loan)}
                    {isReturned && (
                      <span className="ml-1 text-xs text-gray-400">(devolvido)</span>
                    )}
                  </span>
                );
              })}
            </div>
            
            {/* Seção para adicionar novos equipamentos */}
            {showAddEquipment && (
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="ID ou Patrimônio do equipamento..."
                      value={newEquipment}
                      onChange={(e) => setNewEquipment(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddEquipment}
                    disabled={!newEquipment.trim() || (searchResult && searchResult.status !== 'ATIVO')}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Adicionar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowAddEquipment(false);
                      setNewEquipment("");
                      setSearchResult(null);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                
                {/* Feedback da busca em tempo real */}
                {newEquipment.trim() && (
                  <div className="mt-2">
                    {searchResult ? (
                      <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            searchResult.status === 'ATIVO' ? 'bg-green-500' :
                            searchResult.status === 'EM_USO' ? 'bg-red-500' :
                            searchResult.status === 'MANUTENÇÃO' ? 'bg-yellow-500' :
                            'bg-gray-500'
                          }`} />
                          <span className="text-sm font-medium">{searchResult.id_number}</span>
                          {searchResult.patrimony && (
                            <span className="text-xs text-gray-500">(Pat: {searchResult.patrimony})</span>
                          )}
                          <span className={`text-xs px-2 py-1 rounded ${
                            searchResult.status === 'ATIVO' ? 'bg-green-100 text-green-800' :
                            searchResult.status === 'EM_USO' ? 'bg-red-100 text-red-800' :
                            searchResult.status === 'MANUTENÇÃO' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {searchResult.status}
                          </span>
                        </div>
                        {searchResult.status === 'ATIVO' ? (
                          <span className="text-xs text-green-600">✓ Disponível</span>
                        ) : (
                          <span className="text-xs text-red-600">✗ Indisponível</span>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500 p-2">
                        Nenhum equipamento encontrado com: "{newEquipment}"
                      </div>
                    )}
                  </div>
                )}
                
                {availableEquipments.length > 0 && (
                  <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                    Disponíveis: {availableEquipments
                      .filter(eq => eq.status === 'ATIVO')
                      .slice(0, 5)
                      .map(eq => eq.id_number)
                      .join(', ')}
                    {availableEquipments.filter(eq => eq.status === 'ATIVO').length > 5 && 
                      ` e mais ${availableEquipments.filter(eq => eq.status === 'ATIVO').length - 5}`
                    }
                  </div>
                )}
              </div>
            )}
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
                      value={processObservations(field.value || loan.observations || "")}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                  {equipmentMap && Object.keys(equipmentMap).length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      IDs automaticamente exibidos em vez de patrimônios
                    </p>
                  )}
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
