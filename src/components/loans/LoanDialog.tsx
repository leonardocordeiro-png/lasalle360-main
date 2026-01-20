import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  borrower_type: z.enum(["aluno", "professor", "funcionario"]),
  responsible_teacher: z.string().optional(),
  class_name: z.string().optional(),
  equipment_type: z.enum(["professor", "aluno"]),
  chromebook_number: z.string().optional(),
  quantity: z.number().min(1).max(50),
  loan_date: z.date(),
  pickup_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato inválido (HH:MM)"),
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
        const results = await searchEquipmentForLoan(searchQuery);
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
  }, [searchQuery]);

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

  const handleEquipmentSelect = async (equipment: any) => {
    try {
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
      
      if (selectedEquipments.length === 0) {
        form.setValue("chromebook_number", getBestIdentifierForSave(equipment), { shouldValidate: true });
      }
      
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
      const validation = await validateEquipmentForLoan(searchQuery);
      if (validation.valid && validation.equipment) {
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const brNow = getBrazilNow();
      let loanRecord: any;

      if (data.quantity > 1) {
        if (selectedEquipments.length !== data.quantity) {
          toast({
            variant: "destructive",
            title: "Seleção incompleta",
            description: `Você precisa selecionar exatamente ${data.quantity} equipamentos`
          });
          setIsLoading(false);
          return;
        }
        
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
          })
          .select()
          .single();

        if (insertError) throw insertError;
        loanRecord = newLoan;

        const updatePromises = selectedEquipments.map(eq => 
          supabase.from('it_equipment')
            .update({ status: 'EMPRESTIMO' })
            .eq('id', eq.id)
        );
        await Promise.all(updatePromises);

        toast({
          title: "Sucesso!",
          description: `${data.quantity} Chromebooks emprestados!`,
        });

      } else {
        let equipmentToUse = selectedEquipment;

        if (!equipmentToUse) {
          const validation = await validateEquipmentForLoan(data.chromebook_number!);
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
          })
          .select()
          .single();

        if (insertError) throw insertError;
        loanRecord = newLoan;

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
    { value: "professor", label: "Professor", sublabel: "Docente", icon: User },
    { value: "funcionario", label: "Funcionário", sublabel: "Staff", icon: Briefcase },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Icon icon="solar:add-circle-bold-duotone" className="h-6 w-6 text-primary" />
            Novo Empréstimo de Chromebook
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 pt-4 space-y-5">
            
            {/* Tipo de Solicitante */}
            <FormField
              control={form.control}
              name="borrower_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    Tipo de Solicitante <span className="text-muted-foreground font-normal">(Tipo de Solicitante)</span>
                  </FormLabel>
                  <div className="grid grid-cols-3 gap-3 mt-2">
                    {borrowerTypeOptions.map((option) => {
                      const Icon = option.icon;
                      const isSelected = field.value === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => field.onChange(option.value)}
                          className={cn(
                            "flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all",
                            isSelected
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border hover:border-primary/50 hover:bg-muted/50"
                          )}
                        >
                          <Icon className={cn("h-5 w-5 mb-1", isSelected ? "text-primary" : "text-muted-foreground")} />
                          <span className="font-medium text-sm">{option.label}</span>
                          <span className="text-xs text-muted-foreground">{option.sublabel}</span>
                        </button>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Nome e Professor Responsável */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="borrower_name"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormLabel className="text-sm font-medium">
                      Nome do Solicitante <span className="text-muted-foreground font-normal">(Nome)</span>
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        {borrowerType === "aluno" ? (
                          // Para aluno, campo simples
                          <Input 
                            placeholder="Nome do aluno..." 
                            className="pl-10" 
                            {...field} 
                          />
                        ) : (
                          // Para professor/funcionário, campo com busca
                          <>
                            <Input 
                              placeholder="Buscar usuário..." 
                              className="pl-10"
                              value={userSearchQuery}
                              onChange={(e) => handleUserInputChange(e.target.value)}
                              onFocus={() => {
                                if (userSearchResults.length > 0) {
                                  setShowUserResults(true);
                                }
                              }}
                              onBlur={() => {
                                // Delay para permitir clique no resultado
                                setTimeout(() => setShowUserResults(false), 200);
                              }}
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
                      <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-background border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {userSearchResults.map((user) => (
                          <button
                            key={user.user_id}
                            type="button"
                            className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex items-center gap-3"
                            onClick={() => handleUserSelect(user)}
                          >
                            <Avatar className="h-8 w-8 border">
                              <AvatarImage src={user.avatar_url} />
                              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                {getInitials(user.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{user.full_name}</p>
                              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                            </div>
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 shrink-0">
                              Cadastrado
                            </Badge>
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {/* Mensagem quando não encontra usuários */}
                    {borrowerType !== "aluno" && showUserResults && userSearchQuery.length >= 2 && userSearchResults.length === 0 && !isSearchingUsers && (
                      <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-background border rounded-lg shadow-lg p-3">
                        <p className="text-sm text-muted-foreground text-center">
                          Nenhum usuário encontrado. Você pode digitar o nome manualmente.
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
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      Professor Responsável <span className="text-muted-foreground font-normal">(Prof. Resp.)</span>
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          placeholder="Nome do professor" 
                          className="pl-10" 
                          disabled={borrowerType !== "aluno"}
                          {...field} 
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Turma, Tipo de Equipamento e Quantidade */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="class_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      Turma <span className="text-muted-foreground font-normal">(Turma)</span>
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Icon icon="solar:notebook-line-duotone" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          placeholder="Ex: 9A" 
                          className="pl-10" 
                          disabled={borrowerType !== "aluno"}
                          {...field} 
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="equipment_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Tipo de Equipamento</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="aluno">Chromebook</SelectItem>
                        <SelectItem value="professor">Notebook Prof.</SelectItem>
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
                    <FormLabel className="text-sm font-medium">Quantidade</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        {...field}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          field.onChange(val);
                          if (val > 1) {
                            form.setValue("chromebook_number", "");
                            setSelectedEquipment(null);
                            setEquipmentValidated(false);
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Busca de Chromebook */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">
                Buscar Chromebook <span className="text-muted-foreground font-normal">(ID, Patrimônio ou Série)</span>
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Icon icon="solar:qr-code-line-duotone" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Escanear ou digitar ID..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setEquipmentValidated(false);
                    }}
                    className="pl-10"
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
                  className="bg-primary hover:bg-primary/90"
                >
                  Verificar
                </Button>
              </div>

              {/* Equipment Validated */}
              {equipmentValidated && selectedEquipment && quantity === 1 && (
                <div className="flex items-center gap-2 text-sm text-emerald-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-medium">
                    {selectedEquipment.patrimony} Disponível ({selectedEquipment.brand} {selectedEquipment.model})
                  </span>
                </div>
              )}

              {/* Search Results */}
              {searchResults.length > 0 && !equipmentValidated && (
                <div className="border rounded-lg mt-2 max-h-40 overflow-y-auto divide-y">
                  {searchResults.map((eq) => (
                    <button
                      key={eq.id}
                      type="button"
                      className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors"
                      onClick={() => handleEquipmentSelect(eq)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{eq.brand} {eq.model}</p>
                          <p className="text-xs text-muted-foreground">
                            {getEquipmentDisplay(eq)} • Série: {eq.serial_number}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                          Disponível
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Lista de Equipamentos Selecionados (para quantidade > 1) */}
            {quantity > 1 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    Chromebooks Selecionados ({selectedEquipments.length}/{quantity})
                  </Label>
                  {selectedEquipments.length < quantity && (
                    <Badge variant="outline" className="text-xs">
                      Faltam {quantity - selectedEquipments.length}
                    </Badge>
                  )}
                </div>
                
                <div className="border rounded-lg p-3 space-y-2 max-h-32 overflow-y-auto bg-muted/30">
                  {selectedEquipments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      Nenhum equipamento selecionado
                    </p>
                  ) : (
                    selectedEquipments.map((eq, index) => (
                      <div key={eq.id} className="flex items-center justify-between p-2 bg-background rounded border">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-primary text-primary-foreground h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs">
                            {index + 1}
                          </Badge>
                          <div>
                            <p className="text-sm font-medium">{eq.brand} {eq.model}</p>
                            <p className="text-xs text-muted-foreground">{getEquipmentDisplay(eq)}</p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => setSelectedEquipments(selectedEquipments.filter(e => e.id !== eq.id))}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Data, Horário e Previsão de Devolução */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormItem>
                <FormLabel className="text-sm font-medium">Data do Empréstimo</FormLabel>
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    value={new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date())} 
                    disabled 
                    className="pl-10 bg-muted/50"
                  />
                </div>
              </FormItem>

              <FormItem>
                <FormLabel className="text-sm font-medium">Horário de Retirada</FormLabel>
                <div className="relative">
                  <Icon icon="solar:clock-circle-line-duotone" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="time" 
                    value={getBrazilNow().time} 
                    disabled 
                    className="pl-10 bg-muted/50"
                  />
                </div>
              </FormItem>

              <FormField
                control={form.control}
                name="expected_return_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      Prev. Devolução <span className="text-muted-foreground font-normal">(Opcional)</span>
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
                            {field.value ? format(field.value, "dd/MM/yyyy") : "dd/mm/aaaa"}
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
                  <FormLabel className="text-sm font-medium">Observações</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Qualquer dano ou condição específica..."
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
                disabled={isLoading || (quantity > 1 && selectedEquipments.length !== quantity) || (quantity === 1 && !equipmentValidated && !selectedEquipment)}
                className="bg-primary hover:bg-primary/90"
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Icon icon="solar:diskette-bold" className="mr-2 h-4 w-4" />
                Registrar Empréstimo
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}