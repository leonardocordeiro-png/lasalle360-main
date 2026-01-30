import { useState, useEffect, useMemo } from "react";
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
  Pencil
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

  useEffect(() => {
    fetchLoans();
    fetchEquipmentMap();
    checkAdmin();

    const channel = supabase
      .channel("chromebook-loans-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chromebook_loans" },
        () => {
          fetchLoans();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Buscar mapa de equipamentos (patrimônio -> id_number)
  const fetchEquipmentMap = async () => {
    try {
      const { data, error } = await supabase
        .from('it_equipment')
        .select('patrimony, id_number')
        .ilike('equipment_type', '%chromebook%');
      
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
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, equipmentTypeFilter]);

  const checkAdmin = async () => {
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
  };

  const fetchLoans = async () => {
    try {
      const { data, error } = await supabase
        .from("chromebook_loans")
        .select(`
          *,
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
  };

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

  const exportToCSV = () => {
    const loansToExport = getFilteredLoans(statusFilter);
    const headers = [
      "Data Empréstimo",
      "Solicitante",
      "Tipo",
      "Professor Resp.",
      "Chromebook Nº",
      "Tipo Equip.",
      "Status",
      "Data Devolução",
    ];

    const csvData = loansToExport.map((loan) => [
      format(parse(loan.loan_date, "yyyy-MM-dd", new Date()), "dd/MM/yyyy"),
      loan.borrower_name,
      loan.borrower_type,
      loan.responsible_teacher || "-",
      `"${loan.equipment_id && loan.it_equipment?.id_number ? loan.it_equipment.id_number : loan.chromebook_number.replace(/, /g, ',')}"`,
      loan.equipment_type === "professor" ? "Professor" : "Aluno",
      loan.status,
      loan.return_time ? format(new Date(loan.returned_at), "dd/MM/yyyy HH:mm") : "-",
    ]);

    const csv = [headers, ...csvData].map((row) => row.join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `emprestimos_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
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
    if (type === "professor") {
      return <span className={`${baseClasses} bg-purple-100 text-purple-700`}>Professor CB</span>;
    }
    if (type === "funcionario") {
      return <span className={`${baseClasses} bg-orange-100 text-orange-700`}>Funcionário</span>;
    }
    return <span className={`${baseClasses} bg-gray-100 text-gray-700`}>{type}</span>;
  };

  const handleLoanReturnSuccess = () => {
    fetchLoans();
    setStatusFilter('devolvido');
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

  const handleDeleteLoan = async () => {
    if (!loanToDelete) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (loanToDelete.quantity > 1 && loanToDelete.chromebook_number) {
        const patrimonyNumbers = loanToDelete.chromebook_number.split(',').map((s: string) => s.trim());
        const updateEquipmentPromises = patrimonyNumbers.map(patrimony =>
          supabase.from('it_equipment')
            .update({ status: 'ATIVO' })
            .eq('patrimony', patrimony)
        );
        await Promise.all(updateEquipmentPromises);
      } else if (loanToDelete.equipment_id) {
        await supabase.from('it_equipment')
          .update({ status: 'ATIVO' })
          .eq('id', loanToDelete.equipment_id);
      }

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
      const { data: { user } } = await supabase.auth.getUser();
      const historicoLoans = getFilteredLoans('devolvido');

      const updateEquipmentPromises = historicoLoans.map(async (loan) => {
        if (loan.quantity > 1 && loan.chromebook_number) {
          const patrimonyNumbers = loan.chromebook_number.split(',').map((s: string) => s.trim());
          return Promise.all(patrimonyNumbers.map(patrimony =>
            supabase.from('it_equipment')
              .update({ status: 'ATIVO' })
              .eq('patrimony', patrimony)
          ));
        } else if (loan.equipment_id) {
          return supabase.from('it_equipment')
            .update({ status: 'ATIVO' })
            .eq('id', loan.equipment_id);
        }
        return Promise.resolve();
      });
      await Promise.all(updateEquipmentPromises);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Icon icon="solar:box-bold-duotone" className="h-7 w-7 text-primary" />
            Gerenciamento de Empréstimos
          </h1>
          <p className="text-muted-foreground mt-1">
            Controle e rastreamento de empréstimos individuais de Chromebooks
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <Button onClick={() => setShowLoanDialog(true)} className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Novo Empréstimo
          </Button>
        </div>
      </div>

      {/* Search and Filters Card */}
      <div className="bg-card border rounded-xl p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou número do Chromebook..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-background"
            />
          </div>
          <Select value={equipmentTypeFilter} onValueChange={setEquipmentTypeFilter}>
            <SelectTrigger className="w-full md:w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Todos os tipos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="professor">Professor</SelectItem>
              <SelectItem value="aluno">Aluno</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          <button
            onClick={() => setStatusFilter("em_uso")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              statusFilter === "em_uso"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Em Uso ({loanCounts.em_uso})
          </button>
          <button
            onClick={() => setStatusFilter("atrasado")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              statusFilter === "atrasado"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Atrasados ({loanCounts.atrasado})
          </button>
          <button
            onClick={() => setStatusFilter("devolvido")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              statusFilter === "devolvido"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Histórico ({loanCounts.devolvido})
          </button>
        </div>
      </div>

      {/* Clear History Button for Admin */}
      {statusFilter === 'devolvido' && isAdmin && loanCounts.devolvido > 0 && (
        <div className="flex justify-end">
          <AlertDialog open={showClearHistoryDialog} onOpenChange={setShowClearHistoryDialog}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Limpar Todo Histórico
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>⚠️ Confirmar Exclusão em Massa</AlertDialogTitle>
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
        </div>
      )}

      {/* Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left py-3 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  Status
                </th>
                <th className="text-left py-3 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  Data/Hora
                </th>
                <th className="text-left py-3 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  Solicitante
                </th>
                <th className="text-left py-3 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap hidden lg:table-cell">
                  Professor Resp.
                </th>
                <th className="text-left py-3 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  Chromebook Nº
                </th>
                <th className="text-left py-3 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap hidden md:table-cell">
                  Tipo
                </th>
                <th className="text-center py-3 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  Qtd
                </th>
                <th className="text-left py-3 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap hidden xl:table-cell">
                  Prev. Devolução
                </th>
                <th className="text-right py-3 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
                      <p className="text-muted-foreground">Carregando empréstimos...</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedLoans.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Icon icon="solar:box-line-duotone" className="h-12 w-12 text-muted-foreground/50" />
                      <h3 className="font-medium text-foreground">Nenhum empréstimo encontrado</h3>
                      <p className="text-sm text-muted-foreground">Tente ajustar os filtros de busca.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedLoans.map((loan) => {
                  const equipmentsList = getEquipmentsList(loan);
                  const hasMultipleEquipments = equipmentsList.length > 1;
                  
                  return (
                    <tr key={loan.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-3">
                        {getStatusBadge(loan.status)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-sm">
                          <p className="font-medium text-foreground whitespace-nowrap">
                            {format(parse(loan.loan_date, "yyyy-MM-dd", new Date()), "dd/MM/yy", { locale: ptBR })}
                          </p>
                          <p className="text-xs text-muted-foreground">{loan.pickup_time}</p>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8 border flex-shrink-0">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
                              {getInitials(loan.borrower_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-sm text-foreground truncate max-w-[150px]">{loan.borrower_name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{loan.borrower_type}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 hidden lg:table-cell">
                        <span className="text-sm text-foreground truncate max-w-[120px] block">
                          {loan.responsible_teacher || "—"}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-mono text-xs text-foreground">
                          {/* Exibição para equipamento único com it_equipment */}
                          {loan.equipment_id && loan.it_equipment?.id_number ? (
                            <span className="truncate block">{loan.it_equipment.id_number}</span>
                          ) : loan.equipment_id && loan.it_equipment?.patrimony ? (
                            <span className="truncate block">{equipmentMap[loan.it_equipment.patrimony.trim()] || loan.it_equipment.patrimony}</span>
                          ) : hasMultipleEquipments ? (
                            // Exibição para múltiplos equipamentos - mostra até 10
                            <div className="flex flex-col gap-0.5">
                              {equipmentsList.slice(0, 10).map((eq: string, idx: number) => (
                                <span key={idx} className="truncate block">{formatEquipmentForDisplay(eq, loan)}</span>
                              ))}
                              {equipmentsList.length > 10 && (
                                <button
                                  onClick={() => handleViewEquipments(loan)}
                                  className="text-xs text-primary hover:text-primary/80 hover:underline flex items-center gap-1 w-fit mt-1"
                                >
                                  <Eye className="h-3 w-3" />
                                  +{equipmentsList.length - 10} mais
                                </button>
                              )}
                            </div>
                          ) : (
                            // Equipamento único sem it_equipment - prioriza ID
                            <span className="truncate block">{formatEquipmentForDisplay(equipmentsList[0] || loan.chromebook_number, loan)}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 hidden md:table-cell">
                        {getBorrowerTypeBadge(loan.equipment_type)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex flex-col items-center">
                          <span className="font-semibold text-foreground">{loan.quantity}</span>
                          {loan.returned_quantity > 0 && loan.status !== 'devolvido' && (
                            <span className="text-xs text-green-600">
                              ({loan.returned_quantity} devolvido)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 hidden xl:table-cell">
                        {loan.expected_return_date ? (
                          <span className={`text-sm whitespace-nowrap ${
                            loan.status === 'atrasado' ? 'text-red-600 font-medium' : 'text-foreground'
                          }`}>
                            {format(parse(loan.expected_return_date, "yyyy-MM-dd", new Date()), "dd 'de' MMM", { locale: ptBR })}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-end gap-1">
                          {loan.status === "devolvido" && isAdmin ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
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
                                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                      onClick={() => handleEdit(loan)}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Editar empréstimo</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReturn(loan)}
                                className="gap-1.5"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
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
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
            <p className="text-sm text-muted-foreground">
              Mostrando <span className="font-medium text-foreground">{Math.min(((currentPage - 1) * ITEMS_PER_PAGE) + 1, filteredLoans.length)}</span>-
              <span className="font-medium text-foreground">{Math.min(currentPage * ITEMS_PER_PAGE, filteredLoans.length)}</span> de{' '}
              <span className="font-medium text-foreground">{filteredLoans.length}</span> empréstimos ativos
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
              >
                Próximo
                <ChevronRight className="h-4 w-4 ml-1" />
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
              return (
                <div 
                  key={index} 
                  className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border"
                >
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-mono font-medium text-foreground">{displayEquipment}</p>
                    <p className="text-xs text-muted-foreground">Chromebook</p>
                  </div>
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