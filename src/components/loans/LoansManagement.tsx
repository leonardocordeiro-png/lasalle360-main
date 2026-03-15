import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Download, 
  Search, 
  Filter, 
  Trash2, 
  Plus,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Eye,
  Pencil,
  Calendar
} from "lucide-react";
import { Icon } from "@iconify/react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

// Função para formatar nome: primeiro nome + último sobrenome
const formatUserName = (fullName: string) => {
  if (!fullName) return '';
  
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 2) return fullName;
  
  return `${parts[0]} ${parts[parts.length - 1]}`;
};

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LoanDialog } from "./LoanDialog";
import { LoanReturnDialog } from "./LoanReturnDialog";
import { LoanEditDialog } from "./LoanEditDialog";

const ITEMS_PER_PAGE = 10;

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

export function LoansManagement() {
  const { toast } = useToast();
  const [loans, setLoans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showLoanDialog, setShowLoanDialog] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showEquipmentsDialog, setShowEquipmentsDialog] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [loanToDelete, setLoanToDelete] = useState<any>(null);
  const [showClearHistoryDialog, setShowClearHistoryDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("em_uso");
  const [equipmentTypeFilter, setEquipmentTypeFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [equipmentMap, setEquipmentMap] = useState<Record<string, string>>({});

  // Função para verificar se o patrimônio é válido (não é "SEM PATRIMÔNIO" ou similar)
  const isValidPatrimony = (patrimony: string | null | undefined): boolean => {
    if (!patrimony) return false;
    const normalized = normalizePatrimony(patrimony).toLowerCase().trim();
    const invalidPatterns = ['sem patrimonio', 'sem patrimônio', 'n/a', 'na', '-', ''];
    return !invalidPatterns.includes(normalized);
  };

  // Função para obter o melhor identificador do equipamento
  const getBestEquipmentIdentifier = (loan: any): string => {
    // Se tem it_equipment vinculado
    if (loan.equipment_id && loan.it_equipment) {
      const { id_number, patrimony } = loan.it_equipment;
      
      // Prioridade 1: ID do equipamento (se existir)
      if (id_number && id_number.trim()) {
        return `ID: ${id_number}`;
      }
      
      // Prioridade 2: Patrimônio (se for válido)
      if (isValidPatrimony(patrimony)) {
        return normalizePatrimony(patrimony);
      }
      
      // Se patrimônio inválido mas tem id_number
      if (id_number) {
        return `ID: ${id_number}`;
      }
    }
    
    // Fallback: usar chromebook_number do empréstimo
    const chromebookNumber = loan.chromebook_number || '';
    
    // Verificar se o chromebook_number é um patrimônio inválido
    if (!isValidPatrimony(chromebookNumber)) {
      // Se tiver it_equipment com id_number, usar
      if (loan.it_equipment?.id_number) {
        return `ID: ${loan.it_equipment.id_number}`;
      }
    }
    
    return normalizePatrimony(chromebookNumber);
  };

  // Ref para debounce do realtime
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Buscar mapa de equipamentos (patrimônio -> id_number)
  const fetchEquipmentMap = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('it_equipment')
        .select('patrimony, id_number');
      
      if (error) throw error;
      
      const map: Record<string, string> = {};
      data?.forEach(eq => {
        if (eq.patrimony && eq.id_number) {
          map[eq.patrimony.trim()] = eq.id_number;
        }
      });
      setEquipmentMap(map);
    } catch (error) {
      console.error('Error fetching equipment map:', error);
    }
  }, []);

  const checkAdmin = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      setIsAdmin(!!data);
    } catch (error) {
      console.error("Error checking admin status:", error);
    }
  }, []);

  const fetchLoans = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("chromebook_loans")
        .select(`
          id, borrower_name, borrower_type, responsible_teacher, class_name,
          chromebook_number, equipment_type, quantity, loan_date, pickup_time,
          expected_return_date, status, observations, return_time, returned_at,
          returned_by, returned_quantity, created_at, equipment_id,
          it_equipment (
            id_number,
            patrimony
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLoans(data || []);
    } catch (error: any) {
      console.error("Error fetching loans:", error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar empréstimos",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Inicialização: carregar tudo em paralelo
  useEffect(() => {
    Promise.all([fetchLoans(true), fetchEquipmentMap(), checkAdmin()]);

    const channel = supabase
      .channel("chromebook-loans-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chromebook_loans" },
        () => {
          // Debounce realtime updates para evitar múltiplas chamadas seguidas
          if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
          realtimeTimerRef.current = setTimeout(() => {
            fetchLoans(false);
          }, 500);
        }
      )
      .subscribe();

    return () => {
      if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [fetchLoans, fetchEquipmentMap, checkAdmin]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, equipmentTypeFilter]);

  const getFilteredLoans = (currentStatusFilter: string) => {
    let filtered = [...loans];

    if (searchTerm) {
      filtered = filtered.filter(
        (loan) =>
          loan.borrower_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          loan.chromebook_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (loan.it_equipment?.id_number && loan.it_equipment.id_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (loan.it_equipment?.patrimony && loan.it_equipment.patrimony.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (equipmentTypeFilter !== "all") {
      filtered = filtered.filter((loan) => loan.equipment_type === equipmentTypeFilter);
    }

    if (currentStatusFilter !== "all") {
      filtered = filtered.filter((loan) => loan.status === currentStatusFilter);
    }

    return filtered;
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = "flex items-center gap-1.5 font-medium text-xs px-2.5 py-1 rounded-full";
    
    if (status === "em_uso") {
      return (
        <span className={`${baseClasses} bg-emerald-100 text-emerald-700 border border-emerald-200`}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          Em Uso
        </span>
      );
    }
    if (status === "atrasado") {
      return (
        <span className={`${baseClasses} bg-amber-100 text-amber-700 border border-amber-200`}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          Atrasado
        </span>
      );
    }
    if (status === "devolvido") {
      return (
        <span className={`${baseClasses} bg-gray-100 text-gray-600 border border-gray-200`}>
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
          Devolvido
        </span>
      );
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  const getBorrowerTypeBadge = (type: string) => {
    const baseClasses = "text-xs px-2 py-0.5 rounded font-medium";
    
    if (type === "aluno") {
      return <span className={`${baseClasses} bg-blue-100 text-blue-700`}>Aluno CB</span>;
    }
    if (type === "colaborador") {
      return <span className={`${baseClasses} bg-teal-100 text-teal-700`}>Colaborador CB</span>;
    }
    if (type === "professor") {
      return <span className={`${baseClasses} bg-purple-100 text-purple-700`}>Notebook Prof.</span>;
    }
    if (type === "funcionario") {
      return <span className={`${baseClasses} bg-orange-100 text-orange-700`}>Funcionário</span>;
    }
    return <span className={`${baseClasses} bg-gray-100 text-gray-700`}>{type}</span>;
  };

  const handleLoanReturnSuccess = () => {
    fetchLoans();
  };

  const handleReturn = (loan: any) => {
    setSelectedLoan(loan);
    setShowReturnDialog(true);
  };

  const handleEdit = (loan: any) => {
    setSelectedLoan(loan);
    setShowEditDialog(true);
  };

  const handleViewEquipments = (loan: any) => {
    setSelectedLoan(loan);
    setShowEquipmentsDialog(true);
  };

  // Reativar equipamentos de um empréstimo ao excluir/limpar histórico.
  // Usa equipment_id (UUID) quando disponível (empréstimos de 1 equip.) ou
  // distingue patrimônio vs id_number pelo equipmentMap para empréstimos múltiplos.
  const reactivateEquipmentsFromLoan = async (loan: any) => {
    if (loan.equipment_id) {
      // Equipamento único registrado por UUID — mais confiável
      await supabase.from('it_equipment').update({ status: 'ATIVO' }).eq('id', loan.equipment_id);
      return;
    }
    if (!loan.chromebook_number) return;

    const identifiers = loan.chromebook_number.split(',').map((s: string) => s.trim()).filter(Boolean);
    const patrimonyItems = identifiers.filter((v: string) => equipmentMap[v]);
    const idNumberItems = identifiers.filter((v: string) => !equipmentMap[v]);

    const ops: Promise<any>[] = [];
    if (patrimonyItems.length > 0) {
      ops.push(supabase.from('it_equipment').update({ status: 'ATIVO' }).in('patrimony', patrimonyItems));
    }
    if (idNumberItems.length > 0) {
      ops.push(supabase.from('it_equipment').update({ status: 'ATIVO' }).in('id_number', idNumberItems));
    }
    if (ops.length > 0) await Promise.all(ops);
  };

  const handleDeleteLoan = async () => {
    if (!loanToDelete) return;

    try {
      await reactivateEquipmentsFromLoan(loanToDelete);

      const { error } = await supabase
        .from('chromebook_loans')
        .delete()
        .eq('id', loanToDelete.id);

      if (error) throw error;

      toast({
        title: "Empréstimo excluído",
        description: "O registro foi removido do histórico"
      });

      setShowDeleteDialog(false);
      setLoanToDelete(null);
      fetchLoans();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível excluir o registro"
      });
    }
  };

  const handleClearHistory = async () => {
    try {
      const historicoLoans = getFilteredLoans('devolvido');

      await Promise.all(historicoLoans.map(reactivateEquipmentsFromLoan));

      const { error } = await supabase
        .from('chromebook_loans')
        .delete()
        .eq('status', 'devolvido');

      if (error) throw error;

      toast({
        title: "Histórico limpo",
        description: `${historicoLoans.length} registros foram excluídos`
      });

      setShowClearHistoryDialog(false);
      fetchLoans();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível limpar o histórico"
      });
    }
  };

  const exportToCSV = () => {
    const filtered = getFilteredLoans("all");
    
    const csvContent = [
      // Header
      [
        "Data do Empréstimo",
        "Horário de Retirada", 
        "Solicitante",
        "Tipo de Solicitante",
        "Professor Responsável",
        "Turma",
        "Chromebook Nº",
        "Tipo",
        "Quantidade",
        "Previsão de Devolução",
        "Status",
        "Data de Devolução",
        "Horário de Devolução"
      ].join(","),
      // Data rows
      ...filtered.map(loan => [
        loan.loan_date,
        loan.pickup_time,
        loan.borrower_name,
        loan.borrower_type,
        loan.responsible_teacher || "",
        loan.class_name || "",
        getChromebookDisplay(loan),
        loan.equipment_type || "",
        loan.quantity,
        loan.expected_return_date || "",
        loan.status,
        loan.returned_at ? format(new Date(loan.returned_at), "dd/MM/yyyy") : "",
        loan.return_time || ""
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `emprestimos_${format(new Date(), "dd-MM-yyyy_HH-mm")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const loanCounts = useMemo(() => {
    const allFilteredBySearchAndType = getFilteredLoans("all");
    return {
      em_uso: allFilteredBySearchAndType.filter(l => l.status === 'em_uso').length,
      atrasado: allFilteredBySearchAndType.filter(l => l.status === 'atrasado').length,
      devolvido: allFilteredBySearchAndType.filter(l => l.status === 'devolvido').length,
    };
  }, [loans, searchTerm, equipmentTypeFilter]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  // Função para obter a exibição correta do número do Chromebook
  const getChromebookDisplay = (loan: any) => {
    // Se tem equipment_id e it_equipment com id_number, usar id_number
    if (loan.equipment_id && loan.it_equipment?.id_number) {
      return loan.it_equipment.id_number;
    }
    
    // Se tem equipment_id e it_equipment com patrimony, usar patrimony
    if (loan.equipment_id && loan.it_equipment?.patrimony) {
      return loan.it_equipment.patrimony;
    }
    
    // Caso contrário, usar chromebook_number (pode ser múltiplos separados por vírgula)
    return loan.chromebook_number;
  };

  // Função para obter lista de equipamentos de um empréstimo
  const getEquipmentsList = (loan: any): string[] => {
    if (!loan.chromebook_number) return [];
    return loan.chromebook_number.split(',').map((num: string) => num.trim()).filter((num: string) => num.length > 0);
  };

  // Função para obter apenas equipamentos que ainda não foram devolvidos
  const getPendingEquipmentsList = (loan: any): string[] => {
    const allEquipments = getEquipmentsList(loan);
    const alreadyReturned = loan.returned_quantity || 0;
    // Retornar apenas equipamentos que ainda não foram devolvidos
    return allEquipments.slice(alreadyReturned);
  };

  // Função para formatar lista de equipamentos para exibição (prioriza ID sobre Patrimônio)
  const formatEquipmentForDisplay = (equipment: string, loan: any): string => {
    const trimmedEquipment = equipment.trim();
    
    // Prioridade 1: Buscar ID no mapa de equipamentos pelo patrimônio
    if (equipmentMap[trimmedEquipment]) {
      return equipmentMap[trimmedEquipment];
    }
    
    // Prioridade 2: Tentar usar o id_number do it_equipment se disponível
    if (loan.it_equipment?.id_number) {
      return loan.it_equipment.id_number;
    }
    
    // Fallback: usar o patrimônio normalizado
    return normalizePatrimony(equipment);
  };

  const filteredLoans = getFilteredLoans(statusFilter);
  const totalPages = Math.ceil(filteredLoans.length / ITEMS_PER_PAGE);
  const paginatedLoans = filteredLoans.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const totalActiveLoans = loanCounts.em_uso + loanCounts.atrasado;
  const totalEquipmentOut = loans.filter(l => l.status === 'em_uso' || l.status === 'atrasado').reduce((sum, l) => sum + (l.quantity || 0), 0);

  return (
    <div className="space-y-5">
      {/* Header com gradiente */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-6 md:p-8 text-white shadow-xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30"></div>
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 shadow-lg">
              <Icon icon="solar:laptop-bold-duotone" className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Empréstimos</h1>
              <p className="text-blue-100 text-sm mt-0.5">Controle e rastreamento de Chromebooks</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportToCSV} className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white backdrop-blur-sm">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <Button onClick={() => setShowLoanDialog(true)} className="bg-white text-blue-700 hover:bg-blue-50 font-semibold shadow-lg">
              <Plus className="h-4 w-4 mr-2" />
              Novo Empréstimo
            </Button>
          </div>
        </div>

        {/* Stats dentro do header */}
        <div className="relative grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/10">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></div>
              <span className="text-xs text-blue-100 font-medium">Em Uso</span>
            </div>
            <p className="text-2xl font-bold">{loanCounts.em_uso}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/10">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-2 w-2 rounded-full bg-amber-400"></div>
              <span className="text-xs text-blue-100 font-medium">Atrasados</span>
            </div>
            <p className="text-2xl font-bold">{loanCounts.atrasado}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/10">
            <div className="flex items-center gap-2 mb-1">
              <Icon icon="solar:laptop-line-duotone" className="h-3.5 w-3.5 text-blue-200" />
              <span className="text-xs text-blue-100 font-medium">Equipamentos Fora</span>
            </div>
            <p className="text-2xl font-bold">{totalEquipmentOut}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/10">
            <div className="flex items-center gap-2 mb-1">
              <Icon icon="solar:history-line-duotone" className="h-3.5 w-3.5 text-blue-200" />
              <span className="text-xs text-blue-100 font-medium">Devolvidos</span>
            </div>
            <p className="text-2xl font-bold">{loanCounts.devolvido}</p>
          </div>
        </div>
      </div>

      {/* Filtros com tabs visuais */}
      <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 space-y-4">
          {/* Tab filters */}
          <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-xl w-fit">
            <button
              onClick={() => setStatusFilter("em_uso")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                statusFilter === "em_uso"
                  ? "bg-white dark:bg-gray-800 text-emerald-700 dark:text-emerald-400 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${statusFilter === "em_uso" ? "bg-emerald-500" : "bg-muted-foreground/30"}`}></span>
              Em Uso
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                statusFilter === "em_uso" ? "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"
              }`}>{loanCounts.em_uso}</span>
            </button>
            <button
              onClick={() => setStatusFilter("atrasado")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                statusFilter === "atrasado"
                  ? "bg-white dark:bg-gray-800 text-amber-700 dark:text-amber-400 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${statusFilter === "atrasado" ? "bg-amber-500" : "bg-muted-foreground/30"}`}></span>
              Atrasados
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                statusFilter === "atrasado" ? "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground"
              }`}>{loanCounts.atrasado}</span>
            </button>
            <button
              onClick={() => setStatusFilter("devolvido")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                statusFilter === "devolvido"
                  ? "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${statusFilter === "devolvido" ? "bg-gray-400" : "bg-muted-foreground/30"}`}></span>
              Devolvidos
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                statusFilter === "devolvido" ? "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400" : "bg-muted text-muted-foreground"
              }`}>{loanCounts.devolvido}</span>
            </button>
          </div>

          {/* Search + Type filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, Chromebook ou patrimônio..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-background rounded-xl h-10"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <Icon icon="solar:close-circle-bold" className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="rounded-xl gap-2 h-10">
                    <Filter className="h-3.5 w-3.5" />
                    {equipmentTypeFilter === "all" ? "Todos" : equipmentTypeFilter === "aluno" ? "Aluno" : equipmentTypeFilter === "colaborador" ? "Colaborador" : "Professor"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEquipmentTypeFilter("all")}>Todos os tipos</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setEquipmentTypeFilter("aluno")}>Chromebook Aluno</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setEquipmentTypeFilter("colaborador")}>Chromebook Colaborador</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setEquipmentTypeFilter("professor")}>Notebook Professor</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Clear History Button for Admin */}
              {statusFilter === 'devolvido' && isAdmin && loanCounts.devolvido > 0 && (
                <AlertDialog open={showClearHistoryDialog} onOpenChange={setShowClearHistoryDialog}>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="rounded-xl h-10 gap-2">
                      <Trash2 className="h-3.5 w-3.5" />
                      Limpar Histórico
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar Exclusão em Massa</AlertDialogTitle>
                      <AlertDialogDescription>
                        Você está prestes a excluir <strong>{loanCounts.devolvido} registros</strong> do histórico de empréstimos.
                        <br /><br />
                        Esta ação não pode ser desfeita e será registrada em auditoria.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleClearHistory} className="bg-red-600 hover:bg-red-700">
                        Sim, excluir tudo
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left py-3.5 px-4 font-semibold text-[11px] uppercase tracking-widest text-muted-foreground">
                  Solicitante
                </th>
                <th className="text-left py-3.5 px-4 font-semibold text-[11px] uppercase tracking-widest text-muted-foreground hidden lg:table-cell">
                  Professor Resp.
                </th>
                <th className="text-center py-3.5 px-4 font-semibold text-[11px] uppercase tracking-widest text-muted-foreground">
                  Chromebook
                </th>
                <th className="text-center py-3.5 px-4 font-semibold text-[11px] uppercase tracking-widest text-muted-foreground">
                  Qtd
                </th>
                <th className="text-center py-3.5 px-4 font-semibold text-[11px] uppercase tracking-widest text-muted-foreground hidden md:table-cell">
                  Data
                </th>
                <th className="text-center py-3.5 px-4 font-semibold text-[11px] uppercase tracking-widest text-muted-foreground hidden xl:table-cell">
                  Previsão
                </th>
                <th className="text-right py-3.5 px-4 font-semibold text-[11px] uppercase tracking-widest text-muted-foreground">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="relative">
                        <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary/20 border-t-primary"></div>
                        <Icon icon="solar:laptop-bold-duotone" className="absolute inset-0 m-auto h-4 w-4 text-primary" />
                      </div>
                      <p className="text-sm text-muted-foreground">Carregando empréstimos...</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedLoans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                        <Icon icon="solar:box-line-duotone" className="h-8 w-8 text-muted-foreground/40" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">Nenhum empréstimo encontrado</h3>
                        <p className="text-sm text-muted-foreground mt-1">Tente ajustar os filtros ou faça um novo empréstimo.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedLoans.map((loan, index) => {
                  const equipmentsList = getEquipmentsList(loan);
                  const hasMultipleEquipments = equipmentsList.length > 1;
                  
                  return (
                    <tr 
                      key={loan.id} 
                      className={`group transition-colors hover:bg-blue-50/50 dark:hover:bg-blue-950/20 ${
                        index !== paginatedLoans.length - 1 ? 'border-b border-border/50' : ''
                      }`}
                    >
                      {/* Solicitante - coluna combinada com status, nome e tipo */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Avatar className="h-10 w-10 border-2 border-background shadow-sm flex-shrink-0">
                              <AvatarFallback className={`text-xs font-bold ${
                                loan.status === 'em_uso' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' :
                                loan.status === 'atrasado' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' :
                                'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                              }`}>
                                {getInitials(loan.borrower_name)}
                              </AvatarFallback>
                            </Avatar>
                            {/* Status dot */}
                            <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-gray-900 ${
                              loan.status === 'em_uso' ? 'bg-emerald-500' :
                              loan.status === 'atrasado' ? 'bg-amber-500' :
                              'bg-gray-400'
                            }`}></span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-foreground truncate max-w-[180px]">{formatUserName(loan.borrower_name)}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {getBorrowerTypeBadge(loan.equipment_type)}
                              {loan.class_name && loan.class_name !== 'Sem turma' && (
                                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{loan.class_name}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Professor Responsável */}
                      <td className="py-3 px-4 hidden lg:table-cell">
                        {loan.responsible_teacher ? (
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                              <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300">{getInitials(loan.responsible_teacher)}</span>
                            </div>
                            <span className="text-sm text-foreground truncate max-w-[120px]">{formatUserName(loan.responsible_teacher)}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground/50">—</span>
                        )}
                      </td>

                      {/* Chromebook */}
                      <td className="py-3 px-4">
                        <div className="flex justify-center">
                          {loan.equipment_id && loan.it_equipment?.id_number ? (
                            <div className="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-1.5">
                              <Icon icon="solar:laptop-bold-duotone" className="h-3.5 w-3.5 text-blue-500" />
                              <span className="font-mono font-bold text-sm text-blue-700 dark:text-blue-300">{loan.it_equipment.id_number}</span>
                            </div>
                          ) : loan.equipment_id && loan.it_equipment?.patrimony ? (
                            <div className="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-1.5">
                              <Icon icon="solar:laptop-bold-duotone" className="h-3.5 w-3.5 text-blue-500" />
                              <span className="font-mono font-bold text-sm text-blue-700 dark:text-blue-300">{equipmentMap[loan.it_equipment.patrimony.trim()] || loan.it_equipment.patrimony}</span>
                            </div>
                          ) : hasMultipleEquipments ? (
                            <div className="flex flex-col gap-1 items-center">
                              <div className="flex flex-wrap gap-1 justify-center max-w-[200px]">
                                {getPendingEquipmentsList(loan).slice(0, 5).map((eq: string, idx: number) => (
                                  <span key={idx} className="inline-flex items-center bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md px-2 py-0.5 font-mono text-xs font-semibold text-blue-700 dark:text-blue-300">
                                    {formatEquipmentForDisplay(eq, loan)}
                                  </span>
                                ))}
                              </div>
                              {getPendingEquipmentsList(loan).length > 5 && (
                                <button
                                  onClick={() => handleViewEquipments(loan)}
                                  className="text-xs text-primary hover:text-primary/80 hover:underline flex items-center gap-1 mt-0.5"
                                >
                                  <Eye className="h-3 w-3" />
                                  +{getPendingEquipmentsList(loan).length - 5} mais
                                </button>
                              )}
                              {loan.returned_quantity > 0 && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {loan.returned_quantity} já devolvido(s)
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-1.5">
                              <Icon icon="solar:laptop-bold-duotone" className="h-3.5 w-3.5 text-blue-500" />
                              <span className="font-mono font-bold text-sm text-blue-700 dark:text-blue-300">{formatEquipmentForDisplay(equipmentsList[0] || loan.chromebook_number, loan)}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Quantidade */}
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-muted/70 font-bold text-sm text-foreground">{loan.quantity}</span>
                          {loan.returned_quantity > 0 && loan.status !== 'devolvido' && (
                            <span className="text-[10px] text-emerald-600 font-medium mt-0.5">
                              {loan.returned_quantity} devolvido
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Data */}
                      <td className="py-3 px-4 hidden md:table-cell text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="text-sm font-medium text-foreground whitespace-nowrap">
                            {format(parse(loan.loan_date, "yyyy-MM-dd", new Date()), "dd/MM/yy", { locale: ptBR })}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{loan.pickup_time}</span>
                        </div>
                      </td>

                      {/* Previsão */}
                      <td className="py-3 px-4 hidden xl:table-cell text-center">
                        {loan.expected_return_date ? (
                          <span className={`inline-flex items-center gap-1 text-sm whitespace-nowrap px-2 py-1 rounded-lg ${
                            loan.status === 'atrasado' 
                              ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 font-semibold' 
                              : 'text-foreground'
                          }`}>
                            {loan.status === 'atrasado' && <Icon icon="solar:danger-triangle-bold" className="h-3.5 w-3.5" />}
                            {format(parse(loan.expected_return_date, "yyyy-MM-dd", new Date()), "dd/MM", { locale: ptBR })}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground/50">—</span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {loan.status === "devolvido" && isAdmin ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                    onClick={() => {
                                      setLoanToDelete(loan);
                                      setShowDeleteDialog(true);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Excluir registro</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : loan.status !== "devolvido" ? (
                            <>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => handleEdit(loan)}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Editar</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <Button
                                size="sm"
                                onClick={() => handleReturn(loan)}
                                className="h-8 rounded-lg gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm text-xs font-semibold px-3"
                              >
                                <RotateCcw className="h-3 w-3" />
                                Devolver
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/10">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{Math.min(((currentPage - 1) * ITEMS_PER_PAGE) + 1, filteredLoans.length)}</span>
              {' - '}
              <span className="font-semibold text-foreground">{Math.min(currentPage * ITEMS_PER_PAGE, filteredLoans.length)}</span>
              {' de '}
              <span className="font-semibold text-foreground">{filteredLoans.length}</span>
              {' registros'}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0 rounded-lg"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`h-8 w-8 rounded-lg text-xs font-medium transition-colors ${
                        currentPage === pageNum
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="h-8 w-8 p-0 rounded-lg"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Dialog para visualizar todos os equipamentos */}
      <Dialog open={showEquipmentsDialog} onOpenChange={setShowEquipmentsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon icon="solar:laptop-bold-duotone" className="h-5 w-5 text-primary" />
              Equipamentos do Empréstimo
            </DialogTitle>
            <DialogDescription>
              Lista completa de Chromebooks emprestados para {selectedLoan?.borrower_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {selectedLoan && getEquipmentsList(selectedLoan).map((equipment: string, index: number) => {
              const displayEquipment = formatEquipmentForDisplay(equipment, selectedLoan);
              const isReturned = index < (selectedLoan.returned_quantity || 0);
              const isPending = !isReturned;
              
              return (
                <div 
                  key={index} 
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    isReturned 
                      ? 'bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-700 opacity-60' 
                      : 'bg-muted/50 border-border'
                  }`}
                >
                  <div className={`flex items-center justify-center h-8 w-8 rounded-full font-semibold text-sm ${
                    isReturned 
                      ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400' 
                      : 'bg-primary/10 text-primary'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className={`font-mono font-medium ${
                      isReturned ? 'text-gray-600 dark:text-gray-400 line-through' : 'text-foreground'
                    }`}>{displayEquipment}</p>
                    <p className="text-xs text-muted-foreground">Chromebook</p>
                  </div>
                  {isReturned && (
                    <div className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium">Devolvido</span>
                    </div>
                  )}
                  {isPending && (
                    <div className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded-full bg-amber-500"></div>
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Pendente</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between items-center pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Total: <span className="font-semibold text-foreground">{selectedLoan ? getEquipmentsList(selectedLoan).length : 0}</span> equipamentos
            </p>
            <Button variant="outline" onClick={() => setShowEquipmentsDialog(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <LoanDialog
        open={showLoanDialog}
        onOpenChange={setShowLoanDialog}
        onSuccess={fetchLoans}
      />

      <LoanEditDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        loan={selectedLoan}
        onSuccess={fetchLoans}
      />

      <LoanReturnDialog
        open={showReturnDialog}
        onOpenChange={setShowReturnDialog}
        loan={selectedLoan}
        onSuccess={handleLoanReturnSuccess}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este registro do histórico?
              <br /><br />
              <strong>Solicitante:</strong> {loanToDelete?.borrower_name}<br />
              <strong>Chromebook:</strong> {loanToDelete?.chromebook_number}<br />
              <strong>Data:</strong> {loanToDelete && format(parse(loanToDelete.loan_date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy')}
              <br /><br />
              Esta ação será registrada em auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteLoan} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}