import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Calendar as CalendarIcon, X, CheckCircle, User, GraduationCap, Briefcase } from "lucide-react";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import { searchEquipmentForLoan, validateEquipmentForLoan, validateEquipmentById } from "@/lib/loansValidation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Função para obter iniciais do nome
const getInitials = (name: string): string => {
  if (!name) return '';
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
};

// Função para normalizar o texto do patrimônio (corrigir caracteres estranhos)
const normalizePatrimony = (text: string | null | undefined): string => {
  if (!text) return '';
  
  // Corrigir padrões comuns de encoding quebrado
  let normalized = text
    .replace(/SEM PATRIM�NIO/gi, 'SEM PATRIMÔNIO')
    .replace(/SEM PATRIMONIO/gi, 'SEM PATRIMÔNIO')
    .replace(/PATRIM�NIO/gi, 'PATRIMÔNIO')
    .replace(/PATRIMONIO/gi, 'PATRIMÔNIO')
    .replace(/�/g, 'Ô'); // Substituir caractere quebrado genérico
  
  return normalized;
};

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getBrazilNow = () => {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map(p => [p.type, p.value]));
  return {
    dateISO: `${parts.year}-${parts.month}-${parts.day}` as string,
    time: `${parts.hour}:${parts.minute}` as string,
  };
};

const loanSchema = z.object({
  borrower_name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  borrower_type: z.enum(["aluno", "colaborador"]),
  responsible_teacher: z.string().optional(),
  class_name: z.string().optional(),
  equipment_type: z.enum(["aluno", "colaborador"]),
  chromebook_number: z.string().optional(),
  quantity: z.number().min(1).max(50),
  loan_date: z.date(),
  pickup_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato inválido (HH:MM)"),
  expected_return_date: z.date().optional(),
  observations: z.string().optional(),
}).refine((data) => {
  if (data.borrower_type === "aluno") {
    return !!data.responsible_teacher; // Apenas professor responsável obrigatório
  }
  return true;
}, {
  message: "Professor responsável é obrigatório para alunos",
  path: ["responsible_teacher"],
}).refine((data) => {
  if (data.quantity === 1) {
    return data.chromebook_number && data.chromebook_number.length > 0;
  }
  return true;
}, {
  message: "Selecione um Chromebook",
  path: ["chromebook_number"],
});

type LoanFormData = z.infer<typeof loanSchema>;

interface LoanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function LoanDialog({ open, onOpenChange, onSuccess }: LoanDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<any>(null);
  const [selectedEquipments, setSelectedEquipments] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [equipmentValidated, setEquipmentValidated] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<any[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showUserResults, setShowUserResults] = useState(false);
  const [teacherSearchResults, setTeacherSearchResults] = useState<any[]>([]);
  const [isSearchingTeachers, setIsSearchingTeachers] = useState(false);
  const [showTeacherResults, setShowTeacherResults] = useState(false);
  const [quantityDisplay, setQuantityDisplay] = useState('1');

  const form = useForm<LoanFormData>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      borrower_type: "aluno",
      equipment_type: "aluno",
      quantity: 1,
      loan_date: new Date(),
      pickup_time: format(new Date(), "HH:mm"),
    },
  });

  const borrowerType = form.watch("borrower_type");
  const quantity = form.watch("quantity");
const equipmentCategory: string = "chromebook";

  // Keep quantityDisplay in sync with form value
  useEffect(() => {
    setQuantityDisplay(String(quantity));
  }, [quantity]);

  // Limpar equipamento individual quando muda para seleção múltipla
  useEffect(() => {
    if (quantity > 1) {
      form.setValue("chromebook_number", "");
      setSelectedEquipment(null);
      setEquipmentValidated(false);
    }
  }, [quantity, form]);

  // Auto-select equipment_type based on borrower_type
  useEffect(() => {
    if (borrowerType === "aluno") {
      form.setValue("equipment_type", "aluno");
    } else {
      form.setValue("equipment_type", "colaborador");
    }
  }, [borrowerType, form]);

  const getBorrowerLabel = () => {
    switch (borrowerType) {
      case "aluno": return "Nome do Estudante";
      case "colaborador": return "Nome do Colaborador";
      default: return "Nome do Solicitante";
    }
  };

  useEffect(() => {
    if (open) {
      const brNow = getBrazilNow();
      form.reset({
        borrower_type: "aluno",
        equipment_type: "aluno",
        quantity: 1,
        loan_date: new Date(),
        pickup_time: brNow.time,
        borrower_name: "",
        chromebook_number: "",
        observations: "",
      });
      setSelectedEquipment(null);
      setSelectedEquipments([]);
      setSearchQuery('');
      setSearchResults([]);
      setEquipmentValidated(false);
      setUserSearchQuery('');
      setUserSearchResults([]);
      setSelectedUser(null);
      setShowUserResults(false);
      setTeacherSearchResults([]);
      setIsSearchingTeachers(false);
      setShowTeacherResults(false);
    }
  }, [open, form]);

  // Limpar busca de usuário quando muda o tipo de solicitante
  useEffect(() => {
    setUserSearchQuery('');
    setUserSearchResults([]);
    setSelectedUser(null);
    setShowUserResults(false);
    form.setValue("borrower_name", "");
  }, [borrowerType]);

  useEffect(() => {
    if (selectedEquipments.length > quantity) {
      setSelectedEquipments(selectedEquipments.slice(0, quantity));
    }
    if (quantity === 1) {
      setSelectedEquipments([]);
    }
  }, [quantity, selectedEquipments]);

  useEffect(() => {
    const searchEquipments = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const results = await searchEquipmentForLoan(searchQuery, equipmentCategory);
        setSearchResults(results);
      } catch (error) {
        console.error('Erro ao buscar equipamentos:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(searchEquipments, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, equipmentCategory]);

  const handleUserInputChange = async (value: string) => {
    setUserSearchQuery(value);
    form.setValue("borrower_name", value);
    
    if (value.length >= 2) {
      setIsSearchingUsers(true);
      setShowUserResults(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('user_id, full_name, email, avatar_url')
          .ilike('full_name', `%${value}%`)
          .limit(10);
        
        if (error) throw error;
        setUserSearchResults(data || []);
      } catch (error) {
        console.error('Erro ao buscar usuários:', error);
        setUserSearchResults([]);
      } finally {
        setIsSearchingUsers(false);
      }
    } else {
      setUserSearchResults([]);
      setIsSearchingUsers(false);
      setShowUserResults(false);
    }
  };

  const handleUserSelect = (user: any) => {
    form.setValue("borrower_name", user.full_name);
    setUserSearchQuery(user.full_name);
    setUserSearchResults([]);
    setShowUserResults(false);
    setIsSearchingUsers(false);
    setSelectedUser(user);
  };

  // Handler para busca de professor responsável
  const handleTeacherInputChange = async (value: string) => {
    form.setValue("responsible_teacher", value);
    
    if (value.length >= 2) {
      setIsSearchingTeachers(true);
      setShowTeacherResults(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('user_id, full_name, email, avatar_url')
          .ilike('full_name', `%${value}%`)
          .limit(10);
        
        if (error) throw error;
        setTeacherSearchResults(data || []);
      } catch (error) {
        console.error('Erro ao buscar professores:', error);
        setTeacherSearchResults([]);
      } finally {
        setIsSearchingTeachers(false);
      }
    } else {
      setTeacherSearchResults([]);
      setIsSearchingTeachers(false);
      setShowTeacherResults(false);
    }
  };

  const handleTeacherSelect = (teacher: any) => {
    form.setValue("responsible_teacher", teacher.full_name);
    setTeacherSearchResults([]);
    setShowTeacherResults(false);
    setIsSearchingTeachers(false);
  };

  const handleEquipmentSelect = async (equipment: any) => {
    try {
      // Validar consistência do tipo de equipamento
      const equipmentType = form.getValues("equipment_type");
      if (equipmentType === "aluno" && !equipment.equipment_type?.toLowerCase().includes('chromebook')) {
        toast({
          variant: "destructive",
          title: "Tipo incompatível",
          description: "Para alunos, selecione apenas Chromebooks. Este é um notebook.",
        });
        return;
      }
      if (equipmentType === "colaborador" && !equipment.equipment_type?.toLowerCase().includes('chromebook')) {
        toast({
          variant: "destructive",
          title: "Tipo incompatível",
          description: "Para colaboradores, selecione apenas Chromebooks. Este é um notebook.",
        });
        return;
      }

      const validation = await validateEquipmentById(equipment.id);
      if (!validation.valid) {
        toast({
          variant: "destructive",
          title: "Equipamento indisponível",
          description: validation.message,
        });
        return;
      }

      if (quantity === 1) {
        setSelectedEquipment(validation.equipment);
        form.setValue("chromebook_number", getBestIdentifierForSave(equipment));
        setSearchResults([]);
        setSearchQuery('');
        setEquipmentValidated(true);
        return;
      }

      if (selectedEquipments.some(eq => eq.id === equipment.id)) {
        toast({
          variant: "destructive",
          title: "Equipamento duplicado",
          description: "Este Chromebook já foi adicionado à lista"
        });
        return;
      }

      if (selectedEquipments.length >= quantity) {
        toast({
          variant: "destructive",
          title: "Limite atingido",
          description: `Você já selecionou ${quantity} equipamentos`
        });
        return;
      }

      setSelectedEquipments([...selectedEquipments, equipment]);
      
      // Atualizar chromebook_number quando adiciona equipamentos
      const updatedIdentifiers = [...selectedEquipments, equipment].map(eq => getBestIdentifierForSave(eq));
      form.setValue("chromebook_number", updatedIdentifiers.join(', '), { shouldValidate: true });
      
      setSearchQuery('');
      setSearchResults([]);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao validar equipamento",
        description: "Não foi possível validar o equipamento selecionado.",
      });
    }
  };

  const handleCheckEquipment = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const validation = await validateEquipmentForLoan(searchQuery, equipmentCategory);
      if (validation.valid && validation.equipment) {
        // Validar consistência do tipo de equipamento
        const equipmentType = form.getValues("equipment_type");
        if (equipmentType === "aluno" && !validation.equipment.equipment_type?.toLowerCase().includes('chromebook')) {
          toast({
            variant: "destructive",
            title: "Tipo incompatível",
            description: "Para alunos, selecione apenas Chromebooks. Este é um notebook.",
          });
          setIsSearching(false);
          return;
        }
        if (equipmentType === "colaborador" && !validation.equipment.equipment_type?.toLowerCase().includes('chromebook')) {
          toast({
            variant: "destructive",
            title: "Tipo incompatível",
            description: "Para colaboradores, selecione apenas Chromebooks. Este é um notebook.",
          });
          setIsSearching(false);
          return;
        }

        setSelectedEquipment(validation.equipment);
        form.setValue("chromebook_number", validation.equipment.patrimony);
        setEquipmentValidated(true);
        setSearchResults([]);
        toast({
          title: "Equipamento disponível!",
          description: `${validation.equipment.brand} ${validation.equipment.model} - ${validation.equipment.patrimony}`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Equipamento indisponível",
          description: validation.message,
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível verificar o equipamento",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const getEquipmentDisplay = (eq: any) => {
    // Verificar se patrimônio é válido
    const invalidPatterns = ['sem patrimonio', 'sem patrimônio', 'n/a', 'na', '-', ''];
    const normalizedPatrimony = normalizePatrimony(eq.patrimony);
    const hasValidPatrimony = eq.patrimony && !invalidPatterns.includes(normalizedPatrimony.toLowerCase().trim());
    
    // Prioridade: ID > Patrimônio válido
    if (eq.id_number && eq.id_number.trim()) {
      return `ID: ${eq.id_number}`;
    }
    if (hasValidPatrimony) {
      return normalizedPatrimony;
    }
    return eq.serial_number ? `Série: ${eq.serial_number}` : 'N/A';
  };

  // Função para obter o melhor identificador para salvar no chromebook_number
  const getBestIdentifierForSave = (eq: any): string => {
    const invalidPatterns = ['sem patrimonio', 'sem patrimônio', 'n/a', 'na', '-', ''];
    const normalizedPatrimony = normalizePatrimony(eq.patrimony);
    const hasValidPatrimony = eq.patrimony && !invalidPatterns.includes(normalizedPatrimony.toLowerCase().trim());
    
    // Se patrimônio é válido, usar patrimônio normalizado
    if (hasValidPatrimony) {
      return normalizedPatrimony;
    }
    
    // Se tem id_number, usar id_number
    if (eq.id_number && eq.id_number.trim()) {
      return eq.id_number;
    }
    
    // Fallback para serial_number ou patrimônio mesmo inválido
    return eq.serial_number || normalizedPatrimony || 'N/A';
  };

  const onSubmit = async (data: LoanFormData) => {
    setIsLoading(true);
    try {
      // Validações antecipadas antes de qualquer chamada ao banco
      if (data.quantity === 1 && !selectedEquipment) {
        toast({
          variant: "destructive",
          title: "Equipamento não validado",
          description: "Busque e selecione um equipamento válido antes de continuar.",
        });
        setIsLoading(false);
        return;
      }

      if (data.quantity > 1 && selectedEquipments.length !== data.quantity) {
        toast({
          variant: "destructive",
          title: "Seleção incompleta",
          description: `Selecione ${data.quantity} equipamentos (${selectedEquipments.length}/${data.quantity})`,
        });
        setIsLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const brNow = getBrazilNow();
      let loanRecord: any;

      if (data.quantity > 1) {
        
        const chromebookNumbers = selectedEquipments.map(eq => getBestIdentifierForSave(eq)).join(', ');

        const { data: newLoan, error: insertError } = await supabase
          .from("chromebook_loans")
          .insert({
            borrower_name: data.borrower_name,
            borrower_type: data.borrower_type,
            responsible_teacher: data.responsible_teacher || null,
            class_name: data.class_name || null,
            equipment_type: data.equipment_type,
            chromebook_number: chromebookNumbers,
            quantity: data.quantity,
            loan_date: brNow.dateISO,
            pickup_time: brNow.time,
            expected_return_date: data.expected_return_date ? formatLocalDate(data.expected_return_date) : null,
            observations: data.observations || null,
            created_by: user.id,
            equipment_id: null,
            equipment_ids: selectedEquipments.map(eq => eq.id),
          })
          .select()
          .single();

        if (insertError) throw insertError;
        loanRecord = newLoan;

        // Atualizar status de todos os equipamentos em batch usando IN
        const equipmentIds = selectedEquipments.map(eq => eq.id);
        await supabase.from('it_equipment')
          .update({ status: 'EM_USO' })
          .in('id', equipmentIds);

        toast({
          title: "Sucesso!",
          description: `${data.quantity} Chromebooks emprestados!`,
        });

      } else {
        let equipmentToUse = selectedEquipment;

        if (!equipmentToUse) {
          const validation = await validateEquipmentForLoan(data.chromebook_number!, equipmentCategory);
          if (!validation.valid) {
            toast({
              variant: "destructive",
              title: "Erro",
              description: validation.message
            });
            setIsLoading(false);
            return;
          }
          equipmentToUse = validation.equipment;
        }

        const { data: newLoan, error: insertError } = await supabase
          .from("chromebook_loans")
          .insert({
            borrower_name: data.borrower_name,
            borrower_type: data.borrower_type,
            responsible_teacher: data.responsible_teacher || null,
            class_name: data.class_name || null,
            equipment_type: data.equipment_type,
            chromebook_number: data.chromebook_number!,
            quantity: data.quantity,
            loan_date: brNow.dateISO,
            pickup_time: brNow.time,
            expected_return_date: data.expected_return_date ? formatLocalDate(data.expected_return_date) : null,
            observations: data.observations || null,
            created_by: user.id,
            equipment_id: equipmentToUse.id,
            equipment_ids: [equipmentToUse.id],
          })
          .select()
          .single();

        if (insertError) throw insertError;
        loanRecord = newLoan;

        // Atualizar status do equipamento individual
        await supabase.from('it_equipment')
          .update({ status: 'EM_USO' })
          .eq('id', equipmentToUse.id);

        toast({
          title: "Sucesso!",
          description: "Empréstimo registrado com sucesso.",
        });
      }

      form.reset();
      setSelectedEquipment(null);
      setSelectedEquipments([]);
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Error creating loan:", error);
      toast({
        variant: "destructive",
        title: "Erro ao registrar empréstimo",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const borrowerTypeOptions = [
    { value: "aluno", label: "Aluno", sublabel: "Estudante", icon: GraduationCap },
    { value: "colaborador", label: "Colaborador", sublabel: "Staff", icon: Briefcase },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-2xl">
        {/* Header com gradiente */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-5 pb-6 text-white">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30"></div>
          <div className="relative flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20">
              <Icon icon="solar:laptop-bold-duotone" className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white">Novo Empréstimo</DialogTitle>
              <DialogDescription className="text-blue-100 text-xs mt-0.5">
                Preencha os dados para registrar o empréstimo de Chromebooks
              </DialogDescription>
            </div>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-0">
            
            {/* === SEÇÃO 1: Quem está solicitando === */}
            <div className="p-5 space-y-4 border-b border-border/50">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <span className="text-xs font-bold text-blue-700 dark:text-blue-300">1</span>
                </div>
                <h3 className="text-sm font-semibold text-foreground">Solicitante</h3>
              </div>

              {/* Tipo de Solicitante - tabs compactas */}
              <FormField
                control={form.control}
                name="borrower_type"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-xl w-fit">
                      {borrowerTypeOptions.map((option) => {
                        const OptionIcon = option.icon;
                        const isSelected = field.value === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => field.onChange(option.value)}
                            className={cn(
                              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                              isSelected
                                ? "bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-400 shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <OptionIcon className={cn("h-4 w-4", isSelected ? "text-blue-600" : "text-muted-foreground")} />
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Nome e Professor Responsável */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="borrower_name"
                  render={({ field }) => (
                    <FormItem className="relative">
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {getBorrowerLabel()}
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          {borrowerType === "aluno" ? (
                            <Input 
                              placeholder="Nome do aluno..." 
                              className="pl-10 rounded-xl h-10" 
                              {...field} 
                            />
                          ) : (
                            <>
                              <Input 
                                placeholder="Buscar usuário..." 
                                className="pl-10 rounded-xl h-10"
                                value={userSearchQuery}
                                onChange={(e) => handleUserInputChange(e.target.value)}
                                onFocus={() => {
                                  if (userSearchResults.length > 0) setShowUserResults(true);
                                }}
                                onBlur={() => setTimeout(() => setShowUserResults(false), 200)}
                              />
                              {isSearchingUsers && (
                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                              )}
                              {selectedUser && !isSearchingUsers && (
                                <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                              )}
                            </>
                          )}
                        </div>
                      </FormControl>
                      
                      {/* Resultados da busca de usuários */}
                      {borrowerType !== "aluno" && showUserResults && userSearchResults.length > 0 && (
                        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-background border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                          {userSearchResults.map((user) => (
                            <button
                              key={user.user_id}
                              type="button"
                              className="w-full text-left px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors flex items-center gap-3 first:rounded-t-xl last:rounded-b-xl"
                              onClick={() => handleUserSelect(user)}
                            >
                              <Avatar className="h-7 w-7 border">
                                <AvatarImage src={user.avatar_url} />
                                <AvatarFallback className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                  {getInitials(user.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{user.full_name}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      
                      {borrowerType !== "aluno" && showUserResults && userSearchQuery.length >= 2 && userSearchResults.length === 0 && !isSearchingUsers && (
                        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-background border rounded-xl shadow-lg p-3">
                          <p className="text-xs text-muted-foreground text-center">
                            Nenhum usuário encontrado. Digite o nome manualmente.
                          </p>
                        </div>
                      )}
                      
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="responsible_teacher"
                  render={({ field }) => (
                    <FormItem className="relative">
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Professor Responsável {borrowerType === "aluno" && <span className="text-red-500">*</span>}
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input 
                            placeholder={borrowerType === "aluno" ? "Buscar professor..." : "Não aplicável"}
                            className="pl-10 rounded-xl h-10" 
                            disabled={borrowerType !== "aluno"}
                            value={field.value || ''}
                            onChange={(e) => handleTeacherInputChange(e.target.value)}
                            onBlur={() => setTimeout(() => setShowTeacherResults(false), 200)}
                            onFocus={() => field.value && field.value.length >= 2 && setShowTeacherResults(true)}
                          />
                          {isSearchingTeachers && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                          
                          {showTeacherResults && teacherSearchResults.length > 0 && borrowerType === "aluno" && (
                            <div className="absolute z-50 w-full mt-1 bg-background border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                              {teacherSearchResults.map((teacher) => (
                                <button
                                  key={teacher.user_id}
                                  type="button"
                                  className="w-full px-3 py-2.5 text-left hover:bg-purple-50 dark:hover:bg-purple-950/20 flex items-center gap-2 first:rounded-t-xl last:rounded-b-xl"
                                  onClick={() => handleTeacherSelect(teacher)}
                                >
                                  <Avatar className="h-6 w-6">
                                    <AvatarImage src={teacher.avatar_url} />
                                    <AvatarFallback className="text-[10px] bg-purple-100 text-purple-700">{getInitials(teacher.full_name)}</AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{teacher.full_name}</p>
                                    <p className="text-[10px] text-muted-foreground truncate">{teacher.email}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Turma */}
              {borrowerType === "aluno" && (
                <FormField
                  control={form.control}
                  name="class_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Turma <span className="normal-case font-normal">(opcional)</span>
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Icon icon="solar:notebook-line-duotone" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input 
                            placeholder="Ex: 9A" 
                            className="pl-10 rounded-xl h-10 max-w-[200px]" 
                            {...field} 
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* === SEÇÃO 2: Equipamento === */}
            <div className="p-5 space-y-4 border-b border-border/50">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">2</span>
                </div>
                <h3 className="text-sm font-semibold text-foreground">Equipamento</h3>
              </div>

              {/* Tipo + Quantidade */}
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="equipment_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="rounded-xl h-10">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="aluno">Chromebook Aluno</SelectItem>
                          <SelectItem value="colaborador">Chromebook Colaborador</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Quantidade</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const current = Number(field.value) || 1;
                              const newVal = Math.max(1, current - 1);
                              field.onChange(newVal);
                              setQuantityDisplay(String(newVal));
                              if (newVal <= 1) {
                                form.setValue("chromebook_number", "");
                                setSelectedEquipment(null);
                                setEquipmentValidated(false);
                              }
                            }}
                            className="h-10 w-10 rounded-xl border bg-muted/50 hover:bg-muted flex items-center justify-center text-foreground transition-colors"
                          >
                            <Icon icon="solar:minus-circle-bold" className="h-5 w-5" />
                          </button>
                          <Input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            className="rounded-xl h-10 text-center font-bold text-lg"
                            value={quantityDisplay}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9]/g, '');
                              setQuantityDisplay(raw);
                              if (raw !== '' && raw !== '0') {
                                const val = Math.min(50, parseInt(raw));
                                field.onChange(val);
                                if (val > 1) {
                                  form.setValue("chromebook_number", "");
                                  setSelectedEquipment(null);
                                  setEquipmentValidated(false);
                                }
                              }
                            }}
                            onBlur={() => {
                              const val = Math.min(50, Math.max(1, parseInt(quantityDisplay) || 1));
                              field.onChange(val);
                              setQuantityDisplay(String(val));
                              if (val !== quantity) {
                                setSelectedEquipment(null);
                                setSelectedEquipments([]);
                                setEquipmentValidated(false);
                                form.setValue("chromebook_number", "");
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const current = Number(field.value) || 1;
                              const newVal = Math.min(50, current + 1);
                              field.onChange(newVal);
                              setQuantityDisplay(String(newVal));
                              if (newVal > 1) {
                                form.setValue("chromebook_number", "");
                                setSelectedEquipment(null);
                                setEquipmentValidated(false);
                              }
                            }}
                            className="h-10 w-10 rounded-xl border bg-muted/50 hover:bg-muted flex items-center justify-center text-foreground transition-colors"
                          >
                            <Icon icon="solar:add-circle-bold" className="h-5 w-5" />
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Busca de Chromebook */}
              <div className="space-y-3">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Buscar Chromebook
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Icon icon="solar:magnifer-line-duotone" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="ID, patrimônio ou número de série..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setEquipmentValidated(false);
                      }}
                      className="pl-10 rounded-xl h-10"
                      disabled={quantity > 1 && selectedEquipments.length >= quantity}
                    />
                    {isSearching && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  <Button 
                    type="button" 
                    onClick={handleCheckEquipment}
                    disabled={!searchQuery.trim() || isSearching}
                    className="rounded-xl h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5"
                  >
                    <Search className="h-4 w-4 mr-1.5" />
                    Buscar
                  </Button>
                </div>

                {/* Equipment Validated */}
                {equipmentValidated && selectedEquipment && quantity === 1 && (
                  <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                    <div className="h-9 w-9 rounded-lg bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-emerald-800 dark:text-emerald-200">{selectedEquipment.brand} {selectedEquipment.model}</p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">{getEquipmentDisplay(selectedEquipment)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEquipment(null);
                        setEquipmentValidated(false);
                        form.setValue("chromebook_number", "");
                      }}
                      className="text-emerald-500 hover:text-emerald-700 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {/* Search Results */}
                {searchResults.length > 0 && !equipmentValidated && (
                  <div className="border rounded-xl overflow-hidden max-h-44 overflow-y-auto">
                    {searchResults.map((eq, idx) => (
                      <button
                        key={eq.id}
                        type="button"
                        className={cn(
                          "w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors flex items-center gap-3",
                          idx !== searchResults.length - 1 && "border-b border-border/50"
                        )}
                        onClick={() => handleEquipmentSelect(eq)}
                      >
                        <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                          <Icon icon="solar:laptop-bold-duotone" className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{eq.brand} {eq.model}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {getEquipmentDisplay(eq)} {eq.serial_number && `• Série: ${eq.serial_number}`}
                          </p>
                        </div>
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 px-2 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                          Disponível
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Lista de Equipamentos Selecionados (para quantidade > 1) */}
              {quantity > 1 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Selecionados
                    </Label>
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        "text-xs font-bold px-2 py-0.5 rounded-full",
                        selectedEquipments.length === quantity
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                      )}>
                        {selectedEquipments.length}/{quantity}
                      </span>
                    </div>
                  </div>
                  
                  <div className="rounded-xl border bg-muted/20 p-2 space-y-1.5 max-h-36 overflow-y-auto">
                    {selectedEquipments.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-4">
                        <Icon icon="solar:laptop-line-duotone" className="h-8 w-8 text-muted-foreground/30" />
                        <p className="text-xs text-muted-foreground">Busque e selecione os equipamentos acima</p>
                      </div>
                    ) : (
                      selectedEquipments.map((eq, index) => (
                        <div key={eq.id} className="flex items-center justify-between p-2.5 bg-background rounded-lg border border-border/50 group">
                          <div className="flex items-center gap-2.5">
                            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] font-bold flex-shrink-0">
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{eq.brand} {eq.model}</p>
                              <p className="text-[10px] text-muted-foreground">{getEquipmentDisplay(eq)}</p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 opacity-0 group-hover:opacity-100 transition-all"
                            onClick={() => setSelectedEquipments(selectedEquipments.filter(e => e.id !== eq.id))}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* === SEÇÃO 3: Detalhes === */}
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-6 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <span className="text-xs font-bold text-purple-700 dark:text-purple-300">3</span>
                </div>
                <h3 className="text-sm font-semibold text-foreground">Detalhes</h3>
              </div>

              {/* Data, Horário e Previsão */}
              <div className="grid grid-cols-3 gap-3">
                <FormItem>
                  <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Data</FormLabel>
                  <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      value={new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date())} 
                      disabled 
                      className="pl-10 bg-muted/30 rounded-xl h-10 text-sm"
                    />
                  </div>
                </FormItem>

                <FormItem>
                  <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Horário</FormLabel>
                  <div className="relative">
                    <Icon icon="solar:clock-circle-line-duotone" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      type="time" 
                      value={getBrazilNow().time} 
                      disabled 
                      className="pl-10 bg-muted/30 rounded-xl h-10 text-sm"
                    />
                  </div>
                </FormItem>

                <FormField
                  control={form.control}
                  name="expected_return_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Devolução
                      </FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal justify-start rounded-xl h-10 text-sm",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, "dd/MM/yy") : "Opcional"}
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
              </div>

              {/* Observações */}
              <FormField
                control={form.control}
                name="observations"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Observações</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Danos, condições especiais ou informações adicionais..."
                        className="resize-none rounded-xl text-sm"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Botões */}
            <div className="flex items-center justify-between gap-3 p-5 pt-4 border-t bg-muted/20">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => onOpenChange(false)}
                className="rounded-xl text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={
                  isLoading ||
                  (quantity > 1 && selectedEquipments.length !== quantity) ||
                  (quantity === 1 && !equipmentValidated)
                }
                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg px-6 h-10"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Icon icon="solar:check-circle-bold" className="mr-2 h-4 w-4" />
                )}
                Registrar Empréstimo
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}